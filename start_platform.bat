@echo off
REM Visual Agent Management Platform - Windows Startup Script
REM ==========================================================
REM 
REM Single command to start the complete Visual Agent Management Platform
REM Usage: start_platform.bat
REM

setlocal EnableDelayedExpansion

REM Change to script directory
cd /d "%~dp0"

REM Print banner
echo.
echo ========================================================================
echo.
echo    🚀 Visual Agent Management Platform v2.1.0 - Windows Startup
echo.
echo    Starting comprehensive multi-agent coordination system...
echo.
echo ========================================================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo    Please install Python 3.8+ and add to PATH
    pause
    exit /b 1
)

REM Install required Python packages if needed
echo 🔧 Checking Python dependencies...
python -c "import psutil, requests" >nul 2>&1
if errorlevel 1 (
    echo    Installing required Python packages...
    python -m pip install psutil requests >nul 2>&1
    if errorlevel 1 (
        echo ❌ Failed to install required Python packages
        pause
        exit /b 1
    )
)

REM Check if Node.js and pnpm are available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo    Please install Node.js 18+ and add to PATH
    pause
    exit /b 1
)

pnpm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pnpm is not installed
    echo    Please install pnpm: npm install -g pnpm
    pause
    exit /b 1
)

REM Run the Python startup orchestrator
echo 🚀 Starting platform orchestrator...
echo.

python start_platform.py

REM Handle exit
if errorlevel 1 (
    echo.
    echo ❌ Platform startup failed. Check platform_startup.log for details.
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ✅ Platform shutdown complete
    echo.
)

endlocal