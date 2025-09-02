# Authentication Fix Testing Guide

## Quick Validation Tests

### 1. **Basic Functionality Test** ✅
```bash
acc run "implement a hello world function in TypeScript" -i 1
```

**Expected Output:**
- Should see: `Detected nested session at entry point - using direct execution mode`
- Should complete successfully
- Should NOT show: `Claude Code process exited with code 1`

### 2. **Environment Variable Test** 🔧
```powershell
# PowerShell
$env:CLAUDECODE = "1"
$env:CLAUDE_CODE_ENTRYPOINT = "cli"
acc run "create a test function" -i 1
```

```bash
# Linux/Mac
export CLAUDECODE=1
export CLAUDE_CODE_ENTRYPOINT=cli
acc run "create a test function" -i 1
```

**Expected:** Should detect nested session and use direct execution mode

### 3. **Multiple Iterations Test** 🔄
```bash
acc run "build a calculator with add and subtract functions" -i 3
```

**Expected:** Should complete all iterations without authentication errors

### 4. **Dual-Agent Mode Test** 👥
```bash
acc run "implement user authentication" --dual-agent -i 2
```

**Expected:** Both manager and worker agents should work without authentication conflicts

## Automated Test Suite

### Run All Tests
```powershell
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File test-authentication-fix.ps1
```

### Run Individual Component Tests
```bash
# Test nested session detection
node -e "console.log('CLAUDECODE:', process.env.CLAUDECODE); require('./dist/services/sdkClaudeExecutor.js')"

# Test environment filtering
node test-env-propagation.js

# Test SDK integration
acc --verify-claude-cli
```

## Debug Mode Testing

### Enable Verbose Logging
```bash
# Maximum verbosity
acc run "test task" -i 1 -v --show-json

# Debug SDK operations
DEBUG=sdk:* acc run "test task" -i 1

# Monitor all events
acc run "test task" -i 1 --enable-monitoring
```

## Verification Checklist

### ✅ Core Functionality
- [ ] Basic command executes without errors
- [ ] Nested session detection message appears
- [ ] No authentication failures
- [ ] Direct execution mode activates

### ✅ Environment Handling
- [ ] CLAUDECODE variable detected correctly
- [ ] CLAUDE_CODE_ENTRYPOINT variable detected correctly
- [ ] Child processes don't inherit conflicting variables
- [ ] Invalid API keys filtered out

### ✅ Consistency
- [ ] Multiple consecutive runs work
- [ ] Works after system restart
- [ ] Works in different terminal environments
- [ ] Works with different task types

### ✅ Integration
- [ ] Works with monitoring dashboard
- [ ] Works with dual-agent mode
- [ ] Works with session continuity
- [ ] Works with all CLI flags

## Troubleshooting Tests

### If Tests Fail

1. **Check Build Status**
```bash
pnpm run build
```

2. **Verify Installation**
```bash
npm link  # Re-link if needed
acc --version
```

3. **Check Logs**
```bash
# View latest session log
ls -la ~/.automatic-claude-code/logs/automatic-claude-code/
tail -f ~/.automatic-claude-code/logs/automatic-claude-code/session-*.log
```

4. **Test Direct SDK**
```bash
# Test Claude CLI directly
claude --version
```

## Performance Testing

### Measure Detection Speed
```javascript
// Save as test-detection-speed.js
const { SDKClaudeExecutor } = require('./dist/services/sdkClaudeExecutor.js');
const logger = { debug: console.log, info: console.log, error: console.error };
const executor = new SDKClaudeExecutor(logger);

console.time('Detection');
const isNested = executor.detectNestedSession();
console.timeEnd('Detection');
console.log('Is nested:', isNested);
```

### Stress Test
```bash
# Run 10 tasks in sequence
for i in {1..10}; do
  echo "Test $i"
  acc run "task $i" -i 1
done
```

## Expected Test Results

### Success Indicators 🟢
- Execution time: < 10 seconds for simple tasks
- Detection message: Always appears in nested environments
- Exit code: 0 (success)
- No error messages about authentication
- Monitoring dashboard shows green status

### Failure Indicators 🔴
- "Claude Code process exited with code 1"
- "Authentication failed"
- "API key required"
- Timeout errors
- Missing nested session detection message

## Continuous Testing

### Git Hook Testing
Add to `.git/hooks/pre-push`:
```bash
#!/bin/bash
echo "Running authentication tests..."
powershell -ExecutionPolicy Bypass -File test-authentication-fix.ps1
if [ $? -ne 0 ]; then
  echo "Tests failed! Push aborted."
  exit 1
fi
```

### CI/CD Integration
```yaml
# .github/workflows/test.yml
- name: Test Authentication Fix
  run: |
    npm install
    npm run build
    npm test:auth
```

## Manual Validation Scenarios

### Scenario 1: Fresh Installation
1. Clone repository
2. Run `pnpm install`
3. Run `pnpm run build`
4. Run `npm link`
5. Test: `acc run "hello world" -i 1`

### Scenario 2: Upgrade Path
1. Update from old version
2. Run `pnpm install`
3. Run `pnpm run build`
4. Test commands still work

### Scenario 3: Cross-Platform
1. Test on Windows PowerShell
2. Test on Windows CMD
3. Test on WSL/Linux
4. Test on macOS

## Reporting Issues

If tests fail, collect:
1. Output of failed test command
2. Contents of session log
3. Output of `acc --version`
4. Output of `claude --version`
5. Environment variables: `echo $CLAUDECODE $CLAUDE_CODE_ENTRYPOINT`

---

*Last Updated: 2025-09-02*
*Version: 2.0.0 with Authentication Fix*