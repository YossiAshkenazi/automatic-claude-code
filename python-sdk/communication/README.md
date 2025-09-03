# Agent Communication Protocol

Comprehensive communication protocol for Manager-Worker agent coordination in the visual agent management platform.

## Overview

This protocol enables seamless coordination between Manager and Worker agents with real-time messaging, task management, quality validation, and human oversight capabilities.

### Key Features

- **JSON-based Message Format**: Cross-platform compatibility
- **Reliable Message Delivery**: Acknowledgment system with retry logic
- **State Management**: Complex multi-step workflow tracking
- **Quality Gates**: Validation and feedback mechanisms
- **Human Intervention**: Oversight and manual control capabilities
- **WebSocket Integration**: Real-time communication infrastructure

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Manager       │◄──►│   Protocol      │◄──►│   Worker        │
│   Agent         │    │   Engine        │    │   Agent         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Communication Layer                │
└─────────────────────────────────────────────────────────────────┘
         ▲                                               ▲
         │                                               │
         ▼                                               ▼
┌─────────────────┐                           ┌─────────────────┐
│   React UI      │                           │   Human         │
│   Dashboard     │                           │   Operator      │
└─────────────────┘                           └─────────────────┘
```

## Core Components

### 1. Protocol Engine (`protocol.py`)
- Message routing and delivery
- Acknowledgment tracking and retry logic
- Task coordination state management
- Quality validation integration
- Human intervention handling

### 2. Message Router (`message_router.py`)
- Intelligent message routing strategies
- Load balancing and agent availability
- Circuit breaker pattern for failed agents
- Dead letter handling
- Message filtering and transformation

### 3. State Manager (`state_manager.py`)
- Session and task state persistence
- Workflow phase management
- Agent status tracking
- SQLite backend with real-time updates
- State change event notifications

### 4. Quality Framework (`quality_framework.py`)
- Configurable quality gates
- Automated validation with scoring
- Manual review workflows
- Quality metrics tracking
- Human intervention for quality issues

### 5. Serialization (`serialization.py`)
- Robust JSON-based message serialization
- Compression for large messages
- Schema validation and version compatibility
- Error-tolerant deserialization

## Message Types

### Task Management
- `TASK_ASSIGNMENT` - Manager → Worker task delegation
- `TASK_ACCEPTED` - Worker → Manager task acceptance
- `TASK_REJECTED` - Worker → Manager task rejection
- `TASK_PROGRESS` - Worker → Manager progress updates
- `TASK_COMPLETION` - Worker → Manager completion notification
- `TASK_FAILED` - Worker → Manager failure notification

### Coordination
- `COORDINATION_REQUEST` - Agent coordination requests
- `COORDINATION_RESPONSE` - Coordination responses
- `HANDOFF_INITIATE` - Task handoff initiation
- `HANDOFF_COMPLETE` - Task handoff completion

### Quality Control
- `QUALITY_CHECK` - Quality validation requests
- `QUALITY_RESULT` - Validation results
- `VALIDATION_REQUEST` - Manual validation requests
- `VALIDATION_RESPONSE` - Validation responses

### Human Intervention
- `HUMAN_INTERVENTION_REQUESTED` - Request human oversight
- `HUMAN_INTERVENTION_PROVIDED` - Human response/guidance
- `APPROVAL_REQUEST` - Request approval for actions
- `APPROVAL_RESPONSE` - Human approval/rejection

### System Messages
- `HEARTBEAT` - Keep-alive messages
- `STATUS_UPDATE` - Agent status updates
- `ERROR_REPORT` - Error notifications
- `SESSION_EVENT` - Session lifecycle events

## Quick Start

### 1. Basic Protocol Usage

```python
from communication import ProtocolFactory, TaskDefinition, MessagePriority

# Create Manager and Worker protocols
manager_protocol = ProtocolFactory.create_manager_protocol("manager-001")
worker_protocol = ProtocolFactory.create_worker_protocol("worker-001")

# Start protocols
await manager_protocol.start()
await worker_protocol.start()

# Create and assign a task
task = TaskDefinition(
    title="Implement authentication",
    description="Add user authentication system",
    requirements=["password hashing", "session management"],
    priority=MessagePriority.HIGH
)

task_id = await manager_protocol.task_manager.assign_task(task, AgentRole.WORKER)
```

### 2. Frontend Integration

```typescript
import { AgentService, MessageType, TaskStatus } from './services/agentService';

// Create and connect agent service
const agentService = new AgentService('ws://localhost:4005/ws/protocol');
await agentService.connect();

// Listen for task updates
agentService.on('task_updated', (taskId: string, progress: TaskProgress) => {
    console.log(`Task ${taskId}: ${progress.progress_percent}% - ${progress.current_step}`);
});

// Create a task
const taskId = agentService.createTask('session-123', {
    title: 'Build API endpoints',
    description: 'Create REST API for user management',
    priority: MessagePriority.NORMAL
});
```

### 3. Quality Gates

```python
from communication import QualityGateManager, ValidationContext

# Create quality gate manager
quality_manager = QualityGateManager()

# Create validation context
context = ValidationContext(
    task_id="task-001",
    session_id="session-123",
    task_output={
        "files": {"main.py": "def hello(): return 'world'"},
        "success": True
    },
    task_requirements=["create hello function"]
)

# Run validation
result = await quality_manager.validate_task_output(context, "comprehensive_quality")
print(f"Quality check: {'PASSED' if result.passed else 'FAILED'} (score: {result.score:.2f})")
```

### 4. Human Intervention

```python
from communication import HumanInterventionController

# Create intervention controller
intervention_controller = HumanInterventionController(protocol_engine)

# Request human intervention
intervention_id = await intervention_controller.request_quality_intervention(
    task_id="task-001",
    validation_result=quality_result,
    urgency="normal"
)

# Handle intervention response
await intervention_controller.handle_human_intervention(
    intervention_id,
    response={
        "guidance": "Please add more error handling to the implementation",
        "action_taken": "provide_guidance"
    }
)
```

## Message Format

```json
{
    "id": "msg_1234567890_abc123",
    "type": "task_assignment",
    "sender": "manager",
    "recipient": "worker",
    "content": {
        "task": {
            "id": "task-001",
            "title": "Implement feature X",
            "description": "Create new feature with tests",
            "requirements": ["functionality", "tests", "docs"],
            "priority": 3,
            "estimated_duration": 60
        }
    },
    "priority": 3,
    "metadata": {
        "correlation_id": "corr_abc123",
        "session_id": "session-123",
        "task_id": "task-001",
        "requires_ack": true,
        "timeout_seconds": 300
    },
    "timestamp": 1234567890.123
}
```

## State Management

### Session State
- Session lifecycle tracking
- Agent assignments and status
- Task counts and progress
- Workflow phase management
- Performance metrics

### Task State
- Task definition and progress
- Agent assignment tracking
- Quality validation results
- Human intervention history
- Dependency management

### Agent State
- Agent availability and health
- Current task assignments
- Performance metrics
- Capability tracking
- Resource usage

## Quality Gates

### Built-in Validators
- **SyntaxValidator**: Code syntax validation
- **RequirementsValidator**: Requirement fulfillment checking
- **DocumentationValidator**: Documentation quality assessment

### Custom Quality Gates
```python
from communication import QualityGateConfig, ValidationType

custom_gate = QualityGateConfig(
    gate_id="security_review",
    name="Security Review Gate",
    description="Security-focused validation",
    validation_type=ValidationType.MANUAL,
    threshold_score=0.9,
    criteria_weights={
        QualityCriterion.SECURITY: 1.0,
        QualityCriterion.BEST_PRACTICES: 0.8
    }
)

quality_manager.register_quality_gate(custom_gate)
```

## Testing

### Run Unit Tests
```bash
cd python-sdk/communication
python -m pytest tests/test_protocol.py -v
```

### Run Integration Demo
```bash
cd python-sdk/communication
python integration_demo.py
```

### Protocol Validation
```python
from communication.tests.test_protocol import ProtocolValidator

# Validate message format
report = ProtocolValidator.validate_message_format(message_dict)
print(f"Valid: {report['valid']}, Errors: {report['errors']}")

# Validate protocol flow
flow_report = ProtocolValidator.validate_protocol_flow(message_list)
print(f"Flow analysis: {flow_report['flow_analysis']}")
```

## Performance Considerations

### Message Throughput
- Target: >1000 messages/second for serialization
- Compression for messages >1KB
- Batch processing for multiple messages

### Memory Usage
- In-memory state caching with persistence
- Automatic cleanup of expired sessions
- Configurable retention policies

### Network Efficiency
- JSON compression for large payloads
- Message batching capabilities
- Connection pooling and reuse

## Error Handling

### Automatic Recovery
- Exponential backoff retry logic
- Circuit breaker pattern for failed agents
- Dead letter queue for undeliverable messages
- Connection failover and reconnection

### Error Types
- **Transient Errors**: Network issues, temporary unavailability
- **Permanent Errors**: Authentication failures, invalid messages
- **System Errors**: Resource exhaustion, configuration issues

## Configuration

### Protocol Engine Configuration
```python
from communication import ClaudeCliOptions, CircuitBreakerConfig

options = ClaudeCliOptions(
    model="sonnet",
    timeout=300,
    enable_circuit_breaker=True,
    circuit_breaker_config=CircuitBreakerConfig(
        failure_threshold=5,
        recovery_timeout=60.0
    )
)
```

### Quality Gate Configuration
```python
quality_config = QualityGateConfig(
    gate_id="production_ready",
    threshold_score=0.85,
    validation_type=ValidationType.HYBRID,
    criteria_weights={
        QualityCriterion.FUNCTIONALITY: 1.0,
        QualityCriterion.QUALITY: 0.9,
        QualityCriterion.SECURITY: 0.8,
        QualityCriterion.DOCUMENTATION: 0.6
    }
)
```

## Security Considerations

### Message Security
- Input validation and sanitization
- Content filtering for sensitive data
- Secure credential handling
- Audit logging of all interactions

### Agent Authentication
- Agent identity verification
- Session-based authentication
- Permission-based access control
- Secure token management

## Monitoring and Observability

### Metrics
- Message throughput and latency
- Task completion rates
- Quality gate success rates
- Human intervention frequency
- Agent performance statistics

### Logging
- Structured JSON logging
- Correlation ID tracking
- Error classification and trending
- Performance profiling data

## Troubleshooting

### Common Issues

#### Messages Not Delivered
1. Check agent availability and connection status
2. Verify message routing configuration
3. Check circuit breaker state
4. Review dead letter queue

#### Quality Validation Failures
1. Verify quality gate configuration
2. Check validator implementations
3. Review validation context data
4. Check threshold settings

#### State Synchronization Issues
1. Check database connectivity
2. Verify state manager configuration
3. Review concurrent operation handling
4. Check for state corruption

### Debug Tools
```python
# Enable debug logging
import logging
logging.getLogger('communication').setLevel(logging.DEBUG)

# Check protocol engine stats
stats = protocol_engine.get_resource_stats()
print(f"Protocol stats: {stats}")

# Monitor message router metrics
metrics = message_router.get_routing_metrics()
print(f"Routing metrics: {metrics}")

# View state manager statistics
state_stats = state_manager.get_state_statistics()
print(f"State statistics: {state_stats}")
```

## Contributing

### Development Setup
1. Install dependencies: `pip install -r requirements.txt`
2. Run tests: `python -m pytest tests/`
3. Run integration demo: `python integration_demo.py`

### Adding Custom Validators
```python
from communication import QualityValidator, QualityCriterion, QualityScore

class CustomValidator(QualityValidator):
    def __init__(self):
        super().__init__("CustomValidator", "Custom validation logic")
        self.supported_criteria = [QualityCriterion.CUSTOM_CRITERION]
    
    async def validate(self, context, criteria):
        # Custom validation logic
        return [QualityScore(
            criterion=QualityCriterion.CUSTOM_CRITERION,
            score=0.8,
            feedback=["Custom validation passed"]
        )]
```

### Adding Message Types
```python
# Add to MessageType enum
class MessageType(Enum):
    # ... existing types
    CUSTOM_MESSAGE = "custom_message"

# Register handler
protocol_engine.register_handler(MessageType.CUSTOM_MESSAGE, custom_handler)
```

## License

This protocol implementation is part of the Visual Agent Management Platform project.

## Support

For issues, questions, or contributions:
1. Check the troubleshooting guide above
2. Review the integration demo for examples
3. Run the test suite to validate functionality
4. Consult the API documentation for detailed usage