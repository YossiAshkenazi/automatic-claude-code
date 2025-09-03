#!/usr/bin/env python3
"""
Protocol Testing and Validation Suite
====================================

Comprehensive testing suite for the agent communication protocol,
including unit tests, integration tests, and validation tools.

Test Categories:
- Message serialization/deserialization
- Protocol engine functionality 
- Message routing and delivery
- State management operations
- Quality gate validation
- Human intervention workflows
- Error handling and recovery
- Performance and scalability
"""

import asyncio
import json
import time
import pytest
import tempfile
import os
from typing import Dict, List, Any
from unittest.mock import Mock, patch, AsyncMock
import logging

# Import protocol modules
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from protocol import (
    ProtocolEngine, ProtocolMessage, MessageType, AgentRole, MessagePriority,
    TaskDefinition, TaskProgress, TaskStatus, MessageMetadata,
    ProtocolFactory, create_sample_task
)
from message_router import MessageRouter, RoutingStrategy, AgentInfo
from state_manager import StateManager, SessionState, TaskState, CoordinationPhase
from serialization import MessageSerializer, ProtocolJSONEncoder, MessageSchemaValidator
from quality_framework import QualityGateManager, ValidationContext, QualityGateConfig, ValidationType

logger = logging.getLogger(__name__)

# ============================================================================
# Test Fixtures and Utilities
# ============================================================================

@pytest.fixture
async def protocol_engine():
    """Create protocol engine for testing"""
    engine = ProtocolEngine(AgentRole.MANAGER, "test-manager-001")
    await engine.start()
    yield engine
    await engine.stop()

@pytest.fixture
async def message_router():
    """Create message router for testing"""
    router = MessageRouter()
    await router.start()
    yield router
    await router.stop()

@pytest.fixture
async def state_manager():
    """Create state manager for testing"""
    manager = StateManager(":memory:")
    await manager.start()
    yield manager
    await manager.stop()

@pytest.fixture
def message_serializer():
    """Create message serializer for testing"""
    return MessageSerializer()

@pytest.fixture
def quality_gate_manager():
    """Create quality gate manager for testing"""
    return QualityGateManager()

@pytest.fixture
def sample_message():
    """Create sample protocol message"""
    return ProtocolMessage(
        type=MessageType.TASK_ASSIGNMENT,
        sender=AgentRole.MANAGER,
        recipient=AgentRole.WORKER,
        content={
            'task': {
                'id': 'test-task',
                'title': 'Test Task',
                'description': 'A test task for validation'
            }
        },
        priority=MessagePriority.HIGH,
        metadata=MessageMetadata(
            session_id='test-session',
            task_id='test-task'
        )
    )

class MockWebSocket:
    """Mock WebSocket for testing"""
    def __init__(self):
        self.sent_messages = []
        self.received_messages = []
        self.connected = True
    
    async def send(self, message: str):
        if not self.connected:
            raise Exception("WebSocket not connected")
        self.sent_messages.append(message)
    
    async def receive(self):
        if self.received_messages:
            return self.received_messages.pop(0)
        await asyncio.sleep(0.1)
        return None
    
    def disconnect(self):
        self.connected = False

# ============================================================================
# Protocol Message Tests
# ============================================================================

class TestProtocolMessage:
    """Test protocol message functionality"""
    
    def test_message_creation(self, sample_message):
        """Test message creation and basic properties"""
        assert sample_message.id is not None
        assert sample_message.type == MessageType.TASK_ASSIGNMENT
        assert sample_message.sender == AgentRole.MANAGER
        assert sample_message.recipient == AgentRole.WORKER
        assert sample_message.priority == MessagePriority.HIGH
    
    def test_message_serialization(self, sample_message):
        """Test message to_dict and from_dict"""
        message_dict = sample_message.to_dict()
        
        # Verify required fields
        required_fields = ['id', 'type', 'sender', 'recipient', 'content', 'priority', 'metadata', 'timestamp']
        for field in required_fields:
            assert field in message_dict
        
        # Test round-trip conversion
        reconstructed_message = ProtocolMessage.from_dict(message_dict)
        assert reconstructed_message.id == sample_message.id
        assert reconstructed_message.type == sample_message.type
        assert reconstructed_message.sender == sample_message.sender
    
    def test_message_metadata(self, sample_message):
        """Test message metadata functionality"""
        assert sample_message.metadata.session_id == 'test-session'
        assert sample_message.metadata.task_id == 'test-task'
        assert sample_message.metadata.requires_ack == True
    
    def test_message_validation(self, sample_message):
        """Test message validation"""
        message_dict = sample_message.to_dict()
        assert MessageSchemaValidator.validate_message_dict(message_dict)
        
        # Test invalid message
        invalid_dict = message_dict.copy()
        del invalid_dict['type']
        assert not MessageSchemaValidator.validate_message_dict(invalid_dict)

# ============================================================================
# Protocol Engine Tests  
# ============================================================================

class TestProtocolEngine:
    """Test protocol engine functionality"""
    
    @pytest.mark.asyncio
    async def test_engine_lifecycle(self):
        """Test protocol engine startup and shutdown"""
        engine = ProtocolEngine(AgentRole.MANAGER, "test-manager")
        
        assert not engine.running
        await engine.start()
        assert engine.running
        
        await engine.stop()
        assert not engine.running
    
    @pytest.mark.asyncio
    async def test_message_handling(self, protocol_engine):
        """Test message handling and routing"""
        received_messages = []
        
        def test_handler(message):
            received_messages.append(message)
        
        # Register handler
        protocol_engine.register_handler(MessageType.STATUS_UPDATE, test_handler)
        
        # Create test message
        test_message = ProtocolMessage(
            type=MessageType.STATUS_UPDATE,
            sender=AgentRole.WORKER,
            recipient=AgentRole.MANAGER,
            content={'status': 'active'}
        )
        
        # Process message
        await protocol_engine._process_message(test_message)
        
        # Verify handler was called
        assert len(received_messages) == 1
        assert received_messages[0].type == MessageType.STATUS_UPDATE
    
    @pytest.mark.asyncio
    async def test_acknowledgment_handling(self, protocol_engine):
        """Test message acknowledgment system"""
        # Mock WebSocket
        mock_ws = MockWebSocket()
        protocol_engine.websocket = mock_ws
        
        # Send message requiring acknowledgment
        test_message = ProtocolMessage(
            type=MessageType.TASK_ASSIGNMENT,
            sender=AgentRole.MANAGER,
            recipient=AgentRole.WORKER,
            content={'task': 'test'},
            metadata=MessageMetadata(requires_ack=True)
        )
        
        await protocol_engine.send_message(test_message)
        
        # Verify message was sent
        assert len(mock_ws.sent_messages) == 1
        
        # Verify message is in pending acks
        assert test_message.id in protocol_engine.pending_acks
        
        # Send acknowledgment
        ack_message = ProtocolMessage(
            type=MessageType.ACK,
            sender=AgentRole.WORKER,
            recipient=AgentRole.MANAGER,
            content={'original_message_id': test_message.id}
        )
        
        await protocol_engine._handle_ack(ack_message)
        
        # Verify ACK was processed
        assert test_message.id not in protocol_engine.pending_acks

# ============================================================================
# Message Router Tests
# ============================================================================

class TestMessageRouter:
    """Test message routing functionality"""
    
    @pytest.mark.asyncio
    async def test_agent_registration(self, message_router):
        """Test agent registration and management"""
        # Create mock protocol engine
        mock_engine = Mock()
        
        # Register agent
        message_router.register_agent(
            "test-agent-001", 
            AgentRole.WORKER, 
            mock_engine,
            capabilities={'python', 'testing'}
        )
        
        # Verify agent is registered
        assert "test-agent-001" in message_router.agents
        agent_info = message_router.agents["test-agent-001"]
        assert agent_info.role == AgentRole.WORKER
        assert 'python' in agent_info.capabilities
    
    @pytest.mark.asyncio
    async def test_message_routing(self, message_router):
        """Test message routing strategies"""
        # Register multiple worker agents
        for i in range(3):
            mock_engine = Mock()
            message_router.register_agent(f"worker-{i}", AgentRole.WORKER, mock_engine)
        
        # Test round-robin routing
        test_message = ProtocolMessage(
            type=MessageType.TASK_ASSIGNMENT,
            sender=AgentRole.MANAGER,
            recipient=AgentRole.WORKER,
            content={'task': 'test'}
        )
        
        # Route message multiple times
        for _ in range(3):
            result = await message_router.route_message(test_message)
            assert result == True
    
    @pytest.mark.asyncio
    async def test_circuit_breaker(self, message_router):
        """Test circuit breaker functionality"""
        # Register agent
        mock_engine = Mock()
        mock_engine.send_message = AsyncMock(return_value=False)  # Simulate failure
        
        message_router.register_agent("failing-agent", AgentRole.WORKER, mock_engine)
        
        # Send multiple failing messages
        test_message = ProtocolMessage(
            type=MessageType.TASK_ASSIGNMENT,
            sender=AgentRole.MANAGER,
            recipient=AgentRole.WORKER,
            content={'task': 'test'}
        )
        
        # Trigger circuit breaker
        for _ in range(6):  # Exceeds failure threshold
            await message_router._deliver_message("failing-agent", test_message)
        
        # Verify circuit breaker is open
        circuit_breaker = message_router.circuit_breakers["failing-agent"]
        assert circuit_breaker['state'] == 'open'

# ============================================================================
# State Manager Tests
# ============================================================================

class TestStateManager:
    """Test state management functionality"""
    
    @pytest.mark.asyncio
    async def test_session_management(self, state_manager):
        """Test session creation and management"""
        # Create session
        session = await state_manager.create_session(
            "test-session-001",
            "Test initial task",
            "/test/work/dir"
        )
        
        assert session.session_id == "test-session-001"
        assert session.initial_task == "Test initial task"
        assert session.work_dir == "/test/work/dir"
        assert session.status == "active"
        
        # Retrieve session
        retrieved_session = await state_manager.get_session("test-session-001")
        assert retrieved_session is not None
        assert retrieved_session.session_id == session.session_id
        
        # Update session
        success = await state_manager.update_session("test-session-001", {"status": "paused"})
        assert success == True
        
        updated_session = await state_manager.get_session("test-session-001")
        assert updated_session.status == "paused"
    
    @pytest.mark.asyncio
    async def test_task_management(self, state_manager):
        """Test task creation and management"""
        # Create session first
        session = await state_manager.create_session("test-session", "Test task")
        
        # Create task
        task_def = TaskDefinition(
            title="Test Task",
            description="A test task",
            requirements=["python", "testing"],
            priority=MessagePriority.HIGH
        )
        
        task_state = await state_manager.create_task(
            "test-task-001",
            session.session_id,
            task_def
        )
        
        assert task_state.task_id == "test-task-001"
        assert task_state.session_id == session.session_id
        assert task_state.progress.status == TaskStatus.PENDING
        
        # Update task progress
        success = await state_manager.update_task("test-task-001", {
            "progress": {
                "status": TaskStatus.IN_PROGRESS.value,
                "progress_percent": 50.0,
                "current_step": "Implementing solution"
            }
        })
        
        assert success == True
        
        # Verify update
        updated_task = await state_manager.get_task("test-task-001")
        assert updated_task.progress.status == TaskStatus.IN_PROGRESS
        assert updated_task.progress.progress_percent == 50.0
    
    @pytest.mark.asyncio
    async def test_workflow_transitions(self, state_manager):
        """Test workflow phase transitions"""
        # Create session
        session = await state_manager.create_session("test-session", "Test workflow")
        
        # Transition phases
        success = await state_manager.transition_workflow_phase(
            session.session_id,
            CoordinationPhase.ASSIGNMENT,
            {"reason": "Starting task assignment"}
        )
        
        assert success == True
        
        # Verify phase transition
        workflow = state_manager.workflows.get(session.session_id)
        assert workflow is not None
        assert workflow.current_phase == CoordinationPhase.ASSIGNMENT
        assert len(workflow.phase_history) == 1

# ============================================================================
# Serialization Tests
# ============================================================================

class TestMessageSerialization:
    """Test message serialization functionality"""
    
    def test_json_encoder(self, sample_message):
        """Test custom JSON encoder"""
        encoder = ProtocolJSONEncoder()
        
        # Test enum encoding
        encoded = encoder.default(MessageType.TASK_ASSIGNMENT)
        assert encoded['_type'] == 'enum'
        assert encoded['value'] == 'task_assignment'
        
        # Test set encoding
        test_set = {'item1', 'item2', 'item3'}
        encoded = encoder.default(test_set)
        assert encoded['_type'] == 'set'
        assert len(encoded['items']) == 3
    
    def test_message_serialization(self, message_serializer, sample_message):
        """Test complete message serialization"""
        # Serialize message
        serialized_data = message_serializer.serialize(sample_message)
        assert isinstance(serialized_data, bytes)
        assert len(serialized_data) > 0
        
        # Deserialize message
        deserialized_message = message_serializer.deserialize(serialized_data)
        assert deserialized_message.id == sample_message.id
        assert deserialized_message.type == sample_message.type
        assert deserialized_message.sender == sample_message.sender
    
    def test_compression(self, message_serializer):
        """Test message compression for large messages"""
        # Create large message
        large_content = {f"key_{i}": f"value_{i}" * 100 for i in range(100)}
        large_message = ProtocolMessage(
            type=MessageType.STATUS_UPDATE,
            sender=AgentRole.MANAGER,
            recipient=AgentRole.WORKER,
            content=large_content
        )
        
        # Serialize (should trigger compression)
        serialized_data = message_serializer.serialize(large_message)
        
        # Verify compression was used
        assert serialized_data.startswith(b'GZIP:')
        
        # Verify round-trip
        deserialized = message_serializer.deserialize(serialized_data)
        assert deserialized.content == large_content

# ============================================================================
# Quality Gate Tests
# ============================================================================

class TestQualityGates:
    """Test quality gate validation"""
    
    @pytest.mark.asyncio
    async def test_basic_validation(self, quality_gate_manager):
        """Test basic quality validation"""
        # Create validation context
        context = ValidationContext(
            task_id="test-task",
            session_id="test-session",
            task_output={
                "files": {
                    "main.py": "def hello():\n    return 'Hello World'"
                },
                "success": True
            },
            task_requirements=["create hello function"],
            code_files=["main.py"]
        )
        
        # Run validation
        result = await quality_gate_manager.validate_task_output(context, "basic_quality")
        
        assert result.task_id == "test-task"
        assert result.score >= 0.0
        assert len(result.feedback) > 0
    
    @pytest.mark.asyncio
    async def test_custom_quality_gate(self, quality_gate_manager):
        """Test custom quality gate registration"""
        # Create custom gate
        custom_gate = QualityGateConfig(
            gate_id="custom_test_gate",
            name="Custom Test Gate",
            description="Custom gate for testing",
            validation_type=ValidationType.AUTOMATED,
            threshold_score=0.9
        )
        
        quality_gate_manager.register_quality_gate(custom_gate)
        
        # Verify gate is registered
        assert "custom_test_gate" in quality_gate_manager.gates
        
        # Test validation with custom gate
        context = ValidationContext(
            task_id="test-task",
            session_id="test-session",
            task_output={"success": True},
            task_requirements=[]
        )
        
        result = await quality_gate_manager.validate_task_output(context, "custom_test_gate")
        assert result.gate_id == "custom_test_gate"

# ============================================================================
# Integration Tests
# ============================================================================

class TestIntegration:
    """Integration tests for complete protocol workflows"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_task_flow(self):
        """Test complete task assignment and execution flow"""
        # Create components
        state_manager = StateManager(":memory:")
        await state_manager.start()
        
        router = MessageRouter()
        await router.start()
        
        try:
            # Create manager and worker protocols
            manager_protocol = ProtocolFactory.create_manager_protocol("manager-001")
            worker_protocol = ProtocolFactory.create_worker_protocol("worker-001")
            
            await manager_protocol.start()
            await worker_protocol.start()
            
            # Register agents with router
            router.register_agent("manager-001", AgentRole.MANAGER, manager_protocol)
            router.register_agent("worker-001", AgentRole.WORKER, worker_protocol)
            
            # Create session
            session = await state_manager.create_session("integration-test", "Test integration")
            
            # Create and assign task
            task = create_sample_task()
            task_id = await manager_protocol.task_manager.assign_task(task, AgentRole.WORKER)
            
            # Wait for task processing
            await asyncio.sleep(2)
            
            # Verify task was created and processed
            task_state = await state_manager.get_task(task_id)
            assert task_state is not None
            
        finally:
            await manager_protocol.stop()
            await worker_protocol.stop()
            await router.stop()
            await state_manager.stop()
    
    @pytest.mark.asyncio
    async def test_protocol_error_handling(self):
        """Test protocol error handling and recovery"""
        engine = ProtocolEngine(AgentRole.MANAGER, "error-test")
        await engine.start()
        
        try:
            # Test handling of malformed message
            malformed_json = '{"invalid": json}'
            
            # This should not crash the protocol engine
            await engine.receive_message(malformed_json)
            
            # Engine should still be running
            assert engine.running == True
            
        finally:
            await engine.stop()

# ============================================================================
# Performance Tests
# ============================================================================

class TestPerformance:
    """Performance and scalability tests"""
    
    @pytest.mark.asyncio
    async def test_message_throughput(self, message_serializer):
        """Test message serialization throughput"""
        messages = []
        
        # Create test messages
        for i in range(1000):
            message = ProtocolMessage(
                type=MessageType.STATUS_UPDATE,
                sender=AgentRole.WORKER,
                recipient=AgentRole.MANAGER,
                content={'status': f'update_{i}'}
            )
            messages.append(message)
        
        # Measure serialization time
        start_time = time.time()
        
        for message in messages:
            serialized = message_serializer.serialize(message)
            deserialized = message_serializer.deserialize(serialized)
        
        end_time = time.time()
        duration = end_time - start_time
        throughput = len(messages) / duration
        
        logger.info(f"Message throughput: {throughput:.2f} messages/second")
        
        # Assert reasonable performance (adjust threshold as needed)
        assert throughput > 100  # At least 100 messages per second
    
    @pytest.mark.asyncio
    async def test_concurrent_operations(self, state_manager):
        """Test concurrent state operations"""
        # Create session
        session = await state_manager.create_session("concurrent-test", "Concurrent operations test")
        
        # Create multiple concurrent tasks
        async def create_task(task_num):
            task_def = TaskDefinition(
                title=f"Concurrent Task {task_num}",
                description=f"Task {task_num} for concurrency testing"
            )
            return await state_manager.create_task(f"task-{task_num}", session.session_id, task_def)
        
        # Run tasks concurrently
        tasks = await asyncio.gather(*[create_task(i) for i in range(100)])
        
        # Verify all tasks were created
        assert len(tasks) == 100
        for i, task in enumerate(tasks):
            assert task.task_id == f"task-{i}"

# ============================================================================
# Test Runner and Utilities
# ============================================================================

class ProtocolTestRunner:
    """Test runner for protocol validation"""
    
    def __init__(self):
        self.test_results = []
    
    async def run_all_tests(self):
        """Run all protocol tests"""
        logger.info("Starting protocol test suite...")
        
        test_classes = [
            TestProtocolMessage,
            TestProtocolEngine, 
            TestMessageRouter,
            TestStateManager,
            TestMessageSerialization,
            TestQualityGates,
            TestIntegration,
            TestPerformance
        ]
        
        for test_class in test_classes:
            await self._run_test_class(test_class)
        
        # Print summary
        self._print_test_summary()
    
    async def _run_test_class(self, test_class):
        """Run tests in a test class"""
        class_name = test_class.__name__
        logger.info(f"Running {class_name} tests...")
        
        # This is a simplified test runner
        # In production, would use pytest properly
        instance = test_class()
        
        # Get test methods
        test_methods = [method for method in dir(instance) if method.startswith('test_')]
        
        for method_name in test_methods:
            try:
                method = getattr(instance, method_name)
                if asyncio.iscoroutinefunction(method):
                    await method()
                else:
                    method()
                
                self.test_results.append({
                    'class': class_name,
                    'method': method_name,
                    'status': 'PASSED'
                })
                
                logger.info(f"  ✓ {method_name}")
                
            except Exception as e:
                self.test_results.append({
                    'class': class_name,
                    'method': method_name,
                    'status': 'FAILED',
                    'error': str(e)
                })
                
                logger.error(f"  ✗ {method_name}: {e}")
    
    def _print_test_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['status'] == 'PASSED'])
        failed_tests = total_tests - passed_tests
        
        logger.info(f"\n{'='*50}")
        logger.info(f"TEST SUMMARY")
        logger.info(f"{'='*50}")
        logger.info(f"Total tests: {total_tests}")
        logger.info(f"Passed: {passed_tests}")
        logger.info(f"Failed: {failed_tests}")
        logger.info(f"Success rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            logger.info(f"\nFAILED TESTS:")
            for result in self.test_results:
                if result['status'] == 'FAILED':
                    logger.info(f"  - {result['class']}.{result['method']}: {result.get('error', 'Unknown error')}")

# ============================================================================
# Protocol Validation Tools
# ============================================================================

class ProtocolValidator:
    """Tools for validating protocol implementations"""
    
    @staticmethod
    def validate_message_format(message_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Validate message format and return validation report"""
        report = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'info': []
        }
        
        # Check required fields
        required_fields = ['id', 'type', 'sender', 'recipient', 'content', 'priority', 'metadata', 'timestamp']
        for field in required_fields:
            if field not in message_dict:
                report['errors'].append(f"Missing required field: {field}")
                report['valid'] = False
        
        # Validate field types
        if 'timestamp' in message_dict and not isinstance(message_dict['timestamp'], (int, float)):
            report['errors'].append("Timestamp must be a number")
            report['valid'] = False
        
        if 'content' in message_dict and not isinstance(message_dict['content'], dict):
            report['errors'].append("Content must be a dictionary")
            report['valid'] = False
        
        # Check enum values
        if 'type' in message_dict:
            valid_types = [mt.value for mt in MessageType]
            if message_dict['type'] not in valid_types:
                report['errors'].append(f"Invalid message type: {message_dict['type']}")
                report['valid'] = False
        
        # Performance warnings
        if 'content' in message_dict:
            content_size = len(json.dumps(message_dict['content']))
            if content_size > 10000:  # 10KB
                report['warnings'].append(f"Large message content: {content_size} bytes")
        
        return report
    
    @staticmethod
    def validate_protocol_flow(messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate protocol message flow"""
        report = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'flow_analysis': {}
        }
        
        # Track message flows
        pending_acks = {}
        task_flows = {}
        
        for message in messages:
            msg_type = message.get('type')
            msg_id = message.get('id')
            metadata = message.get('metadata', {})
            
            # Track ACK requirements
            if metadata.get('requires_ack'):
                pending_acks[msg_id] = message
            
            # Process ACKs
            if msg_type == 'ack':
                original_id = message.get('content', {}).get('original_message_id')
                if original_id in pending_acks:
                    del pending_acks[original_id]
                else:
                    report['warnings'].append(f"ACK for unknown message: {original_id}")
            
            # Track task flows
            task_id = metadata.get('task_id')
            if task_id:
                if task_id not in task_flows:
                    task_flows[task_id] = []
                task_flows[task_id].append(msg_type)
        
        # Check for unacknowledged messages
        if pending_acks:
            report['warnings'].extend([
                f"Unacknowledged message: {msg_id}" 
                for msg_id in pending_acks.keys()
            ])
        
        report['flow_analysis'] = {
            'unacknowledged_messages': len(pending_acks),
            'task_flows': len(task_flows),
            'message_count': len(messages)
        }
        
        return report

# Example usage and main execution
async def main():
    """Main test execution"""
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    logger.info("Starting Protocol Test Suite")
    
    # Run tests
    test_runner = ProtocolTestRunner()
    await test_runner.run_all_tests()
    
    logger.info("Protocol testing completed")

if __name__ == "__main__":
    asyncio.run(main())