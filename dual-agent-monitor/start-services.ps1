# Dual-Agent Monitor Service Startup Script
# Ensures consistent port usage and prevents conflicts

param(
    [switch]$CheckPorts,
    [switch]$StopExisting,
    [int]$ServerPort = 4001,
    [int]$UIPort = 6011
)

Write-Host "🚀 Dual-Agent Monitor Startup Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Function to check if port is in use
function Test-PortInUse {
    param([int]$Port)
    
    $connections = netstat -an | Select-String ":$Port\s"
    return $connections.Count -gt 0
}

# Function to find process using port
function Get-ProcessOnPort {
    param([int]$Port)
    
    $netstatOutput = netstat -ano | Select-String ":$Port\s.*LISTENING"
    if ($netstatOutput) {
        $pid = ($netstatOutput -split '\s+')[-1]
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        return $process
    }
    return $null
}

# Check ports if requested
if ($CheckPorts) {
    Write-Host "🔍 Checking port availability..." -ForegroundColor Yellow
    
    $serverPortInUse = Test-PortInUse -Port $ServerPort
    $uiPortInUse = Test-PortInUse -Port $UIPort
    
    Write-Host "Port $ServerPort (WebSocket Server): " -NoNewline
    if ($serverPortInUse) {
        Write-Host "IN USE" -ForegroundColor Red
        $serverProcess = Get-ProcessOnPort -Port $ServerPort
        if ($serverProcess) {
            Write-Host "  └─ Used by: $($serverProcess.ProcessName) (PID: $($serverProcess.Id))" -ForegroundColor Gray
        }
    } else {
        Write-Host "AVAILABLE" -ForegroundColor Green
    }
    
    Write-Host "Port $UIPort (UI Dev Server): " -NoNewline
    if ($uiPortInUse) {
        Write-Host "IN USE" -ForegroundColor Red
        $uiProcess = Get-ProcessOnPort -Port $UIPort
        if ($uiProcess) {
            Write-Host "  └─ Used by: $($uiProcess.ProcessName) (PID: $($uiProcess.Id))" -ForegroundColor Gray
        }
    } else {
        Write-Host "AVAILABLE" -ForegroundColor Green
    }
}

# Stop existing services if requested
if ($StopExisting) {
    Write-Host "🛑 Stopping existing services..." -ForegroundColor Yellow
    
    $serverProcess = Get-ProcessOnPort -Port $ServerPort
    if ($serverProcess) {
        Write-Host "Stopping WebSocket server (PID: $($serverProcess.Id))..." -ForegroundColor Red
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    $uiProcess = Get-ProcessOnPort -Port $UIPort
    if ($uiProcess) {
        Write-Host "Stopping UI server (PID: $($uiProcess.Id))..." -ForegroundColor Red
        Stop-Process -Id $uiProcess.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# Start services
Write-Host "🌟 Starting services..." -ForegroundColor Green

# Set environment variables
$env:WEBSOCKET_SERVER_PORT = $ServerPort
$env:VITE_WS_URL = "ws://localhost:$ServerPort"
$env:VITE_API_BASE_URL = "http://localhost:$ServerPort/api"

# Start WebSocket server in background
Write-Host "Starting WebSocket server on port $ServerPort..." -ForegroundColor Cyan
$serverJob = Start-Job -ScriptBlock {
    param($ServerPort)
    Set-Location $using:PWD
    cd server
    $env:WEBSOCKET_SERVER_PORT = $ServerPort
    npx tsx websocket-server.ts
} -ArgumentList $ServerPort

Start-Sleep -Seconds 3

# Verify server started
if (Test-PortInUse -Port $ServerPort) {
    Write-Host "✅ WebSocket server started successfully" -ForegroundColor Green
    Write-Host "   └─ WebSocket: ws://localhost:$ServerPort" -ForegroundColor Gray
    Write-Host "   └─ REST API: http://localhost:$ServerPort/api" -ForegroundColor Gray
} else {
    Write-Host "❌ WebSocket server failed to start" -ForegroundColor Red
    Write-Host "Job output:" -ForegroundColor Yellow
    Receive-Job -Job $serverJob
}

Write-Host ""
Write-Host "📋 Service Status:" -ForegroundColor Cyan
Write-Host "WebSocket Server: " -NoNewline
if (Test-PortInUse -Port $ServerPort) {
    Write-Host "RUNNING (port $ServerPort)" -ForegroundColor Green
} else {
    Write-Host "STOPPED" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Start UI: cd dual-agent-monitor && pnpm run dev" -ForegroundColor Gray
Write-Host "2. Open browser: http://localhost:$UIPort" -ForegroundColor Gray
Write-Host "3. Check health: http://localhost:$ServerPort/api/health" -ForegroundColor Gray

Write-Host ""
Write-Host "📊 Monitor Services:" -ForegroundColor Cyan
Write-Host "- Check server job: Get-Job -Id $($serverJob.Id)" -ForegroundColor Gray
Write-Host "- View server output: Receive-Job -Job (Get-Job -Id $($serverJob.Id))" -ForegroundColor Gray
Write-Host "- Stop services: ./start-services.ps1 -StopExisting" -ForegroundColor Gray