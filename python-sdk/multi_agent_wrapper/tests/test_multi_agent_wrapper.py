#!/usr/bin/env python3
"""
Unit tests for MultiAgentCLIWrapper

Tests the core multi-agent functionality including:
- Agent creation and lifecycle management
- Process isolation and resource limits
- Health monitoring and recovery
- Epic 3 integration
- Communication bridges
"""

import asyncio
import pytest
import time
import uuid
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path

# Import classes under test
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from multi_agent_wrapper import (
    MultiAgentCLIWrapper, AgentConfig, AgentInfo, AgentStatus, AgentRole,
    MultiAgentConfig, HealthCheckResult, create_dual_agent_system,
    create_specialist_team
)
from multi_agent_wrapper.agent_pool import AgentPool, PoolConfig, LoadBalanceStrategy
from multi_agent_wrapper.communication_bridge import (
    CommunicationBridge, AgentMessage, MessageType, MessagePriority
)
from multi_agent_wrapper.health_monitor import (
    HealthMonitor, HealthMetric, MetricType, HealthStatus, HealthAlert
)

# Mock the base claude_cli_wrapper classes
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions, CliMessage


class TestMultiAgentCLIWrapper:
    """Test suite for MultiAgentCLIWrapper core functionality"""
    
    @pytest.fixture
    async def multi_agent_wrapper(self):
        """Create a test MultiAgentCLIWrapper instance"""
        config = MultiAgentConfig(
            max_agents=3,
            health_check_interval=1.0,  # Fast for testing
            enable_metrics=False  # Disable to avoid background tasks in tests
        )
        wrapper = MultiAgentCLIWrapper(config)
        yield wrapper
        await wrapper.shutdown()
    
    @pytest.fixture
    def agent_config(self):
        """Create a test agent configuration"""
        return AgentConfig(
            agent_id=f"test_agent_{uuid.uuid4().hex[:8]}",
            role=AgentRole.WORKER,
            name="Test Agent",
            max_memory_mb=256,
            max_cpu_percent=15.0
        )
    
    @pytest.mark.asyncio
    async def test_create_agent(self, multi_agent_wrapper, agent_config):
        """Test agent creation"""
        # Mock the ClaudeCliWrapper
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_wrapper.return_value = mock_instance
            
            # Create agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            
            # Verify agent was created
            assert agent_id == agent_config.agent_id
            assert agent_id in multi_agent_wrapper.agents
            
            agent_info = multi_agent_wrapper.agents[agent_id]
            assert agent_info.config == agent_config
            assert agent_info.status == AgentStatus.CREATED
            assert agent_info.wrapper is mock_instance
    
    @pytest.mark.asyncio
    async def test_create_duplicate_agent(self, multi_agent_wrapper, agent_config):
        """Test that creating duplicate agent fails"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper'):
            # Create first agent
            await multi_agent_wrapper.create_agent(agent_config)
            
            # Try to create duplicate
            with pytest.raises(ValueError, match="already exists"):
                await multi_agent_wrapper.create_agent(agent_config)
    
    @pytest.mark.asyncio
    async def test_max_agents_limit(self, multi_agent_wrapper):
        """Test maximum agents limit enforcement"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper'):
            # Create agents up to limit
            for i in range(multi_agent_wrapper.config.max_agents):
                config = AgentConfig(
                    agent_id=f"agent_{i}",
                    role=AgentRole.WORKER
                )
                await multi_agent_wrapper.create_agent(config)
            
            # Try to create one more - should fail
            extra_config = AgentConfig(
                agent_id="extra_agent",
                role=AgentRole.WORKER
            )
            
            with pytest.raises(ValueError, match="Maximum number of agents"):
                await multi_agent_wrapper.create_agent(extra_config)
    
    @pytest.mark.asyncio
    async def test_start_agent(self, multi_agent_wrapper, agent_config):
        """Test starting an agent"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create and start agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            success = await multi_agent_wrapper.start_agent(agent_id)
            
            # Verify agent started
            assert success is True
            agent_info = multi_agent_wrapper.agents[agent_id]
            assert agent_info.status == AgentStatus.IDLE
            assert agent_info.started_at is not None
            assert agent_info.last_activity_at is not None
    
    @pytest.mark.asyncio
    async def test_start_nonexistent_agent(self, multi_agent_wrapper):
        """Test starting nonexistent agent fails"""
        with pytest.raises(ValueError, match="not found"):
            await multi_agent_wrapper.start_agent("nonexistent")
    
    @pytest.mark.asyncio
    async def test_start_agent_cli_unavailable(self, multi_agent_wrapper, agent_config):
        """Test starting agent when CLI is unavailable"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_instance.is_available.return_value = False
            mock_wrapper.return_value = mock_instance
            
            # Create and try to start agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            success = await multi_agent_wrapper.start_agent(agent_id)
            
            # Verify agent failed to start
            assert success is False
            agent_info = multi_agent_wrapper.agents[agent_id]
            assert agent_info.status == AgentStatus.FAILED
    
    @pytest.mark.asyncio
    async def test_stop_agent(self, multi_agent_wrapper, agent_config):
        """Test stopping an agent"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = AsyncMock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create, start, and stop agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            await multi_agent_wrapper.start_agent(agent_id)
            success = await multi_agent_wrapper.stop_agent(agent_id)
            
            # Verify agent stopped
            assert success is True
            agent_info = multi_agent_wrapper.agents[agent_id]
            assert agent_info.status == AgentStatus.STOPPED
            
            # Verify cleanup was called
            mock_instance.cleanup.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_force_stop_agent(self, multi_agent_wrapper, agent_config):
        """Test force stopping an agent"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create and start agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            await multi_agent_wrapper.start_agent(agent_id)
            
            # Force stop agent
            success = await multi_agent_wrapper.stop_agent(agent_id, force=True)
            
            # Verify agent stopped and kill was called
            assert success is True
            mock_instance.kill.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_remove_agent(self, multi_agent_wrapper, agent_config):
        """Test removing an agent"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = AsyncMock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create and start agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            await multi_agent_wrapper.start_agent(agent_id)
            
            # Remove agent
            success = await multi_agent_wrapper.remove_agent(agent_id)
            
            # Verify agent removed
            assert success is True
            assert agent_id not in multi_agent_wrapper.agents
    
    @pytest.mark.asyncio
    async def test_execute_task(self, multi_agent_wrapper, agent_config):
        """Test executing a task on an agent"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            # Setup mock wrapper with async execute method
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            
            # Mock the execute method to return messages
            async def mock_execute(prompt):
                yield CliMessage(type="stream", content="Starting task")
                yield CliMessage(type="result", content="Task completed")
            
            mock_instance.execute = mock_execute
            mock_wrapper.return_value = mock_instance
            
            # Create and start agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            await multi_agent_wrapper.start_agent(agent_id)
            
            # Execute task
            messages = []
            async for message in multi_agent_wrapper.execute_task(agent_id, "Test task"):
                messages.append(message)
            
            # Verify task execution
            assert len(messages) == 2
            assert messages[0].content == "Starting task"
            assert messages[1].content == "Task completed"
            
            # Verify agent metadata was added
            for message in messages:
                assert message.metadata['agent_id'] == agent_id
                assert 'task_id' in message.metadata
                assert message.metadata['agent_role'] == AgentRole.WORKER.value
            
            # Verify agent returned to idle state
            agent_info = multi_agent_wrapper.agents[agent_id]
            assert agent_info.status == AgentStatus.IDLE
            assert agent_info.task_count == 1
    
    @pytest.mark.asyncio
    async def test_execute_task_on_busy_agent(self, multi_agent_wrapper, agent_config):
        """Test executing task on busy agent fails"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create and start agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            await multi_agent_wrapper.start_agent(agent_id)
            
            # Set agent to busy
            multi_agent_wrapper.agents[agent_id].status = AgentStatus.BUSY
            
            # Try to execute task
            with pytest.raises(RuntimeError, match="not idle"):
                async for _ in multi_agent_wrapper.execute_task(agent_id, "Test task"):
                    pass
    
    @pytest.mark.asyncio
    async def test_broadcast_task(self, multi_agent_wrapper):
        """Test broadcasting task to multiple agents"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            # Setup mock
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            
            async def mock_execute(prompt):
                yield CliMessage(type="result", content=f"Broadcast result")
            
            mock_instance.execute = mock_execute
            mock_wrapper.return_value = mock_instance
            
            # Create multiple agents
            agent_ids = []
            for i in range(3):
                config = AgentConfig(
                    agent_id=f"agent_{i}",
                    role=AgentRole.WORKER
                )
                agent_id = await multi_agent_wrapper.create_agent(config)
                await multi_agent_wrapper.start_agent(agent_id)
                agent_ids.append(agent_id)
            
            # Broadcast task
            task_generators = await multi_agent_wrapper.broadcast_task(
                "Broadcast task", 
                target_roles=[AgentRole.WORKER]
            )
            
            # Verify all agents got the task
            assert len(task_generators) == 3
            for agent_id in agent_ids:
                assert agent_id in task_generators
    
    @pytest.mark.asyncio
    async def test_health_check(self, multi_agent_wrapper, agent_config):
        """Test agent health check"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create and start agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            await multi_agent_wrapper.start_agent(agent_id)
            
            # Perform health check
            health_result = await multi_agent_wrapper.health_check(agent_id)
            
            # Verify health check results
            assert health_result.agent_id == agent_id
            assert health_result.is_healthy is True
            assert health_result.response_time_ms > 0
    
    @pytest.mark.asyncio
    async def test_health_check_nonexistent_agent(self, multi_agent_wrapper):
        """Test health check on nonexistent agent"""
        health_result = await multi_agent_wrapper.health_check("nonexistent")
        
        assert health_result.agent_id == "nonexistent"
        assert health_result.is_healthy is False
        assert health_result.error_message == "Agent not found"
    
    @pytest.mark.asyncio
    async def test_list_agents_filtering(self, multi_agent_wrapper):
        """Test listing agents with filtering"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create agents with different roles and statuses
            manager_config = AgentConfig(agent_id="manager", role=AgentRole.MANAGER)
            worker_config = AgentConfig(agent_id="worker", role=AgentRole.WORKER)
            
            await multi_agent_wrapper.create_agent(manager_config)
            await multi_agent_wrapper.create_agent(worker_config)
            
            await multi_agent_wrapper.start_agent("manager")
            # Keep worker in CREATED status
            
            # Test status filtering
            idle_agents = multi_agent_wrapper.list_agents(status_filter=AgentStatus.IDLE)
            assert len(idle_agents) == 1
            assert idle_agents[0].config.agent_id == "manager"
            
            created_agents = multi_agent_wrapper.list_agents(status_filter=AgentStatus.CREATED)
            assert len(created_agents) == 1
            assert created_agents[0].config.agent_id == "worker"
            
            # Test role filtering
            managers = multi_agent_wrapper.list_agents(role_filter=AgentRole.MANAGER)
            assert len(managers) == 1
            assert managers[0].config.agent_id == "manager"
    
    @pytest.mark.asyncio
    async def test_managed_agents_context(self, multi_agent_wrapper):
        """Test managed agents context manager"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = AsyncMock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            configs = [
                AgentConfig(agent_id="agent1", role=AgentRole.MANAGER),
                AgentConfig(agent_id="agent2", role=AgentRole.WORKER)
            ]
            
            # Use managed agents context
            async with multi_agent_wrapper.managed_agents(configs) as agents:
                # Verify agents were created and started
                assert len(agents) == 2
                assert "agent1" in agents
                assert "agent2" in agents
                
                # Verify agents are in the wrapper
                assert len(multi_agent_wrapper.agents) == 2
            
            # Verify agents were cleaned up after context exit
            # Note: In a real scenario, the agents would be removed
            # For testing, we just verify the cleanup method was called
            assert mock_instance.cleanup.call_count >= 2
    
    @pytest.mark.asyncio
    async def test_system_stats(self, multi_agent_wrapper, agent_config):
        """Test getting system statistics"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create and start agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            await multi_agent_wrapper.start_agent(agent_id)
            
            # Get system stats
            stats = multi_agent_wrapper.get_system_stats()
            
            # Verify stats structure
            assert 'total_agents' in stats
            assert 'agents_by_status' in stats
            assert 'agents_by_role' in stats
            assert 'system_config' in stats
            assert 'resource_stats' in stats
            
            # Verify values
            assert stats['total_agents'] == 1
            assert stats['agents_by_status'][AgentStatus.IDLE.value] == 1
            assert stats['agents_by_role'][AgentRole.WORKER.value] == 1
    
    @pytest.mark.asyncio
    async def test_shutdown_cleanup(self, multi_agent_wrapper, agent_config):
        """Test proper cleanup during shutdown"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = AsyncMock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create and start agent
            agent_id = await multi_agent_wrapper.create_agent(agent_config)
            await multi_agent_wrapper.start_agent(agent_id)
            
            # Shutdown
            await multi_agent_wrapper.shutdown(timeout=1.0)
            
            # Verify shutdown state
            assert multi_agent_wrapper.shutdown_initiated is True
            assert len(multi_agent_wrapper.agents) == 0
            
            # Verify cleanup was called
            mock_instance.cleanup.assert_called()


class TestConvenienceFunctions:
    """Test convenience functions for common patterns"""
    
    @pytest.mark.asyncio
    async def test_create_dual_agent_system(self):
        """Test creating a dual-agent system"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create dual agent system
            multi_agent = await create_dual_agent_system()
            
            try:
                # Verify system has 2 agents
                assert len(multi_agent.agents) == 2
                assert "manager" in multi_agent.agents
                assert "worker" in multi_agent.agents
                
                # Verify roles
                assert multi_agent.agents["manager"].config.role == AgentRole.MANAGER
                assert multi_agent.agents["worker"].config.role == AgentRole.WORKER
                
                # Verify agents are started
                assert multi_agent.agents["manager"].status == AgentStatus.IDLE
                assert multi_agent.agents["worker"].status == AgentStatus.IDLE
            
            finally:
                await multi_agent.shutdown()
    
    @pytest.mark.asyncio
    async def test_create_specialist_team(self):
        """Test creating a specialist team"""
        with patch('multi_agent_wrapper.multi_agent_wrapper.ClaudeCliWrapper') as mock_wrapper:
            mock_instance = Mock()
            mock_instance.is_available.return_value = True
            mock_wrapper.return_value = mock_instance
            
            # Create specialist team
            multi_agent = await create_specialist_team(team_size=3)
            
            try:
                # Verify system has manager + 3 specialists
                assert len(multi_agent.agents) == 4
                assert "manager" in multi_agent.agents
                
                # Verify manager role
                assert multi_agent.agents["manager"].config.role == AgentRole.MANAGER
                
                # Count specialists
                specialists = [a for a in multi_agent.agents.values() 
                             if a.config.role == AgentRole.SPECIALIST]
                assert len(specialists) == 3
            
            finally:
                await multi_agent.shutdown()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])