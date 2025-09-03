# Clean Environment Test
Write-Host "Clean Environment Test for v2.0 Architecture" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Clear ALL Claude-related environment variables
$env:ANTHROPIC_API_KEY = $null
$env:CLAUDE_API_KEY = $null
$env:CLAUDE_AUTH_TOKEN = $null
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\CLAUDE_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\CLAUDE_AUTH_TOKEN -ErrorAction SilentlyContinue

# Also clear from user environment
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $null, "User")
[Environment]::SetEnvironmentVariable("CLAUDE_API_KEY", $null, "User")
[Environment]::SetEnvironmentVariable("CLAUDE_AUTH_TOKEN", $null, "User")

Write-Host "Cleared all Claude-related environment variables" -ForegroundColor Green

# Verify environment is clean
Write-Host ""
Write-Host "Environment Check:" -ForegroundColor Yellow
if ($env:ANTHROPIC_API_KEY) { Write-Host "  ANTHROPIC_API_KEY: STILL SET" -ForegroundColor Red } else { Write-Host "  ANTHROPIC_API_KEY: Not set" -ForegroundColor Green }
if ($env:CLAUDE_API_KEY) { Write-Host "  CLAUDE_API_KEY: STILL SET" -ForegroundColor Red } else { Write-Host "  CLAUDE_API_KEY: Not set" -ForegroundColor Green }
if ($env:CLAUDE_AUTH_TOKEN) { Write-Host "  CLAUDE_AUTH_TOKEN: STILL SET" -ForegroundColor Red } else { Write-Host "  CLAUDE_AUTH_TOKEN: Not set" -ForegroundColor Green }

Write-Host ""
Write-Host "Testing Claude CLI directly first..." -ForegroundColor Yellow
try {
    # Test Claude CLI with a simple command
    $output = & claude -p "just say hello" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Claude CLI SUCCESS!" -ForegroundColor Green
        Write-Host "Output: $output" -ForegroundColor Gray
    } else {
        Write-Host "Claude CLI failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Output: $output" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error testing Claude CLI: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Now testing ACC v2.0 architecture..." -ForegroundColor Yellow
Write-Host "Running: acc run `"write hello world to success.txt`" -i 1" -ForegroundColor Gray
Write-Host ""

# Test ACC
& acc run "write hello world to success.txt" -i 1