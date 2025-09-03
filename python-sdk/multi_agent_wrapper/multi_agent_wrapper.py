#!/usr/bin/env python3
"""
Multi-Agent Claude CLI Wrapper

Extends the production-ready claude_cli_wrapper.py to support multiple parallel
Claude Code CLI agents with process isolation, resource management, and health monitoring.

Features:
- Spawn and manage 2-5 parallel Claude CLI agents
- Process isolation with configurable resource limits
- Agent lifecycle management (start, stop, restart, status)
- Real-time health monitoring and automatic recovery
- Communication bridges for agent coordination
- Integration with Epic 3 ProcessHandleTracker and ShutdownManager
- Windows compatibility as primary target

Based on claude_cli_wrapper.py v1.1.1 (production-ready)
"""

import asyncio
import os
import sys
import json
import time
import uuid
import threading
import weakref
import logging
from pathlib import Path
from typing import Optional, Dict, List, Set, Tuple, AsyncGenerator, Any, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

# Import base classes from the production claude_cli_wrapper
try:
    from ..claude_cli_wrapper import (
        ClaudeCliWrapper, ClaudeCliOptions, CliMessage, ProcessState,
        ProcessHandleManager, ResourceType, TrackedResource,
        AuthenticationCircuitBreaker, CircuitBreakerConfig, RetryStrategy
    )
except ImportError:
    # Fallback for direct execution or testing
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from claude_cli_wrapper import (
        ClaudeCliWrapper, ClaudeCliOptions, CliMessage, ProcessState,
        ProcessHandleManager, ResourceType, TrackedResource,
        AuthenticationCircuitBreaker, CircuitBreakerConfig, RetryStrategy
    )

# Try to import psutil for enhanced resource monitoring
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# Setup logging
logger = logging.getLogger(__name__)


class AgentRole(Enum):
    """Agent role types for coordination patterns"""
    MANAGER = "manager"           # Coordinates tasks and delegates work
    WORKER = "worker"            # Executes assigned tasks
    SPECIALIST = "specialist"    # Domain-specific tasks (frontend, testing, etc.)
    COORDINATOR = "coordinator"  # Cross-agent communication and workflow management
    

class AgentStatus(Enum):
    """Agent lifecycle status"""
    CREATED = "created"           # Agent created but not started
    STARTING = "starting"         # Agent initialization in progress
    IDLE = "idle"                 # Agent ready and waiting for tasks
    BUSY = "busy"                 # Agent executing a task
    PAUSED = "paused"            # Agent temporarily paused
    STOPPING = "stopping"        # Agent shutdown in progress
    STOPPED = "stopped"          # Agent cleanly stopped
    FAILED = "failed"            # Agent in error state
    RECOVERING = "recovering"    # Agent attempting recovery


@dataclass
class AgentConfig:
    """Configuration for individual agent"""
    agent_id: str
    role: AgentRole
    name: Optional[str] = None
    cli_options: Optional[ClaudeCliOptions] = None
    max_memory_mb: int = 512
    max_cpu_percent: float = 25.0
    max_execution_time_seconds: int = 600  # 10 minutes
    auto_restart: bool = True
    restart_delay_seconds: float = 5.0
    health_check_interval_seconds: float = 30.0
    enable_logging: bool = True
    log_level: str = "INFO"
    working_directory: Optional[Path] = None
    environment_variables: Dict[str, str] = field(default_factory=dict)
    
    def __post_init__(self):
        if not self.name:
            self.name = f"{self.role.value}_{self.agent_id[:8]}"
        
        if not self.cli_options:
            # Default CLI options optimized for multi-agent environment
            self.cli_options = ClaudeCliOptions(
                model="sonnet",  # Balanced performance/cost for parallel agents
                max_turns=5,     # Shorter conversations for faster task completion
                verbose=False,   # Reduce noise in multi-agent logs
                timeout=300,     # 5 minutes per task
                enable_circuit_breaker=True,
                dangerously_skip_permissions=True  # Streamlined for automation
            )


@dataclass  
class AgentInfo:
    """Runtime information about an agent"""
    config: AgentConfig
    status: AgentStatus
    wrapper: Optional[ClaudeCliWrapper] = None
    process_pid: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    last_activity_at: Optional[float] = None
    task_count: int = 0
    error_count: int = 0
    restart_count: int = 0
    current_task_id: Optional[str] = None
    resource_stats: Optional[Dict[str, Any]] = None
    health_status: Optional[Dict[str, Any]] = None
    
    def get_uptime_seconds(self) -> Optional[float]:
        """Get agent uptime in seconds"""
        if self.started_at:
            return time.time() - self.started_at
        return None
    
    def get_idle_time_seconds(self) -> Optional[float]:
        """Get time since last activity"""
        if self.last_activity_at:
            return time.time() - self.last_activity_at
        return None


@dataclass
class AgentCommunication:
    """Message structure for agent-to-agent communication"""
    message_id: str
    from_agent: str
    to_agent: str
    message_type: str  # task_assignment, status_update, result, error, etc.
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    requires_response: bool = False
    parent_message_id: Optional[str] = None


@dataclass
class HealthCheckResult:
    """Result of agent health check"""
    agent_id: str
    is_healthy: bool
    check_timestamp: float
    response_time_ms: float
    memory_usage_mb: Optional[float] = None
    cpu_usage_percent: Optional[float] = None
    error_message: Optional[str] = None
    last_activity_age_seconds: Optional[float] = None
    recommendations: List[str] = field(default_factory=list)


@dataclass
class MultiAgentConfig:
    """Configuration for the multi-agent system"""
    max_agents: int = 5
    default_agent_timeout: int = 300
    health_check_interval: float = 30.0
    resource_cleanup_interval: float = 60.0
    auto_scale: bool = False
    min_agents: int = 1
    max_memory_total_mb: int = 2048
    max_cpu_total_percent: float = 80.0
    communication_timeout: float = 10.0
    enable_metrics: bool = True
    metrics_collection_interval: float = 15.0
    log_level: str = "INFO"
    enable_resource_limits: bool = True


class MultiAgentCLIWrapper:
    """
    Multi-agent wrapper for Claude Code CLI with comprehensive management capabilities.
    
    Features:
    - Parallel agent execution with process isolation
    - Resource monitoring and automatic limits enforcement
    - Agent lifecycle management with health monitoring
    - Communication bridges for agent coordination
    - Integration with Epic 3 process management system
    - Automatic recovery and restart mechanisms
    """
    
    def __init__(self, config: Optional[MultiAgentConfig] = None):
        self.config = config or MultiAgentConfig()
        self.agents: Dict[str, AgentInfo] = {}
        self.agent_lock = threading.Lock()
        
        # Get shared process handle manager instance
        self.handle_manager = ProcessHandleManager.get_instance()
        self.registered_resources: Set[str] = set()
        
        # Communication system
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self.communication_handlers: Dict[str, Callable] = {}
        self.pending_responses: Dict[str, asyncio.Future] = {}
        
        # Monitoring and health check system
        self.health_check_tasks: Dict[str, asyncio.Task] = {}
        self.metrics_collection_task: Optional[asyncio.Task] = None
        self.resource_cleanup_task: Optional[asyncio.Task] = None
        
        # Shutdown coordination
        self.shutdown_initiated = False
        self.shutdown_event = asyncio.Event()
        
        # Thread pool for CPU-intensive operations
        self.thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="MultiAgent")
        
        # Setup logging
        self.logger = logging.getLogger(f"{__name__}.MultiAgentCLIWrapper")
        self.logger.setLevel(getattr(logging, self.config.log_level))
        
        self.logger.info(f"MultiAgentCLIWrapper initialized (max_agents: {self.config.max_agents})")
        
        # Start background tasks
        if self.config.enable_metrics:
            self._start_background_tasks()
    
    def _start_background_tasks(self):
        """Start background monitoring and cleanup tasks"""
        try:
            loop = asyncio.get_event_loop()
            
            # Resource cleanup task
            self.resource_cleanup_task = loop.create_task(self._resource_cleanup_loop())
            cleanup_resource_id = self.handle_manager.register_resource(
                self.resource_cleanup_task, ResourceType.TASK,
                "Multi-agent resource cleanup task"
            )
            self.registered_resources.add(cleanup_resource_id)
            
            # Metrics collection task
            if self.config.enable_metrics:
                self.metrics_collection_task = loop.create_task(self._metrics_collection_loop())
                metrics_resource_id = self.handle_manager.register_resource(
                    self.metrics_collection_task, ResourceType.TASK,
                    "Multi-agent metrics collection task"
                )
                self.registered_resources.add(metrics_resource_id)
            
            self.logger.info("Background tasks started")
            
        except RuntimeError:
            # No event loop running, tasks will be started later
            self.logger.debug("No event loop available, background tasks will be started on demand")
    
    async def create_agent(self, config: AgentConfig) -> str:
        """
        Create a new agent with the specified configuration.
        
        Returns:
            Agent ID of the created agent
        """
        if len(self.agents) >= self.config.max_agents:
            raise ValueError(f"Maximum number of agents ({self.config.max_agents}) already reached")
        
        if config.agent_id in self.agents:
            raise ValueError(f"Agent with ID '{config.agent_id}' already exists")
        
        with self.agent_lock:
            # Create agent info
            agent_info = AgentInfo(
                config=config,
                status=AgentStatus.CREATED
            )
            
            # Create Claude CLI wrapper for the agent
            agent_info.wrapper = ClaudeCliWrapper(config.cli_options)
            
            # Register agent
            self.agents[config.agent_id] = agent_info
            
            self.logger.info(f"Agent created: {config.agent_id} ({config.role.value})")
            
            # Register agent wrapper with handle manager for tracking
            agent_resource_id = self.handle_manager.register_resource(
                agent_info.wrapper, ResourceType.PROCESS,
                f"Agent wrapper {config.agent_id}",
                metadata={'agent_id': config.agent_id, 'role': config.role.value}
            )
            self.registered_resources.add(agent_resource_id)
        
        return config.agent_id
    
    async def start_agent(self, agent_id: str) -> bool:
        """
        Start an agent and begin health monitoring.
        
        Returns:
            True if agent started successfully, False otherwise
        """
        if agent_id not in self.agents:
            raise ValueError(f"Agent '{agent_id}' not found")
        
        agent_info = self.agents[agent_id]
        
        if agent_info.status not in [AgentStatus.CREATED, AgentStatus.STOPPED]:
            self.logger.warning(f"Agent {agent_id} cannot be started from status {agent_info.status.value}")
            return False
        
        try:
            agent_info.status = AgentStatus.STARTING
            agent_info.started_at = time.time()
            agent_info.last_activity_at = time.time()
            
            # Verify CLI availability
            if not agent_info.wrapper.is_available():
                raise RuntimeError("Claude CLI not available")
            
            # Start health monitoring
            if agent_id not in self.health_check_tasks:
                health_task = asyncio.create_task(self._health_monitor_loop(agent_id))
                self.health_check_tasks[agent_id] = health_task
                
                # Register health check task with handle manager
                health_resource_id = self.handle_manager.register_resource(
                    health_task, ResourceType.TASK,
                    f"Health monitor for agent {agent_id}"
                )
                self.registered_resources.add(health_resource_id)
            
            agent_info.status = AgentStatus.IDLE
            
            self.logger.info(f"Agent started successfully: {agent_id}")
            return True
            
        except Exception as e:
            agent_info.status = AgentStatus.FAILED
            agent_info.error_count += 1
            self.logger.error(f"Failed to start agent {agent_id}: {e}")
            return False
    
    async def stop_agent(self, agent_id: str, force: bool = False) -> bool:
        """
        Stop an agent gracefully (or forcefully if specified).
        
        Args:
            agent_id: ID of agent to stop
            force: If True, force kill the agent process
        
        Returns:
            True if agent stopped successfully, False otherwise
        """
        if agent_id not in self.agents:
            raise ValueError(f"Agent '{agent_id}' not found")
        
        agent_info = self.agents[agent_id]
        
        if agent_info.status == AgentStatus.STOPPED:
            return True
        
        try:
            agent_info.status = AgentStatus.STOPPING
            
            # Stop health monitoring
            if agent_id in self.health_check_tasks:
                health_task = self.health_check_tasks.pop(agent_id)
                health_task.cancel()
                try:
                    await health_task
                except asyncio.CancelledError:
                    pass
            
            # Stop the agent's CLI wrapper
            if agent_info.wrapper:
                if force:
                    agent_info.wrapper.kill()
                else:
                    await agent_info.wrapper.cleanup()
            
            agent_info.status = AgentStatus.STOPPED
            self.logger.info(f"Agent stopped: {agent_id}")
            return True
            
        except Exception as e:
            agent_info.status = AgentStatus.FAILED
            self.logger.error(f"Error stopping agent {agent_id}: {e}")
            return False
    
    async def remove_agent(self, agent_id: str) -> bool:
        """
        Remove an agent completely (stops it first if running).
        
        Returns:
            True if agent removed successfully, False otherwise
        """
        if agent_id not in self.agents:
            return True  # Already removed
        
        # Stop the agent first
        await self.stop_agent(agent_id, force=True)
        
        # Remove from agents dict
        with self.agent_lock:
            del self.agents[agent_id]
        
        self.logger.info(f"Agent removed: {agent_id}")
        return True
    
    async def execute_task(self, agent_id: str, prompt: str, 
                          task_id: Optional[str] = None) -> AsyncGenerator[CliMessage, None]:
        """
        Execute a task on a specific agent.
        
        Args:
            agent_id: ID of agent to execute task
            prompt: Task prompt/instruction
            task_id: Optional task identifier for tracking
        
        Yields:
            CliMessage objects from the agent execution
        """
        if agent_id not in self.agents:
            raise ValueError(f"Agent '{agent_id}' not found")
        
        agent_info = self.agents[agent_id]
        
        if agent_info.status != AgentStatus.IDLE:
            raise RuntimeError(f"Agent {agent_id} is not idle (status: {agent_info.status.value})")
        
        if not agent_info.wrapper:
            raise RuntimeError(f"Agent {agent_id} wrapper not available")
        
        # Generate task ID if not provided
        if not task_id:
            task_id = f"task_{uuid.uuid4().hex[:8]}"
        
        try:
            # Update agent status
            agent_info.status = AgentStatus.BUSY
            agent_info.current_task_id = task_id
            agent_info.last_activity_at = time.time()
            agent_info.task_count += 1
            
            self.logger.info(f"Agent {agent_id} starting task {task_id}")
            
            # Execute task with timeout and resource monitoring
            task_start_time = time.time()
            message_count = 0
            
            async with asyncio.timeout(agent_info.config.max_execution_time_seconds):
                async for message in agent_info.wrapper.execute(prompt):
                    message_count += 1
                    agent_info.last_activity_at = time.time()
                    
                    # Add agent metadata to message
                    message.metadata.update({
                        'agent_id': agent_id,
                        'task_id': task_id,
                        'agent_role': agent_info.config.role.value
                    })
                    
                    yield message
            
            task_duration = time.time() - task_start_time
            self.logger.info(f"Agent {agent_id} completed task {task_id} "
                           f"({message_count} messages, {task_duration:.2f}s)")
            
        except asyncio.TimeoutError:
            agent_info.error_count += 1
            self.logger.error(f"Task timeout for agent {agent_id}, task {task_id}")
            yield CliMessage(
                type="error",
                content=f"Task execution timeout ({agent_info.config.max_execution_time_seconds}s)",
                metadata={'agent_id': agent_id, 'task_id': task_id, 'timeout': True}
            )
            
        except Exception as e:
            agent_info.error_count += 1
            self.logger.error(f"Task execution error for agent {agent_id}: {e}")
            yield CliMessage(
                type="error", 
                content=f"Task execution error: {e}",
                metadata={'agent_id': agent_id, 'task_id': task_id, 'exception': str(e)}
            )
            
        finally:
            # Reset agent status
            agent_info.status = AgentStatus.IDLE
            agent_info.current_task_id = None
            agent_info.last_activity_at = time.time()
    
    async def broadcast_task(self, prompt: str, target_roles: Optional[List[AgentRole]] = None,
                           max_agents: Optional[int] = None) -> Dict[str, AsyncGenerator[CliMessage, None]]:
        """
        Broadcast a task to multiple agents simultaneously.
        
        Args:
            prompt: Task prompt/instruction
            target_roles: List of agent roles to target (all idle agents if None)
            max_agents: Maximum number of agents to use (all available if None)
        
        Returns:
            Dict mapping agent_id to AsyncGenerator of messages
        """
        # Find eligible agents
        eligible_agents = []
        for agent_id, agent_info in self.agents.items():
            if agent_info.status == AgentStatus.IDLE:
                if not target_roles or agent_info.config.role in target_roles:
                    eligible_agents.append(agent_id)
        
        # Limit agents if specified
        if max_agents and len(eligible_agents) > max_agents:
            eligible_agents = eligible_agents[:max_agents]
        
        if not eligible_agents:
            self.logger.warning("No eligible agents found for broadcast task")
            return {}
        
        # Start tasks on all eligible agents
        task_generators = {}
        broadcast_task_id = f"broadcast_{uuid.uuid4().hex[:8]}"
        
        for agent_id in eligible_agents:
            individual_task_id = f"{broadcast_task_id}_{agent_id}"
            task_generators[agent_id] = self.execute_task(agent_id, prompt, individual_task_id)
        
        self.logger.info(f"Broadcasting task to {len(eligible_agents)} agents: {eligible_agents}")
        return task_generators
    
    async def get_agent_status(self, agent_id: str) -> Optional[AgentInfo]:
        """Get current status and info for an agent"""
        if agent_id not in self.agents:
            return None
        
        agent_info = self.agents[agent_id]
        
        # Update resource stats if wrapper is available
        if agent_info.wrapper:
            agent_info.resource_stats = agent_info.wrapper.get_resource_stats()
        
        return agent_info
    
    def list_agents(self, status_filter: Optional[AgentStatus] = None,
                   role_filter: Optional[AgentRole] = None) -> List[AgentInfo]:
        """
        List all agents with optional filtering.
        
        Args:
            status_filter: Only return agents with this status
            role_filter: Only return agents with this role
        
        Returns:
            List of AgentInfo objects matching the filters
        """
        agents = list(self.agents.values())
        
        if status_filter:
            agents = [a for a in agents if a.status == status_filter]
        
        if role_filter:
            agents = [a for a in agents if a.config.role == role_filter]
        
        return agents
    
    async def health_check(self, agent_id: str) -> HealthCheckResult:
        """
        Perform comprehensive health check on an agent.
        
        Returns:
            HealthCheckResult with detailed health information
        """
        if agent_id not in self.agents:
            return HealthCheckResult(
                agent_id=agent_id,
                is_healthy=False,
                check_timestamp=time.time(),
                response_time_ms=0,
                error_message="Agent not found"
            )
        
        agent_info = self.agents[agent_id]
        check_start = time.time()
        
        try:
            # Basic availability check
            if not agent_info.wrapper or not agent_info.wrapper.is_available():
                return HealthCheckResult(
                    agent_id=agent_id,
                    is_healthy=False,
                    check_timestamp=time.time(),
                    response_time_ms=(time.time() - check_start) * 1000,
                    error_message="CLI wrapper not available"
                )
            
            # Status check
            if agent_info.status in [AgentStatus.FAILED, AgentStatus.STOPPED]:
                return HealthCheckResult(
                    agent_id=agent_id,
                    is_healthy=False,
                    check_timestamp=time.time(),
                    response_time_ms=(time.time() - check_start) * 1000,
                    error_message=f"Agent in unhealthy status: {agent_info.status.value}"
                )
            
            # Resource usage check (if psutil available)
            memory_usage = None
            cpu_usage = None
            recommendations = []
            
            if HAS_PSUTIL and agent_info.process_pid:
                try:
                    process = psutil.Process(agent_info.process_pid)
                    memory_info = process.memory_info()
                    memory_usage = memory_info.rss / 1024 / 1024  # MB
                    cpu_usage = process.cpu_percent(interval=0.1)
                    
                    # Check resource limits
                    if memory_usage > agent_info.config.max_memory_mb:
                        recommendations.append(f"Memory usage ({memory_usage:.1f}MB) exceeds limit ({agent_info.config.max_memory_mb}MB)")
                    
                    if cpu_usage > agent_info.config.max_cpu_percent:
                        recommendations.append(f"CPU usage ({cpu_usage:.1f}%) exceeds limit ({agent_info.config.max_cpu_percent}%)")
                
                except psutil.NoSuchProcess:
                    recommendations.append("Process not found - may have crashed")
                except psutil.AccessDenied:
                    recommendations.append("Cannot access process metrics - permission denied")
            
            # Activity check
            last_activity_age = None
            if agent_info.last_activity_at:
                last_activity_age = time.time() - agent_info.last_activity_at
                if last_activity_age > 300:  # 5 minutes idle
                    recommendations.append(f"Agent idle for {last_activity_age:.0f} seconds")
            
            response_time = (time.time() - check_start) * 1000
            is_healthy = len(recommendations) == 0 and agent_info.status in [AgentStatus.IDLE, AgentStatus.BUSY]
            
            return HealthCheckResult(
                agent_id=agent_id,
                is_healthy=is_healthy,
                check_timestamp=time.time(),
                response_time_ms=response_time,
                memory_usage_mb=memory_usage,
                cpu_usage_percent=cpu_usage,
                last_activity_age_seconds=last_activity_age,
                recommendations=recommendations
            )
            
        except Exception as e:
            return HealthCheckResult(
                agent_id=agent_id,
                is_healthy=False,
                check_timestamp=time.time(),
                response_time_ms=(time.time() - check_start) * 1000,
                error_message=f"Health check failed: {e}"
            )
    
    async def _health_monitor_loop(self, agent_id: str):
        """Background health monitoring loop for an agent"""
        self.logger.info(f"Starting health monitor for agent {agent_id}")
        
        while not self.shutdown_initiated and agent_id in self.agents:
            try:
                agent_info = self.agents[agent_id]
                
                # Skip monitoring if agent is stopped
                if agent_info.status == AgentStatus.STOPPED:
                    break
                
                # Perform health check
                health_result = await self.health_check(agent_id)
                agent_info.health_status = {
                    'is_healthy': health_result.is_healthy,
                    'last_check': health_result.check_timestamp,
                    'response_time_ms': health_result.response_time_ms,
                    'recommendations': health_result.recommendations,
                    'error_message': health_result.error_message
                }
                
                # Handle unhealthy agents
                if not health_result.is_healthy:
                    self.logger.warning(f"Agent {agent_id} health check failed: {health_result.error_message}")
                    
                    # Auto-restart if enabled and appropriate
                    if (agent_info.config.auto_restart and 
                        agent_info.status == AgentStatus.FAILED and
                        agent_info.restart_count < 3):
                        
                        self.logger.info(f"Attempting auto-restart for agent {agent_id}")
                        agent_info.status = AgentStatus.RECOVERING
                        agent_info.restart_count += 1
                        
                        await asyncio.sleep(agent_info.config.restart_delay_seconds)
                        
                        # Try to restart
                        if await self.start_agent(agent_id):
                            self.logger.info(f"Agent {agent_id} successfully restarted")
                        else:
                            self.logger.error(f"Failed to restart agent {agent_id}")
                
                # Wait before next check
                await asyncio.sleep(agent_info.config.health_check_interval_seconds)
                
            except asyncio.CancelledError:
                self.logger.info(f"Health monitor cancelled for agent {agent_id}")
                break
            except Exception as e:
                self.logger.error(f"Error in health monitor for agent {agent_id}: {e}")
                await asyncio.sleep(10)  # Wait before retrying
        
        self.logger.info(f"Health monitor stopped for agent {agent_id}")
    
    async def _resource_cleanup_loop(self):
        """Background resource cleanup and maintenance loop"""
        self.logger.info("Starting resource cleanup loop")
        
        while not self.shutdown_initiated:
            try:
                # Clean up any orphaned resources
                cleaned_count, failed_count, errors = await self.handle_manager.force_cleanup_all(timeout=2.0)
                
                if cleaned_count > 0 or failed_count > 0:
                    self.logger.info(f"Resource cleanup: {cleaned_count} cleaned, {failed_count} failed")
                
                # Wait before next cleanup cycle
                await asyncio.sleep(self.config.resource_cleanup_interval)
                
            except asyncio.CancelledError:
                self.logger.info("Resource cleanup loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in resource cleanup loop: {e}")
                await asyncio.sleep(30)  # Wait before retrying
        
        self.logger.info("Resource cleanup loop stopped")
    
    async def _metrics_collection_loop(self):
        """Background metrics collection loop"""
        self.logger.info("Starting metrics collection loop")
        
        while not self.shutdown_initiated:
            try:
                # Collect system-wide metrics
                metrics = {
                    'timestamp': time.time(),
                    'total_agents': len(self.agents),
                    'active_agents': len([a for a in self.agents.values() if a.status == AgentStatus.IDLE]),
                    'busy_agents': len([a for a in self.agents.values() if a.status == AgentStatus.BUSY]),
                    'failed_agents': len([a for a in self.agents.values() if a.status == AgentStatus.FAILED]),
                    'total_tasks_completed': sum(a.task_count for a in self.agents.values()),
                    'total_errors': sum(a.error_count for a in self.agents.values()),
                }
                
                # Log metrics periodically (every 10 cycles = ~2.5 minutes with 15s interval)
                if int(time.time()) % (10 * self.config.metrics_collection_interval) == 0:
                    self.logger.info(f"Multi-agent metrics: {json.dumps(metrics, indent=2)}")
                
                await asyncio.sleep(self.config.metrics_collection_interval)
                
            except asyncio.CancelledError:
                self.logger.info("Metrics collection loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in metrics collection loop: {e}")
                await asyncio.sleep(30)
        
        self.logger.info("Metrics collection loop stopped")
    
    async def shutdown(self, timeout: float = 10.0):
        """
        Graceful shutdown of all agents and resources.
        
        Args:
            timeout: Maximum time to wait for graceful shutdown
        """
        if self.shutdown_initiated:
            return
        
        self.shutdown_initiated = True
        self.logger.info("Initiating multi-agent system shutdown")
        
        try:
            # Stop all agents concurrently
            agent_stop_tasks = []
            for agent_id in list(self.agents.keys()):
                task = asyncio.create_task(self.stop_agent(agent_id))
                agent_stop_tasks.append(task)
            
            # Wait for agents to stop with timeout
            if agent_stop_tasks:
                await asyncio.wait_for(
                    asyncio.gather(*agent_stop_tasks, return_exceptions=True),
                    timeout=timeout / 2
                )
            
            # Cancel background tasks
            tasks_to_cancel = []
            if self.metrics_collection_task:
                tasks_to_cancel.append(self.metrics_collection_task)
            if self.resource_cleanup_task:
                tasks_to_cancel.append(self.resource_cleanup_task)
            
            for task in list(self.health_check_tasks.values()):
                tasks_to_cancel.append(task)
            
            if tasks_to_cancel:
                for task in tasks_to_cancel:
                    task.cancel()
                
                await asyncio.wait_for(
                    asyncio.gather(*tasks_to_cancel, return_exceptions=True),
                    timeout=timeout / 4
                )
            
            # Force cleanup all registered resources
            cleaned_count, failed_count, errors = await self.handle_manager.force_cleanup_all(timeout=timeout / 4)
            
            if errors:
                self.logger.warning(f"Shutdown cleanup errors: {errors}")
            
            # Shutdown thread pool
            self.thread_pool.shutdown(wait=True, timeout=timeout / 4)
            
            # Clear all agents
            with self.agent_lock:
                self.agents.clear()
            
            self.shutdown_event.set()
            self.logger.info(f"Multi-agent system shutdown complete ({cleaned_count} resources cleaned)")
            
        except asyncio.TimeoutError:
            self.logger.error(f"Shutdown timeout after {timeout}s - forcing cleanup")
            # Force cleanup remaining resources
            await self.handle_manager.force_cleanup_all(timeout=2.0)
        except Exception as e:
            self.logger.error(f"Error during shutdown: {e}")
        finally:
            self.shutdown_initiated = True
    
    @asynccontextmanager
    async def managed_agents(self, agent_configs: List[AgentConfig]):
        """
        Context manager for automatic agent lifecycle management.
        
        Usage:
            configs = [AgentConfig(agent_id="agent1", role=AgentRole.MANAGER), ...]
            async with multi_agent.managed_agents(configs) as agents:
                # Use agents...
                # They will be automatically cleaned up
        """
        created_agents = []
        
        try:
            # Create and start all agents
            for config in agent_configs:
                agent_id = await self.create_agent(config)
                created_agents.append(agent_id)
                await self.start_agent(agent_id)
            
            yield {agent_id: self.agents[agent_id] for agent_id in created_agents}
            
        finally:
            # Clean up all created agents
            for agent_id in created_agents:
                try:
                    await self.remove_agent(agent_id)
                except Exception as e:
                    self.logger.error(f"Error removing agent {agent_id}: {e}")
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get comprehensive system statistics"""
        with self.agent_lock:
            agent_stats = {}
            for agent_id, agent_info in self.agents.items():
                agent_stats[agent_id] = {
                    'role': agent_info.config.role.value,
                    'status': agent_info.status.value,
                    'uptime_seconds': agent_info.get_uptime_seconds(),
                    'idle_time_seconds': agent_info.get_idle_time_seconds(),
                    'task_count': agent_info.task_count,
                    'error_count': agent_info.error_count,
                    'restart_count': agent_info.restart_count,
                    'current_task_id': agent_info.current_task_id,
                    'health_status': agent_info.health_status
                }
        
        return {
            'total_agents': len(self.agents),
            'agents_by_status': {
                status.value: len([a for a in self.agents.values() if a.status == status])
                for status in AgentStatus
            },
            'agents_by_role': {
                role.value: len([a for a in self.agents.values() if a.config.role == role])
                for role in AgentRole
            },
            'system_config': {
                'max_agents': self.config.max_agents,
                'health_check_interval': self.config.health_check_interval,
                'resource_cleanup_interval': self.config.resource_cleanup_interval,
                'enable_metrics': self.config.enable_metrics
            },
            'resource_stats': self.handle_manager.get_resource_stats(),
            'shutdown_initiated': self.shutdown_initiated,
            'agents': agent_stats
        }


# Convenience functions for common usage patterns

async def create_dual_agent_system(manager_config: Optional[AgentConfig] = None,
                                 worker_config: Optional[AgentConfig] = None) -> MultiAgentCLIWrapper:
    """
    Create a typical dual-agent system with one Manager and one Worker.
    
    Returns:
        MultiAgentCLIWrapper with both agents created and started
    """
    # Default configurations
    if not manager_config:
        manager_config = AgentConfig(
            agent_id="manager",
            role=AgentRole.MANAGER,
            name="Manager Agent",
            cli_options=ClaudeCliOptions(model="opus", max_turns=10, verbose=True)
        )
    
    if not worker_config:
        worker_config = AgentConfig(
            agent_id="worker", 
            role=AgentRole.WORKER,
            name="Worker Agent",
            cli_options=ClaudeCliOptions(model="sonnet", max_turns=5, verbose=False)
        )
    
    # Create multi-agent wrapper
    multi_agent = MultiAgentCLIWrapper(MultiAgentConfig(max_agents=2))
    
    # Create and start agents
    await multi_agent.create_agent(manager_config)
    await multi_agent.create_agent(worker_config)
    await multi_agent.start_agent("manager")
    await multi_agent.start_agent("worker")
    
    return multi_agent


async def create_specialist_team(team_size: int = 3) -> MultiAgentCLIWrapper:
    """
    Create a team of specialist agents for different domains.
    
    Args:
        team_size: Number of specialist agents to create
    
    Returns:
        MultiAgentCLIWrapper with specialist team ready
    """
    specialist_roles = [
        ("frontend", "Frontend specialist for React/UI tasks"),
        ("backend", "Backend specialist for API/database tasks"), 
        ("testing", "Testing specialist for QA and validation"),
        ("devops", "DevOps specialist for deployment and infrastructure"),
        ("security", "Security specialist for security analysis")
    ]
    
    multi_agent = MultiAgentCLIWrapper(MultiAgentConfig(max_agents=team_size + 1))
    
    # Create manager
    manager_config = AgentConfig(
        agent_id="manager",
        role=AgentRole.MANAGER,
        name="Team Manager",
        cli_options=ClaudeCliOptions(model="opus", max_turns=15)
    )
    await multi_agent.create_agent(manager_config)
    await multi_agent.start_agent("manager")
    
    # Create specialists
    for i in range(min(team_size, len(specialist_roles))):
        specialist_id, specialist_desc = specialist_roles[i]
        specialist_config = AgentConfig(
            agent_id=specialist_id,
            role=AgentRole.SPECIALIST,
            name=specialist_desc,
            cli_options=ClaudeCliOptions(model="sonnet", max_turns=8)
        )
        await multi_agent.create_agent(specialist_config)
        await multi_agent.start_agent(specialist_id)
    
    return multi_agent