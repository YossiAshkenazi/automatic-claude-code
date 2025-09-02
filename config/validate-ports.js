#!/usr/bin/env node

/**
 * Port Configuration Validation Script
 * Validates that all configuration files use standardized ports
 */

const fs = require('fs');
const path = require('path');

// Load the standard port configuration
const portsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'base', 'ports.json'), 'utf8')
);

console.log('🔍 Validating port configuration across all files...\n');

const checks = [
  {
    file: '../package.json',
    description: 'Main package.json',
    checks: [
      { pattern: /localhost:6007/, expected: 'monitoring port 6007', key: 'monitoring.persistent' }
    ]
  },
  {
    file: '../dual-agent-monitor/vite.config.ts',
    description: 'Vite config',
    checks: [
      { pattern: /port:\s*6011/, expected: 'dashboard port 6011', key: 'dashboard.development' },
      { pattern: /localhost:4005/, expected: 'API port 4005', key: 'api.development' }
    ]
  },
  {
    file: '../docker-compose.yml',
    description: 'Docker Compose development',
    checks: [
      { pattern: /"4005:4005"/, expected: 'API port 4005', key: 'api.development' },
      { pattern: /"6011:6011"/, expected: 'dashboard port 6011', key: 'dashboard.development' }
    ]
  },
  {
    file: '../docker-compose.prod.yml',
    description: 'Docker Compose production',
    checks: [
      { pattern: /"4005:4005"/, expected: 'API port 4005', key: 'api.production' },
      { pattern: /"6011:80"/, expected: 'dashboard proxy to 6011', key: 'dashboard.production' }
    ]
  },
  {
    file: 'monitoring/monitoring-server.js',
    description: 'Monitoring server',
    checks: [
      { pattern: /PORT\s*\|\|\s*6007/, expected: 'monitoring port 6007', key: 'monitoring.persistent' }
    ]
  }
];

let allValid = true;
let totalChecks = 0;
let passedChecks = 0;

for (const check of checks) {
  const filePath = path.join(__dirname, check.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${check.description}: File not found - ${filePath}`);
    continue;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`📄 ${check.description}`);
  
  for (const validation of check.checks) {
    totalChecks++;
    if (validation.pattern.test(content)) {
      console.log(`  ✅ ${validation.expected}`);
      passedChecks++;
    } else {
      console.log(`  ❌ Missing: ${validation.expected}`);
      allValid = false;
    }
  }
  console.log('');
}

// Check for conflicting ports
const conflictChecks = [
  { pattern: /4001/, description: 'Old API port 4001 (should be migrated to 4005)' },
  { pattern: /6001/, description: 'Old dashboard port 6001 (should be migrated to 6011)' }
];

console.log('🔍 Checking for port conflicts...\n');

for (const check of checks) {
  const filePath = path.join(__dirname, check.file);
  if (!fs.existsSync(filePath)) continue;
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  for (const conflict of conflictChecks) {
    if (conflict.pattern.test(content)) {
      console.log(`⚠️  ${check.description}: Found ${conflict.description}`);
      allValid = false;
    }
  }
}

// Summary
console.log(`\n📊 Validation Summary:`);
console.log(`Total checks: ${totalChecks}`);
console.log(`Passed: ${passedChecks}`);
console.log(`Failed: ${totalChecks - passedChecks}`);

if (allValid) {
  console.log(`\n✅ All port configurations are standardized!`);
  console.log(`Standard ports:`);
  console.log(`  - API Server: ${portsConfig.ports.api.development}`);
  console.log(`  - Dashboard: ${portsConfig.ports.dashboard.development}`);
  console.log(`  - Monitoring: ${portsConfig.ports.monitoring.persistent}`);
  console.log(`  - PostgreSQL: ${portsConfig.ports.database.postgres}`);
  console.log(`  - Redis: ${portsConfig.ports.database.redis}`);
  process.exit(0);
} else {
  console.log(`\n❌ Port standardization incomplete. Please review the issues above.`);
  process.exit(1);
}