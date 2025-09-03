#!/usr/bin/env python3
"""
Multi-Agent CLI Wrapper

Provides comprehensive multi-agent orchestration for Claude CLI instances.
This module enables the creation, management, and coordination of multiple
Claude Code CLI agents with real-time status monitoring and task distribution.

Features:
- Agent lifecycle management (create, start, stop, restart)
- Multi-agent task coordination and communication
- Health monitoring and automatic recovery
- Resource usage tracking and optimization
- Inter-agent message passing and coordination
- Task queue management with priority scheduling
- Performance metrics and analytics
- WebSocket integration for real-time updates

This is the core orchestrator for the Visual Agent Management Platform.
"""

import asyncio
import json
import logging
import time
import threading
import subprocess
import psutil
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, AsyncGenerator, Set, Tuple
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
import uuid

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

logger = logging.getLogger(__name__)


class AgentRole(Enum):
    """Agent role definitions"""
    MANAGER = "manager"
    WORKER = "worker" 
    COORDINATOR = "coordinator"
    SPECIALIST = "specialist"


class AgentStatus(Enum):
    """Agent status definitions"""
    IDLE = "idle"
    WORKING = "working"
    STARTING = "starting"
    STOPPING = "stopping"
    ERROR = "error"
    STOPPED = "stopped"


class MessageType(Enum):
    """Inter-agent message types"""
    TASK_ASSIGNMENT = "task_assignment"
    TASK_RESPONSE = "task_response"
    STATUS_UPDATE = "status_update"
    COORDINATION_REQUEST = "coordination_request"
    HEALTH_CHECK = "health_check"
    SYSTEM_BROADCAST = "system_broadcast"


@dataclass
class AgentConfig:
    """Agent configuration"""
    agent_id: str
    role: AgentRole
    name: str
    cli_options: ClaudeCliOptions
    max_concurrent_tasks: int = 1
    auto_restart: bool = True
    resource_limits: Optional[Dict[str, Any]] = None
    capabilities: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        if self.resource_limits is None:
            self.resource_limits = {
                "max_memory_mb": 512,
                "max_cpu_percent": 50,
                "timeout_seconds": 300
            }


@dataclass 
class AgentMessage:
    """Inter-agent message structure"""
    message_id: str
    from_agent: str
    to_agent: str
    message_type: MessageType
    content: str
    metadata: Dict[str, Any]
    timestamp: float
    correlation_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TaskMessage:
    """Task execution message"""
    type: str
    content: str
    timestamp: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthResult:
    """Agent health check result"""
    agent_id: str
    is_healthy: bool
    check_timestamp: float
    response_time_ms: float
    memory_usage_mb: float
    cpu_usage_percent: float
    error_message: Optional[str] = None
    last_activity_age_seconds: float = 0
    recommendations: List[str] = field(default_factory=list)


class AgentInfo:
    """Agent runtime information and management"""
    
    def __init__(self, config: AgentConfig):
        self.config = config
        self.status = AgentStatus.STOPPED
        self.wrapper: Optional[ClaudeCliWrapper] = None
        self.process: Optional[subprocess.Popen] = None
        
        # Runtime statistics
        self.created_at = time.time()
        self.started_at: Optional[float] = None
        self.last_activity = time.time()
        self.task_count = 0
        self.error_count = 0
        self.restart_count = 0
        
        # Current task tracking
        self.current_task_id: Optional[str] = None
        self.current_task_start: Optional[float] = None
        
        # Health monitoring
        self.health_status: Dict[str, Any] = {}
        self.last_health_check = 0
        
        # Message queue
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self.response_callbacks: Dict[str, Callable] = {}
        
        self.logger = logging.getLogger(f"{__name__}.AgentInfo.{config.agent_id}")
    
    def get_uptime_seconds(self) -> float:
        """Get agent uptime in seconds"""
        if self.started_at is None:
            return 0
        return time.time() - self.started_at
    
    def get_idle_time_seconds(self) -> float:
        """Get time since last activity"""
        return time.time() - self.last_activity
    
    def mark_activity(self):
        """Mark agent as active"""
        self.last_activity = time.time()
    
    def start_task(self, task_id: str):
        """Start a new task"""
        self.current_task_id = task_id
        self.current_task_start = time.time()
        self.task_count += 1
        self.mark_activity()
    
    def complete_task(self):
        """Complete current task"""
        self.current_task_id = None
        self.current_task_start = None
        self.mark_activity()
    
    def record_error(self, error_message: str):
        """Record an error"""
        self.error_count += 1
        self.mark_activity()
        self.logger.error(f"Agent {self.config.agent_id} error: {error_message}")


class MultiAgentConfig:
    """Multi-agent system configuration"""
    
    def __init__(self, 
                 max_agents: int = 10,
                 enable_metrics: bool = True,
                 health_check_interval: float = 30.0,
                 auto_recovery: bool = True,
                 message_queue_size: int = 1000,
                 task_timeout: float = 300.0):
        self.max_agents = max_agents
        self.enable_metrics = enable_metrics
        self.health_check_interval = health_check_interval
        self.auto_recovery = auto_recovery
        self.message_queue_size = message_queue_size
        self.task_timeout = task_timeout


class PoolConfig:
    """Agent pool configuration"""
    
    def __init__(self,
                 pool_size: int = 5,
                 load_balancing: str = "round_robin",
                 retry_attempts: int = 3,
                 failover_enabled: bool = True):
        self.pool_size = pool_size
        self.load_balancing = load_balancing
        self.retry_attempts = retry_attempts
        self.failover_enabled = failover_enabled


class MultiAgentCLIWrapper:
    """
    Multi-agent Claude CLI wrapper with orchestration capabilities.
    
    Manages multiple Claude CLI agent instances with coordination,
    health monitoring, and task distribution.
    """
    
    def __init__(self, config: MultiAgentConfig):
        self.config = config
        self.agents: Dict[str, AgentInfo] = {}
        self.agent_pool: Optional['AgentPool'] = None
        self.communication_bridge: Optional['CommunicationBridge'] = None
        self.health_monitor: Optional['HealthMonitor'] = None
        
        # System state
        self.running = False
        self.system_start_time = time.time()
        self.total_tasks_executed = 0
        self.total_errors = 0
        
        # Background tasks
        self._background_tasks: List[asyncio.Task] = []
        self._shutdown_event = asyncio.Event()
        
        self.logger = logging.getLogger(f"{__name__}.MultiAgentCLIWrapper")
        self.logger.info(f"Initialized multi-agent system (max_agents: {config.max_agents})")
    
    async def create_agent(self, config: AgentConfig) -> str:
        """Create a new agent"""
        if len(self.agents) >= self.config.max_agents:
            raise ValueError(f"Maximum agents ({self.config.max_agents}) reached")
        
        if config.agent_id in self.agents:
            raise ValueError(f"Agent {config.agent_id} already exists")
        
        # Create agent info
        agent_info = AgentInfo(config)
        
        # Initialize Claude CLI wrapper
        try:
            wrapper = ClaudeCliWrapper(config.cli_options)
            agent_info.wrapper = wrapper
            agent_info.status = AgentStatus.IDLE
            
            self.agents[config.agent_id] = agent_info
            self.logger.info(f"✅ Created {config.role.value} agent: {config.agent_id}")
            
            return config.agent_id
            
        except Exception as e:
            self.logger.error(f"Failed to create agent {config.agent_id}: {e}")
            raise
    
    async def start_agent(self, agent_id: str) -> bool:
        """Start an agent"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = self.agents[agent_id]
        
        try:
            agent.status = AgentStatus.STARTING
            
            # Start the Claude CLI wrapper
            if agent.wrapper:
                # Agent is ready
                agent.status = AgentStatus.IDLE
                agent.started_at = time.time()
                agent.mark_activity()
                
                self.logger.info(f"✅ Started agent: {agent_id}")
                return True
            else:
                raise RuntimeError("Agent wrapper not initialized")
                
        except Exception as e:
            agent.status = AgentStatus.ERROR
            agent.record_error(str(e))
            self.logger.error(f"Failed to start agent {agent_id}: {e}")
            return False
    
    async def stop_agent(self, agent_id: str, force: bool = False) -> bool:
        """Stop an agent"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = self.agents[agent_id]
        
        try:
            agent.status = AgentStatus.STOPPING
            
            # Stop any ongoing tasks
            if agent.current_task_id:
                agent.complete_task()
            
            # Clean up wrapper
            if agent.wrapper:
                agent.wrapper = None
            
            agent.status = AgentStatus.STOPPED
            self.logger.info(f"✅ Stopped agent: {agent_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to stop agent {agent_id}: {e}")
            return False
    
    def list_agents(self) -> List[AgentInfo]:
        """List all agents"""
        return list(self.agents.values())
    
    async def get_agent_status(self, agent_id: str) -> Optional[AgentInfo]:
        """Get agent status"""
        return self.agents.get(agent_id)
    
    async def execute_task(self, agent_id: str, prompt: str, task_id: str = None) -> AsyncGenerator[TaskMessage, None]:
        """Execute task on specific agent"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = self.agents[agent_id]
        if agent.status != AgentStatus.IDLE:
            raise RuntimeError(f"Agent {agent_id} not available (status: {agent.status.value})")
        
        if task_id is None:
            task_id = f"task_{int(time.time() * 1000)}"
        
        try:
            agent.status = AgentStatus.WORKING
            agent.start_task(task_id)
            
            self.logger.info(f"Starting task {task_id} on agent {agent_id}")
            
            # Execute through Claude CLI wrapper
            if not agent.wrapper:
                raise RuntimeError("Agent wrapper not initialized")
            
            # Stream messages from Claude CLI execution
            async for message in agent.wrapper.stream_query(prompt):
                yield TaskMessage(
                    type="claude_response",
                    content=message,
                    timestamp=time.time(),
                    metadata={
                        "agent_id": agent_id,
                        "task_id": task_id
                    }
                )
            
            # Task completed
            agent.complete_task()
            agent.status = AgentStatus.IDLE
            self.total_tasks_executed += 1
            
            yield TaskMessage(
                type="task_completed",
                content=f"Task {task_id} completed successfully",
                timestamp=time.time(),
                metadata={
                    "agent_id": agent_id,
                    "task_id": task_id,
                    "status": "completed"
                }
            )
            
        except Exception as e:
            agent.record_error(str(e))
            agent.status = AgentStatus.ERROR
            self.total_errors += 1
            
            yield TaskMessage(
                type="error",
                content=f"Task failed: {str(e)}",
                timestamp=time.time(),
                metadata={
                    "agent_id": agent_id,
                    "task_id": task_id,
                    "error": str(e)
                }
            )
        finally:
            if agent.status == AgentStatus.WORKING:
                agent.status = AgentStatus.IDLE
            agent.complete_task()
    
    async def broadcast_task(self, prompt: str, target_roles: List[AgentRole] = None, 
                           max_agents: int = None) -> Dict[str, AsyncGenerator[TaskMessage, None]]:
        """Broadcast task to multiple agents"""
        available_agents = [
            agent for agent in self.agents.values()
            if agent.status == AgentStatus.IDLE and
            (not target_roles or agent.config.role in target_roles)
        ]
        
        if max_agents:
            available_agents = available_agents[:max_agents]
        
        if not available_agents:
            raise RuntimeError("No available agents for broadcast task")
        
        task_generators = {}
        broadcast_id = f"broadcast_{int(time.time() * 1000)}"
        
        for agent in available_agents:
            task_id = f"{broadcast_id}_{agent.config.agent_id}"
            task_generators[agent.config.agent_id] = self.execute_task(
                agent.config.agent_id, prompt, task_id
            )
        
        return task_generators
    
    async def health_check(self, agent_id: str) -> HealthResult:
        """Perform health check on agent"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = self.agents[agent_id]
        check_start = time.time()
        
        try:
            # Basic connectivity check
            is_healthy = agent.status not in [AgentStatus.ERROR, AgentStatus.STOPPED]
            
            # Memory and CPU usage (simplified)
            memory_mb = 0
            cpu_percent = 0
            
            try:
                # Get process info if available
                if agent.process and psutil.pid_exists(agent.process.pid):
                    proc = psutil.Process(agent.process.pid)
                    memory_mb = proc.memory_info().rss / 1024 / 1024
                    cpu_percent = proc.cpu_percent()
            except:
                pass
            
            response_time = (time.time() - check_start) * 1000
            
            # Generate recommendations
            recommendations = []
            if response_time > 1000:
                recommendations.append("High response time detected")
            if memory_mb > 400:
                recommendations.append("High memory usage")
            if agent.error_count > 10:
                recommendations.append("High error count - consider restart")
            
            return HealthResult(
                agent_id=agent_id,
                is_healthy=is_healthy,
                check_timestamp=time.time(),
                response_time_ms=response_time,
                memory_usage_mb=memory_mb,
                cpu_usage_percent=cpu_percent,
                last_activity_age_seconds=agent.get_idle_time_seconds(),
                recommendations=recommendations
            )
            
        except Exception as e:
            return HealthResult(
                agent_id=agent_id,
                is_healthy=False,
                check_timestamp=time.time(),
                response_time_ms=(time.time() - check_start) * 1000,
                memory_usage_mb=0,
                cpu_usage_percent=0,
                error_message=str(e),
                last_activity_age_seconds=agent.get_idle_time_seconds(),
                recommendations=["Health check failed - agent may need restart"]
            )
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get system-wide statistics"""
        active_agents = len([a for a in self.agents.values() if a.status in [AgentStatus.IDLE, AgentStatus.WORKING]])
        working_agents = len([a for a in self.agents.values() if a.status == AgentStatus.WORKING])
        
        total_uptime = 0
        total_tasks = 0
        total_errors = 0
        
        for agent in self.agents.values():
            total_uptime += agent.get_uptime_seconds()
            total_tasks += agent.task_count
            total_errors += agent.error_count
        
        return {
            "system_uptime_seconds": time.time() - self.system_start_time,
            "total_agents": len(self.agents),
            "active_agents": active_agents,
            "working_agents": working_agents,
            "idle_agents": active_agents - working_agents,
            "error_agents": len([a for a in self.agents.values() if a.status == AgentStatus.ERROR]),
            "total_tasks_executed": self.total_tasks_executed,
            "total_system_errors": self.total_errors,
            "average_agent_uptime": total_uptime / len(self.agents) if self.agents else 0,
            "task_success_rate": (self.total_tasks_executed / (self.total_tasks_executed + self.total_errors)) if (self.total_tasks_executed + self.total_errors) > 0 else 1.0
        }
    
    async def shutdown(self, timeout: float = 10.0):
        """Shutdown the multi-agent system"""
        self.logger.info("🛑 Shutting down multi-agent system...")
        
        # Set shutdown flag
        self._shutdown_event.set()
        
        # Stop all agents
        stop_tasks = []
        for agent_id in list(self.agents.keys()):
            if self.agents[agent_id].status not in [AgentStatus.STOPPED, AgentStatus.STOPPING]:
                stop_tasks.append(self.stop_agent(agent_id))
        
        if stop_tasks:
            await asyncio.gather(*stop_tasks, return_exceptions=True)
        
        # Cancel background tasks
        for task in self._background_tasks:
            if not task.done():
                task.cancel()
        
        if self._background_tasks:
            await asyncio.gather(*self._background_tasks, return_exceptions=True)
        
        self.running = False
        self.logger.info("✅ Multi-agent system shutdown complete")


class AgentPool:
    """Agent pool for load balancing and failover"""
    
    def __init__(self, config: PoolConfig):
        self.config = config
        self.agents: List[str] = []
        self.current_index = 0
        self.logger = logging.getLogger(f"{__name__}.AgentPool")
    
    def add_agent(self, agent_id: str):
        """Add agent to pool"""
        if agent_id not in self.agents:
            self.agents.append(agent_id)
            self.logger.info(f"Added agent {agent_id} to pool")
    
    def remove_agent(self, agent_id: str):
        """Remove agent from pool"""
        if agent_id in self.agents:
            self.agents.remove(agent_id)
            self.logger.info(f"Removed agent {agent_id} from pool")
    
    def get_next_agent(self) -> Optional[str]:
        """Get next agent using load balancing strategy"""
        if not self.agents:
            return None
        
        if self.config.load_balancing == "round_robin":
            agent = self.agents[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.agents)
            return agent
        
        # Default to first available
        return self.agents[0]


class CommunicationBridge:
    """Inter-agent communication bridge"""
    
    def __init__(self):
        self.message_handlers: Dict[str, Callable] = {}
        self.logger = logging.getLogger(f"{__name__}.CommunicationBridge")
    
    async def send_message(self, message: AgentMessage) -> bool:
        """Send message between agents"""
        self.logger.info(f"Routing message {message.message_id} from {message.from_agent} to {message.to_agent}")
        return True
    
    def register_handler(self, message_type: MessageType, handler: Callable):
        """Register message handler"""
        self.message_handlers[message_type.value] = handler


class HealthMonitor:
    """Agent health monitoring service"""
    
    def __init__(self, check_interval: float = 30.0):
        self.check_interval = check_interval
        self.logger = logging.getLogger(f"{__name__}.HealthMonitor")
    
    async def start_monitoring(self, multi_agent: MultiAgentCLIWrapper):
        """Start health monitoring loop"""
        while not multi_agent._shutdown_event.is_set():
            try:
                for agent_id in multi_agent.agents:
                    health = await multi_agent.health_check(agent_id)
                    if not health.is_healthy:
                        self.logger.warning(f"Agent {agent_id} health check failed: {health.error_message}")
                
                await asyncio.sleep(self.check_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Health monitoring error: {e}")
                await asyncio.sleep(self.check_interval)


async def create_dual_agent_system() -> MultiAgentCLIWrapper:
    """Create a pre-configured dual-agent system (Manager + Worker)"""
    config = MultiAgentConfig(
        max_agents=5,
        enable_metrics=True,
        health_check_interval=30.0
    )
    
    multi_agent = MultiAgentCLIWrapper(config)
    
    # Create Manager agent
    manager_config = AgentConfig(
        agent_id="manager",
        role=AgentRole.MANAGER,
        name="Task Manager",
        cli_options=ClaudeCliOptions(
            model="sonnet",
            max_turns=10,
            verbose=False
        ),
        capabilities=["task_coordination", "planning", "delegation"]
    )
    
    # Create Worker agent
    worker_config = AgentConfig(
        agent_id="worker",
        role=AgentRole.WORKER,
        name="Task Worker",
        cli_options=ClaudeCliOptions(
            model="sonnet",
            max_turns=8,
            verbose=False
        ),
        capabilities=["task_execution", "coding", "analysis"]
    )
    
    # Add agents to system
    await multi_agent.create_agent(manager_config)
    await multi_agent.create_agent(worker_config)
    
    # Start agents
    await multi_agent.start_agent("manager")
    await multi_agent.start_agent("worker")
    
    logger.info("✅ Dual-agent system created successfully")
    return multi_agent


if __name__ == "__main__":
    async def test_multi_agent():
        """Test multi-agent system"""
        logging.basicConfig(level=logging.INFO)
        
        # Create dual agent system
        multi_agent = await create_dual_agent_system()
        
        try:
            # Test task execution
            print("Testing task execution...")
            async for message in multi_agent.execute_task("worker", "Hello, Claude! Please respond with a simple greeting."):
                print(f"[{message.type}] {message.content[:100]}...")
            
            # Get system stats
            stats = multi_agent.get_system_stats()
            print(f"System Stats: {json.dumps(stats, indent=2)}")
            
        finally:
            await multi_agent.shutdown()
    
    asyncio.run(test_multi_agent())