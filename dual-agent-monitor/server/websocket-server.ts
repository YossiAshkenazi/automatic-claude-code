import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { AgentIntegrationService, AgentMessage, SessionData } from '../src/services/AgentIntegrationService';

const app = express();
app.use(cors({
  origin: ['http://localhost:6005', 'http://localhost:6011', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:4001'],
  credentials: true
}));
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const agentService = new AgentIntegrationService();
const clients = new Set<WebSocket>();

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  clients.add(ws);

  // Connection established - no initial message needed
  // The WebSocket client will detect connection via the open event

  // Send current session data if available
  const currentSession = agentService.getCurrentSession();
  if (currentSession) {
    ws.send(JSON.stringify({
      type: 'session:current',
      data: currentSession
    }));
  }

  // Send all sessions
  ws.send(JSON.stringify({
    type: 'sessions:list',
    data: agentService.getAllSessions()
  }));

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
            await agentService.startAgents(data.task, data.options);
            broadcast({
              type: 'agents:started',
              data: {
                sessionId: agentService.getCurrentSession()?.id,
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
          await agentService.stopAgents();
          broadcast({
            type: 'agents:stopped',
            data: {
              sessionId: agentService.getCurrentSession()?.id
            }
          });
          break;

        case 'session:get':
          const session = agentService.getSession(data.sessionId);
          ws.send(JSON.stringify({
            type: 'session:data',
            data: session
          }));
          break;

        case 'sessions:list':
          ws.send(JSON.stringify({
            type: 'sessions:list',
            data: agentService.getAllSessions()
          }));
          break;

        case 'sessions:historical':
          const historicalSessions = await agentService.loadHistoricalSessions();
          ws.send(JSON.stringify({
            type: 'sessions:historical',
            data: historicalSessions
          }));
          break;

        case 'message:send':
          agentService.sendMessageToAgent(data.agent, data.message);
          break;

        case 'session:export':
          const exportData = agentService.exportSessionData(data.sessionId);
          ws.send(JSON.stringify({
            type: 'session:export',
            data: exportData
          }));
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

// Agent Integration Service event listeners
agentService.on('agent:message', (message: AgentMessage) => {
  broadcast({
    type: 'agent:message',
    data: message
  });
});

agentService.on('agents:started', (data) => {
  broadcast({
    type: 'agents:started',
    data
  });
});

agentService.on('agents:stopped', (data) => {
  broadcast({
    type: 'agents:stopped',
    data
  });
});

agentService.on('agent:error', (data) => {
  broadcast({
    type: 'agent:error',
    data
  });
});

agentService.on('task:assigned', (data) => {
  broadcast({
    type: 'task:assigned',
    data
  });
});

agentService.on('task:completed', (data) => {
  broadcast({
    type: 'task:completed',
    data
  });
});

agentService.on('metrics:updated', (data) => {
  broadcast({
    type: 'metrics:updated',
    data
  });
});

agentService.on('session:ended', (data) => {
  broadcast({
    type: 'session:ended',
    data
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
  res.json({
    status: 'healthy',
    agents: {
      running: agentService.getCurrentSession() ? true : false,
      sessionId: agentService.getCurrentSession()?.id
    },
    websocket: {
      clients: clients.size
    }
  });
});

app.get('/api/sessions', (req, res) => {
  res.json(agentService.getAllSessions());
});

app.get('/api/sessions/:id', (req, res) => {
  const session = agentService.getSession(req.params.id);
  if (session) {
    res.json(session);
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.post('/api/agents/start', async (req, res) => {
  try {
    await agentService.startAgents(req.body.task, req.body.options);
    res.json({
      success: true,
      sessionId: agentService.getCurrentSession()?.id
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/agents/stop', async (req, res) => {
  await agentService.stopAgents();
  res.json({ success: true });
});

app.get('/api/sessions/:id/export', (req, res) => {
  try {
    const data = agentService.exportSessionData(req.params.id);
    res.header('Content-Type', 'application/json');
    res.header('Content-Disposition', `attachment; filename="session_${req.params.id}.json"`);
    res.send(data);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Standard port configuration
const DEFAULT_PORT = 4001;
const PORT = process.env.WEBSOCKET_SERVER_PORT || process.env.PORT || DEFAULT_PORT;
server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
  console.log(`REST API available at http://localhost:${PORT}/api`);
});