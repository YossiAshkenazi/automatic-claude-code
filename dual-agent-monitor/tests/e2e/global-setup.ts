import { chromium, FullConfig } from '@playwright/test';
import { DatabaseService } from '../../server/database/DatabaseService';
import { AuthManager } from '../../server/auth/AuthManager';

async function globalSetup(config: FullConfig) {
  console.log('Setting up test environment...');

  // Setup test database
  const databaseService = new DatabaseService(':memory:');
  
  await databaseService.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      permissions TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await databaseService.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      agent_stats TEXT DEFAULT '{}'
    )
  `);

  // Create test user
  const authManager = new AuthManager();
  const hashedPassword = await authManager.hashPassword('testpass123');
  
  await databaseService.query(
    'INSERT OR IGNORE INTO users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)',
    ['testuser', hashedPassword, 'admin', JSON.stringify(['read', 'write', 'admin'])]
  );

  // Insert sample sessions for testing
  await databaseService.query(
    'INSERT OR IGNORE INTO sessions (id, name, status, duration, message_count) VALUES (?, ?, ?, ?, ?)',
    ['test-session-1', 'Sample Session 1', 'completed', 120000, 25]
  );

  await databaseService.query(
    'INSERT OR IGNORE INTO sessions (id, name, status, duration, message_count) VALUES (?, ?, ?, ?, ?)',
    ['test-session-2', 'Sample Session 2', 'active', 60000, 12]
  );

  // Launch browser for authentication
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Pre-authenticate by logging in
  await page.goto('http://localhost:5173/login');
  await page.fill('[data-testid="username-input"]', 'testuser');
  await page.fill('[data-testid="password-input"]', 'testpass123');
  await page.click('[data-testid="login-button"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard');

  // Save authentication state
  await context.storageState({ path: 'tests/e2e/auth.json' });

  await browser.close();
  await databaseService.close();

  console.log('Test environment setup complete');
}

export default globalSetup;