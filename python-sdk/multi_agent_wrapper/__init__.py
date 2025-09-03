"""
Multi-Agent CLI Wrapper Package

Provides multi-agent support for Claude Code CLI with:
- Process isolation and resource management
- Agent lifecycle management 
- Real-time status monitoring
- Communication bridges for agent coordination
- Integration with Epic 3 process management system
"""

from .multi_agent_wrapper import (
    MultiAgentCLIWrapper,
    AgentConfig, 
    AgentInfo,
    AgentStatus,
    AgentRole,
    MultiAgentConfig,
    AgentCommunication,
    HealthCheckResult,
    create_dual_agent_system,
    create_specialist_team
)

from .agent_pool import AgentPool
from .communication_bridge import CommunicationBridge
from .health_monitor import HealthMonitor

__version__ = "1.0.0"
__all__ = [
    "MultiAgentCLIWrapper",
    "AgentConfig",
    "AgentInfo", 
    "AgentStatus",
    "AgentRole",
    "MultiAgentConfig",
    "AgentCommunication",
    "HealthCheckResult",
    "create_dual_agent_system",
    "create_specialist_team",
    "AgentPool",
    "CommunicationBridge",
    "HealthMonitor"
]