#!/usr/bin/env node
import { copyFile, readdir, stat } from 'fs/promises';
import { dirname, join, basename } from 'path';
import { existsSync } from 'fs';
import { databaseConfig, validateConfig } from './config';

async function restoreBackup(backupPath?: string) {
  try {
    console.log('🔄 Starting database restore...');
    
    // Validate configuration
    validateConfig(databaseConfig);
    
    if (databaseConfig.type === 'sqlite' && databaseConfig.sqlite) {
      const dbPath = databaseConfig.sqlite.filename;
      const backupDir = join(dirname(dbPath), 'backups');
      
      let actualBackupPath: string;
      
      if (backupPath) {
        // Use specified backup path
        if (existsSync(backupPath)) {
          actualBackupPath = backupPath;
        } else if (existsSync(join(backupDir, backupPath))) {
          actualBackupPath = join(backupDir, backupPath);
        } else {
          throw new Error(`Backup file not found: ${backupPath}`);
        }
      } else {
        // Use most recent backup
        if (!existsSync(backupDir)) {
          throw new Error('No backup directory found');
        }
        
        const files = await readdir(backupDir);
        const backups = files
          .filter(file => file.endsWith('.db'))
          .map(file => join(backupDir, file));
        
        if (backups.length === 0) {
          throw new Error('No backup files found');
        }
        
        // Get most recent backup
        let mostRecent = backups[0];
        let mostRecentTime = (await stat(mostRecent)).mtime;
        
        for (const backup of backups) {
          const backupTime = (await stat(backup)).mtime;
          if (backupTime > mostRecentTime) {
            mostRecent = backup;
            mostRecentTime = backupTime;
          }
        }
        
        actualBackupPath = mostRecent;
      }
      
      console.log(`📁 Using backup: ${basename(actualBackupPath)}`);
      
      // Create backup of current database before restore
      if (existsSync(dbPath)) {
        const currentBackupPath = `${dbPath}.pre-restore-backup`;
        await copyFile(dbPath, currentBackupPath);
        console.log(`💾 Current database backed up to: ${basename(currentBackupPath)}`);
      }
      
      // Restore backup
      await copyFile(actualBackupPath, dbPath);
      console.log(`📄 Database restored from: ${basename(actualBackupPath)}`);
      
      // Restore WAL file if it exists
      const walBackupPath = `${actualBackupPath}-wal`;
      const walPath = `${dbPath}-wal`;
      
      if (existsSync(walBackupPath)) {
        await copyFile(walBackupPath, walPath);
        console.log(`📄 WAL file restored from: ${basename(walBackupPath)}`);
      }
      
      // Get restored database size
      const stats = await stat(dbPath);
      const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`✅ Restore completed successfully`);
      console.log(`📊 Restored database size: ${sizeInMB} MB`);
      
    } else if (databaseConfig.type === 'postgresql') {
      console.log('🐘 PostgreSQL restore not implemented');
      console.log('   Please use pg_restore to restore your PostgreSQL database');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

async function listAvailableBackups() {
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
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith('.db')) {
          const backupPath = join(backupDir, file);
          const stats = await stat(backupPath);
          backups.push({
            name: file,
            path: backupPath,
            size: stats.size,
            created: stats.mtime
          });
        }
      }
      
      // Sort by creation date (newest first)
      backups.sort((a, b) => b.created.getTime() - a.created.getTime());
      
      console.log(`📊 Found ${backups.length} available backups:`);
      backups.forEach((backup, index) => {
        const sizeInMB = (backup.size / 1024 / 1024).toFixed(2);
        const date = backup.created.toISOString();
        const marker = index === 0 ? '👑' : '  ';
        console.log(`${marker} ${backup.name} (${sizeInMB} MB, ${date})`);
      });
      
      return backups;
    }
    
  } catch (error) {
    console.error('❌ Failed to list backups:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Run restore if this script is executed directly
if (require.main === module) {
  if (command === 'list' || command === 'ls') {
    listAvailableBackups();
  } else {
    const backupPath = args[0];
    restoreBackup(backupPath);
  }
}

export { restoreBackup, listAvailableBackups };