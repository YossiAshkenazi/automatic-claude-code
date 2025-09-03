# Start Development Platform - Visual Agent Management System
# Windows PowerShell Script with integrated monitoring and health checks

param(
    [switch]$Debug = $false,
    [switch]$Clean = $false,
    [switch]$Docker = $false,
    [switch]$Minimal = $false,
    [int]$Timeout = 120
)

Write-Host "🚀 Starting Visual Agent Management Platform" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Global variables for process tracking
$global:runningProcesses = @()
$global:logFiles = @()

# Function to cleanup on exit
function Cleanup {
    Write-Host ""
    Write-Host "🛑 Shutting down platform..." -ForegroundColor Yellow
    
    # Kill all tracked processes
    $global:runningProcesses | ForEach-Object {
        if ($_.Process -and !$_.Process.HasExited) {
            try {
                $_.Process.Kill()
                Write-Host "✅ Stopped $($_.Name)" -ForegroundColor Green
            } catch {
                Write-Host "⚠️ Failed to stop $($_.Name): $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
    
    # Close log files
    $global:logFiles | ForEach-Object {
        if ($_) { $_.Close() }
    }
    
    Write-Host "✅ Platform shutdown completed" -ForegroundColor Green
}

# Register cleanup on exit
Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

# Handle Ctrl+C
$null = [Console]::TreatControlCAsInput = $false
[Console]::CancelKeyPress.Add({
    param($sender, $e)
    $e.Cancel = $true
    Cleanup
    exit 0
})

function Test-Port {
    param([int]$Port, [string]$Description)
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ConnectAsync("localhost", $Port).Wait(1000) | Out-Null
        $tcpClient.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-ForService {
    param(
        [int]$Port,
        [string]$Name,
        [int]$TimeoutSeconds = 60,
        [string]$HealthEndpoint = "/health"
    )
    
    Write-Host "⏳ Waiting for $Name on port $Port..." -ForegroundColor Yellow
    
    $startTime = Get-Date
    $timeout = $startTime.AddSeconds($TimeoutSeconds)
    
    while ((Get-Date) -lt $timeout) {
        if (Test-Port $Port $Name) {
            # Additional health check if endpoint provided
            if ($HealthEndpoint) {
                try {
                    $response = Invoke-RestMethod -Uri "http://localhost:$Port$HealthEndpoint" -TimeoutSec 5 -ErrorAction Stop
                    Write-Host "✅ $Name is healthy on port $Port" -ForegroundColor Green
                    return $true
                } catch {
                    # Port is open but health check failed, continue waiting
                }
            } else {
                Write-Host "✅ $Name is ready on port $Port" -ForegroundColor Green
                return $true
            }
        }
        Start-Sleep -Milliseconds 500
    }
    
    Write-Host "❌ Timeout waiting for $Name on port $Port" -ForegroundColor Red
    return $false
}

function Start-ComponentWithLogging {
    param(
        [string]$Name,
        [string]$Command,
        [string]$Arguments,
        [string]$WorkingDirectory = ".",
        [hashtable]$Environment = @{},
        [int]$Port = 0
    )
    
    # Setup logging
    $logDir = "logs\dev"
    if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $logFile = "$logDir\$($Name.ToLower() -replace ' ', '-').log"
    
    # Configure process start info
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Command
    $psi.Arguments = $Arguments
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    
    # Add environment variables
    $Environment.GetEnumerator() | ForEach-Object {
        $psi.Environment[$_.Key] = $_.Value
    }
    
    # Start the process
    try {
        $process = [System.Diagnostics.Process]::Start($psi)
        
        # Track the process
        $processInfo = @{
            Name = $Name
            Process = $process
            LogFile = $logFile
            Port = $Port
        }
        $global:runningProcesses += $processInfo
        
        Write-Host "✅ Started $Name (PID: $($process.Id))" -ForegroundColor Green
        
        # Setup logging in background
        $logWriter = [System.IO.StreamWriter]::new($logFile, $true)
        $global:logFiles += $logWriter
        
        # Log output asynchronously
        $process.OutputDataReceived.Add({
            param($sender, $e)
            if ($e.Data) {
                $logWriter.WriteLine("[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [OUT] $($e.Data)")
                $logWriter.Flush()
            }
        })
        
        $process.ErrorDataReceived.Add({
            param($sender, $e)
            if ($e.Data) {
                $logWriter.WriteLine("[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [ERR] $($e.Data)")
                $logWriter.Flush()
                Write-Host "⚠️ $Name: $($e.Data)" -ForegroundColor Yellow
            }
        })
        
        $process.BeginOutputReadLine()
        $process.BeginErrorReadLine()
        
        return $processInfo
        
    } catch {
        Write-Host "❌ Failed to start $Name: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

try {
    # Clean previous build if requested
    if ($Clean) {
        Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
        pnpm run clean:all
    }

    # Check if running in Docker mode
    if ($Docker) {
        Write-Host "🐳 Starting platform in Docker mode..." -ForegroundColor Cyan
        
        # Stop any existing containers
        docker-compose -f docker-compose.dev.yml down --remove-orphans
        
        # Start the platform
        docker-compose -f docker-compose.dev.yml up --build
        return
    }

    # Build the project first
    Write-Host "🔨 Building project..." -ForegroundColor Yellow
    pnpm run build:all

    Write-Host ""
    Write-Host "🚀 Starting platform components..." -ForegroundColor Cyan

    # Start PostgreSQL (if available)
    if (Test-Command "docker") {
        Write-Host "🐘 Starting PostgreSQL..." -ForegroundColor Yellow
        docker run -d --name visual-agent-postgres -p 5432:5432 -e POSTGRES_DB=visual_agent_dev -e POSTGRES_USER=dev_user -e POSTGRES_PASSWORD=dev_password postgres:15-alpine
        Start-Sleep 5
    }

    # Start Python Orchestrator
    if (!$Minimal) {
        $pythonEnv = @{
            PYTHONPATH = "$PWD\python-sdk"
            PYTHON_ENV = "development"
            PYTHON_DEBUG = if ($Debug) { "true" } else { "false" }
        }
        
        $pythonComponent = Start-ComponentWithLogging -Name "Python Orchestrator" -Command "python" -Arguments "-m uvicorn multi_agent_wrapper:app --reload --host localhost --port 4005" -WorkingDirectory "python-sdk" -Environment $pythonEnv -Port 4005
        
        if ($pythonComponent) {
            Wait-ForService -Port 4005 -Name "Python Orchestrator" -HealthEndpoint "/health"
        }
    }

    # Start React Dashboard
    $dashboardEnv = @{
        NODE_ENV = "development"
        REACT_APP_API_BASE_URL = "http://localhost:4005"
        REACT_APP_WS_BASE_URL = "ws://localhost:4005"
    }
    
    if ($Debug) {
        $dashboardEnv["DEBUG"] = "*"
        $dashboardEnv["NODE_OPTIONS"] = "--inspect=9230"
    }
    
    $dashboardComponent = Start-ComponentWithLogging -Name "React Dashboard" -Command "pnpm" -Arguments "run dev" -WorkingDirectory "dual-agent-monitor" -Environment $dashboardEnv -Port 6011
    
    if ($dashboardComponent) {
        Wait-ForService -Port 6011 -Name "React Dashboard" -TimeoutSeconds 60
    }

    # Start Hook System (if not minimal)
    if (!$Minimal -and (Test-Path "config\monitoring\monitoring-server.js")) {
        $hooksEnv = @{
            NODE_ENV = "development"
            HOOKS_PORT = "4000"
            HOOKS_DASHBOARD_PORT = "6001"
        }
        
        $hooksComponent = Start-ComponentWithLogging -Name "Hook System" -Command "node" -Arguments "config\monitoring\monitoring-server.js" -Environment $hooksEnv -Port 4000
        
        if ($hooksComponent) {
            Wait-ForService -Port 4000 -Name "Hook System" -HealthEndpoint "/health"
            Wait-ForService -Port 6001 -Name "Hook Dashboard"
        }
    }

    # Display status and access information
    Write-Host ""
    Write-Host "🎉 Platform started successfully!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
    Write-Host "  • Visual Dashboard:   http://localhost:6011" -ForegroundColor White
    if (!$Minimal) {
        Write-Host "  • Python API:         http://localhost:4005" -ForegroundColor White
        Write-Host "  • API Health:         http://localhost:4005/health" -ForegroundColor White
        Write-Host "  • Hook Dashboard:     http://localhost:6001" -ForegroundColor White
        Write-Host "  • Observability:      http://localhost:4000" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "📊 Running Components:" -ForegroundColor Cyan
    $global:runningProcesses | ForEach-Object {
        $status = if ($_.Process.HasExited) { "❌ Stopped" } else { "✅ Running" }
        Write-Host "  • $($_.Name): $status (PID: $($_.Process.Id))" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "📝 Logs available in: logs\dev\" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the platform" -ForegroundColor Yellow
    
    # Keep the script running
    Write-Host "⏳ Monitoring platform health..." -ForegroundColor Yellow
    
    while ($true) {
        Start-Sleep -Seconds 30
        
        # Check if all processes are still running
        $failed = $false
        $global:runningProcesses | ForEach-Object {
            if ($_.Process.HasExited) {
                Write-Host "❌ Component $($_.Name) has stopped unexpectedly!" -ForegroundColor Red
                $failed = $true
            }
        }
        
        if ($failed) {
            Write-Host "🔄 Some components failed. Check logs for details." -ForegroundColor Yellow
            break
        }
    }
    
} catch {
    Write-Host "❌ Error starting platform: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace:" -ForegroundColor Yellow
    Write-Host $_.ScriptStackTrace -ForegroundColor Yellow
} finally {
    Cleanup
}