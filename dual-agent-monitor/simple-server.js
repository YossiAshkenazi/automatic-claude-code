const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Serve standalone UI as default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'standalone-ui.html'));
});

// Static files (after specific routes)
app.use(express.static(__dirname));

// Session storage
const SESSIONS_DIR = path.join(__dirname, '.dual-agent-sessions');
const sessions = new Map();
const connectedClients = new Set();

// Ensure sessions directory exists
async function ensureSessionsDir() {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating sessions directory:', err);
  }
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  connectedClients.add(ws);
  
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    connectedClients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
        connectedClients.delete(client);
      }
    }
  });
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    sessions: sessions.size,
    activeSessions: Array.from(sessions.values()).filter(s => s.status === 'active').length,
    connectedClients: connectedClients.size,
    timestamp: new Date().toISOString()
  });
});

// Get all sessions
app.get('/sessions', (req, res) => {
  const sessionList = Array.from(sessions.values()).map(session => ({
    id: session.id,
    initialTask: session.initialTask,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length
  }));
  res.json(sessionList);
});

// Create new session
app.post('/sessions', async (req, res) => {
  try {
    const { initialTask, workDir = process.cwd() } = req.body;
    
    if (!initialTask) {
      return res.status(400).json({ error: 'initialTask is required' });
    }
    
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      initialTask,
      workDir,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      agentStates: {
        manager: { status: 'ready', lastActive: new Date().toISOString() },
        worker: { status: 'ready', lastActive: new Date().toISOString() }
      }
    };
    
    sessions.set(sessionId, session);
    
    // Save to file
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    
    // Broadcast new session
    broadcast({ type: 'session_created', session });
    
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific session
app.get('/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// Update session
app.put('/sessions/:id', async (req, res) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const { status, agentStates } = req.body;
    
    if (status) session.status = status;
    if (agentStates) session.agentStates = { ...session.agentStates, ...agentStates };
    session.updatedAt = new Date().toISOString();
    
    // Save to file
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    
    // Broadcast update
    broadcast({ type: 'session_updated', session });
    
    res.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add message to session
app.post('/sessions/:id/messages', async (req, res) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const { agentType, messageType, content, metadata = {} } = req.body;
    
    if (!agentType || !messageType || !content) {
      return res.status(400).json({ error: 'agentType, messageType, and content are required' });
    }
    
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentType, // 'manager' | 'worker' | 'system'
      messageType, // 'prompt' | 'response' | 'error' | 'status'
      content,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
    
    // Update agent last active time
    if (session.agentStates[agentType]) {
      session.agentStates[agentType].lastActive = message.timestamp;
    }
    
    // Save to file
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    
    // Broadcast new message
    broadcast({ type: 'message_added', sessionId: session.id, message });
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session messages
app.get('/sessions/:id/messages', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session.messages);
});

// Serve simple HTML interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Dual Agent Monitor</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .panes { display: flex; gap: 20px; margin-top: 20px; }
        .pane { flex: 1; border: 1px solid #ddd; border-radius: 5px; padding: 15px; }
        .manager-pane { border-left: 4px solid #3498db; }
        .worker-pane { border-left: 4px solid #e74c3c; }
        .message { margin: 10px 0; padding: 10px; border-radius: 3px; background: #f9f9f9; }
        .prompt { background: #e3f2fd; }
        .response { background: #f3e5f5; }
        .error { background: #ffebee; }
        button { padding: 10px 20px; margin: 5px; border: none; border-radius: 3px; cursor: pointer; background: #3498db; color: white; }
        button:hover { background: #2980b9; }
        .create-session { background: #2ecc71; margin-bottom: 20px; }
        input { padding: 8px; margin: 5px; width: 300px; border: 1px solid #ddd; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Dual Agent Monitor</h1>
        
        <div class="status">
            <strong>Status:</strong> <span id="status">Connecting...</span><br>
            <strong>Sessions:</strong> <span id="sessionCount">0</span><br>
            <strong>Connected Clients:</strong> <span id="clientCount">0</span>
        </div>
        
        <div>
            <input type="text" id="taskInput" placeholder="Enter initial task..." />
            <button class="create-session" onclick="createSession()">Create Session</button>
        </div>
        
        <h3>Sessions</h3>
        <div id="sessions"></div>
        
        <div class="panes">
            <div class="pane manager-pane">
                <h3>👔 Manager Agent (Opus)</h3>
                <div id="managerMessages">No messages yet...</div>
            </div>
            <div class="pane worker-pane">
                <h3>🔧 Worker Agent (Sonnet)</h3>
                <div id="workerMessages">No messages yet...</div>
            </div>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:6003');
        let currentSession = null;
        
        ws.onopen = function() {
            document.getElementById('status').textContent = 'Connected ✅';
            loadSessions();
            loadHealth();
        };
        
        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log('WebSocket message:', data);
            
            if (data.type === 'message_added' && currentSession === data.sessionId) {
                displayMessage(data.message);
            }
        };
        
        ws.onerror = function(error) {
            document.getElementById('status').textContent = 'Error ❌';
            console.error('WebSocket error:', error);
        };
        
        async function loadHealth() {
            try {
                const response = await fetch('/health');
                const health = await response.json();
                document.getElementById('sessionCount').textContent = health.sessions;
                document.getElementById('clientCount').textContent = health.connectedClients;
            } catch (error) {
                console.error('Error loading health:', error);
            }
        }
        
        async function loadSessions() {
            try {
                const response = await fetch('/sessions');
                const sessions = await response.json();
                const container = document.getElementById('sessions');
                
                container.innerHTML = sessions.map(session => \`
                    <div style="border: 1px solid #ddd; padding: 10px; margin: 5px; border-radius: 3px;">
                        <strong>\${session.id}</strong><br>
                        Task: \${session.initialTask}<br>
                        Status: \${session.status}<br>
                        Messages: \${session.messageCount}<br>
                        <button onclick="viewSession('\${session.id}')">View</button>
                    </div>
                \`).join('');
            } catch (error) {
                console.error('Error loading sessions:', error);
            }
        }
        
        async function createSession() {
            const task = document.getElementById('taskInput').value.trim();
            if (!task) {
                alert('Please enter a task');
                return;
            }
            
            try {
                const response = await fetch('/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ initialTask: task })
                });
                
                const session = await response.json();
                currentSession = session.id;
                document.getElementById('taskInput').value = '';
                loadSessions();
                loadHealth();
                
                // Clear messages
                document.getElementById('managerMessages').innerHTML = '';
                document.getElementById('workerMessages').innerHTML = '';
                
            } catch (error) {
                console.error('Error creating session:', error);
                alert('Error creating session');
            }
        }
        
        async function viewSession(sessionId) {
            currentSession = sessionId;
            
            try {
                const response = await fetch(\`/sessions/\${sessionId}/messages\`);
                const messages = await response.json();
                
                document.getElementById('managerMessages').innerHTML = '';
                document.getElementById('workerMessages').innerHTML = '';
                
                messages.forEach(message => displayMessage(message));
                
            } catch (error) {
                console.error('Error loading session:', error);
            }
        }
        
        function displayMessage(message) {
            const container = message.agentType === 'manager' 
                ? document.getElementById('managerMessages')
                : document.getElementById('workerMessages');
            
            const div = document.createElement('div');
            div.className = \`message \${message.messageType}\`;
            div.innerHTML = \`
                <strong>[\${message.messageType.toUpperCase()}]</strong><br>
                \${message.content.replace(/\\n/g, '<br>')}<br>
                <small>\${new Date(message.timestamp).toLocaleString()}</small>
            \`;
            
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        }
        
        // Auto-refresh health every 5 seconds
        setInterval(loadHealth, 5000);
    </script>
</body>
</html>
  `);
});

// Initialize and start server
async function startServer() {
  await ensureSessionsDir();
  
  const PORT = process.env.PORT || 6003;
  server.listen(PORT, () => {
    console.log(`🚀 Dual Agent Monitor Server running on http://localhost:${PORT}`);
    console.log(`📊 Health endpoint: http://localhost:${PORT}/health`);
    console.log(`🌐 Web interface: http://localhost:${PORT}`);
    console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer().catch(console.error);