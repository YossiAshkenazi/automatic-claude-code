#!/usr/bin/env node
import { copyFile, mkdir, readdir, stat } from 'fs/promises';
import { dirname, join, basename } from 'path';
import { existsSync } from 'fs';
import { databaseConfig, validateConfig } from './config';

async function createBackup(backupName?: string) {
  try {
    console.log('💾 Starting database backup...');
    
    // Validate configuration
    validateConfig(databaseConfig);
    
    if (databaseConfig.type === 'sqlite' && databaseConfig.sqlite) {
      const dbPath = databaseConfig.sqlite.filename;
      
      if (!existsSync(dbPath)) {
        throw new Error(`Database file not found: ${dbPath}`);
      }
      
      // Create backup directory
      const backupDir = join(dirname(dbPath), 'backups');
      await mkdir(backupDir, { recursive: true });
      
      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dbName = basename(dbPath, '.db');
      const finalBackupName = backupName || `${dbName}-backup-${timestamp}`;
      const backupPath = join(backupDir, `${finalBackupName}.db`);
      
      // Copy database file
      await copyFile(dbPath, backupPath);
      console.log(`📁 Database backed up to: ${backupPath}`);
      
      // Copy WAL file if it exists (for SQLite WAL mode)
      const walPath = `${dbPath}-wal`;
      if (existsSync(walPath)) {
        await copyFile(walPath, `${backupPath}-wal`);
        console.log(`📁 WAL file backed up to: ${backupPath}-wal`);
      }
      
      // Get backup file size
      const stats = await stat(backupPath);
      const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`✅ Backup completed successfully`);
      console.log(`📊 Backup size: ${sizeInMB} MB`);
      
      return backupPath;
      
    } else if (databaseConfig.type === 'postgresql') {
      console.log('🐘 PostgreSQL backup not implemented');
      console.log('   Please use pg_dump to backup your PostgreSQL database');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

async function listBackups() {
  try {
    validateConfig(databaseConfig);
    
    if (databaseConfig.type === 'sqlite' && databaseConfig.sqlite) {
      const dbPath = databaseConfig.sqlite.filename;
      const backupDir = join(dirname(dbPath), 'backups');
      
      if (!existsSync(backupDir)) {
        console.log('📁 No backup directory found');
        return [];
      }
      
      const files = await readdir(backupDir);
      const backups = files
        .filter(file => file.endsWith('.db'))
        .sort()
        .reverse();
      
      console.log(`📊 Found ${backups.length} backups:`);
      for (const backup of backups) {
        const backupPath = join(backupDir, backup);
        const stats = await stat(backupPath);
        const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
        const date = stats.mtime.toISOString();
        console.log(`  📄 ${backup} (${sizeInMB} MB, ${date})`);
      }
      
      return backups.map(backup => join(backupDir, backup));
    }
    
  } catch (error) {
    console.error('❌ Failed to list backups:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];
const backupName = args[1];

// Run backup if this script is executed directly
if (require.main === module) {
  if (command === 'list' || command === 'ls') {
    listBackups();
  } else {
    createBackup(backupName);
  }
}

export { createBackup, listBackups };