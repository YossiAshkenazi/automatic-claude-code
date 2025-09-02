"""
Claude Code SDK - Exception Hierarchy
Comprehensive error handling for all Claude Code interactions
"""

from typing import Optional, Dict, Any
import traceback

class ClaudeCodeError(Exception):
    """
    Base exception for all Claude Code SDK errors
    
    Attributes:
        message: Error description
        error_code: Optional error code for categorization
        context: Additional context information
        recoverable: Whether the error might be recoverable with retry
    """
    
    def __init__(
        self, 
        message: str, 
        error_code: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        recoverable: bool = False
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.context = context or {}
        self.recoverable = recoverable
        self.traceback_info = traceback.format_exc()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for logging/serialization"""
        return {
            'error_type': self.__class__.__name__,
            'message': self.message,
            'error_code': self.error_code,
            'context': self.context,
            'recoverable': self.recoverable,
            'traceback': self.traceback_info
        }
    
    def __str__(self) -> str:
        base = f"{self.__class__.__name__}: {self.message}"
        if self.error_code:
            base += f" (Code: {self.error_code})"
        return base

class ClaudeTimeoutError(ClaudeCodeError):
    """Raised when Claude Code execution times out"""
    
    def __init__(
        self, 
        message: str, 
        timeout_seconds: Optional[float] = None,
        **kwargs
    ):
        super().__init__(message, error_code="TIMEOUT", recoverable=True, **kwargs)
        self.timeout_seconds = timeout_seconds
        if timeout_seconds:
            self.context['timeout_seconds'] = timeout_seconds

class ClaudeAuthError(ClaudeCodeError):
    """Raised when there are authentication issues"""
    
    def __init__(
        self, 
        message: str, 
        auth_method: Optional[str] = None,
        **kwargs
    ):
        super().__init__(message, error_code="AUTH_FAILED", **kwargs)
        self.auth_method = auth_method
        if auth_method:
            self.context['auth_method'] = auth_method

class ClaudeNotFoundError(ClaudeCodeError):
    """Raised when Claude CLI is not found or accessible"""
    
    def __init__(
        self, 
        message: str, 
        cli_path: Optional[str] = None,
        **kwargs
    ):
        super().__init__(message, error_code="CLI_NOT_FOUND", **kwargs)
        self.cli_path = cli_path
        if cli_path:
            self.context['cli_path'] = cli_path

class ClaudeConfigError(ClaudeCodeError):
    """Raised when there are configuration issues"""
    
    def __init__(
        self, 
        message: str, 
        config_key: Optional[str] = None,
        **kwargs
    ):
        super().__init__(message, error_code="CONFIG_ERROR", **kwargs)
        self.config_key = config_key
        if config_key:
            self.context['config_key'] = config_key

class RateLimitError(ClaudeCodeError):
    """Raised when API rate limits are exceeded"""
    
    def __init__(
        self, 
        message: str, 
        retry_after: Optional[int] = None,
        limit_type: Optional[str] = None,
        **kwargs
    ):
        super().__init__(message, error_code="RATE_LIMIT", recoverable=True, **kwargs)
        self.retry_after = retry_after
        self.limit_type = limit_type
        if retry_after:
            self.context['retry_after'] = retry_after
        if limit_type:
            self.context['limit_type'] = limit_type

class QuotaExceededError(ClaudeCodeError):
    """Raised when usage quotas are exceeded"""
    
    def __init__(
        self, 
        message: str, 
        quota_type: Optional[str] = None,
        current_usage: Optional[int] = None,
        quota_limit: Optional[int] = None,
        **kwargs
    ):
        super().__init__(message, error_code="QUOTA_EXCEEDED", **kwargs)
        self.quota_type = quota_type
        self.current_usage = current_usage
        self.quota_limit = quota_limit
        
        if quota_type:
            self.context['quota_type'] = quota_type
        if current_usage is not None:
            self.context['current_usage'] = current_usage
        if quota_limit is not None:
            self.context['quota_limit'] = quota_limit

class InvalidModelError(ClaudeCodeError):
    """Raised when an invalid model is specified"""
    
    def __init__(
        self, 
        message: str, 
        model_requested: Optional[str] = None,
        available_models: Optional[list] = None,
        **kwargs
    ):
        super().__init__(message, error_code="INVALID_MODEL", **kwargs)
        self.model_requested = model_requested
        self.available_models = available_models
        
        if model_requested:
            self.context['model_requested'] = model_requested
        if available_models:
            self.context['available_models'] = available_models

class SessionCorruptedError(ClaudeCodeError):
    """Raised when a session becomes corrupted or invalid"""
    
    def __init__(
        self, 
        message: str, 
        session_id: Optional[str] = None,
        **kwargs
    ):
        super().__init__(message, error_code="SESSION_CORRUPTED", **kwargs)
        self.session_id = session_id
        if session_id:
            self.context['session_id'] = session_id

class ResourceExhaustionError(ClaudeCodeError):
    """Raised when system resources are exhausted"""
    
    def __init__(
        self, 
        message: str, 
        resource_type: Optional[str] = None,
        **kwargs
    ):
        super().__init__(message, error_code="RESOURCE_EXHAUSTED", recoverable=True, **kwargs)
        self.resource_type = resource_type
        if resource_type:
            self.context['resource_type'] = resource_type

class NetworkError(ClaudeCodeError):
    """Raised when network connectivity issues occur"""
    
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None,
        **kwargs
    ):
        super().__init__(message, error_code="NETWORK_ERROR", recoverable=True, **kwargs)
        self.status_code = status_code
        if status_code:
            self.context['status_code'] = status_code

class ProcessError(ClaudeCodeError):
    """Raised when subprocess execution fails"""
    
    def __init__(
        self, 
        message: str, 
        exit_code: Optional[int] = None,
        stderr: Optional[str] = None,
        command: Optional[str] = None,
        **kwargs
    ):
        super().__init__(message, error_code="PROCESS_ERROR", recoverable=True, **kwargs)
        self.exit_code = exit_code
        self.stderr = stderr
        self.command = command
        
        if exit_code is not None:
            self.context['exit_code'] = exit_code
        if stderr:
            self.context['stderr'] = stderr
        if command:
            self.context['command'] = command

# Error classification helpers
def classify_error(error_text: str, stderr: str = "", exit_code: Optional[int] = None) -> ClaudeCodeError:
    """
    Classify a generic error into the appropriate exception type
    
    Args:
        error_text: Primary error message
        stderr: Standard error output
        exit_code: Process exit code
    
    Returns:
        Appropriate ClaudeCodeError subclass instance
    """
    error_lower = error_text.lower()
    stderr_lower = stderr.lower()
    
    # Authentication errors
    if any(keyword in error_lower for keyword in ['auth', 'unauthorized', 'login', 'credential']):
        return ClaudeAuthError(error_text, context={'stderr': stderr, 'exit_code': exit_code})
    
    # Rate limiting
    if any(keyword in error_lower for keyword in ['rate limit', 'too many requests', 'throttle']):
        return RateLimitError(error_text, context={'stderr': stderr, 'exit_code': exit_code})
    
    # Quota issues
    if any(keyword in error_lower for keyword in ['quota', 'usage limit', 'billing']):
        return QuotaExceededError(error_text, context={'stderr': stderr, 'exit_code': exit_code})
    
    # Network issues
    if any(keyword in error_lower for keyword in ['network', 'connection', 'timeout', 'dns']):
        return NetworkError(error_text, context={'stderr': stderr, 'exit_code': exit_code})
    
    # Model issues
    if any(keyword in error_lower for keyword in ['model', 'invalid model', 'unsupported model']):
        return InvalidModelError(error_text, context={'stderr': stderr, 'exit_code': exit_code})
    
    # CLI not found
    if any(keyword in error_lower for keyword in ['not found', 'command not found', 'no such file']):
        return ClaudeNotFoundError(error_text, context={'stderr': stderr, 'exit_code': exit_code})
    
    # Process errors
    if exit_code is not None and exit_code != 0:
        return ProcessError(error_text, exit_code=exit_code, stderr=stderr)
    
    # Default to generic error
    return ClaudeCodeError(error_text, context={'stderr': stderr, 'exit_code': exit_code})

def is_recoverable_error(error: Exception) -> bool:
    """Check if an error is potentially recoverable with retry"""
    if isinstance(error, ClaudeCodeError):
        return error.recoverable
    
    # Check for recoverable error patterns
    error_text = str(error).lower()
    recoverable_patterns = [
        'timeout', 'network', 'connection', 'temporary', 'rate limit',
        'server error', 'service unavailable', 'resource exhausted'
    ]
    
    return any(pattern in error_text for pattern in recoverable_patterns)