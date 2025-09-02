"""
Claude Code Python SDK

A comprehensive Python SDK for Claude Code CLI interactions with full integration 
support for the automatic-claude-code system.

Features:
- Async/await support with context managers
- Streaming and non-streaming execution modes
- Comprehensive error handling and classification
- Integration with dual-agent architecture
- Real-time monitoring and observability
- Cross-platform compatibility
- Type hints for full IDE support

Basic Usage:
    from claude_code_sdk import query, ClaudeSDKClient
    
    # Simple query
    async for message in query("Create a Python function"):
        print(message.result)
    
    # Advanced client usage (official SDK naming)
    async with ClaudeSDKClient(options) as client:
        async for message in client.query("Complex task"):
            # Handle streaming messages
            pass

Integration Usage:
    from claude_code_sdk.integrations import AutomaticClaudeIntegration
    
    integration = AutomaticClaudeIntegration(enable_dual_agent=True)
    result = await integration.execute_with_monitoring("Implement auth system")
"""

__version__ = "0.1.0"
__author__ = "Claude Code SDK Team"
__email__ = "sdk@example.com"

# Version metadata for programmatic access
__version_info__ = tuple(int(x) for x in __version__.split('.') if x.isdigit())
__version_tuple__ = __version_info__  # Alias for compatibility

# Release information
__release__ = __version__
__status__ = "Beta"  # Alpha, Beta, Release Candidate, Stable
__build_date__ = "2025-01-15"
__git_revision__ = None  # Will be populated by CI/CD

# Core exports
from .core.client import ClaudeCodeClient
from .core.options import (
    ClaudeCodeOptions, 
    create_development_options,
    create_production_options,
    create_dual_agent_options,
    create_streaming_options
)
from .core.messages import (
    BaseMessage, 
    ResultMessage, 
    ToolUseMessage, 
    ToolResultMessage, 
    ErrorMessage,
    StreamMessage,
    StatusMessage,
    Message,
    MessageList,
    parse_message,
    create_result_message,
    create_error_message
)

# Exception exports
from .exceptions import (
    ClaudeCodeError,
    ClaudeTimeoutError,
    ClaudeAuthError,
    ClaudeNotFoundError,
    ClaudeConfigError,
    RateLimitError,
    QuotaExceededError,
    InvalidModelError,
    SessionCorruptedError,
    ResourceExhaustionError,
    NetworkError,
    ProcessError,
    classify_error,
    is_recoverable_error
)

# Interface exports
from .interfaces.query import (
    query,
    query_stream,
    conversation,
    check_claude,
    query_sync,
    check_claude_sync,
    claude_code_query,
    claude_code_stream,
    claude_code_conversation
)

from .interfaces.streaming import (
    StreamingHandler,
    MessageCollector,
    StreamProcessor,
    collect_all_messages,
    get_final_result,
    error_only_filter,
    result_only_filter,
    tool_activity_filter
)

# Integration exports
from .integrations.automatic_claude import AutomaticClaudeIntegration
from .integrations.monitoring import MonitoringIntegration

# Utility exports
from .utils.cli_detector import CLIDetector

__all__ = [
    # Version info
    '__version__',
    '__version_info__',
    '__version_tuple__',
    '__status__',
    '__build_date__',
    '__git_revision__',
    '__author__',
    '__email__',
    
    # Core classes
    'ClaudeCodeClient',
    'ClaudeSDKClient',  # Official SDK naming
    'ClaudeCodeOptions',
    
    # Option factories
    'create_development_options',
    'create_production_options', 
    'create_dual_agent_options',
    'create_streaming_options',
    
    # Message types
    'BaseMessage',
    'ResultMessage',
    'ToolUseMessage',
    'ToolResultMessage',
    'ErrorMessage',
    'StreamMessage',
    'StatusMessage',
    'Message',
    'MessageList',
    'parse_message',
    'create_result_message',
    'create_error_message',
    
    # Exceptions
    'ClaudeCodeError',
    'ClaudeTimeoutError',
    'ClaudeAuthError',
    'ClaudeNotFoundError',
    'ClaudeConfigError',
    'RateLimitError',
    'QuotaExceededError',
    'InvalidModelError',
    'SessionCorruptedError',
    'ResourceExhaustionError',
    'NetworkError',
    'ProcessError',
    'classify_error',
    'is_recoverable_error',
    
    # High-level interfaces
    'query',
    'query_stream',
    'conversation',
    'check_claude',
    'query_sync',
    'check_claude_sync',
    'claude_code_query',
    'claude_code_stream',
    'claude_code_conversation',
    
    # Streaming support
    'StreamingHandler',
    'MessageCollector',
    'StreamProcessor',
    'collect_all_messages',
    'get_final_result',
    'error_only_filter',
    'result_only_filter',
    'tool_activity_filter',
    
    # Integrations
    'AutomaticClaudeIntegration',
    'MonitoringIntegration',
    
    # Utilities
    'CLIDetector',
    
    # Version management functions
    'get_sdk_info',
    'get_version_info',
    'check_version_compatibility'
]

# Official SDK naming compatibility
ClaudeSDKClient = ClaudeCodeClient  # Official SDK naming
ClaudeClient = ClaudeCodeClient     # Alias for easier migration
claude_query = query                # Direct alias

# SDK information
SDK_INFO = {
    'name': 'claude-code-sdk',
    'version': __version__,
    'version_info': __version_info__,
    'status': __status__,
    'build_date': __build_date__,
    'git_revision': __git_revision__,
    'description': 'Python SDK for Claude Code CLI with dual-agent integration',
    'features': [
        'Async/await support',
        'Streaming responses', 
        'Dual-agent architecture',
        'Real-time monitoring',
        'Cross-platform compatibility',
        'Comprehensive error handling',
        'Type safety with hints'
    ],
    'compatible_with': [
        'automatic-claude-code v2.0.0+',
        'Claude Code CLI v1.0+',
        'Python 3.10+'
    ],
    'release_info': {
        'is_prerelease': __status__ in ('Alpha', 'Beta', 'Release Candidate'),
        'is_stable': __status__ == 'Stable',
        'support_level': 'Beta' if __status__ == 'Beta' else 'Development'
    }
}

def get_sdk_info() -> dict:
    """Get SDK information and capabilities"""
    return SDK_INFO.copy()

def get_version_info() -> dict:
    """Get detailed version information"""
    return {
        'version': __version__,
        'version_info': __version_info__,
        'version_tuple': __version_tuple__,
        'status': __status__,
        'build_date': __build_date__,
        'git_revision': __git_revision__,
        'is_prerelease': __status__ in ('Alpha', 'Beta', 'Release Candidate'),
        'is_stable': __status__ == 'Stable'
    }

def check_version_compatibility(required_version: str) -> dict:
    """
    Check if current version meets requirements
    
    Args:
        required_version: Version requirement like ">=1.0.0" or "~1.1.0"
        
    Returns:
        Dict with compatibility info
    """
    try:
        from packaging import version
        current = version.parse(__version__)
        
        # Simple version comparison for now
        if required_version.startswith(">="):
            required = version.parse(required_version[2:])
            compatible = current >= required
        elif required_version.startswith(">"):
            required = version.parse(required_version[1:])
            compatible = current > required
        elif required_version.startswith("=="):
            required = version.parse(required_version[2:])
            compatible = current == required
        elif required_version.startswith("~"):
            # Compatible release (~1.1.0 means >=1.1.0, <1.2.0)
            required = version.parse(required_version[1:])
            compatible = (current >= required and 
                         current < version.parse(f"{required.major}.{required.minor + 1}.0"))
        else:
            required = version.parse(required_version)
            compatible = current == required
            
        return {
            'compatible': compatible,
            'current_version': str(current),
            'required_version': required_version,
            'message': 'Compatible' if compatible else f'Version {current} does not meet requirement {required_version}'
        }
    except ImportError:
        # Fallback without packaging library
        return {
            'compatible': None,
            'current_version': __version__,
            'required_version': required_version,
            'message': 'Cannot determine compatibility - packaging library not available'
        }

# Module-level convenience functions for quick access
async def quick_query(prompt: str, **kwargs) -> str:
    """
    Quick convenience function for simple queries
    
    Returns just the final result string.
    """
    async for message in query(prompt, **kwargs):
        if isinstance(message, ResultMessage):
            return message.result
    return ""

async def quick_check() -> bool:
    """Quick check if Claude CLI is available"""
    result = await check_claude()
    return result.get('available', False)