#!/usr/bin/env node
import { unlink, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { databaseConfig, validateConfig } from './config';
import { runMigrations } from './migrate';
import { seedDatabase } from './seed';

async function resetDatabase(options: { seed?: boolean } = {}) {
  try {
    console.log('🗑️  Starting database reset...');
    
    // Validate configuration
    validateConfig(databaseConfig);
    
    if (databaseConfig.type === 'sqlite' && databaseConfig.sqlite) {
      const dbPath = resolve(databaseConfig.sqlite.filename);
      
      // Remove existing database file
      if (existsSync(dbPath)) {
        await unlink(dbPath);
        console.log(`🗄️  Deleted existing database: ${dbPath}`);
      }
      
      // Remove WAL and SHM files if they exist
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;
      
      if (existsSync(walPath)) {
        await unlink(walPath);
        console.log(`🗄️  Deleted WAL file: ${walPath}`);
      }
      
      if (existsSync(shmPath)) {
        await unlink(shmPath);
        console.log(`🗄️  Deleted SHM file: ${shmPath}`);
      }
      
      // Ensure directory exists
      await mkdir(dirname(dbPath), { recursive: true });
      
      // Run migrations to create fresh database
      await runMigrations();
      
      // Seed database if requested
      if (options.seed) {
        await seedDatabase();
      }
      
      console.log('✅ Database reset completed successfully');
      
    } else if (databaseConfig.type === 'postgresql') {
      console.log('🐘 PostgreSQL reset not implemented');
      console.log('   Please reset your PostgreSQL database manually');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const shouldSeed = args.includes('--seed') || args.includes('-s');

// Run reset if this script is executed directly
if (require.main === module) {
  resetDatabase({ seed: shouldSeed });
}

export { resetDatabase };