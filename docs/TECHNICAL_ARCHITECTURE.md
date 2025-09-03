# Technical Architecture - Visual Agent Management Platform

## 🏗️ **System Architecture Overview**

### **High-Level Component Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                        │
│                     (React + TypeScript)                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Agent Dashboard │ │ Workflow Canvas │ │ Task Management │    │
│  │ - Agent Status  │ │ - Flow Visual   │ │ - Task Queue    │    │
│  │ - Controls      │ │ - Real-time     │ │ - Assignment    │    │
│  │ - Settings      │ │ - Interactions  │ │ - Results       │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ WebSocket / HTTP API
┌─────────────────────────▼───────────────────────────────────────┐
│                  ORCHESTRATION LAYER                           │
│                    (Python + FastAPI)                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Agent Manager   │ │ Task Processor  │ │ Communication   │    │
│  │ - Lifecycle     │ │ - Distribution  │ │ - Hub           │    │
│  │ - Health Check  │ │ - Scheduling    │ │ - WebSocket     │    │
│  │ - Recovery      │ │ - Dependencies  │ │ - Message Queue │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Process Management
┌─────────────────────────▼───────────────────────────────────────┐
│                      CLI WRAPPER LAYER                         │
│                      (Enhanced Python)                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Multi-Agent     │ │ Process Pool    │ │ Communication   │    │
│  │ CLI Wrapper     │ │ Manager         │ │ Protocol        │    │
│  │ - Agent Spawn   │ │ - Resource Mgmt │ │ - Message Parse │    │
│  │ - Process Mgmt  │ │ - Health Check  │ │ - Error Handle  │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Direct CLI Execution
┌─────────────────────────▼───────────────────────────────────────┐
│                     CLAUDE CODE CLI                            │
│                   (Multiple Instances)                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Manager Agent   │ │ Worker Agent 1  │ │ Worker Agent N  │    │
│  │ Process         │ │ Process         │ │ Process         │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ **Frontend Architecture (React + TypeScript)**

### **Project Structure:**
```
dual-agent-monitor/
├── src/
│   ├── components/
│   │   ├── AgentManagement/
│   │   │   ├── AgentCreator.tsx        # Create new agents
│   │   │   ├── AgentCard.tsx           # Individual agent display
│   │   │   ├── AgentList.tsx           # List all agents
│   │   │   ├── AgentSettings.tsx       # Configure agent behavior
│   │   │   ├── StatusIndicator.tsx     # Real-time status display
│   │   │   └── ResourceMonitor.tsx     # Resource usage per agent
│   │   │
│   │   ├── WorkflowCanvas/
│   │   │   ├── FlowCanvas.tsx          # Main interactive canvas
│   │   │   ├── AgentNode.tsx           # Visual agent representation
│   │   │   ├── TaskFlow.tsx            # Task flow visualization
│   │   │   ├── ConnectionLine.tsx      # Agent communication lines
│   │   │   ├── HandoffAnimation.tsx    # Task handoff effects
│   │   │   └── CanvasControls.tsx      # Zoom, pan, reset controls
│   │   │
│   │   ├── TaskManagement/
│   │   │   ├── TaskCreator.tsx         # Task creation interface
│   │   │   ├── TaskQueue.tsx           # Active task display
│   │   │   ├── TaskCard.tsx            # Individual task component
│   │   │   ├── TaskAssignment.tsx      # Drag-drop assignment
│   │   │   ├── TaskOutput.tsx          # Results preview
│   │   │   └── TaskDependencies.tsx    # Dependency visualization
│   │   │
│   │   ├── Communication/
│   │   │   ├── ChatView.tsx            # Agent conversation display
│   │   │   ├── MessageBubble.tsx       # Individual message styling
│   │   │   ├── MessageFilter.tsx       # Filter and search controls
│   │   │   ├── DecisionHighlight.tsx   # Important decisions
│   │   │   ├── InterventionPanel.tsx   # Human intervention UI
│   │   │   └── ConversationExport.tsx  # Export functionality
│   │   │
│   │   ├── Dashboard/
│   │   │   ├── OverviewPanel.tsx       # System overview
│   │   │   ├── MetricsDisplay.tsx      # Performance metrics
│   │   │   ├── HealthIndicators.tsx    # System health status
│   │   │   ├── AlertPanel.tsx          # System alerts
│   │   │   └── QuickActions.tsx        # Common actions
│   │   │
│   │   └── Common/
│   │       ├── Layout.tsx              # Main application layout
│   │       ├── Navigation.tsx          # Navigation menu
│   │       ├── Loading.tsx             # Loading states
│   │       ├── ErrorBoundary.tsx       # Error handling
│   │       └── Notifications.tsx       # Toast notifications
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts             # WebSocket connection management
│   │   ├── useAgentManager.ts          # Agent operations
│   │   ├── useTaskManager.ts           # Task operations
│   │   ├── useWorkflowState.ts         # Workflow state management
│   │   └── useRealTimeUpdates.ts       # Real-time data updates
│   │
│   ├── services/
│   │   ├── api.ts                      # HTTP API client
│   │   ├── websocket.ts                # WebSocket client
│   │   ├── agentService.ts             # Agent-related API calls
│   │   ├── taskService.ts              # Task-related API calls
│   │   └── workflowService.ts          # Workflow operations
│   │
│   ├── store/
│   │   ├── agentSlice.ts               # Agent state management
│   │   ├── taskSlice.ts                # Task state management
│   │   ├── workflowSlice.ts            # Workflow state management
│   │   ├── uiSlice.ts                  # UI state management
│   │   └── store.ts                    # Redux store configuration
│   │
│   └── types/
│       ├── agent.ts                    # Agent type definitions
│       ├── task.ts                     # Task type definitions
│       ├── workflow.ts                 # Workflow type definitions
│       └── api.ts                      # API response types
```

### **Key Technologies:**
- **React 18** with hooks and concurrent features
- **TypeScript** for type safety
- **Redux Toolkit** for state management
- **React Query** for server state synchronization
- **WebSocket client** for real-time updates
- **TailwindCSS** for styling
- **Framer Motion** for animations
- **React Flow** for workflow visualization

---

## 🐍 **Backend Architecture (Python + FastAPI)**

### **Project Structure:**
```
python-sdk/
├── agent_orchestrator/
│   ├── __init__.py
│   ├── agent_manager.py            # Agent lifecycle management
│   ├── task_processor.py           # Task processing and distribution
│   ├── communication_hub.py        # Inter-agent communication
│   ├── workflow_engine.py          # Workflow execution logic
│   ├── resource_monitor.py         # System resource monitoring
│   └── recovery_manager.py         # Error recovery procedures
│
├── multi_agent_wrapper/
│   ├── __init__.py
│   ├── cli_wrapper.py              # Enhanced CLI wrapper for multiple agents
│   ├── process_manager.py          # Process pool management
│   ├── agent_process.py            # Individual agent process handling
│   ├── communication_protocol.py   # Agent communication protocol
│   └── output_parser.py            # Parse CLI outputs
│
├── api/
│   ├── __init__.py
│   ├── main.py                     # FastAPI application entry point
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── agents.py               # Agent management endpoints
│   │   ├── tasks.py                # Task management endpoints
│   │   ├── workflow.py             # Workflow control endpoints
│   │   └── system.py               # System status and health endpoints
│   │
│   ├── websocket/
│   │   ├── __init__.py
│   │   ├── connection_manager.py   # WebSocket connection handling
│   │   ├── message_router.py       # Route messages to appropriate handlers
│   │   ├── event_broadcaster.py    # Broadcast events to connected clients
│   │   └── handlers.py             # WebSocket message handlers
│   │
│   └── models/
│       ├── __init__.py
│       ├── agent_models.py         # Agent data models
│       ├── task_models.py          # Task data models
│       ├── workflow_models.py      # Workflow data models
│       └── response_models.py      # API response models
│
├── database/
│   ├── __init__.py
│   ├── models.py                   # SQLAlchemy database models
│   ├── connection.py               # Database connection management
│   ├── migrations/                 # Database schema migrations
│   └── repositories/
│       ├── __init__.py
│       ├── agent_repository.py     # Agent data access
│       ├── task_repository.py      # Task data access
│       └── workflow_repository.py  # Workflow data access
│
├── services/
│   ├── __init__.py
│   ├── agent_service.py            # Business logic for agents
│   ├── task_service.py             # Business logic for tasks
│   ├── workflow_service.py         # Business logic for workflows
│   ├── notification_service.py     # User notifications
│   └── analytics_service.py        # Performance analytics
│
└── utils/
    ├── __init__.py
    ├── config.py                   # Configuration management
    ├── logging.py                  # Logging configuration
    ├── exceptions.py               # Custom exception classes
    ├── validators.py               # Input validation utilities
    └── helpers.py                  # Common utility functions
```

### **Key Technologies:**
- **FastAPI** for high-performance async API
- **WebSockets** for real-time communication
- **SQLAlchemy** for database ORM
- **Pydantic** for data validation
- **Asyncio** for concurrent processing
- **Redis** for caching and message queuing
- **PostgreSQL** for persistent storage
- **psutil** for system resource monitoring

---

## 🔧 **Multi-Agent CLI Wrapper Architecture**

### **Enhanced CLI Wrapper Design:**

```python
class MultiAgentCLIWrapper:
    """
    Enhanced wrapper managing multiple Claude CLI processes
    """
    def __init__(self, max_agents: int = 5):
        self.max_agents = max_agents
        self.agent_processes: Dict[str, AgentProcess] = {}
        self.process_pool = ProcessPool(max_agents)
        self.communication_hub = CommunicationHub()
        self.resource_monitor = ResourceMonitor()
    
    async def create_agent(self, 
                          agent_id: str, 
                          role: AgentRole,
                          config: AgentConfig) -> AgentProcess:
        """Create and start a new agent process"""
        
    async def send_task(self, 
                       agent_id: str, 
                       task: Task) -> TaskResult:
        """Send task to specific agent and await result"""
        
    async def broadcast_message(self, 
                               message: Message, 
                               exclude: List[str] = None):
        """Broadcast message to all agents except excluded ones"""
        
    async def terminate_agent(self, agent_id: str):
        """Gracefully terminate agent process"""
```

### **Agent Process Management:**

```python
class AgentProcess:
    """
    Individual agent process wrapper with communication
    """
    def __init__(self, 
                 agent_id: str, 
                 role: AgentRole,
                 config: AgentConfig):
        self.agent_id = agent_id
        self.role = role
        self.config = config
        self.process: Optional[subprocess.Popen] = None
        self.status = ProcessState.IDLE
        self.message_queue = asyncio.Queue()
        self.output_parser = OutputParser()
    
    async def start(self):
        """Start the Claude CLI process for this agent"""
        
    async def send_command(self, command: str) -> str:
        """Send command to agent and get response"""
        
    async def health_check(self) -> bool:
        """Check if agent process is healthy"""
        
    async def terminate(self):
        """Gracefully terminate agent process"""
```

---

## 📡 **Communication Architecture**

### **Message Protocol Design:**

```python
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict, Any
from datetime import datetime

class MessageType(Enum):
    TASK_ASSIGNMENT = "task_assignment"
    TASK_RESULT = "task_result"
    AGENT_STATUS = "agent_status"
    HUMAN_INTERVENTION = "human_intervention"
    SYSTEM_NOTIFICATION = "system_notification"
    HEARTBEAT = "heartbeat"

@dataclass
class Message:
    id: str
    timestamp: datetime
    type: MessageType
    sender: str
    recipient: Optional[str]  # None for broadcast
    content: Dict[str, Any]
    priority: int = 0
    requires_response: bool = False
```

### **Task Handoff Protocol:**

```python
class TaskHandoffProtocol:
    """
    Protocol for Manager → Worker task assignment
    """
    
    async def assign_task(self, 
                         manager_id: str,
                         worker_id: str, 
                         task: Task) -> TaskAssignment:
        """
        1. Manager analyzes and breaks down task
        2. Manager selects appropriate Worker
        3. Manager sends task assignment message
        4. Worker acknowledges receipt
        5. Worker begins execution
        6. Worker sends progress updates
        7. Worker sends final results
        8. Manager processes and integrates results
        """
        
    async def handle_task_failure(self, 
                                 task_assignment: TaskAssignment,
                                 error: Exception):
        """
        Handle task failure with retry and escalation logic
        """
```

---

## 🎨 **UI State Management Architecture**

### **Redux Store Structure:**

```typescript
interface RootState {
  agents: {
    byId: Record<string, Agent>;
    allIds: string[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
  };
  
  tasks: {
    byId: Record<string, Task>;
    allIds: string[];
    queue: string[]; // Task IDs in priority order
    active: string[]; // Currently executing task IDs
    completed: string[]; // Completed task IDs
  };
  
  workflow: {
    state: 'stopped' | 'running' | 'paused' | 'error';
    currentStep: string | null;
    executionHistory: WorkflowStep[];
    canvas: {
      zoom: number;
      position: { x: number; y: number };
      selectedNode: string | null;
    };
  };
  
  communication: {
    messages: Message[];
    activeConversations: Record<string, Message[]>;
    filters: MessageFilter;
  };
  
  ui: {
    activeView: 'dashboard' | 'workflow' | 'tasks' | 'communication';
    sidebarOpen: boolean;
    notifications: Notification[];
    theme: 'light' | 'dark';
  };
}
```

### **Real-Time Updates Integration:**

```typescript
const useRealTimeUpdates = () => {
  const dispatch = useDispatch();
  const { socket } = useWebSocket();
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('agent_status_update', (data: AgentStatusUpdate) => {
      dispatch(updateAgentStatus(data));
    });
    
    socket.on('task_progress', (data: TaskProgress) => {
      dispatch(updateTaskProgress(data));
    });
    
    socket.on('workflow_state_change', (data: WorkflowStateChange) => {
      dispatch(updateWorkflowState(data));
    });
    
    socket.on('new_message', (data: Message) => {
      dispatch(addMessage(data));
    });
    
    return () => {
      socket.off('agent_status_update');
      socket.off('task_progress');
      socket.off('workflow_state_change');
      socket.off('new_message');
    };
  }, [socket, dispatch]);
};
```

---

## 🔄 **Workflow Execution Engine**

### **Workflow State Machine:**

```python
from enum import Enum
from typing import Dict, List, Optional, Callable

class WorkflowState(Enum):
    INITIALIZED = "initialized"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class WorkflowEngine:
    """
    Core workflow execution engine
    """
    
    def __init__(self):
        self.state = WorkflowState.INITIALIZED
        self.current_step: Optional[WorkflowStep] = None
        self.execution_history: List[WorkflowStep] = []
        self.state_handlers: Dict[WorkflowState, Callable] = {
            WorkflowState.RUNNING: self._handle_running,
            WorkflowState.PAUSED: self._handle_paused,
            WorkflowState.FAILED: self._handle_failed,
        }
    
    async def start_workflow(self, workflow: Workflow):
        """Start workflow execution"""
        
    async def pause_workflow(self):
        """Pause current workflow execution"""
        
    async def resume_workflow(self):
        """Resume paused workflow execution"""
        
    async def cancel_workflow(self):
        """Cancel workflow execution"""
        
    async def execute_step(self, step: WorkflowStep) -> StepResult:
        """Execute individual workflow step"""
```

---

## 🛡️ **Error Handling & Recovery**

### **Comprehensive Error Management:**

```python
class ErrorHandler:
    """
    Centralized error handling and recovery system
    """
    
    def __init__(self):
        self.error_classifiers = {
            'agent_crash': AgentCrashHandler(),
            'cli_timeout': CLITimeoutHandler(),
            'communication_failure': CommunicationFailureHandler(),
            'resource_exhaustion': ResourceExhaustionHandler(),
        }
        
    async def handle_error(self, error: Exception, context: ErrorContext):
        """
        Classify error and apply appropriate recovery strategy
        """
        error_type = self.classify_error(error, context)
        handler = self.error_classifiers[error_type]
        
        recovery_result = await handler.recover(error, context)
        
        if recovery_result.success:
            await self.log_recovery(error, recovery_result)
        else:
            await self.escalate_error(error, context, recovery_result)
```

---

## 📊 **Performance & Monitoring**

### **System Metrics Collection:**

```python
class SystemMonitor:
    """
    Comprehensive system and performance monitoring
    """
    
    def __init__(self):
        self.metrics_collector = MetricsCollector()
        self.alert_manager = AlertManager()
        
    async def collect_metrics(self):
        """Collect system performance metrics"""
        return {
            'cpu_usage': psutil.cpu_percent(),
            'memory_usage': psutil.virtual_memory().percent,
            'agent_count': len(self.get_active_agents()),
            'task_throughput': self.calculate_task_throughput(),
            'error_rate': self.calculate_error_rate(),
            'response_times': self.get_average_response_times(),
        }
        
    async def check_health(self) -> HealthStatus:
        """Check overall system health"""
        
    async def generate_alert(self, metric: str, threshold: float):
        """Generate alert when metric exceeds threshold"""
```

---

**This technical architecture provides a comprehensive foundation for building the Visual Agent Management Platform, leveraging existing infrastructure while extending it to support the true vision of intuitive, visual agent coordination and management.**