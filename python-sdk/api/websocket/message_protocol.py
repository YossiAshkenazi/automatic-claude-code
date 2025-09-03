"""
Message protocol definitions for WebSocket communication between
Python agent orchestrator and React dashboard.
"""

from typing import Any, Dict, List, Optional, Union
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
import json
import uuid


class MessageType(Enum):
    """Message types for bi-directional communication"""
    
    # Agent Management
    AGENT_CREATE = "agent:create"
    AGENT_STATUS = "agent:status"
    AGENT_CREATED = "agent:created"
    AGENT_STOPPED = "agent:stopped"
    AGENT_ERROR = "agent:error"
    AGENT_HEARTBEAT = "agent:heartbeat"
    
    # Command Execution
    COMMAND_EXECUTE = "command:execute"
    COMMAND_RESULT = "command:result"
    COMMAND_ERROR = "command:error"
    COMMAND_PROGRESS = "command:progress"
    
    # Task Management
    TASK_ASSIGN = "task:assign"
    TASK_UPDATE = "task:update"
    TASK_COMPLETE = "task:complete"
    TASK_FAILED = "task:failed"
    
    # Inter-agent Communication
    AGENT_MESSAGE = "agent:message"
    AGENT_COORDINATION = "agent:coordination"
    AGENT_HANDOFF = "agent:handoff"
    
    # System Events
    SYSTEM_STATUS = "system:status"
    SYSTEM_ERROR = "system:error"
    SYSTEM_METRIC = "system:metric"
    
    # Connection Management
    CONNECTION_ACK = "connection:ack"
    CONNECTION_PING = "connection:ping"
    CONNECTION_PONG = "connection:pong"
    CONNECTION_ERROR = "connection:error"


class AgentType(Enum):
    """Agent types in the system"""
    MANAGER = "manager"
    WORKER = "worker"
    COORDINATOR = "coordinator"


class TaskStatus(Enum):
    """Task execution statuses"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AgentInfo:
    """Agent information structure"""
    id: str
    type: AgentType
    status: str
    created_at: datetime
    last_activity: datetime
    current_task: Optional[str] = None
    model: str = "sonnet"
    capabilities: List[str] = None
    metrics: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.capabilities is None:
            self.capabilities = []
        if self.metrics is None:
            self.metrics = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with proper datetime serialization"""
        data = asdict(self)
        data['type'] = self.type.value
        data['created_at'] = self.created_at.isoformat()
        data['last_activity'] = self.last_activity.isoformat()
        return data


@dataclass
class TaskInfo:
    """Task information structure"""
    id: str
    title: str
    description: str
    assigned_agent: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: float = 0.0
    result: Optional[Any] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.metadata is None:
            self.metadata = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with proper datetime serialization"""
        data = asdict(self)
        data['status'] = self.status.value
        data['created_at'] = self.created_at.isoformat()
        data['started_at'] = self.started_at.isoformat() if self.started_at else None
        data['completed_at'] = self.completed_at.isoformat() if self.completed_at else None
        return data


@dataclass
class Message:
    """Base message structure for WebSocket communication"""
    id: str
    type: MessageType
    timestamp: datetime
    payload: Dict[str, Any]
    source: Optional[str] = None
    target: Optional[str] = None
    correlation_id: Optional[str] = None
    
    def __post_init__(self):
        if isinstance(self.type, str):
            # Handle deserialization from JSON
            self.type = MessageType(self.type)
    
    @classmethod
    def create(
        cls,
        message_type: MessageType,
        payload: Dict[str, Any],
        source: Optional[str] = None,
        target: Optional[str] = None,
        correlation_id: Optional[str] = None
    ) -> 'Message':
        """Create a new message with generated ID and timestamp"""
        return cls(
            id=str(uuid.uuid4()),
            type=message_type,
            timestamp=datetime.now(),
            payload=payload,
            source=source,
            target=target,
            correlation_id=correlation_id
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'type': self.type.value,
            'timestamp': self.timestamp.isoformat(),
            'payload': self.payload,
            'source': self.source,
            'target': self.target,
            'correlation_id': self.correlation_id
        }
    
    def to_json(self) -> str:
        """Convert message to JSON string"""
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Message':
        """Create message from dictionary"""
        return cls(
            id=data['id'],
            type=MessageType(data['type']),
            timestamp=datetime.fromisoformat(data['timestamp']),
            payload=data['payload'],
            source=data.get('source'),
            target=data.get('target'),
            correlation_id=data.get('correlation_id')
        )
    
    @classmethod
    def from_json(cls, json_str: str) -> 'Message':
        """Create message from JSON string"""
        return cls.from_dict(json.loads(json_str))


class MessageProtocol:
    """Protocol handler for structured message communication"""
    
    @staticmethod
    def create_agent_status_message(
        agent_info: AgentInfo, 
        target: Optional[str] = None
    ) -> Message:
        """Create agent status update message"""
        return Message.create(
            MessageType.AGENT_STATUS,
            {'agent': agent_info.to_dict()},
            source=agent_info.id,
            target=target
        )
    
    @staticmethod
    def create_command_execute_message(
        command: str,
        agent_id: str,
        parameters: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None
    ) -> Message:
        """Create command execution message"""
        payload = {
            'command': command,
            'agent_id': agent_id,
            'parameters': parameters or {}
        }
        return Message.create(
            MessageType.COMMAND_EXECUTE,
            payload,
            target=agent_id,
            correlation_id=correlation_id
        )
    
    @staticmethod
    def create_command_result_message(
        command: str,
        result: Any,
        agent_id: str,
        correlation_id: Optional[str] = None,
        execution_time: Optional[float] = None
    ) -> Message:
        """Create command result message"""
        payload = {
            'command': command,
            'result': result,
            'agent_id': agent_id,
            'execution_time': execution_time
        }
        return Message.create(
            MessageType.COMMAND_RESULT,
            payload,
            source=agent_id,
            correlation_id=correlation_id
        )
    
    @staticmethod
    def create_task_assign_message(
        task_info: TaskInfo,
        agent_id: str,
        correlation_id: Optional[str] = None
    ) -> Message:
        """Create task assignment message"""
        return Message.create(
            MessageType.TASK_ASSIGN,
            {'task': task_info.to_dict()},
            target=agent_id,
            correlation_id=correlation_id
        )
    
    @staticmethod
    def create_task_update_message(
        task_info: TaskInfo,
        correlation_id: Optional[str] = None
    ) -> Message:
        """Create task update message"""
        return Message.create(
            MessageType.TASK_UPDATE,
            {'task': task_info.to_dict()},
            source=task_info.assigned_agent,
            correlation_id=correlation_id
        )
    
    @staticmethod
    def create_agent_message(
        from_agent: str,
        to_agent: str,
        content: str,
        message_type: str = "communication",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Message:
        """Create inter-agent communication message"""
        payload = {
            'from_agent': from_agent,
            'to_agent': to_agent,
            'content': content,
            'message_type': message_type,
            'metadata': metadata or {}
        }
        return Message.create(
            MessageType.AGENT_MESSAGE,
            payload,
            source=from_agent,
            target=to_agent
        )
    
    @staticmethod
    def create_system_metric_message(
        metric_name: str,
        metric_value: Union[int, float, str],
        agent_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Message:
        """Create system metric message"""
        payload = {
            'metric_name': metric_name,
            'metric_value': metric_value,
            'agent_id': agent_id,
            'metadata': metadata or {}
        }
        return Message.create(
            MessageType.SYSTEM_METRIC,
            payload,
            source=agent_id
        )
    
    @staticmethod
    def create_connection_ack_message(client_id: str) -> Message:
        """Create connection acknowledgment message"""
        return Message.create(
            MessageType.CONNECTION_ACK,
            {'client_id': client_id, 'status': 'connected'}
        )
    
    @staticmethod
    def create_ping_message(client_id: str) -> Message:
        """Create ping message for connection health check"""
        return Message.create(
            MessageType.CONNECTION_PING,
            {'client_id': client_id, 'timestamp': datetime.now().isoformat()}
        )
    
    @staticmethod
    def create_pong_message(client_id: str, original_timestamp: str) -> Message:
        """Create pong message in response to ping"""
        return Message.create(
            MessageType.CONNECTION_PONG,
            {
                'client_id': client_id,
                'original_timestamp': original_timestamp,
                'response_timestamp': datetime.now().isoformat()
            }
        )
    
    @staticmethod
    def create_error_message(
        error_type: str,
        error_message: str,
        source: Optional[str] = None,
        correlation_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Message:
        """Create error message"""
        payload = {
            'error_type': error_type,
            'error_message': error_message,
            'metadata': metadata or {}
        }
        
        if error_type in ['agent_error', 'command_error']:
            message_type = MessageType.AGENT_ERROR if error_type == 'agent_error' else MessageType.COMMAND_ERROR
        else:
            message_type = MessageType.SYSTEM_ERROR
            
        return Message.create(
            message_type,
            payload,
            source=source,
            correlation_id=correlation_id
        )
    
    @staticmethod
    def validate_message(message_dict: Dict[str, Any]) -> bool:
        """Validate message structure"""
        required_fields = ['id', 'type', 'timestamp', 'payload']
        
        # Check required fields
        for field in required_fields:
            if field not in message_dict:
                return False
        
        # Validate message type
        try:
            MessageType(message_dict['type'])
        except ValueError:
            return False
        
        # Validate timestamp format
        try:
            datetime.fromisoformat(message_dict['timestamp'])
        except ValueError:
            return False
        
        # Validate payload is dict
        if not isinstance(message_dict['payload'], dict):
            return False
        
        return True