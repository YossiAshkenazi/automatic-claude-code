package com.automaticclaudecode.kafka.tracing;

import com.automaticclaudecode.kafka.avro.UserEvent;
import com.automaticclaudecode.kafka.avro.OrderEvent;
import brave.Span;
import brave.Tracer;
import brave.Tracing;
import brave.kafka.clients.KafkaTracing;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.tracing.annotation.NewSpan;
import io.micrometer.tracing.annotation.SpanTag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Event producer with comprehensive distributed tracing
 * Implements custom spans, baggage propagation, and trace correlation
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TracingEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final KafkaTracing kafkaTracing;
    private final MeterRegistry meterRegistry;
    private final Tracer tracer;

    @Value("${kafka-poc.topics.user-events}")
    private String userEventsTopic;

    @Value("${kafka-poc.topics.order-events}")
    private String orderEventsTopic;

    private Counter tracedProducerCounter;
    private Timer spanDurationTimer;

    @PostConstruct
    public void initMetrics() {
        tracedProducerCounter = Counter.builder("kafka.producer.traced")
            .description("Number of traced producer operations")
            .register(meterRegistry);
        
        spanDurationTimer = Timer.builder("kafka.producer.span.duration")
            .description("Duration of producer spans")
            .register(meterRegistry);
    }

    /**
     * Send user event with custom tracing spans and context propagation
     */
    @NewSpan("kafka-producer-user-event")
    public CompletableFuture<SendResult<String, Object>> sendUserEventWithTracing(
            @SpanTag("user.id") String userId,
            @SpanTag("event.type") String eventType,
            UserEvent userEvent) {

        Span span = tracer.nextSpan()
                .name("send-user-event")
                .tag("kafka.topic", userEventsTopic)
                .tag("event.id", userEvent.getEventId())
                .tag("user.id", userEvent.getUserId())
                .tag("event.type", userEvent.getEventType().toString())
                .tag("component", "kafka-producer")
                .start();

        Timer.Sample sample = Timer.start(meterRegistry);

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            
            // Add correlation context to span
            span.tag("correlation.id", extractCorrelationId(userEvent));
            span.tag("session.id", userEvent.getSessionId());
            span.tag("source", userEvent.getMetadata().getSource());

            // Create producer record with tracing headers
            ProducerRecord<String, Object> record = new ProducerRecord<>(
                userEventsTopic,
                null,
                Instant.now().toEpochMilli(),
                userEvent.getUserId(),
                userEvent,
                createTracingHeaders(span, userEvent)
            );

            // Inject tracing context into Kafka headers
            kafkaTracing.producer().injector().accept(record.headers(), span.context());

            log.debug("Sending traced user event: traceId={}, spanId={}, eventId={}", 
                     span.context().traceIdString(),
                     span.context().spanIdString(), 
                     userEvent.getEventId());

            CompletableFuture<SendResult<String, Object>> future = kafkaTemplate.send(record);
            
            future.whenComplete((result, throwable) -> {
                sample.stop(spanDurationTimer);
                tracedProducerCounter.increment();
                
                if (throwable == null) {
                    span.tag("kafka.partition", String.valueOf(result.getRecordMetadata().partition()))
                        .tag("kafka.offset", String.valueOf(result.getRecordMetadata().offset()))
                        .tag("success", "true");
                    
                    log.info("Traced user event sent: traceId={}, partition={}, offset={}", 
                            span.context().traceIdString(),
                            result.getRecordMetadata().partition(),
                            result.getRecordMetadata().offset());
                } else {
                    span.tag("error", throwable.getMessage())
                        .tag("success", "false");
                    
                    log.error("Traced user event failed: traceId={}, error={}", 
                             span.context().traceIdString(), throwable.getMessage(), throwable);
                }
                
                span.end();
            });

            return future;

        } catch (Exception e) {
            sample.stop(spanDurationTimer);
            span.tag("error", e.getMessage()).tag("success", "false");
            span.end();
            throw e;
        }
    }

    /**
     * Send order event with distributed tracing
     */
    @NewSpan("kafka-producer-order-event")
    public CompletableFuture<SendResult<String, Object>> sendOrderEventWithTracing(
            @SpanTag("order.id") String orderId,
            @SpanTag("customer.id") String customerId,
            @SpanTag("event.type") String eventType,
            OrderEvent orderEvent) {

        Span span = tracer.nextSpan()
                .name("send-order-event")
                .tag("kafka.topic", orderEventsTopic)
                .tag("event.id", orderEvent.getEventId())
                .tag("order.id", orderEvent.getOrderId())
                .tag("customer.id", orderEvent.getCustomerId())
                .tag("event.type", orderEvent.getEventType().toString())
                .tag("component", "kafka-producer")
                .start();

        Timer.Sample sample = Timer.start(meterRegistry);

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(span)) {
            
            // Add business context to span
            span.tag("correlation.id", orderEvent.getMetadata().getCorrelationId())
                .tag("order.status", orderEvent.getOrderDetails().getStatus().toString())
                .tag("order.amount", orderEvent.getOrderDetails().getTotalAmount().toString())
                .tag("order.currency", orderEvent.getOrderDetails().getCurrency())
                .tag("order.items.count", String.valueOf(orderEvent.getOrderDetails().getItems().size()));

            ProducerRecord<String, Object> record = new ProducerRecord<>(
                orderEventsTopic,
                null,
                Instant.now().toEpochMilli(),
                orderEvent.getOrderId(),
                orderEvent,
                createTracingHeaders(span, orderEvent)
            );

            // Inject tracing context
            kafkaTracing.producer().injector().accept(record.headers(), span.context());

            log.debug("Sending traced order event: traceId={}, spanId={}, eventId={}", 
                     span.context().traceIdString(),
                     span.context().spanIdString(), 
                     orderEvent.getEventId());

            CompletableFuture<SendResult<String, Object>> future = kafkaTemplate.send(record);
            
            future.whenComplete((result, throwable) -> {
                sample.stop(spanDurationTimer);
                tracedProducerCounter.increment();
                
                if (throwable == null) {
                    span.tag("kafka.partition", String.valueOf(result.getRecordMetadata().partition()))
                        .tag("kafka.offset", String.valueOf(result.getRecordMetadata().offset()))
                        .tag("success", "true");
                    
                    log.info("Traced order event sent: traceId={}, partition={}, offset={}", 
                            span.context().traceIdString(),
                            result.getRecordMetadata().partition(),
                            result.getRecordMetadata().offset());
                } else {
                    span.tag("error", throwable.getMessage())
                        .tag("success", "false");
                    
                    log.error("Traced order event failed: traceId={}, error={}", 
                             span.context().traceIdString(), throwable.getMessage(), throwable);
                }
                
                span.end();
            });

            return future;

        } catch (Exception e) {
            sample.stop(spanDurationTimer);
            span.tag("error", e.getMessage()).tag("success", "false");
            span.end();
            throw e;
        }
    }

    /**
     * Send batch of events with distributed tracing
     */
    @NewSpan("kafka-producer-batch")
    public List<CompletableFuture<SendResult<String, Object>>> sendBatchWithTracing(
            @SpanTag("batch.size") int batchSize,
            @SpanTag("batch.id") String batchId,
            List<Object> events, 
            String topic) {

        Span batchSpan = tracer.nextSpan()
                .name("send-event-batch")
                .tag("kafka.topic", topic)
                .tag("batch.size", String.valueOf(batchSize))
                .tag("batch.id", batchId)
                .tag("component", "kafka-producer")
                .start();

        Timer.Sample sample = Timer.start(meterRegistry);

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(batchSpan)) {
            
            List<CompletableFuture<SendResult<String, Object>>> futures = new ArrayList<>();
            
            for (int i = 0; i < events.size(); i++) {
                Object event = events.get(i);
                
                // Create child span for each event
                Span eventSpan = tracer.nextSpan()
                        .name("send-batch-event")
                        .tag("batch.id", batchId)
                        .tag("batch.index", String.valueOf(i))
                        .tag("event.type", extractEventType(event))
                        .start();

                try (Tracer.SpanInScope eventWs = tracer.withSpanInScope(eventSpan)) {
                    
                    String key = extractKey(event);
                    ProducerRecord<String, Object> record = new ProducerRecord<>(
                        topic,
                        key,
                        event,
                        createTracingHeaders(eventSpan, event)
                    );

                    // Inject tracing context for each event
                    kafkaTracing.producer().injector().accept(record.headers(), eventSpan.context());

                    CompletableFuture<SendResult<String, Object>> future = kafkaTemplate.send(record);
                    
                    // Complete event span when send completes
                    future.whenComplete((result, throwable) -> {
                        if (throwable == null) {
                            eventSpan.tag("success", "true");
                        } else {
                            eventSpan.tag("error", throwable.getMessage()).tag("success", "false");
                        }
                        eventSpan.end();
                    });
                    
                    futures.add(future);
                    
                } catch (Exception e) {
                    eventSpan.tag("error", e.getMessage()).tag("success", "false");
                    eventSpan.end();
                    throw e;
                }
            }
            
            // Complete batch span when all sends complete
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                .whenComplete((result, throwable) -> {
                    sample.stop(spanDurationTimer);
                    if (throwable == null) {
                        batchSpan.tag("success", "true");
                        log.info("Traced batch completed: traceId={}, batchId={}, size={}", 
                                batchSpan.context().traceIdString(), batchId, batchSize);
                    } else {
                        batchSpan.tag("error", throwable.getMessage()).tag("success", "false");
                        log.error("Traced batch failed: traceId={}, batchId={}, error={}", 
                                 batchSpan.context().traceIdString(), batchId, throwable.getMessage());
                    }
                    batchSpan.end();
                });
            
            return futures;

        } catch (Exception e) {
            sample.stop(spanDurationTimer);
            batchSpan.tag("error", e.getMessage()).tag("success", "false");
            batchSpan.end();
            throw e;
        }
    }

    /**
     * Create custom business operation span
     */
    @NewSpan("business-operation")
    public CompletableFuture<Void> executeTracedBusinessOperation(
            @SpanTag("operation.name") String operationName,
            @SpanTag("operation.id") String operationId,
            List<Object> events) {

        Span operationSpan = tracer.nextSpan()
                .name("execute-business-operation")
                .tag("operation.name", operationName)
                .tag("operation.id", operationId)
                .tag("events.count", String.valueOf(events.size()))
                .tag("component", "business-logic")
                .start();

        try (Tracer.SpanInScope ws = tracer.withSpanInScope(operationSpan)) {
            
            log.info("Starting traced business operation: traceId={}, operation={}", 
                    operationSpan.context().traceIdString(), operationName);

            // Example: Process user and related orders together
            List<CompletableFuture<SendResult<String, Object>>> allFutures = new ArrayList<>();
            
            for (Object event : events) {
                if (event instanceof UserEvent) {
                    UserEvent userEvent = (UserEvent) event;
                    allFutures.add(sendUserEventWithTracing(
                        userEvent.getUserId(), 
                        userEvent.getEventType().toString(), 
                        userEvent));
                } else if (event instanceof OrderEvent) {
                    OrderEvent orderEvent = (OrderEvent) event;
                    allFutures.add(sendOrderEventWithTracing(
                        orderEvent.getOrderId(),
                        orderEvent.getCustomerId(),
                        orderEvent.getEventType().toString(),
                        orderEvent));
                }
            }

            return CompletableFuture.allOf(allFutures.toArray(new CompletableFuture[0]))
                .whenComplete((result, throwable) -> {
                    if (throwable == null) {
                        operationSpan.tag("success", "true");
                        log.info("Business operation completed: traceId={}, operation={}", 
                                operationSpan.context().traceIdString(), operationName);
                    } else {
                        operationSpan.tag("error", throwable.getMessage()).tag("success", "false");
                        log.error("Business operation failed: traceId={}, operation={}, error={}", 
                                 operationSpan.context().traceIdString(), operationName, throwable.getMessage());
                    }
                    operationSpan.end();
                });

        } catch (Exception e) {
            operationSpan.tag("error", e.getMessage()).tag("success", "false");
            operationSpan.end();
            throw e;
        }
    }

    private List<Header> createTracingHeaders(Span span, Object event) {
        List<Header> headers = new ArrayList<>();
        
        // Standard headers
        headers.add(new RecordHeader("eventType", extractEventType(event).getBytes()));
        headers.add(new RecordHeader("timestamp", String.valueOf(Instant.now().toEpochMilli()).getBytes()));
        headers.add(new RecordHeader("producer", "tracing-event-producer".getBytes()));
        
        // Tracing headers
        headers.add(new RecordHeader("trace.id", span.context().traceIdString().getBytes()));
        headers.add(new RecordHeader("span.id", span.context().spanIdString().getBytes()));
        headers.add(new RecordHeader("trace.sampled", "1".getBytes()));
        
        // Business context headers
        if (event instanceof UserEvent) {
            UserEvent userEvent = (UserEvent) event;
            headers.add(new RecordHeader("business.user.id", userEvent.getUserId().getBytes()));
            headers.add(new RecordHeader("business.session.id", 
                userEvent.getSessionId() != null ? userEvent.getSessionId().getBytes() : "".getBytes()));
        } else if (event instanceof OrderEvent) {
            OrderEvent orderEvent = (OrderEvent) event;
            headers.add(new RecordHeader("business.order.id", orderEvent.getOrderId().getBytes()));
            headers.add(new RecordHeader("business.customer.id", orderEvent.getCustomerId().getBytes()));
        }
        
        return headers;
    }

    private String extractCorrelationId(UserEvent userEvent) {
        return userEvent.getMetadata() != null ? 
               userEvent.getMetadata().getCorrelationId() : 
               UUID.randomUUID().toString();
    }

    private String extractEventType(Object event) {
        if (event instanceof UserEvent) {
            return ((UserEvent) event).getEventType().toString();
        } else if (event instanceof OrderEvent) {
            return ((OrderEvent) event).getEventType().toString();
        }
        return event.getClass().getSimpleName();
    }

    private String extractKey(Object event) {
        if (event instanceof UserEvent) {
            return ((UserEvent) event).getUserId();
        } else if (event instanceof OrderEvent) {
            return ((OrderEvent) event).getOrderId();
        }
        return UUID.randomUUID().toString();
    }
}