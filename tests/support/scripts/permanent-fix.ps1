# Permanent Fix for ANTHROPIC_API_KEY Issue
Write-Host "🔧 PERMANENT FIX: Removing ANTHROPIC_API_KEY from system environment" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# Clear from current session
Write-Host "1. Clearing from current PowerShell session..." -ForegroundColor Yellow
$env:ANTHROPIC_API_KEY = $null
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue

# Clear from user environment variables (permanent)
Write-Host "2. Removing from User environment variables..." -ForegroundColor Yellow
try {
    [Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $null, [EnvironmentVariableTarget]::User)
    Write-Host "   SUCCESS: Removed from User environment" -ForegroundColor Green
} catch {
    Write-Host "   No User environment variable found (OK)" -ForegroundColor Gray
}

# Clear from system environment variables (permanent, requires admin)
Write-Host "3. Checking System environment variables..." -ForegroundColor Yellow
try {
    $systemValue = [Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", [EnvironmentVariableTarget]::Machine)
    if ($systemValue) {
        Write-Host "   WARNING: System-level ANTHROPIC_API_KEY found" -ForegroundColor Red
        Write-Host "   To remove, run PowerShell as Administrator and execute:" -ForegroundColor Yellow
        Write-Host "   [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', `$null, [EnvironmentVariableTarget]::Machine)" -ForegroundColor Cyan
    } else {
        Write-Host "   No System environment variable found (Good)" -ForegroundColor Green
    }
} catch {
    Write-Host "   Cannot check System variables (need admin)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "4. Verification:" -ForegroundColor Yellow
$currentValue = [Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", [EnvironmentVariableTarget]::Process)
if ($currentValue) {
    Write-Host "   ERROR: Still found in current process" -ForegroundColor Red
} else {
    Write-Host "   SUCCESS: Cleared from current process" -ForegroundColor Green
}

$userValue = [Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", [EnvironmentVariableTarget]::User)
if ($userValue) {
    Write-Host "   ERROR: Still found in User environment" -ForegroundColor Red
} else {
    Write-Host "   SUCCESS: Cleared from User environment" -ForegroundColor Green
}

Write-Host ""
Write-Host "5. Starting fresh PowerShell session to test..." -ForegroundColor Yellow
Write-Host "   (This ensures clean environment variables)" -ForegroundColor Gray
Write-Host ""

# Start a completely fresh PowerShell process to test
$testScript = @"
Write-Host 'Fresh PowerShell Session Test:' -ForegroundColor Cyan
if (`$env:ANTHROPIC_API_KEY) {
    Write-Host '  ERROR: ANTHROPIC_API_KEY still set' -ForegroundColor Red
    Write-Host '  Value length: ' `$env:ANTHROPIC_API_KEY.Length -ForegroundColor Red
} else {
    Write-Host '  SUCCESS: ANTHROPIC_API_KEY is not set' -ForegroundColor Green
    Write-Host '  Claude will use browser authentication' -ForegroundColor Green
}
Write-Host ''
Write-Host 'Testing ACC with clean environment...' -ForegroundColor Yellow
& acc run 'just say hello world' -i 1
"@

# Write test script to temporary file
$testScript | Out-File -FilePath "test-clean-env.ps1" -Encoding UTF8

# Run in fresh PowerShell session
Start-Process -FilePath "powershell" -ArgumentList "-ExecutionPolicy", "Bypass", "-File", "test-clean-env.ps1" -Wait -NoNewWindow

# Cleanup
Remove-Item "test-clean-env.ps1" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "If you still see 'Invalid API Key' errors, restart your terminal" -ForegroundColor Yellow
Write-Host "and try again. Environment variables can be persistent." -ForegroundColor Yellow