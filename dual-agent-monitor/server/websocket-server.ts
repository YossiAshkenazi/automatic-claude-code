import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { InMemoryDatabaseService } from './database/InMemoryDatabaseService';
import { AgentMessage, DualAgentSession, SystemEvent, WebSocketMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors({
  origin: ['http://localhost:6005', 'http://localhost:6011', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:4001'],
  credentials: true
}));
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize database service
const dbService = new InMemoryDatabaseService();
const clients = new Set<WebSocket>();

// In-memory storage for active sessions (will be replaced by database later)
let currentSession: DualAgentSession | null = null;

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  clients.add(ws);

  // Send current session data if available
  if (currentSession) {
    ws.send(JSON.stringify({
      type: 'session:current',
      data: currentSession
    }));
  }

  // Send all sessions from database
  dbService.getAllSessions().then(sessions => {
    ws.send(JSON.stringify({
      type: 'sessions:list',
      data: sessions
    }));
  }).catch(error => {
    console.error('Error fetching sessions:', error);
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data.type);

      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'agents:start':
          try {
            // Create new session in database
            const sessionId = await dbService.createSession({
              startTime: new Date(),
              status: 'running',
              initialTask: data.task || 'Agent task',
              workDir: process.cwd()
            });
            
            currentSession = await dbService.getSession(sessionId);
            
            broadcast({
              type: 'agents:started',
              data: {
                sessionId: sessionId,
                task: data.task
              }
            });
          } catch (error: any) {
            ws.send(JSON.stringify({
              type: 'error',
              message: error.message
            }));
          }
          break;

        case 'agents:stop':
          if (currentSession) {
            await dbService.updateSessionStatus(currentSession.id, 'completed', new Date());
            currentSession = await dbService.getSession(currentSession.id);
            
            broadcast({
              type: 'agents:stopped',
              data: {
                sessionId: currentSession?.id
              }
            });
          }
          break;

        case 'session:get':
          try {
            const session = await dbService.getSession(data.sessionId);
            ws.send(JSON.stringify({
              type: 'session:data',
              data: session
            }));
          } catch (error) {
            console.error('Error fetching session:', error);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to fetch session'
            }));
          }
          break;

        case 'sessions:list':
          try {
            const sessions = await dbService.getAllSessions();
            ws.send(JSON.stringify({
              type: 'sessions:list',
              data: sessions
            }));
          } catch (error) {
            console.error('Error fetching sessions:', error);
          }
          break;

        case 'message:send':
          // Add message to database
          if (currentSession) {
            try {
              const agentMessage: AgentMessage = {
                id: uuidv4(),
                sessionId: currentSession.id,
                agentType: data.agent === 'manager' ? 'manager' : 'worker',
                messageType: 'prompt',
                content: data.message,
                timestamp: new Date()
              };
              
              await dbService.addMessage(agentMessage);
              
              broadcast({
                type: 'agent:message',
                data: agentMessage
              });
            } catch (error) {
              console.error('Error adding message:', error);
            }
          }
          break;

        case 'session:export':
          try {
            const session = await dbService.getSession(data.sessionId);
            ws.send(JSON.stringify({
              type: 'session:export',
              data: session
            }));
          } catch (error) {
            console.error('Error exporting session:', error);
          }
          break;

        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(message: any) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// REST API endpoints for non-WebSocket clients
app.get('/api/health', (req, res) => {
  const dbHealth = dbService.getHealthStatus();
  
  res.json({
    status: 'healthy',
    database: dbHealth,
    agents: {
      running: currentSession?.status === 'running',
      sessionId: currentSession?.id
    },
    websocket: {
      clients: clients.size
    }
  });
});

app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await dbService.getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await dbService.getSession(req.params.id);
    if (session) {
      res.json(session);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { initialTask, workDir } = req.body;
    
    if (!initialTask?.trim()) {
      return res.status(400).json({ error: 'Initial task is required' });
    }
    
    // Create new session in database
    const sessionId = await dbService.createSession({
      startTime: new Date(),
      status: 'running',
      initialTask: initialTask,
      workDir: workDir || process.cwd()
    });
    
    const session = await dbService.getSession(sessionId);
    if (session) {
      currentSession = session;
      
      // Broadcast session creation to all WebSocket clients
      broadcast({
        type: 'session:current',
        data: session
      });
      
      const allSessions = await dbService.getAllSessions();
      broadcast({
        type: 'sessions:list',
        data: allSessions
      });
      
      res.json({
        id: session.id,
        initialTask: session.initialTask,
        workDir: session.workDir,
        startTime: session.startTime,
        status: session.status,
        messages: session.messages
      });
    } else {
      res.status(500).json({ error: 'Failed to create session' });
    }
  } catch (error: any) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message || 'Failed to create session' });
  }
});

app.post('/api/agents/start', async (req, res) => {
  try {
    const sessionId = await dbService.createSession({
      startTime: new Date(),
      status: 'running',
      initialTask: req.body.task || 'Agent task',
      workDir: process.cwd()
    });
    
    currentSession = await dbService.getSession(sessionId);
    
    res.json({
      success: true,
      sessionId: sessionId
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/agents/stop', async (req, res) => {
  try {
    if (currentSession) {
      await dbService.updateSessionStatus(currentSession.id, 'completed', new Date());
      currentSession = await dbService.getSession(currentSession.id);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sessions/:id/export', async (req, res) => {
  try {
    const session = await dbService.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get additional data for export
    const communications = await dbService.getSessionCommunications(req.params.id);
    const events = await dbService.getSessionEvents(req.params.id);
    const metrics = await dbService.getSessionMetrics(req.params.id);
    
    const exportData = {
      session,
      communications,
      events,
      metrics
    };
    
    res.header('Content-Type', 'application/json');
    res.header('Content-Disposition', `attachment; filename="session_${req.params.id}.json"`);
    res.json(exportData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Message API endpoint
app.post('/api/sessions/:id/messages', async (req, res) => {
  try {
    const { agentType, messageType, content, metadata } = req.body;
    
    const message: AgentMessage = {
      id: uuidv4(),
      sessionId: req.params.id,
      agentType,
      messageType,
      content,
      timestamp: new Date(),
      metadata
    };
    
    await dbService.addMessage(message);
    
    // Broadcast to WebSocket clients
    broadcast({
      type: 'agent:message',
      data: message
    });
    
    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Enhanced port configuration with proper environment variable handling
const DEFAULT_PORT = 4005;
const PORT = parseInt(process.env.WEBSOCKET_SERVER_PORT || process.env.PORT || DEFAULT_PORT.toString(), 10);

server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
  console.log(`REST API available at http://localhost:${PORT}/api`);
  console.log(`Database health: ${dbService.getHealthStatus().healthy ? 'healthy' : 'unhealthy'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  dbService.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down WebSocket server...');
  dbService.close();
  process.exit(0);
});