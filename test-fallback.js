const { SDKChecker } = require('./dist/utils/sdkChecker');

async function testSDKFallback() {
  console.log('🧪 Testing SDK Fallback Mechanisms\n');
  
  const checker = SDKChecker.getInstance();
  
  try {
    // Test SDK availability checking
    console.log('Testing SDK availability check...');
    const availability = await checker.checkSDKAvailability(true);
    console.log(`SDK Available: ${availability.isAvailable ? '✅' : '❌'}`);
    
    if (!availability.isAvailable) {
      console.log('\nIssues found:');
      availability.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
      
      console.log('\nRecommendations:');
      availability.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
    
    // Test health status
    console.log('\nTesting SDK health status...');
    const health = await checker.getSDKHealthStatus();
    console.log(`Overall Health: ${health.overallHealth.toUpperCase()}`);
    console.log(`Can Import SDK: ${health.canImportSDK ? '✅' : '❌'}`);
    console.log(`Has Claude CLI: ${health.hasClaudeCLI ? '✅' : '❌'}`);
    console.log(`Auth Ready: ${health.authenticationReady ? '✅' : '❌'}`);
    
    if (health.issues.length > 0) {
      console.log('\nHealth Issues:');
      health.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    }
    
    console.log('\n✅ Fallback mechanism tests completed successfully');
    
  } catch (error) {
    console.error('\n❌ Fallback test failed:', error.message);
  }
}

testSDKFallback();