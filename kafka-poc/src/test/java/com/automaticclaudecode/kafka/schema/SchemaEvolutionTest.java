package com.automaticclaudecode.kafka.schema;

import io.confluent.kafka.schemaregistry.client.MockSchemaRegistryClient;
import io.confluent.kafka.schemaregistry.client.SchemaRegistryClient;
import io.confluent.kafka.serializers.KafkaAvroDeserializer;
import io.confluent.kafka.serializers.KafkaAvroSerializer;
import org.apache.avro.Schema;
import org.apache.avro.generic.GenericData;
import org.apache.avro.generic.GenericRecord;
import org.apache.avro.specific.SpecificData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive schema evolution testing for Avro compatibility
 * Tests backward, forward, and full compatibility scenarios
 */
@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Schema Evolution Compatibility Tests")
public class SchemaEvolutionTest {

    private SchemaRegistryClient schemaRegistry;
    private KafkaAvroSerializer serializer;
    private KafkaAvroDeserializer deserializer;

    private Schema userEventV1Schema;
    private Schema userEventV2Schema;

    private static final String TOPIC_NAME = "user-events";
    private static final String SCHEMA_REGISTRY_URL = "mock://localhost:8081";

    @BeforeEach
    void setUp() throws IOException {
        // Initialize mock schema registry
        schemaRegistry = new MockSchemaRegistryClient();
        
        // Load schemas
        userEventV1Schema = loadSchema("/avro/UserEvent.avsc");
        userEventV2Schema = loadSchema("/avro/UserEvent-v2.avsc");
        
        // Setup serializer and deserializer
        setupSerializationComponents();
        
        // Register schemas in registry
        registerSchemas();
    }

    @Test
    @DisplayName("Test backward compatibility - V2 consumer can read V1 data")
    void testBackwardCompatibility() throws Exception {
        // Create V1 record (old producer)
        GenericRecord v1Record = createUserEventV1();
        
        // Serialize with V1 schema
        byte[] serializedData = serializeWithSchema(v1Record, userEventV1Schema);
        
        // Deserialize with V2 schema (new consumer)
        GenericRecord deserializedRecord = deserializeWithSchema(serializedData, userEventV2Schema);
        
        // Verify core fields are preserved
        assertEquals(v1Record.get("eventId"), deserializedRecord.get("eventId"));
        assertEquals(v1Record.get("userId"), deserializedRecord.get("userId"));
        assertEquals(v1Record.get("eventType"), deserializedRecord.get("eventType"));
        assertEquals(v1Record.get("timestamp"), deserializedRecord.get("timestamp"));
        
        // Verify new fields have default values
        assertNull(deserializedRecord.get("previousValues"));
        assertNull(deserializedRecord.get("changeReason"));
        assertEquals("test-value-v2", deserializedRecord.get("schemaEvolutionTest"));
        
        // Verify nested metadata enhancements
        GenericRecord metadata = (GenericRecord) deserializedRecord.get("metadata");
        assertNull(metadata.get("deviceId")); // New field with null default
        assertNull(metadata.get("requestId"));
        assertNull(metadata.get("region"));
        
        System.out.println("✅ Backward compatibility test passed");
    }

    @Test
    @DisplayName("Test forward compatibility - V1 consumer can read V2 data")
    void testForwardCompatibility() throws Exception {
        // Create V2 record (new producer)
        GenericRecord v2Record = createUserEventV2();
        
        // Serialize with V2 schema
        byte[] serializedData = serializeWithSchema(v2Record, userEventV2Schema);
        
        // Deserialize with V1 schema (old consumer)
        GenericRecord deserializedRecord = deserializeWithSchema(serializedData, userEventV1Schema);
        
        // Verify core fields are preserved
        assertEquals(v2Record.get("eventId"), deserializedRecord.get("eventId"));
        assertEquals(v2Record.get("userId"), deserializedRecord.get("userId"));
        assertEquals(v2Record.get("eventType"), deserializedRecord.get("eventType"));
        assertEquals(v2Record.get("timestamp"), deserializedRecord.get("timestamp"));
        
        // Verify old consumer ignores new fields
        assertThrows(org.apache.avro.AvroRuntimeException.class, () -> {
            deserializedRecord.get("previousValues");
        });
        
        // Verify nested metadata backward compatibility
        GenericRecord metadata = (GenericRecord) deserializedRecord.get("metadata");
        assertEquals(v2Record.get("metadata").toString().contains("source"), 
                    metadata.toString().contains("source"));
        
        System.out.println("✅ Forward compatibility test passed");
    }

    @Test
    @DisplayName("Test enum evolution compatibility")
    void testEnumEvolution() throws Exception {
        // Create V2 record with new enum value
        GenericRecord v2Record = createUserEventV2();
        GenericData.EnumSymbol newEventType = new GenericData.EnumSymbol(
            userEventV2Schema.getField("eventType").schema(), "USER_PASSWORD_CHANGED");
        v2Record.put("eventType", newEventType);
        
        // Serialize with V2 schema
        byte[] serializedData = serializeWithSchema(v2Record, userEventV2Schema);
        
        // This should fail with V1 consumer as it doesn't know the new enum value
        assertThrows(Exception.class, () -> {
            deserializeWithSchema(serializedData, userEventV1Schema);
        });
        
        // But V2 consumer should handle it fine
        GenericRecord deserializedV2 = deserializeWithSchema(serializedData, userEventV2Schema);
        assertEquals("USER_PASSWORD_CHANGED", deserializedV2.get("eventType").toString());
        
        System.out.println("✅ Enum evolution test passed");
    }

    @Test
    @DisplayName("Test complex nested field evolution")
    void testNestedFieldEvolution() throws Exception {
        // Create V2 record with complex nested fields
        GenericRecord v2Record = createUserEventV2WithComplexPayload();
        
        // Serialize and deserialize with V2
        byte[] serializedData = serializeWithSchema(v2Record, userEventV2Schema);
        GenericRecord deserializedV2 = deserializeWithSchema(serializedData, userEventV2Schema);
        
        // Verify complex nested structure
        GenericRecord payload = (GenericRecord) deserializedV2.get("payload");
        assertNotNull(payload);
        
        GenericRecord securitySettings = (GenericRecord) payload.get("securitySettings");
        assertNotNull(securitySettings);
        assertTrue((Boolean) securitySettings.get("twoFactorEnabled"));
        assertEquals("STRONG", securitySettings.get("passwordStrength").toString());
        
        // Test backward compatibility with complex nested fields
        GenericRecord deserializedV1 = deserializeWithSchema(serializedData, userEventV1Schema);
        GenericRecord v1Payload = (GenericRecord) deserializedV1.get("payload");
        assertNotNull(v1Payload);
        
        // V1 should still have basic payload fields
        assertNotNull(v1Payload.get("email"));
        assertNotNull(v1Payload.get("firstName"));
        
        System.out.println("✅ Complex nested field evolution test passed");
    }

    @Test
    @DisplayName("Test schema registry compatibility levels")
    void testSchemaRegistryCompatibility() throws Exception {
        String subject = TOPIC_NAME + "-value";
        
        // Register V1 as version 1
        int v1Id = schemaRegistry.register(subject, userEventV1Schema);
        
        // Try to register V2 as version 2 (should succeed for backward compatibility)
        int v2Id = schemaRegistry.register(subject, userEventV2Schema);
        
        assertNotEquals(v1Id, v2Id);
        
        // Verify both versions are retrievable
        Schema retrievedV1 = schemaRegistry.getById(v1Id);
        Schema retrievedV2 = schemaRegistry.getById(v2Id);
        
        assertEquals(userEventV1Schema.toString(), retrievedV1.toString());
        assertEquals(userEventV2Schema.toString(), retrievedV2.toString());
        
        System.out.println("✅ Schema registry compatibility test passed");
    }

    @Test
    @DisplayName("Test schema evolution performance impact")
    void testPerformanceImpact() throws Exception {
        int iterations = 1000;
        
        // Test V1 serialization/deserialization performance
        long v1StartTime = System.currentTimeMillis();
        for (int i = 0; i < iterations; i++) {
            GenericRecord v1Record = createUserEventV1();
            byte[] serialized = serializeWithSchema(v1Record, userEventV1Schema);
            deserializeWithSchema(serialized, userEventV1Schema);
        }
        long v1Duration = System.currentTimeMillis() - v1StartTime;
        
        // Test V2 serialization/deserialization performance
        long v2StartTime = System.currentTimeMillis();
        for (int i = 0; i < iterations; i++) {
            GenericRecord v2Record = createUserEventV2();
            byte[] serialized = serializeWithSchema(v2Record, userEventV2Schema);
            deserializeWithSchema(serialized, userEventV2Schema);
        }
        long v2Duration = System.currentTimeMillis() - v2StartTime;
        
        System.out.printf("V1 Performance: %d ms for %d iterations (%.2f ms/op)%n", 
                         v1Duration, iterations, (double) v1Duration / iterations);
        System.out.printf("V2 Performance: %d ms for %d iterations (%.2f ms/op)%n", 
                         v2Duration, iterations, (double) v2Duration / iterations);
        
        // V2 should not be more than 50% slower than V1
        double performanceRatio = (double) v2Duration / v1Duration;
        assertTrue(performanceRatio < 1.5, 
                  "V2 schema performance degradation is too high: " + performanceRatio);
        
        System.out.println("✅ Performance impact test passed");
    }

    // Helper methods

    private void setupSerializationComponents() {
        Map<String, Object> props = new HashMap<>();
        props.put("schema.registry.url", SCHEMA_REGISTRY_URL);
        props.put("specific.avro.reader", false);
        props.put("auto.register.schemas", false);
        
        serializer = new KafkaAvroSerializer(schemaRegistry);
        serializer.configure(props, false);
        
        deserializer = new KafkaAvroDeserializer(schemaRegistry);
        deserializer.configure(props, false);
    }

    private void registerSchemas() throws Exception {
        String subject = TOPIC_NAME + "-value";
        schemaRegistry.register(subject, userEventV1Schema);
    }

    private Schema loadSchema(String resourcePath) throws IOException {
        String schemaContent = new String(
            getClass().getResourceAsStream(resourcePath).readAllBytes());
        return new Schema.Parser().parse(schemaContent);
    }

    private byte[] serializeWithSchema(GenericRecord record, Schema schema) {
        return serializer.serialize(TOPIC_NAME, record);
    }

    private GenericRecord deserializeWithSchema(byte[] data, Schema readerSchema) {
        return (GenericRecord) deserializer.deserialize(TOPIC_NAME, data, readerSchema);
    }

    private GenericRecord createUserEventV1() {
        GenericRecord record = new GenericData.Record(userEventV1Schema);
        record.put("eventId", "evt-001");
        record.put("userId", "user-123");
        record.put("eventType", new GenericData.EnumSymbol(
            userEventV1Schema.getField("eventType").schema(), "USER_CREATED"));
        record.put("timestamp", System.currentTimeMillis());
        record.put("sessionId", "session-456");
        
        // Create metadata
        GenericRecord metadata = new GenericData.Record(
            userEventV1Schema.getField("metadata").schema());
        metadata.put("source", "user-service");
        metadata.put("version", "1.0");
        metadata.put("correlationId", "corr-789");
        metadata.put("ipAddress", "192.168.1.1");
        metadata.put("userAgent", "Mozilla/5.0");
        record.put("metadata", metadata);
        
        // Create payload
        GenericRecord payload = new GenericData.Record(
            userEventV1Schema.getField("payload").schema());
        payload.put("email", "user@example.com");
        payload.put("firstName", "John");
        payload.put("lastName", "Doe");
        payload.put("status", new GenericData.EnumSymbol(
            payload.getSchema().getField("status").schema().getTypes().get(1), "ACTIVE"));
        record.put("payload", payload);
        
        return record;
    }

    private GenericRecord createUserEventV2() {
        GenericRecord record = new GenericData.Record(userEventV2Schema);
        record.put("eventId", "evt-002");
        record.put("userId", "user-456");
        record.put("eventType", new GenericData.EnumSymbol(
            userEventV2Schema.getField("eventType").schema(), "USER_UPDATED"));
        record.put("timestamp", System.currentTimeMillis());
        record.put("sessionId", "session-789");
        
        // Enhanced metadata
        GenericRecord metadata = new GenericData.Record(
            userEventV2Schema.getField("metadata").schema());
        metadata.put("source", "user-service-v2");
        metadata.put("version", "2.0");
        metadata.put("correlationId", "corr-101");
        metadata.put("deviceId", "device-123");
        metadata.put("requestId", "req-456");
        metadata.put("region", "us-east-1");
        record.put("metadata", metadata);
        
        // Enhanced payload
        GenericRecord payload = new GenericData.Record(
            userEventV2Schema.getField("payload").schema());
        payload.put("email", "user2@example.com");
        payload.put("firstName", "Jane");
        payload.put("phoneNumber", "+1234567890");
        payload.put("accountTier", new GenericData.EnumSymbol(
            payload.getSchema().getField("accountTier").schema().getTypes().get(1), "PREMIUM"));
        record.put("payload", payload);
        
        // New fields
        record.put("previousValues", Map.of("email", "old@example.com"));
        record.put("changeReason", "User requested email update");
        record.put("schemaEvolutionTest", "custom-test-value");
        
        return record;
    }

    private GenericRecord createUserEventV2WithComplexPayload() {
        GenericRecord record = createUserEventV2();
        
        // Add complex security settings
        GenericRecord payload = (GenericRecord) record.get("payload");
        GenericRecord securitySettings = new GenericData.Record(
            payload.getSchema().getField("securitySettings").schema().getTypes().get(1));
        securitySettings.put("twoFactorEnabled", true);
        securitySettings.put("loginNotifications", true);
        securitySettings.put("passwordStrength", new GenericData.EnumSymbol(
            securitySettings.getSchema().getField("passwordStrength").schema().getTypes().get(1), "STRONG"));
        payload.put("securitySettings", securitySettings);
        
        return record;
    }
}