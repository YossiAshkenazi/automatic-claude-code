#!/usr/bin/env node
/**
 * Docker health check script for dual-agent-monitor
 * This script checks if the WebSocket server is running and responding
 */

const http = require('http');
const process = require('process');

const PORT = process.env.PORT || process.env.WEBSOCKET_SERVER_PORT || 4005;

const healthCheckUrl = `http://localhost:${PORT}/api/health`;

const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/api/health',
  method: 'GET',
  timeout: 5000,
};

const req = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    console.log('Health check passed');
    process.exit(0);
  } else {
    console.log('Health check failed - server returned non-200 status');
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.error('Health check failed - request error:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check failed - request timeout');
  req.destroy();
  process.exit(1);
});

req.setTimeout(5000);
req.end();