#!/usr/bin/env node
/**
 * Enhanced health check for ACC TypeScript SDK Testing Infrastructure
 * Epic 1, Story 1.2: Comprehensive diagnostics for SDK testing environment
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

// Final status
if (results.criticalPassed === results.critical && overallScore >= 80) {
  console.log('\n🎉 Testing infrastructure is ready!');
  console.log('   All critical systems operational and overall health is good.');
  process.exit(0);
} else if (results.criticalPassed < results.critical) {
  console.log('\n🚨 Critical issues detected!');
  console.log('   Fix critical system issues before proceeding with tests.');
  process.exit(1);
} else {
  console.log('\n⚠️  Some issues detected');
  console.log('   Non-critical issues found. Testing may still work but could be unreliable.');
  process.exit(1);
}