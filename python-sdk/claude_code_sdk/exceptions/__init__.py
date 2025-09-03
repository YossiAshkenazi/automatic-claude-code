"""
Claude Code SDK - Exception Classes
"""

from .errors import (
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

__all__ = [
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
    'is_recoverable_error'
]
