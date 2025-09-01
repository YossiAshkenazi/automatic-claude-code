#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🔌 Testing WebSocket Connection...');

const ws = new WebSocket('ws://localhost:4005');

ws.on('open', function open() {
  console.log('✅ WebSocket connection established');
  
  // Send test message
  const testMessage = {
    type: 'test',
    message: 'WebSocket connection test',
    timestamp: new Date().toISOString()
  };
  
  ws.send(JSON.stringify(testMessage));
  console.log('📤 Sent test message:', testMessage);
});

ws.on('message', function message(data) {
  try {
    const parsed = JSON.parse(data.toString());
    console.log('📥 Received message:', parsed);
    
    if (parsed.type === 'acknowledgment') {
      console.log('✅ WebSocket test completed successfully');
      ws.close();
      process.exit(0);
    }
  } catch (error) {
    console.log('📥 Received raw message:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ WebSocket test timeout');
  ws.close();
  process.exit(1);
}, 10000);