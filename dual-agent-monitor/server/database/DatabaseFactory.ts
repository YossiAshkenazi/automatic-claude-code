import { DatabaseService } from './DatabaseService';
import { InMemoryDatabaseService } from './InMemoryDatabaseService';
import { PostgresDatabaseService } from './PostgresDatabaseService';
import { databaseConfig, validateConfig } from './config';

export type DatabaseInstance = DatabaseService | InMemoryDatabaseService | PostgresDatabaseService;

export class DatabaseFactory {
  static create(): DatabaseInstance {
    // Validate configuration
    validateConfig(databaseConfig);
    
    console.log(`Creating database service with type: ${databaseConfig.type}`);
    
    switch (databaseConfig.type) {
      case 'postgresql':
        if (!databaseConfig.postgresql) {
          throw new Error('PostgreSQL configuration is missing');
        }
        
        return new PostgresDatabaseService({
          host: databaseConfig.postgresql.host,
          port: databaseConfig.postgresql.port,
          database: databaseConfig.postgresql.database,
          username: databaseConfig.postgresql.username,
          password: databaseConfig.postgresql.password,
          ssl: databaseConfig.postgresql.ssl,
          maxConnections: databaseConfig.postgresql.maxConnections
        });
      
      case 'sqlite':
        if (!databaseConfig.sqlite) {
          throw new Error('SQLite configuration is missing');
        }
        
        return new DatabaseService(databaseConfig.sqlite.filename);
      
      default:
        console.warn('Unknown database type, falling back to in-memory database');
        return new InMemoryDatabaseService();
    }
  }
  
  static async testConnection(): Promise<{ healthy: boolean; details: any }> {
    try {
      const db = DatabaseFactory.create();
      
      if ('getHealthCheck' in db) {
        return await db.getHealthCheck();
      }
      
      if ('checkDatabaseHealth' in db && typeof db.checkDatabaseHealth === 'function') {
        return db.checkDatabaseHealth();
      }
      
      // Fallback for InMemoryDatabaseService
      return {
        healthy: true,
        details: {
          connected: true,
          type: 'in-memory'
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          connected: false,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}