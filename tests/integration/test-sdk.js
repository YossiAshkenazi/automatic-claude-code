#!/usr/bin/env node
/**
 * Simple SDK functionality test
 */

const { SDKClaudeExecutor } = require('./dist/services/sdkClaudeExecutor');
const { Logger } = require('./dist/logger');

async function testSDK() {
  console.log('🧪 Testing ACC SDK Functionality\n');
  
  const logger = new Logger();
  const executor = new SDKClaudeExecutor(logger);
  
  try {
    // Test 1: Basic availability
    console.log('1. SDK Available:', executor.isAvailable());
    
    // Test 2: Session management
    const sessionIds = executor.getActiveSessionIds();
    console.log('2. Active Sessions:', sessionIds.length);
    
    // Test 3: Browser auth check
    const authStatus = await executor.checkBrowserAuthentication();
    console.log('3. Browser Auth:', authStatus.isAuthenticated);
    
    // Test 4: SDK status
    const sdkStatus = await executor.getSDKStatus();
    console.log('4. SDK Status:', {
      available: sdkStatus.sdkAvailable,
      browserAuth: sdkStatus.browserAuth,
      circuitBreaker: sdkStatus.circuitBreakerOpen
    });
    
    console.log('\n✅ SDK tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ SDK test failed:', error.message);
  }
}

testSDK().catch(console.error);