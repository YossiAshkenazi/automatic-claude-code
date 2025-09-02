#!/usr/bin/env node
/**
 * Quick health check for ACC TypeScript SDK
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🏥 ACC SDK Health Check\n');

const checks = [
  {
    name: 'Build Status',
    test: () => fs.existsSync('./dist/index.js'),
    fix: 'Run: pnpm run build'
  },
  {
    name: 'CLI Executable',
    test: () => {
      try {
        execSync('node dist/index.js --version', { encoding: 'utf8', stdio: 'pipe' });
        return true;
      } catch { return false; }
    },
    fix: 'Check build and dependencies'
  },
  {
    name: 'Monitoring Server',
    test: () => {
      try {
        execSync('curl -s http://localhost:4005/api/health', { encoding: 'utf8', stdio: 'pipe' });
        return true;
      } catch { return false; }
    },
    fix: 'Run: cd dual-agent-monitor && pnpm run dev'
  },
  {
    name: 'Package Dependencies',
    test: () => fs.existsSync('./node_modules/@anthropic-ai/claude-code'),
    fix: 'Run: pnpm install'
  }
];

let passed = 0;
const total = checks.length;

checks.forEach((check, i) => {
  const status = check.test();
  const icon = status ? '✅' : '❌';
  const result = status ? 'PASS' : 'FAIL';
  
  console.log(`${i + 1}. ${check.name}: ${icon} ${result}`);
  
  if (!status) {
    console.log(`   Fix: ${check.fix}`);
  } else {
    passed++;
  }
});

console.log(`\n📊 Health Score: ${passed}/${total} (${Math.round(passed/total*100)}%)`);

if (passed === total) {
  console.log('🎉 All systems operational!');
  process.exit(0);
} else {
  console.log('⚠️  Some issues detected - check fixes above');
  process.exit(1);
}