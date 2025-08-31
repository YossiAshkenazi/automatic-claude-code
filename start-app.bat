@echo off
echo.
echo ===============================================
echo   Automatic Claude Code - Starting Services
echo ===============================================
echo.

cd /d "%~dp0"

echo 🚀 Starting monitoring server...
start /B node monitoring-server.js

timeout /t 3 /nobreak >nul

echo.
echo ✅ Services started successfully!
echo.
echo 📊 Dashboard: http://localhost:6007
echo 🔍 Health: http://localhost:6007/health
echo 🐳 Docker: Use 'pnpm run docker:run' for containerized tasks
echo.
echo Press Ctrl+C in any window to stop services
echo.
pause