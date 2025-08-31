#!/usr/bin/env node
import { MigrationManager, initializeDatabase } from './migrations';
import { databaseConfig, validateConfig } from './config';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...');
    
    // Validate configuration
    validateConfig(databaseConfig);
    
    if (databaseConfig.type === 'sqlite' && databaseConfig.sqlite) {
      // Ensure data directory exists for SQLite
      const dbPath = databaseConfig.sqlite.filename;
      await mkdir(dirname(dbPath), { recursive: true });
      console.log(`📁 Ensured database directory exists: ${dirname(dbPath)}`);
      
      // Initialize SQLite database
      const db = await initializeDatabase(dbPath);
      console.log('✅ SQLite database migrations completed successfully');
      db.close();
    } else if (databaseConfig.type === 'postgresql') {
      console.log('🐘 PostgreSQL migrations not yet implemented');
      console.log('   Please run your PostgreSQL schema manually or use a migration tool like knex.js');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };