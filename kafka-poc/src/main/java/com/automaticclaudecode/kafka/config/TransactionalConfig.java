package com.automaticclaudecode.kafka.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.transaction.KafkaTransactionManager;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Configuration for exactly-once processing and resilience patterns
 * Implements transactional producers, circuit breakers, and retry mechanisms
 */
@Configuration
@RequiredArgsConstructor
public class TransactionalConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${spring.kafka.producer.properties.schema.registry.url}")
    private String schemaRegistryUrl;

    /**
     * Transactional producer factory for exactly-once semantics
     */
    @Bean
    public ProducerFactory<String, Object> transactionalProducerFactory() {
        Map<String, Object> configProps = new HashMap<>();
        
        // Basic configuration
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, 
                       org.apache.kafka.common.serialization.StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, 
                       io.confluent.kafka.serializers.KafkaAvroSerializer.class);
        
        // Exactly-once configuration
        configProps.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        configProps.put(ProducerConfig.ACKS_CONFIG, "all");
        configProps.put(ProducerConfig.RETRIES_CONFIG, Integer.MAX_VALUE);
        configProps.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        
        // Transactional settings
        configProps.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "kafka-poc-transactional-producer");
        configProps.put(ProducerConfig.TRANSACTION_TIMEOUT_CONFIG, 60000); // 1 minute
        
        // Performance settings
        configProps.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "lz4");
        configProps.put(ProducerConfig.BATCH_SIZE_CONFIG, 32768);
        configProps.put(ProducerConfig.LINGER_MS_CONFIG, 5);
        configProps.put(ProducerConfig.BUFFER_MEMORY_CONFIG, 134217728);
        
        // Schema Registry
        configProps.put("schema.registry.url", schemaRegistryUrl);
        configProps.put("auto.register.schemas", true);
        configProps.put("use.latest.version", true);
        
        return new DefaultKafkaProducerFactory<>(configProps);
    }

    /**
     * Transactional Kafka template
     */
    @Bean
    public KafkaTemplate<String, Object> transactionalKafkaTemplate() {
        return new KafkaTemplate<>(transactionalProducerFactory());
    }

    /**
     * Kafka transaction manager for exactly-once processing
     */
    @Bean
    public KafkaTransactionManager kafkaTransactionManager() {
        return new KafkaTransactionManager(transactionalProducerFactory());
    }

    /**
     * Circuit breaker for Kafka producer
     */
    @Bean("kafka-producer-circuit-breaker")
    public CircuitBreaker kafkaProducerCircuitBreaker() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .failureRateThreshold(50) // 50% failure rate threshold
                .slowCallRateThreshold(50) // 50% slow call rate threshold
                .slowCallDurationThreshold(Duration.ofMillis(2000)) // 2 seconds
                .permittedNumberOfCallsInHalfOpenState(5)
                .slidingWindowSize(10)
                .minimumNumberOfCalls(10)
                .waitDurationInOpenState(Duration.ofSeconds(30))
                .build();

        return CircuitBreaker.of("kafka-producer", config);
    }

    /**
     * Circuit breaker for user event processor
     */
    @Bean("user-event-processor-circuit-breaker")
    public CircuitBreaker userEventProcessorCircuitBreaker() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .failureRateThreshold(60) // Higher threshold for consumer
                .slowCallRateThreshold(60)
                .slowCallDurationThreshold(Duration.ofMillis(5000)) // 5 seconds
                .permittedNumberOfCallsInHalfOpenState(3)
                .slidingWindowSize(10)
                .minimumNumberOfCalls(5)
                .waitDurationInOpenState(Duration.ofSeconds(45))
                .build();

        return CircuitBreaker.of("user-event-processor", config);
    }

    /**
     * Retry configuration for Kafka operations
     */
    @Bean("kafka-retry")
    public Retry kafkaRetry() {
        RetryConfig config = RetryConfig.custom()
                .maxAttempts(3)
                .waitDuration(Duration.ofMillis(1000))
                .exponentialBackoffMultiplier(2.0)
                .retryOnException(throwable -> {
                    // Retry on transient exceptions
                    return throwable instanceof org.apache.kafka.common.errors.RetriableException ||
                           throwable instanceof org.springframework.kafka.KafkaException ||
                           throwable instanceof java.util.concurrent.TimeoutException;
                })
                .ignoreExceptions(
                    // Don't retry on these exceptions
                    IllegalArgumentException.class,
                    org.apache.kafka.common.errors.SerializationException.class,
                    org.apache.kafka.common.errors.InvalidTopicException.class
                )
                .build();

        return Retry.of("kafka-operations", config);
    }

    /**
     * Retry configuration specifically for dead letter queue operations
     */
    @Bean("dlq-retry")
    public Retry dlqRetry() {
        RetryConfig config = RetryConfig.custom()
                .maxAttempts(5) // More attempts for DLQ
                .waitDuration(Duration.ofMillis(2000))
                .exponentialBackoffMultiplier(1.5)
                .retryOnException(throwable -> {
                    // Retry on most exceptions for DLQ operations
                    return !(throwable instanceof IllegalArgumentException);
                })
                .build();

        return Retry.of("dlq-operations", config);
    }
}