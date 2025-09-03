# Python Agent WebSocket API

Comprehensive WebSocket bridge for bi-directional communication between Python agent orchestrator and React dashboard.

## 🚀 Features

- **Real-time Agent Management**: Create, monitor, and control Claude CLI agents
- **Command Execution**: Execute commands on agents with real-time results
- **Task Assignment**: Assign and track tasks across multiple agents
- **Inter-agent Communication**: Route messages between agents
- **Health Monitoring**: Connection health checks with ping/pong
- **Message Correlation**: Request/response pattern with correlation IDs  
- **Error Handling**: Comprehensive error handling and recovery
- **Low Latency**: <100ms latency for real-time operations
- **Type Safety**: Full TypeScript/Python type definitions

## 🏗️ Architecture

```
React Dashboard ↔ WebSocket Bridge ↔ Python Orchestrator ↔ Claude CLI Agents
     (UI)            (This API)         (Agent Manager)      (Claude Code)
```

### Core Components

1. **WebSocketServer** - Main server handling client connections
2. **ConnectionManager** - Client connection management and health monitoring
3. **AgentManager** - Multi-agent orchestration and task distribution
4. **MessageProtocol** - Type-safe message definitions and validation
5. **WebSocketClient** - Python client for testing and integration

## 📡 Message Protocol

### Message Structure
```json
{
  "id": "uuid",
  "type": "message_type",
  "timestamp": "ISO-8601",
  "payload": {},
  "source": "optional_source",
  "target": "optional_target", 
  "correlation_id": "optional_correlation"
}
```

### Message Types

#### Agent Management
- `agent:create` - Create new agent
- `agent:status` - Agent status update
- `agent:created` - Agent creation notification
- `agent:stopped` - Agent stopped notification
- `agent:error` - Agent error notification

#### Command Execution  
- `command:execute` - Execute command on agent
- `command:result` - Command execution result
- `command:error` - Command execution error
- `command:progress` - Command progress update

#### Task Management
- `task:assign` - Assign task to agent
- `task:update` - Task progress update
- `task:complete` - Task completion
- `task:failed` - Task failure

#### System Events
- `system:status` - System status query/update
- `system:error` - System-level error
- `system:metric` - System metrics

#### Connection Management
- `connection:ack` - Connection acknowledgment
- `connection:ping` - Health check ping
- `connection:pong` - Health check pong

## 🚦 Getting Started

### 1. Start the WebSocket Server

```bash
cd python-sdk
python start_websocket_server.py
```

Server will start on `ws://localhost:8765`

### 2. Connect from React Dashboard

```typescript
import { PythonAgentWebSocketService } from './services/PythonAgentWebSocketService';

const service = new PythonAgentWebSocketService('ws://localhost:8765');
await service.connect();
```

### 3. Create an Agent

```typescript
const agentInfo = await service.createAgent(
  AgentType.WORKER, 
  'sonnet',
  ['coding', 'analysis']
);
```

### 4. Execute Commands

```typescript
const result = await service.executeCommand(
  agentInfo.id,
  'Write a Python hello world function'
);
```

### 5. Assign Tasks

```typescript
const taskInfo = await service.assignTask({
  title: 'Implement Authentication',
  description: 'Create a secure JWT-based auth system',
  metadata: { priority: 'high' }
}, agentInfo.id);
```

## 🎯 Usage Examples

### React Hook Integration

```typescript
import { usePythonAgentWebSocket } from '../hooks/usePythonAgentWebSocket';

function MyComponent() {
  const {
    connectionState,
    agentState, 
    createAgent,
    executeCommand
  } = usePythonAgentWebSocket();

  const handleCreateAgent = async () => {
    await createAgent(AgentType.WORKER, 'sonnet');
  };

  return (
    <div>
      <p>Connected: {connectionState.connected}</p>
      <p>Agents: {Object.keys(agentState.agents).length}</p>
      <button onClick={handleCreateAgent}>Create Agent</button>
    </div>
  );
}
```

### Event Subscriptions

```typescript
// Subscribe to agent status updates
service.on(MessageType.AGENT_STATUS, (message) => {
  console.log('Agent status:', message.payload.agent);
});

// Subscribe to task completions
service.on(MessageType.TASK_COMPLETE, (message) => {
  console.log('Task completed:', message.payload.task);
});
```

### Python Client Usage

```python
from api.websocket.client import WebSocketClient

client = WebSocketClient("ws://localhost:8765")
await client.connect()

# Create agent
agent_info = await client.create_agent("worker", "sonnet", ["coding"])

# Execute command  
result = await client.execute_command(agent_info['id'], "Hello, agent!")
```

## 🧪 Testing

### Run Integration Tests

```bash
cd python-sdk
python test_websocket_integration.py
```

### Test Coverage

- ✅ Connection establishment (<100ms)
- ✅ Message protocol validation
- ✅ Ping/pong health monitoring  
- ✅ Agent creation and management
- ✅ Command execution with correlation
- ✅ Task assignment and tracking
- ✅ Error handling and recovery
- ✅ Concurrent operations
- ✅ Latency requirements (<100ms avg)

### Performance Requirements

- **Connection**: <100ms establishment time
- **Commands**: <100ms average response time  
- **Health Checks**: 30s ping interval, 10s timeout
- **Throughput**: >100 messages/second
- **Concurrent**: >10 simultaneous connections

## 🔧 Configuration

### Server Configuration

```python
server = WebSocketServer(
    host="localhost",
    port=8765,
    ping_interval=30,  # seconds
    ping_timeout=10    # seconds  
)
```

### Client Configuration

```python
client = WebSocketClient(
    uri="ws://localhost:8765",
    auto_reconnect=True,
    reconnect_interval=5,      # seconds
    max_reconnect_attempts=10
)
```

### React Service Configuration

```typescript
const service = new PythonAgentWebSocketService(
  'ws://localhost:8765'
);
```

## 📊 Monitoring & Metrics

### Connection Statistics

```typescript
const stats = service.getStats();
console.log({
  messagesSent: stats.messagesSent,
  messagesReceived: stats.messagesReceived,
  connected: stats.connected,
  uptime: stats.uptime
});
```

### System Status

```typescript
const status = await service.getSystemStatus();
console.log({
  agents: status.agents.total,
  tasks: status.tasks.total,
  running: status.running
});
```

## 🛡️ Error Handling

### Connection Errors
- Automatic reconnection with exponential backoff
- Connection state notifications
- Timeout handling

### Message Errors
- Message validation before processing
- Correlation ID tracking for responses
- Error message standardization

### Agent Errors
- Agent health monitoring
- Command execution timeouts
- Task failure handling

## 🔒 Security Considerations

- WebSocket connections validated on establishment
- Message payload validation
- Rate limiting (configurable)
- No sensitive data in logs
- Graceful error responses

## 🎨 Integration with Existing UI

The WebSocket bridge integrates seamlessly with the existing dual-agent-monitor React application:

1. **Drop-in replacement** for existing WebSocket hooks
2. **Type-safe** message handling
3. **Real-time updates** for dashboard components
4. **Error boundaries** for graceful degradation
5. **Toast notifications** for user feedback

## 🚀 Deployment

### Development
```bash
cd python-sdk
python start_websocket_server.py
```

### Production  
```bash
cd python-sdk
python -m gunicorn api.websocket.server:app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8765
```

### Docker
```dockerfile
FROM python:3.11-slim
COPY python-sdk /app
WORKDIR /app
RUN pip install -r requirements.txt
EXPOSE 8765
CMD ["python", "start_websocket_server.py"]
```

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure <100ms latency requirements are met
5. Test with both Python client and React dashboard

## 📋 API Reference

### Python API

#### WebSocketServer
- `start()` - Start the server
- `stop()` - Stop the server  
- `get_server_info()` - Get server information

#### WebSocketClient  
- `connect()` - Connect to server
- `disconnect()` - Disconnect from server
- `create_agent()` - Create new agent
- `execute_command()` - Execute command on agent
- `assign_task()` - Assign task to agent

#### MessageProtocol
- `create_*_message()` - Message factory methods
- `validate_message()` - Message validation

### TypeScript API

#### PythonAgentWebSocketService
- `connect()` - Connect to Python server
- `createAgent()` - Create agent
- `executeCommand()` - Execute command  
- `assignTask()` - Assign task
- `getSystemStatus()` - Get system status

#### usePythonAgentWebSocket Hook
- Returns connection state, agent state, task state
- Provides action methods
- Handles event subscriptions

## 🔮 Future Enhancements

- **Authentication**: JWT token-based auth
- **Rate Limiting**: Per-client message rate limits
- **Compression**: Message compression for large payloads  
- **Clustering**: Multi-server deployment support
- **Metrics**: Prometheus metrics integration
- **Tracing**: OpenTelemetry distributed tracing