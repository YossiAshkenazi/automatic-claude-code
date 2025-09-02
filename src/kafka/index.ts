/**
 * Kafka Client Libraries - Main Export
 * 
 * High-performance Kafka client implementation targeting 100K+ messages/second
 * with comprehensive error handling, circuit breakers, and monitoring.
 */

export * from './KafkaClientLibraries';

// Re-export utilities
export * from './utils/SimpleCircuitBreaker';
export * from './utils/SimpleRetryPolicy';
export * from './monitoring/SimpleMetricsCollector';
export * from './patterns/SimpleDeadLetterQueue';

// Default export for convenience
export { default as KafkaClientLibraries } from './KafkaClientLibraries';

// Version and metadata
export const VERSION = '1.0.0';
export const DESCRIPTION = 'High-performance Kafka client libraries for TypeScript/Node.js';
export const TARGET_THROUGHPUT = '100K+ messages/second';

export default {
  VERSION,
  DESCRIPTION,
  TARGET_THROUGHPUT,
};