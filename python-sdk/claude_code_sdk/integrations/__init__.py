"""
Claude Code SDK - Integration Layer
Integrations with external systems and frameworks
"""

from .automatic_claude import AutomaticClaudeIntegration
from .monitoring import MonitoringIntegration

__all__ = ['AutomaticClaudeIntegration', 'MonitoringIntegration']