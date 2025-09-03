import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Global test setup
beforeEach(() => {
  // Reset environment variables
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  // Clean up any test files
  jest.restoreAllMocks();
});

// Helper to create temporary test directories
export const createTempDir = (): string => {
  const tempDir = path.join(os.tmpdir(), 'oauth-extractor-test-' + Math.random().toString(36).substr(2, 9));
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
};

// Helper to create mock credential files
export const createMockCredFile = (dir: string, content: any): string => {
  const credPath = path.join(dir, '.claude', '.credentials.json');
  fs.mkdirSync(path.dirname(credPath), { recursive: true });
  fs.writeFileSync(credPath, JSON.stringify(content));
  return credPath;
};

// Helper to create mock session directory
export const createMockSessionDir = (dir: string): string => {
  const sessionsPath = path.join(dir, '.claude', 'projects', 'test-session');
  fs.mkdirSync(sessionsPath, { recursive: true });
  const conversationFile = path.join(sessionsPath, 'conversation.jsonl');
  fs.writeFileSync(conversationFile, '{"type": "test"}');
  return sessionsPath;
};

// Helper to cleanup directories
export const cleanupDir = (dir: string): void => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};