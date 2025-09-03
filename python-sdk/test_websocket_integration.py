#!/usr/bin/env python3
"""
Comprehensive test suite for WebSocket bi-directional communication
between Python agent orchestrator and React dashboard.

Tests:
- Connection establishment and health monitoring
- Message protocol validation
- Agent creation and management
- Command execution with response correlation
- Task assignment and progress tracking
- Error handling and recovery
- Latency and performance requirements (<100ms)
"""

import asyncio
import json
import time
import uuid
from typing import Dict, List, Any
import websockets
import logging

from api.websocket.server import WebSocketServer
from api.websocket.client import WebSocketClient
from api.websocket.message_protocol import (
    Message, MessageType, MessageProtocol, AgentType, TaskInfo, TaskStatus
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WebSocketIntegrationTester:
    """Comprehensive test suite for WebSocket integration"""
    
    def __init__(self):
        self.server = None
        self.client = None
        self.test_results = {
            'tests_run': 0,
            'tests_passed': 0,
            'tests_failed': 0,
            'latency_measurements': [],
            'errors': []
        }
        
    async def setup(self):
        """Setup test environment"""
        logger.info("Setting up test environment...")
        
        # Start WebSocket server
        self.server = WebSocketServer(host="localhost", port=8766)
        await self.server.start()
        
        # Wait for server to be ready
        await asyncio.sleep(1)
        
        # Create client
        self.client = WebSocketClient(uri="ws://localhost:8766")
        
        logger.info("Test environment ready")
    
    async def teardown(self):
        """Cleanup test environment"""
        logger.info("Cleaning up test environment...")
        
        if self.client:
            await self.client.disconnect()
        
        if self.server:
            await self.server.stop()
        
        logger.info("Cleanup complete")
    
    def record_test_result(self, test_name: str, passed: bool, error: str = None, latency: float = None):
        """Record test result"""
        self.test_results['tests_run'] += 1
        
        if passed:
            self.test_results['tests_passed'] += 1
            logger.info(f"✅ {test_name} - PASSED" + (f" ({latency:.2f}ms)" if latency else ""))
        else:
            self.test_results['tests_failed'] += 1
            error_msg = f"❌ {test_name} - FAILED: {error}"
            logger.error(error_msg)
            self.test_results['errors'].append(error_msg)
        
        if latency:
            self.test_results['latency_measurements'].append(latency)
    
    async def test_connection_establishment(self):
        """Test WebSocket connection establishment"""
        try:
            start_time = time.time()
            success = await self.client.connect()
            connection_time = (time.time() - start_time) * 1000
            
            self.record_test_result(
                "Connection Establishment",
                success,
                None if success else "Failed to connect",
                connection_time
            )
            
            # Test connection acknowledgment
            if success:
                await asyncio.sleep(0.1)  # Wait for ACK
                self.record_test_result(
                    "Connection Acknowledgment",
                    self.client.isConnected(),
                    None if self.client.isConnected() else "No ACK received"
                )
            
        except Exception as e:
            self.record_test_result("Connection Establishment", False, str(e))
    
    async def test_message_protocol_validation(self):
        """Test message protocol validation"""
        try:
            # Test valid message
            valid_message = Message.create(
                MessageType.SYSTEM_STATUS,
                {'test': 'data'}
            )
            
            message_dict = valid_message.to_dict()
            is_valid = MessageProtocol.validate_message(message_dict)
            
            self.record_test_result(
                "Valid Message Protocol",
                is_valid,
                "Valid message failed validation"
            )
            
            # Test invalid message (missing required fields)
            invalid_message = {'type': 'invalid', 'data': 'test'}
            is_invalid = not MessageProtocol.validate_message(invalid_message)
            
            self.record_test_result(
                "Invalid Message Rejection",
                is_invalid,
                "Invalid message passed validation"
            )
            
            # Test message serialization/deserialization
            reconstructed = Message.from_dict(message_dict)
            serialization_ok = (
                reconstructed.type == valid_message.type and
                reconstructed.payload == valid_message.payload
            )
            
            self.record_test_result(
                "Message Serialization",
                serialization_ok,
                "Message serialization failed"
            )
            
        except Exception as e:
            self.record_test_result("Message Protocol Validation", False, str(e))
    
    async def test_ping_pong_health_monitoring(self):
        """Test ping/pong health monitoring"""
        try:
            if not self.client.isConnected():
                self.record_test_result("Ping/Pong Health", False, "Client not connected")
                return
            
            # Send ping and measure response time
            start_time = time.time()
            ping_message = MessageProtocol.create_ping_message(self.client.client_id)
            
            # Set up pong handler
            pong_received = False
            pong_latency = None
            
            async def handle_pong(message: Message):
                nonlocal pong_received, pong_latency
                if message.type == MessageType.CONNECTION_PONG:
                    pong_received = True
                    pong_latency = (time.time() - start_time) * 1000
            
            self.client.add_message_handler(MessageType.CONNECTION_PONG, handle_pong)
            
            await self.client.sendMessage(ping_message)
            
            # Wait for pong
            for _ in range(50):  # 5 second timeout
                if pong_received:
                    break
                await asyncio.sleep(0.1)
            
            self.record_test_result(
                "Ping/Pong Health Monitoring",
                pong_received,
                "No pong response received" if not pong_received else None,
                pong_latency
            )
            
        except Exception as e:
            self.record_test_result("Ping/Pong Health", False, str(e))
    
    async def test_agent_creation(self):
        """Test agent creation via WebSocket"""
        try:
            if not self.client.isConnected():
                self.record_test_result("Agent Creation", False, "Client not connected")
                return
            
            start_time = time.time()
            
            # Create agent
            agent_info = await self.client.create_agent(
                AgentType.WORKER,
                "sonnet",
                ["coding", "analysis"]
            )
            
            creation_time = (time.time() - start_time) * 1000
            
            success = (
                agent_info is not None and
                'id' in agent_info and
                agent_info['type'] == AgentType.WORKER.value
            )
            
            self.record_test_result(
                "Agent Creation",
                success,
                "Invalid agent info returned" if not success else None,
                creation_time
            )
            
            # Store agent ID for further tests
            if success:
                self.test_agent_id = agent_info['id']
            
        except Exception as e:
            self.record_test_result("Agent Creation", False, str(e))
    
    async def test_command_execution(self):
        """Test command execution with response correlation"""
        try:
            if not hasattr(self, 'test_agent_id'):
                self.record_test_result("Command Execution", False, "No test agent available")
                return
            
            start_time = time.time()
            
            # Execute simple command
            command = "Reply with 'Hello from agent' if you can process requests."
            result = await self.client.execute_command(
                self.test_agent_id,
                command
            )
            
            execution_time = (time.time() - start_time) * 1000
            
            success = result is not None and "hello" in str(result).lower()
            
            self.record_test_result(
                "Command Execution",
                success,
                f"Unexpected result: {result}" if not success else None,
                execution_time
            )
            
        except Exception as e:
            self.record_test_result("Command Execution", False, str(e))
    
    async def test_task_assignment(self):
        """Test task assignment and tracking"""
        try:
            if not hasattr(self, 'test_agent_id'):
                self.record_test_result("Task Assignment", False, "No test agent available")
                return
            
            start_time = time.time()
            
            # Create and assign task
            task_data = {
                'title': 'Test Task',
                'description': 'Simple test task for validation',
                'metadata': {'test': True}
            }
            
            task_info = await self.client.assign_task(task_data, self.test_agent_id)
            
            assignment_time = (time.time() - start_time) * 1000
            
            success = (
                task_info is not None and
                'id' in task_info and
                'title' in task_info and
                task_info['assigned_agent'] == self.test_agent_id
            )
            
            self.record_test_result(
                "Task Assignment",
                success,
                "Invalid task info returned" if not success else None,
                assignment_time
            )
            
        except Exception as e:
            self.record_test_result("Task Assignment", False, str(e))
    
    async def test_system_status_monitoring(self):
        """Test system status retrieval"""
        try:
            start_time = time.time()
            
            status = await self.client.get_system_status()
            
            status_time = (time.time() - start_time) * 1000
            
            success = (
                status is not None and
                'agents' in status and
                'tasks' in status and
                isinstance(status['agents'], dict)
            )
            
            self.record_test_result(
                "System Status Monitoring",
                success,
                f"Invalid status format: {status}" if not success else None,
                status_time
            )
            
        except Exception as e:
            self.record_test_result("System Status Monitoring", False, str(e))
    
    async def test_error_handling(self):
        """Test error handling and recovery"""
        try:
            # Test invalid agent ID
            try:
                await self.client.execute_command("invalid-agent-id", "test command")
                self.record_test_result("Error Handling", False, "Should have thrown error for invalid agent")
            except Exception:
                self.record_test_result("Error Handling", True)
            
            # Test invalid message type
            invalid_message = Message.create(
                "invalid_message_type",  # This should cause validation error
                {'test': 'data'}
            )
            
            # The client should handle this gracefully
            await self.client.sendMessage(invalid_message)
            
            # If we get here without crashing, error handling is working
            self.record_test_result("Invalid Message Handling", True)
            
        except Exception as e:
            self.record_test_result("Error Handling", False, str(e))
    
    async def test_concurrent_operations(self):
        """Test concurrent operations and message correlation"""
        try:
            if not hasattr(self, 'test_agent_id'):
                self.record_test_result("Concurrent Operations", False, "No test agent available")
                return
            
            start_time = time.time()
            
            # Execute multiple commands concurrently
            commands = [
                "Reply with 'Response 1'",
                "Reply with 'Response 2'", 
                "Reply with 'Response 3'"
            ]
            
            tasks = [
                self.client.execute_command(self.test_agent_id, cmd)
                for cmd in commands
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            concurrent_time = (time.time() - start_time) * 1000
            
            success = (
                len(results) == 3 and
                all(not isinstance(r, Exception) for r in results) and
                all("response" in str(r).lower() for r in results if not isinstance(r, Exception))
            )
            
            self.record_test_result(
                "Concurrent Operations",
                success,
                f"Failed results: {results}" if not success else None,
                concurrent_time
            )
            
        except Exception as e:
            self.record_test_result("Concurrent Operations", False, str(e))
    
    async def test_latency_requirements(self):
        """Test latency requirements (<100ms for system operations)"""
        try:
            if not self.test_results['latency_measurements']:
                self.record_test_result("Latency Requirements", False, "No latency measurements available")
                return
            
            # Calculate statistics
            latencies = self.test_results['latency_measurements']
            avg_latency = sum(latencies) / len(latencies)
            max_latency = max(latencies)
            min_latency = min(latencies)
            
            # Check if average latency is under 100ms
            avg_under_100ms = avg_latency < 100
            
            # Check if 95% of operations are under 200ms (more lenient for CI)
            sorted_latencies = sorted(latencies)
            p95_index = int(len(sorted_latencies) * 0.95)
            p95_latency = sorted_latencies[p95_index] if p95_index < len(sorted_latencies) else max_latency
            p95_under_200ms = p95_latency < 200
            
            success = avg_under_100ms and p95_under_200ms
            
            error_msg = None if success else f"Avg: {avg_latency:.2f}ms, P95: {p95_latency:.2f}ms"
            
            self.record_test_result(
                f"Latency Requirements (avg: {avg_latency:.2f}ms, p95: {p95_latency:.2f}ms)",
                success,
                error_msg
            )
            
            logger.info(f"Latency stats - Min: {min_latency:.2f}ms, Avg: {avg_latency:.2f}ms, Max: {max_latency:.2f}ms, P95: {p95_latency:.2f}ms")
            
        except Exception as e:
            self.record_test_result("Latency Requirements", False, str(e))
    
    async def run_all_tests(self):
        """Run all integration tests"""
        logger.info("Starting WebSocket integration tests...")
        
        try:
            await self.setup()
            
            # Run tests in sequence
            test_methods = [
                self.test_connection_establishment,
                self.test_message_protocol_validation,
                self.test_ping_pong_health_monitoring,
                self.test_agent_creation,
                self.test_command_execution,
                self.test_task_assignment,
                self.test_system_status_monitoring,
                self.test_error_handling,
                self.test_concurrent_operations,
                self.test_latency_requirements
            ]
            
            for test_method in test_methods:
                try:
                    await test_method()
                except Exception as e:
                    logger.error(f"Test {test_method.__name__} failed with exception: {e}")
                    self.record_test_result(test_method.__name__, False, str(e))
                
                # Small delay between tests
                await asyncio.sleep(0.1)
            
        finally:
            await self.teardown()
        
        # Print results
        self.print_test_results()
        
        # Return success status
        return self.test_results['tests_failed'] == 0
    
    def print_test_results(self):
        """Print comprehensive test results"""
        results = self.test_results
        
        print("\n" + "="*80)
        print("WEBSOCKET INTEGRATION TEST RESULTS")
        print("="*80)
        
        print(f"Tests Run: {results['tests_run']}")
        print(f"Tests Passed: {results['tests_passed']}")
        print(f"Tests Failed: {results['tests_failed']}")
        
        if results['tests_run'] > 0:
            success_rate = (results['tests_passed'] / results['tests_run']) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        
        if results['latency_measurements']:
            avg_latency = sum(results['latency_measurements']) / len(results['latency_measurements'])
            print(f"Average Latency: {avg_latency:.2f}ms")
        
        if results['errors']:
            print(f"\nERRORS:")
            for error in results['errors']:
                print(f"  - {error}")
        
        print("="*80)
        
        if results['tests_failed'] == 0:
            print("🎉 ALL TESTS PASSED!")
        else:
            print(f"❌ {results['tests_failed']} TEST(S) FAILED")
        
        print("="*80 + "\n")


async def main():
    """Run the integration test suite"""
    tester = WebSocketIntegrationTester()
    success = await tester.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)