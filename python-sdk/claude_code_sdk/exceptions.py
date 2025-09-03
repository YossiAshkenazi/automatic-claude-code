"""
Claude Code SDK Exceptions
"""

class ClaudeCodeError(Exception):
    """Base exception for Claude Code SDK errors"""
    def __init__(self, message: str, exit_code: int = None, stderr: str = None):
        super().__init__(message)
        self.exit_code = exit_code
        self.stderr = stderr

class ClaudeTimeoutError(ClaudeCodeError):
    """Raised when Claude Code execution times out"""
    pass

class ClaudeAuthError(ClaudeCodeError):
    """Raised when there are authentication issues with Claude"""
    pass

class ClaudeNotFoundError(ClaudeCodeError):
    """Raised when Claude CLI is not found or not accessible"""
    pass

class ClaudeConfigError(ClaudeCodeError):
    """Raised when there are configuration issues"""
    pass