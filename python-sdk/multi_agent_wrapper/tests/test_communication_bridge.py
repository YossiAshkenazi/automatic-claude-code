#!/usr/bin/env python3
"""
Unit tests for CommunicationBridge

Tests agent-to-agent communication, message routing, and coordination patterns.
"""

import asyncio
import pytest
import time
from unittest.mock import Mock, AsyncMock

# Import classes under test
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from multi_agent_wrapper.communication_bridge import (
    CommunicationBridge, AgentMessage, MessageType, MessagePriority,
    RoutingStrategy, MessageHandler
)


class TestCommunicationBridge:
    """Test suite for CommunicationBridge functionality"""
    
    @pytest.fixture
    async def comm_bridge(self):
        """Create test communication bridge"""
        bridge = CommunicationBridge(max_message_history=100)
        await bridge.start()
        yield bridge
        await bridge.stop()
    
    @pytest.fixture
    def sample_message(self):
        """Create sample agent message"""
        return AgentMessage(
            message_id="test_msg_001",
            from_agent="agent1",
            to_agent="agent2",
            message_type=MessageType.DIRECT_MESSAGE,
            content="Hello agent2!",
            priority=MessagePriority.NORMAL
        )
    
    @pytest.mark.asyncio
    async def test_bridge_initialization(self):
        """Test communication bridge initialization"""
        bridge = CommunicationBridge(max_message_history=50)
        
        assert len(bridge.agent_queues) == 0
        assert len(bridge.message_handlers) == 0
        assert len(bridge.active_agent_sessions) == 0
        assert bridge.max_message_history == 50
        
        await bridge.start()
        await bridge.stop()
    
    @pytest.mark.asyncio
    async def test_agent_registration(self, comm_bridge):
        """Test agent registration and unregistration"""
        # Register agent
        await comm_bridge.register_agent("test_agent")
        
        assert "test_agent" in comm_bridge.agent_queues
        assert "test_agent" in comm_bridge.active_agent_sessions
        
        # Unregister agent
        await comm_bridge.unregister_agent("test_agent")
        
        assert "test_agent" not in comm_bridge.agent_queues
        assert "test_agent" not in comm_bridge.active_agent_sessions
    
    @pytest.mark.asyncio
    async def test_message_handler_registration(self, comm_bridge):
        """Test message handler registration"""
        # Register agent first
        await comm_bridge.register_agent("test_agent")
        
        # Create handler callback
        def test_handler(message):
            pass
        
        # Register handler
        handler_id = comm_bridge.register_message_handler(
            agent_id="test_agent",
            message_type=MessageType.DIRECT_MESSAGE,
            callback=test_handler,
            priority=1
        )
        
        # Verify handler registered
        assert handler_id.startswith("test_agent_direct_message_")
        assert len(comm_bridge.message_handlers["test_agent"]) == 1
        
        handler = comm_bridge.message_handlers["test_agent"][0]
        assert handler.message_type == MessageType.DIRECT_MESSAGE
        assert handler.callback == test_handler
        assert handler.priority == 1
        
        # Unregister handler
        comm_bridge.unregister_message_handler(handler_id)
        assert len(comm_bridge.message_handlers["test_agent"]) == 0
    
    @pytest.mark.asyncio
    async def test_direct_message_sending(self, comm_bridge, sample_message):
        """Test direct message sending"""
        # Register agents
        await comm_bridge.register_agent("agent1")
        await comm_bridge.register_agent("agent2")
        
        # Send message
        success = await comm_bridge.send_message(sample_message)
        assert success is True
        
        # Verify message was queued for recipient
        assert comm_bridge.agent_queues["agent2"].qsize() == 1
        assert sample_message in comm_bridge.message_history
    
    @pytest.mark.asyncio
    async def test_broadcast_message_sending(self, comm_bridge):
        """Test broadcast message sending"""
        # Register multiple agents
        agents = ["agent1", "agent2", "agent3"]
        for agent in agents:
            await comm_bridge.register_agent(agent)
        
        # Create broadcast message
        broadcast_msg = AgentMessage(
            message_id="broadcast_001",
            from_agent="agent1",
            to_agent=None,  # Broadcast has no specific target
            message_type=MessageType.BROADCAST,
            content="Broadcast to all!",
            routing_strategy=RoutingStrategy.BROADCAST
        )
        
        # Send broadcast
        success = await comm_bridge.send_message(broadcast_msg)
        assert success is True
        
        # Verify all agents received the message
        for agent in agents:
            assert comm_bridge.agent_queues[agent].qsize() == 1
    
    @pytest.mark.asyncio
    async def test_message_priority_ordering(self, comm_bridge):
        """Test message priority ordering in queues"""
        # Register agent
        await comm_bridge.register_agent("test_agent")
        
        # Send messages with different priorities
        low_msg = AgentMessage(
            message_id="low_priority",
            from_agent="sender",
            to_agent="test_agent",
            message_type=MessageType.DIRECT_MESSAGE,
            content="Low priority",
            priority=MessagePriority.LOW
        )
        
        high_msg = AgentMessage(
            message_id="high_priority", 
            from_agent="sender",
            to_agent="test_agent",
            message_type=MessageType.DIRECT_MESSAGE,
            content="High priority",
            priority=MessagePriority.HIGH
        )
        
        # Send low priority first, then high priority
        await comm_bridge.send_message(low_msg)
        await comm_bridge.send_message(high_msg)
        
        # Receive messages - should get high priority first
        messages = await comm_bridge.receive_messages("test_agent", max_messages=2)
        assert len(messages) == 2
        assert messages[0].message_id == "high_priority"
        assert messages[1].message_id == "low_priority"
    
    @pytest.mark.asyncio
    async def test_request_response_pattern(self, comm_bridge):
        """Test request-response messaging pattern"""
        # Register agents
        await comm_bridge.register_agent("requester")
        await comm_bridge.register_agent("responder")
        
        # Create request message
        request_msg = AgentMessage(
            message_id="request_001",
            from_agent="requester",
            to_agent="responder",
            message_type=MessageType.COORDINATION_REQUEST,
            content="Please process this",
            requires_response=True,
            response_timeout=5.0
        )
        
        # Send request
        await comm_bridge.send_message(request_msg)
        
        # Verify request is tracked for response
        assert request_msg.message_id in comm_bridge.pending_responses
        
        # Simulate responder sending response
        success = await comm_bridge.send_response(
            request_msg,
            "Processing complete",
            {"status": "success"}
        )
        assert success is True
        
        # Wait for response
        response = await comm_bridge.wait_for_response(request_msg.message_id, timeout=1.0)
        
        assert response.content == "Processing complete"
        assert response.parent_message_id == request_msg.message_id
        assert response.metadata["status"] == "success"
    
    @pytest.mark.asyncio
    async def test_response_timeout(self, comm_bridge):
        """Test response timeout handling"""
        # Register agents
        await comm_bridge.register_agent("requester")
        await comm_bridge.register_agent("responder")
        
        # Create request with short timeout
        request_msg = AgentMessage(
            message_id="timeout_request",
            from_agent="requester", 
            to_agent="responder",
            message_type=MessageType.COORDINATION_REQUEST,
            content="This will timeout",
            requires_response=True,
            response_timeout=0.1  # Very short timeout
        )
        
        # Send request
        await comm_bridge.send_message(request_msg)
        
        # Wait for response - should timeout
        with pytest.raises(TimeoutError):
            await comm_bridge.wait_for_response(request_msg.message_id, timeout=1.0)
    
    @pytest.mark.asyncio
    async def test_load_balanced_routing(self, comm_bridge):
        """Test load-balanced message routing"""
        # Register multiple agents
        agents = ["worker1", "worker2", "worker3"]
        for agent in agents:
            await comm_bridge.register_agent(agent)
        
        # Create load-balanced message
        lb_msg = AgentMessage(
            message_id="load_balanced",
            from_agent="manager",
            to_agent=None,
            message_type=MessageType.TASK_ASSIGNMENT,
            content="Distribute this task",
            routing_strategy=RoutingStrategy.LOAD_BALANCED
        )
        
        # Send message
        await comm_bridge.send_message(lb_msg)
        
        # Verify only one agent received the message (least loaded)
        total_messages = sum(queue.qsize() for queue in comm_bridge.agent_queues.values())
        assert total_messages == 1
    
    @pytest.mark.asyncio
    async def test_round_robin_routing(self, comm_bridge):
        """Test round-robin message routing"""
        # Register sender and multiple receivers
        await comm_bridge.register_agent("sender")
        receivers = ["receiver1", "receiver2", "receiver3"]
        for receiver in receivers:
            await comm_bridge.register_agent(receiver)
        
        # Send multiple messages with round-robin routing
        for i in range(6):  # 2 rounds through 3 agents
            rr_msg = AgentMessage(
                message_id=f"round_robin_{i}",
                from_agent="sender",
                to_agent=None,
                message_type=MessageType.TASK_ASSIGNMENT,
                content=f"Task {i}",
                routing_strategy=RoutingStrategy.ROUND_ROBIN
            )
            await comm_bridge.send_message(rr_msg)
        
        # Verify each receiver got exactly 2 messages
        for receiver in receivers:
            assert comm_bridge.agent_queues[receiver].qsize() == 2
    
    @pytest.mark.asyncio
    async def test_message_handler_execution(self, comm_bridge):
        """Test message handler execution"""
        # Register agent
        await comm_bridge.register_agent("test_agent")
        
        # Create handler that tracks calls
        handler_calls = []
        
        def message_handler(message):
            handler_calls.append(message)
        
        # Register handler
        comm_bridge.register_message_handler(
            agent_id="test_agent",
            message_type=MessageType.DIRECT_MESSAGE,
            callback=message_handler,
            is_async=False
        )
        
        # Send message
        test_msg = AgentMessage(
            message_id="handler_test",
            from_agent="sender",
            to_agent="test_agent", 
            message_type=MessageType.DIRECT_MESSAGE,
            content="Test handler execution"
        )
        await comm_bridge.send_message(test_msg)
        
        # Receive messages (triggers handlers)
        await comm_bridge.receive_messages("test_agent", max_messages=1)
        
        # Verify handler was called
        assert len(handler_calls) == 1
        assert handler_calls[0].message_id == "handler_test"
    
    @pytest.mark.asyncio
    async def test_async_message_handler(self, comm_bridge):
        """Test async message handler execution"""
        # Register agent
        await comm_bridge.register_agent("test_agent")
        
        # Create async handler
        handler_calls = []
        
        async def async_handler(message):
            await asyncio.sleep(0.01)  # Simulate async work
            handler_calls.append(message)
        
        # Register async handler
        comm_bridge.register_message_handler(
            agent_id="test_agent",
            message_type=MessageType.STATUS_UPDATE,
            callback=async_handler,
            is_async=True
        )
        
        # Send message
        test_msg = AgentMessage(
            message_id="async_handler_test",
            from_agent="sender",
            to_agent="test_agent",
            message_type=MessageType.STATUS_UPDATE,
            content="Test async handler"
        )
        await comm_bridge.send_message(test_msg)
        
        # Receive messages (triggers async handlers)
        await comm_bridge.receive_messages("test_agent", max_messages=1)
        
        # Allow time for async handler to complete
        await asyncio.sleep(0.1)
        
        # Verify async handler was called
        assert len(handler_calls) == 1
        assert handler_calls[0].message_id == "async_handler_test"
    
    @pytest.mark.asyncio
    async def test_message_history(self, comm_bridge, sample_message):
        """Test message history tracking"""
        # Register agents
        await comm_bridge.register_agent("agent1")
        await comm_bridge.register_agent("agent2")
        
        # Send several messages
        messages_sent = []
        for i in range(5):
            msg = AgentMessage(
                message_id=f"history_test_{i}",
                from_agent="agent1",
                to_agent="agent2",
                message_type=MessageType.DIRECT_MESSAGE,
                content=f"Message {i}"
            )
            await comm_bridge.send_message(msg)
            messages_sent.append(msg)
        
        # Get message history
        history = comm_bridge.get_message_history()
        
        # Verify all messages are in history
        assert len(history) == 5
        for msg in messages_sent:
            assert msg in history
    
    @pytest.mark.asyncio
    async def test_message_history_filtering(self, comm_bridge):
        """Test message history filtering by agent and type"""
        # Register agents
        await comm_bridge.register_agent("agent1")
        await comm_bridge.register_agent("agent2")
        await comm_bridge.register_agent("agent3")
        
        # Send messages of different types between different agents
        status_msg = AgentMessage(
            message_id="status_msg",
            from_agent="agent1",
            to_agent="agent2",
            message_type=MessageType.STATUS_UPDATE,
            content="Status update"
        )
        
        task_msg = AgentMessage(
            message_id="task_msg",
            from_agent="agent2",
            to_agent="agent3", 
            message_type=MessageType.TASK_ASSIGNMENT,
            content="Task assignment"
        )
        
        direct_msg = AgentMessage(
            message_id="direct_msg",
            from_agent="agent1",
            to_agent="agent3",
            message_type=MessageType.DIRECT_MESSAGE,
            content="Direct message"
        )
        
        for msg in [status_msg, task_msg, direct_msg]:
            await comm_bridge.send_message(msg)
        
        # Filter by agent
        agent1_history = comm_bridge.get_message_history(agent_id="agent1")
        assert len(agent1_history) == 2  # status_msg and direct_msg (from agent1)
        
        # Filter by message type
        status_history = comm_bridge.get_message_history(message_type=MessageType.STATUS_UPDATE)
        assert len(status_history) == 1
        assert status_history[0].message_id == "status_msg"
    
    @pytest.mark.asyncio
    async def test_convenience_methods(self, comm_bridge):
        """Test convenience methods for common messaging patterns"""
        # Register agents
        await comm_bridge.register_agent("manager")
        await comm_bridge.register_agent("worker")
        await comm_bridge.register_agent("observer")
        
        # Test task assignment
        task_id = await comm_bridge.send_task_assignment(
            from_agent="manager",
            to_agent="worker", 
            task_description="Complete this task",
            task_metadata={"priority": "high"}
        )
        assert task_id.startswith("task_")
        
        # Test status update
        await comm_bridge.send_status_update(
            from_agent="worker",
            to_agent="manager",
            status="in_progress",
            details={"completion": 50}
        )
        
        # Test broadcast notification
        await comm_bridge.broadcast_notification(
            from_agent="manager",
            notification="System maintenance in 1 hour",
            metadata={"type": "maintenance"}
        )
        
        # Verify messages were sent
        manager_messages = await comm_bridge.receive_messages("manager", max_messages=10)
        worker_messages = await comm_bridge.receive_messages("worker", max_messages=10) 
        observer_messages = await comm_bridge.receive_messages("observer", max_messages=10)
        
        # Manager should receive status update
        assert len(manager_messages) == 1
        assert manager_messages[0].message_type == MessageType.STATUS_UPDATE
        
        # Worker should receive task assignment and broadcast
        assert len(worker_messages) == 2
        message_types = [msg.message_type for msg in worker_messages]
        assert MessageType.TASK_ASSIGNMENT in message_types
        assert MessageType.BROADCAST in message_types
        
        # Observer should receive broadcast only
        assert len(observer_messages) == 1
        assert observer_messages[0].message_type == MessageType.BROADCAST
    
    @pytest.mark.asyncio
    async def test_communication_stats(self, comm_bridge):
        """Test communication system statistics"""
        # Register agents and send messages
        await comm_bridge.register_agent("agent1")
        await comm_bridge.register_agent("agent2")
        
        # Register handler
        comm_bridge.register_message_handler(
            agent_id="agent1",
            message_type=MessageType.DIRECT_MESSAGE,
            callback=lambda msg: None
        )
        
        # Send messages
        for i in range(3):
            msg = AgentMessage(
                message_id=f"stats_test_{i}",
                from_agent="agent1",
                to_agent="agent2",
                message_type=MessageType.DIRECT_MESSAGE,
                content=f"Message {i}"
            )
            await comm_bridge.send_message(msg)
        
        # Get stats
        stats = comm_bridge.get_communication_stats()
        
        # Verify stats
        assert stats['active_agents'] == 2
        assert stats['total_queued_messages'] == 3
        assert stats['message_history_length'] == 3
        assert stats['registered_handlers'] == 1
        assert stats['message_counts_by_type']['direct_message'] == 3
    
    @pytest.mark.asyncio
    async def test_message_serialization(self, sample_message):
        """Test message serialization and deserialization"""
        # Convert to dict
        msg_dict = sample_message.to_dict()
        
        # Verify dict structure
        assert msg_dict['message_id'] == sample_message.message_id
        assert msg_dict['from_agent'] == sample_message.from_agent
        assert msg_dict['to_agent'] == sample_message.to_agent
        assert msg_dict['message_type'] == sample_message.message_type.value
        assert msg_dict['content'] == sample_message.content
        
        # Convert back from dict
        reconstructed_msg = AgentMessage.from_dict(msg_dict)
        
        # Verify reconstruction
        assert reconstructed_msg.message_id == sample_message.message_id
        assert reconstructed_msg.from_agent == sample_message.from_agent
        assert reconstructed_msg.to_agent == sample_message.to_agent
        assert reconstructed_msg.message_type == sample_message.message_type
        assert reconstructed_msg.content == sample_message.content


if __name__ == "__main__":
    pytest.main([__file__, "-v"])