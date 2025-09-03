#!/usr/bin/env node
/**
 * Agent Creation Test
 * 
 * This script tests the agent creation functionality by connecting
 * to the WebSocket server and simulating the agent creation process
 * that the React dashboard would perform.
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const WEBSOCKET_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 10000; // 10 seconds

class AgentCreationTest {
    constructor() {
        this.ws = null;
        this.testResults = {};
        this.pendingMessages = new Map();
    }

    async runTests() {
        console.log('🧪 Visual Agent Management Platform - Agent Creation Test');
        console.log('=' * 60);
        console.log(`Connecting to WebSocket server: ${WEBSOCKET_URL}`);
        
        try {
            await this.connect();
            await this.testAgentCreation();
            await this.testAgentListing();
            console.log('\n✅ All tests completed successfully!');
            return true;
        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            return false;
        } finally {
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    connect() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 5000);

            this.ws = new WebSocket(WEBSOCKET_URL);

            this.ws.on('open', () => {
                clearTimeout(timeout);
                console.log('✅ Connected to WebSocket server');
                resolve();
            });

            this.ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket connection failed: ${error.message}`));
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            });
        });
    }

    handleMessage(message) {
        console.log('📨 Received:', message.type, message.data ? '(with data)' : '');
        
        if (message.data && message.data.original_message_id) {
            const originalId = message.data.original_message_id;
            if (this.pendingMessages.has(originalId)) {
                const { resolve, reject } = this.pendingMessages.get(originalId);
                this.pendingMessages.delete(originalId);
                
                if (message.data.success) {
                    resolve(message.data.result);
                } else {
                    reject(new Error(message.data.error || 'Command failed'));
                }
            }
        }
    }

    sendCommand(command, data = {}) {
        return new Promise((resolve, reject) => {
            const messageId = uuidv4();
            
            const timeout = setTimeout(() => {
                this.pendingMessages.delete(messageId);
                reject(new Error('Command timeout'));
            }, TEST_TIMEOUT);

            this.pendingMessages.set(messageId, {
                resolve: (result) => {
                    clearTimeout(timeout);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            const message = {
                command,
                data,
                message_id: messageId
            };

            console.log('📤 Sending command:', command);
            this.ws.send(JSON.stringify(message));
        });
    }

    async testAgentCreation() {
        console.log('\n🔨 Testing agent creation...');
        
        try {
            const result = await this.sendCommand('create_agent', {
                role: 'worker',
                name: 'Test Worker Agent',
                model: 'sonnet',
                capabilities: ['general', 'testing']
            });

            console.log('✅ Agent created successfully:', result);
            this.testResults.agentCreation = { success: true, result };
            
            return result;
        } catch (error) {
            console.error('❌ Agent creation failed:', error.message);
            this.testResults.agentCreation = { success: false, error: error.message };
            throw error;
        }
    }

    async testAgentListing() {
        console.log('\n📋 Testing agent listing...');
        
        try {
            const agents = await this.sendCommand('list_agents');
            console.log('✅ Agent list retrieved:', agents.length, 'agents');
            
            if (agents.length > 0) {
                console.log('📝 Agents:');
                agents.forEach(agent => {
                    console.log(`  - ${agent.name} (${agent.agent_id}): ${agent.status}`);
                });
            }
            
            this.testResults.agentListing = { success: true, agents };
            return agents;
        } catch (error) {
            console.error('❌ Agent listing failed:', error.message);
            this.testResults.agentListing = { success: false, error: error.message };
            throw error;
        }
    }
}

// Run the test
if (require.main === module) {
    const test = new AgentCreationTest();
    test.runTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test runner failed:', error);
            process.exit(1);
        });
}

module.exports = AgentCreationTest;