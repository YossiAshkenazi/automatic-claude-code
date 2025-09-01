# Testing Specification

This is the testing specification for the spec detailed in @.agent-os/specs/2025-09-01-comprehensive-folder-restructure/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Overview

This document outlines the comprehensive testing strategy for the folder restructure migration, ensuring zero functionality loss and maintaining system reliability throughout the process. The testing approach covers pre-migration baselines, continuous validation during migration, and post-migration verification.

## Testing Strategy

### Unit Tests for Refactored CLI Commands

#### Core CLI Functionality
```bash
# Test fundamental CLI operations
acc examples --verify
acc history --format json --validate
acc logs --tail --test-mode
acc monitor --status --verify
```

#### Command Argument Processing
- **Flag parsing verification**: Test all CLI flags and combinations
- **Path resolution**: Verify relative/absolute path handling
- **Configuration loading**: Test config precedence and merging
- **Error handling**: Validate graceful failure modes

#### Module-Specific Tests
```typescript
// Example test structure for CLI modules
describe('CLI Command Tests', () => {
  test('acc run command with dual-agent mode', async () => {
    const result = await execCommand('acc run "test task" --dual-agent -i 2');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Manager Agent initialized');
    expect(result.stdout).toContain('Worker Agent initialized');
  });

  test('acc monitor command functionality', async () => {
    const result = await execCommand('acc monitor --start');
    expect(result.exitCode).toBe(0);
    // Verify monitoring server starts on correct port
    const response = await fetch('http://localhost:6007/health');
    expect(response.ok).toBe(true);
  });
});
```

### Integration Tests for Monitoring System

#### Database Integration
```sql
-- Test database schema and connections
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verify monitoring data persistence
INSERT INTO agent_sessions (session_id, task_description) 
VALUES ('test-session', 'Integration test');

-- Test session replay functionality
SELECT * FROM agent_communications 
WHERE session_id = 'test-session' 
ORDER BY timestamp;
```

#### WebSocket Communication
```javascript
// Test real-time monitoring data flow
const testWebSocket = () => {
  const ws = new WebSocket('ws://localhost:4001');
  
  ws.onopen = () => {
    console.log('WebSocket connection established');
    ws.send(JSON.stringify({
      type: 'test_message',
      agentType: 'manager',
      content: 'Integration test message'
    }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    expect(data.type).toBeDefined();
    expect(data.timestamp).toBeDefined();
  };
};
```

#### External Integrations
- **Webhook delivery testing**: Verify Slack, Discord, email notifications
- **API endpoint validation**: Test all monitoring API endpoints
- **Authentication flow**: Verify user authentication and authorization
- **Mobile responsiveness**: Test PWA functionality and offline capabilities

### End-to-End Tests for Dual-Agent Workflows

#### Complete Workflow Scenarios
```bash
# Test Case 1: Simple Development Task
acc run "Create a TypeScript utility function for data validation" --dual-agent -i 3 -v

# Expected workflow verification:
# 1. Manager receives task and creates breakdown
# 2. Worker implements the function
# 3. Manager validates the implementation
# 4. Session completes successfully

# Test Case 2: Complex Multi-Component Task
acc run "Build user authentication system with JWT, password hashing, and middleware" --dual-agent -i 8 -v

# Expected workflow verification:
# 1. Manager creates detailed task breakdown
# 2. Multiple Worker execution phases
# 3. Manager quality gates between phases
# 4. Integration testing and validation
```

#### Agent Communication Validation
```bash
# Verify agent message exchange patterns
# Monitor logs for proper coordination messages:
grep -E "(MANAGER_TASK_ASSIGNMENT|WORKER_PROGRESS_UPDATE|AGENT_COORDINATION)" logs/agent-communication.log

# Validate coordination timing
# Ensure no coordination timeouts or deadlocks
grep -E "(timeout|deadlock|coordination_failure)" logs/system.log
```

#### Error Recovery Testing
```bash
# Test graceful error handling
acc run "intentionally failing task to test error recovery" --dual-agent --continue-on-error -i 5

# Verify:
# - Manager detects Worker failures
# - Appropriate retry logic triggers
# - Session continues with alternative approaches
# - Error states are properly logged and recoverable
```

### Docker Container Functionality Tests

#### Container Build Verification
```bash
# Test multi-stage Docker builds
pnpm run docker:build --no-cache

# Verify image integrity
docker inspect automatic-claude-code:latest
docker run --rm automatic-claude-code:latest --version

# Test production container
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml config --quiet
```

#### Container Runtime Tests
```bash
# Test basic container functionality
docker run --rm -v "$(pwd):/workspace:ro" -v "$HOME/.claude:/home/nodejs/.claude:ro" \
  automatic-claude-code:latest run "echo test" -i 1

# Test monitoring container integration
docker-compose -f docker-compose.yml up -d
curl -f http://localhost:6011/health
curl -f http://localhost:4001/api/health

# Verify container networking
docker network ls | grep automatic-claude-code-network
docker exec acc-app ping acc-monitoring
```

#### Volume Mount and Permissions
```bash
# Test workspace volume mounting
docker run --rm -v "$(pwd):/workspace:ro" automatic-claude-code:latest ls -la /workspace

# Test Claude config volume
docker run --rm -v "$HOME/.claude:/home/nodejs/.claude:ro" automatic-claude-code:latest ls -la /home/nodejs/.claude

# Verify file permissions in container
docker run --rm -v "$(pwd):/workspace" automatic-claude-code:latest whoami
docker run --rm -v "$(pwd):/workspace" automatic-claude-code:latest id
```

### Cross-Platform Compatibility Tests

#### Windows Compatibility
```powershell
# Test PowerShell scripts
.\scripts\start-monitoring.ps1
.\scripts\docker-setup.ps1

# Test Windows-specific paths
acc run "test windows path handling" -i 1
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Format-Table

# Verify npm link functionality
where acc
acc --version
```

#### Linux/macOS Compatibility
```bash
# Test shell scripts
./scripts/start-monitoring.sh
./scripts/docker-setup.sh

# Test Unix-specific features
ps aux | grep node
lsof -i :4001
chmod +x scripts/*.sh

# Verify symlink functionality
which acc
readlink -f $(which acc)
```

#### WSL Compatibility
```bash
# Test Windows Subsystem for Linux
wsl -e bash -c "cd /mnt/c/Users/Dev/automatic-claude-code && pnpm run build"
wsl -e bash -c "acc --version"

# Test cross-filesystem operations
wsl -e bash -c "acc run 'create test file' -i 1"
ls -la test*
```

## Pre-Migration Testing Baseline

### Performance Benchmarks Before Restructure

#### System Performance Metrics
```bash
# CPU and Memory baseline
pnpm run benchmark:system

# Expected baseline metrics:
# - CLI startup time: < 2s
# - Single agent task completion: < 30s per iteration
# - Dual agent coordination: < 45s per iteration
# - Memory usage: < 512MB per agent process
# - Monitoring dashboard load time: < 3s
```

#### Database Performance
```sql
-- Query performance baseline
EXPLAIN ANALYZE SELECT * FROM agent_sessions 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Connection pool efficiency
SELECT count(*) as active_connections, state 
FROM pg_stat_activity 
WHERE datname = 'dual_agent_monitor' 
GROUP BY state;

-- Expected metrics:
-- Query response time: < 50ms average
-- Connection pool utilization: < 80%
-- No connection leaks or timeouts
```

### Functionality Verification Commands

#### Core Functionality Checklist
```bash
# 1. Basic CLI operations
acc examples | head -10
acc history --limit 5
acc logs --tail 10

# 2. Single agent mode
acc run "create simple test file" -i 1 -v

# 3. Dual agent mode
acc run "implement basic function" --dual-agent -i 3 -v

# 4. Monitoring system
acc monitor --status
curl -f http://localhost:6007/health

# 5. Docker operations
docker --version
pnpm run docker:build
docker run --rm automatic-claude-code:latest --version
```

#### Configuration Validation
```bash
# Verify config file integrity
cat ~/.automatic-claude-code/config.json | jq '.dualAgentMode'
cat ~/.automatic-claude-code/config.json | jq '.monitoring'

# Test configuration precedence
ACC_VERBOSE=true acc run "test config override" -i 1

# Verify hook script execution
ls -la .claude/hooks/
.claude/hooks/user-prompt-submit-hook.ps1 "test prompt"
```

### Monitoring Dashboard Health Checks

#### Frontend Health Verification
```bash
# React application health
cd dual-agent-monitor
pnpm run build
pnpm run preview

# Verify build output
ls -la dist/
curl -f http://localhost:4173/

# Component rendering tests
pnpm run test:components
pnpm run test:integration
```

#### Backend API Health
```bash
# API server health checks
curl -f http://localhost:4001/health
curl -f http://localhost:4001/api/sessions
curl -f http://localhost:4001/api/agents/status

# WebSocket connectivity
wscat -c ws://localhost:4001
# Should receive connection acknowledgment

# Database connectivity
curl -f http://localhost:4001/api/health/database
```

### Docker Build and Deployment Tests

#### Build Process Validation
```bash
# Clean build from scratch
docker system prune -a -f
pnpm run docker:build --no-cache

# Multi-stage build verification
docker history automatic-claude-code:latest
docker inspect automatic-claude-code:latest --format '{{.Config.Labels}}'

# Security scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image automatic-claude-code:latest
```

#### Deployment Environment Tests
```bash
# Development environment
pnpm run docker:dev
sleep 10
curl -f http://localhost:6011/health
docker-compose logs --tail 20

# Production environment  
pnpm run docker:prod
sleep 15
curl -f http://localhost:6011/health
docker-compose -f docker-compose.prod.yml logs --tail 20
```

## During Migration Testing

### Phase-by-Phase Validation Checkpoints

#### Phase 1: Core Structure Migration
```bash
# Verify new directory structure
ls -la src/cli/
ls -la src/agents/
ls -la src/monitoring/
ls -la src/utils/

# Test import resolution
pnpm run typecheck
pnpm run build

# Verify CLI commands still work
acc --version
acc examples
```

#### Phase 2: Configuration Updates
```bash
# Test new configuration schema
cat config/default.json | jq
cat config/production.json | jq

# Verify config loading
DEBUG=config:* acc run "test config" -i 1

# Test environment overrides
NODE_ENV=production acc monitor --status
```

#### Phase 3: Monitoring Integration
```bash
# Test new monitoring structure
cd monitoring/
pnpm run build
pnpm run test

# Verify API endpoints
curl -f http://localhost:4001/api/v1/health
curl -f http://localhost:4001/api/v1/sessions

# WebSocket connectivity
wscat -c ws://localhost:4001/v1/ws
```

#### Phase 4: Docker Configuration
```bash
# Test updated Dockerfile
docker build -f docker/Dockerfile.prod -t acc-test .
docker run --rm acc-test --version

# Test compose configuration
docker-compose -f docker/docker-compose.yml config
docker-compose -f docker/docker-compose.yml up -d
```

### Rollback Trigger Criteria

#### Critical Failure Conditions
1. **CLI Command Failure**: Any core CLI command returns non-zero exit code
2. **Agent Spawn Failure**: Unable to spawn Manager or Worker agents
3. **Database Connection Loss**: Monitoring system cannot connect to database
4. **Build Process Failure**: TypeScript compilation or Docker build fails
5. **Performance Degradation**: >50% increase in response times
6. **Security Vulnerability**: New security issues introduced during migration

#### Automated Rollback Triggers
```bash
#!/bin/bash
# migration-health-check.sh

# Test core functionality
if ! acc --version > /dev/null 2>&1; then
    echo "ROLLBACK: CLI command failure"
    exit 1
fi

# Test agent spawning
if ! timeout 30 acc run "test" -i 1 > /dev/null 2>&1; then
    echo "ROLLBACK: Agent spawn failure"
    exit 1
fi

# Test monitoring system
if ! curl -f http://localhost:4001/health > /dev/null 2>&1; then
    echo "ROLLBACK: Monitoring system failure"
    exit 1
fi

# Test performance baseline
start_time=$(date +%s)
acc run "simple test" -i 1 > /dev/null 2>&1
end_time=$(date +%s)
duration=$((end_time - start_time))

if [ $duration -gt 60 ]; then
    echo "ROLLBACK: Performance degradation detected"
    exit 1
fi

echo "Migration health check passed"
```

### Performance Monitoring During Changes

#### Real-time Monitoring Setup
```bash
# Monitor system resources during migration
top -p $(pgrep -d, -f "node.*acc")
iostat -x 1
vmstat 1

# Monitor application metrics
curl http://localhost:4001/api/metrics | jq '.performance'
```

#### Performance Thresholds
- **CLI Response Time**: Must remain < 3 seconds
- **Memory Usage**: No memory leaks, < 1GB total
- **CPU Usage**: < 80% sustained load
- **Database Query Time**: < 100ms average
- **WebSocket Latency**: < 500ms round-trip

### Critical Path Functionality Verification

#### Essential Operations Test Suite
```bash
# Test suite for critical path validation
./scripts/test-critical-path.sh

# Contents of test-critical-path.sh:
#!/bin/bash
set -e

echo "Testing critical path functionality..."

# 1. CLI basic operations
acc --version
acc examples > /dev/null

# 2. Single agent task
timeout 60 acc run "echo hello" -i 1

# 3. Dual agent coordination
timeout 120 acc run "create test file" --dual-agent -i 2

# 4. Monitoring system
curl -f http://localhost:4001/health

# 5. Session persistence
acc history --limit 1

echo "Critical path verification completed successfully"
```

## Post-Migration Validation

### Complete Functionality Regression Testing

#### Comprehensive Test Suite Execution
```bash
# Run complete test suite
pnpm run test:all

# Individual test categories
pnpm run test:unit          # Unit tests
pnpm run test:integration   # Integration tests
pnpm run test:e2e          # End-to-end tests
pnpm run test:docker       # Container tests
pnpm run test:performance  # Performance tests
```

#### Manual Verification Checklist
```bash
# 1. CLI Command Verification
- [ ] acc --version shows correct version
- [ ] acc examples returns valid examples
- [ ] acc history shows session data
- [ ] acc logs displays recent activity
- [ ] acc monitor starts successfully

# 2. Agent Functionality
- [ ] Single agent mode completes simple tasks
- [ ] Dual agent mode coordinates properly
- [ ] Manager creates appropriate task breakdowns
- [ ] Worker executes assigned tasks correctly
- [ ] Error recovery mechanisms function

# 3. Monitoring System
- [ ] Dashboard loads without errors
- [ ] Real-time data updates correctly
- [ ] WebSocket connections stable
- [ ] API endpoints respond properly
- [ ] Database queries execute efficiently

# 4. Docker Integration
- [ ] Containers build successfully
- [ ] Multi-service deployment works
- [ ] Volume mounts function correctly
- [ ] Networking operates properly
- [ ] Health checks pass consistently
```

### Performance Comparison Against Baseline

#### Automated Performance Testing
```bash
# Run performance comparison suite
./scripts/performance-comparison.sh

# Performance test results format:
echo "=== PERFORMANCE COMPARISON RESULTS ==="
echo "Metric | Baseline | Current | Change | Status"
echo "-------|----------|---------|--------|-------"
echo "CLI Startup | 1.8s | 1.9s | +5.6% | ✓ PASS"
echo "Single Agent Task | 28s | 27s | -3.6% | ✓ PASS" 
echo "Dual Agent Task | 42s | 44s | +4.8% | ✓ PASS"
echo "Memory Usage | 487MB | 502MB | +3.1% | ✓ PASS"
echo "Dashboard Load | 2.1s | 2.3s | +9.5% | ✓ PASS"
```

#### Performance Acceptance Criteria
- **Startup Time**: ≤ 10% increase acceptable
- **Task Completion**: ≤ 15% increase acceptable
- **Memory Usage**: ≤ 20% increase acceptable
- **Response Times**: ≤ 25% increase acceptable
- **Throughput**: ≥ 90% of baseline required

### Docker Integration Verification

#### Container Functionality Tests
```bash
# Test all container scenarios
./scripts/docker-integration-test.sh

# Single container deployment
docker run --rm -v "$(pwd):/workspace:ro" automatic-claude-code:latest run "test" -i 1

# Multi-service deployment
docker-compose up -d
sleep 30
curl -f http://localhost:6011/health
curl -f http://localhost:4001/api/health

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
sleep 45
curl -f http://localhost:6011/health
```

#### Container Security Validation
```bash
# Security scan post-migration
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image automatic-claude-code:latest

# Vulnerability threshold: No HIGH or CRITICAL vulnerabilities
# Check for new vulnerabilities introduced during migration
```

### Monitoring System Validation

#### Dashboard Functionality Tests
```javascript
// Automated UI testing with Playwright
const { test, expect } = require('@playwright/test');

test('Monitoring dashboard loads correctly', async ({ page }) => {
  await page.goto('http://localhost:6011');
  
  // Verify main components load
  await expect(page.locator('[data-testid="agent-status"]')).toBeVisible();
  await expect(page.locator('[data-testid="session-list"]')).toBeVisible();
  await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
  
  // Test real-time updates
  await page.waitForFunction(() => {
    const timestamp = document.querySelector('[data-testid="last-updated"]');
    return timestamp && timestamp.textContent.includes('ago');
  });
});

test('Agent communication visualization', async ({ page }) => {
  await page.goto('http://localhost:6011/agents');
  
  // Start a dual-agent session
  await page.click('[data-testid="start-session"]');
  await page.fill('[data-testid="task-input"]', 'test task for monitoring');
  await page.click('[data-testid="submit-task"]');
  
  // Verify visualization updates
  await expect(page.locator('[data-testid="manager-agent"]')).toBeVisible();
  await expect(page.locator('[data-testid="worker-agent"]')).toBeVisible();
  await expect(page.locator('[data-testid="communication-flow"]')).toBeVisible();
});
```

### Cross-Platform Deployment Testing

#### Multi-Platform Validation
```bash
# Windows testing
powershell -Command "acc --version"
powershell -Command "acc run 'test windows' -i 1"

# Linux testing (WSL or native)
bash -c "acc --version"
bash -c "acc run 'test linux' -i 1"

# macOS testing (if available)
zsh -c "acc --version"
zsh -c "acc run 'test macos' -i 1"
```

#### Cross-Platform Docker Testing
```bash
# Multi-architecture build testing
docker buildx build --platform linux/amd64,linux/arm64 -t acc-multiarch .

# Test on different platforms
docker run --platform linux/amd64 --rm acc-multiarch --version
docker run --platform linux/arm64 --rm acc-multiarch --version
```

## Automated Test Integration

### CI/CD Pipeline Updates for New Structure

#### GitHub Actions Workflow Updates
```yaml
# .github/workflows/migration-test.yml
name: Migration Testing

on:
  push:
    branches: [ main, migration/* ]
  pull_request:
    branches: [ main ]

jobs:
  pre-migration-baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run baseline tests
        run: |
          pnpm run test:baseline
          pnpm run benchmark:performance
      
      - name: Store baseline metrics
        uses: actions/upload-artifact@v3
        with:
          name: baseline-metrics
          path: baseline-metrics.json

  migration-testing:
    runs-on: ubuntu-latest
    needs: pre-migration-baseline
    strategy:
      matrix:
        migration-phase: [structure, config, monitoring, docker]
    
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run phase-specific tests
        run: pnpm run test:migration:${{ matrix.migration-phase }}
      
      - name: Performance validation
        run: pnpm run test:performance:${{ matrix.migration-phase }}
      
      - name: Store test results
        uses: actions/upload-artifact@v3
        with:
          name: migration-test-results-${{ matrix.migration-phase }}
          path: test-results/

  post-migration-validation:
    runs-on: ubuntu-latest
    needs: migration-testing
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Download baseline metrics
        uses: actions/download-artifact@v3
        with:
          name: baseline-metrics
      
      - name: Run complete regression suite
        run: pnpm run test:regression:complete
      
      - name: Performance comparison
        run: |
          pnpm run benchmark:performance
          pnpm run compare:performance baseline-metrics.json current-metrics.json
      
      - name: Docker integration tests
        run: pnpm run test:docker:complete
      
      - name: Cross-platform tests
        run: pnpm run test:cross-platform
```

### Automated Deployment Testing

#### Deployment Pipeline Validation
```yaml
# .github/workflows/deployment-test.yml
name: Deployment Testing

on:
  workflow_run:
    workflows: ["Migration Testing"]
    types:
      - completed
    branches: [ main ]

jobs:
  docker-deployment-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker images
        run: |
          pnpm run docker:build
          docker-compose -f docker-compose.prod.yml build
      
      - name: Test container deployment
        run: |
          docker-compose -f docker-compose.prod.yml up -d
          sleep 30
          curl -f http://localhost:6011/health
          curl -f http://localhost:4001/api/health
          docker-compose -f docker-compose.prod.yml down
      
      - name: Security scan
        run: |
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy image automatic-claude-code:latest
  
  kubernetes-deployment-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Kubernetes
        uses: helm/kind-action@v1
        with:
          cluster_name: test-cluster
      
      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f dual-agent-monitor/deploy/kubernetes/
          kubectl wait --for=condition=ready pod -l app=automatic-claude-code --timeout=300s
      
      - name: Test Kubernetes deployment
        run: |
          kubectl port-forward svc/acc-frontend 8080:80 &
          sleep 10
          curl -f http://localhost:8080/health
```

### Container Build Verification

#### Multi-Stage Build Testing
```bash
# Test build stages independently
docker build --target development -t acc-dev .
docker build --target production -t acc-prod .

# Verify stage contents
docker run --rm acc-dev ls -la /app
docker run --rm acc-prod ls -la /app

# Test production optimizations
docker images | grep automatic-claude-code
# Verify production image is smaller than development
```

#### Build Performance Optimization
```dockerfile
# Optimized Dockerfile with caching
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --production=false

FROM deps AS build
COPY . .
RUN pnpm run build

FROM node:18-alpine AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Test Automation Scripts

### Master Test Runner
```bash
#!/bin/bash
# scripts/test-migration-complete.sh

set -e

echo "=== COMPREHENSIVE MIGRATION TESTING ==="

# Pre-migration baseline
echo "📊 Running pre-migration baseline tests..."
./scripts/test-baseline.sh

# Phase-by-phase testing
echo "🔄 Running phase-by-phase migration tests..."
for phase in structure config monitoring docker; do
    echo "Testing phase: $phase"
    ./scripts/test-migration-phase.sh $phase
done

# Post-migration validation
echo "✅ Running post-migration validation..."
./scripts/test-post-migration.sh

# Performance comparison
echo "📈 Comparing performance metrics..."
./scripts/compare-performance.sh

# Docker integration
echo "🐳 Testing Docker integration..."
./scripts/test-docker-complete.sh

# Cross-platform testing
echo "🌍 Running cross-platform tests..."
./scripts/test-cross-platform.sh

echo "=== MIGRATION TESTING COMPLETE ==="
echo "📋 View detailed results in: test-results/migration-report.html"
```

### Continuous Monitoring During Migration
```bash
#!/bin/bash
# scripts/monitor-migration.sh

# Start monitoring in background
pnpm run monitor:start &
MONITOR_PID=$!

# Monitor system resources
vmstat 5 > migration-system-stats.log &
VMSTAT_PID=$!

# Monitor application logs
tail -f logs/application.log > migration-app-logs.log &
TAIL_PID=$!

# Cleanup function
cleanup() {
    kill $MONITOR_PID $VMSTAT_PID $TAIL_PID 2>/dev/null
    echo "Monitoring stopped"
}

trap cleanup EXIT

echo "Migration monitoring started. Press Ctrl+C to stop."
echo "Monitor PID: $MONITOR_PID"
echo "System stats: migration-system-stats.log"  
echo "App logs: migration-app-logs.log"

# Wait for user interrupt
wait
```

## Success Criteria

### Migration Acceptance Requirements

1. **Zero Critical Functionality Loss**: All existing features must work post-migration
2. **Performance Within Threshold**: <25% performance degradation acceptable
3. **Docker Integration**: All container scenarios must deploy successfully
4. **Cross-Platform Compatibility**: Windows, Linux, macOS support maintained
5. **Monitoring System**: Full dashboard and API functionality preserved
6. **Security**: No new vulnerabilities introduced
7. **Test Coverage**: All tests pass with >90% code coverage
8. **Documentation**: Updated documentation reflects new structure

### Post-Migration Validation Checklist

- [ ] All CLI commands function correctly
- [ ] Single and dual-agent modes operational
- [ ] Monitoring dashboard loads and updates
- [ ] Docker containers build and deploy
- [ ] Database connections stable
- [ ] WebSocket communications working
- [ ] Performance within acceptable thresholds
- [ ] Cross-platform compatibility maintained
- [ ] Security scans pass
- [ ] CI/CD pipelines operational
- [ ] Documentation updated and accurate

This comprehensive testing specification ensures that the folder restructure migration maintains system reliability and introduces no regressions while providing a clear validation framework for each phase of the migration process.