"""
Integration with Automatic Claude Code System
Provides seamless integration with your existing dual-agent architecture
"""

import asyncio
import json
from typing import Optional, Dict, Any, AsyncGenerator, Callable
import logging
import time

from ..core.client import ClaudeCodeClient
from ..core.options import ClaudeCodeOptions, create_dual_agent_options
from ..core.messages import Message, ResultMessage, ErrorMessage
from ..interfaces.streaming import StreamingHandler, MessageCollector
from .monitoring import MonitoringIntegration

logger = logging.getLogger(__name__)

class AutomaticClaudeIntegration:
    """
    Integration layer for Automatic Claude Code system
    
    Provides compatibility with existing dual-agent architecture,
    monitoring systems, and performance tracking.
    """
    
    def __init__(self,
                 monitoring_port: int = 6011,
                 api_port: int = 4005,
                 enable_dual_agent: bool = True,
                 enable_monitoring: bool = True,
                 session_id: Optional[str] = None):
        """
        Initialize integration
        
        Args:
            monitoring_port: Port for monitoring dashboard
            api_port: Port for API server
            enable_dual_agent: Enable dual-agent mode
            enable_monitoring: Enable monitoring integration
            session_id: Session ID for tracking
        """
        self.monitoring_port = monitoring_port
        self.api_port = api_port
        self.enable_dual_agent = enable_dual_agent
        self.enable_monitoring = enable_monitoring
        self.session_id = session_id or f"python-sdk-{int(time.time())}"
        
        # Initialize monitoring if enabled
        self.monitoring = None
        if enable_monitoring:
            self.monitoring = MonitoringIntegration(
                monitoring_port=monitoring_port,
                api_port=api_port
            )
        
        # Execution statistics
        self._stats = {
            'total_executions': 0,
            'successful_executions': 0,
            'failed_executions': 0,
            'average_execution_time': 0.0,
            'total_tokens_used': 0
        }
    
    async def execute_with_monitoring(self,
                                    prompt: str,
                                    agent_role: str = "worker",
                                    **options) -> Dict[str, Any]:
        """
        Execute a prompt with full monitoring integration
        
        Args:
            prompt: The prompt to execute
            agent_role: Role in dual-agent system ("manager" or "worker")
            **options: Additional execution options
        
        Returns:
            Dict with execution results and metadata
        """
        execution_start = time.time()
        self._stats['total_executions'] += 1
        
        try:
            # Create options for dual-agent mode if enabled
            if self.enable_dual_agent:
                claude_options = create_dual_agent_options(
                    agent_role=agent_role,
                    session_id=self.session_id,
                    enable_monitoring=self.enable_monitoring,
                    monitoring_port=self.monitoring_port,
                    **options
                )
            else:
                claude_options = ClaudeCodeOptions(
                    session_id=self.session_id,
                    enable_monitoring=self.enable_monitoring,
                    monitoring_port=self.monitoring_port,
                    **options
                )
            
            # Set up monitoring
            collector = MessageCollector()
            
            def on_message(message: Message):
                collector.add_message(message)
                if self.monitoring:
                    asyncio.create_task(self.monitoring.send_message_event(message, self.session_id))
            
            # Execute the query
            final_result = ""
            error_message = None
            
            async with ClaudeCodeClient(claude_options) as client:
                if self.monitoring:
                    await self.monitoring.send_execution_start_event(prompt, self.session_id, agent_role)
                
                async for message in client.query(prompt, on_message=on_message):
                    if isinstance(message, ResultMessage):
                        final_result = message.result
                    elif isinstance(message, ErrorMessage):
                        error_message = message.error
            
            # Calculate execution time
            execution_time = time.time() - execution_start
            success = error_message is None
            
            if success:
                self._stats['successful_executions'] += 1
            else:
                self._stats['failed_executions'] += 1
            
            # Update average execution time
            total_time = self._stats['average_execution_time'] * (self._stats['total_executions'] - 1)
            self._stats['average_execution_time'] = (total_time + execution_time) / self._stats['total_executions']
            
            # Send completion event
            if self.monitoring:
                await self.monitoring.send_execution_complete_event(
                    success=success,
                    execution_time=execution_time,
                    session_id=self.session_id,
                    error=error_message
                )
            
            # Return comprehensive result
            result = {
                'success': success,
                'final_result': final_result,
                'error': error_message,
                'execution_time': execution_time,
                'session_id': self.session_id,
                'agent_role': agent_role if self.enable_dual_agent else None,
                'message_count': len(collector.messages),
                'messages': [msg.to_dict() for msg in collector.messages],
                'summary': collector.get_summary(),
                'monitoring_enabled': self.enable_monitoring
            }
            
            logger.info(f"Execution completed: {success}, time: {execution_time:.2f}s, messages: {len(collector.messages)}")
            return result
            
        except Exception as e:
            execution_time = time.time() - execution_start
            self._stats['failed_executions'] += 1
            
            error_result = {
                'success': False,
                'final_result': '',
                'error': str(e),
                'execution_time': execution_time,
                'session_id': self.session_id,
                'agent_role': agent_role if self.enable_dual_agent else None,
                'message_count': 0,
                'messages': [],
                'summary': {},
                'monitoring_enabled': self.enable_monitoring
            }
            
            if self.monitoring:
                await self.monitoring.send_execution_complete_event(
                    success=False,
                    execution_time=execution_time,
                    session_id=self.session_id,
                    error=str(e)
                )
            
            logger.error(f"Execution failed: {e}")
            return error_result
    
    async def execute_dual_agent_session(self,
                                       task_description: str,
                                       max_iterations: int = 10) -> Dict[str, Any]:
        """
        Execute a dual-agent session with Manager and Worker coordination
        
        Args:
            task_description: High-level task description
            max_iterations: Maximum coordination iterations
        
        Returns:
            Dict with session results
        """
        session_start = time.time()
        session_id = f"{self.session_id}-dual-{int(session_start)}"
        
        logger.info(f"Starting dual-agent session: {task_description}")
        
        # Manager agent: Break down the task
        manager_prompt = f"""
        As a Manager Agent, break down this task into specific actionable steps:
        
        Task: {task_description}
        
        Provide a clear execution plan with numbered steps that a Worker Agent can follow.
        """
        
        manager_result = await self.execute_with_monitoring(
            manager_prompt,
            agent_role="manager",
            session_id=session_id
        )
        
        if not manager_result['success']:
            return {
                'success': False,
                'error': 'Manager agent failed to create execution plan',
                'manager_result': manager_result,
                'worker_results': []
            }
        
        execution_plan = manager_result['final_result']
        worker_results = []
        
        # Worker agent: Execute the plan
        for iteration in range(max_iterations):
            worker_prompt = f"""
            Execute the next step from this plan:
            
            {execution_plan}
            
            Previous work completed:
            {chr(10).join(f"Step {i+1}: {result.get('summary', 'Completed')}" for i, result in enumerate(worker_results))}
            
            Continue with the next logical step. If the task is complete, clearly state "TASK COMPLETED".
            """
            
            worker_result = await self.execute_with_monitoring(
                worker_prompt,
                agent_role="worker",
                session_id=f"{session_id}-worker-{iteration}"
            )
            
            worker_results.append(worker_result)
            
            # Check if task is completed
            if worker_result['success'] and 'TASK COMPLETED' in worker_result['final_result']:
                logger.info(f"Dual-agent session completed after {iteration + 1} iterations")
                break
            
            if not worker_result['success']:
                logger.warning(f"Worker iteration {iteration + 1} failed: {worker_result['error']}")
        
        session_time = time.time() - session_start
        success = all(result['success'] for result in worker_results)
        
        return {
            'success': success,
            'session_id': session_id,
            'task_description': task_description,
            'execution_plan': execution_plan,
            'manager_result': manager_result,
            'worker_results': worker_results,
            'total_iterations': len(worker_results),
            'session_time': session_time,
            'final_result': worker_results[-1]['final_result'] if worker_results else ''
        }
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get execution statistics"""
        return {
            **self._stats,
            'success_rate': (
                self._stats['successful_executions'] / self._stats['total_executions']
                if self._stats['total_executions'] > 0 else 0.0
            ),
            'session_id': self.session_id,
            'monitoring_enabled': self.enable_monitoring,
            'dual_agent_enabled': self.enable_dual_agent
        }
    
    def reset_statistics(self) -> None:
        """Reset execution statistics"""
        self._stats = {
            'total_executions': 0,
            'successful_executions': 0,
            'failed_executions': 0,
            'average_execution_time': 0.0,
            'total_tokens_used': 0
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on the integration"""
        health_info = {
            'integration_status': 'healthy',
            'monitoring_enabled': self.enable_monitoring,
            'dual_agent_enabled': self.enable_dual_agent,
            'session_id': self.session_id,
            'statistics': self.get_statistics()
        }
        
        # Check monitoring health if enabled
        if self.monitoring:
            monitoring_health = await self.monitoring.health_check()
            health_info['monitoring_health'] = monitoring_health
        
        return health_info