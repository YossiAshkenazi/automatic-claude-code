#!/usr/bin/env python3
"""
Comprehensive Communication Protocol for Manager-Worker Agent Coordination
=====================================================================

This module defines the core communication protocol that enables seamless
coordination between Manager and Worker agents in the visual agent management platform.

Key Features:
- JSON-based message format for cross-platform compatibility
- Reliable message delivery and acknowledgment system
- State management for complex multi-step workflows
- Integration with existing WebSocket infrastructure
- Quality validation and feedback mechanisms
- Human oversight and intervention capabilities

Protocol Architecture:
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
"""

import asyncio
import json
import time
import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, field, asdict
from contextlib import asynccontextmanager
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# Core Protocol Types and Enums
# ============================================================================

class MessageType(Enum):
    """Core message types for agent communication"""
    # Task Management Messages
    TASK_ASSIGNMENT = "task_assignment"          # Manager → Worker
    TASK_ACCEPTED = "task_accepted"              # Worker → Manager  
    TASK_REJECTED = "task_rejected"              # Worker → Manager
    TASK_PROGRESS = "task_progress"              # Worker → Manager
    TASK_COMPLETION = "task_completion"          # Worker → Manager
    TASK_FAILED = "task_failed"                  # Worker → Manager
    
    # Coordination Messages
    COORDINATION_REQUEST = "coordination_request"  # Any → Any
    COORDINATION_RESPONSE = "coordination_response" # Any → Any
    HANDOFF_INITIATE = "handoff_initiate"         # Manager → Worker
    HANDOFF_COMPLETE = "handoff_complete"         # Worker → Manager
    
    # Quality Control Messages
    QUALITY_CHECK = "quality_check"              # Manager → Worker
    QUALITY_RESULT = "quality_result"            # Worker → Manager
    VALIDATION_REQUEST = "validation_request"    # Any → Manager
    VALIDATION_RESPONSE = "validation_response"  # Manager → Any
    
    # Human Intervention Messages
    HUMAN_INTERVENTION_REQUESTED = "human_intervention_requested"  # Any → UI
    HUMAN_INTERVENTION_PROVIDED = "human_intervention_provided"    # UI → Any
    APPROVAL_REQUEST = "approval_request"        # Any → UI
    APPROVAL_RESPONSE = "approval_response"      # UI → Any
    
    # System Messages
    HEARTBEAT = "heartbeat"                      # Any → Any
    STATUS_UPDATE = "status_update"              # Any → Any
    ERROR_REPORT = "error_report"                # Any → Any
    SESSION_EVENT = "session_event"              # System → All
    
    # Protocol Messages
    ACK = "ack"                                  # Acknowledgment
    NACK = "nack"                                # Negative Acknowledgment
    PING = "ping"                                # Connection test
    PONG = "pong"                                # Ping response

class AgentRole(Enum):
    """Agent roles in the system"""
    MANAGER = "manager"
    WORKER = "worker"
    HUMAN = "human"
    SYSTEM = "system"

class MessagePriority(Enum):
    """Message priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4
    CRITICAL = 5

class TaskStatus(Enum):
    """Task execution status"""
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    WAITING_REVIEW = "waiting_review"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REQUIRES_HUMAN = "requires_human"

class CoordinationPhase(Enum):
    """Workflow coordination phases"""
    PLANNING = "planning"
    ASSIGNMENT = "assignment"
    EXECUTION = "execution"
    VALIDATION = "validation"
    COMPLETION = "completion"
    ERROR_HANDLING = "error_handling"

# ============================================================================
# Core Data Structures
# ============================================================================

@dataclass
class MessageMetadata:
    """Metadata for protocol messages"""
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    reply_to: Optional[str] = None
    session_id: Optional[str] = None
    task_id: Optional[str] = None
    sequence_number: int = 0
    retry_count: int = 0
    timeout_seconds: Optional[int] = None
    requires_ack: bool = True
    created_at: float = field(default_factory=time.time)
    expires_at: Optional[float] = None

@dataclass  
class ProtocolMessage:
    """Core protocol message structure"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: MessageType = MessageType.STATUS_UPDATE
    sender: AgentRole = AgentRole.SYSTEM
    recipient: AgentRole = AgentRole.SYSTEM  
    content: Dict[str, Any] = field(default_factory=dict)
    priority: MessagePriority = MessagePriority.NORMAL
    metadata: MessageMetadata = field(default_factory=MessageMetadata)
    timestamp: float = field(default_factory=time.time)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'type': self.type.value,
            'sender': self.sender.value,
            'recipient': self.recipient.value,
            'content': self.content,
            'priority': self.priority.value,
            'metadata': asdict(self.metadata),
            'timestamp': self.timestamp
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProtocolMessage':
        """Create message from dictionary"""
        metadata_data = data.get('metadata', {})
        metadata = MessageMetadata(**metadata_data)
        
        return cls(
            id=data['id'],
            type=MessageType(data['type']),
            sender=AgentRole(data['sender']),
            recipient=AgentRole(data['recipient']),
            content=data['content'],
            priority=MessagePriority(data['priority']),
            metadata=metadata,
            timestamp=data['timestamp']
        )

@dataclass
class TaskDefinition:
    """Task definition for agent assignment"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    description: str = ""
    requirements: List[str] = field(default_factory=list)
    estimated_duration: Optional[int] = None  # minutes
    priority: MessagePriority = MessagePriority.NORMAL
    dependencies: List[str] = field(default_factory=list)  # task IDs
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class TaskProgress:
    """Task progress information"""
    task_id: str
    status: TaskStatus
    progress_percent: float = 0.0
    current_step: str = ""
    completed_steps: List[str] = field(default_factory=list)
    remaining_steps: List[str] = field(default_factory=list)
    outputs: List[str] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)
    estimated_completion: Optional[float] = None

@dataclass
class QualityGate:
    """Quality gate definition for validation"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    criteria: List[Dict[str, Any]] = field(default_factory=list)
    threshold_score: float = 0.8
    required: bool = True
    auto_validate: bool = False

@dataclass
class ValidationResult:
    """Result of quality validation"""
    gate_id: str
    task_id: str
    passed: bool
    score: float
    feedback: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    timestamp: float = field(default_factory=time.time)

# ============================================================================
# Protocol Engine
# ============================================================================

class ProtocolEngine:
    """
    Core protocol engine for managing agent communication.
    
    Features:
    - Message routing and delivery
    - Acknowledgment tracking
    - Retry logic with exponential backoff
    - Message queuing and prioritization
    - Correlation tracking for request/response pairs
    - Session and task state management
    """
    
    def __init__(self, agent_role: AgentRole, agent_id: str):
        self.agent_role = agent_role
        self.agent_id = agent_id
        self.message_handlers: Dict[MessageType, Callable] = {}
        self.pending_acks: Dict[str, ProtocolMessage] = {}
        self.message_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.running = False
        self.session_state: Dict[str, Any] = {}
        self.task_states: Dict[str, TaskProgress] = {}
        self.quality_gates: Dict[str, QualityGate] = {}
        
        # WebSocket connection (to be injected)
        self.websocket = None
        
        # Metrics
        self.metrics = {
            'messages_sent': 0,
            'messages_received': 0,
            'acks_received': 0,
            'timeouts': 0,
            'retries': 0
        }
        
        logger.info(f"Protocol engine initialized for {agent_role.value} agent: {agent_id}")
    
    def register_handler(self, message_type: MessageType, handler: Callable):
        """Register message handler for specific message type"""
        self.message_handlers[message_type] = handler
        logger.debug(f"Registered handler for {message_type.value}")
    
    def set_websocket(self, websocket):
        """Inject WebSocket connection"""
        self.websocket = websocket
    
    async def start(self):
        """Start the protocol engine"""
        self.running = True
        logger.info(f"Protocol engine started for {self.agent_role.value}")
        
        # Start message processing loop
        asyncio.create_task(self._process_message_queue())
        asyncio.create_task(self._ack_timeout_monitor())
    
    async def stop(self):
        """Stop the protocol engine"""
        self.running = False
        logger.info(f"Protocol engine stopped for {self.agent_role.value}")
    
    async def send_message(self, message: ProtocolMessage) -> bool:
        """
        Send a protocol message with delivery confirmation.
        
        Returns:
            bool: True if message was sent successfully
        """
        try:
            # Set sender if not already set
            if message.sender == AgentRole.SYSTEM:
                message.sender = self.agent_role
            
            # Add to pending acks if acknowledgment required
            if message.metadata.requires_ack:
                self.pending_acks[message.id] = message
            
            # Serialize and send via WebSocket
            if self.websocket:
                message_data = message.to_dict()
                await self.websocket.send(json.dumps(message_data))
                self.metrics['messages_sent'] += 1
                
                logger.debug(f"Sent {message.type.value} message to {message.recipient.value}")
                return True
            else:
                logger.error("No WebSocket connection available")
                return False
                
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return False
    
    async def receive_message(self, raw_message: str):
        """
        Receive and process incoming protocol message.
        
        Args:
            raw_message: JSON string containing the message
        """
        try:
            message_data = json.loads(raw_message)
            message = ProtocolMessage.from_dict(message_data)
            
            self.metrics['messages_received'] += 1
            
            # Handle acknowledgments
            if message.type == MessageType.ACK:
                await self._handle_ack(message)
                return
            
            # Send acknowledgment if required
            if message.metadata.requires_ack:
                ack_message = ProtocolMessage(
                    type=MessageType.ACK,
                    sender=self.agent_role,
                    recipient=message.sender,
                    content={'original_message_id': message.id},
                    metadata=MessageMetadata(
                        correlation_id=message.metadata.correlation_id,
                        requires_ack=False
                    )
                )
                await self.send_message(ack_message)
            
            # Process message
            await self._process_message(message)
            
        except Exception as e:
            logger.error(f"Error processing received message: {e}")
    
    async def _process_message(self, message: ProtocolMessage):
        """Process received message based on type"""
        handler = self.message_handlers.get(message.type)
        if handler:
            try:
                await handler(message)
            except Exception as e:
                logger.error(f"Error in message handler for {message.type.value}: {e}")
                
                # Send error response
                error_message = ProtocolMessage(
                    type=MessageType.ERROR_REPORT,
                    sender=self.agent_role,
                    recipient=message.sender,
                    content={
                        'error': str(e),
                        'original_message_id': message.id
                    },
                    metadata=MessageMetadata(
                        correlation_id=message.metadata.correlation_id,
                        requires_ack=False
                    )
                )
                await self.send_message(error_message)
        else:
            logger.warning(f"No handler registered for message type: {message.type.value}")
    
    async def _handle_ack(self, ack_message: ProtocolMessage):
        """Handle acknowledgment message"""
        original_id = ack_message.content.get('original_message_id')
        if original_id in self.pending_acks:
            del self.pending_acks[original_id]
            self.metrics['acks_received'] += 1
            logger.debug(f"Received ACK for message {original_id}")
    
    async def _process_message_queue(self):
        """Process outgoing message queue with priority"""
        while self.running:
            try:
                # Get message from priority queue (lower number = higher priority)
                priority, message = await asyncio.wait_for(
                    self.message_queue.get(), timeout=1.0
                )
                await self.send_message(message)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing message queue: {e}")
    
    async def _ack_timeout_monitor(self):
        """Monitor pending acknowledgments for timeouts"""
        while self.running:
            try:
                current_time = time.time()
                timeout_messages = []
                
                for msg_id, message in self.pending_acks.items():
                    timeout = message.metadata.timeout_seconds or 30
                    if current_time - message.timestamp > timeout:
                        timeout_messages.append(msg_id)
                
                # Handle timeouts
                for msg_id in timeout_messages:
                    message = self.pending_acks[msg_id]
                    del self.pending_acks[msg_id]
                    
                    self.metrics['timeouts'] += 1
                    logger.warning(f"Message {msg_id} timed out")
                    
                    # Retry if retry count not exceeded
                    if message.metadata.retry_count < 3:
                        message.metadata.retry_count += 1
                        self.metrics['retries'] += 1
                        await self.send_message(message)
                        logger.info(f"Retrying message {msg_id} (attempt {message.metadata.retry_count})")
                
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                logger.error(f"Error in ACK timeout monitor: {e}")

# ============================================================================
# Task Management Protocol
# ============================================================================

class TaskManager:
    """Manages task assignment and coordination between agents"""
    
    def __init__(self, protocol_engine: ProtocolEngine):
        self.protocol = protocol_engine
        self.active_tasks: Dict[str, TaskProgress] = {}
        self.task_queue: List[TaskDefinition] = []
        self.quality_gates: Dict[str, QualityGate] = {}
        
        # Register handlers
        self._register_handlers()
    
    def _register_handlers(self):
        """Register task-related message handlers"""
        handlers = {
            MessageType.TASK_ASSIGNMENT: self._handle_task_assignment,
            MessageType.TASK_ACCEPTED: self._handle_task_accepted,
            MessageType.TASK_REJECTED: self._handle_task_rejected,
            MessageType.TASK_PROGRESS: self._handle_task_progress,
            MessageType.TASK_COMPLETION: self._handle_task_completion,
            MessageType.TASK_FAILED: self._handle_task_failed,
        }
        
        for msg_type, handler in handlers.items():
            self.protocol.register_handler(msg_type, handler)
    
    async def assign_task(self, task: TaskDefinition, worker_agent: AgentRole) -> str:
        """Assign task to worker agent"""
        message = ProtocolMessage(
            type=MessageType.TASK_ASSIGNMENT,
            sender=self.protocol.agent_role,
            recipient=worker_agent,
            content={
                'task': asdict(task),
                'assignment_time': time.time()
            },
            metadata=MessageMetadata(
                task_id=task.id,
                session_id=self.protocol.session_state.get('current_session')
            )
        )
        
        await self.protocol.send_message(message)
        
        # Track task progress
        self.active_tasks[task.id] = TaskProgress(
            task_id=task.id,
            status=TaskStatus.ASSIGNED
        )
        
        logger.info(f"Assigned task {task.id} to {worker_agent.value}")
        return task.id
    
    async def _handle_task_assignment(self, message: ProtocolMessage):
        """Handle incoming task assignment"""
        task_data = message.content['task']
        task = TaskDefinition(**task_data)
        
        # Determine if we can accept the task
        can_accept = await self._evaluate_task_acceptance(task)
        
        response_type = MessageType.TASK_ACCEPTED if can_accept else MessageType.TASK_REJECTED
        response = ProtocolMessage(
            type=response_type,
            sender=self.protocol.agent_role,
            recipient=message.sender,
            content={
                'task_id': task.id,
                'reason': 'Task accepted' if can_accept else 'Resource constraints'
            },
            metadata=MessageMetadata(
                correlation_id=message.metadata.correlation_id,
                task_id=task.id
            )
        )
        
        await self.protocol.send_message(response)
        
        if can_accept:
            # Start task execution
            self.active_tasks[task.id] = TaskProgress(
                task_id=task.id,
                status=TaskStatus.IN_PROGRESS
            )
            await self._start_task_execution(task)
    
    async def _evaluate_task_acceptance(self, task: TaskDefinition) -> bool:
        """Evaluate whether to accept a task assignment"""
        # Check current capacity
        active_count = len([t for t in self.active_tasks.values() 
                           if t.status in [TaskStatus.IN_PROGRESS, TaskStatus.ASSIGNED]])
        
        # Simple capacity check - can be enhanced with more sophisticated logic
        max_concurrent_tasks = 3
        return active_count < max_concurrent_tasks
    
    async def _start_task_execution(self, task: TaskDefinition):
        """Start executing an assigned task"""
        logger.info(f"Starting execution of task {task.id}: {task.title}")
        
        # This would integrate with the actual task execution system
        # For now, simulate progress updates
        asyncio.create_task(self._simulate_task_execution(task))
    
    async def _simulate_task_execution(self, task: TaskDefinition):
        """Simulate task execution with progress updates"""
        task_progress = self.active_tasks[task.id]
        
        # Simulate work with progress updates
        steps = ["Analyzing requirements", "Implementing solution", "Testing", "Validating"]
        
        for i, step in enumerate(steps):
            task_progress.current_step = step
            task_progress.progress_percent = (i + 1) / len(steps) * 100
            task_progress.completed_steps.append(step)
            
            # Send progress update
            progress_message = ProtocolMessage(
                type=MessageType.TASK_PROGRESS,
                sender=self.protocol.agent_role,
                recipient=AgentRole.MANAGER,
                content={
                    'task_id': task.id,
                    'progress': asdict(task_progress)
                },
                metadata=MessageMetadata(task_id=task.id)
            )
            
            await self.protocol.send_message(progress_message)
            
            # Simulate work time
            await asyncio.sleep(2)
        
        # Task completed
        task_progress.status = TaskStatus.COMPLETED
        completion_message = ProtocolMessage(
            type=MessageType.TASK_COMPLETION,
            sender=self.protocol.agent_role,
            recipient=AgentRole.MANAGER,
            content={
                'task_id': task.id,
                'result': {
                    'success': True,
                    'output': f"Task {task.title} completed successfully",
                    'metrics': {
                        'execution_time': 8,  # seconds
                        'steps_completed': len(steps)
                    }
                }
            },
            metadata=MessageMetadata(task_id=task.id)
        )
        
        await self.protocol.send_message(completion_message)
    
    async def _handle_task_accepted(self, message: ProtocolMessage):
        """Handle task acceptance from worker"""
        task_id = message.content['task_id']
        logger.info(f"Task {task_id} accepted by {message.sender.value}")
    
    async def _handle_task_rejected(self, message: ProtocolMessage):
        """Handle task rejection from worker"""
        task_id = message.content['task_id']
        reason = message.content.get('reason', 'No reason provided')
        logger.warning(f"Task {task_id} rejected by {message.sender.value}: {reason}")
    
    async def _handle_task_progress(self, message: ProtocolMessage):
        """Handle task progress updates"""
        progress_data = message.content['progress']
        task_id = progress_data['task_id']
        
        logger.info(f"Task {task_id} progress: {progress_data['progress_percent']:.1f}% - {progress_data['current_step']}")
    
    async def _handle_task_completion(self, message: ProtocolMessage):
        """Handle task completion"""
        task_id = message.content['task_id']
        result = message.content['result']
        
        if task_id in self.active_tasks:
            self.active_tasks[task_id].status = TaskStatus.COMPLETED
        
        logger.info(f"Task {task_id} completed: {result['output']}")
    
    async def _handle_task_failed(self, message: ProtocolMessage):
        """Handle task failure"""
        task_id = message.content['task_id']
        error = message.content.get('error', 'Unknown error')
        
        if task_id in self.active_tasks:
            self.active_tasks[task_id].status = TaskStatus.FAILED
        
        logger.error(f"Task {task_id} failed: {error}")

# ============================================================================
# Quality Gate System
# ============================================================================

class QualityGateManager:
    """Manages quality gates and validation processes"""
    
    def __init__(self, protocol_engine: ProtocolEngine):
        self.protocol = protocol_engine
        self.gates: Dict[str, QualityGate] = {}
        self.validation_results: Dict[str, ValidationResult] = {}
        
        self._register_handlers()
        self._setup_default_gates()
    
    def _register_handlers(self):
        """Register quality gate message handlers"""
        handlers = {
            MessageType.QUALITY_CHECK: self._handle_quality_check,
            MessageType.QUALITY_RESULT: self._handle_quality_result,
            MessageType.VALIDATION_REQUEST: self._handle_validation_request,
            MessageType.VALIDATION_RESPONSE: self._handle_validation_response,
        }
        
        for msg_type, handler in handlers.items():
            self.protocol.register_handler(msg_type, handler)
    
    def _setup_default_gates(self):
        """Setup default quality gates"""
        default_gates = [
            QualityGate(
                id="code_quality",
                name="Code Quality Check",
                description="Validates code quality metrics",
                criteria=[
                    {"name": "syntax_valid", "weight": 0.4, "required": True},
                    {"name": "best_practices", "weight": 0.3, "required": False},
                    {"name": "documentation", "weight": 0.3, "required": False}
                ],
                threshold_score=0.7
            ),
            QualityGate(
                id="functionality",
                name="Functionality Validation",
                description="Validates that implementation meets requirements",
                criteria=[
                    {"name": "requirements_met", "weight": 0.5, "required": True},
                    {"name": "edge_cases", "weight": 0.3, "required": False},
                    {"name": "performance", "weight": 0.2, "required": False}
                ],
                threshold_score=0.8
            )
        ]
        
        for gate in default_gates:
            self.gates[gate.id] = gate
    
    async def validate_task_output(self, task_id: str, output: Dict[str, Any]) -> ValidationResult:
        """Validate task output through quality gates"""
        # For demonstration, we'll use a simple validation
        # In practice, this would involve more sophisticated analysis
        
        overall_score = 0.0
        feedback = []
        
        # Simple validation logic
        if output.get('success', False):
            overall_score += 0.5
            feedback.append("Task completed successfully")
        
        if output.get('output'):
            overall_score += 0.3
            feedback.append("Output provided")
        
        if output.get('metrics'):
            overall_score += 0.2
            feedback.append("Metrics available")
        
        result = ValidationResult(
            gate_id="default",
            task_id=task_id,
            passed=overall_score >= 0.7,
            score=overall_score,
            feedback=feedback
        )
        
        self.validation_results[f"{task_id}_default"] = result
        return result
    
    async def _handle_quality_check(self, message: ProtocolMessage):
        """Handle quality check request"""
        task_id = message.content['task_id']
        gate_id = message.content.get('gate_id', 'default')
        output = message.content.get('output', {})
        
        result = await self.validate_task_output(task_id, output)
        
        response = ProtocolMessage(
            type=MessageType.QUALITY_RESULT,
            sender=self.protocol.agent_role,
            recipient=message.sender,
            content={
                'task_id': task_id,
                'validation_result': asdict(result)
            },
            metadata=MessageMetadata(
                correlation_id=message.metadata.correlation_id,
                task_id=task_id
            )
        )
        
        await self.protocol.send_message(response)
    
    async def _handle_quality_result(self, message: ProtocolMessage):
        """Handle quality validation results"""
        result_data = message.content['validation_result']
        result = ValidationResult(**result_data)
        
        logger.info(f"Quality check for task {result.task_id}: {'PASSED' if result.passed else 'FAILED'} (score: {result.score:.2f})")
        
        for feedback in result.feedback:
            logger.info(f"  - {feedback}")
    
    async def _handle_validation_request(self, message: ProtocolMessage):
        """Handle validation requests"""
        # Implementation would depend on specific validation requirements
        pass
    
    async def _handle_validation_response(self, message: ProtocolMessage):
        """Handle validation responses"""
        # Implementation would depend on specific validation requirements
        pass

# ============================================================================
# Human Intervention System
# ============================================================================

class HumanInterventionManager:
    """Manages human oversight and intervention in agent workflows"""
    
    def __init__(self, protocol_engine: ProtocolEngine):
        self.protocol = protocol_engine
        self.pending_interventions: Dict[str, Dict[str, Any]] = {}
        self.pending_approvals: Dict[str, Dict[str, Any]] = {}
        
        self._register_handlers()
    
    def _register_handlers(self):
        """Register human intervention message handlers"""
        handlers = {
            MessageType.HUMAN_INTERVENTION_REQUESTED: self._handle_intervention_request,
            MessageType.HUMAN_INTERVENTION_PROVIDED: self._handle_intervention_provided,
            MessageType.APPROVAL_REQUEST: self._handle_approval_request,
            MessageType.APPROVAL_RESPONSE: self._handle_approval_response,
        }
        
        for msg_type, handler in handlers.items():
            self.protocol.register_handler(msg_type, handler)
    
    async def request_human_intervention(self, 
                                       task_id: str, 
                                       reason: str, 
                                       context: Dict[str, Any],
                                       timeout_seconds: int = 300) -> Dict[str, Any]:
        """Request human intervention for a specific situation"""
        intervention_id = str(uuid.uuid4())
        
        message = ProtocolMessage(
            type=MessageType.HUMAN_INTERVENTION_REQUESTED,
            sender=self.protocol.agent_role,
            recipient=AgentRole.HUMAN,
            content={
                'intervention_id': intervention_id,
                'task_id': task_id,
                'reason': reason,
                'context': context,
                'requested_by': self.protocol.agent_id,
                'urgency': 'normal'
            },
            metadata=MessageMetadata(
                task_id=task_id,
                timeout_seconds=timeout_seconds
            )
        )
        
        await self.protocol.send_message(message)
        
        # Track pending intervention
        self.pending_interventions[intervention_id] = {
            'task_id': task_id,
            'reason': reason,
            'context': context,
            'requested_at': time.time(),
            'timeout': timeout_seconds
        }
        
        logger.info(f"Requested human intervention for task {task_id}: {reason}")
        return {'intervention_id': intervention_id}
    
    async def request_approval(self, 
                             task_id: str,
                             action: str,
                             details: Dict[str, Any],
                             timeout_seconds: int = 180) -> Dict[str, Any]:
        """Request human approval for a specific action"""
        approval_id = str(uuid.uuid4())
        
        message = ProtocolMessage(
            type=MessageType.APPROVAL_REQUEST,
            sender=self.protocol.agent_role,
            recipient=AgentRole.HUMAN,
            content={
                'approval_id': approval_id,
                'task_id': task_id,
                'action': action,
                'details': details,
                'requested_by': self.protocol.agent_id
            },
            metadata=MessageMetadata(
                task_id=task_id,
                timeout_seconds=timeout_seconds
            )
        )
        
        await self.protocol.send_message(message)
        
        # Track pending approval
        self.pending_approvals[approval_id] = {
            'task_id': task_id,
            'action': action,
            'details': details,
            'requested_at': time.time(),
            'timeout': timeout_seconds
        }
        
        logger.info(f"Requested approval for task {task_id}: {action}")
        return {'approval_id': approval_id}
    
    async def _handle_intervention_request(self, message: ProtocolMessage):
        """Handle incoming intervention requests"""
        intervention_id = message.content['intervention_id']
        task_id = message.content['task_id']
        reason = message.content['reason']
        
        logger.info(f"Received intervention request {intervention_id} for task {task_id}: {reason}")
        
        # In a real implementation, this would trigger UI notifications
        # and wait for human input through the dashboard
    
    async def _handle_intervention_provided(self, message: ProtocolMessage):
        """Handle human intervention responses"""
        intervention_id = message.content['intervention_id']
        guidance = message.content['guidance']
        
        if intervention_id in self.pending_interventions:
            intervention_info = self.pending_interventions[intervention_id]
            del self.pending_interventions[intervention_id]
            
            logger.info(f"Received human intervention for {intervention_id}: {guidance}")
            
            # Process the guidance and continue with task execution
            await self._apply_human_guidance(intervention_info, guidance)
    
    async def _handle_approval_request(self, message: ProtocolMessage):
        """Handle approval requests"""
        approval_id = message.content['approval_id']
        action = message.content['action']
        
        logger.info(f"Received approval request {approval_id} for action: {action}")
    
    async def _handle_approval_response(self, message: ProtocolMessage):
        """Handle approval responses"""
        approval_id = message.content['approval_id']
        approved = message.content['approved']
        reason = message.content.get('reason', '')
        
        if approval_id in self.pending_approvals:
            approval_info = self.pending_approvals[approval_id]
            del self.pending_approvals[approval_id]
            
            logger.info(f"Approval {approval_id}: {'APPROVED' if approved else 'REJECTED'} - {reason}")
            
            # Process the approval decision
            await self._process_approval_decision(approval_info, approved, reason)
    
    async def _apply_human_guidance(self, intervention_info: Dict[str, Any], guidance: str):
        """Apply human guidance to ongoing task"""
        # Implementation would depend on the specific guidance format
        # This could involve modifying task execution, updating parameters, etc.
        logger.info(f"Applying human guidance: {guidance}")
    
    async def _process_approval_decision(self, approval_info: Dict[str, Any], approved: bool, reason: str):
        """Process approval decision"""
        if approved:
            # Proceed with the approved action
            logger.info(f"Proceeding with approved action: {approval_info['action']}")
        else:
            # Handle rejection
            logger.info(f"Action rejected: {approval_info['action']} - {reason}")

# ============================================================================
# Protocol Factory and Utilities
# ============================================================================

class ProtocolFactory:
    """Factory for creating protocol components"""
    
    @staticmethod
    def create_manager_protocol(agent_id: str) -> ProtocolEngine:
        """Create protocol engine for Manager agent"""
        protocol = ProtocolEngine(AgentRole.MANAGER, agent_id)
        
        # Initialize components
        task_manager = TaskManager(protocol)
        quality_manager = QualityGateManager(protocol)
        intervention_manager = HumanInterventionManager(protocol)
        
        # Store references for access
        protocol.task_manager = task_manager
        protocol.quality_manager = quality_manager
        protocol.intervention_manager = intervention_manager
        
        return protocol
    
    @staticmethod
    def create_worker_protocol(agent_id: str) -> ProtocolEngine:
        """Create protocol engine for Worker agent"""
        protocol = ProtocolEngine(AgentRole.WORKER, agent_id)
        
        # Initialize components
        task_manager = TaskManager(protocol)
        quality_manager = QualityGateManager(protocol)
        intervention_manager = HumanInterventionManager(protocol)
        
        # Store references for access
        protocol.task_manager = task_manager
        protocol.quality_manager = quality_manager
        protocol.intervention_manager = intervention_manager
        
        return protocol
    
    @staticmethod
    def create_human_protocol(operator_id: str) -> ProtocolEngine:
        """Create protocol engine for Human operator"""
        protocol = ProtocolEngine(AgentRole.HUMAN, operator_id)
        
        # Human protocols primarily handle intervention and approval
        intervention_manager = HumanInterventionManager(protocol)
        protocol.intervention_manager = intervention_manager
        
        return protocol

def create_sample_task() -> TaskDefinition:
    """Create a sample task for testing"""
    return TaskDefinition(
        title="Implement user authentication",
        description="Create a secure user authentication system with login/logout functionality",
        requirements=[
            "Password hashing",
            "Session management",
            "Security validation"
        ],
        estimated_duration=60,  # 60 minutes
        priority=MessagePriority.HIGH
    )

# Example usage and testing
async def example_usage():
    """Example of protocol usage"""
    logger.info("=== Protocol Communication Example ===")
    
    # Create Manager and Worker protocols
    manager_protocol = ProtocolFactory.create_manager_protocol("manager-001")
    worker_protocol = ProtocolFactory.create_worker_protocol("worker-001")
    
    # In real implementation, WebSocket connections would be injected here
    # manager_protocol.set_websocket(manager_websocket)
    # worker_protocol.set_websocket(worker_websocket)
    
    # Start protocols
    await manager_protocol.start()
    await worker_protocol.start()
    
    # Create and assign a task
    sample_task = create_sample_task()
    task_id = await manager_protocol.task_manager.assign_task(sample_task, AgentRole.WORKER)
    
    logger.info(f"Task {task_id} assigned successfully")
    
    # Simulate some protocol activity
    await asyncio.sleep(10)
    
    # Stop protocols
    await manager_protocol.stop()
    await worker_protocol.stop()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())