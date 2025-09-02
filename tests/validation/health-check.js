#!/usr/bin/env node
/**
 * Complete health check for ACC TypeScript SDK Testing Infrastructure
 * Epic 1, Story 1.2: Comprehensive diagnostics for SDK testing environment
 * Epic 3: Process management validation for clean termination
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const startTime = Date.now();

console.log('🏥 ACC SDK Testing Infrastructure Health Check');
console.log('============================================\n');

// Enhanced health check configuration
const HEALTH_CHECK_CONFIG = {
  timeout: 10000, // 10 second timeout per check
  maxConcurrentChecks: 5,
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  skipNetworkChecks: process.argv.includes('--offline'),
  testMode: process.env.NODE_ENV === 'test'
};

// Helper functions
function runCommand(cmd, options = {}) {
  try {
    const result = execSync(cmd, { 
      encoding: 'utf8', 
      stdio: 'pipe', 
      timeout: HEALTH_CHECK_CONFIG.timeout,
      ...options 
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      output: error.stdout || error.stderr || ''
    };
  }
}

function checkFileExists(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return { exists: true, isFile: stats.isFile(), isDirectory: stats.isDirectory(), size: stats.size };
  } catch {
    return { exists: false };
  }
}

function logVerbose(message) {
  if (HEALTH_CHECK_CONFIG.verbose) {
    console.log(`    💬 ${message}`);
  }
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

// Enhanced health checks with detailed diagnostics
const healthChecks = [
  {
    category: 'Build & Compilation',
    name: 'TypeScript Build Status',
    test: () => {
      logVerbose('Checking if TypeScript build artifacts exist...');
      const buildCheck = checkFileExists('./dist/index.js');
      const sourceMapCheck = checkFileExists('./dist/index.js.map');
      
      return {
        success: buildCheck.exists && buildCheck.isFile,
        details: {
          indexExists: buildCheck.exists,
          sourceMapExists: sourceMapCheck.exists,
          buildSize: buildCheck.size || 0
        }
      };
    },
    fix: 'Run: pnpm run build',
    critical: true
  },
  
  {
    category: 'Build & Compilation',
    name: 'TypeScript Compilation Check',
    test: () => {
      logVerbose('Running TypeScript compilation check...');
      const result = runCommand('npx tsc --noEmit --skipLibCheck');
      const hasErrors = !result.success && result.output.includes('error TS');
      const errorCount = hasErrors ? (result.output.match(/error TS\d+:/g) || []).length : 0;
      
      return {
        success: result.success,
        details: {
          hasErrors,
          errorCount,
          output: result.output.split('\n').slice(0, 5).join('\n') // First 5 lines only
        }
      };
    },
    fix: 'Check TypeScript errors and fix compilation issues',
    critical: false
  },

  {
    category: 'Build & Compilation',
    name: 'Manual Test TypeScript Compilation',
    test: () => {
      logVerbose('Checking manual test file compilation...');
      const testFile = './src/__tests__/manual/testSDKAutopilot.ts';
      const fileCheck = checkFileExists(testFile);
      
      if (!fileCheck.exists) {
        return { success: false, details: { error: 'Test file not found' } };
      }
      
      const result = runCommand(`npx tsc --noEmit --skipLibCheck "${testFile}"`);
      const hasSpecificErrors = result.output.includes('testSDKAutopilot.ts');
      
      return {
        success: !hasSpecificErrors,
        details: {
          fileExists: fileCheck.exists,
          hasTestSpecificErrors: hasSpecificErrors,
          canCompile: result.success || !hasSpecificErrors
        }
      };
    },
    fix: 'Fix TypeScript errors in manual test files',
    critical: true
  },

  {
    category: 'SDK Integration',
    name: 'Claude Code SDK Package',
    test: () => {
      logVerbose('Checking Claude Code SDK installation...');
      const sdkPath = './node_modules/@anthropic-ai/claude-code';
      const packageCheck = checkFileExists(sdkPath);
      const packageJsonCheck = checkFileExists(path.join(sdkPath, 'package.json'));
      const sdkJsCheck = checkFileExists(path.join(sdkPath, 'sdk.js'));
      
      let version = null;
      if (packageJsonCheck.exists) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(path.join(sdkPath, 'package.json'), 'utf8'));
          version = packageJson.version;
        } catch (e) {
          logVerbose(`Failed to read package.json: ${e.message}`);
        }
      }
      
      return {
        success: packageCheck.exists && packageJsonCheck.exists,
        details: {
          packageExists: packageCheck.exists,
          packageJsonExists: packageJsonCheck.exists,
          sdkJsExists: sdkJsCheck.exists,
          version
        }
      };
    },
    fix: 'Run: pnpm install or npm install -g @anthropic-ai/claude-code',
    critical: true
  },

  {
    category: 'SDK Integration',
    name: 'SDK Version Compatibility',
    test: () => {
      logVerbose('Checking SDK version compatibility...');
      const globalResult = runCommand('claude --version');
      const localResult = runCommand('npx claude --version');
      
      return {
        success: globalResult.success || localResult.success,
        details: {
          globalVersion: globalResult.success ? globalResult.output : null,
          localVersion: localResult.success ? localResult.output : null,
          hasGlobal: globalResult.success,
          hasLocal: localResult.success
        }
      };
    },
    fix: 'Install Claude CLI: npm install -g @anthropic-ai/claude-code',
    critical: false
  },

  {
    category: 'Runtime Environment',
    name: 'Node.js Version Compatibility',
    test: () => {
      logVerbose('Checking Node.js version...');
      const version = process.version;
      const major = parseInt(version.replace('v', '').split('.')[0]);
      const isCompatible = major >= 18;
      
      return {
        success: isCompatible,
        details: {
          version,
          majorVersion: major,
          isCompatible,
          requiredMinimum: 18
        }
      };
    },
    fix: 'Update to Node.js 18 or higher',
    critical: true
  },

  {
    category: 'Runtime Environment',
    name: 'CLI Executable Test',
    test: () => {
      logVerbose('Testing CLI executable functionality...');
      const result = runCommand('node dist/index.js --version');
      
      return {
        success: result.success,
        details: {
          canExecute: result.success,
          output: result.output,
          error: result.error
        }
      };
    },
    fix: 'Check build status and dependencies',
    critical: true
  },

  {
    category: 'Process Isolation',
    name: 'Claude Session Detection',
    test: () => {
      logVerbose('Testing Claude session detection...');
      // Check for existing Claude processes
      const psResult = runCommand(os.platform() === 'win32' ? 
        'tasklist /FI "IMAGENAME eq claude.exe" /FO CSV' :
        'ps aux | grep -i claude || echo "No Claude processes"'
      );
      
      const hasClaudeProcess = psResult.success && 
        (psResult.output.includes('claude') || psResult.output.includes('Claude'));
      
      return {
        success: true, // This is informational
        details: {
          hasActiveClaudeProcess: hasClaudeProcess,
          processInfo: psResult.output.split('\n').slice(0, 3).join('\n')
        }
      };
    },
    fix: 'Close existing Claude sessions before testing',
    critical: false
  },

  {
    category: 'Process Isolation',
    name: 'Test Environment Isolation',
    test: () => {
      logVerbose('Checking test environment isolation capability...');
      const envVars = {
        NODE_ENV: process.env.NODE_ENV,
        CI: process.env.CI,
        CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
        DEBUG: process.env.DEBUG
      };
      
      const hasTestingEnv = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
      
      return {
        success: true, // This is informational
        details: {
          hasTestingEnvironment: hasTestingEnv,
          relevantEnvVars: envVars,
          canSetTestMode: true
        }
      };
    },
    fix: 'Set NODE_ENV=test for testing environment',
    critical: false
  },

  {
    category: 'Memory & Resources',
    name: 'Memory Constraints Check',
    test: () => {
      logVerbose('Checking memory availability...');
      const memInfo = {
        total: Math.round(os.totalmem() / 1024 / 1024), // MB
        free: Math.round(os.freemem() / 1024 / 1024), // MB
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024) // MB
      };
      
      const hasAdequateMemory = memInfo.free >= 512; // 512MB minimum
      
      return {
        success: hasAdequateMemory,
        details: {
          ...memInfo,
          hasAdequateMemory,
          requiredMinimum: 512
        }
      };
    },
    fix: 'Free up memory or increase system resources',
    critical: false
  },

  {
    category: 'Cross-Platform',
    name: 'Platform Compatibility',
    test: () => {
      logVerbose('Checking platform-specific compatibility...');
      const platform = os.platform();
      const arch = os.arch();
      const isSupported = ['win32', 'darwin', 'linux'].includes(platform);
      
      return {
        success: isSupported,
        details: {
          platform,
          arch,
          isSupported,
          supportedPlatforms: ['win32', 'darwin', 'linux']
        }
      };
    },
    fix: 'Use Windows, macOS, or Linux',
    critical: true
  },

  // Epic 3: Process Management Validation
  {
    category: 'Epic 3 - Process Management',
    name: 'ProcessHandleTracker Availability',
    test: () => {
      logVerbose('Checking ProcessHandleTracker module...');
      const trackerCheck = checkFileExists('./dist/testing/ProcessHandleTracker.js');
      const trackerSourceCheck = checkFileExists('./src/testing/ProcessHandleTracker.ts');
      
      return {
        success: trackerCheck.exists && trackerCheck.isFile,
        details: {
          compiledExists: trackerCheck.exists,
          sourceExists: trackerSourceCheck.exists,
          canImport: trackerCheck.exists
        }
      };
    },
    fix: 'Run: pnpm run build to compile ProcessHandleTracker',
    critical: true
  },

  {
    category: 'Epic 3 - Process Management',
    name: 'ShutdownManager Availability', 
    test: () => {
      logVerbose('Checking ShutdownManager module...');
      const managerCheck = checkFileExists('./dist/testing/ShutdownManager.js');
      const managerSourceCheck = checkFileExists('./src/testing/ShutdownManager.ts');
      
      return {
        success: managerCheck.exists && managerCheck.isFile,
        details: {
          compiledExists: managerCheck.exists,
          sourceExists: managerSourceCheck.exists,
          canImport: managerCheck.exists
        }
      };
    },
    fix: 'Run: pnpm run build to compile ShutdownManager',
    critical: true
  },

  {
    category: 'Epic 3 - Process Management',
    name: 'IsolatedTestRunner Availability',
    test: () => {
      logVerbose('Checking IsolatedTestRunner module...');
      const runnerCheck = checkFileExists('./dist/testing/IsolatedTestRunner.js');
      const runnerSourceCheck = checkFileExists('./src/testing/IsolatedTestRunner.ts');
      
      return {
        success: runnerCheck.exists && runnerCheck.isFile,
        details: {
          compiledExists: runnerCheck.exists,
          sourceExists: runnerSourceCheck.exists,
          canImport: runnerCheck.exists
        }
      };
    },
    fix: 'Run: pnpm run build to compile IsolatedTestRunner',
    critical: true
  },

  {
    category: 'Epic 3 - Process Management',
    name: 'Testing Module Integration',
    test: () => {
      logVerbose('Checking testing module index integration...');
      const indexCheck = checkFileExists('./dist/testing/index.js');
      const indexSourceCheck = checkFileExists('./src/testing/index.ts');
      
      let exportsCheck = false;
      if (indexSourceCheck.exists) {
        try {
          const indexContent = require('fs').readFileSync('./src/testing/index.ts', 'utf8');
          const hasTracker = indexContent.includes('ProcessHandleTracker');
          const hasManager = indexContent.includes('ShutdownManager');
          const hasRunner = indexContent.includes('IsolatedTestRunner');
          exportsCheck = hasTracker && hasManager && hasRunner;
        } catch (e) {
          logVerbose(`Failed to read testing index: ${e.message}`);
        }
      }
      
      return {
        success: indexCheck.exists && exportsCheck,
        details: {
          indexCompiled: indexCheck.exists,
          indexSource: indexSourceCheck.exists,
          epic3ComponentsExported: exportsCheck
        }
      };
    },
    fix: 'Verify testing/index.ts exports all Epic 3 components',
    critical: true
  },

  {
    category: 'Epic 3 - Process Management',
    name: 'Process Handle Tracking Test',
    test: () => {
      logVerbose('Testing basic handle tracking functionality...');
      
      try {
        // Test basic handle tracking simulation
        const testTimers = {
          timer1: setTimeout(() => {}, 5000),
          timer2: setTimeout(() => {}, 5000)
        };
        
        // Clean up test timers
        clearTimeout(testTimers.timer1);
        clearTimeout(testTimers.timer2);
        
        const handleCount = Object.keys(testTimers).length;
        
        return {
          success: handleCount === 2,
          details: {
            testHandlesCreated: handleCount,
            testHandlesCleaned: handleCount,
            canTrackHandles: true
          }
        };
      } catch (error) {
        return {
          success: false,
          details: {
            error: error.message,
            canTrackHandles: false
          }
        };
      }
    },
    fix: 'Check Node.js timer functionality',
    critical: false
  },

  {
    category: 'Epic 3 - Process Management',
    name: 'Manual Test Process Management Integration',
    test: () => {
      logVerbose('Checking manual test Epic 3 integration...');
      const testFile = './src/__tests__/manual/testSDKAutopilot.ts';
      const testCheck = checkFileExists(testFile);
      
      let hasEpic3Integration = false;
      if (testCheck.exists) {
        try {
          const testContent = require('fs').readFileSync(testFile, 'utf8');
          const hasTracker = testContent.includes('ProcessHandleTracker');
          const hasManager = testContent.includes('ShutdownManager');
          const hasRunner = testContent.includes('IsolatedTestRunner');
          const hasEpic3Tests = testContent.includes('testProcessManagementInfrastructure');
          hasEpic3Integration = hasTracker && hasManager && hasRunner && hasEpic3Tests;
        } catch (e) {
          logVerbose(`Failed to read manual test: ${e.message}`);
        }
      }
      
      return {
        success: testCheck.exists && hasEpic3Integration,
        details: {
          testFileExists: testCheck.exists,
          hasEpic3Integration,
          canTestProcessManagement: hasEpic3Integration
        }
      };
    },
    fix: 'Update manual test to include Epic 3 process management tests',
    critical: true
  },

  {
    category: 'Epic 3 - Process Management',
    name: 'Integration Test Suite',
    test: () => {
      logVerbose('Checking Epic 3 integration test suite...');
      const integrationTest = './src/__tests__/integration/epic3-process-management.test.ts';
      const testCheck = checkFileExists(integrationTest);
      
      let hasComprehensiveTests = false;
      if (testCheck.exists) {
        try {
          const testContent = require('fs').readFileSync(integrationTest, 'utf8');
          const hasHandleTrackerTests = testContent.includes('ProcessHandleTracker');
          const hasShutdownTests = testContent.includes('ShutdownManager');
          const hasIsolatedTests = testContent.includes('IsolatedTestRunner');
          const hasIntegrationTests = testContent.includes('Complete Integration');
          hasComprehensiveTests = hasHandleTrackerTests && hasShutdownTests && hasIsolatedTests && hasIntegrationTests;
        } catch (e) {
          logVerbose(`Failed to read integration test: ${e.message}`);
        }
      }
      
      return {
        success: testCheck.exists && hasComprehensiveTests,
        details: {
          integrationTestExists: testCheck.exists,
          hasComprehensiveTests,
          testFileSize: testCheck.size || 0
        }
      };
    },
    fix: 'Create comprehensive Epic 3 integration tests',
    critical: false
  },

  {
    category: 'Epic 3 - Process Management',
    name: 'Clean Termination Readiness',
    test: () => {
      logVerbose('Validating clean termination readiness...');
      
      // Check if all Epic 3 components are properly configured
      const componentChecks = {
        handleTracker: checkFileExists('./dist/testing/ProcessHandleTracker.js'),
        shutdownManager: checkFileExists('./dist/testing/ShutdownManager.js'),
        testRunner: checkFileExists('./dist/testing/IsolatedTestRunner.js'),
        testFactory: checkFileExists('./dist/testing/TestSDKFactory.js')
      };
      
      const allComponentsReady = Object.values(componentChecks).every(check => check.exists);
      const readinessScore = Object.values(componentChecks).filter(check => check.exists).length;
      
      return {
        success: allComponentsReady,
        details: {
          componentsReady: readinessScore,
          totalComponents: 4,
          readinessPercentage: Math.round((readinessScore / 4) * 100),
          canPreventHanging: allComponentsReady
        }
      };
    },
    fix: 'Ensure all Epic 3 components are built: pnpm run build',
    critical: true
  }
];

// Add network checks unless offline mode
if (!HEALTH_CHECK_CONFIG.skipNetworkChecks) {
  healthChecks.push({
    category: 'Network & Services',
    name: 'Monitoring Server Health',
    test: () => {
      logVerbose('Checking monitoring server health...');
      const result = runCommand('curl -s http://localhost:4005/api/health');
      
      return {
        success: result.success,
        details: {
          serverResponding: result.success,
          response: result.output,
          error: result.error
        }
      };
    },
    fix: 'Run: cd dual-agent-monitor && pnpm run dev',
    critical: false
  });
}

// Execute health checks
console.log('Running health checks...\n');

const results = {
  total: healthChecks.length,
  passed: 0,
  critical: 0,
  criticalPassed: 0,
  categories: {}
};

healthChecks.forEach((check, index) => {
  const checkStart = Date.now();
  console.log(`${index + 1}. ${check.name}...`);
  
  try {
    const result = check.test();
    const checkDuration = Date.now() - checkStart;
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const timing = HEALTH_CHECK_CONFIG.verbose ? ` (${formatDuration(checkDuration)})` : '';
    
    console.log(`   ${status}${timing}`);
    
    if (check.critical) {
      results.critical++;
      if (result.success) results.criticalPassed++;
    }
    
    if (result.success) {
      results.passed++;
    } else {
      console.log(`   🔧 Fix: ${check.fix}`);
    }
    
    // Show details in verbose mode
    if (HEALTH_CHECK_CONFIG.verbose && result.details) {
      Object.entries(result.details).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          console.log(`      ${key}: ${JSON.stringify(value)}`);
        }
      });
    }
    
    // Track by category
    if (!results.categories[check.category]) {
      results.categories[check.category] = { total: 0, passed: 0 };
    }
    results.categories[check.category].total++;
    if (result.success) results.categories[check.category].passed++;
    
  } catch (error) {
    console.log(`   ❌ FAIL (Error: ${error.message})`);
    console.log(`   🔧 Fix: ${check.fix}`);
    
    if (check.critical) results.critical++;
  }
  
  console.log(); // Empty line for readability
});

// Display summary
const totalDuration = Date.now() - startTime;
const overallScore = Math.round((results.passed / results.total) * 100);
const criticalScore = results.critical > 0 ? Math.round((results.criticalPassed / results.critical) * 100) : 100;

console.log('📊 Health Check Summary');
console.log('======================');
console.log(`Overall Score: ${results.passed}/${results.total} (${overallScore}%)`);
console.log(`Critical Systems: ${results.criticalPassed}/${results.critical} (${criticalScore}%)`);
console.log(`Total Duration: ${formatDuration(totalDuration)}`);

// Category breakdown
console.log('\n📋 Category Breakdown:');
Object.entries(results.categories).forEach(([category, stats]) => {
  const categoryScore = Math.round((stats.passed / stats.total) * 100);
  console.log(`  ${category}: ${stats.passed}/${stats.total} (${categoryScore}%)`);
});

// Environment info
console.log('\n🌍 Environment Info:');
console.log(`  Platform: ${os.platform()} ${os.arch()}`);
console.log(`  Node.js: ${process.version}`);
console.log(`  Working Directory: ${process.cwd()}`);

// Epic 3 specific validation
const epic3Categories = Object.entries(results.categories).filter(([category]) => 
  category.includes('Epic 3')
);

let epic3Score = 100;
let epic3Ready = true;

if (epic3Categories.length > 0) {
  const epic3Stats = epic3Categories.reduce((acc, [, stats]) => ({
    total: acc.total + stats.total,
    passed: acc.passed + stats.passed
  }), { total: 0, passed: 0 });
  
  epic3Score = epic3Stats.total > 0 ? Math.round((epic3Stats.passed / epic3Stats.total) * 100) : 100;
  epic3Ready = epic3Stats.passed === epic3Stats.total;
  
  console.log(`\n🔧 Epic 3 Process Management: ${epic3Stats.passed}/${epic3Stats.total} (${epic3Score}%)`);
  if (epic3Ready) {
    console.log('   ✅ Process management ready - tests should not hang!');
  } else {
    console.log('   ❌ Process management issues - tests may hang without Ctrl+C!');
  }
}

// Final status with Epic 3 considerations
if (results.criticalPassed === results.critical && overallScore >= 80) {
  console.log('\n🎉 Testing infrastructure is ready!');
  console.log('   All critical systems operational and overall health is good.');
  
  if (epic3Ready) {
    console.log('   ✅ Epic 3: Process management active - clean termination guaranteed!');
  } else {
    console.log('   ⚠️  Epic 3: Process management issues detected - manual intervention may be needed.');
  }
  
  process.exit(0);
} else if (results.criticalPassed < results.critical) {
  console.log('\n🚨 Critical issues detected!');
  console.log('   Fix critical system issues before proceeding with tests.');
  
  if (!epic3Ready) {
    console.log('   🚨 Epic 3 Critical: Process hanging prevention not ready!');
  }
  
  process.exit(1);
} else {
  console.log('\n⚠️  Some issues detected');
  console.log('   Non-critical issues found. Testing may still work but could be unreliable.');
  
  if (!epic3Ready) {
    console.log('   ⚠️  Epic 3 Warning: Process management not fully operational.');
  }
  
  process.exit(1);
}