# Testing Guide - Automatic Claude Code v2.0

## 🚀 Quick Test Commands

### 1. Basic Health Check
```bash
# Verify SDK and Claude CLI are properly installed
acc run --verify-claude-cli "test"

# Expected output:
# 🟢 Overall Health: HEALTHY
# SDK Available: ✅
# Claude CLI: ✅
# Authentication: ✅
```

### 2. Simple Task Test
```bash
# Test basic code generation
acc run "write a hello world function in JavaScript" -i 1

# Test file modification
acc run "add a fibonacci function to test-v2.js" -i 1

# Test with verbose output
acc run "create a simple calculator class" -i 2 -v
```

### 3. Dual-Agent Mode Test
```bash
# Test manager-worker coordination
acc run "implement a user authentication system" --dual-agent -i 5

# With verbose monitoring
acc run "refactor the test-v2.js file" --dual-agent -i 3 -v
```

## 📋 Comprehensive Test Suite

### Prerequisites Testing

#### 1. Verify Claude CLI Installation
```bash
# Check Claude CLI is installed
claude --version
# Expected: Claude Code version 1.0.100 or higher

# Check if authenticated
echo $ANTHROPIC_API_KEY
# If empty, Claude will use browser authentication
# If set, ensure it's valid
```

#### 2. Verify ACC Installation
```bash
# Check acc command is available
acc --version
# Expected: 1.2.0 or higher

# Check installation directory
which acc
# Should point to your automatic-claude-code directory
```

### Core Functionality Tests

#### Test 1: SDK Health Verification
```bash
# Run comprehensive health check
acc run --verify-claude-cli "test task"

# Check SDK status
acc run --sdk-status "test"
```

#### Test 2: Basic Code Generation
```bash
# Create a test file
echo "// Test file for v2.0" > test-v2.js

# Generate code
acc run "add a function that calculates factorial to test-v2.js" -i 1

# Verify the file was modified
cat test-v2.js
```

#### Test 3: Multi-File Operations
```bash
# Create multiple files
acc run "create a basic Express.js API with user and product routes" -i 3

# Should create multiple files:
# - app.js or server.js
# - routes/users.js
# - routes/products.js
```

#### Test 4: Error Handling and Recovery
```bash
# Test with invalid API key (if using API key auth)
export ANTHROPIC_API_KEY="invalid-key-12345"
acc run "simple test" -i 1
# Should show clear error message with recovery instructions

# Remove invalid key
unset ANTHROPIC_API_KEY

# Test retry mechanism (simulate network issues)
# The system should automatically retry with exponential backoff
```

#### Test 5: Session Management
```bash
# View session history
acc history

# Check specific session
acc session [session-id]

# Test session continuation
acc run "continue the previous task" -i 2
```

### Advanced Feature Tests

#### Test 6: Dual-Agent Coordination
```bash
# Start monitoring dashboard first (optional)
cd dual-agent-monitor
pnpm run dev
# Open http://localhost:6011 in browser

# Run dual-agent task
acc run "design and implement a REST API for a todo application" --dual-agent -i 8 -v

# Monitor coordination in dashboard
```

#### Test 7: Complex Refactoring
```bash
# Create a messy test file
cat > messy.js << 'EOF'
function doStuff(x,y,z){
var result=x+y*z;console.log("Result: "+result);
return result}
function getData(){var data=[1,2,3,4,5];
for(var i=0;i<data.length;i++){console.log(data[i])}
return data}
EOF

# Refactor with ACC
acc run "refactor messy.js to use modern JavaScript with proper formatting" -i 3

# Check results
cat messy.js
```

#### Test 8: Documentation Generation
```bash
# Generate documentation
acc run "analyze all JavaScript files and create comprehensive documentation" -i 4

# Should create or update README.md with:
# - Project structure
# - Function descriptions
# - Usage examples
```

#### Test 9: Test Generation
```bash
# Create a simple module
cat > math.js << 'EOF'
function add(a, b) { return a + b; }
function multiply(a, b) { return a * b; }
function divide(a, b) { 
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}
module.exports = { add, multiply, divide };
EOF

# Generate tests
acc run "create comprehensive unit tests for math.js using Jest" -i 3

# Should create math.test.js with proper test cases
```

#### Test 10: Bug Fixing
```bash
# Create a buggy file
cat > buggy.js << 'EOF'
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i <= items.length; i++) {  // Bug: should be i < items.length
    total += items[i].price;  // Will throw error on last iteration
  }
  return total;
}

function processUser(user) {
  console.log(user.name.toUpperCase());  // Bug: no null check
  return user.age * 2;  // Bug: no type check
}
EOF

# Fix bugs
acc run "find and fix all bugs in buggy.js" -i 3

# Verify fixes
cat buggy.js
```

### Performance Tests

#### Test 11: Large File Processing
```bash
# Create a large file (1000+ lines)
for i in {1..100}; do
  echo "function func$i() { return $i * 2; }" >> large.js
done

# Process large file
acc run "add JSDoc comments to all functions in large.js" -i 5

# Measure performance
time acc run "optimize all functions in large.js" -i 3
```

#### Test 12: Concurrent Operations
```bash
# Test parallel processing
acc run "analyze and document all .js files in the current directory" -i 4 -v

# Should efficiently process multiple files
```

### Error Recovery Tests

#### Test 13: Circuit Breaker Test
```bash
# Trigger multiple failures to test circuit breaker
# (This simulates network issues)
export ANTHROPIC_API_KEY="invalid-to-trigger-failures"
for i in {1..5}; do
  acc run "test $i" -i 1
done
# Circuit breaker should open after 3 failures

# Wait 30 seconds for cooldown
sleep 30

# Remove invalid key and retry
unset ANTHROPIC_API_KEY
acc run "test recovery" -i 1
# Should work after circuit breaker resets
```

#### Test 14: Graceful Degradation
```bash
# Test fallback mechanisms
acc run "simple task" --use-legacy -i 1
# Should fall back to legacy mode if SDK unavailable
```

### Integration Tests

#### Test 15: Git Integration
```bash
# Initialize git repo
git init test-repo
cd test-repo

# Create initial file
echo "# Test Project" > README.md
git add .
git commit -m "Initial commit"

# Use ACC to add feature
acc run "add a .gitignore file for Node.js projects" -i 1

# Verify git sees changes
git status
git diff
```

#### Test 16: TypeScript Support
```bash
# Create TypeScript file
cat > test.ts << 'EOF'
function greet(name: string) {
  console.log(`Hello, ${name}`);
}
EOF

# Enhance with ACC
acc run "add TypeScript interfaces and a class to test.ts" -i 2

# Verify TypeScript syntax
cat test.ts
```

## 🤖 Automated Test Script

Create `test-v2.sh` (Linux/Mac) or `test-v2.ps1` (Windows):

### Windows PowerShell Script (test-v2.ps1)
```powershell
# Automatic Claude Code v2.0 Test Suite
Write-Host "🧪 Starting ACC v2.0 Test Suite" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n📋 Test 1: SDK Health Check" -ForegroundColor Yellow
& acc run --verify-claude-cli "test"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Health check failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Health check passed" -ForegroundColor Green

# Test 2: Basic Generation
Write-Host "`n📋 Test 2: Basic Code Generation" -ForegroundColor Yellow
"// Test file" | Out-File -FilePath test-gen.js
& acc run "add a sum function to test-gen.js" -i 1
if ((Get-Content test-gen.js | Select-String "function").Count -eq 0) {
    Write-Host "❌ Code generation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Code generation passed" -ForegroundColor Green

# Test 3: Error Handling
Write-Host "`n📋 Test 3: Error Handling" -ForegroundColor Yellow
$env:ANTHROPIC_API_KEY = "invalid-test-key"
$output = & acc run "test" -i 1 2>&1 | Out-String
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
if ($output -notmatch "Invalid API Key") {
    Write-Host "❌ Error handling failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Error handling passed" -ForegroundColor Green

# Test 4: Session Management
Write-Host "`n📋 Test 4: Session Management" -ForegroundColor Yellow
$sessions = & acc history 2>&1 | Out-String
if ($sessions -notmatch "Session") {
    Write-Host "⚠️ No sessions found (expected on first run)" -ForegroundColor Yellow
} else {
    Write-Host "✅ Session management working" -ForegroundColor Green
}

# Cleanup
Remove-Item test-gen.js -ErrorAction SilentlyContinue

Write-Host "`n✅ All tests completed successfully!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
```

### Linux/Mac Bash Script (test-v2.sh)
```bash
#!/bin/bash

# Automatic Claude Code v2.0 Test Suite
echo -e "\033[36m🧪 Starting ACC v2.0 Test Suite\033[0m"
echo -e "\033[36m================================\033[0m"

# Test 1: Health Check
echo -e "\n\033[33m📋 Test 1: SDK Health Check\033[0m"
acc run --verify-claude-cli "test"
if [ $? -ne 0 ]; then
    echo -e "\033[31m❌ Health check failed\033[0m"
    exit 1
fi
echo -e "\033[32m✅ Health check passed\033[0m"

# Test 2: Basic Generation
echo -e "\n\033[33m📋 Test 2: Basic Code Generation\033[0m"
echo "// Test file" > test-gen.js
acc run "add a sum function to test-gen.js" -i 1
if ! grep -q "function" test-gen.js; then
    echo -e "\033[31m❌ Code generation failed\033[0m"
    exit 1
fi
echo -e "\033[32m✅ Code generation passed\033[0m"

# Test 3: Error Handling
echo -e "\n\033[33m📋 Test 3: Error Handling\033[0m"
export ANTHROPIC_API_KEY="invalid-test-key"
output=$(acc run "test" -i 1 2>&1)
unset ANTHROPIC_API_KEY
if [[ ! "$output" =~ "Invalid API Key" ]]; then
    echo -e "\033[31m❌ Error handling failed\033[0m"
    exit 1
fi
echo -e "\033[32m✅ Error handling passed\033[0m"

# Test 4: Session Management
echo -e "\n\033[33m📋 Test 4: Session Management\033[0m"
sessions=$(acc history 2>&1)
if [[ ! "$sessions" =~ "Session" ]]; then
    echo -e "\033[33m⚠️ No sessions found (expected on first run)\033[0m"
else
    echo -e "\033[32m✅ Session management working\033[0m"
fi

# Cleanup
rm -f test-gen.js

echo -e "\n\033[32m✅ All tests completed successfully!\033[0m"
echo -e "\033[36m================================\033[0m"
```

## 🔍 Monitoring Tests

### Start Monitoring Dashboard
```bash
# Terminal 1: Start monitoring server
cd dual-agent-monitor
pnpm run dev

# Terminal 2: Run tests with monitoring
acc run "implement a feature" --dual-agent -i 5

# Browser: View dashboard
open http://localhost:6011
```

### Check API Health
```bash
# API health endpoint
curl http://localhost:4005/api/health

# WebSocket connection test
wscat -c ws://localhost:4005
```

## 📊 Expected Test Results

### Successful Test Indicators
- ✅ SDK health check shows all green
- ✅ Code generation creates/modifies files correctly
- ✅ Error messages are clear and include recovery steps
- ✅ Sessions are saved and retrievable
- ✅ Dual-agent mode coordinates properly
- ✅ Circuit breaker activates and resets correctly

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| "acc command not found" | Run `npm link` in project directory |
| "Claude CLI not found" | Install: `npm install -g @anthropic-ai/claude-code` |
| "Invalid API Key" | Unset: `unset ANTHROPIC_API_KEY` or use valid key |
| "SDK not available" | Run `acc run --verify-claude-cli "test"` to diagnose |
| "Circuit breaker open" | Wait 30 seconds and retry |

## 🚦 Test Coverage Summary

Run all tests to verify:
- **Core Functionality**: ✅ SDK integration, code generation
- **Error Handling**: ✅ Invalid keys, network issues, recovery
- **Advanced Features**: ✅ Dual-agent, refactoring, documentation
- **Performance**: ✅ Large files, concurrent operations
- **Integration**: ✅ Git, TypeScript, monitoring

## 💡 Tips for Testing

1. **Start Simple**: Run health check first
2. **Use Verbose Mode**: Add `-v` flag for detailed output
3. **Monitor Dashboard**: Keep dashboard open during dual-agent tests
4. **Check Logs**: Review session logs in `~/.automatic-claude-code/logs/`
5. **Clean Environment**: Unset `ANTHROPIC_API_KEY` if having auth issues

---

*For additional help, run `acc --help` or check the [documentation](./docs/).*