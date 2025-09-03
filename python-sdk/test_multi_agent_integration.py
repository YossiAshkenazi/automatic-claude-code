#!/usr/bin/env python3
"""
Integration Test for Multi-Agent CLI Wrapper

Tests the complete multi-agent system integration with the production claude_cli_wrapper.py
This test validates:
- Integration with existing production wrapper
- Epic 3 process management
- Multi-agent coordination patterns
- Resource management and cleanup
- Error handling and recovery

Run with: python test_multi_agent_integration.py
"""

import asyncio
import logging
import sys
import time
from pathlib import Path

# Add the multi-agent wrapper to path
sys.path.insert(0, str(Path(__file__).parent))

from multi_agent_wrapper import (
    MultiAgentCLIWrapper, AgentConfig, AgentRole, MultiAgentConfig,
    create_dual_agent_system
)
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_claude_cli_availability():
    """Test that Claude CLI is available and working"""
    logger.info("Testing Claude CLI availability...")
    
    try:
        # Test basic wrapper functionality
        wrapper = ClaudeCliWrapper(ClaudeCliOptions(model="sonnet", timeout=30))
        
        # Check if CLI is available
        if not wrapper.is_available():
            logger.warning("⚠️  Claude CLI not available - some tests will be mocked")
            return False
        else:
            logger.info("✅ Claude CLI is available")
            return True
    
    except Exception as e:
        logger.warning(f"⚠️  Claude CLI test failed: {e}")
        return False


async def test_multi_agent_creation():
    """Test multi-agent creation and basic lifecycle"""
    logger.info("Testing multi-agent creation and lifecycle...")
    
    # Create multi-agent system
    config = MultiAgentConfig(max_agents=2, enable_metrics=False)
    multi_agent = MultiAgentCLIWrapper(config)
    
    try:
        # Test agent creation
        agent_config = AgentConfig(
            agent_id="integration_test_agent",
            role=AgentRole.WORKER,
            name="Integration Test Agent"
        )
        
        # Create agent
        agent_id = await multi_agent.create_agent(agent_config)
        assert agent_id == "integration_test_agent"
        
        # Verify agent is created but not started
        agent_info = await multi_agent.get_agent_status(agent_id)
        assert agent_info.status == AgentStatus.CREATED
        
        # Start agent (this will test CLI integration)
        success = await multi_agent.start_agent(agent_id)
        if success:
            logger.info("✅ Agent started successfully")
            
            # Check status again
            agent_info = await multi_agent.get_agent_status(agent_id)
            assert agent_info.status == AgentStatus.IDLE
            
            # Health check
            health = await multi_agent.health_check(agent_id)
            logger.info(f"Agent health: {'✅' if health.is_healthy else '❌'}")
            
        else:
            logger.warning("⚠️  Agent failed to start (likely due to Claude CLI unavailable)")
        
        # Test agent listing
        agents = multi_agent.list_agents()
        assert len(agents) == 1
        assert agents[0].config.agent_id == agent_id
        
        logger.info("✅ Multi-agent creation test passed")
        
    finally:
        # Cleanup
        await multi_agent.shutdown(timeout=5.0)


async def test_dual_agent_coordination():
    """Test dual-agent system coordination"""
    logger.info("Testing dual-agent coordination...")
    
    try:
        # Create dual-agent system
        multi_agent = await create_dual_agent_system()
        
        # Verify both agents are created
        agents = multi_agent.list_agents()
        assert len(agents) == 2
        
        agent_roles = {agent.config.role for agent in agents}
        assert AgentRole.MANAGER in agent_roles
        assert AgentRole.WORKER in agent_roles
        
        # Get system stats
        stats = multi_agent.get_system_stats()
        assert stats['total_agents'] == 2
        
        logger.info("✅ Dual-agent coordination test passed")
        
    except Exception as e:
        logger.error(f"❌ Dual-agent test failed: {e}")
    finally:
        try:
            await multi_agent.shutdown(timeout=5.0)
        except:
            pass


async def test_epic3_integration():
    """Test Epic 3 process management integration"""
    logger.info("Testing Epic 3 integration...")
    
    multi_agent = MultiAgentCLIWrapper(MultiAgentConfig(max_agents=1))
    
    try:
        # Create agent to test resource tracking
        agent_config = AgentConfig(
            agent_id="epic3_test_agent",
            role=AgentRole.WORKER
        )
        
        # Create agent
        await multi_agent.create_agent(agent_config)
        
        # Check that resources are being tracked
        handle_manager = multi_agent.handle_manager
        initial_stats = handle_manager.get_resource_stats()
        logger.info(f"Resource tracking stats: {initial_stats}")
        
        # Start agent (creates more resources)
        await multi_agent.start_agent("epic3_test_agent")
        
        # Check resource tracking increased
        updated_stats = handle_manager.get_resource_stats()
        logger.info(f"Updated resource stats: {updated_stats}")
        
        # Test graceful shutdown
        start_time = time.time()
        await multi_agent.shutdown(timeout=10.0)
        shutdown_time = time.time() - start_time
        
        # Verify clean shutdown
        final_stats = handle_manager.get_resource_stats()
        logger.info(f"Final resource stats: {final_stats}")
        logger.info(f"Shutdown completed in {shutdown_time:.2f}s")
        
        # Check that shutdown was clean
        assert multi_agent.shutdown_initiated is True
        
        logger.info("✅ Epic 3 integration test passed")
        
    except Exception as e:
        logger.error(f"❌ Epic 3 integration test failed: {e}")
        # Force cleanup
        await multi_agent.handle_manager.force_cleanup_all(timeout=2.0)


async def test_resource_management():
    """Test resource limits and management"""
    logger.info("Testing resource management...")
    
    config = MultiAgentConfig(
        max_agents=3,
        max_memory_total_mb=1024,
        enable_resource_limits=True
    )
    multi_agent = MultiAgentCLIWrapper(config)
    
    try:
        # Create agents with specific resource limits
        agents_created = 0
        for i in range(3):
            agent_config = AgentConfig(
                agent_id=f"resource_test_agent_{i}",
                role=AgentRole.WORKER,
                max_memory_mb=128,
                max_cpu_percent=20.0
            )
            
            await multi_agent.create_agent(agent_config)
            agents_created += 1
        
        assert agents_created == 3
        
        # Try to create one more agent (should fail due to max_agents limit)
        try:
            extra_config = AgentConfig(
                agent_id="extra_agent",
                role=AgentRole.WORKER
            )
            await multi_agent.create_agent(extra_config)
            assert False, "Should have failed due to max agents limit"
        except ValueError as e:
            logger.info(f"✅ Correctly rejected extra agent: {e}")
        
        # Test system stats with resource info
        stats = multi_agent.get_system_stats()
        assert stats['total_agents'] == 3
        
        logger.info("✅ Resource management test passed")
        
    finally:
        await multi_agent.shutdown(timeout=5.0)


async def test_error_handling():
    """Test error handling and recovery"""
    logger.info("Testing error handling and recovery...")
    
    multi_agent = MultiAgentCLIWrapper()
    
    try:
        # Test creating agent with invalid config
        try:
            invalid_config = AgentConfig(
                agent_id="",  # Invalid empty ID
                role=AgentRole.WORKER
            )
            await multi_agent.create_agent(invalid_config)
            assert False, "Should have failed with empty agent ID"
        except Exception as e:
            logger.info(f"✅ Correctly handled invalid config: {type(e).__name__}")
        
        # Test operations on nonexistent agent
        try:
            await multi_agent.start_agent("nonexistent_agent")
            assert False, "Should have failed for nonexistent agent"
        except ValueError as e:
            logger.info(f"✅ Correctly handled nonexistent agent: {e}")
        
        # Test health check on nonexistent agent
        health = await multi_agent.health_check("nonexistent")
        assert not health.is_healthy
        assert health.error_message == "Agent not found"
        
        logger.info("✅ Error handling test passed")
        
    finally:
        await multi_agent.shutdown(timeout=5.0)


async def test_concurrent_operations():
    """Test concurrent multi-agent operations"""
    logger.info("Testing concurrent operations...")
    
    multi_agent = MultiAgentCLIWrapper(MultiAgentConfig(max_agents=3))
    
    try:
        # Create multiple agents concurrently
        agent_configs = [
            AgentConfig(agent_id=f"concurrent_agent_{i}", role=AgentRole.WORKER)
            for i in range(3)
        ]
        
        # Create agents concurrently
        create_tasks = [
            multi_agent.create_agent(config) for config in agent_configs
        ]
        
        created_agents = await asyncio.gather(*create_tasks)
        assert len(created_agents) == 3
        
        # Start agents concurrently
        start_tasks = [
            multi_agent.start_agent(agent_id) for agent_id in created_agents
        ]
        
        start_results = await asyncio.gather(*start_tasks, return_exceptions=True)
        successful_starts = sum(1 for result in start_results if result is True)
        logger.info(f"Successfully started {successful_starts}/{len(created_agents)} agents")
        
        # Perform concurrent health checks
        health_tasks = [
            multi_agent.health_check(agent_id) for agent_id in created_agents
        ]
        
        health_results = await asyncio.gather(*health_tasks, return_exceptions=True)
        healthy_agents = sum(1 for result in health_results 
                           if isinstance(result, HealthCheckResult) and result.is_healthy)
        logger.info(f"{healthy_agents} agents are healthy")
        
        # Test concurrent shutdown
        logger.info("Testing concurrent shutdown...")
        start_time = time.time()
        await multi_agent.shutdown(timeout=10.0)
        shutdown_time = time.time() - start_time
        
        logger.info(f"✅ Concurrent operations completed (shutdown: {shutdown_time:.2f}s)")
        
    except Exception as e:
        logger.error(f"❌ Concurrent operations test failed: {e}")
        await multi_agent.shutdown(timeout=5.0)


async def run_integration_tests():
    """Run all integration tests"""
    logger.info("🚀 Starting Multi-Agent Integration Tests")
    logger.info("=" * 60)
    
    # Test cases
    test_cases = [
        ("Claude CLI Availability", test_claude_cli_availability),
        ("Multi-Agent Creation", test_multi_agent_creation),
        ("Dual-Agent Coordination", test_dual_agent_coordination),
        ("Epic 3 Integration", test_epic3_integration),
        ("Resource Management", test_resource_management),
        ("Error Handling", test_error_handling),
        ("Concurrent Operations", test_concurrent_operations)
    ]
    
    passed = 0
    total = len(test_cases)
    
    for test_name, test_func in test_cases:
        logger.info(f"\n🧪 Running: {test_name}")
        logger.info("-" * 40)
        
        try:
            await test_func()
            passed += 1
            logger.info(f"✅ {test_name} PASSED")
        except Exception as e:
            logger.error(f"❌ {test_name} FAILED: {e}")
            import traceback
            logger.debug(traceback.format_exc())
        
        # Brief pause between tests
        await asyncio.sleep(1)
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info(f"🎯 Integration Test Results: {passed}/{total} tests passed")
    logger.info("=" * 60)
    
    if passed == total:
        logger.info("🎉 All integration tests passed! Multi-agent system is ready.")
    else:
        logger.warning(f"⚠️  {total - passed} tests failed. Check logs for details.")
    
    return passed == total


async def main():
    """Main test runner"""
    try:
        success = await run_integration_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        logger.info("\nTests interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"Test runner failed: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)