package com.automaticclaudecode.kafka.benchmark;

import com.automaticclaudecode.kafka.avro.EventType;
import com.automaticclaudecode.kafka.avro.UserEvent;
import com.automaticclaudecode.kafka.avro.EventMetadata;
import com.automaticclaudecode.kafka.avro.UserEventPayload;
import com.automaticclaudecode.kafka.avro.UserStatus;
import com.automaticclaudecode.kafka.producer.EventProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;

/**
 * Comprehensive Kafka performance benchmarking framework
 * Tests throughput, latency, and scalability scenarios
 * Target: 100K+ messages per second with sub-10ms latency
 */
@Slf4j
@SpringBootTest
@Testcontainers
@RequiredArgsConstructor
public class KafkaPerformanceBenchmark {

    private static final Network network = Network.newNetwork();

    @Container
    static final KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.1"))
            .withNetwork(network)
            .withNetworkAliases("kafka")
            .withEnv("KAFKA_AUTO_CREATE_TOPICS_ENABLE", "true")
            .withEnv("KAFKA_NUM_PARTITIONS", "12")
            .withEnv("KAFKA_DEFAULT_REPLICATION_FACTOR", "1")
            .withEnv("KAFKA_LOG_RETENTION_MS", "300000") // 5 minutes for testing
            .withEnv("KAFKA_LOG_SEGMENT_BYTES", "104857600") // 100MB segments
            .withEnv("KAFKA_LOG_FLUSH_INTERVAL_MESSAGES", "10000")
            .withEnv("KAFKA_REPLICA_FETCH_MAX_BYTES", "10485760") // 10MB
            .withEnv("KAFKA_SOCKET_SEND_BUFFER_BYTES", "1048576") // 1MB
            .withEnv("KAFKA_SOCKET_RECEIVE_BUFFER_BYTES", "1048576"); // 1MB

    @Container
    static final GenericContainer<?> schemaRegistry = new GenericContainer<>(
            DockerImageName.parse("confluentinc/cp-schema-registry:7.5.1"))
            .withNetwork(network)
            .withExposedPorts(8081)
            .withEnv("SCHEMA_REGISTRY_HOST_NAME", "schema-registry")
            .withEnv("SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS", "kafka:9092")
            .withEnv("SCHEMA_REGISTRY_LISTENERS", "http://0.0.0.0:8081")
            .dependsOn(kafka);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
        registry.add("spring.kafka.producer.properties.schema.registry.url", 
                () -> "http://localhost:" + schemaRegistry.getMappedPort(8081));
        registry.add("spring.kafka.consumer.properties.schema.registry.url", 
                () -> "http://localhost:" + schemaRegistry.getMappedPort(8081));
    }

    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Autowired
    private EventProducer eventProducer;

    private final Random random = new Random();

    @BeforeEach
    void setUp() {
        // Warm up the connections
        warmUpConnections();
    }

    @Test
    @DisplayName("High Throughput Test - 100K+ messages/second")
    void testHighThroughput() throws Exception {
        int totalMessages = 100_000;
        int batchSize = 1000;
        int numThreads = 10;
        
        log.info("Starting high throughput test: {} messages, {} threads, {} batch size", 
                totalMessages, numThreads, batchSize);

        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch latch = new CountDownLatch(totalMessages / batchSize);
        AtomicInteger messagesSent = new AtomicInteger(0);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);

        long startTime = System.currentTimeMillis();

        // Submit batched send tasks
        for (int batch = 0; batch < totalMessages / batchSize; batch++) {
            executor.submit(() -> {
                try {
                    List<CompletableFuture<SendResult<String, Object>>> futures = new ArrayList<>();
                    
                    // Send batch of messages
                    for (int i = 0; i < batchSize; i++) {
                        UserEvent event = createRandomUserEvent();
                        CompletableFuture<SendResult<String, Object>> future = eventProducer.sendUserEvent(event);
                        futures.add(future);
                        
                        future.whenComplete((result, throwable) -> {
                            if (throwable == null) {
                                successCount.incrementAndGet();
                            } else {
                                errorCount.incrementAndGet();
                                log.warn("Message send failed: {}", throwable.getMessage());
                            }
                        });
                        
                        messagesSent.incrementAndGet();
                    }
                    
                    // Wait for batch completion
                    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get(30, TimeUnit.SECONDS);
                    
                } catch (Exception e) {
                    log.error("Batch send failed: {}", e.getMessage(), e);
                } finally {
                    latch.countDown();
                }
            });
        }

        // Wait for completion
        boolean completed = latch.await(5, TimeUnit.MINUTES);
        long endTime = System.currentTimeMillis();
        long duration = endTime - startTime;

        executor.shutdown();

        // Calculate metrics
        double throughputPerSecond = (double) messagesSent.get() / (duration / 1000.0);
        double successRate = (double) successCount.get() / messagesSent.get() * 100;

        log.info("High Throughput Test Results:");
        log.info("  Total messages sent: {}", messagesSent.get());
        log.info("  Successful sends: {}", successCount.get());
        log.info("  Failed sends: {}", errorCount.get());
        log.info("  Duration: {} ms", duration);
        log.info("  Throughput: {:.2f} messages/second", throughputPerSecond);
        log.info("  Success rate: {:.2f}%", successRate);
        log.info("  Test completed: {}", completed);

        // Assertions
        assert completed : "Test did not complete within timeout";
        assert throughputPerSecond >= 100_000 : "Throughput below target: " + throughputPerSecond;
        assert successRate >= 99.0 : "Success rate below 99%: " + successRate;

        System.out.println("✅ High throughput test passed: " + throughputPerSecond + " msg/sec");
    }

    @Test
    @DisplayName("Latency Benchmark - Sub-10ms end-to-end")
    void testLatencyBenchmark() throws Exception {
        int numMessages = 10_000;
        int warmupMessages = 1_000;
        
        log.info("Starting latency benchmark: {} messages with {} warmup", numMessages, warmupMessages);

        List<Long> latencies = new ArrayList<>();
        CountDownLatch latch = new CountDownLatch(numMessages + warmupMessages);

        // Warmup phase
        for (int i = 0; i < warmupMessages; i++) {
            UserEvent event = createRandomUserEvent();
            long sendTime = System.nanoTime();
            
            eventProducer.sendUserEvent(event).whenComplete((result, throwable) -> {
                if (throwable == null) {
                    long receiveTime = System.nanoTime();
                    long latencyNanos = receiveTime - sendTime;
                    // Don't record warmup latencies
                }
                latch.countDown();
            });
        }

        // Actual benchmark
        for (int i = 0; i < numMessages; i++) {
            UserEvent event = createRandomUserEvent();
            long sendTime = System.nanoTime();
            
            eventProducer.sendUserEvent(event).whenComplete((result, throwable) -> {
                if (throwable == null) {
                    long receiveTime = System.nanoTime();
                    long latencyNanos = receiveTime - sendTime;
                    synchronized (latencies) {
                        latencies.add(latencyNanos);
                    }
                }
                latch.countDown();
            });
            
            // Add small delay to prevent overwhelming
            if (i % 100 == 0) {
                Thread.sleep(1);
            }
        }

        boolean completed = latch.await(2, TimeUnit.MINUTES);
        assert completed : "Latency test did not complete within timeout";

        // Calculate latency statistics
        Collections.sort(latencies);
        
        double avgLatencyMs = latencies.stream().mapToLong(Long::longValue).average().orElse(0) / 1_000_000.0;
        double p50LatencyMs = latencies.get(latencies.size() / 2) / 1_000_000.0;
        double p95LatencyMs = latencies.get((int) (latencies.size() * 0.95)) / 1_000_000.0;
        double p99LatencyMs = latencies.get((int) (latencies.size() * 0.99)) / 1_000_000.0;
        double maxLatencyMs = latencies.get(latencies.size() - 1) / 1_000_000.0;

        log.info("Latency Benchmark Results:");
        log.info("  Messages processed: {}", latencies.size());
        log.info("  Average latency: {:.2f} ms", avgLatencyMs);
        log.info("  P50 latency: {:.2f} ms", p50LatencyMs);
        log.info("  P95 latency: {:.2f} ms", p95LatencyMs);
        log.info("  P99 latency: {:.2f} ms", p99LatencyMs);
        log.info("  Max latency: {:.2f} ms", maxLatencyMs);

        // Assertions
        assert p95LatencyMs <= 10.0 : "P95 latency above 10ms: " + p95LatencyMs;
        assert p99LatencyMs <= 20.0 : "P99 latency above 20ms: " + p99LatencyMs;

        System.out.println("✅ Latency benchmark passed: P95=" + p95LatencyMs + "ms, P99=" + p99LatencyMs + "ms");
    }

    @Test
    @DisplayName("Concurrent Producer Stress Test")
    void testConcurrentProducerStress() throws Exception {
        int numProducers = 50;
        int messagesPerProducer = 1_000;
        int totalMessages = numProducers * messagesPerProducer;
        
        log.info("Starting concurrent producer stress test: {} producers, {} messages each", 
                numProducers, messagesPerProducer);

        ExecutorService executor = Executors.newFixedThreadPool(numProducers);
        CountDownLatch latch = new CountDownLatch(numProducers);
        AtomicLong totalLatency = new AtomicLong(0);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);

        long startTime = System.currentTimeMillis();

        // Launch concurrent producers
        IntStream.range(0, numProducers).forEach(producerId -> {
            executor.submit(() -> {
                try {
                    List<CompletableFuture<SendResult<String, Object>>> futures = new ArrayList<>();
                    long producerStartTime = System.currentTimeMillis();
                    
                    for (int i = 0; i < messagesPerProducer; i++) {
                        UserEvent event = createRandomUserEvent();
                        event.setUserId("producer-" + producerId + "-user-" + i);
                        
                        CompletableFuture<SendResult<String, Object>> future = eventProducer.sendUserEvent(event);
                        futures.add(future);
                        
                        future.whenComplete((result, throwable) -> {
                            if (throwable == null) {
                                successCount.incrementAndGet();
                            } else {
                                errorCount.incrementAndGet();
                            }
                        });
                    }
                    
                    // Wait for all messages from this producer
                    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get();
                    
                    long producerEndTime = System.currentTimeMillis();
                    totalLatency.addAndGet(producerEndTime - producerStartTime);
                    
                    log.debug("Producer {} completed {} messages in {} ms", 
                             producerId, messagesPerProducer, producerEndTime - producerStartTime);
                    
                } catch (Exception e) {
                    log.error("Producer {} failed: {}", producerId, e.getMessage(), e);
                } finally {
                    latch.countDown();
                }
            });
        });

        boolean completed = latch.await(5, TimeUnit.MINUTES);
        long endTime = System.currentTimeMillis();
        long duration = endTime - startTime;

        executor.shutdown();

        // Calculate metrics
        double throughputPerSecond = (double) totalMessages / (duration / 1000.0);
        double successRate = (double) successCount.get() / totalMessages * 100;
        double avgProducerLatency = (double) totalLatency.get() / numProducers;

        log.info("Concurrent Producer Stress Test Results:");
        log.info("  Total messages: {}", totalMessages);
        log.info("  Successful sends: {}", successCount.get());
        log.info("  Failed sends: {}", errorCount.get());
        log.info("  Duration: {} ms", duration);
        log.info("  Throughput: {:.2f} messages/second", throughputPerSecond);
        log.info("  Success rate: {:.2f}%", successRate);
        log.info("  Average producer latency: {:.2f} ms", avgProducerLatency);

        // Assertions
        assert completed : "Stress test did not complete within timeout";
        assert throughputPerSecond >= 50_000 : "Throughput below target: " + throughputPerSecond;
        assert successRate >= 99.0 : "Success rate below 99%: " + successRate;

        System.out.println("✅ Concurrent producer stress test passed: " + throughputPerSecond + " msg/sec");
    }

    @Test
    @DisplayName("Memory Usage and Resource Efficiency Test")
    void testMemoryUsageAndEfficiency() throws Exception {
        int batchSize = 10_000;
        int numBatches = 10;
        
        log.info("Starting memory usage and efficiency test");

        Runtime runtime = Runtime.getRuntime();
        long initialMemory = runtime.totalMemory() - runtime.freeMemory();
        
        for (int batch = 0; batch < numBatches; batch++) {
            log.info("Processing batch {} of {}", batch + 1, numBatches);
            
            List<CompletableFuture<SendResult<String, Object>>> futures = new ArrayList<>();
            
            // Send batch
            for (int i = 0; i < batchSize; i++) {
                UserEvent event = createRandomUserEvent();
                futures.add(eventProducer.sendUserEvent(event));
            }
            
            // Wait for completion
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get(30, TimeUnit.SECONDS);
            
            // Memory check after each batch
            long currentMemory = runtime.totalMemory() - runtime.freeMemory();
            long memoryIncrease = currentMemory - initialMemory;
            
            log.debug("Memory usage after batch {}: {} MB (increase: {} MB)", 
                     batch + 1, currentMemory / 1024 / 1024, memoryIncrease / 1024 / 1024);
            
            // Force garbage collection to test memory leaks
            if (batch % 3 == 0) {
                System.gc();
                Thread.sleep(100);
            }
        }
        
        // Final memory check
        System.gc();
        Thread.sleep(500);
        long finalMemory = runtime.totalMemory() - runtime.freeMemory();
        long totalMemoryIncrease = finalMemory - initialMemory;
        
        log.info("Memory Usage Test Results:");
        log.info("  Initial memory: {} MB", initialMemory / 1024 / 1024);
        log.info("  Final memory: {} MB", finalMemory / 1024 / 1024);
        log.info("  Total memory increase: {} MB", totalMemoryIncrease / 1024 / 1024);
        log.info("  Memory per message: {} bytes", totalMemoryIncrease / (batchSize * numBatches));
        
        // Memory usage should be reasonable (less than 500MB increase)
        assert totalMemoryIncrease < 500 * 1024 * 1024 : "Memory usage too high: " + totalMemoryIncrease / 1024 / 1024 + " MB";
        
        System.out.println("✅ Memory usage test passed: " + totalMemoryIncrease / 1024 / 1024 + " MB increase");
    }

    @Test
    @DisplayName("Error Handling and Recovery Test")
    void testErrorHandlingAndRecovery() throws Exception {
        int totalMessages = 1_000;
        int expectedErrors = 100;
        
        log.info("Starting error handling and recovery test");
        
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);
        AtomicInteger retryCount = new AtomicInteger(0);
        CountDownLatch latch = new CountDownLatch(totalMessages);
        
        for (int i = 0; i < totalMessages; i++) {
            UserEvent event = createRandomUserEvent();
            
            // Intentionally create some invalid events to test error handling
            if (i % 10 == 0) {
                event.setEventId(null); // Invalid event
            }
            
            try {
                eventProducer.sendUserEvent(event).whenComplete((result, throwable) -> {
                    if (throwable == null) {
                        successCount.incrementAndGet();
                    } else {
                        errorCount.incrementAndGet();
                        if (throwable.getMessage().contains("retry")) {
                            retryCount.incrementAndGet();
                        }
                    }
                    latch.countDown();
                });
            } catch (Exception e) {
                errorCount.incrementAndGet();
                latch.countDown();
            }
        }
        
        boolean completed = latch.await(2, TimeUnit.MINUTES);
        
        log.info("Error Handling Test Results:");
        log.info("  Total messages: {}", totalMessages);
        log.info("  Successful: {}", successCount.get());
        log.info("  Errors: {}", errorCount.get());
        log.info("  Retries: {}", retryCount.get());
        
        assert completed : "Error handling test did not complete";
        assert errorCount.get() >= expectedErrors * 0.8 : "Not enough errors detected for testing";
        
        System.out.println("✅ Error handling test passed: " + errorCount.get() + " errors handled");
    }

    // Helper methods

    private void warmUpConnections() {
        try {
            log.info("Warming up Kafka connections...");
            
            for (int i = 0; i < 100; i++) {
                UserEvent event = createRandomUserEvent();
                eventProducer.sendUserEvent(event).get(1, TimeUnit.SECONDS);
            }
            
            log.info("Warm-up completed");
        } catch (Exception e) {
            log.warn("Warm-up failed: {}", e.getMessage());
        }
    }

    private UserEvent createRandomUserEvent() {
        EventType[] eventTypes = EventType.values();
        UserStatus[] userStatuses = UserStatus.values();
        
        return UserEvent.newBuilder()
                .setEventId(UUID.randomUUID().toString())
                .setUserId("user-" + random.nextInt(10000))
                .setEventType(eventTypes[random.nextInt(eventTypes.length)])
                .setTimestamp(Instant.now().toEpochMilli())
                .setSessionId("session-" + random.nextInt(1000))
                .setMetadata(EventMetadata.newBuilder()
                        .setSource("benchmark-test")
                        .setVersion("1.0")
                        .setCorrelationId(UUID.randomUUID().toString())
                        .setIpAddress("192.168.1." + random.nextInt(255))
                        .setUserAgent("BenchmarkAgent/1.0")
                        .build())
                .setPayload(UserEventPayload.newBuilder()
                        .setEmail("user" + random.nextInt(10000) + "@example.com")
                        .setFirstName("FirstName" + random.nextInt(1000))
                        .setLastName("LastName" + random.nextInt(1000))
                        .setStatus(userStatuses[random.nextInt(userStatuses.length)])
                        .setPreferences(Map.of(
                                "theme", random.nextBoolean() ? "dark" : "light",
                                "notifications", String.valueOf(random.nextBoolean()),
                                "language", random.nextBoolean() ? "en" : "es"
                        ))
                        .build())
                .build();
    }
}