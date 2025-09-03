#!/usr/bin/env python3
"""
Message Router for Agent Communication Protocol
==============================================

This module provides message routing and delivery infrastructure for the
agent communication protocol, enabling reliable message delivery between
Manager, Worker, and Human agents.

Key Features:
- Intelligent message routing based on agent roles and availability
- Load balancing for multiple agents of the same role
- Message queuing with priority handling
- Dead letter handling for undeliverable messages
- Circuit breaker pattern for failed agents
- Message filtering and transformation
"""

import asyncio
import json
import time
import logging
from typing import Dict, List, Set, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque

from .protocol import (
    ProtocolMessage, MessageType, AgentRole, MessagePriority,
    ProtocolEngine, MessageMetadata
)

logger = logging.getLogger(__name__)

# ============================================================================
# Router Configuration and Types
# ============================================================================

class RoutingStrategy(Enum):
    """Message routing strategies"""
    DIRECT = "direct"                    # Direct to specific agent
    ROUND_ROBIN = "round_robin"         # Round-robin among available agents
    LEAST_LOADED = "least_loaded"       # Route to agent with least load
    BROADCAST = "broadcast"             # Send to all agents of role
    PRIORITY_FIRST = "priority_first"   # Route based on priority and availability

@dataclass
class AgentInfo:
    """Information about registered agents"""
    agent_id: str
    role: AgentRole
    protocol_engine: ProtocolEngine
    is_available: bool = True
    last_seen: float = field(default_factory=time.time)
    message_count: int = 0
    error_count: int = 0
    average_response_time: float = 0.0
    capabilities: Set[str] = field(default_factory=set)
    current_load: int = 0  # Number of active tasks/messages

@dataclass
class RoutingRule:
    """Routing rule configuration"""
    message_type: MessageType
    sender_role: AgentRole
    recipient_role: AgentRole
    strategy: RoutingStrategy = RoutingStrategy.DIRECT
    priority: int = 0
    filters: List[Callable] = field(default_factory=list)
    transformers: List[Callable] = field(default_factory=list)

@dataclass
class DeadLetter:
    """Dead letter message information"""
    message: ProtocolMessage
    failure_reason: str
    attempt_count: int
    last_attempt: float
    original_timestamp: float

# ============================================================================
# Message Router Implementation
# ============================================================================

class MessageRouter:
    """
    Central message router for agent communication.
    
    Responsibilities:
    - Route messages between agents based on roles and availability
    - Handle message queuing and priority management
    - Implement load balancing strategies
    - Manage dead letter handling
    - Provide monitoring and metrics
    """
    
    def __init__(self):
        self.agents: Dict[str, AgentInfo] = {}  # agent_id -> AgentInfo
        self.role_agents: Dict[AgentRole, List[str]] = defaultdict(list)  # role -> agent_ids
        self.routing_rules: List[RoutingRule] = []
        self.message_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.dead_letters: deque[DeadLetter] = deque(maxlen=1000)
        self.running = False
        
        # Routing strategies
        self.round_robin_counters: Dict[AgentRole, int] = defaultdict(int)
        
        # Metrics
        self.metrics = {
            'messages_routed': 0,
            'messages_delivered': 0,
            'messages_failed': 0,
            'dead_letters': 0,
            'routing_errors': 0
        }
        
        # Circuit breaker state for failed agents
        self.circuit_breakers: Dict[str, Dict[str, Any]] = {}
        
        self._setup_default_rules()
        
        logger.info("Message router initialized")
    
    def _setup_default_rules(self):
        """Setup default routing rules"""
        default_rules = [
            # Task assignment: Manager -> Worker (least loaded)
            RoutingRule(
                MessageType.TASK_ASSIGNMENT,
                AgentRole.MANAGER,
                AgentRole.WORKER,
                RoutingStrategy.LEAST_LOADED
            ),
            
            # Task responses: Worker -> Manager (direct)
            RoutingRule(
                MessageType.TASK_ACCEPTED,
                AgentRole.WORKER,
                AgentRole.MANAGER,
                RoutingStrategy.DIRECT
            ),
            
            # Human interventions: Any -> Human (broadcast)
            RoutingRule(
                MessageType.HUMAN_INTERVENTION_REQUESTED,
                AgentRole.MANAGER,
                AgentRole.HUMAN,
                RoutingStrategy.BROADCAST
            ),
            
            # System events: System -> All (broadcast)
            RoutingRule(
                MessageType.SESSION_EVENT,
                AgentRole.SYSTEM,
                AgentRole.MANAGER,
                RoutingStrategy.BROADCAST
            )
        ]
        
        self.routing_rules.extend(default_rules)
    
    async def start(self):
        """Start the message router"""
        self.running = True
        logger.info("Message router started")
        
        # Start background tasks
        asyncio.create_task(self._process_message_queue())
        asyncio.create_task(self._monitor_agent_health())
        asyncio.create_task(self._process_dead_letters())
    
    async def stop(self):
        """Stop the message router"""
        self.running = False
        logger.info("Message router stopped")
    
    def register_agent(self, agent_id: str, role: AgentRole, protocol_engine: ProtocolEngine, capabilities: Optional[Set[str]] = None):
        """Register an agent with the router"""
        agent_info = AgentInfo(
            agent_id=agent_id,
            role=role,
            protocol_engine=protocol_engine,
            capabilities=capabilities or set()
        )
        
        self.agents[agent_id] = agent_info
        self.role_agents[role].append(agent_id)
        
        # Initialize circuit breaker
        self.circuit_breakers[agent_id] = {
            'state': 'closed',  # closed, open, half_open
            'failure_count': 0,
            'last_failure': 0,
            'next_retry': 0
        }
        
        logger.info(f"Registered agent {agent_id} with role {role.value}")
    
    def unregister_agent(self, agent_id: str):
        """Unregister an agent from the router"""
        if agent_id in self.agents:
            agent_info = self.agents[agent_id]
            self.role_agents[agent_info.role].remove(agent_id)
            del self.agents[agent_id]
            del self.circuit_breakers[agent_id]
            
            logger.info(f"Unregistered agent {agent_id}")
    
    async def route_message(self, message: ProtocolMessage) -> bool:
        """
        Route a message to appropriate agents.
        
        Returns:
            bool: True if message was queued for delivery
        """
        try:
            # Find applicable routing rule
            rule = self._find_routing_rule(message)
            if not rule:
                logger.warning(f"No routing rule found for message type {message.type.value}")
                return False
            
            # Apply filters
            if not self._apply_filters(message, rule.filters):
                logger.debug(f"Message {message.id} filtered out")
                return False
            
            # Apply transformations
            transformed_message = self._apply_transformers(message, rule.transformers)
            
            # Determine target agents
            target_agents = self._resolve_target_agents(transformed_message, rule)
            if not target_agents:
                logger.warning(f"No available agents found for message {message.id}")
                await self._handle_dead_letter(message, "No available agents")
                return False
            
            # Queue message for delivery
            priority = self._calculate_priority(transformed_message, rule)
            for agent_id in target_agents:
                queue_item = (priority, time.time(), agent_id, transformed_message)
                await self.message_queue.put(queue_item)
            
            self.metrics['messages_routed'] += 1
            logger.debug(f"Routed message {message.id} to {len(target_agents)} agents")
            return True
            
        except Exception as e:
            logger.error(f"Error routing message {message.id}: {e}")
            self.metrics['routing_errors'] += 1
            return False
    
    def _find_routing_rule(self, message: ProtocolMessage) -> Optional[RoutingRule]:
        """Find applicable routing rule for message"""
        for rule in self.routing_rules:
            if (rule.message_type == message.type and
                rule.sender_role == message.sender and
                rule.recipient_role == message.recipient):
                return rule
        
        # Fallback to default rule
        return RoutingRule(
            message.type,
            message.sender,
            message.recipient,
            RoutingStrategy.DIRECT
        )
    
    def _apply_filters(self, message: ProtocolMessage, filters: List[Callable]) -> bool:
        """Apply message filters"""
        for filter_func in filters:
            try:
                if not filter_func(message):
                    return False
            except Exception as e:
                logger.error(f"Error in message filter: {e}")
                return False
        return True
    
    def _apply_transformers(self, message: ProtocolMessage, transformers: List[Callable]) -> ProtocolMessage:
        """Apply message transformations"""
        transformed = message
        for transformer in transformers:
            try:
                transformed = transformer(transformed)
            except Exception as e:
                logger.error(f"Error in message transformer: {e}")
        return transformed
    
    def _resolve_target_agents(self, message: ProtocolMessage, rule: RoutingRule) -> List[str]:
        """Resolve target agents based on routing strategy"""
        recipient_role = message.recipient
        available_agents = [
            agent_id for agent_id in self.role_agents[recipient_role]
            if self._is_agent_available(agent_id)
        ]
        
        if not available_agents:
            return []
        
        if rule.strategy == RoutingStrategy.DIRECT:
            # Try to find specific agent, fallback to any available
            return available_agents[:1]
        
        elif rule.strategy == RoutingStrategy.ROUND_ROBIN:
            counter = self.round_robin_counters[recipient_role]
            selected = available_agents[counter % len(available_agents)]
            self.round_robin_counters[recipient_role] += 1
            return [selected]
        
        elif rule.strategy == RoutingStrategy.LEAST_LOADED:
            # Select agent with lowest current load
            agent_loads = [
                (agent_id, self.agents[agent_id].current_load)
                for agent_id in available_agents
            ]
            agent_loads.sort(key=lambda x: x[1])
            return [agent_loads[0][0]]
        
        elif rule.strategy == RoutingStrategy.BROADCAST:
            return available_agents
        
        elif rule.strategy == RoutingStrategy.PRIORITY_FIRST:
            # Sort by capability match and load
            scored_agents = []
            for agent_id in available_agents:
                agent = self.agents[agent_id]
                score = len(agent.capabilities)  # Simplified scoring
                scored_agents.append((agent_id, score, agent.current_load))
            
            # Sort by score (desc) then by load (asc)
            scored_agents.sort(key=lambda x: (-x[1], x[2]))
            return [scored_agents[0][0]]
        
        return available_agents[:1]  # Fallback
    
    def _is_agent_available(self, agent_id: str) -> bool:
        """Check if agent is available for message delivery"""
        if agent_id not in self.agents:
            return False
        
        agent = self.agents[agent_id]
        circuit_breaker = self.circuit_breakers[agent_id]
        
        # Check basic availability
        if not agent.is_available:
            return False
        
        # Check circuit breaker state
        current_time = time.time()
        if circuit_breaker['state'] == 'open':
            if current_time < circuit_breaker['next_retry']:
                return False
            else:
                # Try to move to half-open state
                circuit_breaker['state'] = 'half_open'
                logger.info(f"Circuit breaker for agent {agent_id} moving to half-open")
        
        # Check last seen timestamp (agent heartbeat)
        if current_time - agent.last_seen > 60:  # 60 seconds timeout
            agent.is_available = False
            return False
        
        return True
    
    def _calculate_priority(self, message: ProtocolMessage, rule: RoutingRule) -> int:
        """Calculate message priority for queue ordering"""
        base_priority = message.priority.value
        rule_priority = rule.priority
        
        # Lower number = higher priority in priority queue
        return -(base_priority * 10 + rule_priority)
    
    async def _process_message_queue(self):
        """Process outgoing message queue"""
        while self.running:
            try:
                # Get message from queue with timeout
                priority, queued_time, agent_id, message = await asyncio.wait_for(
                    self.message_queue.get(), timeout=1.0
                )
                
                # Check if agent is still available
                if not self._is_agent_available(agent_id):
                    # Re-route message
                    await self.route_message(message)
                    continue
                
                # Deliver message
                success = await self._deliver_message(agent_id, message)
                if success:
                    self.metrics['messages_delivered'] += 1
                    # Update agent stats
                    agent = self.agents[agent_id]
                    agent.message_count += 1
                    agent.current_load += 1
                else:
                    self.metrics['messages_failed'] += 1
                    await self._handle_delivery_failure(agent_id, message)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing message queue: {e}")
    
    async def _deliver_message(self, agent_id: str, message: ProtocolMessage) -> bool:
        """Deliver message to specific agent"""
        try:
            agent = self.agents[agent_id]
            protocol_engine = agent.protocol_engine
            
            # Send message through agent's protocol engine
            success = await protocol_engine.send_message(message)
            
            if success:
                # Update circuit breaker on success
                circuit_breaker = self.circuit_breakers[agent_id]
                if circuit_breaker['state'] == 'half_open':
                    circuit_breaker['state'] = 'closed'
                    circuit_breaker['failure_count'] = 0
                    logger.info(f"Circuit breaker for agent {agent_id} closed")
                
                logger.debug(f"Delivered message {message.id} to agent {agent_id}")
                return True
            else:
                await self._handle_circuit_breaker_failure(agent_id)
                return False
                
        except Exception as e:
            logger.error(f"Error delivering message {message.id} to agent {agent_id}: {e}")
            await self._handle_circuit_breaker_failure(agent_id)
            return False
    
    async def _handle_delivery_failure(self, agent_id: str, message: ProtocolMessage):
        """Handle message delivery failure"""
        # Try to re-route to another agent of the same role
        if agent_id in self.agents:
            agent_role = self.agents[agent_id].role
            other_agents = [
                aid for aid in self.role_agents[agent_role]
                if aid != agent_id and self._is_agent_available(aid)
            ]
            
            if other_agents:
                # Re-route to another agent
                await self.route_message(message)
                return
        
        # No other agents available - move to dead letter
        await self._handle_dead_letter(message, f"Delivery failed to agent {agent_id}")
    
    async def _handle_circuit_breaker_failure(self, agent_id: str):
        """Handle circuit breaker failure for agent"""
        circuit_breaker = self.circuit_breakers[agent_id]
        circuit_breaker['failure_count'] += 1
        circuit_breaker['last_failure'] = time.time()
        
        # Open circuit breaker if failure threshold exceeded
        if circuit_breaker['failure_count'] >= 5:  # Configurable threshold
            circuit_breaker['state'] = 'open'
            circuit_breaker['next_retry'] = time.time() + 60  # 60 second timeout
            
            logger.warning(f"Circuit breaker opened for agent {agent_id}")
    
    async def _handle_dead_letter(self, message: ProtocolMessage, reason: str):
        """Handle undeliverable message"""
        dead_letter = DeadLetter(
            message=message,
            failure_reason=reason,
            attempt_count=1,
            last_attempt=time.time(),
            original_timestamp=message.timestamp
        )
        
        self.dead_letters.append(dead_letter)
        self.metrics['dead_letters'] += 1
        
        logger.warning(f"Message {message.id} moved to dead letter: {reason}")
    
    async def _monitor_agent_health(self):
        """Monitor agent health and availability"""
        while self.running:
            try:
                current_time = time.time()
                
                for agent_id, agent in self.agents.items():
                    # Check if agent hasn't been seen recently
                    if current_time - agent.last_seen > 60:  # 60 seconds
                        if agent.is_available:
                            agent.is_available = False
                            logger.warning(f"Agent {agent_id} marked as unavailable (no heartbeat)")
                    
                    # Send heartbeat request
                    if agent.is_available and hasattr(agent.protocol_engine, 'send_message'):
                        heartbeat = ProtocolMessage(
                            type=MessageType.HEARTBEAT,
                            sender=AgentRole.SYSTEM,
                            recipient=agent.role,
                            content={'timestamp': current_time},
                            metadata=MessageMetadata(requires_ack=False)
                        )
                        
                        try:
                            await agent.protocol_engine.send_message(heartbeat)
                        except Exception as e:
                            logger.error(f"Error sending heartbeat to {agent_id}: {e}")
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in agent health monitor: {e}")
    
    async def _process_dead_letters(self):
        """Process dead letter queue for retry"""
        while self.running:
            try:
                # Check dead letters for retry opportunities
                current_time = time.time()
                retry_candidates = []
                
                for dead_letter in list(self.dead_letters):
                    # Retry after exponential backoff
                    retry_delay = min(300, 30 * (2 ** dead_letter.attempt_count))  # Max 5 minutes
                    
                    if current_time - dead_letter.last_attempt > retry_delay:
                        if dead_letter.attempt_count < 3:  # Max 3 retries
                            retry_candidates.append(dead_letter)
                
                # Retry dead letters
                for dead_letter in retry_candidates:
                    self.dead_letters.remove(dead_letter)
                    dead_letter.attempt_count += 1
                    dead_letter.last_attempt = current_time
                    
                    # Try to route again
                    success = await self.route_message(dead_letter.message)
                    if not success:
                        # Put back in dead letter queue
                        self.dead_letters.append(dead_letter)
                
                await asyncio.sleep(60)  # Process every minute
                
            except Exception as e:
                logger.error(f"Error processing dead letters: {e}")
    
    def update_agent_heartbeat(self, agent_id: str):
        """Update agent heartbeat timestamp"""
        if agent_id in self.agents:
            self.agents[agent_id].last_seen = time.time()
            if not self.agents[agent_id].is_available:
                self.agents[agent_id].is_available = True
                logger.info(f"Agent {agent_id} back online")
    
    def update_agent_load(self, agent_id: str, load_delta: int):
        """Update agent load (positive for increase, negative for decrease)"""
        if agent_id in self.agents:
            agent = self.agents[agent_id]
            agent.current_load = max(0, agent.current_load + load_delta)
    
    def get_routing_metrics(self) -> Dict[str, Any]:
        """Get routing metrics"""
        metrics = self.metrics.copy()
        metrics.update({
            'registered_agents': len(self.agents),
            'available_agents': sum(1 for a in self.agents.values() if a.is_available),
            'dead_letter_count': len(self.dead_letters),
            'queue_size': self.message_queue.qsize(),
            'circuit_breakers_open': sum(1 for cb in self.circuit_breakers.values() if cb['state'] == 'open')
        })
        return metrics
    
    def add_routing_rule(self, rule: RoutingRule):
        """Add custom routing rule"""
        self.routing_rules.append(rule)
        # Sort by priority (higher priority first)
        self.routing_rules.sort(key=lambda r: r.priority, reverse=True)
        
        logger.info(f"Added routing rule for {rule.message_type.value}: {rule.strategy.value}")
    
    def remove_routing_rule(self, message_type: MessageType, sender_role: AgentRole, recipient_role: AgentRole):
        """Remove routing rule"""
        self.routing_rules = [
            rule for rule in self.routing_rules
            if not (rule.message_type == message_type and 
                   rule.sender_role == sender_role and
                   rule.recipient_role == recipient_role)
        ]

# ============================================================================
# Message Filters and Transformers
# ============================================================================

class MessageFilters:
    """Common message filters"""
    
    @staticmethod
    def priority_filter(min_priority: MessagePriority) -> Callable:
        """Filter messages below minimum priority"""
        def filter_func(message: ProtocolMessage) -> bool:
            return message.priority.value >= min_priority.value
        return filter_func
    
    @staticmethod
    def content_filter(required_fields: List[str]) -> Callable:
        """Filter messages missing required content fields"""
        def filter_func(message: ProtocolMessage) -> bool:
            return all(field in message.content for field in required_fields)
        return filter_func
    
    @staticmethod
    def time_filter(max_age_seconds: int) -> Callable:
        """Filter messages older than max age"""
        def filter_func(message: ProtocolMessage) -> bool:
            return time.time() - message.timestamp <= max_age_seconds
        return filter_func

class MessageTransformers:
    """Common message transformers"""
    
    @staticmethod
    def add_timestamp_transformer() -> Callable:
        """Add processing timestamp to message content"""
        def transform_func(message: ProtocolMessage) -> ProtocolMessage:
            message.content['processed_at'] = time.time()
            return message
        return transform_func
    
    @staticmethod
    def priority_boost_transformer(boost_amount: int) -> Callable:
        """Boost message priority"""
        def transform_func(message: ProtocolMessage) -> ProtocolMessage:
            new_priority_value = min(5, message.priority.value + boost_amount)
            message.priority = MessagePriority(new_priority_value)
            return message
        return transform_func
    
    @staticmethod
    def content_enrichment_transformer(additional_data: Dict[str, Any]) -> Callable:
        """Add additional data to message content"""
        def transform_func(message: ProtocolMessage) -> ProtocolMessage:
            message.content.update(additional_data)
            return message
        return transform_func

# Example usage
async def example_router_usage():
    """Example of message router usage"""
    logger.info("=== Message Router Example ===")
    
    # Create router
    router = MessageRouter()
    await router.start()
    
    # Note: In real usage, agents would be registered when protocol engines start
    # router.register_agent("manager-001", AgentRole.MANAGER, manager_protocol)
    # router.register_agent("worker-001", AgentRole.WORKER, worker_protocol)
    
    # Add custom routing rule with filters
    custom_rule = RoutingRule(
        MessageType.TASK_ASSIGNMENT,
        AgentRole.MANAGER,
        AgentRole.WORKER,
        RoutingStrategy.LEAST_LOADED,
        priority=10,
        filters=[MessageFilters.priority_filter(MessagePriority.NORMAL)],
        transformers=[MessageTransformers.add_timestamp_transformer()]
    )
    router.add_routing_rule(custom_rule)
    
    logger.info("Message router configured and ready")
    
    await asyncio.sleep(2)
    await router.stop()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_router_usage())