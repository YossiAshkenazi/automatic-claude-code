# PostgreSQL Database Initialization Script (PowerShell)
# This script sets up the PostgreSQL database for the dual-agent monitoring system

param(
    [switch]$SkipRedis,
    [switch]$Verbose
)

# Configuration
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot "docker-compose.postgres.yml"
$EnvFile = Join-Path $ProjectRoot ".env.postgres"

# Functions for colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check if Docker is running
function Test-Docker {
    Write-Status "Checking Docker status..."
    
    try {
        $null = docker info 2>$null
        Write-Success "Docker is running"
        return $true
    }
    catch {
        Write-Error "Docker is not running. Please start Docker and try again."
        return $false
    }
}

# Function to load environment variables
function Import-Environment {
    if (Test-Path $EnvFile) {
        Write-Status "Loading environment variables from .env.postgres"
        
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -and !$_.StartsWith('#')) {
                $name, $value = $_.Split('=', 2)
                if ($name -and $value) {
                    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
                }
            }
        }
        
        Write-Success "Environment variables loaded"
    }
    else {
        Write-Warning "Environment file not found: $EnvFile"
        Write-Status "Using default values"
    }
}

# Function to create necessary directories
function New-ProjectDirectories {
    Write-Status "Creating necessary directories..."
    
    $directories = @(
        (Join-Path $ProjectRoot "data\postgres"),
        (Join-Path $ProjectRoot "backups"),
        (Join-Path $ProjectRoot "logs")
    )
    
    foreach ($dir in $directories) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    Write-Success "Directories created successfully"
}

# Function to start PostgreSQL service
function Start-PostgresService {
    Write-Status "Starting PostgreSQL container..."
    
    Push-Location $ProjectRoot
    try {
        $env = if (Test-Path $EnvFile) { "--env-file `"$EnvFile`"" } else { "" }
        $command = "docker-compose -f `"$ComposeFile`" $env up -d postgres"
        
        if ($Verbose) {
            Write-Status "Running: $command"
        }
        
        Invoke-Expression $command
        
        Write-Status "Waiting for PostgreSQL to be ready..."
        
        # Wait for PostgreSQL to be healthy
        $maxAttempts = 30
        $attempt = 1
        $ready = $false
        
        while ($attempt -le $maxAttempts -and !$ready) {
            try {
                $result = docker-compose -f $ComposeFile exec -T postgres pg_isready -U $env:POSTGRES_USER 2>$null
                if ($LASTEXITCODE -eq 0) {
                    $ready = $true
                    Write-Success "PostgreSQL is ready!"
                    break
                }
            }
            catch {
                # Continue waiting
            }
            
            Write-Status "Attempt $attempt/$maxAttempts - PostgreSQL not ready yet, waiting..."
            Start-Sleep -Seconds 2
            $attempt++
        }
        
        if (!$ready) {
            Write-Error "PostgreSQL failed to start within expected time"
            docker-compose -f $ComposeFile logs postgres
            return $false
        }
        
        return $true
    }
    finally {
        Pop-Location
    }
}

# Function to verify database schema
function Test-DatabaseSchema {
    Write-Status "Verifying database schema..."
    
    try {
        Push-Location $ProjectRoot
        
        $dbName = $env:POSTGRES_DB -or "dual_agent_monitor"
        $dbUser = $env:POSTGRES_USER -or "postgres"
        
        $query = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
        $result = docker-compose -f $ComposeFile exec -T postgres psql -U $dbUser -d $dbName -t -c $query
        
        $tablesCount = ($result -replace '\s', '')
        
        if ([int]$tablesCount -gt 10) {
            Write-Success "Database schema initialized successfully ($tablesCount tables created)"
            return $true
        }
        else {
            Write-Error "Database schema initialization failed (only $tablesCount tables found)"
            return $false
        }
    }
    finally {
        Pop-Location
    }
}

# Function to start Redis (optional)
function Start-RedisService {
    if ($SkipRedis) {
        Write-Status "Skipping Redis service (--SkipRedis specified)"
        return
    }
    
    Write-Status "Starting Redis container..."
    
    Push-Location $ProjectRoot
    try {
        $env = if (Test-Path $EnvFile) { "--env-file `"$EnvFile`"" } else { "" }
        $command = "docker-compose -f `"$ComposeFile`" $env up -d redis"
        
        Invoke-Expression $command
        Write-Success "Redis container started"
    }
    finally {
        Pop-Location
    }
}

# Function to display connection information
function Show-ConnectionInfo {
    Write-Success "PostgreSQL Setup Complete!"
    Write-Host ""
    
    Write-Status "Connection Information:"
    Write-Host "  Host: localhost"
    Write-Host "  Port: $($env:POSTGRES_PORT -or '5432')"
    Write-Host "  Database: $($env:POSTGRES_DB -or 'dual_agent_monitor')"
    Write-Host "  Username: $($env:POSTGRES_USER -or 'postgres')"
    Write-Host "  Password: $($env:POSTGRES_PASSWORD -or 'dual_agent_secure_pass_2025')"
    Write-Host ""
    Write-Host "  Connection URL: $($env:DATABASE_URL -or 'postgresql://postgres:dual_agent_secure_pass_2025@localhost:5432/dual_agent_monitor')"
    Write-Host ""
    
    Write-Status "Management Tools:"
    Write-Host "  pgAdmin: http://localhost:8081"
    Write-Host "    Email: $($env:PGADMIN_EMAIL -or 'admin@dual-agent-monitor.local')"
    Write-Host "    Password: $($env:PGADMIN_PASSWORD -or 'admin123')"
    Write-Host ""
    
    Write-Status "Useful Commands:"
    Write-Host "  View logs: docker-compose -f docker-compose.postgres.yml logs -f postgres"
    Write-Host "  Connect to DB: docker-compose -f docker-compose.postgres.yml exec postgres psql -U $($env:POSTGRES_USER -or 'postgres') -d $($env:POSTGRES_DB -or 'dual_agent_monitor')"
    Write-Host "  Stop services: docker-compose -f docker-compose.postgres.yml down"
    Write-Host "  Backup DB: .\scripts\backup-postgres.ps1"
}

# Function to test connection
function Test-DatabaseConnection {
    Write-Status "Testing database connection..."
    
    try {
        Push-Location $ProjectRoot
        
        $dbName = $env:POSTGRES_DB -or "dual_agent_monitor"
        $dbUser = $env:POSTGRES_USER -or "postgres"
        
        $query = "SELECT version();"
        $result = docker-compose -f $ComposeFile exec -T postgres psql -U $dbUser -d $dbName -t -c $query 2>$null
        
        if ($result -and $result.Trim()) {
            Write-Success "Database connection successful!"
            Write-Status "PostgreSQL version: $($result.Trim())"
            return $true
        }
        else {
            Write-Error "Database connection failed"
            return $false
        }
    }
    finally {
        Pop-Location
    }
}

# Main execution
function Main {
    Write-Status "Starting PostgreSQL Database Initialization..."
    Write-Host ""
    
    if (!(Test-Docker)) {
        exit 1
    }
    
    Import-Environment
    New-ProjectDirectories
    
    if (!(Start-PostgresService)) {
        exit 1
    }
    
    if (!(Test-DatabaseSchema)) {
        exit 1
    }
    
    Start-RedisService
    
    if (!(Test-DatabaseConnection)) {
        exit 1
    }
    
    Show-ConnectionInfo
    
    Write-Host ""
    Write-Success "🎉 PostgreSQL database setup completed successfully!"
    Write-Status "You can now start the dual-agent monitoring API server"
}

# Run main function
try {
    Main
}
catch {
    Write-Error "An error occurred: $_"
    exit 1
}