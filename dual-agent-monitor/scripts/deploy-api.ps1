# Deploy API Server Script (PowerShell)
# This script builds and deploys the dual-agent monitoring API server

param(
    [switch]$WithProxy,
    [switch]$Verbose,
    [string]$EnvFile = ".env.api"
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$ComposeFile = "docker-compose.api.yml"

# Change to project directory
Set-Location $ProjectDir

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Info($message) {
    Write-ColorOutput Blue "[INFO] $message"
}

function Write-Success($message) {
    Write-ColorOutput Green "[SUCCESS] $message"
}

function Write-Warning($message) {
    Write-ColorOutput Yellow "[WARNING] $message"
}

function Write-Error($message) {
    Write-ColorOutput Red "[ERROR] $message"
}

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Error "Docker is not running. Please start Docker and try again."
    exit 1
}

# Check if environment file exists
if (-not (Test-Path $EnvFile)) {
    Write-Warning "Environment file $EnvFile not found. Creating from template..."
    if (Test-Path ".env.postgres") {
        Copy-Item ".env.postgres" $EnvFile
        Write-Success "Created $EnvFile from .env.postgres"
    } else {
        Write-Error "No environment template found. Please create $EnvFile manually."
        exit 1
    }
}

Write-Info "Starting API server deployment..."
Write-Info "Using environment file: $EnvFile"
Write-Info "Using compose file: $ComposeFile"

# Check if PostgreSQL is already running
try {
    $postgresStatus = docker compose -f docker-compose.postgres.yml ps postgres --format json | ConvertFrom-Json
    if ($postgresStatus.State -eq "running" -and $postgresStatus.Health -eq "healthy") {
        Write-Success "PostgreSQL is already running and healthy"
        $PostgresRunning = $true
    } else {
        Write-Info "PostgreSQL not running, will start with API server"
        $PostgresRunning = $false
    }
} catch {
    Write-Info "PostgreSQL status check failed, will start with API server"
    $PostgresRunning = $false
}

# Build the API server image
Write-Info "Building API server Docker image..."
try {
    docker build -f Dockerfile.api -t dual-agent-monitor-api . | if ($Verbose) { Write-Output $_ }
    Write-Success "API server image built successfully"
} catch {
    Write-Error "Failed to build API server image"
    exit 1
}

# Deploy the services
Write-Info "Deploying API server services..."
try {
    $composeArgs = @("-f", $ComposeFile, "--env-file", $EnvFile, "up", "-d")
    if ($WithProxy) {
        $composeArgs += "--profile", "proxy"
    }
    
    docker compose @composeArgs | if ($Verbose) { Write-Output $_ }
    Write-Success "API server services deployed successfully"
} catch {
    Write-Error "Failed to deploy API server services"
    exit 1
}

# Wait for services to be healthy
Write-Info "Waiting for services to become healthy..."
Start-Sleep -Seconds 10

# Function to check service health
function Test-ServiceHealth($serviceName, $maxAttempts = 30) {
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $serviceStatus = docker compose -f $ComposeFile ps $serviceName --format json | ConvertFrom-Json
            if ($serviceStatus.State -eq "running" -and $serviceStatus.Health -eq "healthy") {
                Write-Success "$serviceName is healthy"
                return $true
            }
        } catch {
            # Continue trying
        }
        
        Write-Info "Waiting for $serviceName to become healthy (attempt $attempt/$maxAttempts)..."
        Start-Sleep -Seconds 5
    }
    
    Write-Error "$serviceName failed to become healthy within timeout"
    return $false
}

# Check PostgreSQL health
if (-not (Test-ServiceHealth "postgres")) {
    Write-Error "PostgreSQL failed to become healthy"
    exit 1
}

# Check API server health
if (-not (Test-ServiceHealth "api-server")) {
    Write-Error "API server failed to become healthy"
    exit 1
}

# Test API connectivity
Write-Info "Testing API connectivity..."
try {
    # Load environment variables to get port
    $envContent = Get-Content $EnvFile | Where-Object { $_ -match "WEBSOCKET_SERVER_PORT=(\d+)" }
    $port = if ($envContent) { $Matches[1] } else { "4005" }
    
    $apiUrl = "http://localhost:$port/api/health"
    $response = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Success "API server is responding at $apiUrl"
    }
} catch {
    Write-Warning "API server may not be fully ready yet. Check logs with: docker compose -f $ComposeFile logs api-server"
}

# Display service information
Write-Info "Deployment completed successfully!"
Write-Host ""
Write-Info "Service Information:"
Write-Host "  - API Server: http://localhost:$port"
Write-Host "  - WebSocket: ws://localhost:$port"
Write-Host "  - Health Check: http://localhost:$port/api/health"
Write-Host "  - PostgreSQL: localhost:5434"
Write-Host ""
Write-Info "Management Commands:"
Write-Host "  - View logs: docker compose -f $ComposeFile logs -f"
Write-Host "  - Stop services: docker compose -f $ComposeFile down"
Write-Host "  - Restart API: docker compose -f $ComposeFile restart api-server"
Write-Host "  - View status: docker compose -f $ComposeFile ps"
Write-Host ""
Write-Info "Configuration:"
Write-Host "  - Environment file: $EnvFile"
Write-Host "  - Docker compose: $ComposeFile"
Write-Host "  - Network: dual-agent-network"