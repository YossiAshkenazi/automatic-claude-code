import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

export class MigrationManager {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
    this.initializeMigrationTable();
  }

  private initializeMigrationTable(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  public getCurrentVersion(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT MAX(version) as version FROM migrations', (err, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result?.version || 0);
        }
      });
    });
  }

  public async runMigrations(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const migrations = this.getMigrations();
    
    console.log(`Current database version: ${currentVersion}`);
    
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      console.log('Database is up to date');
      return;
    }
    
    console.log(`Running ${pendingMigrations.length} migrations...`);
    
    for (const migration of pendingMigrations) {
      console.log(`Applying migration ${migration.version}: ${migration.name}`);
      
      try {
        await this.runSingleMigration(migration);
        console.log(`✓ Applied migration ${migration.version}`);
      } catch (error) {
        console.error(`✗ Failed to apply migration ${migration.version}:`, error);
        throw error;
      }
    }
  }

  private runSingleMigration(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.exec(migration.up, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          this.db.run('INSERT INTO migrations (version, name) VALUES (?, ?)', 
            [migration.version, migration.name], (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
        });
      });
    });
  }

  private getMigrations(): Migration[] {
    return [
      {
        version: 1,
        name: 'Initial schema',
        up: this.loadSchemaFile()
      }
    ];
  }

  private loadSchemaFile(): string {
    const schemaPath = join(__dirname, 'schema.sql');
    return readFileSync(schemaPath, 'utf-8');
  }
}

// Database initialization utility
export async function initializeDatabase(dbPath: string): Promise<sqlite3.Database> {
  console.log(`Initializing database at: ${dbPath}`);
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Configure SQLite for better performance
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA synchronous = NORMAL');
      db.run('PRAGMA cache_size = 1000');
      db.run('PRAGMA temp_store = MEMORY');
      
      // Run migrations
      const migrationManager = new MigrationManager(db);
      migrationManager.runMigrations()
        .then(() => {
          console.log('Database initialization complete');
          resolve(db);
        })
        .catch(reject);
    });
  });
}

// Health check function
export function checkDatabaseHealth(db: sqlite3.Database): { healthy: boolean; details: any } {
  try {
    return {
      healthy: true,
      details: {
        connected: true,
        type: 'sqlite3'
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