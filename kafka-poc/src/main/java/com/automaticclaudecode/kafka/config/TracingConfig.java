package com.automaticclaudecode.kafka.config;

import brave.Tracing;
import brave.kafka.clients.KafkaTracing;
import brave.sampler.Sampler;
import io.micrometer.tracing.brave.bridge.BraveBaggageManager;
import io.micrometer.tracing.brave.bridge.BraveCurrentTraceContext;
import io.micrometer.tracing.brave.bridge.BraveTracer;
import org.apache.kafka.clients.consumer.ConsumerInterceptor;
import org.apache.kafka.clients.producer.ProducerInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import zipkin2.reporter.AsyncReporter;
import zipkin2.reporter.okhttp3.OkHttpSender;

/**
 * Distributed tracing configuration with Jaeger integration
 * Provides end-to-end tracing for Kafka producer/consumer operations
 */
@Configuration
public class TracingConfig {

    @Value("${management.zipkin.tracing.endpoint:http://localhost:9411/api/v2/spans}")
    private String zipkinEndpoint;

    @Value("${spring.application.name}")
    private String serviceName;

    /**
     * Zipkin sender configuration
     */
    @Bean
    public OkHttpSender zipkinSender() {
        return OkHttpSender.create(zipkinEndpoint);
    }

    /**
     * Zipkin span reporter
     */
    @Bean
    public AsyncReporter<zipkin2.Span> zipkinReporter() {
        return AsyncReporter.create(zipkinSender());
    }

    /**
     * Brave tracing configuration
     */
    @Bean
    public Tracing tracing() {
        return Tracing.newBuilder()
                .localServiceName(serviceName)
                .spanReporter(zipkinReporter())
                .sampler(Sampler.create(1.0f)) // Sample 100% for demo, adjust for production
                .build();
    }

    /**
     * Kafka tracing integration
     */
    @Bean
    public KafkaTracing kafkaTracing() {
        return KafkaTracing.newBuilder(tracing())
                .writeB3SingleFormat(true) // Use B3 single header format
                .build();
    }

    /**
     * Kafka producer interceptor for tracing
     */
    @Bean
    public ProducerInterceptor<String, Object> kafkaProducerTracingInterceptor() {
        return kafkaTracing().nextProducerInterceptor();
    }

    /**
     * Kafka consumer interceptor for tracing
     */
    @Bean
    public ConsumerInterceptor<String, Object> kafkaConsumerTracingInterceptor() {
        return kafkaTracing().nextConsumerInterceptor();
    }

    /**
     * Micrometer Brave tracer bridge
     */
    @Bean
    public BraveTracer braveTracer() {
        return new BraveTracer(
                tracing().tracer(),
                new BraveCurrentTraceContext(tracing().currentTraceContext()),
                new BraveBaggageManager()
        );
    }
}