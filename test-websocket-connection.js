#!/usr/bin/env node

const WebSocket = require('ws');

console.log('Testing WebSocket connection to Python agent server...');

// Test connection to Python WebSocket server
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', function open() {
  console.log('✅ Connected to Python agent server (localhost:8765)');
  
  // Send a test message
  const testMessage = {
    id: 'test-' + Date.now(),
    type: 'connection:ping',
    timestamp: new Date().toISOString(),
    payload: { 
      client_id: 'test-client', 
      message: 'Hello from test client' 
    }
  };
  
  console.log('📤 Sending test message:', JSON.stringify(testMessage, null, 2));
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', function message(data) {
  console.log('📥 Received from server:', data.toString());
});

ws.on('close', function close(code, reason) {
  console.log(`📴 Connection closed (code: ${code}, reason: ${reason})`);
  process.exit(0);
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

// Close connection after 5 seconds
setTimeout(() => {
  console.log('⏰ Closing connection...');
  ws.close();
}, 5000);