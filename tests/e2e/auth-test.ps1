# Claude Authentication Test
Write-Host "Claude Authentication Status Test" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if Claude is already authenticated by testing a simple command
Write-Host "Testing Claude authentication status..." -ForegroundColor Yellow

# Try to run claude with a simple status command
try {
    $output = & claude --help 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Claude CLI is accessible" -ForegroundColor Green
    } else {
        Write-Host "Claude CLI has issues" -ForegroundColor Red
    }
} catch {
    Write-Host "Error accessing Claude CLI: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Now let's test ACC with a simple task..." -ForegroundColor Yellow
Write-Host "If this prompts for authentication, the fix is working!" -ForegroundColor Cyan
Write-Host ""

# Test with a very simple task
& acc run "Create a file called success.txt with the text 'v2.0 works!'" -i 1

Write-Host ""
Write-Host "Check if success.txt was created:" -ForegroundColor Yellow
if (Test-Path "success.txt") {
    $content = Get-Content "success.txt" -Raw
    Write-Host "SUCCESS! File created with content: $content" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 v2.0 SDK-only architecture is working!" -ForegroundColor Green
} else {
    Write-Host "File not created - authentication may be needed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Try running 'claude' to authenticate, then test again" -ForegroundColor Cyan
}