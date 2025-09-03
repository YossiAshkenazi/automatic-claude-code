# Start Hook System for Development
# Lightweight script to start the observability server

param(
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

# Check if monitoring server exists
$monitoringServer = "config\monitoring\monitoring-server.js"
if (!(Test-Path $monitoringServer)) {
    Write-Host "⚠️ Hook system not available (monitoring server not found)" -ForegroundColor Yellow
    Write-Host "Creating minimal hook endpoint..." -ForegroundColor Yellow
    
    # Create a minimal HTTP server for hook events
    $minimalServer = @"
const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'POST' && parsedUrl.pathname === '/events') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        const timestamp = new Date().toISOString();
        console.log(`[\${timestamp}] Hook Event: \${event.eventType || 'unknown'} from \${event.projectPath || 'unknown'}`);
        if (process.env.VERBOSE === 'true') {
          console.log(JSON.stringify(event, null, 2));
        }
      } catch (e) {
        console.log('Invalid JSON in hook event');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'received' }));
    });
  } else if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'minimal-hooks' }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = process.env.HOOKS_PORT || 4000;
server.listen(PORT, () => {
  console.log(`🪝 Minimal Hook Server running on http://localhost:\${PORT}`);
  console.log('📡 Receiving hook events from Claude Code CLI');
});
"@
    
    # Write the minimal server to a temporary location
    $tempServer = "temp\minimal-hooks-server.js"
    if (!(Test-Path "temp")) { New-Item -ItemType Directory -Path "temp" -Force | Out-Null }
    Set-Content -Path $tempServer -Value $minimalServer
    
    # Start the minimal server
    $env:HOOKS_PORT = "4000"
    $env:VERBOSE = if ($Verbose) { "true" } else { "false" }
    
    Write-Host "🪝 Starting minimal hook system on port 4000..." -ForegroundColor Green
    node $tempServer
    
} else {
    # Start the full monitoring server
    Write-Host "🪝 Starting full hook system..." -ForegroundColor Green
    
    $env:NODE_ENV = "development"
    $env:HOOKS_PORT = "4000"
    $env:HOOKS_DASHBOARD_PORT = "6001"
    $env:DEBUG = if ($Verbose) { "*" } else { ""
    
    node $monitoringServer
}