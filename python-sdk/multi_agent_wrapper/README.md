# Multi-Agent CLI Wrapper

A comprehensive multi-agent system for Claude Code CLI with advanced process management, resource isolation, and coordination capabilities.

## Overview

The Multi-Agent CLI Wrapper extends the production-ready `claude_cli_wrapper.py` to support parallel Claude Code CLI agents with:

- **Process Isolation**: Each agent runs in isolated processes with configurable resource limits
- **Agent Lifecycle Management**: Create, start, stop, restart, and monitor agent health
- **Epic 3 Integration**: Comprehensive resource tracking and guaranteed cleanup
- **Health Monitoring**: Real-time metrics, alerting, and automatic recovery
- **Communication Bridges**: Structured agent-to-agent communication patterns  
- **Resource Pooling**: Load balancing, auto-scaling, and task queuing
- **Windows Compatibility**: Primary target platform with cross-platform support

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 MULTI-AGENT CLI WRAPPER                        │
│            (Enhanced Python Multi-Agent System)                │
│  Agent Pool | Health Monitor | Communication Bridge           │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Enhanced Multi-Agent Management
┌─────────────────────▼───────────────────────────────────────────┐
│              PRODUCTION CLI WRAPPER                             │
│              (claude_cli_wrapper.py v1.1.1)                    │
│  Epic 3 Process Management | Circuit Breaker | Retry Logic    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Direct CLI Execution
┌─────────────────────▼───────────────────────────────────────────┐
│                CLAUDE CODE CLI AGENTS                          │
│            (Multiple Parallel Instances)                       │
│  Manager Agent | Worker Agent 1 | Worker Agent N              │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Basic Multi-Agent Usage

```python
import asyncio
from multi_agent_wrapper import MultiAgentCLIWrapper, AgentConfig, AgentRole

async def main():
    # Create multi-agent system
    multi_agent = MultiAgentCLIWrapper()
    
    try:
        # Create and start agents
        manager_config = AgentConfig(
            agent_id="manager",
            role=AgentRole.MANAGER,
            name="Project Manager"
        )
        
        worker_config = AgentConfig(
            agent_id="worker", 
            role=AgentRole.WORKER,
            name="Development Worker"
        )
        
        await multi_agent.create_agent(manager_config)
        await multi_agent.create_agent(worker_config)
        
        await multi_agent.start_agent("manager")
        await multi_agent.start_agent("worker")
        
        # Execute tasks
        async for message in multi_agent.execute_task("manager", "Analyze this codebase and suggest improvements"):
            print(f"Manager: {message.content}")
        
        async for message in multi_agent.execute_task("worker", "Implement the suggested improvements"):
            print(f"Worker: {message.content}")
    
    finally:
        await multi_agent.shutdown()

asyncio.run(main())
```

### Dual-Agent System (Convenience)

```python
from multi_agent_wrapper import create_dual_agent_system

async def dual_agent_example():
    # Quick dual-agent setup
    multi_agent = await create_dual_agent_system()
    
    try:
        # Manager analyzes, Worker implements
        manager_task = "Create a plan for implementing user authentication"
        worker_task = "Write a Python function for password hashing"
        
        # Execute in parallel
        manager_results, worker_results = await asyncio.gather(
            collect_messages(multi_agent.execute_task("manager", manager_task)),
            collect_messages(multi_agent.execute_task("worker", worker_task))
        )
        
        print(f"Manager completed with {len(manager_results)} messages")
        print(f"Worker completed with {len(worker_results)} messages")
    
    finally:
        await multi_agent.shutdown()

async def collect_messages(task_generator):
    messages = []
    async for message in task_generator:
        messages.append(message)
    return messages
```

### Specialist Team

```python
from multi_agent_wrapper import create_specialist_team

async def specialist_team_example():
    # Create team with multiple specialists
    multi_agent = await create_specialist_team(team_size=3)
    
    try:
        # Broadcast task to all specialists
        task_generators = await multi_agent.broadcast_task(
            "Implement a complete user authentication system",
            target_roles=[AgentRole.SPECIALIST]
        )
        
        # Collect results from all specialists
        for agent_id, task_gen in task_generators.items():
            print(f"\n=== {agent_id} Results ===")
            async for message in task_gen:
                if message.type == "result":
                    print(message.content[:200] + "...")
    
    finally:
        await multi_agent.shutdown()
```

## Advanced Features

### Agent Pool with Load Balancing

```python
from multi_agent_wrapper import MultiAgentCLIWrapper
from multi_agent_wrapper.agent_pool import AgentPool, PoolConfig, LoadBalanceStrategy

async def agent_pool_example():
    # Create multi-agent system
    multi_agent = MultiAgentCLIWrapper()
    
    # Configure agent pool
    pool_config = PoolConfig(
        min_agents=2,
        max_agents=5,
        enable_auto_scaling=True,
        load_balance_strategy=LoadBalanceStrategy.LEAST_BUSY
    )
    
    # Create pool
    pool = AgentPool(multi_agent, pool_config)
    
    try:
        await pool.start()
        
        # Submit tasks with different priorities
        tasks = [
            ("Critical bug fix", 10),
            ("Feature implementation", 5),
            ("Documentation update", 2),
            ("Code refactoring", 1)
        ]
        
        task_ids = []
        for task_desc, priority in tasks:
            task_id = await pool.submit_task(task_desc, priority=priority)
            task_ids.append(task_id)
        
        # Monitor pool metrics
        metrics = await pool.get_metrics()
        print(f"Pool: {metrics.total_agents} agents, {metrics.queue_length} queued")
        
        # Wait for tasks
        for task_id in task_ids:
            success = await pool.wait_for_task(task_id, timeout=60.0)
            print(f"Task {task_id}: {'✓' if success else '✗'}")
    
    finally:
        await pool.stop()
```

### Health Monitoring

```python
from multi_agent_wrapper.health_monitor import HealthMonitor

async def health_monitoring_example():
    multi_agent = MultiAgentCLIWrapper()
    
    # Create health monitor
    monitor = HealthMonitor(multi_agent, {
        'monitoring_interval': 30.0,
        'enable_auto_recovery': True
    })
    
    try:
        # Create agents
        for i in range(3):
            config = AgentConfig(f"agent_{i}", AgentRole.WORKER)
            await multi_agent.create_agent(config)
            await multi_agent.start_agent(f"agent_{i}")
        
        # Start monitoring
        await monitor.start()
        
        # Register alert handler
        def alert_handler(alert):
            print(f"🚨 ALERT: {alert.title} - {alert.description}")
        
        monitor.register_alert_callback(alert_handler)
        
        # Let monitoring run
        await asyncio.sleep(60)
        
        # Get system health
        health = await monitor.get_system_health()
        print(f"System Health: {health.overall_status.value}")
        print(f"Healthy Agents: {health.healthy_agents}/{health.agent_count}")
        
    finally:
        await monitor.stop()
        await multi_agent.shutdown()
```

### Agent Communication

```python
from multi_agent_wrapper.communication_bridge import CommunicationBridge, MessageType

async def communication_example():
    bridge = CommunicationBridge()
    
    try:
        await bridge.start()
        
        # Register agents
        agents = ["manager", "frontend", "backend", "tester"]
        for agent in agents:
            await bridge.register_agent(agent)
        
        # Send task assignment
        task_id = await bridge.send_task_assignment(
            from_agent="manager",
            to_agent="frontend",
            task_description="Create responsive UI components",
            task_metadata={"deadline": "2024-01-20", "priority": "high"}
        )
        
        # Send status update
        await bridge.send_status_update(
            from_agent="frontend",
            to_agent="manager", 
            status="UI development 50% complete"
        )
        
        # Broadcast notification
        await bridge.broadcast_notification(
            from_agent="manager",
            notification="Code freeze starts at 5 PM today"
        )
        
        # Process messages
        for agent in agents:
            messages = await bridge.receive_messages(agent, max_messages=5)
            print(f"{agent} received {len(messages)} messages")
    
    finally:
        await bridge.stop()
```

## Configuration

### Multi-Agent System Config

```python
from multi_agent_wrapper import MultiAgentConfig

config = MultiAgentConfig(
    max_agents=5,                          # Maximum agents allowed
    default_agent_timeout=300,             # Default task timeout (seconds)
    health_check_interval=30.0,            # Health check frequency
    resource_cleanup_interval=60.0,        # Resource cleanup frequency
    auto_scale=False,                      # Enable auto-scaling
    min_agents=1,                         # Minimum agents to maintain
    max_memory_total_mb=2048,             # Total memory limit
    max_cpu_total_percent=80.0,           # Total CPU limit
    communication_timeout=10.0,           # Inter-agent communication timeout
    enable_metrics=True,                  # Enable metrics collection
    log_level="INFO"                      # Logging level
)

multi_agent = MultiAgentCLIWrapper(config)
```

### Agent Configuration

```python
from multi_agent_wrapper import AgentConfig, AgentRole
from claude_cli_wrapper import ClaudeCliOptions

agent_config = AgentConfig(
    agent_id="specialized_agent",
    role=AgentRole.SPECIALIST,
    name="Frontend Specialist",
    cli_options=ClaudeCliOptions(
        model="sonnet",                    # Claude model to use
        max_turns=10,                     # Max conversation turns
        verbose=False,                    # Detailed logging
        timeout=300                       # Task timeout
    ),
    max_memory_mb=512,                    # Memory limit
    max_cpu_percent=25.0,                # CPU usage limit
    max_execution_time_seconds=600,       # Max task execution time
    auto_restart=True,                    # Auto-restart on failure
    restart_delay_seconds=5.0,           # Delay before restart
    health_check_interval_seconds=30.0,  # Health check frequency
    enable_logging=True,                 # Agent-specific logging
    working_directory=Path("/workspace") # Working directory
)
```

## Agent Roles

The system supports different agent roles for specialized workflows:

- **MANAGER**: Coordinates tasks and delegates work to other agents
- **WORKER**: Executes assigned tasks and reports back to managers  
- **SPECIALIST**: Domain-specific expertise (frontend, backend, testing, etc.)
- **COORDINATOR**: Cross-agent communication and workflow management

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
# Run all tests
cd python-sdk/multi_agent_wrapper
python -m pytest tests/ -v

# Run specific test modules
python -m pytest tests/test_multi_agent_wrapper.py -v
python -m pytest tests/test_agent_pool.py -v
python -m pytest tests/test_communication_bridge.py -v
python -m pytest tests/test_health_monitor.py -v
```

### Integration Tests

Test the complete system integration:

```bash
cd python-sdk
python test_multi_agent_integration.py
```

### Demo

Run the comprehensive demonstration:

```bash
cd python-sdk/multi_agent_wrapper  
python demo_multi_agent.py
```

## Error Handling & Recovery

The system includes comprehensive error handling:

### Circuit Breaker Pattern
- Prevents repeated failures from cascading
- Automatic recovery after timeout periods
- Authentication failure detection and guidance

### Automatic Recovery
- Failed agent restart with exponential backoff
- Resource exhaustion detection and scaling
- Health monitoring with alerting

### Epic 3 Resource Management
- Guaranteed process cleanup on shutdown
- Resource leak detection and prevention
- Graceful termination with escalation to force kill

## Production Deployment

### Resource Limits

Configure appropriate resource limits for production:

```python
# Production configuration
production_config = MultiAgentConfig(
    max_agents=10,
    max_memory_total_mb=4096,      # 4GB total
    max_cpu_total_percent=70.0,    # Reserve 30% CPU
    enable_resource_limits=True,
    health_check_interval=60.0,    # 1 minute
    resource_cleanup_interval=300.0 # 5 minutes
)

# Agent limits
agent_config = AgentConfig(
    agent_id="prod_agent",
    role=AgentRole.WORKER,
    max_memory_mb=256,             # 256MB per agent
    max_cpu_percent=15.0,          # 15% CPU per agent
    max_execution_time_seconds=1800, # 30 minutes max
    auto_restart=True,
    health_check_interval_seconds=60.0
)
```

### Monitoring & Alerting

Set up comprehensive monitoring:

```python
# Production monitoring
monitor_config = {
    'monitoring_interval': 30.0,
    'metric_retention_hours': 24,
    'alert_retention_hours': 72, 
    'enable_auto_recovery': True,
    'enable_predictive_analysis': True
}

monitor = HealthMonitor(multi_agent, monitor_config)

# Register alert handlers
def alert_to_slack(alert):
    # Send to Slack/Teams/email
    pass

def alert_to_log(alert):
    logger.critical(f"PRODUCTION ALERT: {alert.title} - {alert.description}")

monitor.register_alert_callback(alert_to_slack)
monitor.register_alert_callback(alert_to_log)
```

### Graceful Shutdown

Ensure clean shutdown in production:

```python
import signal

async def production_shutdown(multi_agent, monitor, pool):
    """Production shutdown sequence"""
    logger.info("Initiating graceful shutdown...")
    
    # Stop accepting new work
    if pool:
        await pool.stop(timeout=30.0)
    
    # Stop monitoring
    if monitor:
        await monitor.stop(timeout=10.0)
    
    # Shutdown multi-agent system
    await multi_agent.shutdown(timeout=60.0)
    
    logger.info("Shutdown complete")

# Signal handlers
def signal_handler(signum, frame):
    logger.info(f"Received signal {signum}")
    asyncio.create_task(production_shutdown(multi_agent, monitor, pool))

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)
```

## Troubleshooting

### Common Issues

**Agent fails to start**:
```bash
# Check Claude CLI availability
claude --version
claude auth status

# Verify wrapper integration
python -c "from claude_cli_wrapper import ClaudeCliWrapper; w = ClaudeCliWrapper(); print(w.is_available())"
```

**High memory usage**:
```python
# Monitor resource usage
stats = multi_agent.get_system_stats()
print(f"Resource stats: {stats['resource_stats']}")

# Check agent-specific usage
for agent_id in multi_agent.agents:
    health = await multi_agent.health_check(agent_id)
    if health.memory_usage_mb and health.memory_usage_mb > 500:
        print(f"Agent {agent_id} using {health.memory_usage_mb}MB")
```

**Communication issues**:
```python
# Check bridge stats
bridge_stats = comm_bridge.get_communication_stats()
print(f"Bridge stats: {bridge_stats}")

# Verify agent registration
print(f"Active agents: {bridge_stats['active_agents']}")
print(f"Queued messages: {bridge_stats['total_queued_messages']}")
```

### Debug Mode

Enable detailed logging for troubleshooting:

```python
import logging

# Enable debug logging
logging.getLogger('multi_agent_wrapper').setLevel(logging.DEBUG)
logging.getLogger('claude_cli_wrapper').setLevel(logging.DEBUG)

# Create config with verbose options
debug_config = MultiAgentConfig(
    log_level="DEBUG",
    enable_metrics=True
)

# Agent with verbose CLI
debug_agent_config = AgentConfig(
    agent_id="debug_agent",
    role=AgentRole.WORKER,
    cli_options=ClaudeCliOptions(
        verbose=True,
        timeout=60  # Shorter timeout for debugging
    ),
    enable_logging=True
)
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `python -m pytest tests/ -v`
4. Run integration tests: `python test_multi_agent_integration.py`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open Pull Request

## License

This project extends the existing `claude_cli_wrapper.py` and follows the same license terms as the parent project.

## Changelog

### v1.0.0 (2024-01-15)
- Initial release of Multi-Agent CLI Wrapper
- Integration with production claude_cli_wrapper.py v1.1.1
- Epic 3 process management integration
- Comprehensive agent lifecycle management
- Health monitoring and recovery system
- Agent communication bridges
- Resource pooling and load balancing
- Windows-first compatibility
- Complete test suite and documentation

## Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Run the integration tests to verify system health
3. Enable debug logging to investigate issues
4. Check the demo script for usage examples

The Multi-Agent CLI Wrapper builds upon the solid foundation of `claude_cli_wrapper.py` to provide enterprise-grade multi-agent capabilities while maintaining the same reliability and ease of use.