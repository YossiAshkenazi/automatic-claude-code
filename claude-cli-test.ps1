# Test Claude CLI directly vs SDK
Write-Host ""
Write-Host "CLAUDE CLI vs SDK DIAGNOSTIC TEST" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Claude CLI Version:" -ForegroundColor Yellow
& claude --version
Write-Host ""

Write-Host "Testing if Claude CLI REPL works..." -ForegroundColor Yellow
Write-Host "This will test if Claude CLI itself is functional" -ForegroundColor Gray
Write-Host ""

# Create a simple test script for Claude REPL
@'
Hello Claude! Please respond with just "CLI Test Successful"
'@ | Out-File -FilePath "claude-test-input.txt"

Write-Host "Input file created: claude-test-input.txt" -ForegroundColor Gray
Write-Host "Contents: Hello Claude! Please respond with just 'CLI Test Successful'" -ForegroundColor Gray
Write-Host ""

Write-Host "MANUAL TEST REQUIRED:" -ForegroundColor Yellow
Write-Host "1. Run: claude" -ForegroundColor Cyan
Write-Host "2. Paste: Hello Claude! Please respond with just 'CLI Test Successful'" -ForegroundColor Cyan  
Write-Host "3. See if Claude responds quickly" -ForegroundColor Cyan
Write-Host "4. Type /exit to quit" -ForegroundColor Cyan
Write-Host ""

Write-Host "DIAGNOSIS:" -ForegroundColor Yellow
Write-Host "- If Claude REPL responds quickly -> SDK interface issue" -ForegroundColor Gray
Write-Host "- If Claude REPL hangs too -> Authentication/API issue" -ForegroundColor Gray
Write-Host ""

Write-Host "If REPL works but SDK hangs, this confirms:" -ForegroundColor Green
Write-Host "✅ Our v2.0 architecture is correct" -ForegroundColor Green
Write-Host "✅ The issue is with Claude CLI's programmatic SDK" -ForegroundColor Green
Write-Host "❌ SDK query function has a bug or timeout issue" -ForegroundColor Red

# Cleanup
Remove-Item "claude-test-input.txt" -ErrorAction SilentlyContinue