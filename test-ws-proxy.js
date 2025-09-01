// Test WebSocket proxy connection
const WebSocket = require('ws');

console.log('Testing WebSocket proxy connection...');

const ws = new WebSocket('ws://localhost:8091/ws');

ws.on('open', () => {
  console.log('✅ WebSocket proxy connected successfully!');
  ws.send('ping');
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString().substring(0, 100) + '...');
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
});

// Close after 3 seconds
setTimeout(() => {
  ws.close();
}, 3000);