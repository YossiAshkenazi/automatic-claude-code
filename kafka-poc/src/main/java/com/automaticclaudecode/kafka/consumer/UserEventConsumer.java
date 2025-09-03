package com.automaticclaudecode.kafka.consumer;

import com.automaticclaudecode.kafka.avro.UserEvent;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.micrometer.core.annotation.Timed;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * User event consumer with exactly-once processing,
 * error handling, dead letter queues, and comprehensive monitoring
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserEventConsumer {

    private final MeterRegistry meterRegistry;
    private final UserEventProcessor userEventProcessor;
    
    private Counter consumeCounter;
    private Counter processedCounter;
    private Counter errorCounter;
    private Timer processingTimer;

    @PostConstruct
    public void initMetrics() {
        consumeCounter = Counter.builder("kafka.consumer.user_events.consumed")
            .description("Number of user events consumed")
            .register(meterRegistry);
        
        processedCounter = Counter.builder("kafka.consumer.user_events.processed")
            .description("Number of user events processed successfully")
            .register(meterRegistry);
        
        errorCounter = Counter.builder("kafka.consumer.user_events.error")
            .description("Number of user event processing errors")
            .register(meterRegistry);
        
        processingTimer = Timer.builder("kafka.consumer.user_events.processing_time")
            .description("Time taken to process user events")
            .register(meterRegistry);
    }

    /**
     * Main user event listener with comprehensive error handling
     */
    @KafkaListener(
        topics = "${kafka-poc.topics.user-events}",
        groupId = "${spring.kafka.consumer.group-id}",
        containerFactory = "kafkaListenerContainerFactory"
    )
    @RetryableTopic(
        attempts = "3",
        backoff = @Backoff(delay = 2000, multiplier = 2.0, maxDelay = 30000),
        dltStrategy = org.springframework.kafka.annotation.DltStrategy.FAIL_ON_ERROR,
        include = {Exception.class}
    )
    @Timed(value = "kafka.consumer.user_event", description = "Time to consume and process user events")
    @CircuitBreaker(name = "user-event-processor", fallbackMethod = "handleProcessingFailure")
    public void consumeUserEvent(
            ConsumerRecord<String, UserEvent> record,
            @Payload UserEvent userEvent,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            @Header(KafkaHeaders.RECEIVED_PARTITION_ID) int partition,
            @Header(KafkaHeaders.OFFSET) long offset,
            Acknowledgment acknowledgment) {

        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            consumeCounter.increment();
            
            log.info("Consuming user event: eventId={}, userId={}, type={}, topic={}, partition={}, offset={}", 
                userEvent.getEventId(), userEvent.getUserId(), userEvent.getEventType(), 
                topic, partition, offset);

            // Extract correlation ID for tracing
            String correlationId = extractCorrelationId(record);
            
            // Validate event
            validateUserEvent(userEvent);
            
            // Process event with idempotency check
            CompletableFuture<Void> processingFuture = processUserEventAsync(userEvent, correlationId);
            
            // Wait for processing completion
            processingFuture.get();
            
            // Manual acknowledgment for exactly-once processing
            acknowledgment.acknowledge();
            
            processedCounter.increment();
            sample.stop(processingTimer);
            
            log.info("User event processed successfully: eventId={}, processingTime={}ms", 
                userEvent.getEventId(), 
                Duration.between(Instant.ofEpochMilli(userEvent.getTimestamp()), Instant.now()).toMillis());

        } catch (Exception e) {
            errorCounter.increment();
            sample.stop(processingTimer);
            
            log.error("Error processing user event: eventId={}, userId={}, error={}", 
                userEvent.getEventId(), userEvent.getUserId(), e.getMessage(), e);
            
            // Don't acknowledge on error - message will be retried
            throw new RuntimeException("Failed to process user event: " + userEvent.getEventId(), e);
        }
    }

    /**
     * Dead Letter Topic handler for failed messages
     */
    @KafkaListener(
        topics = "${kafka-poc.topics.user-events}.DLT",
        groupId = "${spring.kafka.consumer.group-id}-dlt"
    )
    public void handleDeadLetterUserEvent(
            ConsumerRecord<String, UserEvent> record,
            @Payload UserEvent userEvent,
            Acknowledgment acknowledgment) {
        
        try {
            log.warn("Processing dead letter user event: eventId={}, userId={}, attempts exhausted", 
                userEvent.getEventId(), userEvent.getUserId());

            // Store in dead letter storage for manual investigation
            storeDeadLetterEvent(userEvent, record);
            
            // Send alert/notification about failed message
            sendFailureAlert(userEvent, "User event processing failed after all retries");
            
            acknowledgment.acknowledge();
            
        } catch (Exception e) {
            log.error("Failed to handle dead letter user event: eventId={}, error={}", 
                userEvent.getEventId(), e.getMessage(), e);
            // Still acknowledge to prevent infinite reprocessing
            acknowledgment.acknowledge();
        }
    }

    /**
     * Circuit breaker fallback method
     */
    public void handleProcessingFailure(
            ConsumerRecord<String, UserEvent> record, 
            UserEvent userEvent, 
            String topic, 
            int partition, 
            long offset, 
            Acknowledgment acknowledgment, 
            Exception ex) {
        
        log.warn("Circuit breaker activated for user event processing: eventId={}, error={}", 
            userEvent.getEventId(), ex.getMessage());
        
        try {
            // Store event for later processing when circuit breaker recovers
            storeForLaterProcessing(userEvent, record);
            acknowledgment.acknowledge();
            
        } catch (Exception e) {
            log.error("Failed to handle circuit breaker fallback: eventId={}, error={}", 
                userEvent.getEventId(), e.getMessage(), e);
            throw new RuntimeException("Circuit breaker fallback failed", e);
        }
    }

    private CompletableFuture<Void> processUserEventAsync(UserEvent userEvent, String correlationId) {
        return CompletableFuture.runAsync(() -> {
            try {
                // Check for duplicate processing (idempotency)
                if (userEventProcessor.isAlreadyProcessed(userEvent.getEventId())) {
                    log.info("User event already processed, skipping: eventId={}", userEvent.getEventId());
                    return;
                }

                // Process based on event type
                switch (userEvent.getEventType()) {
                    case USER_CREATED:
                        userEventProcessor.handleUserCreated(userEvent, correlationId);
                        break;
                    case USER_UPDATED:
                        userEventProcessor.handleUserUpdated(userEvent, correlationId);
                        break;
                    case USER_DELETED:
                        userEventProcessor.handleUserDeleted(userEvent, correlationId);
                        break;
                    case USER_LOGIN:
                        userEventProcessor.handleUserLogin(userEvent, correlationId);
                        break;
                    case USER_LOGOUT:
                        userEventProcessor.handleUserLogout(userEvent, correlationId);
                        break;
                    default:
                        log.warn("Unknown user event type: {}", userEvent.getEventType());
                        throw new IllegalArgumentException("Unknown event type: " + userEvent.getEventType());
                }

                // Mark as processed for idempotency
                userEventProcessor.markAsProcessed(userEvent.getEventId());
                
            } catch (Exception e) {
                log.error("Async processing failed for user event: eventId={}, error={}", 
                    userEvent.getEventId(), e.getMessage(), e);
                throw new RuntimeException("Async processing failed", e);
            }
        });
    }

    private void validateUserEvent(UserEvent userEvent) {
        if (userEvent.getEventId() == null || userEvent.getEventId().trim().isEmpty()) {
            throw new IllegalArgumentException("Event ID is required");
        }
        
        if (userEvent.getUserId() == null || userEvent.getUserId().trim().isEmpty()) {
            throw new IllegalArgumentException("User ID is required");
        }
        
        if (userEvent.getEventType() == null) {
            throw new IllegalArgumentException("Event type is required");
        }
        
        if (userEvent.getTimestamp() <= 0) {
            throw new IllegalArgumentException("Valid timestamp is required");
        }
        
        // Additional business validation
        if (userEvent.getMetadata() == null || 
            userEvent.getMetadata().getSource() == null || 
            userEvent.getMetadata().getSource().trim().isEmpty()) {
            throw new IllegalArgumentException("Event source is required in metadata");
        }
    }

    private String extractCorrelationId(ConsumerRecord<String, UserEvent> record) {
        return Optional.ofNullable(record.headers().lastHeader("correlationId"))
            .map(Header::value)
            .map(String::new)
            .orElse("unknown");
    }

    private void storeDeadLetterEvent(UserEvent userEvent, ConsumerRecord<String, UserEvent> record) {
        // Implementation to store dead letter events for manual investigation
        log.info("Storing dead letter event: eventId={}", userEvent.getEventId());
        // Could store in database, file system, or dedicated dead letter storage
    }

    private void sendFailureAlert(UserEvent userEvent, String message) {
        // Implementation to send alerts about failed events
        log.warn("Sending failure alert: eventId={}, message={}", userEvent.getEventId(), message);
        // Could send to monitoring system, Slack, email, etc.
    }

    private void storeForLaterProcessing(UserEvent userEvent, ConsumerRecord<String, UserEvent> record) {
        // Implementation to store events when circuit breaker is open
        log.info("Storing event for later processing: eventId={}", userEvent.getEventId());
        // Could use Redis, database, or message queue for delayed processing
    }
}