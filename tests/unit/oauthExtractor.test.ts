import { OAuthExtractor, OAuthExtractionResult } from '../services/oauthExtractor';
import { Logger } from '../logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTempDir, createMockCredFile, createMockSessionDir, cleanupDir } from './setup';

// Mock child_process
const mockExecAsync = jest.fn();
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock the promisify function
jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

describe('OAuthExtractor', () => {
  let extractor: OAuthExtractor;
  let mockLogger: Logger;
  let tempDir: string;
  let originalPlatform: PropertyDescriptor;
  let originalHomedir: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    extractor = new OAuthExtractor(mockLogger);
    tempDir = createTempDir();
    
    // Backup original values
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    originalHomedir = os.homedir;
    originalEnv = { ...process.env };

    // Mock os.homedir to use temp directory
    os.homedir = jest.fn(() => tempDir);
    
    // Clear environment variables
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    
    // Reset mocks
    mockExecAsync.mockClear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, 'platform', originalPlatform);
    os.homedir = originalHomedir;
    process.env = originalEnv;
    
    // Cleanup temp directory
    cleanupDir(tempDir);
    
    // Clear cache
    extractor.clearCache();
  });

  describe('Environment Variable Extraction', () => {
    test('should extract token from CLAUDE_CODE_OAUTH_TOKEN environment variable', async () => {
      const expectedToken = 'test-oauth-token-123';
      process.env.CLAUDE_CODE_OAUTH_TOKEN = expectedToken;

      const result = await extractor.extractOAuthToken();

      expect(result).toEqual({
        token: expectedToken,
        source: 'environment',
        cached: false
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('OAuth token found in environment variable');
    });

    test('should handle whitespace in environment token', async () => {
      const expectedToken = 'test-oauth-token-123';
      process.env.CLAUDE_CODE_OAUTH_TOKEN = `  ${expectedToken}  `;

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(expectedToken);
      expect(result.source).toBe('environment');
    });

    test('should ignore empty environment variable', async () => {
      process.env.CLAUDE_CODE_OAUTH_TOKEN = '';

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
    });

    test('should ignore whitespace-only environment variable', async () => {
      process.env.CLAUDE_CODE_OAUTH_TOKEN = '   ';

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
    });
  });

  describe('Windows Credential Manager Extraction', () => {
    beforeEach(() => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });
    });

    test('should extract token from Windows Credential Manager', async () => {
      const expectedToken = 'windows-cred-token-456';
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          UserName: 'claude-user',
          Password: expectedToken,
          Target: 'Claude Code'
        })
      });

      const result = await extractor.extractOAuthToken();

      expect(result).toEqual({
        token: expectedToken,
        source: 'windows_credential_manager',
        cached: false
      });
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("Get-StoredCredential -Target 'Claude Code'")
      );
    });

    test('should try multiple credential names on Windows', async () => {
      const expectedToken = 'windows-cred-token-456';
      
      // First call fails, second succeeds
      mockExecAsync
        .mockRejectedValueOnce(new Error('Credential not found'))
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            UserName: 'claude-user',
            Password: expectedToken,
            Target: 'Claude Code-credentials'
          })
        });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(expectedToken);
      expect(result.source).toBe('windows_credential_manager');
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
    });

    test('should handle Windows Credential Manager errors gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Access denied'));

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract OAuth token from Windows Credential Manager')
      );
    });

    test('should handle malformed JSON from Windows Credential Manager', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'invalid-json'
      });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
    });

    test('should fallback to cmdkey when PowerShell fails', async () => {
      mockExecAsync
        .mockRejectedValueOnce(new Error('PowerShell not available'))
        .mockRejectedValueOnce(new Error('PowerShell not available'))
        .mockResolvedValueOnce({ stdout: 'Target: Claude Code' });

      const result = await extractor.extractOAuthToken();

      expect(mockLogger.debug).toHaveBeenCalledWith('Claude credentials detected in Windows Credential Manager');
    });
  });

  describe('macOS Keychain Extraction', () => {
    beforeEach(() => {
      // Mock macOS platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });
    });

    test('should extract token from macOS Keychain', async () => {
      const expectedToken = 'macos-keychain-token-789';
      mockExecAsync.mockResolvedValueOnce({
        stdout: expectedToken + '\n'
      });

      const result = await extractor.extractOAuthToken();

      expect(result).toEqual({
        token: expectedToken,
        source: 'macos_keychain',
        cached: false
      });
      expect(mockExecAsync).toHaveBeenCalledWith(
        'security find-generic-password -s "Claude Code-credentials" -w'
      );
    });

    test('should try multiple service names on macOS', async () => {
      const expectedToken = 'macos-keychain-token-789';
      
      // First call fails, second succeeds
      mockExecAsync
        .mockRejectedValueOnce(new Error('Service not found'))
        .mockResolvedValueOnce({
          stdout: expectedToken + '\n'
        });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(expectedToken);
      expect(result.source).toBe('macos_keychain');
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
    });

    test('should handle macOS Keychain errors gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Keychain locked'));

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract OAuth token from macOS Keychain')
      );
    });

    test('should validate token length from keychain', async () => {
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'short\n' // Too short to be a valid token
      });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
    });
  });

  describe('File System Credential Extraction', () => {
    test('should extract oauth_token from .credentials.json', async () => {
      const expectedToken = 'file-oauth-token-abc';
      createMockCredFile(tempDir, {
        oauth_token: expectedToken,
        expires_at: '2025-12-31T23:59:59Z'
      });

      const result = await extractor.extractOAuthToken();

      expect(result).toEqual({
        token: expectedToken,
        source: 'file_system',
        cached: false,
        expires_at: '2025-12-31T23:59:59Z'
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('OAuth token found in file:')
      );
    });

    test('should extract session_token as fallback', async () => {
      const expectedToken = 'file-session-token-def';
      createMockCredFile(tempDir, {
        session_token: expectedToken
      });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(expectedToken);
      expect(result.source).toBe('file_system');
    });

    test('should prefer oauth_token over session_token', async () => {
      const oauthToken = 'oauth-token-preferred';
      const sessionToken = 'session-token-fallback';
      createMockCredFile(tempDir, {
        oauth_token: oauthToken,
        session_token: sessionToken
      });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(oauthToken);
      expect(result.source).toBe('file_system');
    });

    test('should try multiple credential file paths', async () => {
      // Create credentials in alternative location
      const altPath = path.join(tempDir, '.config', 'claude', 'credentials.json');
      fs.mkdirSync(path.dirname(altPath), { recursive: true });
      fs.writeFileSync(altPath, JSON.stringify({ oauth_token: 'alt-token' }));

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe('alt-token');
      expect(result.source).toBe('file_system');
    });

    test('should handle malformed JSON in credentials file', async () => {
      const credPath = path.join(tempDir, '.claude', '.credentials.json');
      fs.mkdirSync(path.dirname(credPath), { recursive: true });
      fs.writeFileSync(credPath, 'invalid-json');

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse credentials file')
      );
    });

    test('should handle file system errors gracefully', async () => {
      // Mock fs.existsSync to throw an error
      const originalExistsSync = fs.existsSync;
      fs.existsSync = jest.fn().mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
      
      // Restore original function
      fs.existsSync = originalExistsSync;
    });
  });

  describe('Existing Session Detection', () => {
    test('should detect existing recent sessions', async () => {
      createMockSessionDir(tempDir);

      const result = await extractor.extractOAuthToken();

      expect(result).toEqual({
        token: 'session-exists',
        source: 'session_exists',
        cached: false
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found recent active session')
      );
    });

    test('should ignore old sessions (>24 hours)', async () => {
      const sessionPath = createMockSessionDir(tempDir);
      const conversationFile = path.join(sessionPath, 'conversation.jsonl');
      
      // Set file modification time to 25 hours ago
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
      fs.utimesSync(conversationFile, oldTime, oldTime);

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
    });

    test('should handle missing conversation.jsonl files', async () => {
      const sessionsPath = path.join(tempDir, '.claude', 'projects', 'empty-session');
      fs.mkdirSync(sessionsPath, { recursive: true });
      // Don't create conversation.jsonl

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
    });
  });

  describe('Token Caching', () => {
    test('should cache valid tokens', async () => {
      const expectedToken = 'cached-token-123';
      process.env.CLAUDE_CODE_OAUTH_TOKEN = expectedToken;

      // First call
      const result1 = await extractor.extractOAuthToken();
      expect(result1.cached).toBe(false);

      // Second call should use cache
      const result2 = await extractor.extractOAuthToken();
      expect(result2.cached).toBe(true);
      expect(result2.token).toBe(expectedToken);
      expect(mockLogger.debug).toHaveBeenCalledWith('Using cached OAuth token');
    });

    test('should not cache invalid tokens', async () => {
      process.env.CLAUDE_CODE_OAUTH_TOKEN = '';

      const result = await extractor.extractOAuthToken();

      expect(result.cached).toBe(false);
      expect(result.token).toBeNull();
    });

    test('should expire cache after timeout', async () => {
      const expectedToken = 'expiring-token-456';
      process.env.CLAUDE_CODE_OAUTH_TOKEN = expectedToken;
      
      // Create extractor with very short cache expiry for testing
      const shortCacheExtractor = new OAuthExtractor(mockLogger);
      (shortCacheExtractor as any).cacheExpiryMs = 1; // 1ms

      // First call
      await shortCacheExtractor.extractOAuthToken();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 2));

      // Second call should not use cache
      const result = await shortCacheExtractor.extractOAuthToken();
      expect(result.cached).toBe(false);
    });

    test('should clear cache when requested', async () => {
      const expectedToken = 'clearable-token-789';
      process.env.CLAUDE_CODE_OAUTH_TOKEN = expectedToken;

      // Cache a token
      await extractor.extractOAuthToken();

      // Clear cache
      extractor.clearCache();

      // Next call should not use cache
      const result = await extractor.extractOAuthToken();
      expect(result.cached).toBe(false);
    });

    test('should provide cache status for debugging', async () => {
      const expectedToken = 'debug-token-abc';
      process.env.CLAUDE_CODE_OAUTH_TOKEN = expectedToken;

      // Cache a token
      await extractor.extractOAuthToken();

      const status = extractor.getCacheStatus();
      expect(status.size).toBe(1);
      expect(status.entries).toHaveLength(1);
      expect(status.entries[0].key).toBe('oauth_token');
    });
  });

  describe('Token Validation', () => {
    test('should validate token format', () => {
      expect(extractor.validateToken('valid-token-12345')).toBe(true);
      expect(extractor.validateToken('session-exists')).toBe(true);
      expect(extractor.validateToken('')).toBe(false);
      expect(extractor.validateToken('short')).toBe(false);
      expect(extractor.validateToken('   ')).toBe(false);
    });

    test('should validate token expiry', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      expect(extractor.validateToken('valid-token-12345', futureDate)).toBe(true);
      expect(extractor.validateToken('valid-token-12345', pastDate)).toBe(false);
    });

    test('should handle invalid expiry date formats', () => {
      expect(extractor.validateToken('valid-token-12345', 'invalid-date')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Invalid expiry date format: invalid-date');
    });
  });

  describe('Token Refresh', () => {
    test('should handle missing refresh token', async () => {
      const result = await extractor.refreshToken();

      expect(result).toEqual({
        token: null,
        source: 'none',
        cached: false,
        error: 'No refresh token provided'
      });
    });

    test('should indicate refresh not implemented', async () => {
      const result = await extractor.refreshToken('refresh-token-123');

      expect(result).toEqual({
        token: null,
        source: 'none',
        cached: false,
        error: 'Token refresh not implemented'
      });
      expect(mockLogger.debug).toHaveBeenCalledWith('Token refresh not implemented yet');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('should work on Linux', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const expectedToken = 'linux-token-123';
      createMockCredFile(tempDir, { oauth_token: expectedToken });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(expectedToken);
      expect(result.source).toBe('file_system');
    });

    test('should handle unknown platforms gracefully', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'unknown' as any,
        configurable: true
      });

      const expectedToken = 'unknown-platform-token';
      createMockCredFile(tempDir, { oauth_token: expectedToken });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(expectedToken);
      expect(result.source).toBe('file_system');
    });
  });

  describe('Priority Order', () => {
    test('should prioritize environment variable over all other sources', async () => {
      const envToken = 'env-token-priority';
      const fileToken = 'file-token-lower';

      // Set up both sources
      process.env.CLAUDE_CODE_OAUTH_TOKEN = envToken;
      createMockCredFile(tempDir, { oauth_token: fileToken });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(envToken);
      expect(result.source).toBe('environment');
    });

    test('should prioritize credential manager over file system on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      const credToken = 'cred-manager-token';
      const fileToken = 'file-token-lower';

      // Set up both sources
      mockExecAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({
          Password: credToken
        })
      });
      createMockCredFile(tempDir, { oauth_token: fileToken });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(credToken);
      expect(result.source).toBe('windows_credential_manager');
    });

    test('should prioritize keychain over file system on macOS', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });

      const keychainToken = 'keychain-token';
      const fileToken = 'file-token-lower';

      // Set up both sources
      mockExecAsync.mockResolvedValueOnce({
        stdout: keychainToken + '\n'
      });
      createMockCredFile(tempDir, { oauth_token: fileToken });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(keychainToken);
      expect(result.source).toBe('macos_keychain');
    });

    test('should fall back through all sources when none found', async () => {
      // No environment variable
      // No credential manager (will fail)
      mockExecAsync.mockRejectedValue(new Error('Not found'));

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBeNull();
      expect(result.source).toBe('none');
      expect(result.error).toBe('No OAuth token found in any source');
    });
  });

  describe('Error Handling', () => {
    test('should handle all extraction methods failing gracefully', async () => {
      // Mock all methods to fail
      mockExecAsync.mockRejectedValue(new Error('Command failed'));
      
      const result = await extractor.extractOAuthToken();

      expect(result).toEqual({
        token: null,
        source: 'none',
        cached: false,
        error: 'No OAuth token found in any source'
      });
    });

    test('should continue extraction when one method throws', async () => {
      const expectedToken = 'recovery-token-123';
      
      // First method throws, second succeeds
      mockExecAsync.mockRejectedValueOnce(new Error('First method failed'));
      createMockCredFile(tempDir, { oauth_token: expectedToken });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(expectedToken);
      expect(result.source).toBe('file_system');
    });

    test('should log debug information for troubleshooting', async () => {
      await extractor.extractOAuthToken();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract OAuth token')
      );
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle expired cached tokens', async () => {
      const expiredToken = 'expired-token-123';
      const expiredDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      
      createMockCredFile(tempDir, {
        oauth_token: expiredToken,
        expires_at: expiredDate
      });

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(expiredToken); // Still returns the token
      expect(result.source).toBe('file_system');
      expect(result.expires_at).toBe(expiredDate);
      
      // But validation should fail
      expect(extractor.validateToken(expiredToken, expiredDate)).toBe(false);
    });

    test('should handle concurrent extraction requests', async () => {
      const expectedToken = 'concurrent-token-456';
      process.env.CLAUDE_CODE_OAUTH_TOKEN = expectedToken;

      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() => extractor.extractOAuthToken());
      const results = await Promise.all(promises);

      // All should return the same token
      results.forEach(result => {
        expect(result.token).toBe(expectedToken);
        expect(result.source).toBe('environment');
      });

      // At least one should be cached
      expect(results.some(r => r.cached)).toBe(true);
    });

    test('should work in a complete real-world scenario', async () => {
      // Simulate a complete extraction scenario
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      const fileToken = 'complete-scenario-token';
      const expiresAt = new Date(Date.now() + 86400000).toISOString(); // 24 hours from now

      // Environment not set
      // Windows credential manager fails
      mockExecAsync.mockRejectedValue(new Error('Credential not found'));
      
      // File system has valid token
      createMockCredFile(tempDir, {
        oauth_token: fileToken,
        refresh_token: 'refresh-123',
        expires_at: expiresAt
      });

      // Also create a recent session
      createMockSessionDir(tempDir);

      const result = await extractor.extractOAuthToken();

      expect(result.token).toBe(fileToken);
      expect(result.source).toBe('file_system');
      expect(result.expires_at).toBe(expiresAt);
      expect(extractor.validateToken(fileToken, expiresAt)).toBe(true);

      // Cache status should show the token
      const cacheStatus = extractor.getCacheStatus();
      expect(cacheStatus.size).toBe(1);
    });
  });
});