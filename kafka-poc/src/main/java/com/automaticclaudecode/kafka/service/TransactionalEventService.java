package com.automaticclaudecode.kafka.service;

import com.automaticclaudecode.kafka.avro.UserEvent;
import com.automaticclaudecode.kafka.avro.OrderEvent;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.retry.Retry;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.function.Supplier;

/**
 * Transactional event service implementing exactly-once processing
 * with comprehensive error handling and resilience patterns
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionalEventService {

    private final KafkaTemplate<String, Object> transactionalKafkaTemplate;
    private final MeterRegistry meterRegistry;
    
    @Qualifier("kafka-producer-circuit-breaker")
    private final CircuitBreaker circuitBreaker;
    
    @Qualifier("kafka-retry")
    private final Retry retry;
    
    @Qualifier("dlq-retry")
    private final Retry dlqRetry;

    @Value("${kafka-poc.topics.user-events}")
    private String userEventsTopic;

    @Value("${kafka-poc.topics.order-events}")
    private String orderEventsTopic;

    @Value("${kafka-poc.topics.dead-letter}")
    private String deadLetterTopic;

    private Counter transactionalSuccessCounter;
    private Counter transactionalErrorCounter;
    private Counter rollbackCounter;
    private Timer transactionTimer;

    @PostConstruct
    public void initMetrics() {
        transactionalSuccessCounter = Counter.builder("kafka.transactional.success")
            .description("Successful transactional operations")
            .register(meterRegistry);
        
        transactionalErrorCounter = Counter.builder("kafka.transactional.error")
            .description("Failed transactional operations")
            .register(meterRegistry);
        
        rollbackCounter = Counter.builder("kafka.transactional.rollback")
            .description("Transaction rollbacks")
            .register(meterRegistry);
        
        transactionTimer = Timer.builder("kafka.transactional.duration")
            .description("Transaction duration")
            .register(meterRegistry);
    }

    /**
     * Send single event with exactly-once semantics
     */
    @Transactional("kafkaTransactionManager")
    public CompletableFuture<SendResult<String, Object>> sendEventTransactionally(
            Object event, String topic, String key) {
        
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.debug("Starting transactional send: topic={}, key={}", topic, key);
            
            // Wrap the operation with circuit breaker and retry
            Supplier<CompletableFuture<SendResult<String, Object>>> operation = 
                Retry.decorateSupplier(retry,
                    CircuitBreaker.decorateSupplier(circuitBreaker, () -> {
                        return executeTransactionalSend(event, topic, key);
                    }));
            
            CompletableFuture<SendResult<String, Object>> result = operation.get();
            
            result.whenComplete((sendResult, throwable) -> {
                sample.stop(transactionTimer);
                if (throwable == null) {
                    transactionalSuccessCounter.increment();
                    log.info("Transactional send completed: topic={}, partition={}, offset={}", 
                            topic, sendResult.getRecordMetadata().partition(), 
                            sendResult.getRecordMetadata().offset());
                } else {
                    transactionalErrorCounter.increment();
                    log.error("Transactional send failed: topic={}, error={}", 
                             topic, throwable.getMessage(), throwable);
                }
            });
            
            return result;
            
        } catch (Exception e) {
            sample.stop(transactionTimer);
            transactionalErrorCounter.increment();
            log.error("Transaction initiation failed: topic={}, error={}", topic, e.getMessage(), e);
            throw new RuntimeException("Transactional send failed", e);
        }
    }

    /**
     * Send multiple events in a single transaction (atomic batch)
     */
    @Transactional("kafkaTransactionManager")
    public List<CompletableFuture<SendResult<String, Object>>> sendBatchTransactionally(
            List<EventMessage> events) {
        
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.debug("Starting batch transactional send: {} events", events.size());
            
            List<CompletableFuture<SendResult<String, Object>>> futures = new ArrayList<>();
            
            // Send all events in the same transaction
            for (EventMessage eventMessage : events) {
                CompletableFuture<SendResult<String, Object>> future = 
                    executeTransactionalSend(eventMessage.getEvent(), 
                                           eventMessage.getTopic(), 
                                           eventMessage.getKey());
                futures.add(future);
            }
            
            // Wait for all to complete before committing transaction
            CompletableFuture<Void> allFutures = CompletableFuture.allOf(
                futures.toArray(new CompletableFuture[0]));
            
            allFutures.whenComplete((result, throwable) -> {
                sample.stop(transactionTimer);
                if (throwable == null) {
                    transactionalSuccessCounter.increment();
                    log.info("Batch transactional send completed: {} events", events.size());
                } else {
                    transactionalErrorCounter.increment();
                    rollbackCounter.increment();
                    log.error("Batch transactional send failed, rolling back: {}", 
                             throwable.getMessage(), throwable);
                }
            });
            
            return futures;
            
        } catch (Exception e) {
            sample.stop(transactionTimer);
            transactionalErrorCounter.increment();
            rollbackCounter.increment();
            log.error("Batch transaction failed: {}", e.getMessage(), e);
            throw new RuntimeException("Batch transactional send failed", e);
        }
    }

    /**
     * Send user event with full transactional guarantees
     */
    public CompletableFuture<SendResult<String, Object>> sendUserEventTransactionally(
            UserEvent userEvent) {
        return sendEventTransactionally(userEvent, userEventsTopic, userEvent.getUserId());
    }

    /**
     * Send order event with full transactional guarantees
     */
    public CompletableFuture<SendResult<String, Object>> sendOrderEventTransactionally(
            OrderEvent orderEvent) {
        return sendEventTransactionally(orderEvent, orderEventsTopic, orderEvent.getOrderId());
    }

    /**
     * Process related events atomically (e.g., user and order together)
     */
    @Transactional("kafkaTransactionManager")
    public CompletableFuture<List<SendResult<String, Object>>> processRelatedEventsAtomically(
            UserEvent userEvent, List<OrderEvent> orderEvents) {
        
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.info("Processing related events atomically: user={}, orders={}", 
                    userEvent.getUserId(), orderEvents.size());
            
            List<EventMessage> allEvents = new ArrayList<>();
            
            // Add user event
            allEvents.add(new EventMessage(userEvent, userEventsTopic, userEvent.getUserId()));
            
            // Add all order events
            for (OrderEvent orderEvent : orderEvents) {
                allEvents.add(new EventMessage(orderEvent, orderEventsTopic, orderEvent.getOrderId()));
            }
            
            // Send all in one transaction
            List<CompletableFuture<SendResult<String, Object>>> futures = 
                sendBatchTransactionally(allEvents);
            
            // Return combined result
            CompletableFuture<List<SendResult<String, Object>>> combinedResult = 
                CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                    .thenApply(v -> futures.stream()
                        .map(CompletableFuture::join)
                        .toList());
            
            combinedResult.whenComplete((results, throwable) -> {
                sample.stop(transactionTimer);
                if (throwable == null) {
                    log.info("Related events processed successfully: {} total events", results.size());
                } else {
                    log.error("Related events processing failed: {}", throwable.getMessage(), throwable);
                }
            });
            
            return combinedResult;
            
        } catch (Exception e) {
            sample.stop(transactionTimer);
            rollbackCounter.increment();
            log.error("Related events processing failed: {}", e.getMessage(), e);
            throw new RuntimeException("Related events processing failed", e);
        }
    }

    /**
     * Saga pattern implementation for complex business transactions
     */
    @Transactional("kafkaTransactionManager")
    public CompletableFuture<SagaResult> executeSaga(List<SagaStep> sagaSteps) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.info("Executing saga with {} steps", sagaSteps.size());
            
            List<CompletableFuture<SendResult<String, Object>>> stepResults = new ArrayList<>();
            List<SagaStep> executedSteps = new ArrayList<>();
            
            for (SagaStep step : sagaSteps) {
                try {
                    CompletableFuture<SendResult<String, Object>> stepResult = 
                        executeTransactionalSend(step.getEvent(), step.getTopic(), step.getKey());
                    
                    stepResults.add(stepResult);
                    executedSteps.add(step);
                    
                    // Check if step completed successfully
                    stepResult.join(); // Wait for this step to complete
                    
                } catch (Exception e) {
                    log.error("Saga step failed: {}, initiating compensation", e.getMessage());
                    
                    // Execute compensation for all completed steps
                    executeCompensation(executedSteps);
                    
                    throw new SagaException("Saga execution failed at step: " + step.getStepName(), e);
                }
            }
            
            // All steps completed successfully
            return CompletableFuture.completedFuture(
                new SagaResult(true, "Saga completed successfully", executedSteps.size()));
            
        } catch (Exception e) {
            sample.stop(transactionTimer);
            rollbackCounter.increment();
            log.error("Saga execution failed: {}", e.getMessage(), e);
            return CompletableFuture.completedFuture(
                new SagaResult(false, "Saga failed: " + e.getMessage(), 0));
        } finally {
            sample.stop(transactionTimer);
        }
    }

    private CompletableFuture<SendResult<String, Object>> executeTransactionalSend(
            Object event, String topic, String key) {
        
        ProducerRecord<String, Object> record = new ProducerRecord<>(
            topic,
            null, // Partition will be determined by key
            Instant.now().toEpochMilli(),
            key,
            event,
            createTransactionalHeaders(event)
        );

        return transactionalKafkaTemplate.send(record);
    }

    private void executeCompensation(List<SagaStep> executedSteps) {
        log.info("Executing compensation for {} steps", executedSteps.size());
        
        // Execute compensation in reverse order
        Collections.reverse(executedSteps);
        
        for (SagaStep step : executedSteps) {
            try {
                if (step.getCompensationEvent() != null) {
                    log.debug("Executing compensation for step: {}", step.getStepName());
                    
                    Supplier<CompletableFuture<SendResult<String, Object>>> compensationOperation = 
                        dlqRetry.decorate(() -> 
                            executeTransactionalSend(step.getCompensationEvent(), 
                                                   step.getTopic(), 
                                                   step.getKey()));
                    
                    compensationOperation.get().join(); // Wait for compensation to complete
                }
            } catch (Exception e) {
                log.error("Compensation failed for step {}: {}", step.getStepName(), e.getMessage(), e);
                // Send to dead letter queue for manual intervention
                sendToDeadLetterQueue(step.getCompensationEvent(), e);
            }
        }
    }

    private void sendToDeadLetterQueue(Object event, Exception originalException) {
        try {
            log.warn("Sending event to dead letter queue due to compensation failure");
            
            ProducerRecord<String, Object> dlqRecord = new ProducerRecord<>(
                deadLetterTopic,
                extractKey(event),
                event,
                createDeadLetterHeaders(originalException)
            );
            
            // Use non-transactional template for DLQ to avoid transaction issues
            transactionalKafkaTemplate.send(dlqRecord);
            
        } catch (Exception e) {
            log.error("Failed to send to dead letter queue: {}", e.getMessage(), e);
        }
    }

    private List<RecordHeader> createTransactionalHeaders(Object event) {
        List<RecordHeader> headers = new ArrayList<>();
        headers.add(new RecordHeader("eventType", extractEventType(event).getBytes()));
        headers.add(new RecordHeader("transactional", "true".getBytes()));
        headers.add(new RecordHeader("transactionId", UUID.randomUUID().toString().getBytes()));
        headers.add(new RecordHeader("timestamp", String.valueOf(Instant.now().toEpochMilli()).getBytes()));
        headers.add(new RecordHeader("producer", "transactional-event-service".getBytes()));
        return headers;
    }

    private List<RecordHeader> createDeadLetterHeaders(Exception ex) {
        List<RecordHeader> headers = new ArrayList<>();
        headers.add(new RecordHeader("dlq.reason", "compensation_failure".getBytes()));
        headers.add(new RecordHeader("dlq.exception", ex.getClass().getSimpleName().getBytes()));
        headers.add(new RecordHeader("dlq.message", ex.getMessage().getBytes()));
        headers.add(new RecordHeader("dlq.timestamp", String.valueOf(Instant.now().toEpochMilli()).getBytes()));
        return headers;
    }

    private String extractKey(Object event) {
        if (event instanceof UserEvent) {
            return ((UserEvent) event).getUserId();
        } else if (event instanceof OrderEvent) {
            return ((OrderEvent) event).getOrderId();
        }
        return UUID.randomUUID().toString();
    }

    private String extractEventType(Object event) {
        if (event instanceof UserEvent) {
            return ((UserEvent) event).getEventType().toString();
        } else if (event instanceof OrderEvent) {
            return ((OrderEvent) event).getEventType().toString();
        }
        return event.getClass().getSimpleName();
    }

    // Helper classes
    public static class EventMessage {
        private final Object event;
        private final String topic;
        private final String key;

        public EventMessage(Object event, String topic, String key) {
            this.event = event;
            this.topic = topic;
            this.key = key;
        }

        public Object getEvent() { return event; }
        public String getTopic() { return topic; }
        public String getKey() { return key; }
    }

    public static class SagaStep {
        private final String stepName;
        private final Object event;
        private final String topic;
        private final String key;
        private final Object compensationEvent;

        public SagaStep(String stepName, Object event, String topic, String key, Object compensationEvent) {
            this.stepName = stepName;
            this.event = event;
            this.topic = topic;
            this.key = key;
            this.compensationEvent = compensationEvent;
        }

        public String getStepName() { return stepName; }
        public Object getEvent() { return event; }
        public String getTopic() { return topic; }
        public String getKey() { return key; }
        public Object getCompensationEvent() { return compensationEvent; }
    }

    public static class SagaResult {
        private final boolean success;
        private final String message;
        private final int completedSteps;

        public SagaResult(boolean success, String message, int completedSteps) {
            this.success = success;
            this.message = message;
            this.completedSteps = completedSteps;
        }

        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
        public int getCompletedSteps() { return completedSteps; }
    }

    public static class SagaException extends RuntimeException {
        public SagaException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}