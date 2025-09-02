#!/usr/bin/env python3
"""
Integration with automatic-claude-code System
============================================

This example demonstrates how to integrate the ClaudeSDKClient with the 
automatic-claude-code dual-agent architecture, monitoring system, and 
task coordination features.

Requirements:
    - Python 3.10+
    - Claude Code CLI installed and configured
    - automatic-claude-code system running
    - claude-code-sdk package installed
    - Monitoring server running (optional)

Usage:
    # Start monitoring server first (in another terminal):
    # cd dual-agent-monitor && pnpm run dev
    
    python integration_with_automatic_claude.py
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from claude_code_sdk import ClaudeSDKClient
from claude_code_sdk.core.options import create_dual_agent_options, create_production_options
from claude_code_sdk.integrations.automatic_claude import AutomaticClaudeIntegration
from claude_code_sdk.integrations.monitoring import MonitoringIntegration
from claude_code_sdk.exceptions import ClaudeCodeError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class TaskResult:
    """Represents the result of a task execution."""
    task_id: str
    success: bool
    result: Optional[str] = None
    error: Optional[str] = None
    duration: Optional[float] = None
    agent_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class IntegrationManager:
    """
    Manages integration between ClaudeSDKClient and automatic-claude-code system.
    """
    
    def __init__(self, enable_monitoring: bool = True, enable_dual_agent: bool = True):
        self.enable_monitoring = enable_monitoring
        self.enable_dual_agent = enable_dual_agent
        self.session_id = f"integration_session_{int(time.time())}"
        self.task_results: List[TaskResult] = []
        
    async def setup_integrations(self) -> Dict[str, Any]:
        """Set up all integrations and return status."""
        status = {
            'client_ready': False,
            'monitoring_ready': False,
            'dual_agent_ready': False,
            'errors': []
        }
        
        try:
            # Setup monitoring integration
            if self.enable_monitoring:
                self.monitoring = MonitoringIntegration(
                    dashboard_url="http://localhost:6011",
                    api_url="http://localhost:4005"
                )
                monitoring_status = await self.monitoring.check_connection()
                status['monitoring_ready'] = monitoring_status.get('connected', False)
                if not status['monitoring_ready']:
                    status['errors'].append("Monitoring server not available")
            
            # Setup automatic claude integration
            self.integration = AutomaticClaudeIntegration(
                enable_dual_agent=self.enable_dual_agent,
                enable_monitoring=self.enable_monitoring,
                session_id=self.session_id
            )
            
            # Test integration readiness
            integration_status = await self.integration.test_connection()
            status['client_ready'] = integration_status.get('claude_cli_available', False)
            status['dual_agent_ready'] = integration_status.get('dual_agent_capable', False)
            
            if not status['client_ready']:
                status['errors'].append("Claude CLI not available")
                
        except Exception as e:
            status['errors'].append(f"Integration setup failed: {e}")
            
        return status


async def basic_integration_example():
    """
    Demonstrates basic integration with the automatic-claude-code system.
    """
    print("🔵 Basic Integration Example")
    print("=" * 40)
    
    manager = IntegrationManager(enable_monitoring=False, enable_dual_agent=False)
    
    try:
        # Setup integrations
        status = await manager.setup_integrations()
        
        print(f"Integration Status:")
        print(f"  Client Ready: {'✅' if status['client_ready'] else '❌'}")
        print(f"  Errors: {status['errors'] if status['errors'] else 'None'}")
        
        if not status['client_ready']:
            print("❌ Cannot proceed without Claude CLI")
            return
            
        # Execute a simple task through integration
        print("\n🚀 Executing task through integration...")
        
        result = await manager.integration.execute_with_monitoring(
            "Create a Python function to calculate the factorial of a number"
        )
        
        if result.get('success'):
            print("✅ Task completed successfully")
            print(f"Result preview: {result.get('result', '')[:150]}...")
        else:
            print("❌ Task failed")
            print(f"Error: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        print(f"❌ Integration error: {e}")
        
    print()


async def dual_agent_integration_example():
    """
    Demonstrates integration with dual-agent architecture.
    """
    print("🔵 Dual-Agent Integration Example")  
    print("=" * 40)
    
    manager = IntegrationManager(enable_monitoring=True, enable_dual_agent=True)
    
    try:
        # Setup with dual-agent support
        status = await manager.setup_integrations()
        
        print(f"Dual-Agent Integration Status:")
        print(f"  Client Ready: {'✅' if status['client_ready'] else '❌'}")
        print(f"  Dual-Agent Ready: {'✅' if status['dual_agent_ready'] else '❌'}")
        print(f"  Monitoring Ready: {'✅' if status['monitoring_ready'] else '❌'}")
        
        if not status['client_ready']:
            print("❌ Cannot proceed without Claude CLI")
            return
            
        # Create dual-agent options
        options = create_dual_agent_options(
            manager_model="claude-3-opus-20240229",
            worker_model="claude-3-sonnet-20241022",
            coordination_timeout=300
        )
        
        print("\n🤖 Starting dual-agent task...")
        
        # Execute complex task that benefits from dual-agent coordination
        complex_task = """
        Create a complete Python web application with the following features:
        1. FastAPI backend with user authentication
        2. SQLite database with user and post models
        3. JWT token authentication
        4. CRUD endpoints for posts
        5. Basic error handling and validation
        6. Unit tests for all endpoints
        """
        
        async with ClaudeSDKClient(options) as client:
            # This would coordinate with the dual-agent system
            response = await client.execute(complex_task)
            
            if response.success:
                print("✅ Dual-agent task completed")
                print(f"Response length: {len(response.result or '')} characters")
                
                # Log to monitoring system
                if manager.enable_monitoring and status['monitoring_ready']:
                    await manager.monitoring.log_task_completion({
                        'task_type': 'dual_agent_complex',
                        'success': True,
                        'duration': response.metadata.get('duration', 0),
                        'agent_coordination': True
                    })
                    
            else:
                print("❌ Dual-agent task failed")
                print(f"Error: {response.error}")
                
    except Exception as e:
        print(f"❌ Dual-agent integration error: {e}")
        
    print()


async def monitoring_integration_example():
    """
    Demonstrates integration with monitoring and observability features.
    """
    print("🔵 Monitoring Integration Example")
    print("=" * 40)
    
    manager = IntegrationManager(enable_monitoring=True, enable_dual_agent=False)
    
    try:
        status = await manager.setup_integrations()
        
        if not status['monitoring_ready']:
            print("🟡 Monitoring server not available - running without monitoring")
            print("   Start monitoring with: cd dual-agent-monitor && pnpm run dev")
        
        # Execute tasks with monitoring
        tasks = [
            ("file_processing", "Create a Python script to process CSV files and generate reports"),
            ("api_integration", "Write a Python client for a REST API with retry logic"),
            ("data_analysis", "Create functions for basic statistical analysis of datasets")
        ]
        
        print(f"\n📊 Executing {len(tasks)} monitored tasks...")
        
        for task_type, task_description in tasks:
            start_time = time.time()
            
            try:
                result = await manager.integration.execute_with_monitoring(
                    task_description,
                    task_metadata={'type': task_type, 'priority': 'normal'}
                )
                
                duration = time.time() - start_time
                
                task_result = TaskResult(
                    task_id=f"{task_type}_{int(start_time)}",
                    success=result.get('success', False),
                    result=result.get('result'),
                    error=result.get('error'),
                    duration=duration,
                    metadata={'type': task_type}
                )
                
                manager.task_results.append(task_result)
                
                print(f"  {'✅' if task_result.success else '❌'} {task_type}: "
                      f"{duration:.1f}s")
                
            except Exception as e:
                print(f"  ❌ {task_type}: Failed - {e}")
                
        # Generate monitoring report
        await generate_monitoring_report(manager)
        
    except Exception as e:
        print(f"❌ Monitoring integration error: {e}")
        
    print()


async def generate_monitoring_report(manager: IntegrationManager):
    """Generate and display monitoring report."""
    
    if not manager.task_results:
        print("📊 No task results to report")
        return
        
    print(f"\n📊 Monitoring Report ({manager.session_id}):")
    print("=" * 50)
    
    successful_tasks = [t for t in manager.task_results if t.success]
    failed_tasks = [t for t in manager.task_results if not t.success]
    
    total_duration = sum(t.duration or 0 for t in manager.task_results if t.duration)
    avg_duration = total_duration / len(manager.task_results) if manager.task_results else 0
    
    print(f"Total Tasks: {len(manager.task_results)}")
    print(f"Successful: {len(successful_tasks)} ({len(successful_tasks)/len(manager.task_results)*100:.1f}%)")
    print(f"Failed: {len(failed_tasks)}")
    print(f"Total Duration: {total_duration:.1f}s")
    print(f"Average Duration: {avg_duration:.1f}s")
    
    # Task details
    print(f"\nTask Details:")
    for task in manager.task_results:
        status_icon = "✅" if task.success else "❌"
        duration_str = f"{task.duration:.1f}s" if task.duration else "N/A"
        task_type = task.metadata.get('type', 'unknown') if task.metadata else 'unknown'
        
        print(f"  {status_icon} {task.task_id}: {task_type} - {duration_str}")
        if task.error:
            print(f"      Error: {task.error[:80]}...")
            
    # Send to monitoring system if available
    if manager.enable_monitoring:
        try:
            report_data = {
                'session_id': manager.session_id,
                'timestamp': time.time(),
                'summary': {
                    'total_tasks': len(manager.task_results),
                    'successful_tasks': len(successful_tasks),
                    'failed_tasks': len(failed_tasks),
                    'total_duration': total_duration,
                    'average_duration': avg_duration
                },
                'tasks': [asdict(task) for task in manager.task_results]
            }
            
            # This would send to monitoring dashboard
            print(f"\n📡 Monitoring report ready for dashboard")
            print(f"   Session ID: {manager.session_id}")
            
        except Exception as e:
            print(f"⚠️  Could not send to monitoring system: {e}")


async def task_coordination_example():
    """
    Demonstrates task coordination and workflow management.
    """
    print("🔵 Task Coordination Example")
    print("=" * 40)
    
    manager = IntegrationManager(enable_monitoring=True, enable_dual_agent=True)
    
    try:
        status = await manager.setup_integrations()
        
        if not status['client_ready']:
            print("❌ Cannot proceed without Claude CLI")
            return
            
        # Define a coordinated workflow
        workflow_tasks = [
            {
                'id': 'task_1',
                'description': 'Design a database schema for a blog application',
                'agent_type': 'manager',  # Strategic task
                'dependencies': []
            },
            {
                'id': 'task_2', 
                'description': 'Implement SQLAlchemy models based on the schema',
                'agent_type': 'worker',  # Implementation task
                'dependencies': ['task_1']
            },
            {
                'id': 'task_3',
                'description': 'Create FastAPI endpoints for the blog models',
                'agent_type': 'worker',
                'dependencies': ['task_2']
            },
            {
                'id': 'task_4',
                'description': 'Write comprehensive tests for all endpoints',
                'agent_type': 'worker', 
                'dependencies': ['task_3']
            }
        ]
        
        print(f"🔄 Executing coordinated workflow ({len(workflow_tasks)} tasks)...")
        
        completed_tasks = []
        
        for task in workflow_tasks:
            # Check dependencies
            dependencies_met = all(dep in completed_tasks for dep in task['dependencies'])
            
            if not dependencies_met:
                missing_deps = [dep for dep in task['dependencies'] if dep not in completed_tasks]
                print(f"  ⏸️  {task['id']}: Waiting for dependencies {missing_deps}")
                continue
                
            print(f"  🚀 {task['id']}: Starting ({task['agent_type']} agent)")
            
            start_time = time.time()
            
            try:
                # Execute with appropriate agent configuration
                options = create_dual_agent_options() if task['agent_type'] == 'manager' else create_production_options()
                
                async with ClaudeSDKClient(options) as client:
                    response = await client.execute(task['description'])
                    
                duration = time.time() - start_time
                
                if response.success:
                    completed_tasks.append(task['id'])
                    print(f"    ✅ {task['id']}: Completed in {duration:.1f}s")
                    
                    # Log task coordination
                    if manager.enable_monitoring:
                        await manager.monitoring.log_task_coordination({
                            'task_id': task['id'],
                            'agent_type': task['agent_type'],
                            'dependencies': task['dependencies'],
                            'duration': duration,
                            'success': True
                        })
                        
                else:
                    print(f"    ❌ {task['id']}: Failed - {response.error}")
                    break  # Stop workflow on failure
                    
            except Exception as e:
                print(f"    ❌ {task['id']}: Exception - {e}")
                break
                
        print(f"\n🏁 Workflow completed: {len(completed_tasks)}/{len(workflow_tasks)} tasks successful")
        
    except Exception as e:
        print(f"❌ Task coordination error: {e}")
        
    print()


async def main():
    """
    Main function demonstrating all integration patterns.
    """
    print("🚀 Claude SDK Client - automatic-claude-code Integration Examples")
    print("=" * 70)
    print()
    
    print("ℹ️  Prerequisites:")
    print("   - Claude Code CLI installed and configured")
    print("   - automatic-claude-code system available")  
    print("   - Optional: Monitoring server running on localhost:6011")
    print()
    
    # Run all integration examples
    await basic_integration_example()
    await dual_agent_integration_example()
    await monitoring_integration_example()
    await task_coordination_example()
    
    print("✅ All integration examples completed!")
    print()
    print("Integration capabilities demonstrated:")
    print("- Basic Claude CLI integration")
    print("- Dual-agent architecture coordination")
    print("- Real-time monitoring and observability")
    print("- Task workflow coordination")
    print("- Error handling and fallback strategies")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Integration examples interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error running integration examples: {e}")
        logger.exception("Error running integration examples")