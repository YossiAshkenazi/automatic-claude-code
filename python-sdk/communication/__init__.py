"""
Communication Protocol Package for Agent Coordination
===================================================

This package provides comprehensive communication infrastructure for Manager-Worker
agent coordination in the visual agent management platform.

Core Components:
- Protocol Engine: Message routing, delivery, and acknowledgment
- Task Management: Task assignment and progress tracking
- Quality Gates: Validation and quality control
- Human Intervention: Oversight and manual intervention capabilities

Usage:
    from communication import ProtocolFactory, MessageType, TaskDefinition
    
    # Create manager protocol
    manager_protocol = ProtocolFactory.create_manager_protocol("manager-001")
    
    # Create worker protocol  
    worker_protocol = ProtocolFactory.create_worker_protocol("worker-001")
    
    # Start communication
    await manager_protocol.start()
    await worker_protocol.start()
"""

from .protocol import (
    # Core Protocol Classes
    ProtocolEngine,
    ProtocolMessage,
    MessageMetadata,
    
    # Enums
    MessageType,
    AgentRole,
    MessagePriority,
    TaskStatus,
    CoordinationPhase,
    
    # Data Structures
    TaskDefinition,
    TaskProgress,
    QualityGate,
    ValidationResult,
    
    # Managers
    TaskManager,
    QualityGateManager,
    HumanInterventionManager,
    
    # Factory
    ProtocolFactory,
    
    # Utilities
    create_sample_task
)

from .message_router import MessageRouter
from .state_manager import StateManager, SessionState, TaskState
from .serialization import MessageSerializer, ProtocolJSONEncoder

__version__ = "1.0.0"
__author__ = "Visual Agent Management Platform"

__all__ = [
    # Core Classes
    "ProtocolEngine",
    "ProtocolMessage", 
    "MessageMetadata",
    "MessageRouter",
    "StateManager",
    "MessageSerializer",
    
    # Enums
    "MessageType",
    "AgentRole", 
    "MessagePriority",
    "TaskStatus",
    "CoordinationPhase",
    
    # Data Structures
    "TaskDefinition",
    "TaskProgress",
    "QualityGate", 
    "ValidationResult",
    "SessionState",
    "TaskState",
    
    # Managers
    "TaskManager",
    "QualityGateManager",
    "HumanInterventionManager",
    
    # Factory
    "ProtocolFactory",
    
    # Utilities
    "create_sample_task",
    "ProtocolJSONEncoder"
]