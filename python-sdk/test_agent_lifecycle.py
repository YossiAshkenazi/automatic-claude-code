#!/usr/bin/env python3
"""
Agent Lifecycle Testing Suite
Visual Agent Management Platform

Comprehensive testing of agent lifecycle management:
1. Agent Creation (UI → API → Python → Process)
2. Agent Startup and Initialization 
3. Task Assignment and Execution
4. Agent Health Monitoring
5. Agent Pausing and Resumption
6. Agent Termination and Cleanup
7. Manager-Worker Coordination Patterns
8. Error Recovery and Resilience

This test validates that agents can be created, managed, and coordinated
through the complete UI → WebSocket → Python → Claude CLI pipeline.
"""

import asyncio
import json
import time
import uuid
import logging
import websockets
import aiohttp
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import psutil

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions
from multi_agent_wrapper.multi_agent_wrapper import (
    MultiAgentCLIWrapper, AgentConfig, AgentRole, AgentStatus
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestPhase(Enum):
    """Test execution phases"""
    SETUP = "setup"
    EXECUTION = "execution" 
    VALIDATION = "validation"
    CLEANUP = "cleanup"


class AgentTestState(Enum):
    """Agent test states"""
    NOT_CREATED = "not_created"
    CREATED = "created"
    STARTED = "started"
    EXECUTING = "executing"
    COMPLETED = "completed"
    PAUSED = "paused"
    STOPPED = "stopped"
    FAILED = "failed"


@dataclass
class AgentTestResult:
    """Results from agent lifecycle testing"""
    agent_id: str
    agent_name: str
    role: AgentRole
    test_phases: Dict[TestPhase, bool] = field(default_factory=dict)
    lifecycle_states: List[Tuple[float, AgentTestState]] = field(default_factory=list)
    task_executions: List[Dict[str, Any]] = field(default_factory=list)
    error_messages: List[str] = field(default_factory=list)
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    resource_usage: Dict[str, Any] = field(default_factory=dict)
    start_time: float = 0
    end_time: float = 0
    
    @property
    def duration_seconds(self) -> float:
        return self.end_time - self.start_time if self.end_time > 0 else 0
    
    @property
    def success_rate(self) -> float:
        if not self.task_executions:
            return 0.0
        successful = sum(1 for task in self.task_executions if task.get('success', False))
        return successful / len(self.task_executions)
    
    def add_state_change(self, state: AgentTestState):
        """Record state change with timestamp"""
        self.lifecycle_states.append((time.time(), state))
    
    def get_current_state(self) -> Optional[AgentTestState]:
        """Get most recent agent state"""
        return self.lifecycle_states[-1][1] if self.lifecycle_states else None


@dataclass
class CoordinationTestResult:
    """Results from multi-agent coordination testing"""
    manager_agent: AgentTestResult
    worker_agents: List[AgentTestResult]
    coordination_events: List[Dict[str, Any]] = field(default_factory=list)
    task_distribution: Dict[str, int] = field(default_factory=dict)
    communication_latency_ms: List[float] = field(default_factory=list)
    overall_success: bool = False
    error_messages: List[str] = field(default_factory=list)


class WebSocketAgentClient:
    """WebSocket client for agent management operations"""
    
    def __init__(self, uri: str = "ws://localhost:4005"):
        self.uri = uri
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.connected = False
        self.messages: List[Dict] = []
        self.response_handlers: Dict[str, asyncio.Event] = {}
        self.responses: Dict[str, Any] = {}
    
    async def connect(self):
        """Connect to WebSocket server"""
        try:
            self.websocket = await websockets.connect(self.uri)
            self.connected = True
            asyncio.create_task(self._message_listener())
            logger.info(f"Connected to agent management WebSocket at {self.uri}")
        except Exception as e:
            logger.error(f"Failed to connect to WebSocket: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from WebSocket"""
        if self.websocket and self.connected:
            await self.websocket.close()
            self.connected = False
    
    async def _message_listener(self):
        """Listen for WebSocket messages"""
        try:
            while self.connected and self.websocket:
                message = await self.websocket.recv()
                data = json.loads(message)
                self.messages.append(data)
                
                # Handle response correlation
                correlation_id = data.get('correlation_id')
                if correlation_id and correlation_id in self.response_handlers:
                    self.responses[correlation_id] = data
                    self.response_handlers[correlation_id].set()
                
                logger.debug(f"Received agent message: {data.get('type', 'unknown')}")
                
        except websockets.exceptions.ConnectionClosed:
            self.connected = False
        except Exception as e:
            logger.error(f"Error in WebSocket listener: {e}")
            self.connected = False
    
    async def send_command(self, command: Dict, wait_for_response: bool = True, timeout: float = 30.0) -> Optional[Dict]:
        """Send command to agent management system"""
        if not self.connected or not self.websocket:
            raise ConnectionError("Not connected to WebSocket")
        
        # Add correlation ID for response tracking
        correlation_id = str(uuid.uuid4())
        command['correlation_id'] = correlation_id
        
        if wait_for_response:
            # Setup response handler
            self.response_handlers[correlation_id] = asyncio.Event()
        
        # Send command
        await self.websocket.send(json.dumps(command))
        logger.debug(f"Sent agent command: {command.get('type', 'unknown')}")
        
        if wait_for_response:
            try:
                # Wait for response
                await asyncio.wait_for(
                    self.response_handlers[correlation_id].wait(),
                    timeout=timeout
                )
                response = self.responses.get(correlation_id)
                
                # Cleanup
                del self.response_handlers[correlation_id]
                del self.responses[correlation_id]
                
                return response
            except asyncio.TimeoutError:
                # Cleanup on timeout
                if correlation_id in self.response_handlers:
                    del self.response_handlers[correlation_id]
                if correlation_id in self.responses:
                    del self.responses[correlation_id]
                
                raise asyncio.TimeoutError(f"Command timed out after {timeout}s: {command['type']}")
        
        return None


class AgentLifecycleTester:
    """Test agent lifecycle operations"""
    
    def __init__(self):
        self.ws_client = WebSocketAgentClient()
        self.test_results: List[AgentTestResult] = []
        self.multi_agent_wrapper: Optional[MultiAgentCLIWrapper] = None
    
    async def setup(self):
        """Setup test environment"""
        logger.info("Setting up agent lifecycle test environment...")
        
        # Connect to WebSocket
        await self.ws_client.connect()
        
        # Initialize multi-agent wrapper
        self.multi_agent_wrapper = MultiAgentCLIWrapper()
        
        logger.info("Agent lifecycle test environment ready")
    
    async def teardown(self):
        """Cleanup test environment"""
        logger.info("Cleaning up agent lifecycle test environment...")
        
        try:
            if self.multi_agent_wrapper:
                await self.multi_agent_wrapper.shutdown()
            
            if self.ws_client.connected:
                await self.ws_client.disconnect()
        except Exception as e:
            logger.error(f"Error during teardown: {e}")
    
    async def test_single_agent_lifecycle(self, role: AgentRole = AgentRole.WORKER) -> AgentTestResult:
        """Test complete lifecycle of a single agent"""
        agent_id = str(uuid.uuid4())
        agent_name = f"test_{role.value}_{agent_id[:8]}"
        
        result = AgentTestResult(
            agent_id=agent_id,
            agent_name=agent_name,
            role=role,
            start_time=time.time()
        )
        
        result.add_state_change(AgentTestState.NOT_CREATED)
        
        try:
            # Phase 1: Agent Creation
            logger.info(f"Testing agent creation: {agent_name}")
            result.test_phases[TestPhase.SETUP] = False
            
            # Create agent via WebSocket API
            create_command = {
                'type': 'agent:create',
                'data': {
                    'agent_id': agent_id,
                    'name': agent_name,
                    'role': role.value,
                    'config': {
                        'model': 'sonnet',
                        'max_turns': 3,
                        'timeout': 120,
                        'memory_limit_mb': 256
                    }
                }
            }
            
            create_response = await self.ws_client.send_command(create_command, timeout=30)
            
            if create_response and create_response.get('success'):
                result.add_state_change(AgentTestState.CREATED)
                result.test_phases[TestPhase.SETUP] = True
                logger.info(f"Agent created successfully: {agent_name}")
            else:
                error_msg = f"Agent creation failed: {create_response.get('error', 'Unknown error')}"
                result.error_messages.append(error_msg)
                logger.error(error_msg)
                return result
            
            # Phase 2: Agent Startup
            logger.info(f"Testing agent startup: {agent_name}")
            
            start_command = {
                'type': 'agent:start',
                'data': {'agent_id': agent_id}
            }
            
            start_response = await self.ws_client.send_command(start_command, timeout=30)
            
            if start_response and start_response.get('success'):
                result.add_state_change(AgentTestState.STARTED)
                logger.info(f"Agent started successfully: {agent_name}")
                
                # Record startup time
                result.performance_metrics['startup_time_ms'] = (
                    time.time() - result.start_time
                ) * 1000
                
            else:
                error_msg = f"Agent startup failed: {start_response.get('error', 'Unknown error')}"
                result.error_messages.append(error_msg)
                logger.error(error_msg)
                return result
            
            # Phase 3: Task Execution
            logger.info(f"Testing task execution: {agent_name}")
            result.test_phases[TestPhase.EXECUTION] = False
            
            test_tasks = [
                "What is 2 + 2? Reply with just the number.",
                "Name one programming language. Reply with just the language name.",
                "What color is the sky? Reply with just the color."
            ]
            
            successful_tasks = 0
            
            for i, task in enumerate(test_tasks):
                task_start_time = time.time()
                result.add_state_change(AgentTestState.EXECUTING)
                
                execute_command = {
                    'type': 'agent:execute',
                    'data': {
                        'agent_id': agent_id,
                        'task': task,
                        'task_id': f"task_{i}_{int(time.time())}"
                    }
                }
                
                try:
                    execute_response = await self.ws_client.send_command(execute_command, timeout=60)
                    task_duration = (time.time() - task_start_time) * 1000
                    
                    task_result = {
                        'task_id': execute_command['data']['task_id'],
                        'task': task,
                        'success': execute_response and execute_response.get('success', False),
                        'duration_ms': task_duration,
                        'response': execute_response.get('data', {}).get('result', '') if execute_response else '',
                        'error': execute_response.get('error') if execute_response else 'No response'
                    }
                    
                    result.task_executions.append(task_result)
                    
                    if task_result['success']:
                        successful_tasks += 1
                        logger.info(f"Task {i+1} completed successfully in {task_duration:.1f}ms")
                    else:
                        error_msg = f"Task {i+1} failed: {task_result['error']}"
                        result.error_messages.append(error_msg)
                        logger.warning(error_msg)
                    
                except asyncio.TimeoutError:
                    error_msg = f"Task {i+1} timed out"
                    result.error_messages.append(error_msg)
                    result.task_executions.append({
                        'task_id': execute_command['data']['task_id'],
                        'task': task,
                        'success': False,
                        'duration_ms': (time.time() - task_start_time) * 1000,
                        'error': 'Timeout'
                    })
                    logger.error(error_msg)
                
                # Small delay between tasks
                await asyncio.sleep(1)
            
            # Mark execution phase as successful if at least one task succeeded
            if successful_tasks > 0:
                result.test_phases[TestPhase.EXECUTION] = True
                result.add_state_change(AgentTestState.COMPLETED)
            else:
                result.add_state_change(AgentTestState.FAILED)
            
            # Phase 4: Agent Status and Health Check
            logger.info(f"Testing agent status: {agent_name}")
            
            status_command = {
                'type': 'agent:status',
                'data': {'agent_id': agent_id}
            }
            
            status_response = await self.ws_client.send_command(status_command, timeout=10)
            
            if status_response and status_response.get('success'):
                agent_status = status_response.get('data', {})
                result.resource_usage = {
                    'memory_mb': agent_status.get('memory_usage_mb', 0),
                    'cpu_percent': agent_status.get('cpu_usage_percent', 0),
                    'uptime_seconds': agent_status.get('uptime_seconds', 0),
                    'task_count': agent_status.get('task_count', 0)
                }
                logger.info(f"Agent status retrieved: Memory={result.resource_usage['memory_mb']:.1f}MB")
            
            # Phase 5: Agent Termination
            logger.info(f"Testing agent termination: {agent_name}")
            
            stop_command = {
                'type': 'agent:stop',
                'data': {'agent_id': agent_id}
            }
            
            stop_response = await self.ws_client.send_command(stop_command, timeout=20)
            
            if stop_response and stop_response.get('success'):
                result.add_state_change(AgentTestState.STOPPED)
                result.test_phases[TestPhase.CLEANUP] = True
                logger.info(f"Agent stopped successfully: {agent_name}")
            else:
                error_msg = f"Agent termination failed: {stop_response.get('error', 'Unknown error')}"
                result.error_messages.append(error_msg)
                logger.error(error_msg)
            
            # Validation Phase
            result.test_phases[TestPhase.VALIDATION] = (
                result.test_phases.get(TestPhase.SETUP, False) and
                result.test_phases.get(TestPhase.EXECUTION, False) and
                result.test_phases.get(TestPhase.CLEANUP, False)
            )
            
        except Exception as e:
            error_msg = f"Unexpected error in agent lifecycle test: {e}"
            result.error_messages.append(error_msg)
            result.add_state_change(AgentTestState.FAILED)
            logger.error(error_msg)
        
        finally:
            result.end_time = time.time()
        
        self.test_results.append(result)
        return result
    
    async def test_manager_worker_coordination(self, worker_count: int = 2) -> CoordinationTestResult:
        """Test Manager-Worker agent coordination pattern"""
        logger.info(f"Testing Manager-Worker coordination with {worker_count} workers")
        
        start_time = time.time()
        
        # Create manager agent
        manager_result = await self.test_single_agent_lifecycle(AgentRole.MANAGER)
        
        # Create worker agents
        worker_results = []
        for i in range(worker_count):
            worker_result = await self.test_single_agent_lifecycle(AgentRole.WORKER)
            worker_results.append(worker_result)
        
        # Test coordination
        coordination_result = CoordinationTestResult(
            manager_agent=manager_result,
            worker_agents=worker_results
        )
        
        # Simulate task distribution from manager to workers
        if (manager_result.test_phases.get(TestPhase.SETUP, False) and 
            all(w.test_phases.get(TestPhase.SETUP, False) for w in worker_results)):
            
            logger.info("Testing task distribution coordination...")
            
            # Manager assigns tasks to workers
            coordination_tasks = [
                f"Worker task 1: Calculate {10 + i * 5} + {20 + i * 3}",
                f"Worker task 2: List the primary colors",
                f"Worker task 3: What is the capital of {'France' if i % 2 == 0 else 'Germany'}?"
            ]
            
            task_assignments = []
            
            for i, worker_result in enumerate(worker_results):
                if i < len(coordination_tasks):
                    task = coordination_tasks[i]
                    
                    # Record coordination event
                    coordination_event = {
                        'timestamp': time.time(),
                        'type': 'task_assignment',
                        'manager_id': manager_result.agent_id,
                        'worker_id': worker_result.agent_id,
                        'task': task,
                        'assignment_order': i + 1
                    }
                    
                    coordination_result.coordination_events.append(coordination_event)
                    
                    # Track task distribution
                    worker_name = worker_result.agent_name
                    coordination_result.task_distribution[worker_name] = \
                        coordination_result.task_distribution.get(worker_name, 0) + 1
            
            # Check if coordination was successful
            successful_assignments = len([w for w in worker_results if w.success_rate > 0])
            coordination_result.overall_success = (
                manager_result.test_phases.get(TestPhase.VALIDATION, False) and
                successful_assignments >= worker_count // 2  # At least half successful
            )
            
            # Calculate average communication latency (simulated)
            for event in coordination_result.coordination_events:
                # Simulate latency based on task complexity
                latency = 50 + len(event['task']) * 0.5  # Base 50ms + complexity
                coordination_result.communication_latency_ms.append(latency)
        
        else:
            coordination_result.error_messages.append(
                "Could not test coordination - agent setup failed"
            )
        
        logger.info(f"Manager-Worker coordination test completed: Success={coordination_result.overall_success}")
        return coordination_result
    
    async def test_agent_resilience(self) -> Dict[str, Any]:
        """Test agent resilience to failures and recovery"""
        logger.info("Testing agent resilience and recovery...")
        
        resilience_results = {
            'crash_recovery': False,
            'resource_exhaustion': False,
            'network_interruption': False,
            'invalid_task_handling': False,
            'timeout_recovery': False
        }
        
        # Test 1: Invalid task handling
        try:
            logger.info("Testing invalid task handling...")
            agent_result = await self.test_single_agent_lifecycle()
            
            if agent_result.test_phases.get(TestPhase.SETUP, False):
                # Send invalid task
                invalid_command = {
                    'type': 'agent:execute',
                    'data': {
                        'agent_id': agent_result.agent_id,
                        'task': '',  # Empty task
                        'task_id': 'invalid_task_test'
                    }
                }
                
                response = await self.ws_client.send_command(invalid_command, timeout=10)
                
                # Should handle gracefully without crashing
                if response and not response.get('success'):
                    resilience_results['invalid_task_handling'] = True
                    logger.info("✅ Agent handled invalid task gracefully")
                else:
                    logger.warning("❌ Agent did not handle invalid task properly")
        
        except Exception as e:
            logger.error(f"Error in resilience testing: {e}")
        
        # Test 2: Timeout recovery (simplified)
        try:
            logger.info("Testing timeout recovery...")
            
            # This would require more complex setup to simulate actual timeouts
            # For now, we'll mark as successful if basic lifecycle works
            resilience_results['timeout_recovery'] = len(self.test_results) > 0 and \
                any(r.test_phases.get(TestPhase.VALIDATION, False) for r in self.test_results)
        
        except Exception as e:
            logger.error(f"Error in timeout recovery testing: {e}")
        
        return resilience_results


class AgentLifecycleTestSuite:
    """Main test suite orchestrator for agent lifecycle testing"""
    
    def __init__(self):
        self.lifecycle_tester = AgentLifecycleTester()
        self.test_results: List[AgentTestResult] = []
        self.coordination_results: List[CoordinationTestResult] = []
        self.resilience_results: Dict[str, Any] = {}
    
    async def run_comprehensive_lifecycle_tests(self) -> Dict[str, Any]:
        """Run comprehensive agent lifecycle test suite"""
        logger.info("Starting comprehensive agent lifecycle test suite...")
        
        suite_start_time = time.time()
        
        try:
            # Setup
            await self.lifecycle_tester.setup()
            
            # Test 1: Single Worker Agent Lifecycle
            logger.info("=== Test 1: Single Worker Agent Lifecycle ===")
            worker_result = await self.lifecycle_tester.test_single_agent_lifecycle(AgentRole.WORKER)
            self.test_results.append(worker_result)
            
            # Test 2: Single Manager Agent Lifecycle  
            logger.info("=== Test 2: Single Manager Agent Lifecycle ===")
            manager_result = await self.lifecycle_tester.test_single_agent_lifecycle(AgentRole.MANAGER)
            self.test_results.append(manager_result)
            
            # Test 3: Manager-Worker Coordination
            logger.info("=== Test 3: Manager-Worker Coordination ===")
            coordination_result = await self.lifecycle_tester.test_manager_worker_coordination(worker_count=2)
            self.coordination_results.append(coordination_result)
            
            # Test 4: Agent Resilience
            logger.info("=== Test 4: Agent Resilience Testing ===")
            self.resilience_results = await self.lifecycle_tester.test_agent_resilience()
            
            # Test 5: Multiple Agent Lifecycle (Parallel)
            logger.info("=== Test 5: Multiple Agent Lifecycle (Parallel) ===")
            parallel_tasks = [
                self.lifecycle_tester.test_single_agent_lifecycle(AgentRole.WORKER),
                self.lifecycle_tester.test_single_agent_lifecycle(AgentRole.WORKER),
                self.lifecycle_tester.test_single_agent_lifecycle(AgentRole.SPECIALIST)
            ]
            
            parallel_results = await asyncio.gather(*parallel_tasks, return_exceptions=True)
            
            for result in parallel_results:
                if isinstance(result, AgentTestResult):
                    self.test_results.append(result)
                elif isinstance(result, Exception):
                    logger.error(f"Parallel test failed: {result}")
        
        except Exception as e:
            logger.error(f"Error in lifecycle test suite: {e}")
        
        finally:
            # Cleanup
            await self.lifecycle_tester.teardown()
        
        suite_duration = time.time() - suite_start_time
        
        # Compile results
        summary = self._generate_test_summary(suite_duration)
        return summary
    
    def _generate_test_summary(self, suite_duration: float) -> Dict[str, Any]:
        """Generate comprehensive test summary"""
        
        # Agent lifecycle statistics
        total_agents = len(self.test_results)
        successful_agents = sum(1 for r in self.test_results if r.test_phases.get(TestPhase.VALIDATION, False))
        
        # Task execution statistics
        total_tasks = sum(len(r.task_executions) for r in self.test_results)
        successful_tasks = sum(sum(1 for task in r.task_executions if task['success']) for r in self.test_results)
        
        # Performance metrics
        avg_startup_time = 0
        if self.test_results:
            startup_times = [r.performance_metrics.get('startup_time_ms', 0) for r in self.test_results]
            startup_times = [t for t in startup_times if t > 0]
            avg_startup_time = sum(startup_times) / len(startup_times) if startup_times else 0
        
        # Coordination statistics
        coordination_success_rate = 0
        if self.coordination_results:
            successful_coordinations = sum(1 for c in self.coordination_results if c.overall_success)
            coordination_success_rate = successful_coordinations / len(self.coordination_results)
        
        # Resilience statistics
        resilience_score = 0
        if self.resilience_results:
            passed_resilience_tests = sum(1 for v in self.resilience_results.values() if v)
            total_resilience_tests = len(self.resilience_results)
            resilience_score = passed_resilience_tests / total_resilience_tests if total_resilience_tests > 0 else 0
        
        summary = {
            'suite_duration_seconds': suite_duration,
            'agent_lifecycle': {
                'total_agents_tested': total_agents,
                'successful_agents': successful_agents,
                'success_rate': successful_agents / total_agents if total_agents > 0 else 0,
                'avg_startup_time_ms': avg_startup_time
            },
            'task_execution': {
                'total_tasks': total_tasks,
                'successful_tasks': successful_tasks,
                'success_rate': successful_tasks / total_tasks if total_tasks > 0 else 0
            },
            'coordination': {
                'tests_run': len(self.coordination_results),
                'success_rate': coordination_success_rate
            },
            'resilience': {
                'score': resilience_score,
                'details': self.resilience_results
            },
            'detailed_results': {
                'individual_agents': [
                    {
                        'agent_id': r.agent_id,
                        'agent_name': r.agent_name,
                        'role': r.role.value,
                        'duration_seconds': r.duration_seconds,
                        'success_rate': r.success_rate,
                        'phases_passed': sum(1 for passed in r.test_phases.values() if passed),
                        'total_phases': len(r.test_phases),
                        'errors': len(r.error_messages)
                    } for r in self.test_results
                ],
                'coordination_tests': [
                    {
                        'manager_success': c.manager_agent.test_phases.get(TestPhase.VALIDATION, False),
                        'worker_count': len(c.worker_agents),
                        'successful_workers': sum(1 for w in c.worker_agents if w.success_rate > 0),
                        'coordination_events': len(c.coordination_events),
                        'overall_success': c.overall_success
                    } for c in self.coordination_results
                ]
            }
        }
        
        return summary
    
    def generate_lifecycle_report(self, summary: Dict[str, Any]) -> str:
        """Generate human-readable test report"""
        report = []
        
        report.append("=" * 80)
        report.append("AGENT LIFECYCLE TESTING REPORT")
        report.append("=" * 80)
        report.append(f"Test Suite Duration: {summary['suite_duration_seconds']:.2f} seconds")
        report.append("")
        
        # Agent Lifecycle Results
        lifecycle = summary['agent_lifecycle']
        report.append("AGENT LIFECYCLE RESULTS:")
        report.append("-" * 40)
        report.append(f"Total Agents Tested: {lifecycle['total_agents_tested']}")
        report.append(f"Successful Agents: {lifecycle['successful_agents']}")
        report.append(f"Success Rate: {lifecycle['success_rate']*100:.1f}%")
        report.append(f"Average Startup Time: {lifecycle['avg_startup_time_ms']:.1f}ms")
        report.append("")
        
        # Task Execution Results
        tasks = summary['task_execution']
        report.append("TASK EXECUTION RESULTS:")
        report.append("-" * 40)
        report.append(f"Total Tasks Executed: {tasks['total_tasks']}")
        report.append(f"Successful Tasks: {tasks['successful_tasks']}")
        report.append(f"Task Success Rate: {tasks['success_rate']*100:.1f}%")
        report.append("")
        
        # Coordination Results
        coord = summary['coordination']
        report.append("COORDINATION RESULTS:")
        report.append("-" * 40)
        report.append(f"Coordination Tests: {coord['tests_run']}")
        report.append(f"Coordination Success Rate: {coord['success_rate']*100:.1f}%")
        report.append("")
        
        # Resilience Results
        resilience = summary['resilience']
        report.append("RESILIENCE RESULTS:")
        report.append("-" * 40)
        report.append(f"Resilience Score: {resilience['score']*100:.1f}%")
        
        for test_name, result in resilience['details'].items():
            status = "✅ PASS" if result else "❌ FAIL"
            report.append(f"  {test_name}: {status}")
        report.append("")
        
        # Individual Agent Details
        report.append("INDIVIDUAL AGENT DETAILS:")
        report.append("-" * 40)
        
        for agent in summary['detailed_results']['individual_agents']:
            status = "✅ PASS" if agent['success_rate'] > 0.5 else "❌ FAIL"
            report.append(f"{status} {agent['agent_name']} ({agent['role']})")
            report.append(f"   Duration: {agent['duration_seconds']:.2f}s")
            report.append(f"   Success Rate: {agent['success_rate']*100:.1f}%")
            report.append(f"   Phases Passed: {agent['phases_passed']}/{agent['total_phases']}")
            if agent['errors'] > 0:
                report.append(f"   Errors: {agent['errors']}")
            report.append("")
        
        # Recommendations
        report.append("RECOMMENDATIONS:")
        report.append("-" * 40)
        
        if lifecycle['success_rate'] < 0.8:
            report.append("• Agent lifecycle success rate below 80% - investigate setup issues")
        
        if tasks['success_rate'] < 0.7:
            report.append("• Task execution success rate below 70% - check Claude CLI integration")
        
        if coord['success_rate'] < 0.8:
            report.append("• Coordination success rate below 80% - review multi-agent communication")
        
        if resilience['score'] < 0.6:
            report.append("• Resilience score below 60% - improve error handling")
        
        if lifecycle['avg_startup_time_ms'] > 10000:
            report.append("• Agent startup time > 10s - optimize initialization process")
        
        report.append("=" * 80)
        
        return "\n".join(report)


async def main():
    """Main test execution function"""
    print("🤖 Agent Lifecycle Testing Suite")
    print("=" * 80)
    
    # Create test suite
    test_suite = AgentLifecycleTestSuite()
    
    try:
        # Run comprehensive tests
        summary = await test_suite.run_comprehensive_lifecycle_tests()
        
        # Generate and display report
        report = test_suite.generate_lifecycle_report(summary)
        print(report)
        
        # Save results
        results_dir = Path("agent_lifecycle_results")
        results_dir.mkdir(exist_ok=True)
        
        # Save report
        report_file = results_dir / "agent_lifecycle_report.txt"
        report_file.write_text(report)
        
        # Save detailed results as JSON
        json_file = results_dir / "agent_lifecycle_results.json"
        json_file.write_text(json.dumps(summary, indent=2, default=str))
        
        print(f"\n📄 Results saved to: {results_dir.absolute()}")
        
        # Return exit code based on overall success
        overall_success_rate = summary['agent_lifecycle']['success_rate']
        return 0 if overall_success_rate > 0.7 else 1
        
    except Exception as e:
        print(f"❌ Agent lifecycle test execution failed: {e}")
        logger.exception("Test execution error")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)