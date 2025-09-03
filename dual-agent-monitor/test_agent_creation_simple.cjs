#!/usr/bin/env node
/**
 * Simple Agent Creation Test
 * Tests WebSocket connection with proper message protocol format
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const WEBSOCKET_URL = 'ws://localhost:8765';

async function testAgentCreation() {
    console.log('🧪 Testing Agent Creation with Proper Message Protocol');
    console.log('Connecting to:', WEBSOCKET_URL);
    
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WEBSOCKET_URL);
        let responseReceived = false;

        const timeout = setTimeout(() => {
            if (!responseReceived) {
                ws.close();
                reject(new Error('Test timeout'));
            }
        }, 15000);

        ws.on('open', () => {
            console.log('✅ Connected to WebSocket server');
            
            // Send agent creation message in the expected format
            const message = {
                id: uuidv4(),
                type: 'agent:create',
                timestamp: new Date().toISOString(),
                payload: {
                    agent_type: 'worker',
                    model: 'sonnet',
                    capabilities: ['general', 'coding']
                },
                correlation_id: uuidv4()
            };

            console.log('📤 Sending agent creation message...');
            console.log('Message:', JSON.stringify(message, null, 2));
            ws.send(JSON.stringify(message));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('📨 Received message:', message.type);
                console.log('Full message:', JSON.stringify(message, null, 2));
                
                if (message.type === 'command:result' && message.payload.result?.success) {
                    console.log('✅ Agent created successfully!');
                    console.log('Agent ID:', message.payload.result.agent_id);
                    responseReceived = true;
                    clearTimeout(timeout);
                    ws.close();
                    resolve(message.payload);
                } else if (message.type === 'system:error') {
                    console.log('❌ Server error:', message.payload.message);
                    responseReceived = true;
                    clearTimeout(timeout);
                    ws.close();
                    reject(new Error(message.payload.message));
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            clearTimeout(timeout);
            reject(error);
        });

        ws.on('close', () => {
            console.log('Connection closed');
            if (!responseReceived) {
                clearTimeout(timeout);
                reject(new Error('Connection closed without response'));
            }
        });
    });
}

// Run the test
testAgentCreation()
    .then(result => {
        console.log('🎉 Test completed successfully!');
        console.log('Result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Test failed:', error.message);
        process.exit(1);
    });