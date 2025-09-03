#!/usr/bin/env python3
"""
Agent Communication Protocol - Integration Demo
==============================================

Comprehensive demonstration of the agent communication protocol featuring:
- Manager-Worker agent coordination
- Real-time task assignment and progress tracking
- Quality gate validation
- Human intervention workflows
- State management and persistence
- WebSocket communication simulation

This demo shows the complete workflow from task creation to completion
with quality validation and human oversight capabilities.
"""

import asyncio
import json
import time
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from protocol import (
    ProtocolEngine, ProtocolMessage, MessageType, AgentRole, MessagePriority,
    TaskDefinition, TaskProgress, TaskStatus, MessageMetadata,
    ProtocolFactory, create_sample_task, CoordinationPhase
)
from message_router import MessageRouter
from state_manager import StateManager, SessionState
from quality_framework import QualityGateManager, ValidationContext, HumanInterventionController
from serialization import MessageSerializer

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================================================
# Demo Configuration
# ============================================================================

class DemoConfig:
    """Configuration for the integration demo"""
    DEMO_DURATION = 60  # seconds
    TASK_COUNT = 3
    SIMULATE_NETWORK_DELAY = True
    ENABLE_QUALITY_GATES = True
    ENABLE_HUMAN_INTERVENTION = True
    ENABLE_STATE_PERSISTENCE = True

# ============================================================================
# Mock WebSocket Server for Demo
# ============================================================================

class MockWebSocketServer:
    """Mock WebSocket server for demonstration purposes"""
    
    def __init__(self):
        self.clients = {}
        self.message_history = []
        self.running = False
    
    async def start(self):
        """Start the mock WebSocket server"""
        self.running = True
        logger.info("Mock WebSocket server started")
    
    async def stop(self):
        """Stop the mock WebSocket server"""
        self.running = False
        logger.info("Mock WebSocket server stopped")
    
    def register_client(self, client_id: str, protocol_engine: ProtocolEngine):
        """Register a client (protocol engine) with the server"""
        self.clients[client_id] = protocol_engine
        protocol_engine.websocket = self
        logger.info(f"Client registered: {client_id}")
    
    async def send(self, message: str):
        """Simulate sending message (in real implementation, would send via WebSocket)"""
        if DemoConfig.SIMULATE_NETWORK_DELAY:
            await asyncio.sleep(0.1)  # Simulate network latency
        
        try:
            message_data = json.loads(message)
            self.message_history.append({
                'timestamp': time.time(),
                'message': message_data
            })
            
            # Route message to appropriate client
            recipient = message_data.get('recipient')
            if recipient:
                await self._route_message_to_client(message)
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def _route_message_to_client(self, message: str):
        """Route message to appropriate client based on recipient"""
        try:
            message_data = json.loads(message)
            recipient = message_data.get('recipient')
            
            # Simple routing based on recipient role
            target_clients = []
            for client_id, client in self.clients.items():
                if client.agent_role.value == recipient:
                    target_clients.append(client)
            
            # Deliver to all matching clients
            for client in target_clients:
                try:
                    await client.receive_message(message)
                except Exception as e:
                    logger.error(f"Error delivering message to client: {e}")
                    
        except Exception as e:
            logger.error(f"Error routing message: {e}")

# ============================================================================
# Enhanced Demo Agents
# ============================================================================

class DemoManagerAgent:
    """Enhanced Manager agent for demonstration"""
    
    def __init__(self, agent_id: str, websocket_server: MockWebSocketServer):
        self.agent_id = agent_id
        self.protocol = ProtocolFactory.create_manager_protocol(agent_id)
        self.websocket_server = websocket_server
        self.assigned_tasks = []
        self.completed_tasks = []
        
        # Register with WebSocket server
        websocket_server.register_client(agent_id, self.protocol)
        
        # Setup custom message handlers
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup custom message handlers for demo"""
        self.protocol.register_handler(MessageType.TASK_ACCEPTED, self._handle_task_accepted)
        self.protocol.register_handler(MessageType.TASK_PROGRESS, self._handle_task_progress)
        self.protocol.register_handler(MessageType.TASK_COMPLETION, self._handle_task_completion)
        self.protocol.register_handler(MessageType.QUALITY_RESULT, self._handle_quality_result)
    
    async def start(self):
        """Start the manager agent"""
        await self.protocol.start()
        logger.info(f"Manager agent {self.agent_id} started")
    
    async def stop(self):
        """Stop the manager agent"""
        await self.protocol.stop()
        logger.info(f"Manager agent {self.agent_id} stopped")
    
    async def create_and_assign_task(self, task_definition: TaskDefinition) -> str:
        """Create and assign a task to a worker"""
        task_id = await self.protocol.task_manager.assign_task(task_definition, AgentRole.WORKER)
        self.assigned_tasks.append(task_id)
        
        logger.info(f"Manager {self.agent_id} assigned task: {task_definition.title}")
        return task_id
    
    async def _handle_task_accepted(self, message: ProtocolMessage):
        """Handle task acceptance from worker"""
        task_id = message.content['task_id']
        logger.info(f"Manager {self.agent_id}: Task {task_id} accepted by worker")
    
    async def _handle_task_progress(self, message: ProtocolMessage):
        """Handle task progress updates"""
        progress = message.content['progress']
        task_id = progress['task_id']
        percent = progress['progress_percent']
        step = progress['current_step']
        
        logger.info(f"Manager {self.agent_id}: Task {task_id} progress: {percent:.1f}% - {step}")
    
    async def _handle_task_completion(self, message: ProtocolMessage):
        """Handle task completion"""
        task_id = message.content['task_id']
        result = message.content['result']
        
        self.completed_tasks.append({
            'task_id': task_id,
            'result': result,
            'completed_at': time.time()
        })
        
        logger.info(f"Manager {self.agent_id}: Task {task_id} completed successfully")
        
        # Request quality validation
        if DemoConfig.ENABLE_QUALITY_GATES:
            await self._request_quality_validation(task_id, result)
    
    async def _handle_quality_result(self, message: ProtocolMessage):
        """Handle quality validation results"""
        result = message.content['validation_result']
        task_id = result['task_id']
        passed = result['passed']
        score = result['score']
        
        status = "PASSED" if passed else "FAILED"
        logger.info(f"Manager {self.agent_id}: Quality check for task {task_id}: {status} (score: {score:.2f})")
        
        if not passed and DemoConfig.ENABLE_HUMAN_INTERVENTION:
            # Request human intervention for quality issues
            await self._request_human_intervention(task_id, result)
    
    async def _request_quality_validation(self, task_id: str, result: Dict[str, Any]):
        """Request quality validation for completed task"""
        quality_message = ProtocolMessage(
            type=MessageType.QUALITY_CHECK,
            sender=self.protocol.agent_role,
            recipient=AgentRole.SYSTEM,
            content={
                'task_id': task_id,
                'gate_id': 'comprehensive_quality',
                'output': result
            },
            metadata=MessageMetadata(task_id=task_id)
        )
        
        await self.protocol.send_message(quality_message)
    
    async def _request_human_intervention(self, task_id: str, quality_result: Dict[str, Any]):
        """Request human intervention for quality issues"""
        intervention_message = ProtocolMessage(
            type=MessageType.HUMAN_INTERVENTION_REQUESTED,
            sender=self.protocol.agent_role,
            recipient=AgentRole.HUMAN,
            content={
                'intervention_id': f"quality_{task_id}_{int(time.time())}",
                'task_id': task_id,
                'reason': f"Quality validation failed (score: {quality_result['score']:.2f})",
                'context': {
                    'quality_result': quality_result,
                    'urgency': 'normal'
                }
            },
            metadata=MessageMetadata(task_id=task_id)
        )
        
        await self.protocol.send_message(intervention_message)

class DemoWorkerAgent:
    """Enhanced Worker agent for demonstration"""
    
    def __init__(self, agent_id: str, websocket_server: MockWebSocketServer):
        self.agent_id = agent_id
        self.protocol = ProtocolFactory.create_worker_protocol(agent_id)
        self.websocket_server = websocket_server
        self.active_tasks = {}
        
        # Register with WebSocket server
        websocket_server.register_client(agent_id, self.protocol)
        
        # Setup custom message handlers
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup custom message handlers for demo"""
        self.protocol.register_handler(MessageType.TASK_ASSIGNMENT, self._handle_task_assignment)
    
    async def start(self):
        """Start the worker agent"""
        await self.protocol.start()
        logger.info(f"Worker agent {self.agent_id} started")
    
    async def stop(self):
        """Stop the worker agent"""
        await self.protocol.stop()
        logger.info(f"Worker agent {self.agent_id} stopped")
    
    async def _handle_task_assignment(self, message: ProtocolMessage):
        """Handle incoming task assignment"""
        task_data = message.content['task']
        task = TaskDefinition(**task_data)
        
        # Accept the task
        accept_message = ProtocolMessage(
            type=MessageType.TASK_ACCEPTED,
            sender=self.protocol.agent_role,
            recipient=message.sender,
            content={
                'task_id': task.id,
                'estimated_duration': task.estimated_duration or 30
            },
            metadata=MessageMetadata(
                correlation_id=message.metadata.correlation_id,
                task_id=task.id
            )
        )
        
        await self.protocol.send_message(accept_message)
        
        # Start task execution
        self.active_tasks[task.id] = task
        asyncio.create_task(self._execute_task(task))
        
        logger.info(f"Worker {self.agent_id}: Accepted task {task.title}")
    
    async def _execute_task(self, task: TaskDefinition):
        """Simulate task execution with progress updates"""
        task_steps = [
            "Analyzing requirements",
            "Designing solution", 
            "Implementing code",
            "Running tests",
            "Finalizing documentation"
        ]
        
        for i, step in enumerate(task_steps):
            # Send progress update
            progress_percent = (i + 1) / len(task_steps) * 100
            
            progress_message = ProtocolMessage(
                type=MessageType.TASK_PROGRESS,
                sender=self.protocol.agent_role,
                recipient=AgentRole.MANAGER,
                content={
                    'task_id': task.id,
                    'progress': {
                        'task_id': task.id,
                        'status': TaskStatus.IN_PROGRESS.value,
                        'progress_percent': progress_percent,
                        'current_step': step,
                        'completed_steps': task_steps[:i+1],
                        'remaining_steps': task_steps[i+1:],
                        'outputs': [],
                        'metrics': {
                            'time_elapsed': (i + 1) * 2,  # 2 seconds per step
                            'estimated_completion': len(task_steps) * 2
                        }
                    }
                },
                metadata=MessageMetadata(task_id=task.id)
            )
            
            await self.protocol.send_message(progress_message)
            
            # Simulate work time
            await asyncio.sleep(2)
        
        # Send completion message
        completion_result = {
            'success': True,
            'output': f"Successfully completed: {task.title}",
            'files_created': ['main.py', 'tests.py', 'README.md'],
            'metrics': {
                'execution_time': len(task_steps) * 2,
                'lines_of_code': 150,
                'test_coverage': 85
            }
        }
        
        completion_message = ProtocolMessage(
            type=MessageType.TASK_COMPLETION,
            sender=self.protocol.agent_role,
            recipient=AgentRole.MANAGER,
            content={
                'task_id': task.id,
                'result': completion_result
            },
            metadata=MessageMetadata(task_id=task.id)
        )
        
        await self.protocol.send_message(completion_message)
        
        # Remove from active tasks
        if task.id in self.active_tasks:
            del self.active_tasks[task.id]
        
        logger.info(f"Worker {self.agent_id}: Completed task {task.title}")

class DemoHumanOperator:
    """Human operator simulation for demonstration"""
    
    def __init__(self, operator_id: str, websocket_server: MockWebSocketServer):
        self.operator_id = operator_id
        self.protocol = ProtocolFactory.create_human_protocol(operator_id)
        self.websocket_server = websocket_server
        self.pending_interventions = []
        
        # Register with WebSocket server
        websocket_server.register_client(operator_id, self.protocol)
        
        # Setup handlers
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup message handlers"""
        self.protocol.register_handler(MessageType.HUMAN_INTERVENTION_REQUESTED, self._handle_intervention_request)
        self.protocol.register_handler(MessageType.VALIDATION_REQUEST, self._handle_validation_request)
    
    async def start(self):
        """Start the human operator"""
        await self.protocol.start()
        logger.info(f"Human operator {self.operator_id} online")
    
    async def stop(self):
        """Stop the human operator"""
        await self.protocol.stop()
        logger.info(f"Human operator {self.operator_id} offline")
    
    async def _handle_intervention_request(self, message: ProtocolMessage):
        """Handle human intervention request"""
        intervention_id = message.content['intervention_id']
        reason = message.content['reason']
        
        self.pending_interventions.append({
            'id': intervention_id,
            'reason': reason,
            'message': message,
            'received_at': time.time()
        })
        
        logger.info(f"Human operator {self.operator_id}: Intervention requested - {reason}")
        
        # Simulate human decision-making delay
        await asyncio.sleep(3)
        
        # Provide intervention response (simulated)
        response_message = ProtocolMessage(
            type=MessageType.HUMAN_INTERVENTION_PROVIDED,
            sender=self.protocol.agent_role,
            recipient=message.sender,
            content={
                'intervention_id': intervention_id,
                'guidance': 'Please review the implementation and add more comprehensive error handling.',
                'action_taken': 'provide_guidance',
                'additional_context': {
                    'priority': 'high',
                    'follow_up_required': True
                }
            },
            metadata=MessageMetadata(
                correlation_id=message.metadata.correlation_id,
                task_id=message.content.get('task_id')
            )
        )
        
        await self.protocol.send_message(response_message)
        logger.info(f"Human operator {self.operator_id}: Provided intervention guidance")
    
    async def _handle_validation_request(self, message: ProtocolMessage):
        """Handle manual validation request"""
        gate_id = message.content['gate_id']
        task_id = message.content['task_id']
        
        logger.info(f"Human operator {self.operator_id}: Manual validation requested for task {task_id}")
        
        # Simulate human review time
        await asyncio.sleep(5)
        
        # Provide validation response (simulated approval)
        validation_response = ProtocolMessage(
            type=MessageType.VALIDATION_RESPONSE,
            sender=self.protocol.agent_role,
            recipient=message.sender,
            content={
                'task_id': task_id,
                'gate_id': gate_id,
                'approved': True,
                'score': 0.9,
                'feedback': [
                    'Code quality is good',
                    'Documentation is comprehensive',
                    'Test coverage meets requirements'
                ],
                'reviewer': self.operator_id
            },
            metadata=MessageMetadata(task_id=task_id)
        )
        
        await self.protocol.send_message(validation_response)
        logger.info(f"Human operator {self.operator_id}: Validated task {task_id}")

# ============================================================================
# Demo Quality Gate System
# ============================================================================

class DemoQualitySystem:
    """Quality gate system for demonstration"""
    
    def __init__(self, websocket_server: MockWebSocketServer):
        self.websocket_server = websocket_server
        self.quality_manager = QualityGateManager()
        self.intervention_controller = HumanInterventionController()
        
        # Create a mock protocol engine for quality system
        self.protocol = ProtocolEngine(AgentRole.SYSTEM, "quality-system")
        websocket_server.register_client("quality-system", self.protocol)
        
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup quality system handlers"""
        self.protocol.register_handler(MessageType.QUALITY_CHECK, self._handle_quality_check)
    
    async def start(self):
        """Start the quality system"""
        await self.protocol.start()
        logger.info("Demo quality system started")
    
    async def stop(self):
        """Stop the quality system"""
        await self.protocol.stop()
        logger.info("Demo quality system stopped")
    
    async def _handle_quality_check(self, message: ProtocolMessage):
        """Handle quality check requests"""
        task_id = message.content['task_id']
        gate_id = message.content.get('gate_id', 'basic_quality')
        output = message.content.get('output', {})
        
        logger.info(f"Quality system: Processing quality check for task {task_id}")
        
        # Create validation context
        context = ValidationContext(
            task_id=task_id,
            session_id="demo-session",
            task_output=output,
            task_requirements=['functionality', 'quality', 'documentation']
        )
        
        # Run validation
        result = await self.quality_manager.validate_task_output(context, gate_id)
        
        # Send result back
        result_message = ProtocolMessage(
            type=MessageType.QUALITY_RESULT,
            sender=self.protocol.agent_role,
            recipient=message.sender,
            content={
                'validation_result': {
                    'gate_id': result.gate_id,
                    'task_id': result.task_id,
                    'passed': result.passed,
                    'score': result.score,
                    'feedback': result.feedback,
                    'timestamp': result.timestamp
                }
            },
            metadata=MessageMetadata(
                correlation_id=message.metadata.correlation_id,
                task_id=task_id
            )
        )
        
        await self.protocol.send_message(result_message)

# ============================================================================
# Integration Demo Runner
# ============================================================================

class IntegrationDemo:
    """Main integration demonstration orchestrator"""
    
    def __init__(self):
        self.websocket_server = MockWebSocketServer()
        self.state_manager = StateManager(":memory:")
        self.message_router = MessageRouter()
        self.serializer = MessageSerializer()
        
        # Demo agents
        self.manager_agent = None
        self.worker_agent = None
        self.human_operator = None
        self.quality_system = None
        
        # Demo session
        self.demo_session = None
        
        # Statistics
        self.stats = {
            'messages_sent': 0,
            'tasks_completed': 0,
            'quality_checks': 0,
            'interventions': 0,
            'start_time': 0,
            'end_time': 0
        }
    
    async def setup(self):
        """Setup the demo environment"""
        logger.info("Setting up integration demo...")
        
        # Start infrastructure
        await self.websocket_server.start()
        await self.state_manager.start()
        await self.message_router.start()
        
        # Create demo agents
        self.manager_agent = DemoManagerAgent("demo-manager-001", self.websocket_server)
        self.worker_agent = DemoWorkerAgent("demo-worker-001", self.websocket_server)
        self.human_operator = DemoHumanOperator("demo-operator-001", self.websocket_server)
        self.quality_system = DemoQualitySystem(self.websocket_server)
        
        # Start agents
        await self.manager_agent.start()
        await self.worker_agent.start()
        await self.human_operator.start()
        await self.quality_system.start()
        
        # Create demo session
        self.demo_session = await self.state_manager.create_session(
            "integration-demo-session",
            "Agent Communication Protocol Integration Demo",
            "/demo/workspace"
        )
        
        logger.info("Integration demo setup complete")
    
    async def run_demo(self):
        """Run the integration demonstration"""
        logger.info("Starting integration demo...")
        self.stats['start_time'] = time.time()
        
        try:
            # Create and assign demo tasks
            demo_tasks = self._create_demo_tasks()
            
            for task in demo_tasks:
                logger.info(f"\n{'='*60}")
                logger.info(f"DEMO: Starting task - {task.title}")
                logger.info(f"{'='*60}")
                
                # Assign task to worker
                task_id = await self.manager_agent.create_and_assign_task(task)
                
                # Wait for task completion (with timeout)
                await self._wait_for_task_completion(task_id, timeout=30)
                
                # Small delay between tasks
                await asyncio.sleep(5)
            
            # Wait for any remaining processing
            logger.info("Waiting for final processing...")
            await asyncio.sleep(10)
            
        except Exception as e:
            logger.error(f"Error during demo execution: {e}")
        
        finally:
            self.stats['end_time'] = time.time()
            await self._print_demo_summary()
    
    async def cleanup(self):
        """Cleanup demo resources"""
        logger.info("Cleaning up demo resources...")
        
        # Stop agents
        if self.manager_agent:
            await self.manager_agent.stop()
        if self.worker_agent:
            await self.worker_agent.stop()
        if self.human_operator:
            await self.human_operator.stop()
        if self.quality_system:
            await self.quality_system.stop()
        
        # Stop infrastructure
        await self.message_router.stop()
        await self.state_manager.stop()
        await self.websocket_server.stop()
        
        logger.info("Demo cleanup complete")
    
    def _create_demo_tasks(self) -> List[TaskDefinition]:
        """Create demonstration tasks"""
        tasks = [
            TaskDefinition(
                title="Implement User Authentication",
                description="Create a secure user authentication system with login/logout functionality",
                requirements=[
                    "Password hashing",
                    "Session management", 
                    "Input validation",
                    "Error handling"
                ],
                estimated_duration=45,
                priority=MessagePriority.HIGH,
                metadata={
                    "complexity": "moderate",
                    "technologies": ["python", "security"]
                }
            ),
            TaskDefinition(
                title="Build REST API Endpoints",
                description="Develop RESTful API endpoints for user management operations",
                requirements=[
                    "CRUD operations",
                    "Request validation",
                    "Response formatting",
                    "Documentation"
                ],
                estimated_duration=30,
                priority=MessagePriority.NORMAL,
                metadata={
                    "complexity": "simple",
                    "technologies": ["python", "rest", "api"]
                }
            ),
            TaskDefinition(
                title="Implement Data Validation Layer",
                description="Create comprehensive data validation with custom validators",
                requirements=[
                    "Input sanitization",
                    "Custom validators",
                    "Error messages",
                    "Unit tests"
                ],
                estimated_duration=60,
                priority=MessagePriority.HIGH,
                metadata={
                    "complexity": "complex",
                    "technologies": ["python", "validation", "testing"]
                }
            )
        ]
        
        return tasks
    
    async def _wait_for_task_completion(self, task_id: str, timeout: int = 60):
        """Wait for task completion with timeout"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            # Check if task is completed (simplified check)
            completed_tasks = [t['task_id'] for t in self.manager_agent.completed_tasks]
            if task_id in completed_tasks:
                self.stats['tasks_completed'] += 1
                return
            
            await asyncio.sleep(1)
        
        logger.warning(f"Task {task_id} did not complete within timeout")
    
    async def _print_demo_summary(self):
        """Print demonstration summary"""
        duration = self.stats['end_time'] - self.stats['start_time']
        
        logger.info(f"\n{'='*60}")
        logger.info(f"INTEGRATION DEMO SUMMARY")
        logger.info(f"{'='*60}")
        logger.info(f"Duration: {duration:.1f} seconds")
        logger.info(f"Tasks completed: {len(self.manager_agent.completed_tasks)}")
        logger.info(f"Messages in history: {len(self.websocket_server.message_history)}")
        logger.info(f"Human interventions: {len(self.human_operator.pending_interventions)}")
        
        # Quality metrics
        quality_metrics = self.quality_system.quality_manager.get_quality_metrics()
        logger.info(f"Quality validations: {quality_metrics['total_validations']}")
        logger.info(f"Quality success rate: {quality_metrics.get('success_rate', 0):.1%}")
        
        # State manager stats
        state_stats = self.state_manager.get_state_statistics()
        logger.info(f"Sessions created: {state_stats['sessions']['total']}")
        logger.info(f"Tasks tracked: {state_stats['tasks']['total']}")
        
        # Message router stats
        router_metrics = self.message_router.get_routing_metrics()
        logger.info(f"Messages routed: {router_metrics['messages_routed']}")
        logger.info(f"Routing success rate: {router_metrics['messages_delivered']}/{router_metrics['messages_routed']}")
        
        logger.info(f"{'='*60}")
        
        # Display sample messages
        logger.info("\nSample message flow:")
        for i, msg_entry in enumerate(self.websocket_server.message_history[:10]):
            msg = msg_entry['message']
            timestamp = datetime.fromtimestamp(msg_entry['timestamp']).strftime('%H:%M:%S')
            logger.info(f"[{timestamp}] {msg['sender']} → {msg['recipient']}: {msg['type']}")
        
        if len(self.websocket_server.message_history) > 10:
            logger.info(f"... and {len(self.websocket_server.message_history) - 10} more messages")

# ============================================================================
# Main Demo Execution
# ============================================================================

async def main():
    """Main demo execution function"""
    print("\n" + "="*80)
    print("AGENT COMMUNICATION PROTOCOL - INTEGRATION DEMO")
    print("="*80)
    print("\nThis demonstration showcases:")
    print("• Manager-Worker agent coordination")
    print("• Real-time task assignment and progress tracking") 
    print("• Quality gate validation")
    print("• Human intervention workflows")
    print("• State management and message routing")
    print("• Protocol serialization and communication")
    print("\n" + "="*80 + "\n")
    
    demo = IntegrationDemo()
    
    try:
        await demo.setup()
        await demo.run_demo()
        
    except KeyboardInterrupt:
        logger.info("\nDemo interrupted by user")
        
    except Exception as e:
        logger.error(f"Demo failed with error: {e}")
        
    finally:
        await demo.cleanup()
        
    print("\n" + "="*80)
    print("INTEGRATION DEMO COMPLETED")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(main())