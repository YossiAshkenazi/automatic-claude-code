# Quick status check for Dual-Agent Monitor services

Write-Host "Dual-Agent Monitor Status Check" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Check WebSocket server (port 4001)
$serverConnections = netstat -ano | Select-String ":4001\s.*LISTENING"
if ($serverConnections) {
    Write-Host "WebSocket Server (Port 4001): RUNNING" -ForegroundColor Green
    
    # Test health endpoint
    try {
        $healthResponse = Invoke-RestMethod -Uri "http://localhost:4001/api/health" -TimeoutSec 5
        Write-Host "  Health: $($healthResponse.status)" -ForegroundColor Gray
        Write-Host "  WebSocket Clients: $($healthResponse.websocket.clients)" -ForegroundColor Gray
    } catch {
        Write-Host "  Health check failed" -ForegroundColor Yellow
    }
} else {
    Write-Host "WebSocket Server (Port 4001): STOPPED" -ForegroundColor Red
}

# Check UI server (port 6011)
$uiConnections = netstat -ano | Select-String ":6011\s.*LISTENING"
if ($uiConnections) {
    Write-Host "UI Server (Port 6011): RUNNING" -ForegroundColor Green
} else {
    Write-Host "UI Server (Port 6011): STOPPED" -ForegroundColor Red
}

Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "  Dashboard: http://localhost:6011" -ForegroundColor Gray
Write-Host "  API Health: http://localhost:4001/api/health" -ForegroundColor Gray
Write-Host "  WebSocket: ws://localhost:4001" -ForegroundColor Gray