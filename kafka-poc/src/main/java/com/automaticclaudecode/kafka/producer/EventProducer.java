package com.automaticclaudecode.kafka.producer;

import com.automaticclaudecode.kafka.avro.UserEvent;
import com.automaticclaudecode.kafka.avro.OrderEvent;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.micrometer.core.annotation.Timed;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Production-ready Kafka event producer with error handling,
 * circuit breaker patterns, monitoring, and distributed tracing
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final MeterRegistry meterRegistry;

    @Value("${kafka-poc.topics.user-events}")
    private String userEventsTopic;

    @Value("${kafka-poc.topics.order-events}")
    private String orderEventsTopic;

    @Value("${kafka-poc.topics.dead-letter}")
    private String deadLetterTopic;

    private Counter successCounter;
    private Counter errorCounter;
    private Counter retryCounter;

    @PostConstruct
    public void initMetrics() {
        successCounter = Counter.builder("kafka.producer.success")
            .description("Number of successful message sends")
            .register(meterRegistry);
        
        errorCounter = Counter.builder("kafka.producer.error")
            .description("Number of failed message sends")
            .register(meterRegistry);
        
        retryCounter = Counter.builder("kafka.producer.retry")
            .description("Number of message send retries")
            .register(meterRegistry);
    }

    /**
     * Send user event with comprehensive error handling
     */
    @Timed(value = "kafka.producer.user_event", description = "Time taken to send user events")
    @CircuitBreaker(name = "kafka-producer", fallbackMethod = "sendToDeadLetter")
    @Retryable(
        value = {Exception.class},
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000, multiplier = 2, maxDelay = 10000)
    )
    public CompletableFuture<SendResult<String, Object>> sendUserEvent(UserEvent userEvent) {
        try {
            String key = userEvent.getUserId();
            
            // Create producer record with headers
            ProducerRecord<String, Object> record = new ProducerRecord<>(
                userEventsTopic, 
                null, // partition will be determined by key
                Instant.now().toEpochMilli(),
                key,
                userEvent,
                createHeaders(userEvent.getEventType().toString(), "UserEvent")
            );

            log.debug("Sending user event: eventId={}, userId={}, type={}", 
                userEvent.getEventId(), userEvent.getUserId(), userEvent.getEventType());

            CompletableFuture<SendResult<String, Object>> future = kafkaTemplate.send(record);
            
            // Add success callback
            future.whenComplete((result, throwable) -> {
                if (throwable == null) {
                    successCounter.increment();
                    log.info("User event sent successfully: eventId={}, partition={}, offset={}", 
                        userEvent.getEventId(), 
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
                } else {
                    errorCounter.increment();
                    log.error("Failed to send user event: eventId={}, error={}", 
                        userEvent.getEventId(), throwable.getMessage(), throwable);
                }
            });

            return future;

        } catch (Exception e) {
            retryCounter.increment();
            log.error("Exception sending user event: eventId={}, error={}", 
                userEvent.getEventId(), e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Send order event with exactly-once semantics
     */
    @Timed(value = "kafka.producer.order_event", description = "Time taken to send order events")
    @CircuitBreaker(name = "kafka-producer", fallbackMethod = "sendToDeadLetter")
    @Retryable(
        value = {Exception.class},
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000, multiplier = 2, maxDelay = 10000)
    )
    public CompletableFuture<SendResult<String, Object>> sendOrderEvent(OrderEvent orderEvent) {
        try {
            String key = orderEvent.getOrderId();
            
            ProducerRecord<String, Object> record = new ProducerRecord<>(
                orderEventsTopic,
                null,
                Instant.now().toEpochMilli(),
                key,
                orderEvent,
                createHeaders(orderEvent.getEventType().toString(), "OrderEvent")
            );

            log.debug("Sending order event: eventId={}, orderId={}, type={}", 
                orderEvent.getEventId(), orderEvent.getOrderId(), orderEvent.getEventType());

            CompletableFuture<SendResult<String, Object>> future = kafkaTemplate.send(record);
            
            future.whenComplete((result, throwable) -> {
                if (throwable == null) {
                    successCounter.increment();
                    log.info("Order event sent successfully: eventId={}, partition={}, offset={}", 
                        orderEvent.getEventId(), 
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
                } else {
                    errorCounter.increment();
                    log.error("Failed to send order event: eventId={}, error={}", 
                        orderEvent.getEventId(), throwable.getMessage(), throwable);
                }
            });

            return future;

        } catch (Exception e) {
            retryCounter.increment();
            log.error("Exception sending order event: eventId={}, error={}", 
                orderEvent.getEventId(), e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Batch send multiple events for high throughput
     */
    @Timed(value = "kafka.producer.batch", description = "Time taken to send batch events")
    public List<CompletableFuture<SendResult<String, Object>>> sendBatch(List<Object> events, String topic) {
        List<CompletableFuture<SendResult<String, Object>>> futures = new ArrayList<>();
        
        for (Object event : events) {
            try {
                String key = extractKey(event);
                ProducerRecord<String, Object> record = new ProducerRecord<>(
                    topic,
                    key,
                    event,
                    createHeaders(extractEventType(event), event.getClass().getSimpleName())
                );
                
                futures.add(kafkaTemplate.send(record));
                
            } catch (Exception e) {
                log.error("Failed to send event in batch: {}", e.getMessage(), e);
                CompletableFuture<SendResult<String, Object>> failedFuture = new CompletableFuture<>();
                failedFuture.completeExceptionally(e);
                futures.add(failedFuture);
            }
        }
        
        return futures;
    }

    /**
     * Circuit breaker fallback method
     */
    public CompletableFuture<SendResult<String, Object>> sendToDeadLetter(Object event, Exception ex) {
        log.warn("Circuit breaker opened, sending to dead letter queue: {}", ex.getMessage());
        
        try {
            String key = extractKey(event);
            ProducerRecord<String, Object> dlqRecord = new ProducerRecord<>(
                deadLetterTopic,
                key,
                event,
                createDeadLetterHeaders(ex)
            );
            
            return kafkaTemplate.send(dlqRecord);
            
        } catch (Exception dlqException) {
            log.error("Failed to send to dead letter queue: {}", dlqException.getMessage(), dlqException);
            CompletableFuture<SendResult<String, Object>> future = new CompletableFuture<>();
            future.completeExceptionally(dlqException);
            return future;
        }
    }

    private List<Header> createHeaders(String eventType, String schemaType) {
        List<Header> headers = new ArrayList<>();
        headers.add(new RecordHeader("eventType", eventType.getBytes()));
        headers.add(new RecordHeader("schemaType", schemaType.getBytes()));
        headers.add(new RecordHeader("correlationId", UUID.randomUUID().toString().getBytes()));
        headers.add(new RecordHeader("timestamp", String.valueOf(Instant.now().toEpochMilli()).getBytes()));
        headers.add(new RecordHeader("producer", "kafka-poc-producer".getBytes()));
        headers.add(new RecordHeader("version", "1.0".getBytes()));
        return headers;
    }

    private List<Header> createDeadLetterHeaders(Exception ex) {
        List<Header> headers = new ArrayList<>();
        headers.add(new RecordHeader("dlq.reason", "circuit_breaker_fallback".getBytes()));
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
        return "UNKNOWN";
    }
}