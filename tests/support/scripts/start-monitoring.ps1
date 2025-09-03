# Automatic Claude Code - Persistent Monitoring Service
# This script ensures the monitoring server stays running permanently

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Automatic Claude Code Monitoring Service..." -ForegroundColor Green

# Configuration
$WorkingDirectory = $PSScriptRoot
$ServerScript = Join-Path $WorkingDirectory "monitoring-server.js"
$LogFile = Join-Path $WorkingDirectory "monitoring.log"
$MaxRestarts = 1000
$RestartDelay = 5

# Function to check if port is available
function Test-Port {
    param([int]$Port)
    try {
        $connection = Test-NetConnection -ComputerName "localhost" -Port $Port -InformationLevel "Quiet" -WarningAction SilentlyContinue
        return $connection
    } catch {
        return $false
    }
}

# Function to kill processes on specific port
function Stop-ProcessOnPort {
    param([int]$Port)
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }
        foreach ($process in $processes) {
            Write-Host "🛑 Stopping process $($process.ProcessName) (PID: $($process.Id)) on port $Port" -ForegroundColor Yellow
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    } catch {
        Write-Host "ℹ️  Port $Port appears to be free" -ForegroundColor Gray
    }
}

# Clean up any existing processes on our ports
Write-Host "🧹 Cleaning up existing processes..." -ForegroundColor Yellow
Stop-ProcessOnPort -Port 6007
Stop-ProcessOnPort -Port 4001
Start-Sleep -Seconds 3

# Main monitoring loop
$RestartCount = 0
while ($RestartCount -lt $MaxRestarts) {
    try {
        Write-Host "📡 Starting monitoring server (attempt $($RestartCount + 1))..." -ForegroundColor Cyan
        Write-Host "📂 Working directory: $WorkingDirectory" -ForegroundColor Gray
        Write-Host "📄 Script: $ServerScript" -ForegroundColor Gray
        
        # Start the Node.js server
        $process = Start-Process -FilePath "node" -ArgumentList $ServerScript -WorkingDirectory $WorkingDirectory -NoNewWindow -PassThru -RedirectStandardOutput $LogFile -RedirectStandardError $LogFile
        
        Write-Host "✅ Monitoring server started with PID: $($process.Id)" -ForegroundColor Green
        Write-Host "🌐 Dashboard available at: http://localhost:6007" -ForegroundColor Green
        Write-Host "🔍 Health check: http://localhost:6007/health" -ForegroundColor Green
        
        # Wait for the process to exit
        $process.WaitForExit()
        $exitCode = $process.ExitCode
        
        Write-Host "⚠️  Monitoring server stopped with exit code: $exitCode" -ForegroundColor Yellow
        
        # If it was a clean shutdown (Ctrl+C), don't restart
        if ($exitCode -eq 0) {
            Write-Host "🛑 Clean shutdown detected. Exiting..." -ForegroundColor Red
            break
        }
        
    } catch {
        Write-Host "❌ Error starting monitoring server: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    $RestartCount++
    
    if ($RestartCount -lt $MaxRestarts) {
        Write-Host "🔄 Restarting in $RestartDelay seconds... (attempt $RestartCount/$MaxRestarts)" -ForegroundColor Yellow
        Start-Sleep -Seconds $RestartDelay
    } else {
        Write-Host "❌ Maximum restart attempts reached. Exiting..." -ForegroundColor Red
        break
    }
}

Write-Host "🏁 Monitoring service stopped." -ForegroundColor Gray