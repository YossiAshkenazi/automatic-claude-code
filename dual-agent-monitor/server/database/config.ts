import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenvConfig();

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  sqlite?: {
    filename: string;
    enableWAL?: boolean;
  };
  postgresql?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    maxConnections?: number;
  };
}

function getDefaultSqlitePath(): string {
  return join(process.cwd(), 'data', 'dual-agent-monitor.db');
}

export const databaseConfig: DatabaseConfig = {
  type: (process.env.DB_TYPE as 'sqlite' | 'postgresql') || 'sqlite',
  
  sqlite: {
    filename: process.env.SQLITE_FILENAME || getDefaultSqlitePath(),
    enableWAL: process.env.SQLITE_WAL !== 'false'
  },
  
  postgresql: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'dual_agent_monitor',
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.POSTGRES_SSL === 'true',
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20')
  }
};

export function validateConfig(config: DatabaseConfig): void {
  if (config.type === 'postgresql') {
    if (!config.postgresql?.password && process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL password is required in production');
    }
  }
}

export default databaseConfig;