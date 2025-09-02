# Test Direct Claude Usage
Write-Host "Testing Direct Claude Command (what ACC should use)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Clear environment
$env:ANTHROPIC_API_KEY = $null
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue

Write-Host "Testing Claude directly with the same command ACC would use..." -ForegroundColor Yellow
Write-Host ""

try {
    # Test the exact command that the SDK should be using
    Write-Host "Running: claude --dangerously-skip-permissions -p `"write hello world to success.txt`"" -ForegroundColor Gray
    $output = & claude --dangerously-skip-permissions -p "write hello world to success.txt" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS! Direct Claude command worked!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Output:" -ForegroundColor Gray
        Write-Host $output -ForegroundColor White
        Write-Host ""
        
        # Check if file was created
        if (Test-Path "success.txt") {
            $content = Get-Content "success.txt" -Raw
            Write-Host "✅ File created successfully!" -ForegroundColor Green
            Write-Host "File content: $content" -ForegroundColor Gray
        } else {
            Write-Host "⚠️ File was not created" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Direct Claude command failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Output: $output" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Exception occurred: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "This shows what the SDK should be able to do..." -ForegroundColor Cyan