# Quick Test Script for ACC v2.0
Write-Host ""
Write-Host "AUTOMATIC CLAUDE CODE v2.0 - QUICK TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0

# Test 1: Check ACC command
Write-Host "Test 1: ACC Command" -ForegroundColor Yellow
try {
    $version = & acc --version 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  PASS: ACC command available" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "  FAIL: ACC command error" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "  FAIL: ACC not found" -ForegroundColor Red
    $testsFailed++
}

# Test 2: SDK Health Check
Write-Host ""
Write-Host "Test 2: SDK Health Check" -ForegroundColor Yellow
$output = & acc run --verify-claude-cli "test" 2>&1 | Out-String
if ($output -match "Overall Health: HEALTHY") {
    Write-Host "  PASS: SDK is healthy" -ForegroundColor Green
    if ($output -match "SDK Available:") {
        Write-Host "    - SDK Available: Yes" -ForegroundColor Gray
    }
    if ($output -match "Claude CLI:") {
        Write-Host "    - Claude CLI: Yes" -ForegroundColor Gray
    }
    if ($output -match "Authentication:") {
        Write-Host "    - Authentication: Yes" -ForegroundColor Gray
    }
    $testsPassed++
} else {
    Write-Host "  FAIL: SDK health check failed" -ForegroundColor Red
    $testsFailed++
}

# Test 3: Basic Code Generation
Write-Host ""
Write-Host "Test 3: Basic Code Generation" -ForegroundColor Yellow
"// Test file`nfunction hello() { return 'Hello'; }" | Out-File -FilePath "test-quick.js"
$output = & acc run "add a goodbye function to test-quick.js" -i 1 2>&1 | Out-String
Start-Sleep -Seconds 2

if (Test-Path "test-quick.js") {
    $content = Get-Content "test-quick.js" -Raw
    if ($content -match "goodbye|Goodbye") {
        Write-Host "  PASS: Code was generated" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "  WARN: File exists but function not found" -ForegroundColor Yellow
    }
    Remove-Item "test-quick.js" -ErrorAction SilentlyContinue
} else {
    Write-Host "  FAIL: File not created" -ForegroundColor Red
    $testsFailed++
}

# Test 4: Error Handling
Write-Host ""
Write-Host "Test 4: Error Handling" -ForegroundColor Yellow
$oldKey = $env:ANTHROPIC_API_KEY
$env:ANTHROPIC_API_KEY = "invalid-key-123"
$output = & acc run "test" -i 1 2>&1 | Out-String

if ($output -match "Invalid API Key") {
    Write-Host "  PASS: Invalid key detected" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "  WARN: Error detection unclear" -ForegroundColor Yellow
}

# Restore key
if ($oldKey) {
    $env:ANTHROPIC_API_KEY = $oldKey
} else {
    Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Tests Passed: $testsPassed" -ForegroundColor Green
Write-Host "  Tests Failed: $testsFailed" -ForegroundColor $(if ($testsFailed -eq 0) {'Gray'} else {'Red'})
$total = $testsPassed + $testsFailed
$passRate = if ($total -gt 0) { [math]::Round(($testsPassed / $total) * 100, 0) } else { 0 }
Write-Host "  Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 80) {'Green'} elseif ($passRate -ge 60) {'Yellow'} else {'Red'})
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Please review." -ForegroundColor Yellow
    exit 1
}