# Full Stack Deployment Script for Dual-Agent Monitoring System (PowerShell)
# This script deploys the complete monitoring stack with proper networking

param(
    [Parameter(Position=0)]
    [ValidateSet("deploy", "stop", "restart", "logs", "status", "clean", "health")]
    [string]$Command = "deploy",
    
    [Parameter(Position=1)]
    [string]$ServiceName = ""
)

# Configuration
$ComposeFile = "docker-compose.full-stack.yml"
$EnvFile = ".env.full-stack"
$ProjectName = "dual-agent-monitor"

# Functions
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
    exit 1
}

function Test-Dependencies {
    Write-Log "Checking dependencies..."
    
    # Check Docker
    try {
        $null = docker --version
        Write-Success "Docker is installed"
    }
    catch {
        Write-Error "Docker is not installed. Please install Docker Desktop first."
    }
    
    # Check Docker Compose
    try {
        $null = docker-compose --version
        Write-Success "Docker Compose is installed"
    }
    catch {
        try {
            $null = docker compose version
            Write-Success "Docker Compose (v2) is installed"
        }
        catch {
            Write-Error "Docker Compose is not installed. Please install Docker Compose first."
        }
    }
    
    Write-Success "Dependencies check passed"
}

function Initialize-Environment {
    Write-Log "Preparing environment..."
    
    # Create required directories
    $directories = @("data\postgres", "backups", "logs")
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Success "Created directory: $dir"
        }
    }
    
    # Copy environment file if it doesn't exist
    if (-not (Test-Path ".env")) {
        Copy-Item $EnvFile ".env"
        Write-Success "Environment file created from $EnvFile"
    } else {
        Write-Warning "Using existing .env file"
    }
    
    Write-Success "Environment prepared"
}

function Build-Images {
    Write-Log "Building Docker images..."
    
    # Build frontend image
    Write-Log "Building frontend image..."
    $result = docker-compose -f $ComposeFile build frontend
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Frontend image built successfully"
    } else {
        Write-Error "Failed to build frontend image"
    }
    
    # Build API server image
    Write-Log "Building API server image..."
    $result = docker-compose -f $ComposeFile build api-server
    if ($LASTEXITCODE -eq 0) {
        Write-Success "API server image built successfully"
    } else {
        Write-Error "Failed to build API server image"
    }
}

function Deploy-Services {
    Write-Log "Deploying services..."
    
    # Start database and cache services first
    Write-Log "Starting database and cache services..."
    docker-compose -f $ComposeFile up -d postgres redis
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database and cache services started"
    } else {
        Write-Error "Failed to start database and cache services"
    }
    
    # Wait for database to be ready
    Write-Log "Waiting for database to be ready..."
    $timeout = 60
    $ready = $false
    
    while ($timeout -gt 0 -and -not $ready) {
        try {
            $result = docker-compose -f $ComposeFile exec -T postgres pg_isready -U postgres 2>$null
            if ($LASTEXITCODE -eq 0) {
                $ready = $true
                Write-Success "Database is ready"
                break
            }
        }
        catch {
            # Continue waiting
        }
        
        Start-Sleep -Seconds 2
        $timeout -= 2
    }
    
    if (-not $ready) {
        Write-Error "Database failed to become ready within 60 seconds"
    }
    
    # Start API server
    Write-Log "Starting API server..."
    docker-compose -f $ComposeFile up -d api-server
    if ($LASTEXITCODE -eq 0) {
        Write-Success "API server started"
    } else {
        Write-Error "Failed to start API server"
    }
    
    # Wait for API server to be ready
    Write-Log "Waiting for API server to be ready..."
    $timeout = 60
    $ready = $false
    
    while ($timeout -gt 0 -and -not $ready) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:4005/api/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $ready = $true
                Write-Success "API server is ready"
                break
            }
        }
        catch {
            # Continue waiting
        }
        
        Start-Sleep -Seconds 2
        $timeout -= 2
    }
    
    if (-not $ready) {
        Write-Error "API server failed to become ready within 60 seconds"
    }
    
    # Start frontend and nginx
    Write-Log "Starting frontend and reverse proxy..."
    docker-compose -f $ComposeFile up -d frontend nginx
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Frontend and reverse proxy started"
    } else {
        Write-Error "Failed to start frontend and reverse proxy"
    }
    
    Write-Success "All services deployed successfully"
}

function Test-HealthChecks {
    Write-Log "Running health checks..."
    
    # Run health check service
    docker-compose -f $ComposeFile --profile test run --rm healthcheck
    if ($LASTEXITCODE -eq 0) {
        Write-Success "All health checks passed"
    } else {
        Write-Error "Health checks failed"
    }
}

function Show-Status {
    Write-Log "Service status:"
    docker-compose -f $ComposeFile ps
    
    Write-Host ""
    Write-Log "Service URLs:"
    Write-Host "  Frontend:     http://localhost:6011" -ForegroundColor Cyan
    Write-Host "  API Server:   http://localhost:4005" -ForegroundColor Cyan
    Write-Host "  Database:     localhost:5434" -ForegroundColor Cyan
    Write-Host "  Redis:        localhost:6379" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Success "Deployment completed successfully!"
    Write-Success "You can now access the dual-agent monitoring dashboard at http://localhost:6011"
}

function Start-FullDeployment {
    Write-Log "Starting full stack deployment..."
    
    Test-Dependencies
    Initialize-Environment
    Build-Images
    Deploy-Services
    Test-HealthChecks
    Show-Status
    
    Write-Log "Deployment process completed!"
}

# Main execution
switch ($Command) {
    "deploy" {
        Start-FullDeployment
    }
    "stop" {
        Write-Log "Stopping all services..."
        docker-compose -f $ComposeFile down
        Write-Success "All services stopped"
    }
    "restart" {
        Write-Log "Restarting all services..."
        docker-compose -f $ComposeFile restart
        Write-Success "All services restarted"
    }
    "logs" {
        if ($ServiceName) {
            docker-compose -f $ComposeFile logs -f $ServiceName
        } else {
            docker-compose -f $ComposeFile logs -f
        }
    }
    "status" {
        Show-Status
    }
    "clean" {
        Write-Log "Cleaning up containers and images..."
        docker-compose -f $ComposeFile down --rmi all --volumes --remove-orphans
        Write-Success "Cleanup completed"
    }
    "health" {
        Test-HealthChecks
    }
    default {
        Write-Host "Usage: .\deploy-full-stack.ps1 [deploy|stop|restart|logs|status|clean|health] [service-name]" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor Yellow
        Write-Host "  deploy   - Deploy the full stack (default)" -ForegroundColor White
        Write-Host "  stop     - Stop all services" -ForegroundColor White
        Write-Host "  restart  - Restart all services" -ForegroundColor White
        Write-Host "  logs     - View logs (optional service name)" -ForegroundColor White
        Write-Host "  status   - Show service status and URLs" -ForegroundColor White
        Write-Host "  clean    - Remove all containers, images, and volumes" -ForegroundColor White
        Write-Host "  health   - Run health checks" -ForegroundColor White
        exit 1
    }
}