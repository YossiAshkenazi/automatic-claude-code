# Simple Fix: Clear API Key Permanently
Write-Host "Clearing ANTHROPIC_API_KEY permanently..." -ForegroundColor Yellow

# Method 1: Clear from current session
$env:ANTHROPIC_API_KEY = $null

# Method 2: Clear from user environment (permanent)
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $null, "User")

# Method 3: Verify it's cleared
Write-Host "Verification:" -ForegroundColor Cyan
if ($env:ANTHROPIC_API_KEY) {
    Write-Host "  Still set in session" -ForegroundColor Red
} else {
    Write-Host "  Cleared from session" -ForegroundColor Green
}

$userEnv = [Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", "User")
if ($userEnv) {
    Write-Host "  Still in User environment" -ForegroundColor Red
} else {
    Write-Host "  Cleared from User environment" -ForegroundColor Green
}

Write-Host ""
Write-Host "Now close this PowerShell window and open a new one." -ForegroundColor Yellow
Write-Host "Then run: acc run `"write hello to hello.txt`" -i 1" -ForegroundColor Cyan