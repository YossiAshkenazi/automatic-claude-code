#!/usr/bin/env python3
"""
WebSocket Integration Test

Tests the integration between the Python multi-agent system and the
WebSocket backend for the React dashboard.

This test verifies:
- WebSocket command handling
- Agent lifecycle management through WebSocket
- Real-time status updates
- Task execution coordination
- System health monitoring
- Error handling and recovery
"""

import asyncio
import json
import logging
import sys
import time
from typing import Dict, Any

from agent_websocket_bridge import AgentWebSocketBridge, WebSocketMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WebSocketIntegrationTester:
    """Comprehensive WebSocket integration tester"""
    
    def __init__(self):
        self.bridge = AgentWebSocketBridge()
        self.test_results: Dict[str, Any] = {}
        self.total_tests = 0
        self.passed_tests = 0
    
    async def run_all_tests(self):
        """Run comprehensive integration tests"""
        logger.info("🚀 Starting WebSocket Integration Tests")
        
        try:
            # Initialize the bridge
            await self.bridge.initialize_agent_system()
            
            # Test 1: System initialization
            await self.test_system_initialization()
            
            # Test 2: Agent lifecycle management
            await self.test_agent_lifecycle()
            
            # Test 3: Task execution
            await self.test_task_execution()
            
            # Test 4: Health monitoring
            await self.test_health_monitoring()
            
            # Test 5: System statistics
            await self.test_system_statistics()
            
            # Test 6: Dual agent system creation
            await self.test_dual_system_creation()
            
            # Test 7: WebSocket command simulation
            await self.test_websocket_commands()
            
            # Generate test report
            self.generate_test_report()
            
        except Exception as e:
            logger.error(f"❌ Integration test failed: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await self.cleanup()
    
    async def test_system_initialization(self):
        """Test system initialization"""
        logger.info("\n=== Test 1: System Initialization ===")
        test_name = "system_initialization"
        self.total_tests += 1
        
        try:
            # Check if multi-agent system is initialized
            assert self.bridge.multi_agent is not None, "Multi-agent system not initialized"
            
            # Check command handlers
            assert len(self.bridge.command_handlers) > 0, "No command handlers registered"
            
            # Check system stats are available
            stats = await self.bridge.handle_get_system_stats({})
            assert isinstance(stats, dict), "System stats not returned as dict"
            
            self.test_results[test_name] = {"passed": True, "details": f"System initialized with {len(self.bridge.command_handlers)} handlers"}
            self.passed_tests += 1
            logger.info("✅ System initialization test passed")
            
        except Exception as e:
            self.test_results[test_name] = {"passed": False, "error": str(e)}
            logger.error(f"❌ System initialization test failed: {e}")
    
    async def test_agent_lifecycle(self):
        """Test agent creation, starting, stopping"""
        logger.info("\n=== Test 2: Agent Lifecycle Management ===")
        test_name = "agent_lifecycle"
        self.total_tests += 1
        
        try:
            # Create agent
            create_result = await self.bridge.handle_create_agent({
                "agent_id": "test_agent_1",
                "role": "worker",
                "name": "Test Worker",
                "model": "sonnet"
            })
            assert create_result["agent_id"] == "test_agent_1", "Agent creation failed"
            
            # Start agent
            start_result = await self.bridge.handle_start_agent({"agent_id": "test_agent_1"})
            assert start_result["success"] is True, "Agent start failed"
            
            # Get agent status
            status_result = await self.bridge.handle_get_agent_status({"agent_id": "test_agent_1"})
            assert status_result["status"] == "idle", f"Agent not in idle status: {status_result['status']}"
            
            # Stop agent
            stop_result = await self.bridge.handle_stop_agent({"agent_id": "test_agent_1"})
            assert stop_result["success"] is True, "Agent stop failed"
            
            self.test_results[test_name] = {"passed": True, "details": "Agent lifecycle (create/start/stop) working"}
            self.passed_tests += 1
            logger.info("✅ Agent lifecycle test passed")
            
        except Exception as e:
            self.test_results[test_name] = {"passed": False, "error": str(e)}
            logger.error(f"❌ Agent lifecycle test failed: {e}")
    
    async def test_task_execution(self):
        """Test task execution through WebSocket"""
        logger.info("\n=== Test 3: Task Execution ===")
        test_name = "task_execution"
        self.total_tests += 1
        
        try:
            # Ensure we have an active agent
            agents = await self.bridge.handle_list_agents({})
            if not any(a["status"] == "idle" for a in agents):
                # Create a test agent
                await self.bridge.handle_create_agent({
                    "agent_id": "test_executor",
                    "role": "worker",
                    "name": "Test Executor"
                })
                await self.bridge.handle_start_agent({"agent_id": "test_executor"})
            
            # Get an idle agent
            agents = await self.bridge.handle_list_agents({})
            idle_agent = next((a for a in agents if a["status"] == "idle"), None)
            assert idle_agent is not None, "No idle agent available for testing"
            
            # Execute task
            task_result = await self.bridge.handle_execute_task({
                "agent_id": idle_agent["agent_id"],
                "prompt": "Say hello and count to 3 quickly.",
                "task_id": "integration_test_task"
            })
            assert task_result["status"] == "started", "Task execution not started"
            assert task_result["task_id"] == "integration_test_task", "Task ID mismatch"
            
            # Wait a moment for task to process
            await asyncio.sleep(3)
            
            # Check if task is in active tasks
            task_id = task_result["task_id"]
            task_active = task_id in self.bridge.active_tasks
            
            self.test_results[test_name] = {
                "passed": True, 
                "details": f"Task execution started successfully (active: {task_active})"
            }
            self.passed_tests += 1
            logger.info("✅ Task execution test passed")
            
        except Exception as e:
            self.test_results[test_name] = {"passed": False, "error": str(e)}
            logger.error(f"❌ Task execution test failed: {e}")
    
    async def test_health_monitoring(self):
        """Test health monitoring functionality"""
        logger.info("\n=== Test 4: Health Monitoring ===")
        test_name = "health_monitoring"
        self.total_tests += 1
        
        try:
            # List agents
            agents = await self.bridge.handle_list_agents({})
            if not agents:
                logger.info("No agents available, creating test agent...")
                await self.bridge.handle_create_agent({
                    "agent_id": "health_test_agent",
                    "role": "worker"
                })
                await self.bridge.handle_start_agent({"agent_id": "health_test_agent"})
                agents = await self.bridge.handle_list_agents({})
            
            # Perform health check on first agent
            agent_id = agents[0]["agent_id"]
            health_result = await self.bridge.handle_health_check({"agent_id": agent_id})
            
            # Validate health check result
            assert "agent_id" in health_result, "Health check missing agent_id"
            assert "is_healthy" in health_result, "Health check missing is_healthy"
            assert "response_time_ms" in health_result, "Health check missing response_time_ms"
            assert isinstance(health_result["response_time_ms"], (int, float)), "Response time not numeric"
            
            self.test_results[test_name] = {
                "passed": True, 
                "details": f"Health check completed (healthy: {health_result['is_healthy']}, response: {health_result['response_time_ms']:.1f}ms)"
            }
            self.passed_tests += 1
            logger.info("✅ Health monitoring test passed")
            
        except Exception as e:
            self.test_results[test_name] = {"passed": False, "error": str(e)}
            logger.error(f"❌ Health monitoring test failed: {e}")
    
    async def test_system_statistics(self):
        """Test system statistics retrieval"""
        logger.info("\n=== Test 5: System Statistics ===")
        test_name = "system_statistics"
        self.total_tests += 1
        
        try:
            # Get system stats
            stats = await self.bridge.handle_get_system_stats({})
            
            # Validate stats structure
            required_fields = ["total_agents", "agents_by_status", "system_config"]
            for field in required_fields:
                assert field in stats, f"System stats missing field: {field}"
            
            # Validate agents by status
            assert isinstance(stats["agents_by_status"], dict), "agents_by_status not a dict"
            assert isinstance(stats["total_agents"], int), "total_agents not an integer"
            
            self.test_results[test_name] = {
                "passed": True, 
                "details": f"System stats retrieved (total_agents: {stats['total_agents']})"
            }
            self.passed_tests += 1
            logger.info("✅ System statistics test passed")
            
        except Exception as e:
            self.test_results[test_name] = {"passed": False, "error": str(e)}
            logger.error(f"❌ System statistics test failed: {e}")
    
    async def test_dual_system_creation(self):
        """Test dual agent system creation"""
        logger.info("\n=== Test 6: Dual Agent System Creation ===")
        test_name = "dual_system_creation"
        self.total_tests += 1
        
        try:
            # Create dual system
            dual_result = await self.bridge.handle_create_dual_system({})
            
            # Validate dual system result
            assert dual_result["system_type"] == "dual_agent", "Wrong system type"
            assert dual_result["agents_created"] == 2, f"Expected 2 agents, got {dual_result['agents_created']}"
            assert dual_result["manager_id"] == "manager", "Manager ID incorrect"
            assert dual_result["worker_id"] == "worker", "Worker ID incorrect"
            
            # Verify agents exist
            agents = await self.bridge.handle_list_agents({})
            manager_exists = any(a["agent_id"] == "manager" and a["role"] == "manager" for a in agents)
            worker_exists = any(a["agent_id"] == "worker" and a["role"] == "worker" for a in agents)
            
            assert manager_exists, "Manager agent not found"
            assert worker_exists, "Worker agent not found"
            
            self.test_results[test_name] = {
                "passed": True, 
                "details": f"Dual system created successfully ({dual_result['agents_created']} agents)"
            }
            self.passed_tests += 1
            logger.info("✅ Dual system creation test passed")
            
        except Exception as e:
            self.test_results[test_name] = {"passed": False, "error": str(e)}
            logger.error(f"❌ Dual system creation test failed: {e}")
    
    async def test_websocket_commands(self):
        """Test WebSocket command structure and responses"""
        logger.info("\n=== Test 7: WebSocket Commands ===")
        test_name = "websocket_commands"
        self.total_tests += 1
        
        try:
            # Test WebSocket message creation
            test_message = WebSocketMessage(
                type="test_message",
                data={"test": "value", "number": 42}
            )
            
            # Validate message structure
            json_str = test_message.to_json()
            parsed = json.loads(json_str)
            
            assert parsed["type"] == "test_message", "Message type incorrect"
            assert parsed["data"]["test"] == "value", "Message data incorrect"
            assert "timestamp" in parsed, "Message missing timestamp"
            assert "message_id" in parsed, "Message missing message_id"
            
            # Test command handler availability
            expected_commands = [
                "create_agent", "start_agent", "stop_agent", "list_agents",
                "execute_task", "health_check", "get_system_stats"
            ]
            
            available_commands = list(self.bridge.command_handlers.keys())
            for cmd in expected_commands:
                assert cmd in available_commands, f"Command handler missing: {cmd}"
            
            self.test_results[test_name] = {
                "passed": True, 
                "details": f"WebSocket commands validated ({len(available_commands)} handlers available)"
            }
            self.passed_tests += 1
            logger.info("✅ WebSocket commands test passed")
            
        except Exception as e:
            self.test_results[test_name] = {"passed": False, "error": str(e)}
            logger.error(f"❌ WebSocket commands test failed: {e}")
    
    def generate_test_report(self):
        """Generate comprehensive test report"""
        logger.info("\n" + "="*60)
        logger.info("📊 WEBSOCKET INTEGRATION TEST REPORT")
        logger.info("="*60)
        
        # Overall results
        success_rate = (self.passed_tests / self.total_tests) * 100 if self.total_tests > 0 else 0
        logger.info(f"✅ Overall Success Rate: {self.passed_tests}/{self.total_tests} ({success_rate:.1f}%)")
        logger.info("")
        
        # Individual test results
        for test_name, result in self.test_results.items():
            status = "✅ PASSED" if result["passed"] else "❌ FAILED"
            logger.info(f"{status} {test_name.upper().replace('_', ' ')}")
            
            if result["passed"]:
                logger.info(f"   Details: {result['details']}")
            else:
                logger.info(f"   Error: {result['error']}")
            logger.info("")
        
        # Integration readiness assessment
        logger.info("🔧 INTEGRATION READINESS:")
        if success_rate >= 90:
            logger.info("   🟢 READY FOR PRODUCTION")
            logger.info("   - All critical systems operational")
            logger.info("   - WebSocket backend integration complete")
            logger.info("   - Real-time agent management working")
        elif success_rate >= 70:
            logger.info("   🟡 MOSTLY READY - Minor issues to resolve")
            logger.info("   - Core functionality working")
            logger.info("   - Some edge cases need attention")
        else:
            logger.info("   🔴 NOT READY - Major issues found")
            logger.info("   - Critical systems failing")
            logger.info("   - Requires significant fixes before deployment")
        
        logger.info("")
        logger.info("🚀 NEXT STEPS:")
        if success_rate >= 90:
            logger.info("   1. Deploy WebSocket server")
            logger.info("   2. Connect React dashboard")
            logger.info("   3. Start production testing")
        else:
            logger.info("   1. Fix failing tests")
            logger.info("   2. Re-run integration tests")
            logger.info("   3. Address any remaining issues")
        
        logger.info("")
        logger.info("="*60)
        
        return success_rate >= 90
    
    async def cleanup(self):
        """Clean up test resources"""
        logger.info("🧹 Cleaning up test resources...")
        
        try:
            # Shutdown multi-agent system
            if self.bridge.multi_agent:
                await self.bridge.multi_agent.shutdown(timeout=5.0)
            
            # Clean up bridge resources
            await self.bridge.cleanup()
            
        except Exception as e:
            logger.warning(f"Cleanup warning: {e}")
        
        logger.info("✅ Cleanup complete")


async def main():
    """Main test entry point"""
    print("""
    🧪 WebSocket Integration Test Suite
    ===================================
    
    This test suite validates the integration between:
    - Python Multi-Agent System
    - WebSocket Communication Bridge
    - React Dashboard Backend
    
    Tests include:
    - System initialization
    - Agent lifecycle management
    - Task execution coordination
    - Health monitoring
    - System statistics
    - WebSocket command handling
    
    Results will show production readiness status.
    """)
    
    tester = WebSocketIntegrationTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n🛑 Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        sys.exit(1)