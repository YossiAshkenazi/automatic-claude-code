# Setup Debug Environment for VS Code
# Prepares debugging infrastructure for multi-component development

Write-Host "🔧 Setting up debug environment..." -ForegroundColor Cyan

$ErrorActionPreference = "Continue"

try {
    # Ensure build is up to date for CLI debugging
    if (!(Test-Path "dist\index.js") -or (Get-Item "dist\index.js").LastWriteTime -lt (Get-Item "src\index.ts").LastWriteTime) {
        Write-Host "🔨 Building CLI for debugging..." -ForegroundColor Yellow
        pnpm run build
    }
    
    # Check Python virtual environment
    if (!(Test-Path "python-sdk\venv")) {
        Write-Host "🐍 Setting up Python virtual environment..." -ForegroundColor Yellow
        Set-Location "python-sdk"
        python -m venv venv
        & "venv\Scripts\activate.ps1"
        pip install --upgrade pip
        pip install debugpy
        deactivate
        Set-Location ".."
    }
    
    # Install debugpy if not present
    Set-Location "python-sdk"
    & "venv\Scripts\activate.ps1"
    pip show debugpy | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "📦 Installing Python debugger..." -ForegroundColor Yellow
        pip install debugpy
    }
    deactivate
    Set-Location ".."
    
    # Create debug log directory
    if (!(Test-Path "logs\debug")) {
        New-Item -ItemType Directory -Path "logs\debug" -Force | Out-Null
    }
    
    # Setup environment variables for debugging
    $env:NODE_ENV = "development"
    $env:PYTHON_ENV = "development"
    $env:DEBUG = "*"
    $env:PYTHONPATH = "$PWD\python-sdk"
    
    Write-Host "✅ Debug environment ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔍 Debug configurations available:" -ForegroundColor Cyan
    Write-Host "  • CLI:              Node.js debugger on port 9229" -ForegroundColor White
    Write-Host "  • Dashboard:        Node.js debugger on port 9230" -ForegroundColor White  
    Write-Host "  • Python:           Python debugger on port 5678" -ForegroundColor White
    Write-Host "  • Full Platform:    All components with debugging enabled" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 Debug logs will be written to: logs\debug\" -ForegroundColor Cyan
    
} catch {
    Write-Host "⚠️ Debug setup encountered issues: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Some debugging features may not work correctly." -ForegroundColor Yellow
}