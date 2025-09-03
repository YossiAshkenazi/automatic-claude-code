#!/usr/bin/env python3
"""
Multi-Agent Demo - Comprehensive demonstration of the multi-agent system

Showcases key features:
- Creating and managing multiple agents
- Task execution and coordination
- Health monitoring and recovery
- Agent communication patterns
- Resource pooling and load balancing
- Epic 3 integration and cleanup
"""

import asyncio
import logging
import time
import json
from pathlib import Path

from multi_agent_wrapper import (
    MultiAgentCLIWrapper, AgentConfig, AgentRole, MultiAgentConfig,
    create_dual_agent_system, create_specialist_team
)
from multi_agent_wrapper.agent_pool import AgentPool, PoolConfig
from multi_agent_wrapper.communication_bridge import CommunicationBridge, MessageType
from multi_agent_wrapper.health_monitor import HealthMonitor

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def demo_basic_multi_agent():
    """Demonstrate basic multi-agent functionality"""
    logger.info("=" * 60)
    logger.info("DEMO 1: Basic Multi-Agent System")
    logger.info("=" * 60)
    
    # Create multi-agent configuration
    config = MultiAgentConfig(
        max_agents=3,
        health_check_interval=5.0,
        enable_metrics=True,
        auto_scale=False
    )
    
    # Initialize multi-agent wrapper
    multi_agent = MultiAgentCLIWrapper(config)
    
    try:
        # Create agents with different roles
        manager_config = AgentConfig(
            agent_id="demo_manager",
            role=AgentRole.MANAGER,
            name="Demo Manager Agent",
            max_memory_mb=512,
            auto_restart=True
        )
        
        worker_config = AgentConfig(
            agent_id="demo_worker", 
            role=AgentRole.WORKER,
            name="Demo Worker Agent",
            max_memory_mb=256,
            auto_restart=True
        )
        
        # Create and start agents
        logger.info("Creating agents...")
        manager_id = await multi_agent.create_agent(manager_config)
        worker_id = await multi_agent.create_agent(worker_config)
        
        logger.info("Starting agents...")
        await multi_agent.start_agent(manager_id)
        await multi_agent.start_agent(worker_id)
        
        # Check agent status
        manager_status = await multi_agent.get_agent_status(manager_id)
        worker_status = await multi_agent.get_agent_status(worker_id)
        
        logger.info(f"Manager Status: {manager_status.status.value}")
        logger.info(f"Worker Status: {worker_status.status.value}")
        
        # Execute tasks on agents
        logger.info("Executing tasks...")
        
        # Manager task - coordination and planning
        manager_task = "Analyze the following development task and break it down into steps: 'Create a simple REST API with user authentication'"
        
        # Worker task - implementation work
        worker_task = "Write a Python function that validates email addresses using regex"
        
        # Execute tasks concurrently
        async def execute_manager_task():
            messages = []
            async for message in multi_agent.execute_task(manager_id, manager_task):
                messages.append(message)
                logger.info(f"Manager: {message.type} - {message.content[:100]}...")
            return messages
        
        async def execute_worker_task():
            messages = []
            async for message in multi_agent.execute_task(worker_id, worker_task):
                messages.append(message)
                logger.info(f"Worker: {message.type} - {message.content[:100]}...")
            return messages
        
        # Run tasks in parallel
        manager_results, worker_results = await asyncio.gather(
            execute_manager_task(),
            execute_worker_task()
        )
        
        logger.info(f"Manager task completed with {len(manager_results)} messages")
        logger.info(f"Worker task completed with {len(worker_results)} messages")
        
        # Get system statistics
        stats = multi_agent.get_system_stats()
        logger.info("System Statistics:")
        logger.info(f"  Total Agents: {stats['total_agents']}")
        logger.info(f"  Agents by Status: {stats['agents_by_status']}")
        logger.info(f"  Agents by Role: {stats['agents_by_role']}")
        
        # Health check
        manager_health = await multi_agent.health_check(manager_id)
        worker_health = await multi_agent.health_check(worker_id)
        
        logger.info(f"Manager Health: {'✓' if manager_health.is_healthy else '✗'}")
        logger.info(f"Worker Health: {'✓' if worker_health.is_healthy else '✗'}")
        
    except Exception as e:
        logger.error(f"Error in basic demo: {e}")
    
    finally:
        # Cleanup
        logger.info("Cleaning up...")
        await multi_agent.shutdown(timeout=10.0)
        logger.info("Basic demo completed")


async def demo_dual_agent_system():
    """Demonstrate dual-agent system using convenience function"""
    logger.info("=" * 60)
    logger.info("DEMO 2: Dual-Agent System")
    logger.info("=" * 60)
    
    try:
        # Create dual-agent system with custom configurations
        manager_config = AgentConfig(
            agent_id="manager",
            role=AgentRole.MANAGER,
            name="Project Manager",
            cli_options=None  # Use defaults
        )
        
        worker_config = AgentConfig(
            agent_id="worker",
            role=AgentRole.WORKER,
            name="Development Worker",
            cli_options=None
        )
        
        # Create system
        multi_agent = await create_dual_agent_system(
            manager_config=manager_config,
            worker_config=worker_config
        )
        
        # Demonstrate Manager-Worker coordination
        logger.info("Demonstrating Manager-Worker coordination...")
        
        # Manager analyzes and delegates
        coordination_prompt = """
        As a project manager, analyze this development task and create a detailed plan:
        
        Task: "Build a command-line todo application with the following features:
        1. Add new todos
        2. List all todos
        3. Mark todos as complete
        4. Delete todos
        5. Save/load from file"
        
        Provide a structured breakdown with priorities and estimated effort.
        """
        
        # Worker implements specific functionality
        implementation_prompt = """
        Implement a Python class for a Todo item with the following requirements:
        - Todo has: id, title, description, completed status, created_date
        - Methods: mark_complete(), mark_incomplete(), to_dict(), from_dict()
        - Include proper validation and error handling
        """
        
        # Execute tasks
        logger.info("Manager analyzing project requirements...")
        manager_messages = []
        async for message in multi_agent.execute_task("manager", coordination_prompt):
            manager_messages.append(message)
            if message.type in ["result", "stream"]:
                logger.info(f"Manager progress: {message.type}")
        
        logger.info("Worker implementing Todo class...")
        worker_messages = []
        async for message in multi_agent.execute_task("worker", implementation_prompt):
            worker_messages.append(message)
            if message.type in ["result", "stream"]:
                logger.info(f"Worker progress: {message.type}")
        
        # Show results summary
        logger.info(f"Manager completed analysis ({len(manager_messages)} interactions)")
        logger.info(f"Worker completed implementation ({len(worker_messages)} interactions)")
        
        # Get final system state
        final_stats = multi_agent.get_system_stats()
        logger.info(f"Final system state: {final_stats['total_agents']} agents active")
        
    except Exception as e:
        logger.error(f"Error in dual-agent demo: {e}")
    
    finally:
        await multi_agent.shutdown()
        logger.info("Dual-agent demo completed")


async def demo_specialist_team():
    """Demonstrate specialist team coordination"""
    logger.info("=" * 60) 
    logger.info("DEMO 3: Specialist Team")
    logger.info("=" * 60)
    
    try:
        # Create specialist team
        multi_agent = await create_specialist_team(team_size=3)
        
        logger.info("Created specialist team with manager + 3 specialists")
        
        # Get team composition
        agents = multi_agent.list_agents()
        team_composition = {}
        for agent in agents:
            role = agent.config.role.value
            team_composition[role] = team_composition.get(role, 0) + 1
        
        logger.info(f"Team composition: {team_composition}")
        
        # Demonstrate parallel task execution
        logger.info("Executing specialized tasks in parallel...")
        
        # Define tasks for different specialists
        tasks = [
            ("frontend", "Create a responsive login form component using HTML, CSS, and JavaScript with proper validation"),
            ("backend", "Design a REST API endpoint structure for user authentication with JWT tokens"),
            ("testing", "Create a test plan for the user authentication system including unit, integration, and security tests")
        ]
        
        # Execute tasks in parallel
        task_generators = {}
        for specialist_id, task_prompt in tasks:
            if specialist_id in [agent.config.agent_id for agent in agents]:
                task_generators[specialist_id] = multi_agent.execute_task(specialist_id, task_prompt)
        
        # Collect results
        results = {}
        for specialist_id, task_generator in task_generators.items():
            logger.info(f"Collecting results from {specialist_id}...")
            messages = []
            async for message in task_generator:
                messages.append(message)
            results[specialist_id] = messages
            logger.info(f"{specialist_id} completed with {len(messages)} messages")
        
        # Show team performance
        total_messages = sum(len(msgs) for msgs in results.values())
        logger.info(f"Team completed {len(tasks)} specialized tasks ({total_messages} total interactions)")
        
    except Exception as e:
        logger.error(f"Error in specialist team demo: {e}")
    
    finally:
        await multi_agent.shutdown()
        logger.info("Specialist team demo completed")


async def demo_agent_pool():
    """Demonstrate agent pool with load balancing and auto-scaling"""
    logger.info("=" * 60)
    logger.info("DEMO 4: Agent Pool with Load Balancing")
    logger.info("=" * 60)
    
    # Create multi-agent system
    multi_agent_config = MultiAgentConfig(max_agents=5)
    multi_agent = MultiAgentCLIWrapper(multi_agent_config)
    
    # Create agent pool configuration
    pool_config = PoolConfig(
        min_agents=2,
        max_agents=4,
        scale_up_threshold=0.8,
        scale_down_threshold=0.3,
        enable_auto_scaling=True,
        enable_load_balancing=True
    )
    
    # Initialize agent pool
    agent_pool = AgentPool(multi_agent, pool_config)
    
    try:
        # Start pool
        logger.info("Starting agent pool...")
        await agent_pool.start()
        
        # Submit various tasks to the pool
        logger.info("Submitting tasks to pool...")
        
        tasks = [
            ("High priority task: Implement user authentication", 5),
            ("Medium priority: Create API documentation", 3),
            ("Low priority: Refactor legacy code", 1),
            ("Critical bug fix: Handle null pointer exception", 10),
            ("Normal task: Add unit tests", 2)
        ]
        
        task_ids = []
        for task_desc, priority in tasks:
            task_id = await agent_pool.submit_task(task_desc, priority=priority)
            task_ids.append(task_id)
            logger.info(f"Submitted task {task_id} (priority: {priority})")
        
        # Wait for some tasks to complete
        logger.info("Waiting for tasks to process...")
        await asyncio.sleep(5)
        
        # Check pool metrics
        metrics = await agent_pool.get_metrics()
        logger.info("Pool Metrics:")
        logger.info(f"  Total Agents: {metrics.total_agents}")
        logger.info(f"  Idle Agents: {metrics.idle_agents}")
        logger.info(f"  Busy Agents: {metrics.busy_agents}")
        logger.info(f"  Queue Length: {metrics.queue_length}")
        logger.info(f"  Average Task Duration: {metrics.average_task_duration:.2f}s")
        
        # Check individual task statuses
        for task_id in task_ids[:3]:  # Check first 3 tasks
            status = agent_pool.get_task_status(task_id)
            if status:
                logger.info(f"Task {task_id}: {status['status']}")
        
        # Demonstrate scaling recommendation
        if metrics.recommended_scale_direction.value != "stable":
            logger.info(f"Pool recommends scaling {metrics.recommended_scale_direction.value} by {metrics.recommended_scale_count} agents")
        
    except Exception as e:
        logger.error(f"Error in agent pool demo: {e}")
    
    finally:
        # Cleanup
        logger.info("Cleaning up agent pool...")
        await agent_pool.stop()
        await multi_agent.shutdown()
        logger.info("Agent pool demo completed")


async def demo_health_monitoring():
    """Demonstrate health monitoring and alerting"""
    logger.info("=" * 60)
    logger.info("DEMO 5: Health Monitoring System")
    logger.info("=" * 60)
    
    # Create multi-agent system
    multi_agent = MultiAgentCLIWrapper()
    
    # Create health monitor
    monitor_config = {
        'monitoring_interval': 2.0,  # Check every 2 seconds
        'enable_auto_recovery': True,
        'enable_metrics': True
    }
    
    health_monitor = HealthMonitor(multi_agent, monitor_config)
    
    try:
        # Create some agents
        logger.info("Creating agents for monitoring...")
        
        agent_configs = [
            AgentConfig(agent_id="monitored_agent_1", role=AgentRole.WORKER),
            AgentConfig(agent_id="monitored_agent_2", role=AgentRole.WORKER),
        ]
        
        for config in agent_configs:
            await multi_agent.create_agent(config)
            await multi_agent.start_agent(config.agent_id)
        
        # Start health monitoring
        logger.info("Starting health monitoring...")
        await health_monitor.start()
        
        # Register custom health check
        def custom_performance_check():
            import random
            return [
                {
                    'metric_id': 'custom_response_time',
                    'value': random.uniform(50, 200),  # Simulate response times
                    'unit': 'ms',
                    'threshold_warning': 150,
                    'threshold_critical': 200
                }
            ]
        
        health_monitor.register_custom_health_check('performance', custom_performance_check)
        
        # Register alert callback
        alerts_received = []
        
        def alert_handler(alert):
            alerts_received.append(alert)
            logger.warning(f"ALERT: {alert.title} - {alert.description}")
        
        health_monitor.register_alert_callback(alert_handler)
        
        # Let monitoring run for a while
        logger.info("Monitoring system health...")
        await asyncio.sleep(8)
        
        # Get system health snapshot
        system_health = await health_monitor.get_system_health()
        logger.info("System Health Snapshot:")
        logger.info(f"  Overall Status: {system_health.overall_status.value}")
        logger.info(f"  Total Agents: {system_health.agent_count}")
        logger.info(f"  Healthy Agents: {system_health.healthy_agents}")
        logger.info(f"  Active Alerts: {system_health.active_alerts}")
        logger.info(f"  Uptime: {system_health.uptime_seconds:.1f}s")
        
        if system_health.recommendations:
            logger.info("Recommendations:")
            for rec in system_health.recommendations:
                logger.info(f"  - {rec}")
        
        # Get metrics history
        recent_metrics = health_monitor.get_metrics_history(hours=1)
        logger.info(f"Collected {len(recent_metrics)} metrics in the last hour")
        
        # Show any alerts that were triggered
        active_alerts = health_monitor.get_active_alerts()
        logger.info(f"Active alerts: {len(active_alerts)}")
        
        # Get health summary
        summary = health_monitor.get_health_summary()
        logger.info("Health Monitor Summary:")
        logger.info(f"  Monitoring Active: {summary['monitoring_active']}")
        logger.info(f"  Total Metrics: {summary['total_metrics_collected']}")
        logger.info(f"  Recovery Actions: {summary['recovery_actions_configured']}")
        
    except Exception as e:
        logger.error(f"Error in health monitoring demo: {e}")
    
    finally:
        # Cleanup
        logger.info("Stopping health monitoring...")
        await health_monitor.stop()
        await multi_agent.shutdown()
        logger.info("Health monitoring demo completed")


async def demo_communication_bridge():
    """Demonstrate agent-to-agent communication"""
    logger.info("=" * 60)
    logger.info("DEMO 6: Agent Communication Bridge")
    logger.info("=" * 60)
    
    # Create communication bridge
    comm_bridge = CommunicationBridge()
    
    try:
        # Start communication system
        await comm_bridge.start()
        
        # Register agents
        agents = ["manager", "frontend_dev", "backend_dev", "tester"]
        for agent in agents:
            await comm_bridge.register_agent(agent)
            logger.info(f"Registered agent: {agent}")
        
        # Set up message handlers
        message_log = []
        
        def log_message_handler(message):
            message_log.append((message.from_agent, message.to_agent, message.content))
            logger.info(f"Message: {message.from_agent} → {message.to_agent}: {message.content[:50]}...")
        
        # Register handlers for different agents
        for agent in agents:
            comm_bridge.register_message_handler(
                agent_id=agent,
                message_type=MessageType.TASK_ASSIGNMENT,
                callback=log_message_handler,
                is_async=False
            )
        
        # Demonstrate different communication patterns
        logger.info("Demonstrating communication patterns...")
        
        # 1. Manager assigns tasks
        await comm_bridge.send_task_assignment(
            from_agent="manager",
            to_agent="frontend_dev",
            task_description="Create responsive user interface for the dashboard",
            task_metadata={"deadline": "2024-01-20", "priority": "high"}
        )
        
        await comm_bridge.send_task_assignment(
            from_agent="manager", 
            to_agent="backend_dev",
            task_description="Implement REST API endpoints for user management",
            task_metadata={"deadline": "2024-01-18", "priority": "high"}
        )
        
        # 2. Status updates
        await comm_bridge.send_status_update(
            from_agent="frontend_dev",
            to_agent="manager",
            status="Started UI development - 20% complete",
            details={"components_done": 2, "components_total": 10}
        )
        
        # 3. Broadcast notification
        await comm_bridge.broadcast_notification(
            from_agent="manager",
            notification="Daily standup meeting in 30 minutes - Conference Room A"
        )
        
        # Allow time for message processing
        await asyncio.sleep(1)
        
        # Check message delivery
        for agent in agents:
            messages = await comm_bridge.receive_messages(agent, max_messages=5)
            logger.info(f"{agent} received {len(messages)} messages")
        
        # Get communication statistics
        stats = comm_bridge.get_communication_stats()
        logger.info("Communication Statistics:")
        logger.info(f"  Active Agents: {stats['active_agents']}")
        logger.info(f"  Message History: {stats['message_history_length']}")
        logger.info(f"  Registered Handlers: {stats['registered_handlers']}")
        logger.info(f"  Messages by Type: {stats['message_counts_by_type']}")
        
        # Show message log
        logger.info(f"Logged {len(message_log)} message exchanges")
        
    except Exception as e:
        logger.error(f"Error in communication demo: {e}")
    
    finally:
        # Cleanup
        logger.info("Stopping communication bridge...")
        await comm_bridge.stop()
        logger.info("Communication bridge demo completed")


async def main():
    """Run all demonstrations"""
    logger.info("🚀 Multi-Agent CLI Wrapper Demonstration")
    logger.info("This demo showcases the comprehensive multi-agent system capabilities")
    logger.info("")
    
    try:
        # Run all demos
        demos = [
            demo_basic_multi_agent,
            demo_dual_agent_system,
            demo_specialist_team,
            demo_agent_pool,
            demo_health_monitoring,
            demo_communication_bridge
        ]
        
        for i, demo_func in enumerate(demos, 1):
            logger.info(f"\n🎯 Starting Demo {i}/{len(demos)}: {demo_func.__name__}")
            try:
                await demo_func()
            except Exception as e:
                logger.error(f"Demo {demo_func.__name__} failed: {e}")
            
            # Brief pause between demos
            if i < len(demos):
                logger.info("Pausing between demos...")
                await asyncio.sleep(2)
        
        logger.info("\n" + "=" * 60)
        logger.info("🎉 All demonstrations completed successfully!")
        logger.info("=" * 60)
        
        logger.info("\nKey features demonstrated:")
        logger.info("✅ Multi-agent creation and lifecycle management")
        logger.info("✅ Task execution with process isolation")
        logger.info("✅ Health monitoring and recovery")
        logger.info("✅ Agent communication and coordination")
        logger.info("✅ Resource pooling and load balancing")
        logger.info("✅ Epic 3 resource management integration")
        logger.info("✅ Dual-agent and specialist team patterns")
        logger.info("✅ Real-time monitoring and alerting")
        
    except KeyboardInterrupt:
        logger.info("\nDemo interrupted by user")
    except Exception as e:
        logger.error(f"Demo suite failed: {e}")
    
    logger.info("\nDemo suite completed")


if __name__ == "__main__":
    asyncio.run(main())