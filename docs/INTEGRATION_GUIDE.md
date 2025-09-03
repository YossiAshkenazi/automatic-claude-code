# Integration Guide - Visual Agent Management Platform

## 🎯 **Overview**

This guide provides comprehensive instructions for integrating all components of the Visual Agent Management Platform. The system consists of multiple interconnected layers that work together to provide real-time visual management of parallel Claude Code CLI agents.

---

## 🏗️ **Architecture Integration Overview**

### **System Components Integration Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                               │
│                  (React + TypeScript)                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Agent Dashboard │ │ Workflow Canvas │ │ Task Management │    │
│  │ Port: 6011      │ │ WebSocket: WS   │ │ Real-time: WS   │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/WebSocket Communication
┌─────────────────────▼───────────────────────────────────────────┐
│                  ORCHESTRATION LAYER                           │
│                 (Python + FastAPI)                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Agent Manager   │ │ Task Processor  │ │ Communication   │    │
│  │ Port: 4005      │ │ Background      │ │ Hub: WS         │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Process Management
┌─────────────────────▼───────────────────────────────────────────┐
│                  CLI WRAPPER LAYER                             │
│                 (Enhanced Python)                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Multi-Agent     │ │ Process Pool    │ │ Communication   │    │
│  │ CLI Wrapper     │ │ Manager         │ │ Protocol        │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ CLI Execution
┌─────────────────────▼───────────────────────────────────────────┐
│                CLAUDE CODE CLI AGENTS                          │
│               (Multiple Instances)                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Manager Agent   │ │ Worker Agent 1  │ │ Worker Agent N  │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 **Component Integration Patterns**

### **1. Frontend-Backend Integration**

#### **WebSocket Connection Management**
The React frontend connects to the Python backend through WebSocket for real-time updates:

```typescript
// Frontend: useWebSocket.ts
import { io, Socket } from 'socket.io-client';

export const useWebSocket = (url: string = 'ws://localhost:4005') => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const socketInstance = io(url, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('Connected to orchestrator');
    });
    
    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from orchestrator');
    });
    
    socketInstance.on('agent_status_update', (data: AgentStatusUpdate) => {
      // Handle real-time agent status updates
      dispatch(updateAgentStatus(data));
    });
    
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
    };
  }, [url]);
  
  return { socket, connected };
};
```

#### **HTTP API Integration**
Standard REST API calls for CRUD operations:

```typescript
// Frontend: agentService.ts
import axios from 'axios';

const API_BASE = 'http://localhost:4005/api';

export const agentService = {
  // Create new agent
  async createAgent(config: AgentConfig): Promise<Agent> {
    const response = await axios.post(`${API_BASE}/agents`, config);
    return response.data;
  },
  
  // Get all agents
  async getAgents(): Promise<Agent[]> {
    const response = await axios.get(`${API_BASE}/agents`);
    return response.data;
  },
  
  // Send task to agent
  async assignTask(agentId: string, task: Task): Promise<TaskResult> {
    const response = await axios.post(`${API_BASE}/agents/${agentId}/tasks`, task);
    return response.data;
  },
  
  // Terminate agent
  async terminateAgent(agentId: string): Promise<void> {
    await axios.delete(`${API_BASE}/agents/${agentId}`);
  }
};
```

### **2. Python Orchestrator Integration**

#### **FastAPI Application Setup**
```python
# Backend: main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
from typing import Dict, Set
import json

from agent_orchestrator.agent_manager import AgentManager
from agent_orchestrator.task_processor import TaskProcessor
from websocket.connection_manager import ConnectionManager

app = FastAPI(title="Visual Agent Management API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:6011"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
agent_manager = AgentManager()
task_processor = TaskProcessor(agent_manager)
connection_manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    """Initialize system components"""
    await agent_manager.initialize()
    await task_processor.initialize()
    print("📡 Visual Agent Management Platform - API Server Started")
    print("🔗 Frontend: http://localhost:6011")
    print("📊 API Docs: http://localhost:4005/docs")

# WebSocket endpoint for real-time communication
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await connection_manager.connect(websocket)
    try:
        while True:
            # Handle incoming WebSocket messages from frontend
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Route message to appropriate handler
            await handle_websocket_message(websocket, message)
            
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)

async def handle_websocket_message(websocket: WebSocket, message: dict):
    """Route WebSocket messages to appropriate handlers"""
    message_type = message.get('type')
    
    if message_type == 'create_agent':
        result = await agent_manager.create_agent(message['config'])
        await websocket.send_text(json.dumps({
            'type': 'agent_created',
            'data': result
        }))
    
    elif message_type == 'assign_task':
        result = await task_processor.assign_task(
            message['agent_id'], 
            message['task']
        )
        await websocket.send_text(json.dumps({
            'type': 'task_assigned',
            'data': result
        }))
```

#### **Agent Manager Integration**
```python
# Backend: agent_orchestrator/agent_manager.py
import asyncio
from typing import Dict, Optional
from dataclasses import dataclass
import uuid
from datetime import datetime

from multi_agent_wrapper.cli_wrapper import MultiAgentCLIWrapper
from websocket.connection_manager import ConnectionManager

@dataclass
class Agent:
    id: str
    role: str  # 'manager' or 'worker'
    status: str  # 'idle', 'busy', 'error'
    config: dict
    created_at: datetime
    process_id: Optional[int] = None

class AgentManager:
    def __init__(self):
        self.agents: Dict[str, Agent] = {}
        self.cli_wrapper = MultiAgentCLIWrapper()
        self.connection_manager: Optional[ConnectionManager] = None
    
    async def initialize(self):
        """Initialize the agent manager"""
        await self.cli_wrapper.initialize()
    
    async def create_agent(self, config: dict) -> Agent:
        """Create a new agent"""
        agent_id = str(uuid.uuid4())
        
        # Create agent through CLI wrapper
        process_info = await self.cli_wrapper.create_agent(
            agent_id=agent_id,
            role=config['role'],
            model=config.get('model', 'sonnet'),
            resource_limits=config.get('resource_limits', {})
        )
        
        agent = Agent(
            id=agent_id,
            role=config['role'],
            status='idle',
            config=config,
            created_at=datetime.now(),
            process_id=process_info.process_id
        )
        
        self.agents[agent_id] = agent
        
        # Notify frontend via WebSocket
        if self.connection_manager:
            await self.connection_manager.broadcast({
                'type': 'agent_status_update',
                'agent_id': agent_id,
                'status': 'idle',
                'data': agent.__dict__
            })
        
        return agent
    
    async def assign_task(self, agent_id: str, task: dict) -> dict:
        """Assign task to specific agent"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = self.agents[agent_id]
        agent.status = 'busy'
        
        # Send task to CLI wrapper
        result = await self.cli_wrapper.send_task(agent_id, task)
        
        agent.status = 'idle'
        
        # Notify frontend
        if self.connection_manager:
            await self.connection_manager.broadcast({
                'type': 'task_completed',
                'agent_id': agent_id,
                'task_id': task['id'],
                'result': result
            })
        
        return result
    
    async def terminate_agent(self, agent_id: str):
        """Terminate specific agent"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        await self.cli_wrapper.terminate_agent(agent_id)
        del self.agents[agent_id]
        
        # Notify frontend
        if self.connection_manager:
            await self.connection_manager.broadcast({
                'type': 'agent_terminated',
                'agent_id': agent_id
            })
```

### **3. CLI Wrapper Integration**

#### **Enhanced Multi-Agent CLI Wrapper**
```python
# Backend: multi_agent_wrapper/cli_wrapper.py
import asyncio
import subprocess
import json
from typing import Dict, Optional, Any
from dataclasses import dataclass
import uuid
from pathlib import Path
import signal
import psutil
import logging

logger = logging.getLogger(__name__)

@dataclass
class AgentProcess:
    agent_id: str
    role: str
    process: subprocess.Popen
    process_id: int
    status: str
    resource_limits: dict
    message_queue: asyncio.Queue
    
class MultiAgentCLIWrapper:
    def __init__(self, max_agents: int = 5):
        self.max_agents = max_agents
        self.agents: Dict[str, AgentProcess] = {}
        self.process_monitor_task: Optional[asyncio.Task] = None
        
    async def initialize(self):
        """Initialize the wrapper"""
        # Start background process monitoring
        self.process_monitor_task = asyncio.create_task(self._monitor_processes())
        logger.info("Multi-Agent CLI Wrapper initialized")
    
    async def create_agent(self, agent_id: str, role: str, model: str = 'sonnet', 
                          resource_limits: dict = None) -> AgentProcess:
        """Create and start a new agent process"""
        if len(self.agents) >= self.max_agents:
            raise RuntimeError(f"Maximum agents ({self.max_agents}) reached")
        
        # Prepare Claude CLI command
        cmd = [
            'claude',
            '--model', model,
            '--agent-id', agent_id,
            '--role', role,
            '--interactive'
        ]
        
        # Apply resource limits if specified
        if resource_limits:
            if 'memory_mb' in resource_limits:
                cmd.extend(['--memory-limit', str(resource_limits['memory_mb'])])
            if 'timeout_seconds' in resource_limits:
                cmd.extend(['--timeout', str(resource_limits['timeout_seconds'])])
        
        # Start process
        try:
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=0
            )
            
            agent_process = AgentProcess(
                agent_id=agent_id,
                role=role,
                process=process,
                process_id=process.pid,
                status='starting',
                resource_limits=resource_limits or {},
                message_queue=asyncio.Queue()
            )
            
            self.agents[agent_id] = agent_process
            
            # Wait for agent to be ready
            await self._wait_for_agent_ready(agent_process)
            agent_process.status = 'idle'
            
            logger.info(f"Created {role} agent {agent_id} (PID: {process.pid})")
            return agent_process
            
        except Exception as e:
            logger.error(f"Failed to create agent {agent_id}: {e}")
            raise
    
    async def send_task(self, agent_id: str, task: dict) -> dict:
        """Send task to specific agent and await response"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = self.agents[agent_id]
        agent.status = 'busy'
        
        try:
            # Prepare task message
            task_message = {
                'type': 'task',
                'id': str(uuid.uuid4()),
                'content': task,
                'timestamp': datetime.now().isoformat()
            }
            
            # Send to agent process
            task_json = json.dumps(task_message) + '\n'
            agent.process.stdin.write(task_json)
            agent.process.stdin.flush()
            
            # Wait for response
            response = await self._read_agent_response(agent)
            
            agent.status = 'idle'
            return response
            
        except Exception as e:
            agent.status = 'error'
            logger.error(f"Task execution failed for agent {agent_id}: {e}")
            raise
    
    async def terminate_agent(self, agent_id: str):
        """Gracefully terminate agent process"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = self.agents[agent_id]
        agent.status = 'terminating'
        
        try:
            # Send termination signal
            agent.process.terminate()
            
            # Wait for graceful shutdown (5 seconds)
            try:
                await asyncio.wait_for(
                    asyncio.create_task(self._wait_for_process_end(agent.process)),
                    timeout=5.0
                )
            except asyncio.TimeoutError:
                # Force kill if not terminated gracefully
                agent.process.kill()
                await asyncio.create_task(self._wait_for_process_end(agent.process))
            
            del self.agents[agent_id]
            logger.info(f"Terminated agent {agent_id}")
            
        except Exception as e:
            logger.error(f"Error terminating agent {agent_id}: {e}")
            raise
    
    async def _monitor_processes(self):
        """Background task to monitor agent process health"""
        while True:
            try:
                for agent_id, agent in list(self.agents.items()):
                    if agent.process.poll() is not None:
                        # Process has terminated
                        logger.warning(f"Agent {agent_id} process terminated unexpectedly")
                        agent.status = 'failed'
                        # Optionally restart agent here
                
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                logger.error(f"Process monitoring error: {e}")
                await asyncio.sleep(10)
    
    async def _wait_for_agent_ready(self, agent: AgentProcess, timeout: int = 30):
        """Wait for agent to be ready to receive tasks"""
        start_time = asyncio.get_event_loop().time()
        
        while True:
            if asyncio.get_event_loop().time() - start_time > timeout:
                raise TimeoutError(f"Agent {agent.agent_id} failed to start within {timeout}s")
            
            # Check if process is still alive
            if agent.process.poll() is not None:
                raise RuntimeError(f"Agent {agent.agent_id} process terminated during startup")
            
            # Send ping to check if ready
            try:
                ping_message = json.dumps({'type': 'ping'}) + '\n'
                agent.process.stdin.write(ping_message)
                agent.process.stdin.flush()
                
                # Try to read response (non-blocking)
                # Implementation depends on specific Claude CLI response format
                # For now, assume ready after process starts
                break
                
            except Exception:
                await asyncio.sleep(1)
    
    async def _read_agent_response(self, agent: AgentProcess, timeout: int = 300) -> dict:
        """Read response from agent process"""
        start_time = asyncio.get_event_loop().time()
        response_buffer = ""
        
        while True:
            if asyncio.get_event_loop().time() - start_time > timeout:
                raise TimeoutError(f"Agent {agent.agent_id} response timeout")
            
            # Read from process stdout
            try:
                # This is a simplified implementation
                # Real implementation would need proper async reading
                line = agent.process.stdout.readline()
                if line:
                    response_buffer += line
                    
                    # Try to parse JSON response
                    try:
                        response = json.loads(response_buffer.strip())
                        return response
                    except json.JSONDecodeError:
                        # Not complete JSON yet, continue reading
                        continue
                
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Error reading from agent {agent.agent_id}: {e}")
                raise
    
    async def _wait_for_process_end(self, process: subprocess.Popen):
        """Wait for process to terminate"""
        while process.poll() is None:
            await asyncio.sleep(0.1)
    
    async def shutdown(self):
        """Shutdown all agents and cleanup"""
        logger.info("Shutting down Multi-Agent CLI Wrapper")
        
        # Terminate all agents
        for agent_id in list(self.agents.keys()):
            try:
                await self.terminate_agent(agent_id)
            except Exception as e:
                logger.error(f"Error terminating agent {agent_id}: {e}")
        
        # Cancel monitoring task
        if self.process_monitor_task:
            self.process_monitor_task.cancel()
            try:
                await self.process_monitor_task
            except asyncio.CancelledError:
                pass
```

---

## 🔄 **Agent Coordination Workflows**

### **1. Manager-Worker Task Handoff**

#### **Workflow Sequence:**
```python
# Agent coordination workflow
async def manager_worker_handoff(task_description: str):
    """Complete workflow for Manager-Worker coordination"""
    
    # 1. Manager analyzes and breaks down task
    manager_analysis = await send_to_manager({
        'type': 'analyze_task',
        'description': task_description,
        'breakdown_level': 'detailed'
    })
    
    # 2. Manager selects appropriate Worker
    worker_selection = await send_to_manager({
        'type': 'select_worker',
        'task_requirements': manager_analysis['requirements'],
        'available_workers': get_available_workers()
    })
    
    selected_worker = worker_selection['selected_worker']
    
    # 3. Manager creates detailed instructions for Worker
    worker_instructions = await send_to_manager({
        'type': 'create_instructions',
        'task': manager_analysis['broken_down_task'],
        'worker_capabilities': selected_worker['capabilities']
    })
    
    # 4. Send task to Worker
    worker_result = await send_to_worker(selected_worker['id'], {
        'type': 'execute_task',
        'instructions': worker_instructions,
        'context': manager_analysis['context']
    })
    
    # 5. Manager processes Worker results
    final_result = await send_to_manager({
        'type': 'process_results',
        'worker_output': worker_result,
        'original_task': task_description
    })
    
    return final_result
```

### **2. Real-Time Status Updates**

#### **Status Broadcasting System:**
```python
# Real-time status update integration
class StatusBroadcaster:
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        
    async def broadcast_agent_status(self, agent_id: str, status: str, data: dict = None):
        """Broadcast agent status to all connected clients"""
        message = {
            'type': 'agent_status_update',
            'timestamp': datetime.now().isoformat(),
            'agent_id': agent_id,
            'status': status,
            'data': data or {}
        }
        
        await self.connection_manager.broadcast(message)
    
    async def broadcast_task_progress(self, task_id: str, agent_id: str, 
                                    progress: float, details: str = None):
        """Broadcast task progress to clients"""
        message = {
            'type': 'task_progress',
            'timestamp': datetime.now().isoformat(),
            'task_id': task_id,
            'agent_id': agent_id,
            'progress': progress,
            'details': details
        }
        
        await self.connection_manager.broadcast(message)
    
    async def broadcast_agent_communication(self, from_agent: str, to_agent: str, 
                                          message_content: dict):
        """Broadcast inter-agent communication"""
        message = {
            'type': 'agent_communication',
            'timestamp': datetime.now().isoformat(),
            'from_agent': from_agent,
            'to_agent': to_agent,
            'content': message_content
        }
        
        await self.connection_manager.broadcast(message)
```

---

## 📡 **WebSocket Communication Protocols**

### **Message Format Standards**

#### **Standard Message Structure:**
```typescript
interface BaseMessage {
  type: string;
  timestamp: string;
  id?: string;
  source?: 'frontend' | 'backend' | 'agent';
}

// Agent-related messages
interface AgentMessage extends BaseMessage {
  agent_id: string;
}

interface AgentStatusUpdate extends AgentMessage {
  type: 'agent_status_update';
  status: 'idle' | 'busy' | 'error' | 'terminating';
  data?: any;
}

interface TaskProgress extends AgentMessage {
  type: 'task_progress';
  task_id: string;
  progress: number; // 0.0 to 1.0
  details?: string;
}

interface AgentCommunication extends BaseMessage {
  type: 'agent_communication';
  from_agent: string;
  to_agent: string;
  content: any;
}

// System messages
interface SystemStatus extends BaseMessage {
  type: 'system_status';
  status: 'healthy' | 'degraded' | 'error';
  metrics: {
    active_agents: number;
    pending_tasks: number;
    system_load: number;
  };
}
```

#### **Frontend Message Handlers:**
```typescript
// Frontend: useWebSocketHandlers.ts
export const useWebSocketHandlers = () => {
  const dispatch = useDispatch();
  const { socket } = useWebSocket();
  
  useEffect(() => {
    if (!socket) return;
    
    // Agent status updates
    socket.on('agent_status_update', (data: AgentStatusUpdate) => {
      dispatch(agentSlice.actions.updateAgentStatus({
        agentId: data.agent_id,
        status: data.status,
        data: data.data
      }));
    });
    
    // Task progress updates
    socket.on('task_progress', (data: TaskProgress) => {
      dispatch(taskSlice.actions.updateTaskProgress({
        taskId: data.task_id,
        agentId: data.agent_id,
        progress: data.progress,
        details: data.details
      }));
    });
    
    // Agent communication
    socket.on('agent_communication', (data: AgentCommunication) => {
      dispatch(communicationSlice.actions.addMessage({
        id: data.id || Date.now().toString(),
        timestamp: data.timestamp,
        fromAgent: data.from_agent,
        toAgent: data.to_agent,
        content: data.content
      }));
    });
    
    // System status
    socket.on('system_status', (data: SystemStatus) => {
      dispatch(systemSlice.actions.updateSystemStatus({
        status: data.status,
        metrics: data.metrics,
        timestamp: data.timestamp
      }));
    });
    
    return () => {
      socket.off('agent_status_update');
      socket.off('task_progress');
      socket.off('agent_communication');
      socket.off('system_status');
    };
  }, [socket, dispatch]);
};
```

---

## 🗄️ **Database Integration & Persistence**

### **Database Schema**
```sql
-- PostgreSQL schema for Visual Agent Management Platform

-- Agent configurations and state
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'idle',
    config JSONB NOT NULL,
    process_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task definitions and tracking
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    assigned_agent_id UUID REFERENCES agents(id),
    parent_task_id UUID REFERENCES tasks(id),
    config JSONB,
    result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent communication logs
CREATE TABLE agent_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_agent_id UUID REFERENCES agents(id),
    to_agent_id UUID REFERENCES agents(id),
    message_type VARCHAR(100) NOT NULL,
    content JSONB NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session management
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL NOT NULL,
    unit VARCHAR(50),
    agent_id UUID REFERENCES agents(id),
    task_id UUID REFERENCES tasks(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX idx_communications_timestamp ON agent_communications(timestamp);
CREATE INDEX idx_metrics_timestamp ON performance_metrics(timestamp);
```

### **Database Integration Layer**
```python
# Backend: database/repositories/agent_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List, Optional
import json
from datetime import datetime

from database.models import Agent as AgentModel
from api.models.agent_models import Agent, AgentConfig

class AgentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_agent(self, agent: Agent) -> Agent:
        """Create new agent record"""
        db_agent = AgentModel(
            id=agent.id,
            role=agent.role,
            status=agent.status,
            config=json.dumps(agent.config),
            process_id=agent.process_id
        )
        
        self.db.add(db_agent)
        await self.db.commit()
        await self.db.refresh(db_agent)
        
        return self._to_agent_model(db_agent)
    
    async def get_agent_by_id(self, agent_id: str) -> Optional[Agent]:
        """Get agent by ID"""
        result = await self.db.execute(
            select(AgentModel).where(AgentModel.id == agent_id)
        )
        db_agent = result.scalar_one_or_none()
        
        return self._to_agent_model(db_agent) if db_agent else None
    
    async def get_all_agents(self) -> List[Agent]:
        """Get all agents"""
        result = await self.db.execute(select(AgentModel))
        db_agents = result.scalars().all()
        
        return [self._to_agent_model(agent) for agent in db_agents]
    
    async def update_agent_status(self, agent_id: str, status: str) -> None:
        """Update agent status"""
        await self.db.execute(
            update(AgentModel)
            .where(AgentModel.id == agent_id)
            .values(status=status, updated_at=datetime.utcnow())
        )
        await self.db.commit()
    
    async def delete_agent(self, agent_id: str) -> None:
        """Delete agent record"""
        await self.db.execute(
            delete(AgentModel).where(AgentModel.id == agent_id)
        )
        await self.db.commit()
    
    def _to_agent_model(self, db_agent: AgentModel) -> Agent:
        """Convert database model to domain model"""
        return Agent(
            id=db_agent.id,
            role=db_agent.role,
            status=db_agent.status,
            config=json.loads(db_agent.config),
            process_id=db_agent.process_id,
            created_at=db_agent.created_at
        )
```

---

## 🛡️ **Error Handling & Recovery Procedures**

### **Comprehensive Error Classification**
```python
# Backend: error_handling/error_classifier.py
from enum import Enum
from typing import Dict, Any, Optional
import traceback
import logging

logger = logging.getLogger(__name__)

class ErrorType(Enum):
    AGENT_CRASH = "agent_crash"
    CLI_TIMEOUT = "cli_timeout"
    COMMUNICATION_FAILURE = "communication_failure"
    RESOURCE_EXHAUSTION = "resource_exhaustion"
    TASK_FAILURE = "task_failure"
    SYSTEM_OVERLOAD = "system_overload"
    NETWORK_ERROR = "network_error"
    UNKNOWN = "unknown"

class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class ErrorContext:
    error_type: ErrorType
    severity: ErrorSeverity
    agent_id: Optional[str]
    task_id: Optional[str]
    error_message: str
    stack_trace: str
    system_state: Dict[str, Any]
    timestamp: datetime

class ErrorClassifier:
    def __init__(self):
        self.classification_rules = {
            # Agent process errors
            r"Process .* has terminated": ErrorType.AGENT_CRASH,
            r"Agent .* not responding": ErrorType.CLI_TIMEOUT,
            r"Failed to start agent": ErrorType.AGENT_CRASH,
            
            # Resource errors
            r"Memory limit exceeded": ErrorType.RESOURCE_EXHAUSTION,
            r"CPU limit exceeded": ErrorType.RESOURCE_EXHAUSTION,
            r"Too many agents": ErrorType.SYSTEM_OVERLOAD,
            
            # Communication errors
            r"WebSocket connection lost": ErrorType.COMMUNICATION_FAILURE,
            r"Failed to send message": ErrorType.COMMUNICATION_FAILURE,
            r"Connection refused": ErrorType.NETWORK_ERROR,
            
            # Task errors
            r"Task execution failed": ErrorType.TASK_FAILURE,
            r"Task timeout": ErrorType.CLI_TIMEOUT,
        }
    
    def classify_error(self, exception: Exception, context: Dict[str, Any]) -> ErrorContext:
        """Classify error and determine recovery strategy"""
        error_message = str(exception)
        stack_trace = traceback.format_exc()
        
        # Classify error type
        error_type = ErrorType.UNKNOWN
        for pattern, err_type in self.classification_rules.items():
            if re.search(pattern, error_message, re.IGNORECASE):
                error_type = err_type
                break
        
        # Determine severity
        severity = self._determine_severity(error_type, context)
        
        return ErrorContext(
            error_type=error_type,
            severity=severity,
            agent_id=context.get('agent_id'),
            task_id=context.get('task_id'),
            error_message=error_message,
            stack_trace=stack_trace,
            system_state=self._capture_system_state(),
            timestamp=datetime.now()
        )
    
    def _determine_severity(self, error_type: ErrorType, context: Dict[str, Any]) -> ErrorSeverity:
        """Determine error severity based on type and context"""
        severity_map = {
            ErrorType.AGENT_CRASH: ErrorSeverity.HIGH,
            ErrorType.CLI_TIMEOUT: ErrorSeverity.MEDIUM,
            ErrorType.COMMUNICATION_FAILURE: ErrorSeverity.MEDIUM,
            ErrorType.RESOURCE_EXHAUSTION: ErrorSeverity.HIGH,
            ErrorType.TASK_FAILURE: ErrorSeverity.LOW,
            ErrorType.SYSTEM_OVERLOAD: ErrorSeverity.CRITICAL,
            ErrorType.NETWORK_ERROR: ErrorSeverity.MEDIUM,
            ErrorType.UNKNOWN: ErrorSeverity.MEDIUM,
        }
        
        base_severity = severity_map.get(error_type, ErrorSeverity.MEDIUM)
        
        # Escalate severity based on context
        if context.get('consecutive_failures', 0) > 3:
            if base_severity == ErrorSeverity.LOW:
                return ErrorSeverity.MEDIUM
            elif base_severity == ErrorSeverity.MEDIUM:
                return ErrorSeverity.HIGH
        
        return base_severity
    
    def _capture_system_state(self) -> Dict[str, Any]:
        """Capture current system state for debugging"""
        try:
            import psutil
            return {
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'active_processes': len(psutil.pids()),
                'timestamp': datetime.now().isoformat()
            }
        except ImportError:
            return {'timestamp': datetime.now().isoformat()}
```

### **Recovery Procedures**
```python
# Backend: error_handling/recovery_manager.py
class RecoveryManager:
    def __init__(self, agent_manager, connection_manager):
        self.agent_manager = agent_manager
        self.connection_manager = connection_manager
        self.recovery_strategies = {
            ErrorType.AGENT_CRASH: self._recover_agent_crash,
            ErrorType.CLI_TIMEOUT: self._recover_cli_timeout,
            ErrorType.COMMUNICATION_FAILURE: self._recover_communication_failure,
            ErrorType.RESOURCE_EXHAUSTION: self._recover_resource_exhaustion,
            ErrorType.TASK_FAILURE: self._recover_task_failure,
        }
    
    async def handle_error(self, error_context: ErrorContext) -> RecoveryResult:
        """Handle error with appropriate recovery strategy"""
        logger.error(f"Handling {error_context.error_type} error: {error_context.error_message}")
        
        # Get recovery strategy
        recovery_func = self.recovery_strategies.get(
            error_context.error_type, 
            self._default_recovery
        )
        
        try:
            result = await recovery_func(error_context)
            
            # Notify frontend of recovery attempt
            await self.connection_manager.broadcast({
                'type': 'error_recovery',
                'error_type': error_context.error_type.value,
                'recovery_result': result.success,
                'message': result.message,
                'timestamp': datetime.now().isoformat()
            })
            
            return result
            
        except Exception as recovery_error:
            logger.error(f"Recovery failed: {recovery_error}")
            return RecoveryResult(
                success=False,
                message=f"Recovery failed: {recovery_error}",
                actions_taken=['recovery_attempt_failed']
            )
    
    async def _recover_agent_crash(self, context: ErrorContext) -> RecoveryResult:
        """Recover from agent process crash"""
        if not context.agent_id:
            return RecoveryResult(False, "No agent ID provided", [])
        
        try:
            # Get agent configuration
            agent = await self.agent_manager.get_agent(context.agent_id)
            if not agent:
                return RecoveryResult(False, "Agent not found", [])
            
            # Terminate any remaining processes
            await self.agent_manager.force_terminate_agent(context.agent_id)
            
            # Recreate agent with same configuration
            new_agent = await self.agent_manager.create_agent(agent.config)
            
            return RecoveryResult(
                success=True,
                message=f"Agent {context.agent_id} restarted successfully",
                actions_taken=['terminate_old_process', 'create_new_agent']
            )
            
        except Exception as e:
            return RecoveryResult(
                success=False,
                message=f"Failed to restart agent: {e}",
                actions_taken=['terminate_old_process']
            )
    
    async def _recover_cli_timeout(self, context: ErrorContext) -> RecoveryResult:
        """Recover from CLI timeout"""
        if not context.agent_id:
            return RecoveryResult(False, "No agent ID provided", [])
        
        try:
            # Reset agent state
            await self.agent_manager.reset_agent_state(context.agent_id)
            
            # If task was running, mark it as failed and allow retry
            if context.task_id:
                await self.agent_manager.fail_task(context.task_id, "CLI timeout")
            
            return RecoveryResult(
                success=True,
                message="Agent state reset after timeout",
                actions_taken=['reset_agent_state', 'fail_current_task']
            )
            
        except Exception as e:
            return RecoveryResult(
                success=False,
                message=f"Failed to recover from timeout: {e}",
                actions_taken=[]
            )
    
    async def _recover_communication_failure(self, context: ErrorContext) -> RecoveryResult:
        """Recover from communication failure"""
        try:
            # Attempt to reconnect all WebSocket connections
            await self.connection_manager.reconnect_all()
            
            # Resync agent states
            agents = await self.agent_manager.get_all_agents()
            for agent in agents:
                await self.connection_manager.broadcast({
                    'type': 'agent_status_sync',
                    'agent_id': agent.id,
                    'status': agent.status,
                    'data': agent.__dict__
                })
            
            return RecoveryResult(
                success=True,
                message="Communication restored",
                actions_taken=['reconnect_websockets', 'sync_agent_states']
            )
            
        except Exception as e:
            return RecoveryResult(
                success=False,
                message=f"Failed to restore communication: {e}",
                actions_taken=['attempted_reconnect']
            )
    
    async def _recover_resource_exhaustion(self, context: ErrorContext) -> RecoveryResult:
        """Recover from resource exhaustion"""
        try:
            actions = []
            
            # Free up resources by terminating idle agents
            idle_agents = await self.agent_manager.get_agents_by_status('idle')
            if len(idle_agents) > 2:  # Keep at least 2 idle agents
                agents_to_terminate = idle_agents[2:]
                for agent in agents_to_terminate:
                    await self.agent_manager.terminate_agent(agent.id)
                    actions.append(f'terminated_idle_agent_{agent.id}')
            
            # Clear completed tasks from memory
            await self.agent_manager.cleanup_completed_tasks()
            actions.append('cleanup_completed_tasks')
            
            return RecoveryResult(
                success=True,
                message=f"Freed resources by terminating {len(agents_to_terminate)} idle agents",
                actions_taken=actions
            )
            
        except Exception as e:
            return RecoveryResult(
                success=False,
                message=f"Failed to free resources: {e}",
                actions_taken=[]
            )

@dataclass
class RecoveryResult:
    success: bool
    message: str
    actions_taken: List[str]
```

---

## 🚀 **Deployment Integration**

### **Production Deployment Configuration**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: visual_agent_platform
      POSTGRES_USER: platform_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  # Redis for caching and message queuing
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

  # Python Backend API
  api:
    build:
      context: ./python-sdk
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://platform_user:${POSTGRES_PASSWORD}@postgres:5432/visual_agent_platform
      - REDIS_URL=redis://redis:6379
      - CLAUDE_CLI_PATH=/usr/local/bin/claude
    ports:
      - "4005:4005"
    volumes:
      - ./python-sdk:/app
      - /var/run/docker.sock:/var/run/docker.sock  # For process management
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # React Frontend
  frontend:
    build:
      context: ./dual-agent-monitor
      dockerfile: Dockerfile
    environment:
      - REACT_APP_API_URL=http://localhost:4005
      - REACT_APP_WS_URL=ws://localhost:4005
    ports:
      - "6011:6011"
    depends_on:
      - api
    restart: unless-stopped

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - frontend
      - api
    restart: unless-stopped

volumes:
  postgres_data:
```

### **Environment Configuration**
```bash
# .env.production
# Database
POSTGRES_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://platform_user:${POSTGRES_PASSWORD}@postgres:5432/visual_agent_platform

# Redis
REDIS_URL=redis://redis:6379

# API Configuration
API_PORT=4005
API_HOST=0.0.0.0
CORS_ORIGINS=http://localhost:6011,https://your-domain.com

# Frontend Configuration
REACT_APP_API_URL=https://your-domain.com/api
REACT_APP_WS_URL=wss://your-domain.com/ws

# Claude CLI Configuration
CLAUDE_CLI_PATH=/usr/local/bin/claude
CLAUDE_MAX_AGENTS=10
CLAUDE_AGENT_TIMEOUT=300

# Monitoring
LOG_LEVEL=INFO
MONITORING_ENABLED=true
METRICS_RETENTION_DAYS=30

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here
```

---

## 🔍 **Testing Integration**

### **End-to-End Integration Tests**
```python
# tests/integration/test_full_system.py
import pytest
import asyncio
import websockets
import json
from datetime import datetime
import requests

@pytest.mark.asyncio
async def test_complete_agent_workflow():
    """Test complete workflow from agent creation to task completion"""
    
    # 1. Test API health
    response = requests.get("http://localhost:4005/api/health")
    assert response.status_code == 200
    
    # 2. Connect to WebSocket
    uri = "ws://localhost:4005/ws"
    async with websockets.connect(uri) as websocket:
        
        # 3. Create Manager agent
        create_manager_msg = {
            "type": "create_agent",
            "config": {
                "role": "manager",
                "model": "sonnet",
                "resource_limits": {
                    "memory_mb": 512,
                    "timeout_seconds": 300
                }
            }
        }
        
        await websocket.send(json.dumps(create_manager_msg))
        response = await websocket.recv()
        manager_response = json.loads(response)
        
        assert manager_response["type"] == "agent_created"
        manager_id = manager_response["data"]["id"]
        
        # 4. Create Worker agent
        create_worker_msg = {
            "type": "create_agent", 
            "config": {
                "role": "worker",
                "model": "sonnet",
                "resource_limits": {
                    "memory_mb": 256,
                    "timeout_seconds": 180
                }
            }
        }
        
        await websocket.send(json.dumps(create_worker_msg))
        response = await websocket.recv()
        worker_response = json.loads(response)
        
        assert worker_response["type"] == "agent_created"
        worker_id = worker_response["data"]["id"]
        
        # 5. Assign task to Manager
        task_msg = {
            "type": "assign_task",
            "agent_id": manager_id,
            "task": {
                "id": "test-task-001",
                "description": "Create a simple Hello World Python script",
                "priority": 1
            }
        }
        
        await websocket.send(json.dumps(task_msg))
        
        # 6. Monitor for task completion
        task_completed = False
        timeout = 60  # 60 seconds timeout
        start_time = datetime.now()
        
        while not task_completed and (datetime.now() - start_time).seconds < timeout:
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                message = json.loads(response)
                
                if message.get("type") == "task_completed":
                    task_completed = True
                    assert message["task_id"] == "test-task-001"
                    assert "result" in message
                    
            except asyncio.TimeoutError:
                continue
        
        assert task_completed, "Task did not complete within timeout"
        
        # 7. Cleanup - terminate agents
        terminate_manager_msg = {
            "type": "terminate_agent",
            "agent_id": manager_id
        }
        await websocket.send(json.dumps(terminate_manager_msg))
        
        terminate_worker_msg = {
            "type": "terminate_agent", 
            "agent_id": worker_id
        }
        await websocket.send(json.dumps(terminate_worker_msg))

@pytest.mark.asyncio
async def test_error_recovery():
    """Test error handling and recovery procedures"""
    
    # Test agent crash recovery
    # Test communication failure recovery
    # Test resource exhaustion recovery
    pass

@pytest.mark.asyncio  
async def test_performance_under_load():
    """Test system performance with multiple concurrent agents and tasks"""
    
    # Create multiple agents
    # Submit multiple concurrent tasks
    # Monitor performance metrics
    # Verify all tasks complete successfully
    pass
```

---

## 📚 **Integration Checklist**

### **Pre-Integration Verification**

- [ ] **Environment Setup**
  - [ ] Python 3.8+ installed with required dependencies
  - [ ] Node.js 18+ installed for React frontend
  - [ ] Claude CLI installed and authenticated
  - [ ] PostgreSQL database running (production) or SQLite (development)
  - [ ] Redis instance running (production)

- [ ] **Component Verification**
  - [ ] Python FastAPI server starts successfully on port 4005
  - [ ] React development server starts on port 6011
  - [ ] WebSocket connections establish successfully
  - [ ] Database migrations applied successfully
  - [ ] Claude CLI wrapper can spawn test agents

- [ ] **Network Configuration**
  - [ ] CORS configured for frontend-backend communication
  - [ ] WebSocket upgrade headers configured correctly
  - [ ] Firewall rules allow required ports (4005, 6011, 5432, 6379)
  - [ ] Load balancer configuration (production)

### **Integration Testing**

- [ ] **Component Integration**
  - [ ] Frontend can create agents through API
  - [ ] Real-time WebSocket updates working
  - [ ] Agent processes spawn and respond correctly
  - [ ] Task assignment and completion workflow
  - [ ] Error handling and recovery procedures

- [ ] **Performance Testing**
  - [ ] Multiple concurrent agents (3-5)
  - [ ] Sustained load testing (1 hour+)
  - [ ] Memory usage within limits
  - [ ] Response times under 100ms for UI updates
  - [ ] No memory leaks or hanging processes

- [ ] **Error Scenarios**
  - [ ] Agent process crash handling
  - [ ] Network connectivity issues
  - [ ] Database connection failures
  - [ ] Resource exhaustion scenarios
  - [ ] Graceful shutdown procedures

### **Production Readiness**

- [ ] **Security Configuration**
  - [ ] Authentication and authorization implemented
  - [ ] Sensitive data encrypted in database
  - [ ] API rate limiting configured
  - [ ] Input validation on all endpoints
  - [ ] HTTPS/WSS in production

- [ ] **Monitoring & Logging**
  - [ ] Application logs structured and searchable
  - [ ] Performance metrics collection
  - [ ] Error alerting configured
  - [ ] Health check endpoints implemented
  - [ ] System resource monitoring

- [ ] **Backup & Recovery**
  - [ ] Database backup procedures
  - [ ] Configuration backup
  - [ ] Disaster recovery plan
  - [ ] Data retention policies
  - [ ] Recovery testing completed

---

**This integration guide provides comprehensive instructions for connecting all components of the Visual Agent Management Platform into a cohesive, production-ready system. Follow each section in sequence, verify checkpoints, and customize configurations for your specific deployment environment.**