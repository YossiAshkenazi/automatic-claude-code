# Minimal Test - Just echo a message through Claude
Write-Host ""
Write-Host "ACC v2.0 - MINIMAL TEST" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This test will:" -ForegroundColor Yellow
Write-Host "  1. Ask Claude to write 'Hello from Claude' to hello.txt" -ForegroundColor Gray
Write-Host "  2. Use only 1 iteration" -ForegroundColor Gray
Write-Host "  3. Complete in under 30 seconds" -ForegroundColor Gray
Write-Host ""

# Remove any existing test file
Remove-Item "hello.txt" -ErrorAction SilentlyContinue

# Execute the simplest possible task
Write-Host "Executing: acc run `"write 'Hello from Claude' to hello.txt`" -i 1" -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$process = Start-Process -FilePath "acc" -ArgumentList @("run", "`"write 'Hello from Claude' to hello.txt`"", "-i", "1") -NoNewWindow -PassThru -RedirectStandardOutput "test-output.txt" -RedirectStandardError "test-error.txt"

# Wait up to 30 seconds
$timeout = 30
$waited = 0
while (-not $process.HasExited -and $waited -lt $timeout) {
    Start-Sleep -Seconds 1
    $waited++
    Write-Host "." -NoNewline
}
Write-Host ""

if ($process.HasExited) {
    $duration = ((Get-Date) - $startTime).TotalSeconds
    Write-Host ""
    Write-Host "Process completed in $([math]::Round($duration, 1)) seconds" -ForegroundColor Gray
    
    if ($process.ExitCode -eq 0) {
        Write-Host "EXIT CODE: 0 (Success)" -ForegroundColor Green
        
        # Check if file was created
        if (Test-Path "hello.txt") {
            $content = Get-Content "hello.txt" -Raw
            Write-Host ""
            Write-Host "FILE CREATED: hello.txt" -ForegroundColor Green
            Write-Host "CONTENTS: $content" -ForegroundColor Green
            Write-Host ""
            Write-Host "TEST PASSED!" -ForegroundColor Green
            
            # Cleanup
            Remove-Item "hello.txt" -ErrorAction SilentlyContinue
            Remove-Item "test-output.txt" -ErrorAction SilentlyContinue
            Remove-Item "test-error.txt" -ErrorAction SilentlyContinue
        } else {
            Write-Host "FILE NOT CREATED" -ForegroundColor Red
            Write-Host "TEST FAILED!" -ForegroundColor Red
        }
    } else {
        Write-Host "EXIT CODE: $($process.ExitCode) (Failed)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error output:" -ForegroundColor Yellow
        if (Test-Path "test-error.txt") {
            Get-Content "test-error.txt" | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        }
        Write-Host "TEST FAILED!" -ForegroundColor Red
    }
} else {
    # Process still running after timeout
    Write-Host ""
    Write-Host "TIMEOUT: Process did not complete in $timeout seconds" -ForegroundColor Red
    $process.Kill()
    Write-Host "Process terminated." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This suggests the SDK execution is hanging." -ForegroundColor Yellow
    Write-Host "Possible causes:" -ForegroundColor Yellow
    Write-Host "  - Authentication issue (check ANTHROPIC_API_KEY)" -ForegroundColor Gray
    Write-Host "  - Network connectivity problem" -ForegroundColor Gray
    Write-Host "  - Claude CLI needs re-authentication" -ForegroundColor Gray
    Write-Host ""
    Write-Host "TEST INCONCLUSIVE" -ForegroundColor Yellow
}

# Cleanup any remaining files
Remove-Item "test-output.txt" -ErrorAction SilentlyContinue
Remove-Item "test-error.txt" -ErrorAction SilentlyContinue