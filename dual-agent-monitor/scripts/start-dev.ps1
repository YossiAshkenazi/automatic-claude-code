# Development startup script for Dual-Agent Monitor (PowerShell)

Write-Host "🚀 Starting Dual-Agent Monitor Development Environment" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check if npm is installed  
try {
    $npmVersion = npm --version
    Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm is not installed. Please install npm first." -ForegroundColor Red
    exit 1
}

# Check Node.js version
$nodeVersionNumber = $nodeVersion -replace 'v', '' -split '\.' | Select-Object -First 1
if ([int]$nodeVersionNumber -lt 18) {
    Write-Host "❌ Node.js version 18+ is required. Current version: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Create session directory if it doesn't exist
if (!(Test-Path ".dual-agent-sessions")) {
    Write-Host "📁 Creating session storage directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path ".dual-agent-sessions" -Force | Out-Null
}

# Start development servers
Write-Host "🎯 Starting development servers..." -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:6002" -ForegroundColor White
Write-Host "   Backend API: http://localhost:6003" -ForegroundColor White  
Write-Host "   WebSocket: ws://localhost:6003" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Yellow
Write-Host ""

npm run dev