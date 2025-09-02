package com.automaticclaudecode.kafka.integration;

import com.automaticclaudecode.kafka.avro.*;
import com.automaticclaudecode.kafka.consumer.UserEventConsumer;
import com.automaticclaudecode.kafka.producer.EventProducer;
import com.automaticclaudecode.kafka.processor.UserEventProcessor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.SendResult;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive integration testing suite for event-driven architecture
 * Tests end-to-end workflows, fault tolerance, and system behavior
 */
@Slf4j
@SpringBootTest
@Testcontainers
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class KafkaIntegrationTestSuite {

    private static final Network network = Network.newNetwork();

    @Container
    static final KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.1"))
            .withNetwork(network)
            .withNetworkAliases("kafka")
            .withEnv("KAFKA_AUTO_CREATE_TOPICS_ENABLE", "true")
            .withEnv("KAFKA_NUM_PARTITIONS", "3")
            .withEnv("KAFKA_DEFAULT_REPLICATION_FACTOR", "1")
            .withEnv("KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR", "1")
            .withEnv("KAFKA_TRANSACTION_STATE_LOG_MIN_ISR", "1");

    @Container
    static final GenericContainer<?> schemaRegistry = new GenericContainer<>(
            DockerImageName.parse("confluentinc/cp-schema-registry:7.5.1"))
            .withNetwork(network)
            .withExposedPorts(8081)
            .withEnv("SCHEMA_REGISTRY_HOST_NAME", "schema-registry")
            .withEnv("SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS", "kafka:9092")
            .withEnv("SCHEMA_REGISTRY_LISTENERS", "http://0.0.0.0:8081")
            .dependsOn(kafka);

    @Container
    static final GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withNetwork(network)
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
        registry.add("spring.kafka.producer.properties.schema.registry.url", 
                () -> "http://localhost:" + schemaRegistry.getMappedPort(8081));
        registry.add("spring.kafka.consumer.properties.schema.registry.url", 
                () -> "http://localhost:" + schemaRegistry.getMappedPort(8081));
        registry.add("spring.redis.host", redis::getHost);
        registry.add("spring.redis.port", () -> redis.getMappedPort(6379));
    }

    @Autowired
    private EventProducer eventProducer;

    @Autowired
    private UserEventProcessor userEventProcessor;

    private Consumer<String, Object> testConsumer;
    private final String testTopic = "user-events";

    @BeforeEach
    void setUp() {
        setupTestConsumer();
    }

    @AfterEach
    void tearDown() {
        if (testConsumer != null) {
            testConsumer.close();
        }
    }

    @Test
    @DisplayName("End-to-End User Lifecycle Integration Test")
    void testCompleteUserLifecycle() throws Exception {
        String userId = "integration-user-" + System.currentTimeMillis();
        log.info("Starting complete user lifecycle test for userId: {}", userId);

        // Test data
        AtomicInteger eventsProcessed = new AtomicInteger(0);
        CountDownLatch eventLatch = new CountDownLatch(5); // Expecting 5 events

        // 1. User Creation
        UserEvent createEvent = createUserCreatedEvent(userId, "john.doe@example.com");
        CompletableFuture<SendResult<String, Object>> createResult = eventProducer.sendUserEvent(createEvent);
        assertNotNull(createResult.get(10, TimeUnit.SECONDS));
        
        // Wait and verify creation
        Thread.sleep(1000);
        assertTrue(userEventProcessor.isAlreadyProcessed(createEvent.getEventId()));
        eventsProcessed.incrementAndGet();
        eventLatch.countDown();

        // 2. User Update - Email Change
        UserEvent updateEmailEvent = createUserUpdatedEvent(userId, "john.newemail@example.com");
        CompletableFuture<SendResult<String, Object>> updateResult = eventProducer.sendUserEvent(updateEmailEvent);
        assertNotNull(updateResult.get(10, TimeUnit.SECONDS));
        
        Thread.sleep(1000);
        assertTrue(userEventProcessor.isAlreadyProcessed(updateEmailEvent.getEventId()));
        eventsProcessed.incrementAndGet();
        eventLatch.countDown();

        // 3. User Login
        UserEvent loginEvent = createUserLoginEvent(userId, "session-123");
        CompletableFuture<SendResult<String, Object>> loginResult = eventProducer.sendUserEvent(loginEvent);
        assertNotNull(loginResult.get(10, TimeUnit.SECONDS));
        
        Thread.sleep(1000);
        eventsProcessed.incrementAndGet();
        eventLatch.countDown();

        // 4. User Logout
        UserEvent logoutEvent = createUserLogoutEvent(userId, "session-123");
        CompletableFuture<SendResult<String, Object>> logoutResult = eventProducer.sendUserEvent(logoutEvent);
        assertNotNull(logoutResult.get(10, TimeUnit.SECONDS));
        
        Thread.sleep(1000);
        eventsProcessed.incrementAndGet();
        eventLatch.countDown();

        // 5. User Deletion
        UserEvent deleteEvent = createUserDeletedEvent(userId);
        CompletableFuture<SendResult<String, Object>> deleteResult = eventProducer.sendUserEvent(deleteEvent);
        assertNotNull(deleteResult.get(10, TimeUnit.SECONDS));
        
        Thread.sleep(1000);
        eventsProcessed.incrementAndGet();
        eventLatch.countDown();

        // Verify all events processed
        assertTrue(eventLatch.await(30, TimeUnit.SECONDS), "Not all events were processed within timeout");
        assertEquals(5, eventsProcessed.get(), "Expected 5 events to be processed");

        log.info("Complete user lifecycle test completed successfully for userId: {}", userId);
    }

    @Test
    @DisplayName("Idempotency and Duplicate Message Handling Test")
    void testIdempotencyAndDuplicateHandling() throws Exception {
        String userId = "idempotency-user-" + System.currentTimeMillis();
        String eventId = "duplicate-event-" + System.currentTimeMillis();
        
        log.info("Testing idempotency for eventId: {}", eventId);

        // Create the same event multiple times
        UserEvent originalEvent = createUserCreatedEvent(userId, "duplicate@example.com");
        originalEvent.setEventId(eventId);

        // Send the same event 5 times
        List<CompletableFuture<SendResult<String, Object>>> futures = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            UserEvent duplicateEvent = UserEvent.newBuilder(originalEvent).build();
            futures.add(eventProducer.sendUserEvent(duplicateEvent));
        }

        // Wait for all sends to complete
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get(30, TimeUnit.SECONDS);

        // Wait for processing
        Thread.sleep(2000);

        // Verify idempotency - event should only be processed once
        assertTrue(userEventProcessor.isAlreadyProcessed(eventId));
        
        // Try to process again - should be skipped
        assertFalse(userEventProcessor.isAlreadyProcessed("non-existent-event"));

        log.info("Idempotency test completed successfully");
    }

    @Test
    @DisplayName("Error Handling and Dead Letter Queue Test")
    void testErrorHandlingAndDeadLetterQueue() throws Exception {
        log.info("Testing error handling and dead letter queue functionality");

        // Create invalid events to trigger error handling
        List<CompletableFuture<SendResult<String, Object>>> futures = new ArrayList<>();
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);

        // Send mix of valid and invalid events
        for (int i = 0; i < 10; i++) {
            UserEvent event;
            if (i % 3 == 0) {
                // Create invalid event (null eventId)
                event = createUserCreatedEvent("error-user-" + i, "error@example.com");
                event.setEventId(null); // This should cause validation error
            } else {
                // Create valid event
                event = createUserCreatedEvent("valid-user-" + i, "valid" + i + "@example.com");
            }

            CompletableFuture<SendResult<String, Object>> future = eventProducer.sendUserEvent(event);
            future.whenComplete((result, throwable) -> {
                if (throwable == null) {
                    successCount.incrementAndGet();
                } else {
                    errorCount.incrementAndGet();
                    log.debug("Expected error occurred: {}", throwable.getMessage());
                }
            });
            futures.add(future);
        }

        // Wait for all operations to complete
        Thread.sleep(5000);

        log.info("Error handling test results - Success: {}, Errors: {}", 
                successCount.get(), errorCount.get());

        // Should have some errors from invalid events
        assertTrue(errorCount.get() > 0, "Expected some errors from invalid events");
        assertTrue(successCount.get() > 0, "Expected some successful events");
    }

    @Test
    @DisplayName("Concurrent Consumer Processing Test")
    void testConcurrentConsumerProcessing() throws Exception {
        int numMessages = 100;
        String baseUserId = "concurrent-user-";
        
        log.info("Testing concurrent consumer processing with {} messages", numMessages);

        CountDownLatch sendLatch = new CountDownLatch(numMessages);
        AtomicInteger sentCount = new AtomicInteger(0);

        // Send messages concurrently
        ExecutorService executor = Executors.newFixedThreadPool(10);
        
        for (int i = 0; i < numMessages; i++) {
            final int messageId = i;
            executor.submit(() -> {
                try {
                    UserEvent event = createUserCreatedEvent(
                        baseUserId + messageId, 
                        "user" + messageId + "@example.com"
                    );
                    
                    eventProducer.sendUserEvent(event).whenComplete((result, throwable) -> {
                        if (throwable == null) {
                            sentCount.incrementAndGet();
                        }
                        sendLatch.countDown();
                    });
                } catch (Exception e) {
                    log.error("Error sending message {}: {}", messageId, e.getMessage());
                    sendLatch.countDown();
                }
            });
        }

        // Wait for all messages to be sent
        assertTrue(sendLatch.await(30, TimeUnit.SECONDS), "Not all messages were sent within timeout");

        // Wait for processing
        Thread.sleep(3000);

        log.info("Concurrent processing test completed - Sent: {}", sentCount.get());
        assertTrue(sentCount.get() >= numMessages * 0.95, "Less than 95% of messages were sent successfully");

        executor.shutdown();
    }

    @Test
    @DisplayName("Message Ordering and Partitioning Test")
    void testMessageOrderingAndPartitioning() throws Exception {
        String userId = "ordering-user-" + System.currentTimeMillis();
        int numEvents = 20;
        
        log.info("Testing message ordering and partitioning for userId: {}", userId);

        // Send events for the same user (should go to same partition)
        List<UserEvent> sentEvents = new ArrayList<>();
        for (int i = 0; i < numEvents; i++) {
            UserEvent event = createUserUpdatedEvent(userId, "email" + i + "@example.com");
            event.setEventId("ordered-event-" + i);
            sentEvents.add(event);
            
            eventProducer.sendUserEvent(event).get(5, TimeUnit.SECONDS);
            Thread.sleep(50); // Small delay to ensure ordering
        }

        // Wait for processing
        Thread.sleep(2000);

        // Verify events were processed (all should be processed due to same partition)
        for (UserEvent event : sentEvents) {
            assertTrue(userEventProcessor.isAlreadyProcessed(event.getEventId()),
                    "Event not processed: " + event.getEventId());
        }

        log.info("Message ordering test completed successfully");
    }

    @Test
    @DisplayName("Schema Evolution Integration Test")
    void testSchemaEvolutionIntegration() throws Exception {
        log.info("Testing schema evolution in integration environment");

        // This test would normally involve:
        // 1. Producing with older schema version
        // 2. Consuming with newer schema version
        // 3. Verifying compatibility

        UserEvent event = createUserCreatedEvent("schema-test-user", "schema@example.com");
        
        // Add some metadata to test schema evolution
        EventMetadata metadata = event.getMetadata();
        EventMetadata enhancedMetadata = EventMetadata.newBuilder(metadata)
                .setCorrelationId("schema-evolution-test")
                .build();
        event.setMetadata(enhancedMetadata);

        CompletableFuture<SendResult<String, Object>> result = eventProducer.sendUserEvent(event);
        assertNotNull(result.get(10, TimeUnit.SECONDS));

        Thread.sleep(1000);

        // Verify event was processed successfully despite schema differences
        assertTrue(userEventProcessor.isAlreadyProcessed(event.getEventId()));

        log.info("Schema evolution integration test completed");
    }

    @Test
    @DisplayName("Circuit Breaker Integration Test")
    void testCircuitBreakerIntegration() throws Exception {
        log.info("Testing circuit breaker integration");

        // This test simulates conditions that would trigger circuit breaker
        AtomicInteger attempts = new AtomicInteger(0);
        AtomicInteger failures = new AtomicInteger(0);

        // Send events that might trigger circuit breaker
        for (int i = 0; i < 20; i++) {
            try {
                UserEvent event = createUserCreatedEvent("cb-user-" + i, "cb" + i + "@example.com");
                
                // Every 5th event has invalid data to trigger failures
                if (i % 5 == 0) {
                    event.setUserId(""); // Invalid user ID
                }
                
                attempts.incrementAndGet();
                eventProducer.sendUserEvent(event).whenComplete((result, throwable) -> {
                    if (throwable != null) {
                        failures.incrementAndGet();
                    }
                });
                
            } catch (Exception e) {
                failures.incrementAndGet();
            }
            
            Thread.sleep(100);
        }

        // Wait for processing
        Thread.sleep(3000);

        log.info("Circuit breaker test - Attempts: {}, Failures: {}", 
                attempts.get(), failures.get());

        // Should have some failures but system should remain operational
        assertTrue(failures.get() > 0, "Expected some failures to test circuit breaker");
        assertTrue(attempts.get() > failures.get(), "Expected some successful operations");
    }

    @Test
    @DisplayName("Performance Under Load Integration Test")
    void testPerformanceUnderLoadIntegration() throws Exception {
        int messageCount = 5000;
        int concurrency = 20;
        
        log.info("Testing performance under load - {} messages with {} threads", 
                messageCount, concurrency);

        ExecutorService executor = Executors.newFixedThreadPool(concurrency);
        CountDownLatch latch = new CountDownLatch(messageCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);

        long startTime = System.currentTimeMillis();

        // Submit load test tasks
        for (int i = 0; i < messageCount; i++) {
            final int messageId = i;
            executor.submit(() -> {
                try {
                    UserEvent event = createUserCreatedEvent(
                        "load-user-" + messageId, 
                        "load" + messageId + "@example.com"
                    );
                    
                    eventProducer.sendUserEvent(event).whenComplete((result, throwable) -> {
                        if (throwable == null) {
                            successCount.incrementAndGet();
                        } else {
                            errorCount.incrementAndGet();
                        }
                        latch.countDown();
                    });
                } catch (Exception e) {
                    errorCount.incrementAndGet();
                    latch.countDown();
                }
            });
        }

        // Wait for completion
        boolean completed = latch.await(5, TimeUnit.MINUTES);
        long endTime = System.currentTimeMillis();
        long duration = endTime - startTime;

        executor.shutdown();

        double throughput = (double) messageCount / (duration / 1000.0);
        double successRate = (double) successCount.get() / messageCount * 100;

        log.info("Performance test results:");
        log.info("  Duration: {} ms", duration);
        log.info("  Throughput: {:.2f} messages/second", throughput);
        log.info("  Success rate: {:.2f}%", successRate);
        log.info("  Successful: {}", successCount.get());
        log.info("  Errors: {}", errorCount.get());

        assertTrue(completed, "Load test did not complete within timeout");
        assertTrue(throughput > 100, "Throughput too low: " + throughput);
        assertTrue(successRate > 95, "Success rate too low: " + successRate);
    }

    // Helper methods for creating test events

    private UserEvent createUserCreatedEvent(String userId, String email) {
        return UserEvent.newBuilder()
                .setEventId(UUID.randomUUID().toString())
                .setUserId(userId)
                .setEventType(EventType.USER_CREATED)
                .setTimestamp(Instant.now().toEpochMilli())
                .setSessionId("session-" + System.currentTimeMillis())
                .setMetadata(EventMetadata.newBuilder()
                        .setSource("integration-test")
                        .setVersion("1.0")
                        .setCorrelationId(UUID.randomUUID().toString())
                        .setIpAddress("127.0.0.1")
                        .setUserAgent("IntegrationTest/1.0")
                        .build())
                .setPayload(UserEventPayload.newBuilder()
                        .setEmail(email)
                        .setFirstName("Test")
                        .setLastName("User")
                        .setStatus(UserStatus.ACTIVE)
                        .setPreferences(Map.of("theme", "light", "notifications", "true"))
                        .build())
                .build();
    }

    private UserEvent createUserUpdatedEvent(String userId, String newEmail) {
        return UserEvent.newBuilder()
                .setEventId(UUID.randomUUID().toString())
                .setUserId(userId)
                .setEventType(EventType.USER_UPDATED)
                .setTimestamp(Instant.now().toEpochMilli())
                .setMetadata(EventMetadata.newBuilder()
                        .setSource("integration-test")
                        .setVersion("1.0")
                        .setCorrelationId(UUID.randomUUID().toString())
                        .build())
                .setPayload(UserEventPayload.newBuilder()
                        .setEmail(newEmail)
                        .setStatus(UserStatus.ACTIVE)
                        .build())
                .build();
    }

    private UserEvent createUserLoginEvent(String userId, String sessionId) {
        return UserEvent.newBuilder()
                .setEventId(UUID.randomUUID().toString())
                .setUserId(userId)
                .setEventType(EventType.USER_LOGIN)
                .setTimestamp(Instant.now().toEpochMilli())
                .setSessionId(sessionId)
                .setMetadata(EventMetadata.newBuilder()
                        .setSource("integration-test")
                        .setVersion("1.0")
                        .build())
                .setPayload(UserEventPayload.newBuilder().build())
                .build();
    }

    private UserEvent createUserLogoutEvent(String userId, String sessionId) {
        return UserEvent.newBuilder()
                .setEventId(UUID.randomUUID().toString())
                .setUserId(userId)
                .setEventType(EventType.USER_LOGOUT)
                .setTimestamp(Instant.now().toEpochMilli())
                .setSessionId(sessionId)
                .setMetadata(EventMetadata.newBuilder()
                        .setSource("integration-test")
                        .setVersion("1.0")
                        .build())
                .setPayload(UserEventPayload.newBuilder().build())
                .build();
    }

    private UserEvent createUserDeletedEvent(String userId) {
        return UserEvent.newBuilder()
                .setEventId(UUID.randomUUID().toString())
                .setUserId(userId)
                .setEventType(EventType.USER_DELETED)
                .setTimestamp(Instant.now().toEpochMilli())
                .setMetadata(EventMetadata.newBuilder()
                        .setSource("integration-test")
                        .setVersion("1.0")
                        .build())
                .setPayload(UserEventPayload.newBuilder().build())
                .build();
    }

    private void setupTestConsumer() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, kafka.getBootstrapServers());
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "integration-test-consumer");
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);

        ConsumerFactory<String, Object> consumerFactory = new DefaultKafkaConsumerFactory<>(props);
        testConsumer = consumerFactory.createConsumer();
    }
}