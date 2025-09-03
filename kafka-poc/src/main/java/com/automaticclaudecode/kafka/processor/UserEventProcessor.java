package com.automaticclaudecode.kafka.processor;

import com.automaticclaudecode.kafka.avro.UserEvent;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * User event processor with idempotency checks and business logic
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserEventProcessor {

    private final StringRedisTemplate redisTemplate;
    private final MeterRegistry meterRegistry;
    
    private Counter userCreatedCounter;
    private Counter userUpdatedCounter;
    private Counter userDeletedCounter;
    private Counter loginCounter;
    private Counter logoutCounter;
    private Timer businessLogicTimer;

    private static final String PROCESSED_EVENTS_KEY_PREFIX = "processed:user:";
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);

    @PostConstruct
    public void initMetrics() {
        userCreatedCounter = Counter.builder("user.events.created")
            .description("Number of user created events processed")
            .register(meterRegistry);
        
        userUpdatedCounter = Counter.builder("user.events.updated")
            .description("Number of user updated events processed")
            .register(meterRegistry);
        
        userDeletedCounter = Counter.builder("user.events.deleted")
            .description("Number of user deleted events processed")
            .register(meterRegistry);
        
        loginCounter = Counter.builder("user.events.login")
            .description("Number of user login events processed")
            .register(meterRegistry);
        
        logoutCounter = Counter.builder("user.events.logout")
            .description("Number of user logout events processed")
            .register(meterRegistry);
        
        businessLogicTimer = Timer.builder("user.events.business_logic_time")
            .description("Time taken to execute business logic")
            .register(meterRegistry);
    }

    /**
     * Check if event has already been processed (idempotency)
     */
    public boolean isAlreadyProcessed(String eventId) {
        String key = PROCESSED_EVENTS_KEY_PREFIX + eventId;
        Boolean exists = redisTemplate.hasKey(key);
        return exists != null && exists;
    }

    /**
     * Mark event as processed
     */
    public void markAsProcessed(String eventId) {
        String key = PROCESSED_EVENTS_KEY_PREFIX + eventId;
        redisTemplate.opsForValue().set(key, "true", IDEMPOTENCY_TTL);
    }

    /**
     * Handle user created event
     */
    public void handleUserCreated(UserEvent userEvent, String correlationId) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.info("Processing user created event: userId={}, eventId={}, correlationId={}", 
                userEvent.getUserId(), userEvent.getEventId(), correlationId);

            // Business logic for user creation
            validateUserPayload(userEvent);
            
            // Simulate database operations
            createUserProfile(userEvent);
            
            // Trigger downstream events
            sendWelcomeEmail(userEvent);
            createDefaultPreferences(userEvent);
            
            userCreatedCounter.increment();
            
            log.info("User created event processed successfully: userId={}, eventId={}", 
                userEvent.getUserId(), userEvent.getEventId());

        } catch (Exception e) {
            log.error("Failed to process user created event: userId={}, eventId={}, error={}", 
                userEvent.getUserId(), userEvent.getEventId(), e.getMessage(), e);
            throw e;
        } finally {
            sample.stop(businessLogicTimer);
        }
    }

    /**
     * Handle user updated event
     */
    public void handleUserUpdated(UserEvent userEvent, String correlationId) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.info("Processing user updated event: userId={}, eventId={}, correlationId={}", 
                userEvent.getUserId(), userEvent.getEventId(), correlationId);

            // Business logic for user update
            validateUserExists(userEvent.getUserId());
            updateUserProfile(userEvent);
            
            // Handle specific updates
            if (userEvent.getPayload() != null && userEvent.getPayload().getEmail() != null) {
                sendEmailVerification(userEvent);
            }
            
            userUpdatedCounter.increment();
            
            log.info("User updated event processed successfully: userId={}, eventId={}", 
                userEvent.getUserId(), userEvent.getEventId());

        } catch (Exception e) {
            log.error("Failed to process user updated event: userId={}, eventId={}, error={}", 
                userEvent.getUserId(), userEvent.getEventId(), e.getMessage(), e);
            throw e;
        } finally {
            sample.stop(businessLogicTimer);
        }
    }

    /**
     * Handle user deleted event
     */
    public void handleUserDeleted(UserEvent userEvent, String correlationId) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.info("Processing user deleted event: userId={}, eventId={}, correlationId={}", 
                userEvent.getUserId(), userEvent.getEventId(), correlationId);

            // Business logic for user deletion
            validateUserExists(userEvent.getUserId());
            
            // Soft delete or hard delete based on business rules
            softDeleteUser(userEvent);
            
            // Cleanup related data
            anonymizeUserData(userEvent);
            cancelActiveSubscriptions(userEvent);
            
            userDeletedCounter.increment();
            
            log.info("User deleted event processed successfully: userId={}, eventId={}", 
                userEvent.getUserId(), userEvent.getEventId());

        } catch (Exception e) {
            log.error("Failed to process user deleted event: userId={}, eventId={}, error={}", 
                userEvent.getUserId(), userEvent.getEventId(), e.getMessage(), e);
            throw e;
        } finally {
            sample.stop(businessLogicTimer);
        }
    }

    /**
     * Handle user login event
     */
    public void handleUserLogin(UserEvent userEvent, String correlationId) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.info("Processing user login event: userId={}, eventId={}, correlationId={}, sessionId={}", 
                userEvent.getUserId(), userEvent.getEventId(), correlationId, userEvent.getSessionId());

            // Business logic for login
            validateUserExists(userEvent.getUserId());
            
            // Track login analytics
            recordLoginAttempt(userEvent);
            updateLastLoginTime(userEvent);
            
            // Security checks
            checkSuspiciousActivity(userEvent);
            
            loginCounter.increment();
            
            log.info("User login event processed successfully: userId={}, eventId={}", 
                userEvent.getUserId(), userEvent.getEventId());

        } catch (Exception e) {
            log.error("Failed to process user login event: userId={}, eventId={}, error={}", 
                userEvent.getUserId(), userEvent.getEventId(), e.getMessage(), e);
            throw e;
        } finally {
            sample.stop(businessLogicTimer);
        }
    }

    /**
     * Handle user logout event
     */
    public void handleUserLogout(UserEvent userEvent, String correlationId) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            log.info("Processing user logout event: userId={}, eventId={}, correlationId={}, sessionId={}", 
                userEvent.getUserId(), userEvent.getEventId(), correlationId, userEvent.getSessionId());

            // Business logic for logout
            validateUserExists(userEvent.getUserId());
            
            // Clean up session data
            invalidateSession(userEvent);
            updateLastActivityTime(userEvent);
            
            logoutCounter.increment();
            
            log.info("User logout event processed successfully: userId={}, eventId={}", 
                userEvent.getUserId(), userEvent.getEventId());

        } catch (Exception e) {
            log.error("Failed to process user logout event: userId={}, eventId={}, error={}", 
                userEvent.getUserId(), userEvent.getEventId(), e.getMessage(), e);
            throw e;
        } finally {
            sample.stop(businessLogicTimer);
        }
    }

    // Private helper methods for business logic

    private void validateUserPayload(UserEvent userEvent) {
        if (userEvent.getPayload() == null) {
            throw new IllegalArgumentException("User payload is required for user creation");
        }
        
        if (userEvent.getPayload().getEmail() == null || userEvent.getPayload().getEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Email is required for user creation");
        }
        
        // Additional validation logic
        log.debug("User payload validated successfully: userId={}", userEvent.getUserId());
    }

    private void validateUserExists(String userId) {
        // Simulate user existence check
        log.debug("Validating user exists: userId={}", userId);
        // In real implementation, check database or cache
    }

    private void createUserProfile(UserEvent userEvent) {
        // Simulate user profile creation
        log.debug("Creating user profile: userId={}", userEvent.getUserId());
        simulateProcessingDelay(50);
    }

    private void updateUserProfile(UserEvent userEvent) {
        // Simulate user profile update
        log.debug("Updating user profile: userId={}", userEvent.getUserId());
        simulateProcessingDelay(30);
    }

    private void softDeleteUser(UserEvent userEvent) {
        // Simulate soft delete
        log.debug("Soft deleting user: userId={}", userEvent.getUserId());
        simulateProcessingDelay(40);
    }

    private void sendWelcomeEmail(UserEvent userEvent) {
        // Simulate sending welcome email
        log.debug("Sending welcome email: userId={}", userEvent.getUserId());
        simulateProcessingDelay(20);
    }

    private void sendEmailVerification(UserEvent userEvent) {
        // Simulate sending email verification
        log.debug("Sending email verification: userId={}", userEvent.getUserId());
        simulateProcessingDelay(25);
    }

    private void createDefaultPreferences(UserEvent userEvent) {
        // Simulate creating default preferences
        log.debug("Creating default preferences: userId={}", userEvent.getUserId());
        simulateProcessingDelay(15);
    }

    private void anonymizeUserData(UserEvent userEvent) {
        // Simulate data anonymization
        log.debug("Anonymizing user data: userId={}", userEvent.getUserId());
        simulateProcessingDelay(60);
    }

    private void cancelActiveSubscriptions(UserEvent userEvent) {
        // Simulate canceling subscriptions
        log.debug("Canceling active subscriptions: userId={}", userEvent.getUserId());
        simulateProcessingDelay(35);
    }

    private void recordLoginAttempt(UserEvent userEvent) {
        // Simulate recording login attempt
        log.debug("Recording login attempt: userId={}", userEvent.getUserId());
        simulateProcessingDelay(10);
    }

    private void updateLastLoginTime(UserEvent userEvent) {
        // Simulate updating last login time
        log.debug("Updating last login time: userId={}", userEvent.getUserId());
        simulateProcessingDelay(15);
    }

    private void checkSuspiciousActivity(UserEvent userEvent) {
        // Simulate security checks
        log.debug("Checking for suspicious activity: userId={}", userEvent.getUserId());
        simulateProcessingDelay(25);
    }

    private void invalidateSession(UserEvent userEvent) {
        // Simulate session invalidation
        log.debug("Invalidating session: userId={}, sessionId={}", 
            userEvent.getUserId(), userEvent.getSessionId());
        simulateProcessingDelay(20);
    }

    private void updateLastActivityTime(UserEvent userEvent) {
        // Simulate updating last activity time
        log.debug("Updating last activity time: userId={}", userEvent.getUserId());
        simulateProcessingDelay(10);
    }

    private void simulateProcessingDelay(long milliseconds) {
        try {
            TimeUnit.MILLISECONDS.sleep(milliseconds);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Processing interrupted", e);
        }
    }
}