#!/usr/bin/env python3
"""
Unit tests for AgentPool

Tests advanced resource pooling, scaling, and load balancing functionality.
"""

import asyncio
import pytest
import time
from unittest.mock import Mock, AsyncMock, patch

# Import classes under test
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from multi_agent_wrapper.agent_pool import (
    AgentPool, PoolConfig, LoadBalanceStrategy, PoolMetrics, PoolScaleDirection
)
from multi_agent_wrapper import (
    MultiAgentCLIWrapper, AgentConfig, AgentRole, AgentStatus, MultiAgentConfig
)


class TestAgentPool:
    """Test suite for AgentPool functionality"""
    
    @pytest.fixture
    async def mock_multi_agent(self):
        """Create mock MultiAgentCLIWrapper"""
        mock_wrapper = Mock(spec=MultiAgentCLIWrapper)
        
        # Mock list_agents to return test agents
        mock_agent_info = Mock()
        mock_agent_info.status = AgentStatus.IDLE
        mock_agent_info.config.agent_id = "test_agent"
        mock_agent_info.config.role = AgentRole.WORKER
        
        mock_wrapper.list_agents.return_value = [mock_agent_info]
        
        # Mock execute_task as async generator
        async def mock_execute_task(agent_id, prompt, task_id):
            yield Mock(type="result", content="Task completed")
        
        mock_wrapper.execute_task = mock_execute_task
        
        # Mock create/start/remove agent methods
        mock_wrapper.create_agent = AsyncMock(return_value="new_agent")
        mock_wrapper.start_agent = AsyncMock(return_value=True)
        mock_wrapper.remove_agent = AsyncMock(return_value=True)
        
        return mock_wrapper
    
    @pytest.fixture
    def pool_config(self):
        """Create test pool configuration"""
        return PoolConfig(
            min_agents=1,
            max_agents=3,
            scale_up_threshold=0.8,
            scale_down_threshold=0.3,
            scale_cooldown_seconds=1.0,  # Fast for testing
            enable_auto_scaling=True,
            enable_load_balancing=True,
            load_balance_strategy=LoadBalanceStrategy.LEAST_BUSY
        )
    
    @pytest.fixture
    async def agent_pool(self, mock_multi_agent, pool_config):
        """Create test agent pool"""
        pool = AgentPool(mock_multi_agent, pool_config)
        yield pool
        await pool.stop()
    
    @pytest.mark.asyncio
    async def test_pool_initialization(self, mock_multi_agent, pool_config):
        """Test pool initialization"""
        pool = AgentPool(mock_multi_agent, pool_config)
        
        assert pool.multi_agent == mock_multi_agent
        assert pool.config == pool_config
        assert pool.task_queue.maxsize == pool_config.max_queue_size
        assert len(pool.agent_task_counts) == 0
        
        await pool.stop()
    
    @pytest.mark.asyncio
    async def test_pool_start_stop(self, agent_pool):
        """Test pool start and stop lifecycle"""
        # Start pool
        await agent_pool.start()
        
        # Verify background tasks are running
        assert agent_pool.metrics_task is not None
        assert agent_pool.task_processor_task is not None
        
        # Stop pool
        await agent_pool.stop()
        
        # Verify tasks are cancelled
        if agent_pool.metrics_task:
            assert agent_pool.metrics_task.cancelled() or agent_pool.metrics_task.done()
    
    @pytest.mark.asyncio
    async def test_submit_task(self, agent_pool):
        """Test task submission to pool"""
        # Submit task
        task_id = await agent_pool.submit_task("Test task", priority=1)
        
        # Verify task was queued
        assert task_id.startswith("pool_task_")
        assert agent_pool.task_queue.qsize() == 1
        
        # Get task from queue to verify content
        priority, timestamp, task_info = await agent_pool.task_queue.get()
        assert priority == -1  # Negative for priority ordering
        assert task_info['prompt'] == "Test task"
        assert task_info['task_id'] == task_id
    
    @pytest.mark.asyncio
    async def test_submit_task_with_priority(self, agent_pool):
        """Test task submission with different priorities"""
        # Submit tasks with different priorities
        task1_id = await agent_pool.submit_task("Low priority", priority=1)
        task2_id = await agent_pool.submit_task("High priority", priority=5)
        task3_id = await agent_pool.submit_task("Medium priority", priority=3)
        
        assert agent_pool.task_queue.qsize() == 3
        
        # Verify tasks are ordered by priority (highest first)
        priority1, _, task_info1 = await agent_pool.task_queue.get()
        priority2, _, task_info2 = await agent_pool.task_queue.get()
        priority3, _, task_info3 = await agent_pool.task_queue.get()
        
        assert task_info1['task_id'] == task2_id  # High priority first
        assert task_info2['task_id'] == task3_id  # Medium priority second
        assert task_info3['task_id'] == task1_id  # Low priority last
    
    @pytest.mark.asyncio
    async def test_task_queue_full(self, agent_pool):
        """Test task rejection when queue is full"""
        # Fill the queue (default max_queue_size is 100)
        agent_pool.task_queue._maxsize = 2  # Set small limit for testing
        
        # Submit tasks to fill queue
        await agent_pool.submit_task("Task 1")
        await agent_pool.submit_task("Task 2")
        
        # Third task should fail
        with pytest.raises(RuntimeError, match="Task queue is full"):
            await agent_pool.submit_task("Task 3")
    
    @pytest.mark.asyncio
    async def test_get_metrics(self, mock_multi_agent, pool_config):
        """Test metrics collection"""
        pool = AgentPool(mock_multi_agent, pool_config)
        
        # Add some task history
        pool.task_history = [
            ("agent1", time.time() - 60, 10.0),
            ("agent1", time.time() - 30, 15.0),
            ("agent2", time.time() - 20, 8.0)
        ]
        
        # Add some queued tasks
        await pool.submit_task("Test task 1")
        await pool.submit_task("Test task 2")
        
        # Get metrics
        metrics = await pool.get_metrics()
        
        # Verify metrics
        assert isinstance(metrics, PoolMetrics)
        assert metrics.total_agents == 1  # Mock returns 1 agent
        assert metrics.idle_agents == 1
        assert metrics.busy_agents == 0
        assert metrics.total_tasks_completed == 3  # From task_history
        assert metrics.average_task_duration == 11.0  # (10 + 15 + 8) / 3
        assert metrics.queue_length == 2
        
        await pool.stop()
    
    @pytest.mark.asyncio
    async def test_load_balancing_least_busy(self, agent_pool):
        """Test least busy load balancing strategy"""
        # Mock multiple available agents with different task counts
        agent1 = Mock()
        agent1.status = AgentStatus.IDLE
        agent1.config.agent_id = "agent1"
        agent1.config.role = AgentRole.WORKER
        
        agent2 = Mock()
        agent2.status = AgentStatus.IDLE
        agent2.config.agent_id = "agent2"
        agent2.config.role = AgentRole.WORKER
        
        agent_pool.multi_agent.list_agents.return_value = [agent1, agent2]
        
        # Set different task counts
        agent_pool.agent_task_counts = {"agent1": 3, "agent2": 1}
        
        # Select agent (should pick agent2 with lower count)
        selected_agent = await agent_pool._select_agent()
        assert selected_agent == "agent2"
    
    @pytest.mark.asyncio
    async def test_load_balancing_round_robin(self, pool_config):
        """Test round robin load balancing strategy"""
        pool_config.load_balance_strategy = LoadBalanceStrategy.ROUND_ROBIN
        
        # Create pool with round robin strategy
        mock_multi_agent = Mock(spec=MultiAgentCLIWrapper)
        
        agent1 = Mock()
        agent1.status = AgentStatus.IDLE
        agent1.config.agent_id = "agent1"
        
        agent2 = Mock()
        agent2.status = AgentStatus.IDLE
        agent2.config.agent_id = "agent2"
        
        mock_multi_agent.list_agents.return_value = [agent1, agent2]
        
        pool = AgentPool(mock_multi_agent, pool_config)
        
        # Select agents multiple times
        selected1 = await pool._select_agent()
        selected2 = await pool._select_agent()
        selected3 = await pool._select_agent()
        
        # Should rotate between agents
        assert selected1 == "agent1"
        assert selected2 == "agent2"
        assert selected3 == "agent1"  # Back to first
        
        await pool.stop()
    
    @pytest.mark.asyncio
    async def test_ensure_min_agents(self, mock_multi_agent, pool_config):
        """Test ensuring minimum number of agents"""
        # Set up mock to show no idle agents initially
        mock_multi_agent.list_agents.return_value = []
        
        pool = AgentPool(mock_multi_agent, pool_config)
        
        # Call ensure min agents
        await pool._ensure_min_agents()
        
        # Verify create_agent and start_agent were called
        mock_multi_agent.create_agent.assert_called()
        mock_multi_agent.start_agent.assert_called()
        
        await pool.stop()
    
    @pytest.mark.asyncio
    async def test_auto_scaling_up(self, mock_multi_agent, pool_config):
        """Test automatic scaling up"""
        # Create busy agents to trigger scale up
        busy_agent = Mock()
        busy_agent.status = AgentStatus.BUSY
        busy_agent.config.agent_id = "busy_agent"
        
        mock_multi_agent.list_agents.return_value = [busy_agent]
        
        pool = AgentPool(mock_multi_agent, pool_config)
        
        # Add tasks to queue to simulate high load
        for i in range(6):  # More than scale_up threshold
            await pool.submit_task(f"Task {i}")
        
        # Manually trigger scaling check
        await pool._check_scaling_needs()
        
        # Verify scale up was attempted
        mock_multi_agent.create_agent.assert_called()
        mock_multi_agent.start_agent.assert_called()
        
        await pool.stop()
    
    @pytest.mark.asyncio
    async def test_auto_scaling_down(self, mock_multi_agent, pool_config):
        """Test automatic scaling down"""
        # Create multiple idle agents
        agents = []
        for i in range(3):
            agent = Mock()
            agent.status = AgentStatus.IDLE
            agent.config.agent_id = f"agent_{i}"
            agents.append(agent)
        
        mock_multi_agent.list_agents.return_value = agents
        
        pool = AgentPool(mock_multi_agent, pool_config)
        
        # Set low task counts to trigger scale down
        pool.agent_task_counts = {f"agent_{i}": 0 for i in range(3)}
        
        # Manually trigger scaling check
        await pool._check_scaling_needs()
        
        # Verify scale down was attempted
        mock_multi_agent.remove_agent.assert_called()
        
        await pool.stop()
    
    @pytest.mark.asyncio
    async def test_task_execution_tracking(self, mock_multi_agent, pool_config):
        """Test task execution and history tracking"""
        pool = AgentPool(mock_multi_agent, pool_config)
        
        # Execute a pooled task
        task_info = {
            'task_id': 'test_task',
            'prompt': 'Test prompt',
            'timeout': 60
        }
        
        await pool._execute_pooled_task("test_agent", task_info)
        
        # Verify task history was updated
        assert len(pool.task_history) == 1
        agent_id, start_time, duration = pool.task_history[0]
        assert agent_id == "test_agent"
        assert duration > 0
        
        await pool.stop()
    
    @pytest.mark.asyncio
    async def test_task_timeout_handling(self, mock_multi_agent, pool_config):
        """Test task timeout handling"""
        # Mock execute_task to hang indefinitely
        async def hanging_execute_task(agent_id, prompt, task_id):
            await asyncio.sleep(10)  # Longer than test timeout
            yield Mock(type="result", content="Should not reach here")
        
        mock_multi_agent.execute_task = hanging_execute_task
        
        pool = AgentPool(mock_multi_agent, pool_config)
        
        # Execute task with short timeout
        task_info = {
            'task_id': 'timeout_task',
            'prompt': 'Test prompt',
            'timeout': 0.1  # Very short timeout
        }
        
        # Task should timeout and not crash
        await pool._execute_pooled_task("test_agent", task_info)
        
        # Task should be removed from active tasks even on timeout
        assert 'timeout_task' not in pool.active_tasks
        
        await pool.stop()
    
    @pytest.mark.asyncio
    async def test_get_task_status(self, agent_pool):
        """Test getting task status"""
        # Add a mock active task
        mock_task = Mock()
        mock_task.done.return_value = False
        agent_pool.active_tasks['test_task'] = mock_task
        
        # Get task status
        status = agent_pool.get_task_status('test_task')
        
        # Verify status
        assert status is not None
        assert status['task_id'] == 'test_task'
        assert status['status'] == 'running'
        assert status['done'] is False
        
        # Test nonexistent task
        status = agent_pool.get_task_status('nonexistent')
        assert status is None
    
    @pytest.mark.asyncio
    async def test_wait_for_task(self, agent_pool):
        """Test waiting for task completion"""
        # Create a mock task that completes quickly
        mock_task = Mock()
        
        async def complete_soon():
            await asyncio.sleep(0.1)
            return "completed"
        
        mock_task.__await__ = complete_soon().__await__
        agent_pool.active_tasks['test_task'] = mock_task
        
        # Wait for task with timeout
        success = await agent_pool.wait_for_task('test_task', timeout=1.0)
        assert success is True
    
    @pytest.mark.asyncio
    async def test_wait_for_task_timeout(self, agent_pool):
        """Test waiting for task with timeout"""
        # Create a mock task that never completes
        mock_task = Mock()
        
        async def never_complete():
            await asyncio.sleep(10)  # Longer than timeout
            return "should not reach"
        
        mock_task.__await__ = never_complete().__await__
        agent_pool.active_tasks['test_task'] = mock_task
        
        # Wait for task with short timeout
        success = await agent_pool.wait_for_task('test_task', timeout=0.1)
        assert success is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])