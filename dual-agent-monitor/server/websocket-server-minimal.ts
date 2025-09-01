import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { PostgresDatabaseService } from './database/PostgresDatabaseService';
import { DatabaseInterface } from './database/DatabaseInterface';
import { AgentMessage, DualAgentSession, WebSocketMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors({
  origin: ['http://localhost:6005', 'http://localhost:6011', 'http://localhost:6012', 'http://localhost:6013', 'http://localhost:6014', 'http://localhost:6015', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:4001'],
  credentials: true
}));
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize database service with PostgreSQL connection
const dbService: DatabaseInterface = new PostgresDatabaseService({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5434'),
  database: process.env.POSTGRES_DB || 'dual_agent_monitor',
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'dual_agent_secure_pass_2025',
  ssl: process.env.POSTGRES_SSL === 'true',
  maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20')
});

// Check database health on startup
async function checkDatabaseHealth() {
  try {
    const health = await dbService.getHealthStatus();
    if (health.healthy) {
      console.log('Database connection is healthy');
    } else {
      console.log('Database connection is not healthy');
    }
  } catch (error) {
    console.error('Failed to check database health:', error);
    console.log('API server will continue with limited functionality');
  }
}

// Check database health asynchronously
checkDatabaseHealth();

const clients = new Set<WebSocket>();

// In-memory storage for active sessions
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

        case 'send_message':
          try {
            if (!currentSession && data.sessionInfo) {
              const sessionId = await dbService.createSession({
                startTime: new Date(),
                status: 'running',
                initialTask: data.sessionInfo.task || 'Dual-agent task',
                workDir: data.sessionInfo.workDir || process.cwd()
              });
              currentSession = await dbService.getSession(sessionId);
            }

            if (currentSession && data.message && data.agent) {
              const agentMessage: AgentMessage = {
                id: uuidv4(),
                sessionId: currentSession.id,
                agentType: data.agent === 'manager' ? 'manager' : 'worker',
                messageType: data.messageType || 'prompt',
                content: data.message,
                timestamp: new Date(),
                metadata: data.metadata
              };
              
              await dbService.addMessage(agentMessage);
              
              broadcast({
                type: 'agent:message',
                data: agentMessage
              });
            }
          } catch (error) {
            console.error('Error handling send_message:', error);
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

// REST API endpoints
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = dbService.getHealthCheck ? await dbService.getHealthCheck() : { healthy: true, message: 'Health check not implemented' };
    
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
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      database: { healthy: false, message: 'Database health check failed' },
      agents: {
        running: false,
        sessionId: null
      },
      websocket: {
        clients: clients.size
      }
    });
  }
});

// Monitoring data endpoint for automatic-claude-code integration
app.post('/api/monitoring', async (req, res) => {
  try {
    const data = req.body;
    
    if (data.agentType && data.message) {
      if (!currentSession && data.sessionInfo) {
        const sessionId = await dbService.createSession({
          startTime: new Date(),
          status: 'running',
          initialTask: data.sessionInfo.task || 'Dual-agent task',
          workDir: data.sessionInfo.workDir || process.cwd()
        });
        currentSession = await dbService.getSession(sessionId);
      }

      if (currentSession) {
        const agentMessage: AgentMessage = {
          id: uuidv4(),
          sessionId: currentSession.id,
          agentType: data.agentType,
          messageType: data.messageType || 'prompt',
          content: data.message,
          timestamp: new Date(),
          metadata: data.metadata
        };
        
        await dbService.addMessage(agentMessage);
        
        broadcast({
          type: 'agent_message',
          data: agentMessage
        });
      }
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error processing monitoring data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sessions API
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await dbService.getAllSessions();
    res.json({
      sessions: sessions,
      total: sessions.length,
      page: 1,
      limit: sessions.length
    });
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
    
    const sessionId = await dbService.createSession({
      startTime: new Date(),
      status: 'running',
      initialTask: initialTask,
      workDir: workDir || process.cwd()
    });
    
    const session = await dbService.getSession(sessionId);
    if (session) {
      currentSession = session;
      
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

// Enhanced port configuration
const DEFAULT_PORT = 4005;
const PORT = parseInt(process.env.WEBSOCKET_SERVER_PORT || process.env.PORT || DEFAULT_PORT.toString(), 10);

server.listen(PORT, async () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
  console.log(`REST API available at http://localhost:${PORT}/api`);
  
  try {
    if (dbService.getHealthCheck) {
      const dbHealth = await dbService.getHealthCheck();
      console.log(`Database health: ${dbHealth.healthy ? 'healthy' : 'unhealthy'}`);
      if (dbHealth.details) {
        console.log(`Database details:`, dbHealth.details);
      }
    } else {
      console.log('Database health check not implemented');
    }
  } catch (error) {
    console.error('Error checking database health:', error);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down WebSocket server...');
  dbService.close && dbService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down WebSocket server...');
  dbService.close && dbService.close();
  process.exit(0);
});