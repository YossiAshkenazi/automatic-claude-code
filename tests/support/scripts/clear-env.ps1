# Clear API key from current session
$env:ANTHROPIC_API_KEY = $null
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue

# Verify
if ($env:ANTHROPIC_API_KEY) {
    Write-Host "ERROR: API key still set" -ForegroundColor Red
} else {
    Write-Host "SUCCESS: API key cleared from session" -ForegroundColor Green
}