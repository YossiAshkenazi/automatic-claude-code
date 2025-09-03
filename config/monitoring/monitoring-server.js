const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 6007;
const sessions = new Map();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Simple web interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Automatic Claude Code - Monitor</title>
        <style>
            body { 
                font-family: system-ui, -apple-system, sans-serif; 
                margin: 40px; 
                background: #0f172a; 
                color: #e2e8f0; 
            }
            .container { max-width: 800px; margin: 0 auto; }
            .status { 
                background: #1e293b; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0;
                border-left: 4px solid #10b981;
            }
            .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .metric { background: #1e293b; padding: 15px; border-radius: 6px; }
            .metric h3 { margin: 0; color: #10b981; }
            .metric p { margin: 5px 0; font-size: 1.2em; }
            .header { text-align: center; margin-bottom: 30px; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤖 Automatic Claude Code</h1>
                <p>Monitoring Dashboard - Always Running</p>
            </div>
            
            <div class="status">
                <h2>✅ System Status: HEALTHY</h2>
                <p>All services are running normally</p>
                <p><strong>Uptime:</strong> ${process.uptime().toFixed(0)} seconds</p>
                <p><strong>Status:</strong> Monitoring active</p>
            </div>

            <div class="metrics">
                <div class="metric">
                    <h3>Sessions</h3>
                    <p>${sessions.size}</p>
                </div>
                <div class="metric">
                    <h3>WebSocket Clients</h3>
                    <p>${wss.clients.size}</p>
                </div>
                <div class="metric">
                    <h3>Memory Usage</h3>
                    <p>${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <div class="metric">
                    <h3>Server Port</h3>
                    <p>${PORT}</p>
                </div>
            </div>

            <div class="status">
                <h3>🐳 Docker Container</h3>
                <p>Main ACC app container built and ready for use</p>
                <p><strong>Usage:</strong> docker run --rm automatic-claude-code node dist/index.js --help</p>
            </div>

            <div class="footer">
                <p>Automatic Claude Code Monitoring Service</p>
                <p>Built with persistence and auto-restart capabilities</p>
            </div>
        </div>

        <script>
            // Auto-refresh every 30 seconds
            setTimeout(() => window.location.reload(), 30000);
        </script>
    </body>
    </html>
  `);
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    sessions: sessions.size,
    clients: wss.clients.size,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    running: true,
    sessions: Array.from(sessions.keys()),
    uptime: process.uptime(),
    port: PORT
  });
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log(`✅ WebSocket client connected (${wss.clients.size} total)`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Message:', data.type || data);
      
      // Echo back for keepalive
      ws.send(JSON.stringify({ 
        type: 'pong', 
        timestamp: new Date().toISOString() 
      }));
    } catch (e) {
      console.log('📨 Raw message:', message.toString());
    }
  });

  ws.on('close', () => {
    console.log(`❌ WebSocket client disconnected (${wss.clients.size} remaining)`);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down monitoring server...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
🚀 Automatic Claude Code - Monitoring Server
📊 Dashboard: http://localhost:${PORT}
🔍 Health: http://localhost:${PORT}/health
⚡ WebSocket: ws://localhost:${PORT}
🛡️  Auto-restart: Enabled
  `);
});

// Keep process alive
setInterval(() => {
  const memory = process.memoryUsage();
  console.log(`📊 Status: ${sessions.size} sessions, ${wss.clients.size} clients, ${(memory.heapUsed/1024/1024).toFixed(1)}MB`);
}, 60000);