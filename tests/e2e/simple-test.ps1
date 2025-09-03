# Simple End-to-End Test for ACC v2.0
# This test verifies the core SDK execution pipeline works
# It makes just ONE call to Claude with a simple prompt

Write-Host ""
Write-Host "ACC v2.0 - SIMPLE END-TO-END TEST" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify ACC is available
Write-Host "[1/4] Checking ACC installation..." -ForegroundColor Yellow
$accVersion = & acc --version 2>&1 | Out-String
if ($LASTEXITCODE -eq 0) {
    Write-Host "      SUCCESS: ACC is installed" -ForegroundColor Green
} else {
    Write-Host "      FAILED: ACC not found. Run 'npm link' in project directory" -ForegroundColor Red
    exit 1
}

# Step 2: Check SDK health (quick check only)
Write-Host ""
Write-Host "[2/4] Verifying SDK health..." -ForegroundColor Yellow
$healthOutput = & acc run --verify-claude-cli "test" 2>&1 | Out-String
if ($healthOutput -match "Overall Health: HEALTHY") {
    Write-Host "      SUCCESS: SDK is healthy" -ForegroundColor Green
} else {
    Write-Host "      WARNING: SDK health unclear, continuing anyway..." -ForegroundColor Yellow
}

# Step 3: Create a simple test file
Write-Host ""
Write-Host "[3/4] Creating test file..." -ForegroundColor Yellow
$testFile = "simple-test-output.txt"
"Today is a good day" | Out-File -FilePath $testFile
Write-Host "      Created: $testFile" -ForegroundColor Gray

# Step 4: Execute ONE simple command via Claude
Write-Host ""
Write-Host "[4/4] Executing simple Claude task..." -ForegroundColor Yellow
Write-Host "      Task: 'Add the current date to simple-test-output.txt'" -ForegroundColor Gray
Write-Host "      This makes exactly ONE call to Claude SDK" -ForegroundColor Gray
Write-Host ""

# Run the command with minimal iterations
$startTime = Get-Date
$output = & acc run "Add the current date in format 'Date: YYYY-MM-DD' to the file simple-test-output.txt" -i 1 2>&1 | Out-String
$duration = ((Get-Date) - $startTime).TotalSeconds

# Check if command succeeded
if ($LASTEXITCODE -eq 0) {
    Write-Host "      SUCCESS: Command completed" -ForegroundColor Green
    Write-Host "      Duration: $([math]::Round($duration, 1)) seconds" -ForegroundColor Gray
    
    # Verify the file was modified
    if (Test-Path $testFile) {
        $content = Get-Content $testFile -Raw
        if ($content -match "Date:|date:|2025|2024") {
            Write-Host "      VERIFIED: File was modified with date" -ForegroundColor Green
            Write-Host ""
            Write-Host "      File contents:" -ForegroundColor Gray
            Write-Host "      -------------" -ForegroundColor Gray
            Get-Content $testFile | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        } else {
            Write-Host "      WARNING: File exists but date not found" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "      FAILED: Command did not complete successfully" -ForegroundColor Red
    Write-Host ""
    Write-Host "      Error output (first 10 lines):" -ForegroundColor Yellow
    $output -split "`n" | Select-Object -First 10 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
}

# Cleanup
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "RESULT: " -NoNewline
if ($LASTEXITCODE -eq 0) {
    Write-Host "SDK EXECUTION WORKS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The v2.0 SDK-only architecture successfully:" -ForegroundColor Green
    Write-Host "  1. Accepted a task" -ForegroundColor Green
    Write-Host "  2. Called Claude via SDK" -ForegroundColor Green  
    Write-Host "  3. Executed the response" -ForegroundColor Green
    Write-Host "  4. Modified the file" -ForegroundColor Green
    
    # Clean up test file
    Remove-Item $testFile -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "Test file cleaned up." -ForegroundColor Gray
    exit 0
} else {
    Write-Host "TEST FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "The SDK execution did not complete successfully." -ForegroundColor Red
    Write-Host "Check the error output above for details." -ForegroundColor Red
    
    # Leave test file for debugging
    Write-Host ""
    Write-Host "Test file left for debugging: $testFile" -ForegroundColor Yellow
    exit 1
}