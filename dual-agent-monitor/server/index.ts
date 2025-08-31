import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { SessionStore } from './sessionStore';
import { WebSocketMessage, DualAgentSession, AgentMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const sessionStore = new SessionStore();
const connectedClients = new Set<WebSocket>();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    sessions: sessionStore.getAllSessions().length,
    activeSessions: sessionStore.getActiveSessions().length,
    connectedClients: connectedClients.size,
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
}

// REST API endpoints
app.get('/sessions', (req, res) => {
  const sessions = sessionStore.getAllSessions();
  res.json(sessions);
});

app.get('/sessions/active', (req, res) => {
  const sessions = sessionStore.getActiveSessions();
  res.json(sessions);
});

app.get('/sessions/:id', (req, res) => {
  const session = sessionStore.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

app.post('/sessions', async (req, res) => {
  try {
    const { initialTask, workDir } = req.body;
    const session = await sessionStore.createSession(initialTask, workDir || process.cwd());
    
    broadcast({
      type: 'session_update',
      data: session,
    });
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.patch('/sessions/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await sessionStore.updateSessionStatus(req.params.id, status);
    
    const session = sessionStore.getSession(req.params.id);
    if (session) {
      broadcast({
        type: 'session_update',
        data: session,
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update session status' });
  }
});

app.delete('/sessions/:id', async (req, res) => {
  try {
    const success = await sessionStore.deleteSession(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    broadcast({
      type: 'session_list',
      data: sessionStore.getAllSessions(),
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

app.post('/sessions/:id/messages', async (req, res) => {
  try {
    const { agentType, messageType, content, metadata } = req.body;
    
    const message = await sessionStore.addMessage(req.params.id, {
      agentType,
      messageType,
      content,
      metadata,
    });
    
    broadcast({
      type: 'new_message',
      data: message,
    });
    
    res.json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Endpoint to receive events from existing observability hooks
app.post('/events', async (req, res) => {
  try {
    const event = req.body;
    
    // Convert observability events to dual-agent format
    const agentMessage = await convertObservabilityEvent(event);
    if (agentMessage) {
      broadcast({
        type: 'new_message',
        data: agentMessage,
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing event:', error);
    res.status(500).json({ error: 'Failed to process event' });
  }
});

// WebSocket handling
wss.on('connection', (ws: WebSocket) => {
  console.log('New WebSocket connection');
  connectedClients.add(ws);
  
  // Send current sessions on connection
  ws.send(JSON.stringify({
    type: 'session_list',
    data: sessionStore.getAllSessions(),
  }));
  
  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log('WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(ws);
  });
});

function broadcast(message: WebSocketMessage) {
  const messageStr = JSON.stringify(message);
  
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

async function convertObservabilityEvent(event: any): Promise<AgentMessage | null> {
  try {
    // Determine agent type based on event source or model
    const agentType = determineAgentType(event);
    
    // Find or create session
    const sessionId = event.sessionId || findOrCreateSessionForEvent(event);
    if (!sessionId) return null;
    
    // Convert event to agent message format
    const messageType = determineMessageType(event);
    const content = extractContent(event);
    const metadata = extractMetadata(event);
    
    return await sessionStore.addMessage(sessionId, {
      agentType,
      messageType,
      content,
      metadata,
    });
  } catch (error) {
    console.error('Error converting observability event:', error);
    return null;
  }
}

function determineAgentType(event: any): 'manager' | 'worker' {
  // Logic to determine if this is from Manager (Opus) or Worker (Sonnet)
  if (event.model?.includes('opus') || event.agentRole === 'manager') {
    return 'manager';
  }
  return 'worker'; // Default to worker (Sonnet)
}

function determineMessageType(event: any): AgentMessage['messageType'] {
  if (event.type === 'user_prompt_submit') return 'prompt';
  if (event.type === 'assistant_message') return 'response';
  if (event.type === 'tool_invocation') return 'tool_call';
  if (event.error) return 'error';
  return 'system';
}

function extractContent(event: any): string {
  return event.content || event.prompt || event.message || JSON.stringify(event, null, 2);
}

function extractMetadata(event: any): AgentMessage['metadata'] {
  return {
    tools: event.tools || (event.tool ? [event.tool] : undefined),
    files: event.files,
    commands: event.commands,
    cost: event.cost,
    duration: event.duration,
    exitCode: event.exitCode,
  };
}

function findOrCreateSessionForEvent(event: any): string | null {
  // Try to find existing active session or create one
  const activeSessions = sessionStore.getActiveSessions();
  
  if (activeSessions.length > 0) {
    return activeSessions[0].id; // Use most recent active session
  }
  
  // Create a new session if none exists
  if (event.type === 'user_prompt_submit' || event.type === 'session_start') {
    // This would need to be async, but for now return null and handle elsewhere
    return null;
  }
  
  return null;
}

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}

const PORT = process.env.PORT || 6003;

server.listen(PORT, () => {
  console.log(`Dual-agent monitor server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Frontend will be available at http://localhost:6002`);
    console.log(`API available at http://localhost:${PORT}`);
  }
});