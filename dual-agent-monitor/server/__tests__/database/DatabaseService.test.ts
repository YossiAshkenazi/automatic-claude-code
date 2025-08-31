import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '../../database/DatabaseService';
import { Database } from 'better-sqlite3';

// Mock better-sqlite3
vi.mock('better-sqlite3');

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockDatabase: any;

  beforeEach(() => {
    mockDatabase = {
      prepare: vi.fn(),
      exec: vi.fn(),
      close: vi.fn(),
      pragma: vi.fn()
    };

    const MockDatabase = vi.fn().mockImplementation(() => mockDatabase);
    vi.mocked(require('better-sqlite3')).default = MockDatabase;

    databaseService = new DatabaseService(':memory:');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize database with correct pragmas', () => {
      expect(mockDatabase.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('foreign_keys = ON');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('synchronous = NORMAL');
    });
  });

  describe('query', () => {
    it('should execute SELECT query and return results', async () => {
      const mockStatement = {
        all: vi.fn().mockReturnValue([
          { id: 1, name: 'Test Session' },
          { id: 2, name: 'Another Session' }
        ])
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      const result = await databaseService.query('SELECT * FROM sessions', []);

      expect(mockDatabase.prepare).toHaveBeenCalledWith('SELECT * FROM sessions');
      expect(mockStatement.all).toHaveBeenCalledWith([]);
      expect(result).toEqual([
        { id: 1, name: 'Test Session' },
        { id: 2, name: 'Another Session' }
      ]);
    });

    it('should execute INSERT query and return result info', async () => {
      const mockStatement = {
        run: vi.fn().mockReturnValue({
          changes: 1,
          lastInsertRowid: 123
        })
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      const result = await databaseService.query(
        'INSERT INTO sessions (name, status) VALUES (?, ?)',
        ['Test Session', 'active']
      );

      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        'INSERT INTO sessions (name, status) VALUES (?, ?)'
      );
      expect(mockStatement.run).toHaveBeenCalledWith(['Test Session', 'active']);
      expect(result).toEqual({
        changes: 1,
        lastInsertRowid: 123
      });
    });

    it('should handle query errors', async () => {
      const mockStatement = {
        all: vi.fn().mockImplementation(() => {
          throw new Error('Database error');
        })
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      await expect(
        databaseService.query('SELECT * FROM invalid_table', [])
      ).rejects.toThrow('Database error');
    });
  });

  describe('execute', () => {
    it('should execute SQL statement without parameters', async () => {
      mockDatabase.exec.mockReturnValue(undefined);

      await databaseService.execute('CREATE TABLE test (id INTEGER PRIMARY KEY)');

      expect(mockDatabase.exec).toHaveBeenCalledWith(
        'CREATE TABLE test (id INTEGER PRIMARY KEY)'
      );
    });

    it('should handle execution errors', async () => {
      mockDatabase.exec.mockImplementation(() => {
        throw new Error('SQL error');
      });

      await expect(
        databaseService.execute('INVALID SQL')
      ).rejects.toThrow('SQL error');
    });
  });

  describe('transaction', () => {
    it('should execute operations in transaction', async () => {
      const operations = [
        async (db: DatabaseService) => {
          await db.query('INSERT INTO sessions (name) VALUES (?)', ['Session 1']);
        },
        async (db: DatabaseService) => {
          await db.query('INSERT INTO sessions (name) VALUES (?)', ['Session 2']);
        }
      ];

      const mockTransaction = vi.fn().mockImplementation((callback) => {
        callback();
        return { changes: 2 };
      });

      mockDatabase.transaction = mockTransaction;

      const result = await databaseService.transaction(operations);

      expect(mockTransaction).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should rollback transaction on error', async () => {
      const operations = [
        async (db: DatabaseService) => {
          await db.query('INSERT INTO sessions (name) VALUES (?)', ['Session 1']);
        },
        async (db: DatabaseService) => {
          throw new Error('Operation failed');
        }
      ];

      const mockTransaction = vi.fn().mockImplementation((callback) => {
        throw new Error('Transaction failed');
      });

      mockDatabase.transaction = mockTransaction;

      const result = await databaseService.transaction(operations);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await databaseService.close();

      expect(mockDatabase.close).toHaveBeenCalled();
    });
  });

  describe('backup', () => {
    it('should create database backup', async () => {
      const backupPath = '/tmp/backup.db';
      const mockBackup = {
        backup: vi.fn().mockResolvedValue(undefined)
      };

      mockDatabase.backup = vi.fn().mockReturnValue(mockBackup);

      const result = await databaseService.backup(backupPath);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe(backupPath);
    });

    it('should handle backup errors', async () => {
      const backupPath = '/invalid/path/backup.db';
      const mockBackup = {
        backup: vi.fn().mockRejectedValue(new Error('Backup failed'))
      };

      mockDatabase.backup = vi.fn().mockReturnValue(mockBackup);

      const result = await databaseService.backup(backupPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Backup failed');
    });
  });
});