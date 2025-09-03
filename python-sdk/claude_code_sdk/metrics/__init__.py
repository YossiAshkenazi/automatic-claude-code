"""
Claude Code SDK Metrics Module

Privacy-first analytics and metrics collection for the Claude Code Python SDK.
All metrics collection is opt-in and respects user privacy.
"""

from .analytics import MetricsCollector, AnalyticsConfig
from .consent import ConsentManager, PrivacySettings  
from .reporter import ErrorReporter, UsageReporter
from .dashboard import MetricsDashboard

__all__ = [
    'MetricsCollector',
    'AnalyticsConfig', 
    'ConsentManager',
    'PrivacySettings',
    'ErrorReporter', 
    'UsageReporter',
    'MetricsDashboard'
]

# Version info
__version__ = '0.1.0'
__author__ = 'Claude Code SDK Team'