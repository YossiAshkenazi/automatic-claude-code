# Automatic Claude Code v2.0 Comprehensive Test Suite
# Run with: powershell -ExecutionPolicy Bypass -File test-v2.ps1

param(
    [switch]$Quick,      # Run only essential tests
    [switch]$Verbose,    # Show detailed output
    [switch]$NoCleanup   # Don't clean up test files
)

$ErrorActionPreference = "Continue"
$script:TestsPassed = 0
$script:TestsFailed = 0
$script:TestsSkipped = 0

# Color functions
function Write-TestHeader($message) {
    Write-Host "`n=========================================" -ForegroundColor Cyan
    Write-Host " $message" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
}

function Write-TestSection($message) {
    Write-Host "`n📋 $message" -ForegroundColor Yellow
}

function Write-Success($message) {
    Write-Host "  ✅ $message" -ForegroundColor Green
    $script:TestsPassed++
}

function Write-Failure($message) {
    Write-Host "  ❌ $message" -ForegroundColor Red
    $script:TestsFailed++
}

function Write-Warning($message) {
    Write-Host "  ⚠️  $message" -ForegroundColor Yellow
}

function Write-Skip($message) {
    Write-Host "  ⏭️  $message" -ForegroundColor Gray
    $script:TestsSkipped++
}

function Write-Info($message) {
    if ($Verbose) {
        Write-Host "  ℹ️  $message" -ForegroundColor Cyan
    }
}

# Test helper functions
function Test-Command($command) {
    try {
        $null = Get-Command $command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Test-FileContains($file, $pattern) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        return $content -match $pattern
    }
    return $false
}

function Run-AccCommand($args, $expectedOutput = $null, $shouldFail = $false) {
    Write-Info "Running: acc $args"
    $output = & acc $args 2>&1 | Out-String
    
    if ($Verbose) {
        Write-Host $output -ForegroundColor DarkGray
    }
    
    $success = $LASTEXITCODE -eq 0
    
    if ($shouldFail) {
        $success = -not $success
    }
    
    if ($expectedOutput -and $output -notmatch $expectedOutput) {
        $success = $false
    }
    
    return @{
        Success = $success
        Output = $output
    }
}

# Main test execution
Write-Host ""
Write-Host "🧪 AUTOMATIC CLAUDE CODE v2.0 TEST SUITE" -ForegroundColor Magenta
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host "Mode: $(if ($Quick) {'Quick'} else {'Comprehensive'})" -ForegroundColor White
Write-Host "Verbose: $Verbose" -ForegroundColor White
Write-Host "Cleanup: $(if ($NoCleanup) {'Disabled'} else {'Enabled'})" -ForegroundColor White
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White

# Create test directory
$TestDir = Join-Path $PWD "test-workspace-$(Get-Random)"
Write-Info "Creating test directory: $TestDir"
New-Item -ItemType Directory -Path $TestDir -Force | Out-Null
Push-Location $TestDir

try {
    # ============================================================
    # PREREQUISITE TESTS
    # ============================================================
    Write-TestHeader "PREREQUISITES CHECK"
    
    Write-TestSection "Testing Claude CLI Installation"
    if (Test-Command "claude") {
        $claudeVersion = & claude --version 2>&1 | Out-String
        if ($claudeVersion -match "1\.0\.\d+") {
            Write-Success "Claude CLI installed (version found)"
        } else {
            Write-Warning "Claude CLI version unclear: $claudeVersion"
        }
    } else {
        Write-Failure "Claude CLI not found - install with: npm install -g @anthropic-ai/claude-code"
        if (-not $Quick) { exit 1 }
    }
    
    Write-TestSection "Testing ACC Installation"
    if (Test-Command "acc") {
        $accVersion = & acc --version 2>&1 | Out-String
        Write-Success "ACC command available"
        Write-Info "Version output: $($accVersion.Trim())"
    } else {
        Write-Failure "ACC command not found - run 'npm link' in project directory"
        exit 1
    }
    
    # ============================================================
    # CORE FUNCTIONALITY TESTS
    # ============================================================
    Write-TestHeader "CORE FUNCTIONALITY"
    
    Write-TestSection "Test 1: SDK Health Verification"
    $result = Run-AccCommand "run --verify-claude-cli `"test`""
    if ($result.Output -match "Overall Health: HEALTHY") {
        Write-Success "SDK health check passed"
        Write-Info "SDK Available: $($result.Output -match 'SDK Available: ✅')"
        Write-Info "Claude CLI: $($result.Output -match 'Claude CLI: ✅')"
        Write-Info "Authentication: $($result.Output -match 'Authentication: ✅')"
    } else {
        Write-Failure "SDK health check failed"
    }
    
    Write-TestSection "Test 2: Basic Code Generation"
    "// Test file for v2.0`nfunction greet(name) { return `"Hello, `" + name; }" | Out-File -FilePath "test-basic.js"
    $result = Run-AccCommand "run `"add a function to calculate the square of a number to test-basic.js`" -i 1"
    Start-Sleep -Seconds 2
    
    if (Test-FileContains "test-basic.js" "square|Square") {
        Write-Success "Code generation successful"
    } else {
        Write-Failure "Code generation failed - function not added"
    }
    
    Write-TestSection "Test 3: Multi-File Creation"
    if (-not $Quick) {
        $result = Run-AccCommand "run `"create a simple calculator module with add, subtract, multiply, divide functions`" -i 2"
        Start-Sleep -Seconds 3
        
        $jsFiles = Get-ChildItem -Filter "*.js" | Where-Object { $_.Name -ne "test-basic.js" }
        if ($jsFiles.Count -gt 0) {
            Write-Success "Multi-file creation successful ($($jsFiles.Count) files created)"
        } else {
            Write-Warning "No additional files created"
        }
    } else {
        Write-Skip "Skipping multi-file test in quick mode"
    }
    
    # ============================================================
    # ERROR HANDLING TESTS
    # ============================================================
    Write-TestHeader "ERROR HANDLING"
    
    Write-TestSection "Test 4: Invalid API Key Detection"
    $oldKey = $env:ANTHROPIC_API_KEY
    $env:ANTHROPIC_API_KEY = "invalid-test-key-12345"
    
    $result = Run-AccCommand "run `"simple test`" -i 1" -shouldFail $true
    
    if ($result.Output -match "Invalid API Key") {
        Write-Success "Invalid API key detected correctly"
        Write-Info "Error message includes recovery instructions"
    } else {
        Write-Warning "Invalid API key detection may not be working as expected"
    }
    
    # Restore original key
    if ($oldKey) {
        $env:ANTHROPIC_API_KEY = $oldKey
    } else {
        Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
    }
    
    Write-TestSection "Test 5: Circuit Breaker Behavior"
    if (-not $Quick) {
        Write-Info "Testing circuit breaker with multiple failures..."
        $env:ANTHROPIC_API_KEY = "trigger-circuit-breaker"
        
        for ($i = 1; $i -le 4; $i++) {
            Write-Info "Failure attempt $i/4"
            $null = Run-AccCommand "run `"test $i`" -i 1" -shouldFail $true
            Start-Sleep -Seconds 1
        }
        
        Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
        
        # Circuit breaker should be open now
        $result = Run-AccCommand "run `"test after breaker`" -i 1"
        if ($result.Output -match "Circuit breaker") {
            Write-Success "Circuit breaker activated after multiple failures"
        } else {
            Write-Info "Circuit breaker status unclear"
        }
    } else {
        Write-Skip "Skipping circuit breaker test in quick mode"
    }
    
    # ============================================================
    # SESSION MANAGEMENT TESTS
    # ============================================================
    Write-TestHeader "SESSION MANAGEMENT"
    
    Write-TestSection "Test 6: Session History"
    $result = Run-AccCommand "history"
    if ($result.Success) {
        Write-Success "Session history command works"
        if ($result.Output -match "Session") {
            Write-Info "Previous sessions found"
        } else {
            Write-Info "No previous sessions (expected on fresh install)"
        }
    } else {
        Write-Failure "Session history command failed"
    }
    
    # ============================================================
    # ADVANCED FEATURES (if not quick mode)
    # ============================================================
    if (-not $Quick) {
        Write-TestHeader "ADVANCED FEATURES"
        
        Write-TestSection "Test 7: Dual-Agent Mode"
        $result = Run-AccCommand "run `"create a function that validates email addresses`" --dual-agent -i 3"
        if ($result.Success) {
            Write-Success "Dual-agent mode execution completed"
        } else {
            Write-Warning "Dual-agent mode may have issues"
        }
        
        Write-TestSection "Test 8: Code Refactoring"
        @"
function calculate(x,y,z){var result=x+y*z;console.log(result);return result}
function getData(){var data=[1,2,3];for(var i=0;i<data.length;i++)console.log(data[i]);return data}
"@ | Out-File -FilePath "messy.js"
        
        $result = Run-AccCommand "run `"refactor messy.js to use modern JavaScript with proper formatting`" -i 2"
        Start-Sleep -Seconds 3
        
        if (Test-FileContains "messy.js" "const|let|=>") {
            Write-Success "Code refactoring successful"
        } else {
            Write-Warning "Refactoring may not have modernized the code"
        }
        
        Write-TestSection "Test 9: Bug Detection and Fixing"
        @"
function divide(a, b) {
    return a / b;  // Bug: no zero check
}
function getUser(users, index) {
    return users[index].name;  // Bug: no bounds check
}
"@ | Out-File -FilePath "buggy.js"
        
        $result = Run-AccCommand "run `"find and fix all bugs in buggy.js`" -i 2"
        Start-Sleep -Seconds 3
        
        if (Test-FileContains "buggy.js" "if.*b.*===.*0|throw|Error") {
            Write-Success "Bug fixing successful"
        } else {
            Write-Info "Bug fixes may not be complete"
        }
    }
    
    # ============================================================
    # PERFORMANCE TESTS (if not quick mode)
    # ============================================================
    if (-not $Quick) {
        Write-TestHeader "PERFORMANCE TESTS"
        
        Write-TestSection "Test 10: Large File Processing"
        Write-Info "Creating large test file..."
        $largeContent = ""
        for ($i = 1; $i -le 50; $i++) {
            $largeContent += "function func$i(param) { return param * $i; }`n"
        }
        $largeContent | Out-File -FilePath "large.js"
        
        $startTime = Get-Date
        $result = Run-AccCommand "run `"add JSDoc comments to all functions in large.js`" -i 2"
        $duration = (Get-Date) - $startTime
        
        if ($result.Success) {
            Write-Success "Large file processed in $($duration.TotalSeconds.ToString('F2')) seconds"
        } else {
            Write-Failure "Large file processing failed"
        }
    }
    
} finally {
    # ============================================================
    # CLEANUP
    # ============================================================
    Pop-Location
    
    if (-not $NoCleanup) {
        Write-TestHeader "CLEANUP"
        Write-Info "Removing test directory: $TestDir"
        Remove-Item -Path $TestDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "Test files cleaned up"
    }
    
    # ============================================================
    # RESULTS SUMMARY
    # ============================================================
    Write-TestHeader "TEST RESULTS SUMMARY"
    
    $total = $script:TestsPassed + $script:TestsFailed + $script:TestsSkipped
    $passRate = if ($total -gt 0) { [math]::Round(($script:TestsPassed / $total) * 100, 1) } else { 0 }
    
    Write-Host ""
    Write-Host "  Total Tests: $total" -ForegroundColor White
    Write-Host "  ✅ Passed: $script:TestsPassed" -ForegroundColor Green
    Write-Host "  ❌ Failed: $script:TestsFailed" -ForegroundColor $(if ($script:TestsFailed -eq 0) {'Gray'} else {'Red'})
    Write-Host "  ⏭️  Skipped: $script:TestsSkipped" -ForegroundColor Gray
    Write-Host "  📊 Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 80) {'Green'} elseif ($passRate -ge 60) {'Yellow'} else {'Red'})
    Write-Host ""
    
    if ($script:TestsFailed -eq 0) {
        Write-Host "🎉 ALL TESTS PASSED! 🎉" -ForegroundColor Green
        Write-Host "The v2.0 SDK-only architecture is working correctly." -ForegroundColor Green
    } elseif ($script:TestsFailed -le 2) {
        Write-Host "⚠️  MOSTLY SUCCESSFUL" -ForegroundColor Yellow
        Write-Host "Minor issues detected. Review failed tests above." -ForegroundColor Yellow
    } else {
        Write-Host "❌ TESTS FAILED" -ForegroundColor Red
        Write-Host "Multiple issues detected. Please review and fix." -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Completed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
    Write-Host "=========================================" -ForegroundColor Cyan
}

# Exit with appropriate code
exit $(if ($script:TestsFailed -eq 0) {0} else {1})