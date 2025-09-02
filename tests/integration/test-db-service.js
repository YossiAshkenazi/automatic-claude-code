#!/usr/bin/env node

// Simple test to verify database service functionality
import { InMemoryDatabaseService } from './dual-agent-monitor/server/database/InMemoryDatabaseService.js';

async function testDatabaseService() {
  console.log('Testing InMemoryDatabaseService...');
  
  const dbService = new InMemoryDatabaseService();
  
  // Create a test session
  console.log('Creating test session...');
  const sessionId = await dbService.createSession({
    startTime: new Date(),
    status: 'running',
    initialTask: 'Test session',
    workDir: '/test'
  });
  
  console.log('Session created with ID:', sessionId);
  
  // Retrieve all sessions
  console.log('Retrieving all sessions...');
  const sessions = await dbService.getAllSessions();
  console.log('Sessions found:', sessions.length);
  console.log('Session details:', JSON.stringify(sessions, null, 2));
  
  // Add a test message
  console.log('Adding test message...');
  await dbService.addMessage({
    id: 'test-msg-1',
    sessionId: sessionId,
    agentType: 'manager',
    messageType: 'coordination_event',
    content: 'Test message',
    timestamp: new Date(),
    metadata: { test: true }
  });
  
  // Retrieve session with messages
  const sessionWithMessages = await dbService.getSession(sessionId);
  console.log('Session with messages:', JSON.stringify(sessionWithMessages, null, 2));
}

testDatabaseService().catch(console.error);