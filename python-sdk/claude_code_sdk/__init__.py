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
    'CLIDetector'
]

# Official SDK naming compatibility
ClaudeSDKClient = ClaudeCodeClient  # Official SDK naming
ClaudeClient = ClaudeCodeClient     # Alias for easier migration
claude_query = query                # Direct alias

# SDK information
SDK_INFO = {
    'name': 'claude-code-sdk',
    'version': __version__,
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
    ]
}

def get_sdk_info() -> dict:
    """Get SDK information and capabilities"""
    return SDK_INFO.copy()

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