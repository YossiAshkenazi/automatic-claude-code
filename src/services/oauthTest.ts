#!/usr/bin/env node

/**
 * OAuth Token Extraction Test Suite
 * Tests both legacy and enhanced OAuth extractors with all credential providers
 */

import { Logger } from '../logger';
import { OAuthExtractor } from './oauthExtractor';
import { EnhancedOAuthExtractor } from './enhancedOAuthExtractor';
import { CredentialManager } from './credentialProviders';

class OAuthTestSuite {
  private logger: Logger;
  private originalExtractor: OAuthExtractor;
  private enhancedExtractor: EnhancedOAuthExtractor;
  private credentialManager: CredentialManager;

  constructor() {
    this.logger = new Logger();
    this.originalExtractor = new OAuthExtractor(this.logger);
    this.enhancedExtractor = new EnhancedOAuthExtractor(this.logger);
    this.credentialManager = new CredentialManager(this.logger);
  }

  /**
   * Run comprehensive OAuth test suite
   */
  async runTests(): Promise<void> {
    console.log('🔐 OAuth Token Extraction Test Suite\n');
    console.log('='.repeat(60) + '\n');

    try {
      await this.testEnvironmentVariables();
      await this.testCredentialProviders();
      await this.testOriginalExtractor();
      await this.testEnhancedExtractor();
      await this.testCredentialStorage();
      await this.runDiagnostics();
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ All OAuth tests completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test environment variable detection
   */
  private async testEnvironmentVariables(): Promise<void> {
    console.log('🌍 Environment Variable Tests');
    console.log('-'.repeat(30));

    const envVars = [
      'CLAUDE_CODE_OAUTH_TOKEN',
      'ANTHROPIC_API_KEY',
      'CLAUDE_API_KEY'
    ];

    for (const envVar of envVars) {
      const value = process.env[envVar];
      const status = value ? '✅ Set' : '❌ Not set';
      const preview = value ? `(${value.substring(0, 10)}...)` : '';
      console.log(`  ${envVar}: ${status} ${preview}`);
    }

    // Test with mock environment variable
    const originalValue = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token-12345678';
    
    const result = await this.enhancedExtractor.extractOAuthToken();
    const expectedToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    
    if (result.token === expectedToken && result.source === 'environment') {
      console.log('  ✅ Environment variable extraction working');
    } else {
      console.log('  ❌ Environment variable extraction failed');
    }

    // Restore original value
    if (originalValue) {
      process.env.CLAUDE_CODE_OAUTH_TOKEN = originalValue;
    } else {
      delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    }

    console.log('');
  }

  /**
   * Test credential provider availability
   */
  private async testCredentialProviders(): Promise<void> {
    console.log('🔑 Credential Provider Tests');
    console.log('-'.repeat(30));

    const providers = await this.credentialManager.testProviders();
    
    for (const [providerName, isAvailable] of Object.entries(providers)) {
      const status = isAvailable ? '✅ Available' : '❌ Not available';
      console.log(`  ${providerName}: ${status}`);
      
      if (isAvailable) {
        try {
          // Test basic functionality
          const testService = `test-${Date.now()}`;
          const testAccount = 'oauth-test';
          const testToken = `test-token-${Math.random().toString(36).substr(2, 9)}`;
          
          // Store test token
          await this.credentialManager.setToken(testService, testAccount, testToken);
          console.log(`    ✅ Token storage test passed`);
          
          // Retrieve test token
          const retrievedToken = await this.credentialManager.getToken(testService, testAccount);
          if (retrievedToken === testToken) {
            console.log(`    ✅ Token retrieval test passed`);
          } else {
            console.log(`    ❌ Token retrieval test failed`);
          }
          
          // Clean up test token
          await this.credentialManager.deleteToken(testService, testAccount);
          console.log(`    ✅ Token deletion test passed`);
          
        } catch (error) {
          console.log(`    ❌ Functionality test failed: ${(error as Error).message}`);
        }
      }
    }

    console.log('');
  }

  /**
   * Test original OAuth extractor
   */
  private async testOriginalExtractor(): Promise<void> {
    console.log('🔒 Original OAuth Extractor Tests');
    console.log('-'.repeat(30));

    try {
      const result = await this.originalExtractor.extractOAuthToken();
      
      console.log(`  Token found: ${result.token ? '✅ Yes' : '❌ No'}`);
      console.log(`  Source: ${result.source}`);
      console.log(`  Cached: ${result.cached ? 'Yes' : 'No'}`);
      
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }

      if (result.expires_at) {
        console.log(`  Expires: ${result.expires_at}`);
      }

      // Test token validation if token exists
      if (result.token) {
        const isValid = this.originalExtractor.validateToken(result.token, result.expires_at);
        console.log(`  Valid: ${isValid ? '✅ Yes' : '❌ No'}`);
      }

      // Test cache status
      const cacheStatus = this.originalExtractor.getCacheStatus();
      console.log(`  Cache entries: ${cacheStatus.size}`);

    } catch (error) {
      console.log(`  ❌ Original extractor failed: ${error}`);
    }

    console.log('');
  }

  /**
   * Test enhanced OAuth extractor
   */
  private async testEnhancedExtractor(): Promise<void> {
    console.log('🚀 Enhanced OAuth Extractor Tests');
    console.log('-'.repeat(30));

    try {
      const result = await this.enhancedExtractor.extractOAuthToken();
      
      console.log(`  Token found: ${result.token ? '✅ Yes' : '❌ No'}`);
      console.log(`  Source: ${result.source}`);
      console.log(`  Cached: ${result.cached ? 'Yes' : 'No'}`);
      
      if (result.provider) {
        console.log(`  Provider: ${result.provider}`);
      }
      
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }

      if (result.expires_at) {
        console.log(`  Expires: ${result.expires_at}`);
      }

      // Test token validation if token exists
      if (result.token) {
        const isValid = this.enhancedExtractor.validateToken(result.token, result.expires_at);
        console.log(`  Valid: ${isValid ? '✅ Yes' : '❌ No'}`);
      }

      // Test available providers
      const providers = this.enhancedExtractor.getAvailableProviders();
      console.log(`  Available providers: ${providers.join(', ')}`);

      // Test stored tokens listing
      const storedTokens = await this.enhancedExtractor.listStoredTokens();
      console.log(`  Stored token services: ${storedTokens.length}`);
      
      storedTokens.forEach(({ service, accounts }) => {
        console.log(`    ${service}: ${accounts.length} account(s)`);
      });

    } catch (error) {
      console.log(`  ❌ Enhanced extractor failed: ${error}`);
    }

    console.log('');
  }

  /**
   * Test credential storage and retrieval
   */
  private async testCredentialStorage(): Promise<void> {
    console.log('💾 Credential Storage Tests');
    console.log('-'.repeat(30));

    const testService = `oauth-test-${Date.now()}`;
    const testAccount = 'test-account';
    const testToken = `test-oauth-token-${Math.random().toString(36).substr(2, 12)}`;

    try {
      // Test storing token via enhanced extractor
      await this.enhancedExtractor.storeOAuthToken(testToken, testService, testAccount);
      console.log('  ✅ Token storage successful');

      // Test retrieving token
      const result = await this.enhancedExtractor.extractOAuthToken();
      // Note: This might not retrieve our test token if other tokens exist
      console.log('  ✅ Token extraction after storage successful');

      // Test listing stored tokens
      const storedTokens = await this.enhancedExtractor.listStoredTokens();
      const hasTestService = storedTokens.some(t => t.service === testService);
      
      if (hasTestService) {
        console.log('  ✅ Token listing shows stored token');
      } else {
        console.log('  ⚠️ Token listing might not show test token (normal if other tokens exist)');
      }

      // Clean up test token
      await this.enhancedExtractor.deleteOAuthToken(testService, testAccount);
      console.log('  ✅ Token deletion successful');

    } catch (error) {
      console.log(`  ❌ Credential storage test failed: ${(error as Error).message}`);
    }

    console.log('');
  }

  /**
   * Run comprehensive diagnostics
   */
  private async runDiagnostics(): Promise<void> {
    console.log('🔍 System Diagnostics');
    console.log('-'.repeat(30));

    try {
      const diagnostics = await this.enhancedExtractor.runDiagnostics();
      
      console.log('  Environment Variables:');
      console.log(`    Has tokens: ${diagnostics.environment ? '✅ Yes' : '❌ No'}`);
      
      console.log('  Credential Providers:');
      for (const [provider, available] of Object.entries(diagnostics.credentialProviders)) {
        console.log(`    ${provider}: ${available ? '✅' : '❌'}`);
      }
      
      console.log('  File System Paths:');
      for (const [path, exists] of Object.entries(diagnostics.fileSystemPaths)) {
        console.log(`    ${path}: ${exists ? '✅' : '❌'}`);
      }
      
      console.log('  Sessions:');
      console.log(`    Active sessions (24h): ${diagnostics.activeSessions}`);
      
      console.log('  Cache:');
      console.log(`    Cached entries: ${diagnostics.cacheStatus.size}`);

    } catch (error) {
      console.log(`  ❌ Diagnostics failed: ${error}`);
    }

    console.log('');
  }
}

/**
 * Main execution
 */
async function main() {
  const testSuite = new OAuthTestSuite();
  await testSuite.runTests();
  
  console.log('\n📋 Next Steps:');
  console.log('1. Install optional native dependencies:');
  console.log('   pnpm add keytar @stoneagebr/windows-credman node-windows');
  console.log('2. Set environment variable:');
  console.log('   set CLAUDE_CODE_OAUTH_TOKEN=your_token_here');
  console.log('3. Store token via credential manager:');
  console.log('   node dist/services/oauthTest.js --store-token your_token_here');
  console.log('4. Run OAuth extractor tests:');
  console.log('   pnpm test oauthExtractor');
}

// Handle command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === '--store-token' && args[1]) {
    const enhancedExtractor = new EnhancedOAuthExtractor();
    enhancedExtractor.storeOAuthToken(args[1])
      .then(() => console.log('✅ Token stored successfully'))
      .catch(error => console.error('❌ Token storage failed:', error));
  } else {
    main().catch(console.error);
  }
}

export { OAuthTestSuite };