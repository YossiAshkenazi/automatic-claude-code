// Export database services and utilities
export { InMemoryDatabaseService } from './InMemoryDatabaseService';

// For future SQLite implementation
// export { DatabaseService } from './DatabaseService';
// export { MigrationManager, initializeDatabase, checkDatabaseHealth } from './migrations';
// export type { Migration } from './migrations';

// Default database instance (singleton pattern)
let defaultDbInstance: import('./InMemoryDatabaseService').InMemoryDatabaseService | null = null;

/**
 * Get the default database instance
 * Creates a new instance if one doesn't exist
 */
export function getDefaultDatabase(): import('./InMemoryDatabaseService').InMemoryDatabaseService {
  if (!defaultDbInstance) {
    defaultDbInstance = new (require('./InMemoryDatabaseService').InMemoryDatabaseService)();
  }
  return defaultDbInstance!;
}

/**
 * Initialize a new database instance
 * Useful for testing or multiple database connections
 */
export function createDatabaseInstance(): import('./InMemoryDatabaseService').InMemoryDatabaseService {
  const { InMemoryDatabaseService } = require('./InMemoryDatabaseService');
  return new InMemoryDatabaseService();
}

/**
 * Close the default database instance
 */
export function closeDefaultDatabase(): void {
  if (defaultDbInstance) {
    defaultDbInstance.close();
    defaultDbInstance = null;
  }
}

// Re-export types from the main types file for convenience
export type {
  AgentMessage,
  DualAgentSession,
  SessionSummary,
  AgentCommunication,
  SystemEvent,
  PerformanceMetrics
} from '../types';

// Configuration interface for database setup
export interface DatabaseConfig {
  type: 'memory' | 'sqlite' | 'postgresql';
  path?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  maxConnections?: number;
}

// Default configuration
export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  type: 'memory'
};

/**
 * Initialize database with custom configuration
 * Currently supports in-memory only, SQLite/PostgreSQL support can be added later
 */
export async function initializeDatabaseWithConfig(config: DatabaseConfig): Promise<import('./InMemoryDatabaseService').InMemoryDatabaseService> {
  if (config.type !== 'memory') {
    throw new Error(`Database type ${config.type} is not yet supported. Currently only in-memory is supported.`);
  }
  
  return new (require('./InMemoryDatabaseService').InMemoryDatabaseService)();
}

/**
 * Database health check utility
 */
export async function performHealthCheck(db: import('./InMemoryDatabaseService').InMemoryDatabaseService): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
  timestamp: Date;
}> {
  const healthStatus = db.getHealthStatus();
  
  return {
    status: healthStatus.healthy ? 'healthy' : 'unhealthy',
    details: healthStatus.details,
    timestamp: new Date()
  };
}