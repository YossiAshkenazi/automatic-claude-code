# Test Script for Authentication Fix in Automatic Claude Code
# This script validates that nested session detection and authentication work correctly

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Authentication Fix Validation Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testResults = @()
$allTestsPassed = $true

# Function to run a test and capture results
function Run-Test {
    param(
        [string]$TestName,
        [string]$Command,
        [string]$ExpectedOutput,
        [int]$TimeoutSeconds = 120
    )
    
    Write-Host "Test: $TestName" -ForegroundColor Yellow
    Write-Host "Command: $Command" -ForegroundColor Gray
    
    $startTime = Get-Date
    $job = Start-Job -ScriptBlock {
        param($cmd)
        $output = & cmd /c $cmd 2>&1
        return $output -join "`n"
    } -ArgumentList $Command
    
    $result = Wait-Job $job -Timeout $TimeoutSeconds
    
    if ($result) {
        $output = Receive-Job $job
        $duration = ((Get-Date) - $startTime).TotalSeconds
        
        if ($output -match $ExpectedOutput) {
            Write-Host "✅ PASSED" -ForegroundColor Green
            Write-Host "  Duration: $([math]::Round($duration, 2))s" -ForegroundColor Gray
            $testResults += @{
                Test = $TestName
                Status = "PASSED"
                Duration = $duration
            }
        } else {
            Write-Host "❌ FAILED - Expected output not found" -ForegroundColor Red
            Write-Host "  Expected: $ExpectedOutput" -ForegroundColor Red
            Write-Host "  Got: $($output.Substring(0, [Math]::Min(200, $output.Length)))..." -ForegroundColor Red
            $script:allTestsPassed = $false
            $testResults += @{
                Test = $TestName
                Status = "FAILED"
                Duration = $duration
                Error = "Expected output not found"
            }
        }
    } else {
        Write-Host "❌ FAILED - Command timed out after $TimeoutSeconds seconds" -ForegroundColor Red
        Stop-Job $job
        $script:allTestsPassed = $false
        $testResults += @{
            Test = $TestName
            Status = "TIMEOUT"
            Duration = $TimeoutSeconds
        }
    }
    
    Remove-Job $job -Force
    Write-Host ""
}

# Test 1: Basic nested session detection
Write-Host "=== Test 1: Basic Nested Session Detection ===" -ForegroundColor Cyan
Run-Test -TestName "Nested Session Detection" `
         -Command 'acc run "return hello world" -i 1' `
         -ExpectedOutput "Detected nested session.*using direct execution mode"

# Test 2: Verify no authentication errors
Write-Host "=== Test 2: No Authentication Errors ===" -ForegroundColor Cyan
Run-Test -TestName "No Auth Errors" `
         -Command 'acc run "create a test function" -i 1' `
         -ExpectedOutput "Execution completed successfully"

# Test 3: Multiple iterations work
Write-Host "=== Test 3: Multiple Iterations ===" -ForegroundColor Cyan
Run-Test -TestName "Multiple Iterations" `
         -Command 'acc run "implement a counter function" -i 2' `
         -ExpectedOutput "SDK autopilot loop completed"

# Test 4: Dual-agent mode compatibility
Write-Host "=== Test 4: Dual-Agent Mode ===" -ForegroundColor Cyan
Run-Test -TestName "Dual-Agent Mode" `
         -Command 'acc run "test task" --dual-agent -i 1' `
         -ExpectedOutput "(Manager Agent|Worker Agent|Detected nested session)"

# Test 5: Verify environment variable filtering
Write-Host "=== Test 5: Environment Variable Check ===" -ForegroundColor Cyan
$env:CLAUDECODE = "1"
$env:CLAUDE_CODE_ENTRYPOINT = "cli"
Run-Test -TestName "Env Var Filtering" `
         -Command 'acc run "simple task" -i 1' `
         -ExpectedOutput "nested session detected"

# Test 6: SDK availability check
Write-Host "=== Test 6: SDK Availability ===" -ForegroundColor Cyan
Run-Test -TestName "SDK Available" `
         -Command 'acc --verify-claude-cli' `
         -ExpectedOutput "(Claude Code CLI is installed|claude)"

# Summary Report
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary Report" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passedTests = ($testResults | Where-Object { $_.Status -eq "PASSED" }).Count
$failedTests = ($testResults | Where-Object { $_.Status -eq "FAILED" }).Count
$timeoutTests = ($testResults | Where-Object { $_.Status -eq "TIMEOUT" }).Count

Write-Host "Total Tests: $($testResults.Count)" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host "Timeouts: $timeoutTests" -ForegroundColor Yellow

if ($allTestsPassed) {
    Write-Host ""
    Write-Host "✅ ALL TESTS PASSED! Authentication fix is working correctly." -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "❌ SOME TESTS FAILED. Please review the errors above." -ForegroundColor Red
    exit 1
}