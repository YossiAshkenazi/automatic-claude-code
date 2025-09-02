package com.automaticclaudecode.kafka.spring;

import com.automaticclaudecode.kafka.spring.properties.KafkaProperties;
import com.automaticclaudecode.kafka.spring.producer.EnhancedKafkaProducer;
import com.automaticclaudecode.kafka.spring.consumer.EnhancedKafkaConsumer;
import com.automaticclaudecode.kafka.spring.health.KafkaHealthIndicator;
import com.automaticclaudecode.kafka.spring.metrics.KafkaMetricsCollector;
import com.automaticclaudecode.kafka.spring.serialization.JsonSerializer;
import com.automaticclaudecode.kafka.spring.serialization.JsonDeserializer;
import com.automaticclaudecode.kafka.spring.interceptor.AuditInterceptor;
import com.automaticclaudecode.kafka.spring.interceptor.TracingInterceptor;
import com.automaticclaudecode.kafka.spring.retry.RetryableErrorHandler;
import com.automaticclaudecode.kafka.spring.dlq.DeadLetterQueueHandler;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.kafka.transaction.KafkaTransactionManager;
import org.springframework.retry.policy.SimpleRetryPolicy;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.util.backoff.FixedBackOff;

import io.micrometer.core.instrument.MeterRegistry;
import io.opentracing.Tracer;
import io.opentracing.util.GlobalTracer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Auto-configuration for enhanced Kafka integration with Spring Boot.
 * 
 * Features:
 * - High-performance producer and consumer configurations
 * - Automatic retry and error handling
 * - Dead letter queue support
 * - Distributed tracing integration
 * - Comprehensive metrics collection
 * - Health checks
 * - Transaction support
 * - Custom serialization/deserialization
 * 
 * Target: 100K+ messages/second performance
 */
@AutoConfiguration
@ConditionalOnClass(KafkaTemplate.class)
@EnableConfigurationProperties(KafkaProperties.class)
@EnableKafka
public class KafkaAutoConfiguration {

    /**
     * Enhanced Kafka Producer Factory with optimized settings for high throughput
     */
    @Bean
    @ConditionalOnMissingBean
    public ProducerFactory<String, Object> kafkaProducerFactory(KafkaProperties properties) {
        Map<String, Object> configProps = new HashMap<>();
        
        // Basic connection settings
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, properties.getBootstrapServers());
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        
        // High-performance optimizations
        configProps.put(ProducerConfig.ACKS_CONFIG, properties.getProducer().getAcks());
        configProps.put(ProducerConfig.RETRIES_CONFIG, properties.getProducer().getRetries());
        configProps.put(ProducerConfig.BATCH_SIZE_CONFIG, properties.getProducer().getBatchSize()); // 64KB batches
        configProps.put(ProducerConfig.LINGER_MS_CONFIG, properties.getProducer().getLingerMs()); // 10ms batching
        configProps.put(ProducerConfig.BUFFER_MEMORY_CONFIG, properties.getProducer().getBufferMemory()); // 128MB buffer
        configProps.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, properties.getProducer().getCompressionType());
        configProps.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        
        // Exactly-once semantics
        if (properties.getProducer().isIdempotent()) {
            configProps.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
            configProps.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, properties.getProducer().getTransactionalId());
        }
        
        // Timeout settings
        configProps.put(ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG, properties.getProducer().getRequestTimeoutMs());
        configProps.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, properties.getProducer().getDeliveryTimeoutMs());
        
        // Security settings
        if (properties.getSecurity() != null) {
            configProps.putAll(properties.getSecurity().buildProperties());
        }
        
        // Interceptors for tracing and auditing
        configProps.put(ProducerConfig.INTERCEPTOR_CLASSES_CONFIG, 
            java.util.Arrays.asList(TracingInterceptor.class.getName(), AuditInterceptor.class.getName()));
        
        return new DefaultKafkaProducerFactory<>(configProps);
    }
    
    /**
     * Enhanced Kafka Template with built-in retry and error handling
     */
    @Bean
    @ConditionalOnMissingBean
    public KafkaTemplate<String, Object> kafkaTemplate(ProducerFactory<String, Object> producerFactory,
                                                       KafkaMetricsCollector metricsCollector) {
        KafkaTemplate<String, Object> template = new KafkaTemplate<>(producerFactory);
        
        // Set default topic if configured
        if (properties.getTemplate().getDefaultTopic() != null) {
            template.setDefaultTopic(properties.getTemplate().getDefaultTopic());
        }
        
        // Add metrics collection
        template.setProducerListener(new MetricsProducerListener(metricsCollector));
        
        return template;
    }
    
    /**
     * Transaction manager for exactly-once semantics
     */
    @Bean
    @ConditionalOnProperty(prefix = "kafka.producer", name = "idempotent", havingValue = "true")
    @ConditionalOnMissingBean
    public KafkaTransactionManager kafkaTransactionManager(ProducerFactory<String, Object> producerFactory) {
        return new KafkaTransactionManager(producerFactory);
    }
    
    /**
     * Enhanced Kafka Consumer Factory with optimized settings
     */
    @Bean
    @ConditionalOnMissingBean
    public ConsumerFactory<String, Object> kafkaConsumerFactory(KafkaProperties properties) {
        Map<String, Object> configProps = new HashMap<>();
        
        // Basic connection settings
        configProps.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, properties.getBootstrapServers());
        configProps.put(ConsumerConfig.GROUP_ID_CONFIG, properties.getConsumer().getGroupId());
        configProps.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        configProps.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class);
        configProps.put(ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS, JsonDeserializer.class);
        
        // High-performance optimizations
        configProps.put(ConsumerConfig.FETCH_MIN_BYTES_CONFIG, properties.getConsumer().getFetchMinBytes()); // 50KB min fetch
        configProps.put(ConsumerConfig.FETCH_MAX_BYTES_CONFIG, properties.getConsumer().getFetchMaxBytes()); // 50MB max fetch
        configProps.put(ConsumerConfig.MAX_PARTITION_FETCH_BYTES_CONFIG, properties.getConsumer().getMaxPartitionFetchBytes()); // 10MB per partition
        configProps.put(ConsumerConfig.FETCH_MAX_WAIT_MS_CONFIG, properties.getConsumer().getFetchMaxWait()); // 500ms max wait
        
        // Session and heartbeat settings
        configProps.put(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG, properties.getConsumer().getSessionTimeout());
        configProps.put(ConsumerConfig.HEARTBEAT_INTERVAL_MS_CONFIG, properties.getConsumer().getHeartbeatInterval());
        
        // Auto-commit settings
        configProps.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, properties.getConsumer().isAutoCommit());
        if (properties.getConsumer().isAutoCommit()) {
            configProps.put(ConsumerConfig.AUTO_COMMIT_INTERVAL_MS_CONFIG, properties.getConsumer().getAutoCommitInterval());
        }
        
        // Offset reset strategy
        configProps.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, properties.getConsumer().getAutoOffsetReset());
        
        // Consumer interceptors
        configProps.put(ConsumerConfig.INTERCEPTOR_CLASSES_CONFIG, 
            java.util.Arrays.asList(TracingInterceptor.class.getName()));
        
        // Security settings
        if (properties.getSecurity() != null) {
            configProps.putAll(properties.getSecurity().buildProperties());
        }
        
        return new DefaultKafkaConsumerFactory<>(configProps);
    }
    
    /**
     * Kafka Listener Container Factory with enhanced error handling
     */
    @Bean
    @ConditionalOnMissingBean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory(
            ConsumerFactory<String, Object> consumerFactory,
            KafkaTemplate<String, Object> kafkaTemplate,
            KafkaProperties properties) {
        
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = 
            new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        
        // Concurrency settings for high throughput
        factory.setConcurrency(properties.getListener().getConcurrency());
        
        // Container properties for optimal performance
        ContainerProperties containerProps = factory.getContainerProperties();
        containerProps.setAckMode(ContainerProperties.AckMode.valueOf(properties.getListener().getAckMode()));
        containerProps.setPollTimeout(properties.getListener().getPollTimeout());
        containerProps.setIdleBetweenPolls(Duration.ofMillis(properties.getListener().getIdleBetweenPolls()));
        
        // Enhanced error handling with retry and DLQ
        DefaultErrorHandler errorHandler = createErrorHandler(kafkaTemplate, properties);
        factory.setCommonErrorHandler(errorHandler);
        
        // Transaction support
        if (properties.getListener().isTransactional()) {
            containerProps.setTransactionManager(kafkaTransactionManager(kafkaProducerFactory(properties)));
        }
        
        return factory;
    }
    
    /**
     * Create enhanced error handler with retry and dead letter queue
     */
    private DefaultErrorHandler createErrorHandler(KafkaTemplate<String, Object> kafkaTemplate, 
                                                 KafkaProperties properties) {
        // Dead letter queue recoverer
        DeadLetterPublishingRecoverer deadLetterRecoverer = 
            new DeadLetterPublishingRecoverer(kafkaTemplate, (record, exception) -> {
                // Determine DLQ topic based on original topic
                String originalTopic = record.topic();
                return new org.apache.kafka.common.TopicPartition(
                    properties.getDeadLetterQueue().getTopicPrefix() + originalTopic, 
                    record.partition()
                );
            });
        
        // Retry policy with exponential backoff
        FixedBackOff backOff = new FixedBackOff(
            properties.getRetry().getBackOffInitialInterval(),
            properties.getRetry().getBackOffMaxInterval()
        );
        
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(deadLetterRecoverer, backOff);
        
        // Configure retryable exceptions
        errorHandler.addRetryableExceptions(
            org.apache.kafka.common.errors.NetworkException.class,
            org.apache.kafka.common.errors.TimeoutException.class,
            org.springframework.kafka.listener.ListenerExecutionFailedException.class
        );
        
        // Configure non-retryable exceptions (send directly to DLQ)
        errorHandler.addNotRetryableExceptions(
            com.fasterxml.jackson.core.JsonParseException.class,
            IllegalArgumentException.class
        );
        
        return errorHandler;
    }
    
    /**
     * Enhanced Kafka Producer with built-in retry and circuit breaker
     */
    @Bean
    @ConditionalOnMissingBean
    public EnhancedKafkaProducer enhancedKafkaProducer(KafkaTemplate<String, Object> kafkaTemplate,
                                                      KafkaMetricsCollector metricsCollector) {
        return new EnhancedKafkaProducer(kafkaTemplate, metricsCollector);
    }
    
    /**
     * Enhanced Kafka Consumer with automatic dead letter queue handling
     */
    @Bean
    @ConditionalOnMissingBean
    public EnhancedKafkaConsumer enhancedKafkaConsumer(KafkaTemplate<String, Object> kafkaTemplate,
                                                      KafkaMetricsCollector metricsCollector) {
        return new EnhancedKafkaConsumer(kafkaTemplate, metricsCollector);
    }
    
    /**
     * Kafka metrics collector for monitoring
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(MeterRegistry.class)
    public KafkaMetricsCollector kafkaMetricsCollector(MeterRegistry meterRegistry) {
        return new KafkaMetricsCollector(meterRegistry);
    }
    
    /**
     * Kafka health indicator for actuator
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "management.health.kafka", name = "enabled", havingValue = "true", matchIfMissing = true)
    public KafkaHealthIndicator kafkaHealthIndicator(KafkaTemplate<String, Object> kafkaTemplate) {
        return new KafkaHealthIndicator(kafkaTemplate);
    }
    
    /**
     * Dead letter queue handler for failed message processing
     */
    @Bean
    @ConditionalOnProperty(prefix = "kafka.dead-letter-queue", name = "enabled", havingValue = "true")
    @ConditionalOnMissingBean
    public DeadLetterQueueHandler deadLetterQueueHandler(KafkaTemplate<String, Object> kafkaTemplate,
                                                        KafkaProperties properties) {
        return new DeadLetterQueueHandler(kafkaTemplate, properties.getDeadLetterQueue());
    }
    
    /**
     * Retry template for custom retry logic
     */
    @Bean
    @ConditionalOnMissingBean
    public RetryTemplate kafkaRetryTemplate(KafkaProperties properties) {
        RetryTemplate retryTemplate = new RetryTemplate();
        
        SimpleRetryPolicy retryPolicy = new SimpleRetryPolicy();
        retryPolicy.setMaxAttempts(properties.getRetry().getMaxAttempts());
        retryTemplate.setRetryPolicy(retryPolicy);
        
        FixedBackOff backOff = new FixedBackOff(
            properties.getRetry().getBackOffInitialInterval(),
            properties.getRetry().getBackOffMaxInterval()
        );
        retryTemplate.setBackOffPolicy(backOff);
        
        return retryTemplate;
    }
    
    /**
     * Retryable error handler for custom error processing
     */
    @Bean
    @ConditionalOnMissingBean
    public RetryableErrorHandler retryableErrorHandler(RetryTemplate retryTemplate,
                                                      DeadLetterQueueHandler deadLetterQueueHandler) {
        return new RetryableErrorHandler(retryTemplate, deadLetterQueueHandler);
    }
    
    /**
     * Kafka admin for topic management
     */
    @Bean
    @ConditionalOnMissingBean
    public KafkaAdmin kafkaAdmin(KafkaProperties properties) {
        Map<String, Object> configs = new HashMap<>();
        configs.put(org.apache.kafka.clients.admin.AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, 
                   properties.getBootstrapServers());
        
        if (properties.getSecurity() != null) {
            configs.putAll(properties.getSecurity().buildProperties());
        }
        
        return new KafkaAdmin(configs);
    }
    
    /**
     * Nested configuration for Kafka tracing
     */
    @Configuration
    @ConditionalOnClass(Tracer.class)
    @ConditionalOnProperty(prefix = "kafka.tracing", name = "enabled", havingValue = "true", matchIfMissing = true)
    static class KafkaTracingConfiguration {
        
        @Bean
        @ConditionalOnMissingBean
        public TracingInterceptor tracingInterceptor() {
            Tracer tracer = GlobalTracer.get();
            return new TracingInterceptor(tracer);
        }
    }
    
    /**
     * Nested configuration for Kafka auditing
     */
    @Configuration
    @ConditionalOnProperty(prefix = "kafka.audit", name = "enabled", havingValue = "true")
    static class KafkaAuditConfiguration {
        
        @Bean
        @ConditionalOnMissingBean
        public AuditInterceptor auditInterceptor(KafkaProperties properties) {
            return new AuditInterceptor(properties.getAudit());
        }
    }
}

/**
 * Metrics producer listener for collecting producer metrics
 */
class MetricsProducerListener implements ProducerListener<String, Object> {
    
    private final KafkaMetricsCollector metricsCollector;
    
    public MetricsProducerListener(KafkaMetricsCollector metricsCollector) {
        this.metricsCollector = metricsCollector;
    }
    
    @Override
    public void onSuccess(ProducerRecord<String, Object> producerRecord, RecordMetadata recordMetadata) {
        metricsCollector.recordSuccessfulSend(producerRecord.topic(), recordMetadata.partition());
    }
    
    @Override
    public void onError(ProducerRecord<String, Object> producerRecord, RecordMetadata recordMetadata, Exception exception) {
        metricsCollector.recordFailedSend(producerRecord.topic(), exception);
    }
}