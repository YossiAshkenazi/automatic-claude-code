#!/usr/bin/env python3
"""
Comprehensive End-to-End Integration Testing Suite
Visual Agent Management Platform

This test suite validates the complete flow from UI to WebSocket to Python to Claude CLI,
ensuring all components work together seamlessly for real agent management.

Test Coverage:
1. Agent Lifecycle Management (Create → Start → Execute → Stop)
2. Real-time WebSocket Communication (UI ↔ Backend)
3. Task Execution Pipeline (UI → Python → Claude CLI)
4. Multi-Agent Coordination (Manager-Worker patterns)
5. Error Handling & Recovery Scenarios
6. Performance & Load Testing
7. Process Cleanup (Epic 3 Integration)
8. Authentication & Security

Requirements:
- Claude CLI installed and authenticated
- React frontend running (localhost:6011)
- WebSocket server running (localhost:4005)
- Python dependencies installed
"""

import asyncio
import json
import time
import uuid
import websockets
import aiohttp
import subprocess
import psutil
import logging
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import pytest
import concurrent.futures
from contextlib import asynccontextmanager

# Test infrastructure imports
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions, ProcessHandleManager
from multi_agent_wrapper.multi_agent_wrapper import MultiAgentCLIWrapper, AgentConfig, AgentRole

# Setup comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('integration_test.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class TestResult(Enum):
    """Test result states"""
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    ERROR = "ERROR"


@dataclass
class TestCase:
    """Individual test case definition"""
    name: str
    description: str
    test_function: str
    timeout_seconds: int = 300
    requires_claude_auth: bool = True
    requires_ui: bool = False
    requires_websocket: bool = False
    category: str = "general"


@dataclass 
class TestExecutionResult:
    """Result of test execution"""
    test_case: TestCase
    result: TestResult
    duration_seconds: float
    error_message: Optional[str] = None
    additional_data: Dict[str, Any] = field(default_factory=dict)
    start_time: float = 0
    end_time: float = 0


class SystemHealthChecker:
    """Validates system prerequisites before running tests"""
    
    @staticmethod
    async def check_claude_cli() -> Tuple[bool, str]:
        """Check if Claude CLI is installed and authenticated"""
        try:
            result = subprocess.run(['claude', '--version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                return False, "Claude CLI not found or not executable"
            
            # Check authentication
            auth_result = subprocess.run(['claude', 'auth', 'status'], 
                                      capture_output=True, text=True, timeout=10)
            if 'authenticated' not in auth_result.stdout.lower():
                return False, "Claude CLI not authenticated - run 'claude setup-token'"
            
            return True, f"Claude CLI available: {result.stdout.strip()}"
        except Exception as e:
            return False, f"Error checking Claude CLI: {e}"
    
    @staticmethod
    async def check_websocket_server(port: int = 4005) -> Tuple[bool, str]:
        """Check if WebSocket server is running"""
        try:
            uri = f"ws://localhost:{port}"
            async with websockets.connect(uri, timeout=5) as websocket:
                await websocket.ping()
                return True, f"WebSocket server running on port {port}"
        except Exception as e:
            return False, f"WebSocket server not accessible on port {port}: {e}"
    
    @staticmethod 
    async def check_react_frontend(port: int = 6011) -> Tuple[bool, str]:
        """Check if React frontend is accessible"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f'http://localhost:{port}', timeout=5) as resp:
                    if resp.status == 200:
                        return True, f"React frontend accessible on port {port}"
                    else:
                        return False, f"React frontend returned status {resp.status}"
        except Exception as e:
            return False, f"React frontend not accessible on port {port}: {e}"
    
    @staticmethod
    async def check_api_server(port: int = 4005) -> Tuple[bool, str]:
        """Check if API server is running"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f'http://localhost:{port}/api/health', timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return True, f"API server healthy: {data}"
                    else:
                        return False, f"API server returned status {resp.status}"
        except Exception as e:
            return False, f"API server not accessible: {e}"


class WebSocketTestClient:
    """WebSocket client for testing real-time communication"""
    
    def __init__(self, uri: str = "ws://localhost:4005"):
        self.uri = uri
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.messages: List[Dict] = []
        self.listeners: Dict[str, List[callable]] = {}
        self.connected = False
    
    async def connect(self, timeout: float = 10.0):
        """Connect to WebSocket server"""
        try:
            self.websocket = await asyncio.wait_for(
                websockets.connect(self.uri), timeout=timeout
            )
            self.connected = True
            # Start message listener
            asyncio.create_task(self._message_listener())
            logger.info(f"Connected to WebSocket at {self.uri}")
        except Exception as e:
            logger.error(f"Failed to connect to WebSocket: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from WebSocket server"""
        if self.websocket and self.connected:
            await self.websocket.close()
            self.connected = False
            logger.info("Disconnected from WebSocket")
    
    async def send_message(self, message: Dict):
        """Send message to WebSocket server"""
        if not self.connected or not self.websocket:
            raise ConnectionError("Not connected to WebSocket server")
        
        await self.websocket.send(json.dumps(message))
        logger.debug(f"Sent WebSocket message: {message}")
    
    async def _message_listener(self):
        """Listen for incoming WebSocket messages"""
        try:
            while self.connected and self.websocket:
                message = await self.websocket.recv()
                data = json.loads(message)
                self.messages.append(data)
                
                # Trigger listeners
                message_type = data.get('type', 'unknown')
                if message_type in self.listeners:
                    for listener in self.listeners[message_type]:
                        try:
                            await listener(data)
                        except Exception as e:
                            logger.error(f"Error in message listener: {e}")
                
                logger.debug(f"Received WebSocket message: {data}")
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
            self.connected = False
        except Exception as e:
            logger.error(f"Error in message listener: {e}")
            self.connected = False
    
    def add_listener(self, message_type: str, callback: callable):
        """Add listener for specific message types"""
        if message_type not in self.listeners:
            self.listeners[message_type] = []
        self.listeners[message_type].append(callback)
    
    def get_messages_by_type(self, message_type: str) -> List[Dict]:
        """Get all received messages of specific type"""
        return [msg for msg in self.messages if msg.get('type') == message_type]
    
    def clear_messages(self):
        """Clear message history"""
        self.messages.clear()


class IntegrationTestSuite:
    """Main integration test suite orchestrator"""
    
    def __init__(self):
        self.test_cases: List[TestCase] = []
        self.results: List[TestExecutionResult] = []
        self.ws_client = WebSocketTestClient()
        self.process_manager = ProcessHandleManager.get_instance()
        self.test_session_id = str(uuid.uuid4())
        
        # Define all test cases
        self._define_test_cases()
    
    def _define_test_cases(self):
        """Define all integration test cases"""
        
        # System Health Tests
        self.test_cases.extend([
            TestCase(
                name="system_health_check",
                description="Validate all system components are running and accessible",
                test_function="test_system_health_check",
                timeout_seconds=60,
                requires_claude_auth=True,
                requires_ui=True,
                requires_websocket=True,
                category="health"
            )
        ])
        
        # Claude CLI Integration Tests
        self.test_cases.extend([
            TestCase(
                name="claude_cli_basic_execution",
                description="Test basic Claude CLI execution with wrapper",
                test_function="test_claude_cli_basic_execution",
                timeout_seconds=120,
                requires_claude_auth=True,
                category="claude_cli"
            ),
            TestCase(
                name="claude_cli_tool_usage",
                description="Test Claude CLI tool invocation (Read, Write, Bash)",
                test_function="test_claude_cli_tool_usage",
                timeout_seconds=180,
                requires_claude_auth=True,
                category="claude_cli"
            ),
            TestCase(
                name="claude_cli_error_handling",
                description="Test Claude CLI error scenarios and recovery",
                test_function="test_claude_cli_error_handling",
                timeout_seconds=120,
                requires_claude_auth=False,  # Tests error conditions
                category="claude_cli"
            )
        ])
        
        # Multi-Agent System Tests  
        self.test_cases.extend([
            TestCase(
                name="multi_agent_creation",
                description="Test creating and managing multiple agents",
                test_function="test_multi_agent_creation",
                timeout_seconds=180,
                requires_claude_auth=True,
                category="multi_agent"
            ),
            TestCase(
                name="manager_worker_coordination",
                description="Test Manager-Worker agent coordination patterns",
                test_function="test_manager_worker_coordination", 
                timeout_seconds=300,
                requires_claude_auth=True,
                category="multi_agent"
            ),
            TestCase(
                name="agent_lifecycle_management",
                description="Test full agent lifecycle (create→start→execute→stop)",
                test_function="test_agent_lifecycle_management",
                timeout_seconds=240,
                requires_claude_auth=True,
                category="multi_agent"
            )
        ])
        
        # WebSocket Communication Tests
        self.test_cases.extend([
            TestCase(
                name="websocket_connection",
                description="Test WebSocket connection and basic message passing",
                test_function="test_websocket_connection",
                timeout_seconds=60,
                requires_websocket=True,
                category="websocket"
            ),
            TestCase(
                name="real_time_agent_updates",
                description="Test real-time agent status updates via WebSocket",
                test_function="test_real_time_agent_updates",
                timeout_seconds=120,
                requires_claude_auth=True,
                requires_websocket=True,
                category="websocket"
            ),
            TestCase(
                name="ui_backend_communication",
                description="Test bidirectional UI ↔ Backend communication",
                test_function="test_ui_backend_communication",
                timeout_seconds=90,
                requires_websocket=True,
                category="websocket"
            )
        ])
        
        # Task Execution Tests
        self.test_cases.extend([
            TestCase(
                name="end_to_end_task_execution",
                description="Test complete task flow: UI → Python → Claude CLI → Results",
                test_function="test_end_to_end_task_execution",
                timeout_seconds=300,
                requires_claude_auth=True,
                requires_websocket=True,
                category="task_execution"
            ),
            TestCase(
                name="concurrent_task_execution",
                description="Test multiple agents executing tasks simultaneously",
                test_function="test_concurrent_task_execution",
                timeout_seconds=360,
                requires_claude_auth=True,
                category="task_execution"
            ),
            TestCase(
                name="task_assignment_workflow",
                description="Test task assignment from Manager to Worker agents",
                test_function="test_task_assignment_workflow",
                timeout_seconds=300,
                requires_claude_auth=True,
                requires_websocket=True,
                category="task_execution"
            )
        ])
        
        # Error Handling & Recovery Tests
        self.test_cases.extend([
            TestCase(
                name="websocket_reconnection",
                description="Test WebSocket disconnection and reconnection handling",
                test_function="test_websocket_reconnection",
                timeout_seconds=120,
                requires_websocket=True,
                category="error_recovery"
            ),
            TestCase(
                name="agent_failure_recovery",
                description="Test agent failure detection and recovery mechanisms",
                test_function="test_agent_failure_recovery",
                timeout_seconds=240,
                requires_claude_auth=True,
                category="error_recovery"
            ),
            TestCase(
                name="network_interruption_handling",
                description="Test handling of network interruptions during task execution",
                test_function="test_network_interruption_handling",
                timeout_seconds=180,
                requires_claude_auth=True,
                category="error_recovery"
            )
        ])
        
        # Performance & Load Tests
        self.test_cases.extend([
            TestCase(
                name="performance_baseline",
                description="Establish performance baselines for key operations",
                test_function="test_performance_baseline",
                timeout_seconds=300,
                requires_claude_auth=True,
                requires_websocket=True,
                category="performance"
            ),
            TestCase(
                name="load_testing_agents",
                description="Test system behavior under high agent load",
                test_function="test_load_testing_agents",
                timeout_seconds=600,
                requires_claude_auth=True,
                category="performance"
            ),
            TestCase(
                name="websocket_message_throughput",
                description="Test WebSocket message throughput and latency",
                test_function="test_websocket_message_throughput",
                timeout_seconds=180,
                requires_websocket=True,
                category="performance"
            )
        ])
        
        # Epic 3 Process Management Tests
        self.test_cases.extend([
            TestCase(
                name="process_cleanup_validation",
                description="Test Epic 3 process cleanup and resource management",
                test_function="test_process_cleanup_validation",
                timeout_seconds=120,
                requires_claude_auth=True,
                category="process_management"
            ),
            TestCase(
                name="resource_leak_detection",
                description="Test for resource leaks in long-running operations",
                test_function="test_resource_leak_detection",
                timeout_seconds=300,
                requires_claude_auth=True,
                category="process_management"
            ),
            TestCase(
                name="graceful_shutdown",
                description="Test graceful shutdown of all components",
                test_function="test_graceful_shutdown",
                timeout_seconds=180,
                requires_claude_auth=True,
                requires_websocket=True,
                category="process_management"
            )
        ])

    # =============================================================================
    # TEST IMPLEMENTATION METHODS
    # =============================================================================

    async def test_system_health_check(self) -> TestExecutionResult:
        """Validate all system components are running and accessible"""
        test_case = next(tc for tc in self.test_cases if tc.name == "system_health_check")
        start_time = time.time()
        
        try:
            results = {}
            
            # Check Claude CLI
            claude_ok, claude_msg = await SystemHealthChecker.check_claude_cli()
            results['claude_cli'] = {'status': claude_ok, 'message': claude_msg}
            
            # Check WebSocket server
            ws_ok, ws_msg = await SystemHealthChecker.check_websocket_server()
            results['websocket'] = {'status': ws_ok, 'message': ws_msg}
            
            # Check React frontend
            ui_ok, ui_msg = await SystemHealthChecker.check_react_frontend()
            results['react_ui'] = {'status': ui_ok, 'message': ui_msg}
            
            # Check API server
            api_ok, api_msg = await SystemHealthChecker.check_api_server()
            results['api_server'] = {'status': api_ok, 'message': api_msg}
            
            # Overall health
            all_healthy = all(r['status'] for r in results.values())
            
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.PASS if all_healthy else TestResult.FAIL,
                duration_seconds=time.time() - start_time,
                error_message=None if all_healthy else "Some components are not healthy",
                additional_data=results,
                start_time=start_time,
                end_time=time.time()
            )
            
        except Exception as e:
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.ERROR,
                duration_seconds=time.time() - start_time,
                error_message=str(e),
                start_time=start_time,
                end_time=time.time()
            )

    async def test_claude_cli_basic_execution(self) -> TestExecutionResult:
        """Test basic Claude CLI execution with wrapper"""
        test_case = next(tc for tc in self.test_cases if tc.name == "claude_cli_basic_execution")
        start_time = time.time()
        
        try:
            # Create Claude CLI wrapper
            options = ClaudeCliOptions(
                model="sonnet",
                max_turns=2,
                verbose=True,
                timeout=60
            )
            wrapper = ClaudeCliWrapper(options)
            
            # Execute simple query
            prompt = "What is 2+2? Respond with just the number."
            responses = []
            
            async for message in wrapper.execute(prompt):
                responses.append(message)
                logger.info(f"Claude response: {message.type} - {message.content[:100]}")
            
            # Validate response
            has_stream_content = any(msg.type == "stream" and msg.content.strip() for msg in responses)
            has_result = any(msg.type in ["result", "stream"] for msg in responses)
            no_errors = not any(msg.type == "error" for msg in responses)
            
            success = has_result and no_errors
            
            # Cleanup
            await wrapper.cleanup()
            
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.PASS if success else TestResult.FAIL,
                duration_seconds=time.time() - start_time,
                error_message=None if success else "Claude CLI execution failed",
                additional_data={
                    'response_count': len(responses),
                    'has_content': has_stream_content,
                    'has_result': has_result,
                    'no_errors': no_errors,
                    'responses': [{'type': r.type, 'content': r.content[:200]} for r in responses]
                },
                start_time=start_time,
                end_time=time.time()
            )
            
        except Exception as e:
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.ERROR,
                duration_seconds=time.time() - start_time,
                error_message=str(e),
                start_time=start_time,
                end_time=time.time()
            )

    async def test_claude_cli_tool_usage(self) -> TestExecutionResult:
        """Test Claude CLI tool invocation (Read, Write, Bash)"""
        test_case = next(tc for tc in self.test_cases if tc.name == "claude_cli_tool_usage")
        start_time = time.time()
        
        try:
            options = ClaudeCliOptions(
                model="sonnet",
                max_turns=5,
                allowed_tools=["Read", "Write", "Edit", "Bash"],
                verbose=True,
                timeout=120,
                dangerously_skip_permissions=True
            )
            wrapper = ClaudeCliWrapper(options)
            
            # Test file operations
            test_file = Path("test_integration_temp.txt")
            prompt = f"""Create a simple text file called '{test_file}' with the content 'Hello Integration Test' and then read it back to confirm it was created correctly."""
            
            responses = []
            tool_uses = []
            
            async for message in wrapper.execute(prompt):
                responses.append(message)
                if message.type in ["tool_use", "tool_action"]:
                    tool_uses.append(message)
                logger.info(f"Tool test: {message.type} - {message.content[:100]}")
            
            # Check if file was created
            file_created = test_file.exists()
            if file_created:
                file_content = test_file.read_text().strip()
                expected_content = "Hello Integration Test"
                content_correct = expected_content in file_content
            else:
                content_correct = False
            
            # Cleanup test file
            if test_file.exists():
                test_file.unlink()
            
            await wrapper.cleanup()
            
            success = len(tool_uses) > 0 and file_created and content_correct
            
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.PASS if success else TestResult.FAIL,
                duration_seconds=time.time() - start_time,
                error_message=None if success else "Tool usage test failed",
                additional_data={
                    'tool_uses': len(tool_uses),
                    'file_created': file_created,
                    'content_correct': content_correct,
                    'responses': len(responses)
                },
                start_time=start_time,
                end_time=time.time()
            )
            
        except Exception as e:
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.ERROR,
                duration_seconds=time.time() - start_time,
                error_message=str(e),
                start_time=start_time,
                end_time=time.time()
            )

    async def test_websocket_connection(self) -> TestExecutionResult:
        """Test WebSocket connection and basic message passing"""
        test_case = next(tc for tc in self.test_cases if tc.name == "websocket_connection")
        start_time = time.time()
        
        try:
            # Connect to WebSocket
            await self.ws_client.connect(timeout=10)
            
            # Send test message
            test_message = {
                'type': 'test',
                'data': {'message': 'Hello WebSocket', 'timestamp': time.time()},
                'test_id': self.test_session_id
            }
            
            await self.ws_client.send_message(test_message)
            
            # Wait for response
            await asyncio.sleep(2)
            
            # Check connection status
            connection_healthy = self.ws_client.connected
            messages_received = len(self.ws_client.messages)
            
            success = connection_healthy and messages_received >= 0  # At least connected
            
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.PASS if success else TestResult.FAIL,
                duration_seconds=time.time() - start_time,
                error_message=None if success else "WebSocket connection failed",
                additional_data={
                    'connected': connection_healthy,
                    'messages_received': messages_received,
                    'recent_messages': self.ws_client.messages[-5:] if self.ws_client.messages else []
                },
                start_time=start_time,
                end_time=time.time()
            )
            
        except Exception as e:
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.ERROR,
                duration_seconds=time.time() - start_time,
                error_message=str(e),
                start_time=start_time,
                end_time=time.time()
            )

    async def test_multi_agent_creation(self) -> TestExecutionResult:
        """Test creating and managing multiple agents"""
        test_case = next(tc for tc in self.test_cases if tc.name == "multi_agent_creation")
        start_time = time.time()
        
        try:
            # Create multi-agent wrapper
            multi_wrapper = MultiAgentCLIWrapper()
            
            # Create manager agent
            manager_config = AgentConfig(
                agent_id=str(uuid.uuid4()),
                role=AgentRole.MANAGER,
                name="test_manager",
                max_memory_mb=256,
                max_execution_time_seconds=120
            )
            
            # Create worker agent
            worker_config = AgentConfig(
                agent_id=str(uuid.uuid4()),
                role=AgentRole.WORKER,
                name="test_worker",
                max_memory_mb=256,
                max_execution_time_seconds=120
            )
            
            # Add agents
            manager_added = await multi_wrapper.add_agent(manager_config)
            worker_added = await multi_wrapper.add_agent(worker_config)
            
            # Check agent status
            agents = multi_wrapper.list_agents()
            
            success = (
                manager_added and worker_added and
                len(agents) == 2 and
                any(agent.config.role == AgentRole.MANAGER for agent in agents) and
                any(agent.config.role == AgentRole.WORKER for agent in agents)
            )
            
            # Cleanup
            await multi_wrapper.shutdown()
            
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.PASS if success else TestResult.FAIL,
                duration_seconds=time.time() - start_time,
                error_message=None if success else "Multi-agent creation failed",
                additional_data={
                    'manager_added': manager_added,
                    'worker_added': worker_added,
                    'total_agents': len(agents),
                    'agent_details': [{'name': a.config.name, 'role': a.config.role.value, 'status': a.status.value} for a in agents]
                },
                start_time=start_time,
                end_time=time.time()
            )
            
        except Exception as e:
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.ERROR,
                duration_seconds=time.time() - start_time,
                error_message=str(e),
                start_time=start_time,
                end_time=time.time()
            )

    async def test_end_to_end_task_execution(self) -> TestExecutionResult:
        """Test complete task flow: UI → Python → Claude CLI → Results"""
        test_case = next(tc for tc in self.test_cases if tc.name == "end_to_end_task_execution")
        start_time = time.time()
        
        try:
            # Step 1: Connect to WebSocket
            await self.ws_client.connect()
            
            # Step 2: Create agent via API
            agent_creation_message = {
                'type': 'agent:create',
                'data': {
                    'role': 'worker',
                    'name': 'e2e_test_agent',
                    'config': {
                        'model': 'sonnet',
                        'timeout': 120
                    }
                },
                'test_id': self.test_session_id
            }
            
            await self.ws_client.send_message(agent_creation_message)
            await asyncio.sleep(2)  # Wait for agent creation
            
            # Step 3: Assign task via WebSocket
            task_message = {
                'type': 'task:execute',
                'data': {
                    'agent_id': 'e2e_test_agent',
                    'task': 'Calculate 5 + 7 and explain the result',
                    'timeout': 60
                },
                'test_id': self.test_session_id
            }
            
            await self.ws_client.send_message(task_message)
            
            # Step 4: Wait for task completion
            task_completed = False
            task_result = None
            timeout = 90  # seconds
            
            start_wait = time.time()
            while time.time() - start_wait < timeout:
                # Check for task completion messages
                task_messages = self.ws_client.get_messages_by_type('task:completed')
                if task_messages:
                    task_completed = True
                    task_result = task_messages[-1]
                    break
                await asyncio.sleep(1)
            
            # Step 5: Validate results
            success = (
                task_completed and 
                task_result and
                'data' in task_result and
                len(self.ws_client.messages) > 0
            )
            
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.PASS if success else TestResult.FAIL,
                duration_seconds=time.time() - start_time,
                error_message=None if success else "End-to-end task execution failed",
                additional_data={
                    'task_completed': task_completed,
                    'task_result': task_result,
                    'total_messages': len(self.ws_client.messages),
                    'message_types': list(set(msg.get('type') for msg in self.ws_client.messages))
                },
                start_time=start_time,
                end_time=time.time()
            )
            
        except Exception as e:
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.ERROR,
                duration_seconds=time.time() - start_time,
                error_message=str(e),
                start_time=start_time,
                end_time=time.time()
            )

    async def test_process_cleanup_validation(self) -> TestExecutionResult:
        """Test Epic 3 process cleanup and resource management"""
        test_case = next(tc for tc in self.test_cases if tc.name == "process_cleanup_validation")
        start_time = time.time()
        
        try:
            initial_processes = len(psutil.pids())
            initial_resources = self.process_manager.get_resource_stats()
            
            # Create multiple wrappers to generate resources
            wrappers = []
            for i in range(3):
                options = ClaudeCliOptions(model="sonnet", timeout=30)
                wrapper = ClaudeCliWrapper(options)
                wrappers.append(wrapper)
            
            # Force cleanup of all wrappers
            for wrapper in wrappers:
                await wrapper.cleanup()
            
            # Force cleanup through process manager
            cleaned, failed, errors = await self.process_manager.force_cleanup_all(timeout=10.0)
            
            final_processes = len(psutil.pids())
            final_resources = self.process_manager.get_resource_stats()
            
            # Validate cleanup
            processes_stable = abs(final_processes - initial_processes) <= 2  # Allow small variance
            resources_cleaned = final_resources['total_resources'] <= initial_resources['total_resources']
            no_cleanup_errors = len(errors) == 0
            
            success = processes_stable and resources_cleaned and no_cleanup_errors
            
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.PASS if success else TestResult.FAIL,
                duration_seconds=time.time() - start_time,
                error_message=None if success else "Process cleanup validation failed",
                additional_data={
                    'initial_processes': initial_processes,
                    'final_processes': final_processes,
                    'cleaned_resources': cleaned,
                    'failed_cleanups': failed,
                    'cleanup_errors': errors,
                    'initial_resources': initial_resources,
                    'final_resources': final_resources
                },
                start_time=start_time,
                end_time=time.time()
            )
            
        except Exception as e:
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.ERROR,
                duration_seconds=time.time() - start_time,
                error_message=str(e),
                start_time=start_time,
                end_time=time.time()
            )

    async def run_single_test(self, test_case: TestCase) -> TestExecutionResult:
        """Run a single test case"""
        logger.info(f"Running test: {test_case.name}")
        
        try:
            # Get test method
            test_method = getattr(self, test_case.test_function)
            
            # Run test with timeout
            result = await asyncio.wait_for(
                test_method(),
                timeout=test_case.timeout_seconds
            )
            
            logger.info(f"Test {test_case.name}: {result.result.value} ({result.duration_seconds:.2f}s)")
            return result
            
        except asyncio.TimeoutError:
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.FAIL,
                duration_seconds=test_case.timeout_seconds,
                error_message=f"Test timed out after {test_case.timeout_seconds} seconds",
                start_time=time.time() - test_case.timeout_seconds,
                end_time=time.time()
            )
        except Exception as e:
            return TestExecutionResult(
                test_case=test_case,
                result=TestResult.ERROR,
                duration_seconds=0,
                error_message=str(e),
                start_time=time.time(),
                end_time=time.time()
            )

    async def run_test_suite(self, 
                           categories: Optional[List[str]] = None,
                           include_slow: bool = True,
                           parallel: bool = False) -> List[TestExecutionResult]:
        """Run the complete test suite"""
        logger.info("Starting Visual Agent Platform Integration Test Suite")
        
        # Filter test cases
        test_cases_to_run = self.test_cases
        if categories:
            test_cases_to_run = [tc for tc in test_cases_to_run if tc.category in categories]
        
        logger.info(f"Running {len(test_cases_to_run)} test cases")
        
        # Check prerequisites
        logger.info("Checking system prerequisites...")
        health_results = {}
        
        claude_ok, claude_msg = await SystemHealthChecker.check_claude_cli()
        health_results['claude_cli'] = (claude_ok, claude_msg)
        
        ws_ok, ws_msg = await SystemHealthChecker.check_websocket_server()
        health_results['websocket'] = (ws_ok, ws_msg)
        
        # Print health status
        for component, (status, message) in health_results.items():
            status_str = "✅ PASS" if status else "❌ FAIL"
            logger.info(f"{component}: {status_str} - {message}")
        
        # Run tests
        if parallel:
            # Run tests in parallel (limited concurrency)
            semaphore = asyncio.Semaphore(3)  # Max 3 concurrent tests
            
            async def run_test_with_semaphore(tc):
                async with semaphore:
                    return await self.run_single_test(tc)
            
            results = await asyncio.gather(
                *[run_test_with_semaphore(tc) for tc in test_cases_to_run],
                return_exceptions=True
            )
        else:
            # Run tests sequentially
            results = []
            for test_case in test_cases_to_run:
                result = await self.run_single_test(test_case)
                results.append(result)
                
                # Add delay between tests for stability
                await asyncio.sleep(1)
        
        self.results = results
        return results

    def generate_test_report(self) -> str:
        """Generate comprehensive test report"""
        if not self.results:
            return "No test results available"
        
        # Summary statistics
        total_tests = len(self.results)
        passed = sum(1 for r in self.results if r.result == TestResult.PASS)
        failed = sum(1 for r in self.results if r.result == TestResult.FAIL)
        errors = sum(1 for r in self.results if r.result == TestResult.ERROR)
        skipped = sum(1 for r in self.results if r.result == TestResult.SKIP)
        
        total_duration = sum(r.duration_seconds for r in self.results)
        
        # Build report
        report = []
        report.append("=" * 80)
        report.append("VISUAL AGENT PLATFORM - INTEGRATION TEST REPORT")
        report.append("=" * 80)
        report.append(f"Test Session ID: {self.test_session_id}")
        report.append(f"Total Tests: {total_tests}")
        report.append(f"Passed: {passed} ({passed/total_tests*100:.1f}%)")
        report.append(f"Failed: {failed} ({failed/total_tests*100:.1f}%)")
        report.append(f"Errors: {errors} ({errors/total_tests*100:.1f}%)")
        report.append(f"Skipped: {skipped} ({skipped/total_tests*100:.1f}%)")
        report.append(f"Total Duration: {total_duration:.2f} seconds")
        report.append("")
        
        # Category breakdown
        categories = {}
        for result in self.results:
            cat = result.test_case.category
            if cat not in categories:
                categories[cat] = {'total': 0, 'passed': 0, 'failed': 0, 'errors': 0}
            
            categories[cat]['total'] += 1
            if result.result == TestResult.PASS:
                categories[cat]['passed'] += 1
            elif result.result == TestResult.FAIL:
                categories[cat]['failed'] += 1
            elif result.result == TestResult.ERROR:
                categories[cat]['errors'] += 1
        
        report.append("RESULTS BY CATEGORY:")
        report.append("-" * 40)
        for cat, stats in categories.items():
            success_rate = stats['passed'] / stats['total'] * 100 if stats['total'] > 0 else 0
            report.append(f"{cat:<20} | {stats['passed']:2}/{stats['total']:2} ({success_rate:5.1f}%) | Failures: {stats['failed']} | Errors: {stats['errors']}")
        
        report.append("")
        
        # Detailed results
        report.append("DETAILED TEST RESULTS:")
        report.append("-" * 80)
        
        for result in self.results:
            status_symbol = {
                TestResult.PASS: "✅",
                TestResult.FAIL: "❌", 
                TestResult.ERROR: "🔥",
                TestResult.SKIP: "⏭️"
            }[result.result]
            
            report.append(f"{status_symbol} {result.test_case.name}")
            report.append(f"   Description: {result.test_case.description}")
            report.append(f"   Duration: {result.duration_seconds:.2f}s")
            report.append(f"   Category: {result.test_case.category}")
            
            if result.error_message:
                report.append(f"   Error: {result.error_message}")
            
            if result.additional_data:
                report.append(f"   Data: {json.dumps(result.additional_data, indent=4)}")
            
            report.append("")
        
        # Performance insights
        report.append("PERFORMANCE INSIGHTS:")
        report.append("-" * 40)
        
        # Slowest tests
        slowest = sorted(self.results, key=lambda r: r.duration_seconds, reverse=True)[:5]
        report.append("Slowest Tests:")
        for i, result in enumerate(slowest, 1):
            report.append(f"  {i}. {result.test_case.name}: {result.duration_seconds:.2f}s")
        
        report.append("")
        
        # Recommendations
        report.append("RECOMMENDATIONS:")
        report.append("-" * 40)
        
        if failed > 0:
            report.append("• Investigate failed tests - check system health and configuration")
        if errors > 0:
            report.append("• Review error logs for system issues or test implementation problems")
        if total_duration > 600:
            report.append("• Consider running tests in parallel to reduce execution time")
        if passed/total_tests < 0.9:
            report.append("• System may not be ready for production deployment")
        
        report.append("=" * 80)
        
        return "\n".join(report)

    async def cleanup(self):
        """Cleanup test resources"""
        try:
            if self.ws_client.connected:
                await self.ws_client.disconnect()
            
            # Force cleanup any remaining processes
            await self.process_manager.force_cleanup_all(timeout=5.0)
            
            logger.info("Test suite cleanup completed")
        except Exception as e:
            logger.error(f"Error during test cleanup: {e}")


# =============================================================================
# MAIN TEST EXECUTION
# =============================================================================

async def main():
    """Main test execution function"""
    print("🚀 Visual Agent Management Platform - Integration Test Suite")
    print("=" * 80)
    
    # Create test suite
    test_suite = IntegrationTestSuite()
    
    try:
        # Run all tests
        results = await test_suite.run_test_suite(
            categories=None,  # Run all categories
            include_slow=True,
            parallel=False  # Sequential for better debugging
        )
        
        # Generate and print report
        report = test_suite.generate_test_report()
        print(report)
        
        # Write report to file
        report_file = Path("integration_test_report.txt")
        report_file.write_text(report)
        print(f"\n📄 Test report saved to: {report_file.absolute()}")
        
        # Return appropriate exit code
        failed_tests = sum(1 for r in results if r.result in [TestResult.FAIL, TestResult.ERROR])
        return 0 if failed_tests == 0 else 1
        
    except Exception as e:
        print(f"❌ Test suite execution failed: {e}")
        logger.exception("Test suite execution error")
        return 1
        
    finally:
        # Cleanup
        await test_suite.cleanup()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)