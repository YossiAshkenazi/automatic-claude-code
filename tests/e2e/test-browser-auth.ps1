# Test browser-authenticated Claude
Write-Host "Testing browser-authenticated Claude..." -ForegroundColor Cyan

# Remove API key environment variables
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:CLAUDE_API_KEY -ErrorAction SilentlyContinue

Write-Host "API keys removed from environment" -ForegroundColor Green

# Test the acc command
Write-Host "Running acc with browser auth..." -ForegroundColor Yellow
acc run "create a file test.txt with 'Browser auth works!'" -i 1 -v

Write-Host "Test complete!" -ForegroundColor Green