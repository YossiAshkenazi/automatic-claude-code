#!/usr/bin/env python3
"""
Agent Pool - Resource management for multi-agent system

Provides advanced resource pooling, scaling, and load balancing for Claude CLI agents.
Integrates with MultiAgentCLIWrapper for efficient resource utilization.
"""

import asyncio
import time
import logging
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
from concurrent.futures import ThreadPoolExecutor

from .multi_agent_wrapper import (
    AgentConfig, AgentInfo, AgentStatus, AgentRole, MultiAgentCLIWrapper,
    HealthCheckResult
)

logger = logging.getLogger(__name__)


class LoadBalanceStrategy(Enum):
    """Load balancing strategies for task distribution"""
    ROUND_ROBIN = "round_robin"
    LEAST_BUSY = "least_busy"
    LEAST_LOADED = "least_loaded"
    ROLE_BASED = "role_based"
    RANDOM = "random"


class PoolScaleDirection(Enum):
    """Pool scaling directions"""
    UP = "up"
    DOWN = "down"
    STABLE = "stable"


@dataclass
class PoolMetrics:
    """Metrics for agent pool performance"""
    timestamp: float = field(default_factory=time.time)
    total_agents: int = 0
    idle_agents: int = 0
    busy_agents: int = 0
    failed_agents: int = 0
    average_task_duration: float = 0.0
    total_tasks_completed: int = 0
    queue_length: int = 0
    cpu_utilization: float = 0.0
    memory_utilization: float = 0.0
    recommended_scale_direction: PoolScaleDirection = PoolScaleDirection.STABLE
    recommended_scale_count: int = 0


@dataclass
class PoolConfig:
    """Configuration for agent pool"""
    min_agents: int = 1
    max_agents: int = 5
    target_idle_ratio: float = 0.2  # Keep 20% agents idle for quick response
    scale_up_threshold: float = 0.8  # Scale up when 80% busy
    scale_down_threshold: float = 0.3  # Scale down when less than 30% busy
    scale_cooldown_seconds: float = 60.0  # Wait 60s between scaling operations
    health_check_interval: float = 30.0
    enable_auto_scaling: bool = True
    enable_load_balancing: bool = True
    load_balance_strategy: LoadBalanceStrategy = LoadBalanceStrategy.LEAST_BUSY
    task_timeout_seconds: int = 600
    max_queue_size: int = 100


class AgentPool:
    """
    Advanced agent pool with auto-scaling and load balancing.
    
    Features:
    - Dynamic scaling based on workload
    - Multiple load balancing strategies
    - Health monitoring and recovery
    - Task queuing with priority
    - Resource utilization optimization
    - Comprehensive metrics collection
    """
    
    def __init__(self, multi_agent: MultiAgentCLIWrapper, config: Optional[PoolConfig] = None):
        self.multi_agent = multi_agent
        self.config = config or PoolConfig()
        self.logger = logging.getLogger(f"{__name__}.AgentPool")
        
        # Task queue management
        self.task_queue: asyncio.Queue = asyncio.Queue(maxsize=self.config.max_queue_size)
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.task_history: List[Tuple[str, float, float]] = []  # (agent_id, start_time, duration)
        
        # Load balancing state
        self.round_robin_index = 0
        self.agent_task_counts: Dict[str, int] = {}
        
        # Scaling management
        self.last_scale_time = 0.0
        self.scaling_in_progress = False
        
        # Background tasks
        self.scaling_task: Optional[asyncio.Task] = None
        self.metrics_task: Optional[asyncio.Task] = None
        self.task_processor_task: Optional[asyncio.Task] = None
        
        # Metrics tracking
        self.metrics_history: List[PoolMetrics] = []
        self.max_history_length = 100
        
        self.logger.info(f"AgentPool initialized (min: {config.min_agents}, max: {config.max_agents})")
    
    async def start(self):
        """Start the agent pool and background tasks"""
        self.logger.info("Starting agent pool")
        
        # Ensure minimum agents are available
        await self._ensure_min_agents()
        
        # Start background tasks
        if self.config.enable_auto_scaling:
            self.scaling_task = asyncio.create_task(self._auto_scaling_loop())
        
        self.metrics_task = asyncio.create_task(self._metrics_collection_loop())
        self.task_processor_task = asyncio.create_task(self._task_processor_loop())
        
        self.logger.info("Agent pool started")
    
    async def stop(self, timeout: float = 10.0):
        """Stop the agent pool and cleanup"""
        self.logger.info("Stopping agent pool")
        
        # Cancel background tasks
        tasks_to_cancel = []
        if self.scaling_task:
            tasks_to_cancel.append(self.scaling_task)
        if self.metrics_task:
            tasks_to_cancel.append(self.metrics_task)
        if self.task_processor_task:
            tasks_to_cancel.append(self.task_processor_task)
        
        for task in tasks_to_cancel:
            task.cancel()
        
        if tasks_to_cancel:
            await asyncio.wait_for(
                asyncio.gather(*tasks_to_cancel, return_exceptions=True),
                timeout=timeout / 2
            )
        
        # Cancel active tasks
        for task in list(self.active_tasks.values()):
            task.cancel()
        
        self.logger.info("Agent pool stopped")
    
    async def submit_task(self, prompt: str, priority: int = 0, 
                         preferred_role: Optional[AgentRole] = None,
                         task_timeout: Optional[int] = None) -> str:
        """
        Submit a task to the pool for execution.
        
        Args:
            prompt: Task prompt/instruction
            priority: Task priority (higher = more priority)
            preferred_role: Preferred agent role for execution
            task_timeout: Task-specific timeout override
        
        Returns:
            Task ID for tracking
        """
        task_id = f"pool_task_{int(time.time() * 1000)}_{len(self.active_tasks)}"
        
        # Create task info
        task_info = {
            'task_id': task_id,
            'prompt': prompt,
            'priority': priority,
            'preferred_role': preferred_role,
            'timeout': task_timeout or self.config.task_timeout_seconds,
            'submitted_at': time.time()
        }
        
        try:
            # Queue with priority (higher priority = lower queue value for sorting)
            await self.task_queue.put((-priority, time.time(), task_info))
            self.logger.info(f"Task queued: {task_id} (priority: {priority})")
            return task_id
        
        except asyncio.QueueFull:
            self.logger.error(f"Task queue full, rejecting task: {task_id}")
            raise RuntimeError("Task queue is full")
    
    async def _task_processor_loop(self):
        """Background task processor loop"""
        self.logger.info("Starting task processor loop")
        
        while True:
            try:
                # Get next task with priority ordering
                priority, submit_time, task_info = await self.task_queue.get()
                task_id = task_info['task_id']
                
                # Find best agent for task
                agent_id = await self._select_agent(task_info.get('preferred_role'))
                
                if not agent_id:
                    self.logger.warning(f"No available agents for task {task_id}, requeuing")
                    # Requeue with lower priority
                    await self.task_queue.put((priority - 1, submit_time, task_info))
                    await asyncio.sleep(1)
                    continue
                
                # Execute task
                task_execution = asyncio.create_task(
                    self._execute_pooled_task(agent_id, task_info)
                )
                self.active_tasks[task_id] = task_execution
                
                self.logger.info(f"Task {task_id} assigned to agent {agent_id}")
                
                # Don't await here - let task run in background
                # Task will remove itself from active_tasks when done
                
            except asyncio.CancelledError:
                self.logger.info("Task processor loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in task processor loop: {e}")
                await asyncio.sleep(1)
        
        self.logger.info("Task processor loop stopped")
    
    async def _execute_pooled_task(self, agent_id: str, task_info: Dict):
        """Execute a pooled task on specified agent"""
        task_id = task_info['task_id']
        prompt = task_info['prompt']
        timeout = task_info['timeout']
        
        start_time = time.time()
        
        try:
            # Update agent task count
            self.agent_task_counts[agent_id] = self.agent_task_counts.get(agent_id, 0) + 1
            
            # Execute with timeout
            async with asyncio.timeout(timeout):
                messages = []
                async for message in self.multi_agent.execute_task(agent_id, prompt, task_id):
                    messages.append(message)
                
                duration = time.time() - start_time
                self.task_history.append((agent_id, start_time, duration))
                
                # Keep history bounded
                if len(self.task_history) > 1000:
                    self.task_history = self.task_history[-500:]
                
                self.logger.info(f"Task {task_id} completed by {agent_id} in {duration:.2f}s")
        
        except asyncio.TimeoutError:
            self.logger.error(f"Task {task_id} timed out after {timeout}s")
        except Exception as e:
            self.logger.error(f"Task {task_id} failed: {e}")
        finally:
            # Clean up
            self.active_tasks.pop(task_id, None)
            if agent_id in self.agent_task_counts:
                self.agent_task_counts[agent_id] = max(0, self.agent_task_counts[agent_id] - 1)
    
    async def _select_agent(self, preferred_role: Optional[AgentRole] = None) -> Optional[str]:
        """Select best agent for task execution using load balancing strategy"""
        available_agents = [
            agent_info for agent_info in self.multi_agent.list_agents(status_filter=AgentStatus.IDLE)
        ]
        
        if not available_agents:
            return None
        
        # Filter by preferred role if specified
        if preferred_role:
            role_agents = [a for a in available_agents if a.config.role == preferred_role]
            if role_agents:
                available_agents = role_agents
        
        if not available_agents:
            return None
        
        # Apply load balancing strategy
        strategy = self.config.load_balance_strategy
        
        if strategy == LoadBalanceStrategy.ROUND_ROBIN:
            selected_agent = available_agents[self.round_robin_index % len(available_agents)]
            self.round_robin_index += 1
        
        elif strategy == LoadBalanceStrategy.LEAST_BUSY:
            # Select agent with lowest task count
            task_counts = [(self.agent_task_counts.get(a.config.agent_id, 0), a) for a in available_agents]
            selected_agent = min(task_counts, key=lambda x: x[0])[1]
        
        elif strategy == LoadBalanceStrategy.LEAST_LOADED:
            # Select agent with best resource utilization
            best_agent = None
            best_score = float('inf')
            
            for agent in available_agents:
                health = await self.multi_agent.health_check(agent.config.agent_id)
                # Lower resource usage = better score
                score = (health.memory_usage_mb or 0) + (health.cpu_usage_percent or 0)
                if score < best_score:
                    best_score = score
                    best_agent = agent
            
            selected_agent = best_agent or available_agents[0]
        
        elif strategy == LoadBalanceStrategy.ROLE_BASED:
            # Prefer managers for complex tasks, workers for simple tasks
            managers = [a for a in available_agents if a.config.role == AgentRole.MANAGER]
            workers = [a for a in available_agents if a.config.role == AgentRole.WORKER]
            
            # Simple heuristic: use managers for fewer, more complex tasks
            if managers and len(self.active_tasks) < 2:
                selected_agent = managers[0]
            elif workers:
                selected_agent = workers[0]
            else:
                selected_agent = available_agents[0]
        
        else:  # RANDOM
            import random
            selected_agent = random.choice(available_agents)
        
        return selected_agent.config.agent_id
    
    async def _ensure_min_agents(self):
        """Ensure minimum number of agents are running"""
        current_count = len(self.multi_agent.list_agents(status_filter=AgentStatus.IDLE))
        needed = max(0, self.config.min_agents - current_count)
        
        if needed > 0:
            self.logger.info(f"Creating {needed} agents to meet minimum requirement")
            
            for i in range(needed):
                agent_config = AgentConfig(
                    agent_id=f"pool_agent_{int(time.time() * 1000)}_{i}",
                    role=AgentRole.WORKER,
                    name=f"Pool Agent {i + 1}",
                    auto_restart=True
                )
                
                agent_id = await self.multi_agent.create_agent(agent_config)
                await self.multi_agent.start_agent(agent_id)
    
    async def _auto_scaling_loop(self):
        """Background auto-scaling loop"""
        self.logger.info("Starting auto-scaling loop")
        
        while True:
            try:
                if not self.scaling_in_progress:
                    await self._check_scaling_needs()
                
                await asyncio.sleep(self.config.health_check_interval)
                
            except asyncio.CancelledError:
                self.logger.info("Auto-scaling loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in auto-scaling loop: {e}")
                await asyncio.sleep(30)
        
        self.logger.info("Auto-scaling loop stopped")
    
    async def _check_scaling_needs(self):
        """Check if scaling is needed and execute scaling operations"""
        current_time = time.time()
        
        # Check cooldown
        if current_time - self.last_scale_time < self.config.scale_cooldown_seconds:
            return
        
        # Get current metrics
        metrics = await self.get_metrics()
        
        # Calculate utilization
        total_agents = metrics.total_agents
        busy_ratio = metrics.busy_agents / max(1, total_agents)
        idle_ratio = metrics.idle_agents / max(1, total_agents)
        
        scale_decision = None
        
        # Scale up conditions
        if (busy_ratio > self.config.scale_up_threshold and 
            total_agents < self.config.max_agents and
            self.task_queue.qsize() > 0):
            scale_decision = "up"
        
        # Scale down conditions
        elif (busy_ratio < self.config.scale_down_threshold and
              idle_ratio > self.config.target_idle_ratio and
              total_agents > self.config.min_agents):
            scale_decision = "down"
        
        if scale_decision:
            await self._execute_scaling(scale_decision, metrics)
    
    async def _execute_scaling(self, direction: str, metrics: PoolMetrics):
        """Execute scaling operation"""
        self.scaling_in_progress = True
        self.last_scale_time = time.time()
        
        try:
            if direction == "up":
                # Scale up - add new agent
                agent_config = AgentConfig(
                    agent_id=f"autoscale_agent_{int(time.time() * 1000)}",
                    role=AgentRole.WORKER,
                    name="Auto-scaled Worker",
                    auto_restart=True
                )
                
                agent_id = await self.multi_agent.create_agent(agent_config)
                success = await self.multi_agent.start_agent(agent_id)
                
                if success:
                    self.logger.info(f"Scaled up: added agent {agent_id}")
                else:
                    await self.multi_agent.remove_agent(agent_id)
                    self.logger.error(f"Failed to scale up: could not start agent {agent_id}")
            
            elif direction == "down":
                # Scale down - remove least active agent
                idle_agents = self.multi_agent.list_agents(status_filter=AgentStatus.IDLE)
                
                if len(idle_agents) > self.config.min_agents:
                    # Find agent with lowest task count
                    agent_task_counts = [(self.agent_task_counts.get(a.config.agent_id, 0), a) 
                                       for a in idle_agents]
                    least_active_agent = min(agent_task_counts, key=lambda x: x[0])[1]
                    
                    agent_id = least_active_agent.config.agent_id
                    success = await self.multi_agent.remove_agent(agent_id)
                    
                    if success:
                        self.logger.info(f"Scaled down: removed agent {agent_id}")
                        self.agent_task_counts.pop(agent_id, None)
                    else:
                        self.logger.error(f"Failed to scale down: could not remove agent {agent_id}")
        
        except Exception as e:
            self.logger.error(f"Error during scaling {direction}: {e}")
        
        finally:
            self.scaling_in_progress = False
    
    async def _metrics_collection_loop(self):
        """Background metrics collection loop"""
        self.logger.info("Starting pool metrics collection loop")
        
        while True:
            try:
                metrics = await self.get_metrics()
                
                # Store metrics history
                self.metrics_history.append(metrics)
                if len(self.metrics_history) > self.max_history_length:
                    self.metrics_history.pop(0)
                
                # Log metrics every 5 cycles
                if len(self.metrics_history) % 5 == 0:
                    self.logger.info(f"Pool metrics: {metrics.total_agents} agents, "
                                   f"{metrics.busy_agents} busy, {metrics.idle_agents} idle, "
                                   f"queue: {metrics.queue_length}")
                
                await asyncio.sleep(30)  # Collect metrics every 30s
                
            except asyncio.CancelledError:
                self.logger.info("Metrics collection loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in metrics collection loop: {e}")
                await asyncio.sleep(60)
        
        self.logger.info("Pool metrics collection loop stopped")
    
    async def get_metrics(self) -> PoolMetrics:
        """Get current pool metrics"""
        agents = self.multi_agent.list_agents()
        
        # Count agents by status
        idle_count = len([a for a in agents if a.status == AgentStatus.IDLE])
        busy_count = len([a for a in agents if a.status == AgentStatus.BUSY])
        failed_count = len([a for a in agents if a.status == AgentStatus.FAILED])
        
        # Calculate average task duration
        avg_duration = 0.0
        if self.task_history:
            recent_tasks = [t for t in self.task_history if time.time() - t[1] < 3600]  # Last hour
            if recent_tasks:
                avg_duration = sum(t[2] for t in recent_tasks) / len(recent_tasks)
        
        # Calculate total completed tasks
        total_completed = sum(a.task_count for a in agents)
        
        # Determine scaling recommendation
        total_agents = len(agents)
        busy_ratio = busy_count / max(1, total_agents)
        
        if busy_ratio > self.config.scale_up_threshold and total_agents < self.config.max_agents:
            scale_direction = PoolScaleDirection.UP
            scale_count = min(2, self.config.max_agents - total_agents)
        elif busy_ratio < self.config.scale_down_threshold and total_agents > self.config.min_agents:
            scale_direction = PoolScaleDirection.DOWN
            scale_count = 1
        else:
            scale_direction = PoolScaleDirection.STABLE
            scale_count = 0
        
        return PoolMetrics(
            timestamp=time.time(),
            total_agents=total_agents,
            idle_agents=idle_count,
            busy_agents=busy_count,
            failed_agents=failed_count,
            average_task_duration=avg_duration,
            total_tasks_completed=total_completed,
            queue_length=self.task_queue.qsize(),
            recommended_scale_direction=scale_direction,
            recommended_scale_count=scale_count
        )
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific task"""
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            return {
                'task_id': task_id,
                'status': 'running' if not task.done() else 'completed',
                'done': task.done(),
                'cancelled': task.cancelled() if task.done() else False,
                'exception': str(task.exception()) if task.done() and task.exception() else None
            }
        
        # Check if task completed recently
        for agent_id, start_time, duration in self.task_history:
            # Simple task ID extraction (this is basic, could be improved)
            if str(int(start_time * 1000)) in task_id:
                return {
                    'task_id': task_id,
                    'status': 'completed',
                    'agent_id': agent_id,
                    'duration': duration,
                    'completed_at': start_time + duration
                }
        
        return None
    
    async def wait_for_task(self, task_id: str, timeout: Optional[float] = None) -> bool:
        """
        Wait for a specific task to complete.
        
        Returns:
            True if task completed successfully, False if timeout or error
        """
        if task_id not in self.active_tasks:
            return False
        
        try:
            task = self.active_tasks[task_id]
            if timeout:
                await asyncio.wait_for(task, timeout=timeout)
            else:
                await task
            return True
        except asyncio.TimeoutError:
            return False
        except Exception:
            return False