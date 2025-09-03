"""
Agent manager for handling multi-agent orchestration,
task assignment, and inter-agent communication.
"""

import asyncio
import logging
import time
import uuid
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from .message_protocol import (
    Message, MessageType, MessageProtocol, AgentInfo, AgentType, 
    TaskInfo, TaskStatus
)
import sys
import os
# Add the python-sdk root directory to path to find claude_cli_wrapper
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
try:
    from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions
except ImportError:
    # Fallback for when running from different directories
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
        from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions
    except ImportError as e:
        logger.error(f"Failed to import claude_cli_wrapper: {e}")
        raise ImportError("Could not import claude_cli_wrapper. Make sure it's in the python-sdk directory.")


logger = logging.getLogger(__name__)


class AgentStatus(Enum):
    """Agent status enumeration"""
    INITIALIZING = "initializing"
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    STOPPING = "stopping"
    STOPPED = "stopped"


@dataclass
class ManagedAgent:
    """Managed agent instance"""
    info: AgentInfo
    wrapper: ClaudeCliWrapper
    status: AgentStatus = AgentStatus.INITIALIZING
    current_task: Optional[TaskInfo] = None
    message_handlers: Dict[MessageType, List[Callable]] = field(default_factory=dict)
    execution_task: Optional[asyncio.Task] = None
    last_heartbeat: datetime = field(default_factory=datetime.now)
    
    def add_message_handler(self, msg_type: MessageType, handler: Callable):
        """Add message handler for this agent"""
        if msg_type not in self.message_handlers:
            self.message_handlers[msg_type] = []
        self.message_handlers[msg_type].append(handler)
    
    async def execute_command(self, command: str, parameters: Dict[str, Any] = None) -> Any:
        """Execute command on this agent"""
        if self.status != AgentStatus.IDLE:
            raise RuntimeError(f"Agent {self.info.id} is not available (status: {self.status})")
        
        self.status = AgentStatus.BUSY
        try:
            # Build prompt from command and parameters
            if parameters:
                param_str = "\n".join([f"{k}: {v}" for k, v in parameters.items()])
                prompt = f"{command}\n\nParameters:\n{param_str}"
            else:
                prompt = command
            
            # Execute via CLI wrapper
            result = await self.wrapper.execute_sync(prompt)
            self.status = AgentStatus.IDLE
            return result
        
        except Exception as e:
            self.status = AgentStatus.ERROR
            logger.error(f"Error executing command on agent {self.info.id}: {e}")
            raise
    
    async def execute_task(self, task: TaskInfo) -> Any:
        """Execute a task on this agent"""
        if self.current_task:
            raise RuntimeError(f"Agent {self.info.id} already has a task assigned")
        
        self.current_task = task
        task.assigned_agent = self.info.id
        task.status = TaskStatus.IN_PROGRESS
        task.started_at = datetime.now()
        
        try:
            self.status = AgentStatus.BUSY
            
            # Build prompt from task
            prompt = f"Task: {task.title}\n\nDescription:\n{task.description}"
            if task.metadata:
                metadata_str = "\n".join([f"{k}: {v}" for k, v in task.metadata.items()])
                prompt += f"\n\nAdditional Information:\n{metadata_str}"
            
            # Execute task
            result = await self.wrapper.execute_sync(prompt)
            
            # Update task
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now()
            task.result = result
            task.progress = 1.0
            
            self.status = AgentStatus.IDLE
            self.current_task = None
            
            return result
            
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.completed_at = datetime.now()
            task.error = str(e)
            self.status = AgentStatus.ERROR
            self.current_task = None
            raise
    
    def update_heartbeat(self):
        """Update agent heartbeat timestamp"""
        self.last_heartbeat = datetime.now()
        self.info.last_activity = self.last_heartbeat


class AgentManager:
    """
    Manages multiple Claude CLI agent instances with task distribution,
    inter-agent communication, and health monitoring.
    """
    
    def __init__(self):
        self.agents: Dict[str, ManagedAgent] = {}
        self.tasks: Dict[str, TaskInfo] = {}
        self.task_queue: List[TaskInfo] = []
        self.message_handlers: Dict[MessageType, List[Callable]] = {}
        self.running = False
        self.health_check_task: Optional[asyncio.Task] = None
        self.task_dispatcher_task: Optional[asyncio.Task] = None
        
        # Statistics
        self.stats = {
            'agents_created': 0,
            'tasks_completed': 0,
            'tasks_failed': 0,
            'messages_processed': 0,
            'uptime_start': datetime.now()
        }
    
    async def start(self):
        """Start the agent manager"""
        self.running = True
        self.health_check_task = asyncio.create_task(self._health_check_loop())
        self.task_dispatcher_task = asyncio.create_task(self._task_dispatcher_loop())
        logger.info("Agent manager started")
    
    async def stop(self):
        """Stop the agent manager and clean up all agents"""
        self.running = False
        
        # Cancel background tasks
        for task in [self.health_check_task, self.task_dispatcher_task]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # Stop all agents
        stop_tasks = []
        for agent_id in list(self.agents.keys()):
            stop_tasks.append(self.stop_agent(agent_id))
        
        if stop_tasks:
            await asyncio.gather(*stop_tasks, return_exceptions=True)
        
        logger.info("Agent manager stopped")
    
    async def create_agent(
        self,
        agent_type: AgentType,
        model: str = "sonnet",
        capabilities: List[str] = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Create a new agent instance"""
        
        agent_id = f"{agent_type.value}-{int(time.time())}-{uuid.uuid4().hex[:8]}"
        
        # Create CLI options
        options = ClaudeCliOptions(
            model=model,
            verbose=True,
            dangerously_skip_permissions=False,
            timeout=300
        )
        
        # Create CLI wrapper
        wrapper = ClaudeCliWrapper(options)
        
        # Create agent info
        info = AgentInfo(
            id=agent_id,
            type=agent_type,
            status=AgentStatus.INITIALIZING.value,
            created_at=datetime.now(),
            last_activity=datetime.now(),
            model=model,
            capabilities=capabilities or [],
            metrics={}
        )
        
        # Create managed agent
        agent = ManagedAgent(info=info, wrapper=wrapper)
        
        # Test agent availability
        try:
            # Simple availability test
            test_result = await wrapper.execute_sync("Reply with 'OK' if you can process requests.")
            if "ok" in test_result.lower():
                agent.status = AgentStatus.IDLE
                info.status = AgentStatus.IDLE.value
            else:
                raise RuntimeError("Agent failed availability test")
        
        except Exception as e:
            agent.status = AgentStatus.ERROR
            info.status = AgentStatus.ERROR.value
            logger.error(f"Failed to initialize agent {agent_id}: {e}")
            raise
        
        # Register agent
        self.agents[agent_id] = agent
        self.stats['agents_created'] += 1
        
        logger.info(f"Created {agent_type.value} agent: {agent_id}")
        return agent_id
    
    async def stop_agent(self, agent_id: str) -> bool:
        """Stop and remove an agent"""
        if agent_id not in self.agents:
            return False
        
        agent = self.agents[agent_id]
        agent.status = AgentStatus.STOPPING
        
        # Cancel any running task
        if agent.execution_task:
            agent.execution_task.cancel()
            try:
                await agent.execution_task
            except asyncio.CancelledError:
                pass
        
        # Cleanup CLI wrapper
        try:
            await agent.wrapper.cleanup()
        except Exception as e:
            logger.error(f"Error cleaning up agent {agent_id}: {e}")
        
        # Remove from registry
        del self.agents[agent_id]
        agent.status = AgentStatus.STOPPED
        
        logger.info(f"Stopped agent: {agent_id}")
        return True
    
    def get_agent(self, agent_id: str) -> Optional[ManagedAgent]:
        """Get agent by ID"""
        return self.agents.get(agent_id)
    
    def get_agents_by_type(self, agent_type: AgentType) -> List[ManagedAgent]:
        """Get all agents of specific type"""
        return [
            agent for agent in self.agents.values() 
            if agent.info.type == agent_type
        ]
    
    def get_available_agents(self, agent_type: Optional[AgentType] = None) -> List[ManagedAgent]:
        """Get all available (idle) agents"""
        available = [
            agent for agent in self.agents.values() 
            if agent.status == AgentStatus.IDLE
        ]
        
        if agent_type:
            available = [
                agent for agent in available 
                if agent.info.type == agent_type
            ]
        
        return available
    
    async def execute_command(
        self,
        agent_id: str,
        command: str,
        parameters: Dict[str, Any] = None,
        correlation_id: str = None
    ) -> Any:
        """Execute command on specific agent"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = self.agents[agent_id]
        return await agent.execute_command(command, parameters)
    
    async def assign_task(
        self,
        task: TaskInfo,
        agent_id: Optional[str] = None,
        agent_type: Optional[AgentType] = None
    ) -> bool:
        """Assign task to specific agent or find available agent"""
        
        # Find target agent
        target_agent = None
        
        if agent_id:
            target_agent = self.agents.get(agent_id)
            if not target_agent:
                raise ValueError(f"Agent {agent_id} not found")
        else:
            # Find available agent of specified type
            available_agents = self.get_available_agents(agent_type)
            if not available_agents:
                # Add to queue if no agents available
                self.task_queue.append(task)
                logger.info(f"Task {task.id} queued - no available agents")
                return False
            
            target_agent = available_agents[0]  # Simple selection strategy
        
        # Check if agent is available
        if target_agent.status != AgentStatus.IDLE:
            self.task_queue.append(task)
            logger.info(f"Task {task.id} queued - agent {target_agent.info.id} busy")
            return False
        
        # Assign task
        self.tasks[task.id] = task
        
        # Execute task asynchronously
        async def execute_task_wrapper():
            try:
                result = await target_agent.execute_task(task)
                self.stats['tasks_completed'] += 1
                logger.info(f"Task {task.id} completed by {target_agent.info.id}")
                
                # Notify handlers
                message = MessageProtocol.create_task_update_message(task)
                await self._handle_message(message)
                
            except Exception as e:
                self.stats['tasks_failed'] += 1
                logger.error(f"Task {task.id} failed on {target_agent.info.id}: {e}")
                
                # Notify handlers
                message = MessageProtocol.create_task_update_message(task)
                await self._handle_message(message)
        
        target_agent.execution_task = asyncio.create_task(execute_task_wrapper())
        
        logger.info(f"Task {task.id} assigned to {target_agent.info.id}")
        return True
    
    def create_task(
        self,
        title: str,
        description: str,
        metadata: Dict[str, Any] = None
    ) -> TaskInfo:
        """Create a new task"""
        task = TaskInfo(
            id=f"task-{int(time.time())}-{uuid.uuid4().hex[:8]}",
            title=title,
            description=description,
            metadata=metadata or {}
        )
        return task
    
    async def send_agent_message(
        self,
        from_agent_id: str,
        to_agent_id: str,
        content: str,
        message_type: str = "communication"
    ) -> bool:
        """Send message between agents"""
        if from_agent_id not in self.agents or to_agent_id not in self.agents:
            return False
        
        message = MessageProtocol.create_agent_message(
            from_agent_id, to_agent_id, content, message_type
        )
        
        await self._handle_message(message)
        return True
    
    def register_message_handler(
        self,
        message_type: MessageType,
        handler: Callable[[Message], Any]
    ):
        """Register message handler"""
        if message_type not in self.message_handlers:
            self.message_handlers[message_type] = []
        self.message_handlers[message_type].append(handler)
    
    async def _handle_message(self, message: Message):
        """Handle internal message routing"""
        self.stats['messages_processed'] += 1
        
        handlers = self.message_handlers.get(message.type, [])
        for handler in handlers:
            try:
                await handler(message)
            except Exception as e:
                logger.error(f"Error in message handler for {message.type}: {e}")
    
    def get_agent_status(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of an agent"""
        if agent_id not in self.agents:
            return None
        
        agent = self.agents[agent_id]
        info = agent.info.to_dict()
        info['status'] = agent.status.value
        info['current_task'] = agent.current_task.to_dict() if agent.current_task else None
        info['last_heartbeat'] = agent.last_heartbeat.isoformat()
        
        return info
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get overall system status"""
        agent_stats = {
            'total': len(self.agents),
            'by_status': {},
            'by_type': {}
        }
        
        for agent in self.agents.values():
            # Count by status
            status = agent.status.value
            agent_stats['by_status'][status] = agent_stats['by_status'].get(status, 0) + 1
            
            # Count by type
            agent_type = agent.info.type.value
            agent_stats['by_type'][agent_type] = agent_stats['by_type'].get(agent_type, 0) + 1
        
        task_stats = {
            'total': len(self.tasks),
            'queued': len(self.task_queue),
            'by_status': {}
        }
        
        for task in self.tasks.values():
            status = task.status.value
            task_stats['by_status'][status] = task_stats['by_status'].get(status, 0) + 1
        
        uptime = (datetime.now() - self.stats['uptime_start']).total_seconds()
        
        return {
            'agents': agent_stats,
            'tasks': task_stats,
            'statistics': {
                **self.stats,
                'uptime': uptime
            },
            'running': self.running
        }
    
    async def _health_check_loop(self):
        """Background health check loop"""
        while self.running:
            try:
                await self._perform_health_checks()
                await asyncio.sleep(30)  # Health check every 30 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
                await asyncio.sleep(5)
    
    async def _perform_health_checks(self):
        """Perform health checks on all agents"""
        current_time = datetime.now()
        
        for agent_id, agent in list(self.agents.items()):
            # Update heartbeat
            agent.update_heartbeat()
            
            # Check for stuck agents (been busy too long)
            if (agent.status == AgentStatus.BUSY and 
                agent.current_task and 
                agent.current_task.started_at and
                (current_time - agent.current_task.started_at).total_seconds() > 600):  # 10 minutes
                
                logger.warning(f"Agent {agent_id} has been busy for too long, checking status")
                
                # Could implement more sophisticated stuck detection here
                # For now, just log the warning
    
    async def _task_dispatcher_loop(self):
        """Background task dispatcher loop"""
        while self.running:
            try:
                await self._dispatch_queued_tasks()
                await asyncio.sleep(5)  # Check queue every 5 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in task dispatcher loop: {e}")
                await asyncio.sleep(5)
    
    async def _dispatch_queued_tasks(self):
        """Dispatch tasks from queue to available agents"""
        if not self.task_queue:
            return
        
        # Get available agents
        available_agents = self.get_available_agents()
        if not available_agents:
            return
        
        # Dispatch tasks
        dispatched = []
        for i, task in enumerate(self.task_queue):
            if i >= len(available_agents):
                break  # No more available agents
            
            try:
                if await self.assign_task(task):
                    dispatched.append(task)
            except Exception as e:
                logger.error(f"Error dispatching task {task.id}: {e}")
        
        # Remove dispatched tasks from queue
        for task in dispatched:
            self.task_queue.remove(task)