# Fix API Key Issue for ACC v2.0
Write-Host "Fixing ANTHROPIC_API_KEY issue..." -ForegroundColor Yellow
Write-Host ""

# Check current API key status
Write-Host "Current API key status:" -ForegroundColor Cyan
if ($env:ANTHROPIC_API_KEY) {
    Write-Host "  ANTHROPIC_API_KEY is set (hiding value for security)" -ForegroundColor Red
    Write-Host "  Length: $($env:ANTHROPIC_API_KEY.Length) characters" -ForegroundColor Gray
} else {
    Write-Host "  ANTHROPIC_API_KEY is not set" -ForegroundColor Green
}
Write-Host ""

# Clear the environment variable
Write-Host "Clearing ANTHROPIC_API_KEY..." -ForegroundColor Yellow
$env:ANTHROPIC_API_KEY = $null
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue

# Verify it's cleared
Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan
if ($env:ANTHROPIC_API_KEY) {
    Write-Host "  ERROR: ANTHROPIC_API_KEY is still set" -ForegroundColor Red
} else {
    Write-Host "  SUCCESS: ANTHROPIC_API_KEY has been cleared" -ForegroundColor Green
    Write-Host "  Claude will now use browser authentication" -ForegroundColor Green
}
Write-Host ""

# Test with simple command
Write-Host "Testing ACC with cleared API key..." -ForegroundColor Yellow
Write-Host "Running: acc run `"just say hello`" -i 1" -ForegroundColor Gray
Write-Host ""

& acc run "just say hello" -i 1

Write-Host ""
Write-Host "If you see a different error (not API key), then the fix worked!" -ForegroundColor Green