# Setup Development Environment for Visual Agent Platform
# Windows PowerShell Script

param(
    [switch]$Clean = $false,
    [switch]$SkipInstall = $false,
    [switch]$DockerMode = $false
)

Write-Host "🚀 Setting up Visual Agent Platform Development Environment" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to check if command exists
function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to create directory if it doesn't exist
function New-DirectoryIfNotExists($path) {
    if (!(Test-Path -Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "📁 Created directory: $path" -ForegroundColor Green
    }
}

try {
    # Clean up if requested
    if ($Clean) {
        Write-Host "🧹 Cleaning up previous environment..." -ForegroundColor Yellow
        
        # Stop any running processes
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*automatic-claude-code*" } | Stop-Process -Force
        Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*automatic-claude-code*" } | Stop-Process -Force
        
        # Clean build directories
        if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
        if (Test-Path "dual-agent-monitor/dist") { Remove-Item "dual-agent-monitor/dist" -Recurse -Force }
        if (Test-Path "python-sdk/build") { Remove-Item "python-sdk/build" -Recurse -Force }
        if (Test-Path "python-sdk/__pycache__") { Remove-Item "python-sdk/__pycache__" -Recurse -Force }
        
        Write-Host "✅ Cleanup completed" -ForegroundColor Green
    }

    # Check prerequisites
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
    
    $prerequisites = @()
    
    if (!(Test-Command "node")) {
        $prerequisites += "Node.js (https://nodejs.org/)"
    } else {
        $nodeVersion = node --version
        Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
    }
    
    if (!(Test-Command "pnpm")) {
        $prerequisites += "pnpm (npm install -g pnpm)"
    } else {
        $pnpmVersion = pnpm --version
        Write-Host "✅ pnpm: v$pnpmVersion" -ForegroundColor Green
    }
    
    if (!(Test-Command "python")) {
        $prerequisites += "Python 3.11+ (https://python.org/)"
    } else {
        $pythonVersion = python --version
        Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
    }
    
    if (!(Test-Command "claude")) {
        $prerequisites += "Claude CLI (npm install -g @anthropic-ai/claude-code)"
    } else {
        Write-Host "✅ Claude CLI installed" -ForegroundColor Green
    }

    if ($DockerMode) {
        if (!(Test-Command "docker")) {
            $prerequisites += "Docker (https://docker.com/)"
        } else {
            $dockerVersion = docker --version
            Write-Host "✅ Docker: $dockerVersion" -ForegroundColor Green
        }
        
        if (!(Test-Command "docker-compose")) {
            $prerequisites += "Docker Compose"
        } else {
            Write-Host "✅ Docker Compose available" -ForegroundColor Green
        }
    }

    if ($prerequisites.Count -gt 0) {
        Write-Host "❌ Missing prerequisites:" -ForegroundColor Red
        $prerequisites | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
        Write-Host ""
        Write-Host "Please install the missing prerequisites and run this script again." -ForegroundColor Yellow
        exit 1
    }

    # Create necessary directories
    Write-Host "📁 Creating directory structure..." -ForegroundColor Yellow
    
    $directories = @(
        "logs\dev",
        "temp\dev", 
        "uploads\dev",
        "backups\dev",
        "data",
        ".vscode",
        "scripts"
    )
    
    $directories | ForEach-Object { New-DirectoryIfNotExists $_ }

    # Install dependencies if not skipped
    if (!$SkipInstall) {
        Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
        
        # Install root dependencies
        Write-Host "Installing root dependencies..." -ForegroundColor Cyan
        pnpm install
        
        # Install dashboard dependencies
        Write-Host "Installing dashboard dependencies..." -ForegroundColor Cyan
        Set-Location "dual-agent-monitor"
        pnpm install
        Set-Location ".."
        
        # Install Python dependencies
        Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
        Set-Location "python-sdk"
        
        # Create virtual environment if it doesn't exist
        if (!(Test-Path "venv")) {
            python -m venv venv
            Write-Host "✅ Created Python virtual environment" -ForegroundColor Green
        }
        
        # Activate virtual environment and install dependencies
        & "venv\Scripts\activate.ps1"
        pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
        deactivate
        
        Set-Location ".."
        
        Write-Host "✅ Dependencies installed" -ForegroundColor Green
    }

    # Setup environment files
    Write-Host "⚙️ Setting up environment configuration..." -ForegroundColor Yellow
    
    if (!(Test-Path ".env.development")) {
        Write-Host "✅ .env.development already exists" -ForegroundColor Green
    }
    
    # Copy environment files for dashboard
    if (!(Test-Path "dual-agent-monitor\.env")) {
        if (Test-Path "dual-agent-monitor\.env.example") {
            Copy-Item "dual-agent-monitor\.env.example" "dual-agent-monitor\.env"
            Write-Host "✅ Created dual-agent-monitor .env from example" -ForegroundColor Green
        }
    }

    # Build the project
    Write-Host "🔨 Building project..." -ForegroundColor Yellow
    pnpm run build:all

    # Setup git hooks if in git repository
    if (Test-Path ".git") {
        Write-Host "🪝 Setting up git hooks..." -ForegroundColor Yellow
        
        # Install pre-commit if available
        if (Test-Command "pre-commit") {
            pre-commit install
            Write-Host "✅ Pre-commit hooks installed" -ForegroundColor Green
        }
    }

    # Docker setup if requested
    if ($DockerMode) {
        Write-Host "🐳 Setting up Docker development environment..." -ForegroundColor Yellow
        
        # Build development images
        docker-compose -f docker-compose.dev.yml build
        
        Write-Host "✅ Docker development environment ready" -ForegroundColor Green
        Write-Host "   Run: pnpm run docker:dev-platform" -ForegroundColor Cyan
    }

    # Success message
    Write-Host ""
    Write-Host "🎉 Development environment setup completed!" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Quick start commands:" -ForegroundColor Cyan
    Write-Host "  • Full platform:     pnpm run dev:platform" -ForegroundColor White
    Write-Host "  • With debug:         pnpm run dev:platform:debug" -ForegroundColor White
    Write-Host "  • Dashboard only:     pnpm run dev:dashboard" -ForegroundColor White
    Write-Host "  • Python only:        pnpm run dev:python" -ForegroundColor White
    if ($DockerMode) {
        Write-Host "  • Docker platform:    pnpm run docker:dev-platform" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "🔍 Access points:" -ForegroundColor Cyan
    Write-Host "  • Dashboard:          http://localhost:6011" -ForegroundColor White
    Write-Host "  • Python API:         http://localhost:4005" -ForegroundColor White
    Write-Host "  • Hook Dashboard:     http://localhost:6001" -ForegroundColor White
    Write-Host "  • Observability:      http://localhost:4000" -ForegroundColor White
    Write-Host ""
    Write-Host "📖 VS Code integration:" -ForegroundColor Cyan
    Write-Host "  • Press F5 to start debugging" -ForegroundColor White
    Write-Host "  • Use 'Debug Full Platform' configuration for complete debugging" -ForegroundColor White

} catch {
    Write-Host ""
    Write-Host "❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please check the error above and try again." -ForegroundColor Yellow
    exit 1
}