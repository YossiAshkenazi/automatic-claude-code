#!/usr/bin/env python3
"""
Communication Bridge - Agent-to-agent communication system

Provides structured communication channels, message routing, and coordination
patterns for the multi-agent system. Enables Manager-Worker coordination,
task handoffs, and collaborative workflows.
"""

import asyncio
import json
import time
import uuid
import logging
from typing import Dict, List, Optional, Set, Callable, Any, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class MessageType(Enum):
    """Types of inter-agent messages"""
    TASK_ASSIGNMENT = "task_assignment"
    TASK_RESULT = "task_result"
    STATUS_UPDATE = "status_update"
    COORDINATION_REQUEST = "coordination_request"
    COORDINATION_RESPONSE = "coordination_response"
    ERROR_NOTIFICATION = "error_notification"
    HEALTH_CHECK = "health_check"
    RESOURCE_REQUEST = "resource_request"
    WORKFLOW_TRANSITION = "workflow_transition"
    BROADCAST = "broadcast"
    DIRECT_MESSAGE = "direct_message"


class MessagePriority(Enum):
    """Message priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4
    CRITICAL = 5


class RoutingStrategy(Enum):
    """Message routing strategies"""
    DIRECT = "direct"              # Direct agent-to-agent
    ROLE_BASED = "role_based"      # Route to agents by role
    BROADCAST = "broadcast"        # Send to all agents
    LOAD_BALANCED = "load_balanced" # Route to least busy agent
    ROUND_ROBIN = "round_robin"    # Distribute evenly


@dataclass
class AgentMessage:
    """Structured message for agent communication"""
    message_id: str
    from_agent: str
    to_agent: Optional[str]  # None for broadcast messages
    message_type: MessageType
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    priority: MessagePriority = MessagePriority.NORMAL
    routing_strategy: RoutingStrategy = RoutingStrategy.DIRECT
    timestamp: float = field(default_factory=time.time)
    requires_response: bool = False
    response_timeout: Optional[float] = None
    parent_message_id: Optional[str] = None
    correlation_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary for serialization"""
        return {
            'message_id': self.message_id,
            'from_agent': self.from_agent,
            'to_agent': self.to_agent,
            'message_type': self.message_type.value,
            'content': self.content,
            'metadata': self.metadata,
            'priority': self.priority.value,
            'routing_strategy': self.routing_strategy.value,
            'timestamp': self.timestamp,
            'requires_response': self.requires_response,
            'response_timeout': self.response_timeout,
            'parent_message_id': self.parent_message_id,
            'correlation_id': self.correlation_id
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AgentMessage':
        """Create message from dictionary"""
        return cls(
            message_id=data['message_id'],
            from_agent=data['from_agent'],
            to_agent=data.get('to_agent'),
            message_type=MessageType(data['message_type']),
            content=data['content'],
            metadata=data.get('metadata', {}),
            priority=MessagePriority(data.get('priority', MessagePriority.NORMAL.value)),
            routing_strategy=RoutingStrategy(data.get('routing_strategy', RoutingStrategy.DIRECT.value)),
            timestamp=data.get('timestamp', time.time()),
            requires_response=data.get('requires_response', False),
            response_timeout=data.get('response_timeout'),
            parent_message_id=data.get('parent_message_id'),
            correlation_id=data.get('correlation_id')
        )


@dataclass
class MessageHandler:
    """Handler for specific message types"""
    handler_id: str
    message_type: MessageType
    agent_id: str
    callback: Callable[[AgentMessage], None]
    is_async: bool = True
    priority: int = 0  # Higher priority handlers run first


@dataclass
class ConversationContext:
    """Context for multi-turn agent conversations"""
    conversation_id: str
    participants: Set[str]
    started_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    message_count: int = 0
    status: str = "active"  # active, paused, completed, failed
    metadata: Dict[str, Any] = field(default_factory=dict)


class CommunicationBridge:
    """
    Advanced communication system for multi-agent coordination.
    
    Features:
    - Message routing with multiple strategies
    - Priority-based message queuing
    - Conversation context management
    - Request-response patterns
    - Broadcast and multicast messaging
    - Message persistence and replay
    - Coordination pattern templates
    """
    
    def __init__(self, max_message_history: int = 1000):
        self.max_message_history = max_message_history
        self.logger = logging.getLogger(f"{__name__}.CommunicationBridge")
        
        # Message routing and queuing
        self.agent_queues: Dict[str, asyncio.PriorityQueue] = {}
        self.message_handlers: Dict[str, List[MessageHandler]] = defaultdict(list)
        self.message_history: deque = deque(maxlen=max_message_history)
        
        # Request-response tracking
        self.pending_responses: Dict[str, asyncio.Future] = {}
        self.response_timeouts: Dict[str, asyncio.Task] = {}
        
        # Conversation management
        self.conversations: Dict[str, ConversationContext] = {}
        self.active_agent_sessions: Set[str] = set()
        
        # Background tasks
        self.message_processor_task: Optional[asyncio.Task] = None
        self.cleanup_task: Optional[asyncio.Task] = None
        
        # Routing state
        self.round_robin_counters: Dict[str, int] = defaultdict(int)
        
        # Coordination patterns
        self.coordination_patterns: Dict[str, Callable] = {
            'manager_worker_delegation': self._handle_manager_worker_delegation,
            'peer_collaboration': self._handle_peer_collaboration,
            'broadcast_notification': self._handle_broadcast_notification,
            'resource_sharing': self._handle_resource_sharing
        }
        
        self.logger.info("CommunicationBridge initialized")
    
    async def start(self):
        """Start communication bridge and background processing"""
        self.logger.info("Starting communication bridge")
        
        # Start background tasks
        self.message_processor_task = asyncio.create_task(self._message_processor_loop())
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        self.logger.info("Communication bridge started")
    
    async def stop(self, timeout: float = 5.0):
        """Stop communication bridge and cleanup"""
        self.logger.info("Stopping communication bridge")
        
        # Cancel background tasks
        tasks_to_cancel = []
        if self.message_processor_task:
            tasks_to_cancel.append(self.message_processor_task)
        if self.cleanup_task:
            tasks_to_cancel.append(self.cleanup_task)
        
        for task in tasks_to_cancel:
            task.cancel()
        
        if tasks_to_cancel:
            await asyncio.wait_for(
                asyncio.gather(*tasks_to_cancel, return_exceptions=True),
                timeout=timeout
            )
        
        # Cancel pending response timeouts
        for timeout_task in self.response_timeouts.values():
            timeout_task.cancel()
        
        self.logger.info("Communication bridge stopped")
    
    async def register_agent(self, agent_id: str):
        """Register an agent for message communication"""
        if agent_id not in self.agent_queues:
            # Use PriorityQueue with (priority, timestamp, message) tuples
            # Lower priority values = higher priority
            self.agent_queues[agent_id] = asyncio.PriorityQueue()
            self.active_agent_sessions.add(agent_id)
            self.logger.info(f"Agent registered for communication: {agent_id}")
    
    async def unregister_agent(self, agent_id: str):
        """Unregister an agent from communication"""
        if agent_id in self.agent_queues:
            # Clear any pending messages
            while not self.agent_queues[agent_id].empty():
                try:
                    self.agent_queues[agent_id].get_nowait()
                except asyncio.QueueEmpty:
                    break
            
            del self.agent_queues[agent_id]
            self.active_agent_sessions.discard(agent_id)
            
            # Remove from conversations
            for conv in list(self.conversations.values()):
                conv.participants.discard(agent_id)
                if not conv.participants:
                    self.conversations.pop(conv.conversation_id, None)
            
            self.logger.info(f"Agent unregistered from communication: {agent_id}")
    
    def register_message_handler(self, agent_id: str, message_type: MessageType, 
                                callback: Callable[[AgentMessage], Any],
                                is_async: bool = True, priority: int = 0) -> str:
        """
        Register a message handler for specific message types.
        
        Args:
            agent_id: ID of agent registering handler
            message_type: Type of messages to handle
            callback: Function to call when message received
            is_async: Whether callback is async
            priority: Handler priority (higher = runs first)
        
        Returns:
            Handler ID for later removal
        """
        handler_id = f"{agent_id}_{message_type.value}_{uuid.uuid4().hex[:8]}"
        
        handler = MessageHandler(
            handler_id=handler_id,
            message_type=message_type,
            agent_id=agent_id,
            callback=callback,
            is_async=is_async,
            priority=priority
        )
        
        self.message_handlers[agent_id].append(handler)
        
        # Sort handlers by priority (highest first)
        self.message_handlers[agent_id].sort(key=lambda h: -h.priority)
        
        self.logger.debug(f"Registered message handler: {handler_id}")
        return handler_id
    
    def unregister_message_handler(self, handler_id: str):
        """Remove a message handler"""
        for agent_handlers in self.message_handlers.values():
            for i, handler in enumerate(agent_handlers):
                if handler.handler_id == handler_id:
                    agent_handlers.pop(i)
                    self.logger.debug(f"Unregistered message handler: {handler_id}")
                    return
    
    async def send_message(self, message: AgentMessage) -> bool:
        """
        Send a message to target agent(s).
        
        Returns:
            True if message was successfully queued, False otherwise
        """
        try:
            # Add to message history
            self.message_history.append(message)
            
            # Route message based on strategy
            target_agents = await self._route_message(message)
            
            if not target_agents:
                self.logger.warning(f"No target agents found for message {message.message_id}")
                return False
            
            # Queue message for each target agent
            queued_count = 0
            priority_value = -message.priority.value  # Negative for higher priority first
            
            for agent_id in target_agents:
                if agent_id in self.agent_queues:
                    queue_item = (priority_value, message.timestamp, message)
                    await self.agent_queues[agent_id].put(queue_item)
                    queued_count += 1
            
            # Set up response tracking if required
            if message.requires_response:
                await self._setup_response_tracking(message)
            
            self.logger.debug(f"Message {message.message_id} queued for {queued_count} agents")
            return queued_count > 0
            
        except Exception as e:
            self.logger.error(f"Error sending message {message.message_id}: {e}")
            return False
    
    async def _route_message(self, message: AgentMessage) -> List[str]:
        """Route message to appropriate agents based on routing strategy"""
        if message.routing_strategy == RoutingStrategy.DIRECT:
            return [message.to_agent] if message.to_agent else []
        
        elif message.routing_strategy == RoutingStrategy.BROADCAST:
            return list(self.active_agent_sessions)
        
        elif message.routing_strategy == RoutingStrategy.ROLE_BASED:
            # This would need integration with MultiAgentCLIWrapper to get agents by role
            # For now, return all active agents
            return list(self.active_agent_sessions)
        
        elif message.routing_strategy == RoutingStrategy.LOAD_BALANCED:
            # Route to agent with smallest queue
            if not self.active_agent_sessions:
                return []
            
            agent_loads = []
            for agent_id in self.active_agent_sessions:
                queue_size = self.agent_queues[agent_id].qsize()
                agent_loads.append((queue_size, agent_id))
            
            # Return agent with smallest queue
            least_loaded = min(agent_loads, key=lambda x: x[0])
            return [least_loaded[1]]
        
        elif message.routing_strategy == RoutingStrategy.ROUND_ROBIN:
            if not self.active_agent_sessions:
                return []
            
            agents_list = list(self.active_agent_sessions)
            from_agent = message.from_agent
            
            counter = self.round_robin_counters[from_agent]
            selected_agent = agents_list[counter % len(agents_list)]
            self.round_robin_counters[from_agent] = counter + 1
            
            return [selected_agent]
        
        return []
    
    async def _setup_response_tracking(self, message: AgentMessage):
        """Set up response tracking for request-response messages"""
        response_future = asyncio.Future()
        self.pending_responses[message.message_id] = response_future
        
        # Set up timeout if specified
        if message.response_timeout:
            timeout_task = asyncio.create_task(
                self._handle_response_timeout(message.message_id, message.response_timeout)
            )
            self.response_timeouts[message.message_id] = timeout_task
    
    async def _handle_response_timeout(self, message_id: str, timeout: float):
        """Handle response timeout"""
        await asyncio.sleep(timeout)
        
        if message_id in self.pending_responses:
            future = self.pending_responses.pop(message_id)
            if not future.done():
                future.set_exception(TimeoutError(f"Response timeout for message {message_id}"))
        
        self.response_timeouts.pop(message_id, None)
    
    async def send_response(self, original_message: AgentMessage, response_content: str,
                           response_metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Send a response to an original message"""
        response_message = AgentMessage(
            message_id=f"response_{uuid.uuid4().hex[:8]}",
            from_agent=original_message.to_agent or "unknown",
            to_agent=original_message.from_agent,
            message_type=MessageType.COORDINATION_RESPONSE,
            content=response_content,
            metadata=response_metadata or {},
            parent_message_id=original_message.message_id,
            correlation_id=original_message.correlation_id
        )
        
        success = await self.send_message(response_message)
        
        # Complete pending response future
        if original_message.message_id in self.pending_responses:
            future = self.pending_responses.pop(original_message.message_id)
            if not future.done():
                future.set_result(response_message)
            
            # Cancel timeout task
            timeout_task = self.response_timeouts.pop(original_message.message_id, None)
            if timeout_task:
                timeout_task.cancel()
        
        return success
    
    async def wait_for_response(self, message_id: str, timeout: Optional[float] = None) -> AgentMessage:
        """
        Wait for a response to a message.
        
        Returns:
            Response message
        
        Raises:
            TimeoutError: If timeout occurs
            ValueError: If message not found or doesn't require response
        """
        if message_id not in self.pending_responses:
            raise ValueError(f"No pending response for message {message_id}")
        
        future = self.pending_responses[message_id]
        
        if timeout:
            return await asyncio.wait_for(future, timeout=timeout)
        else:
            return await future
    
    async def receive_messages(self, agent_id: str, max_messages: int = 10) -> List[AgentMessage]:
        """
        Receive pending messages for an agent.
        
        Args:
            agent_id: ID of agent receiving messages
            max_messages: Maximum number of messages to retrieve
        
        Returns:
            List of messages for the agent
        """
        if agent_id not in self.agent_queues:
            return []
        
        messages = []
        queue = self.agent_queues[agent_id]
        
        for _ in range(max_messages):
            try:
                priority, timestamp, message = queue.get_nowait()
                messages.append(message)
                
                # Process handlers for this message
                await self._process_message_handlers(agent_id, message)
                
            except asyncio.QueueEmpty:
                break
        
        return messages
    
    async def _process_message_handlers(self, agent_id: str, message: AgentMessage):
        """Process registered message handlers for an agent"""
        if agent_id not in self.message_handlers:
            return
        
        handlers = [h for h in self.message_handlers[agent_id] 
                   if h.message_type == message.message_type]
        
        for handler in handlers:
            try:
                if handler.is_async:
                    await handler.callback(message)
                else:
                    handler.callback(message)
            except Exception as e:
                self.logger.error(f"Error in message handler {handler.handler_id}: {e}")
    
    async def _message_processor_loop(self):
        """Background message processing loop"""
        self.logger.info("Starting message processor loop")
        
        while True:
            try:
                # Process any coordination patterns
                await self._process_coordination_patterns()
                
                # Clean up expired conversations
                await self._cleanup_expired_conversations()
                
                await asyncio.sleep(1)  # Process every second
                
            except asyncio.CancelledError:
                self.logger.info("Message processor loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in message processor loop: {e}")
                await asyncio.sleep(5)
        
        self.logger.info("Message processor loop stopped")
    
    async def _cleanup_loop(self):
        """Background cleanup loop"""
        self.logger.info("Starting communication cleanup loop")
        
        while True:
            try:
                # Clean up completed response futures
                completed_responses = []
                for message_id, future in self.pending_responses.items():
                    if future.done():
                        completed_responses.append(message_id)
                
                for message_id in completed_responses:
                    self.pending_responses.pop(message_id, None)
                    timeout_task = self.response_timeouts.pop(message_id, None)
                    if timeout_task:
                        timeout_task.cancel()
                
                await asyncio.sleep(60)  # Cleanup every minute
                
            except asyncio.CancelledError:
                self.logger.info("Communication cleanup loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in communication cleanup loop: {e}")
                await asyncio.sleep(60)
        
        self.logger.info("Communication cleanup loop stopped")
    
    async def _process_coordination_patterns(self):
        """Process active coordination patterns"""
        # This is where complex coordination logic would go
        # For now, just placeholder
        pass
    
    async def _cleanup_expired_conversations(self):
        """Clean up expired conversations"""
        current_time = time.time()
        expired_conversations = []
        
        for conv_id, conv in self.conversations.items():
            # Expire conversations inactive for more than 1 hour
            if current_time - conv.last_activity > 3600:
                expired_conversations.append(conv_id)
        
        for conv_id in expired_conversations:
            del self.conversations[conv_id]
    
    # Coordination pattern handlers
    async def _handle_manager_worker_delegation(self, message: AgentMessage):
        """Handle Manager-Worker delegation pattern"""
        if message.message_type == MessageType.TASK_ASSIGNMENT:
            # Manager delegating to worker
            self.logger.info(f"Manager-Worker delegation: {message.from_agent} -> {message.to_agent}")
        
        elif message.message_type == MessageType.TASK_RESULT:
            # Worker reporting back to manager
            self.logger.info(f"Worker result reporting: {message.from_agent} -> {message.to_agent}")
    
    async def _handle_peer_collaboration(self, message: AgentMessage):
        """Handle peer-to-peer collaboration pattern"""
        if message.message_type == MessageType.COORDINATION_REQUEST:
            self.logger.info(f"Peer collaboration request: {message.from_agent} -> {message.to_agent}")
    
    async def _handle_broadcast_notification(self, message: AgentMessage):
        """Handle broadcast notification pattern"""
        if message.routing_strategy == RoutingStrategy.BROADCAST:
            self.logger.info(f"Broadcast notification from {message.from_agent}")
    
    async def _handle_resource_sharing(self, message: AgentMessage):
        """Handle resource sharing coordination pattern"""
        if message.message_type == MessageType.RESOURCE_REQUEST:
            self.logger.info(f"Resource sharing request: {message.from_agent}")
    
    # Convenience methods for common messaging patterns
    
    async def send_task_assignment(self, from_agent: str, to_agent: str, 
                                 task_description: str, task_metadata: Optional[Dict] = None) -> str:
        """Send a task assignment message"""
        message = AgentMessage(
            message_id=f"task_{uuid.uuid4().hex[:8]}",
            from_agent=from_agent,
            to_agent=to_agent,
            message_type=MessageType.TASK_ASSIGNMENT,
            content=task_description,
            metadata=task_metadata or {},
            requires_response=True,
            response_timeout=300.0  # 5 minutes
        )
        
        await self.send_message(message)
        return message.message_id
    
    async def send_status_update(self, from_agent: str, to_agent: str, 
                               status: str, details: Optional[Dict] = None):
        """Send a status update message"""
        message = AgentMessage(
            message_id=f"status_{uuid.uuid4().hex[:8]}",
            from_agent=from_agent,
            to_agent=to_agent,
            message_type=MessageType.STATUS_UPDATE,
            content=status,
            metadata=details or {}
        )
        
        await self.send_message(message)
    
    async def broadcast_notification(self, from_agent: str, notification: str, 
                                   metadata: Optional[Dict] = None):
        """Send a broadcast notification to all agents"""
        message = AgentMessage(
            message_id=f"broadcast_{uuid.uuid4().hex[:8]}",
            from_agent=from_agent,
            to_agent=None,
            message_type=MessageType.BROADCAST,
            content=notification,
            metadata=metadata or {},
            routing_strategy=RoutingStrategy.BROADCAST
        )
        
        await self.send_message(message)
    
    def get_message_history(self, agent_id: Optional[str] = None, 
                          message_type: Optional[MessageType] = None,
                          limit: int = 100) -> List[AgentMessage]:
        """
        Get message history with optional filtering.
        
        Args:
            agent_id: Filter by agent (from_agent or to_agent)
            message_type: Filter by message type
            limit: Maximum messages to return
        
        Returns:
            List of messages matching criteria
        """
        messages = list(self.message_history)
        
        # Filter by agent
        if agent_id:
            messages = [m for m in messages 
                       if m.from_agent == agent_id or m.to_agent == agent_id]
        
        # Filter by message type
        if message_type:
            messages = [m for m in messages if m.message_type == message_type]
        
        # Sort by timestamp (newest first) and limit
        messages.sort(key=lambda m: m.timestamp, reverse=True)
        return messages[:limit]
    
    def get_communication_stats(self) -> Dict[str, Any]:
        """Get communication system statistics"""
        active_conversations = len([c for c in self.conversations.values() 
                                  if c.status == "active"])
        
        message_counts_by_type = defaultdict(int)
        for message in self.message_history:
            message_counts_by_type[message.message_type.value] += 1
        
        return {
            'active_agents': len(self.active_agent_sessions),
            'total_queued_messages': sum(q.qsize() for q in self.agent_queues.values()),
            'pending_responses': len(self.pending_responses),
            'active_conversations': active_conversations,
            'total_conversations': len(self.conversations),
            'message_history_length': len(self.message_history),
            'message_counts_by_type': dict(message_counts_by_type),
            'registered_handlers': sum(len(handlers) for handlers in self.message_handlers.values())
        }