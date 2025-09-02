"""
Claude Code SDK - Configuration Options
Comprehensive configuration for Claude Code interactions
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Literal, Union
from pathlib import Path
import os

@dataclass
class ClaudeCodeOptions:
    """
    Configuration options for Claude Code SDK
    
    Mirrors the official Claude Code SDK options while adding integration capabilities
    """
    
    # === OFFICIAL SDK OPTIONS ===
    system_prompt: Optional[str] = None
    """System prompt to define Claude's role and behavior"""
    
    allowed_tools: List[str] = field(default_factory=list)
    """List of tools Claude is allowed to use (e.g., ['Read', 'Write', 'Bash'])"""
    
    max_turns: int = 10
    """Maximum number of conversation turns"""
    
    model: Literal["sonnet", "opus", "haiku"] = "sonnet"
    """Claude model to use"""
    
    continue_conversation: bool = True
    """Whether to maintain conversation context across turns"""
    
    # === EXECUTION OPTIONS ===
    timeout: int = 300
    """Timeout in seconds for Claude execution"""
    
    working_directory: Optional[Union[str, Path]] = None
    """Working directory for Claude execution (defaults to current directory)"""
    
    verbose: bool = False
    """Enable verbose logging output"""
    
    additional_args: List[str] = field(default_factory=list)
    """Additional CLI arguments to pass to Claude (e.g., ['--dangerously-skip-permissions'])"""
    
    # === CLI OPTIONS ===
    claude_cli_path: Optional[str] = None
    """Path to Claude CLI executable (auto-detected if not provided)"""
    
    environment: Dict[str, str] = field(default_factory=dict)
    """Additional environment variables for Claude process"""
    
    # === INTEGRATION OPTIONS (for automatic-claude-code) ===
    session_id: Optional[str] = None
    """Session ID for tracking and monitoring"""
    
    enable_monitoring: bool = True
    """Enable integration with monitoring system"""
    
    monitoring_port: Optional[int] = None
    """Port for monitoring system integration"""
    
    dual_agent_mode: bool = False
    """Enable dual-agent (Manager/Worker) mode"""
    
    agent_role: Optional[Literal["manager", "worker"]] = None
    """Role in dual-agent system"""
    
    # === STREAMING OPTIONS ===
    stream_response: bool = False
    """Enable streaming response mode"""
    
    stream_chunk_size: int = 1024
    """Size of streaming chunks in bytes"""
    
    # === RETRY & RESILIENCE ===
    max_retries: int = 3
    """Maximum number of retry attempts on failure"""
    
    retry_delay: float = 1.0
    """Base delay between retries in seconds"""
    
    exponential_backoff: bool = True
    """Use exponential backoff for retry delays"""
    
    # === PERFORMANCE OPTIONS ===
    process_pool_size: Optional[int] = None
    """Size of process pool for concurrent operations"""
    
    memory_limit_mb: Optional[int] = None
    """Memory limit in MB for Claude processes"""
    
    def __post_init__(self):
        """Validate and normalize options after initialization"""
        # Normalize working directory to Path object
        if self.working_directory:
            if isinstance(self.working_directory, str):
                self.working_directory = Path(self.working_directory).resolve()
            elif isinstance(self.working_directory, Path):
                self.working_directory = self.working_directory.resolve()
        else:
            self.working_directory = Path.cwd()
        
        # Validate model (with security sanitization for tests)
        valid_models = ["sonnet", "opus", "haiku"]
        
        # Security: Check for injection attempts in model name
        if any(char in self.model for char in [';', '&', '|', '`', '$', '(', ')', '<', '>', '"', "'"]):
            # Sanitize the model name by extracting only valid model if present
            sanitized_model = None
            for valid_model in valid_models:
                if valid_model in self.model:
                    sanitized_model = valid_model
                    break
            
            if sanitized_model:
                self.model = sanitized_model
            else:
                # Default to sonnet if no valid model found after sanitization
                self.model = "sonnet"
        
        # Final validation
        if self.model not in valid_models:
            raise ValueError(f"Invalid model: {self.model}. Must be one of: sonnet, opus, haiku")
        
        # Validate timeout
        if self.timeout <= 0:
            raise ValueError("Timeout must be positive")
        
        # Validate max_turns
        if self.max_turns <= 0:
            raise ValueError("max_turns must be positive")
        
        # Validate max_retries
        if self.max_retries < 0:
            raise ValueError("max_retries must be non-negative")
        
        # Set default monitoring port if not specified
        if self.enable_monitoring and not self.monitoring_port:
            self.monitoring_port = 6011  # Default from automatic-claude-code
        
        # Ensure environment is mutable
        if not self.environment:
            self.environment = {}
        
        # Add automatic-claude-code specific environment variables
        if self.session_id:
            self.environment['CLAUDE_SESSION_ID'] = self.session_id
        
        if self.dual_agent_mode and self.agent_role:
            self.environment['CLAUDE_AGENT_ROLE'] = self.agent_role
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert options to dictionary for serialization"""
        return {
            'system_prompt': self.system_prompt,
            'allowed_tools': self.allowed_tools,
            'max_turns': self.max_turns,
            'model': self.model,
            'continue_conversation': self.continue_conversation,
            'timeout': self.timeout,
            'working_directory': str(self.working_directory) if self.working_directory else None,
            'verbose': self.verbose,
            'claude_cli_path': self.claude_cli_path,
            'environment': self.environment,
            'session_id': self.session_id,
            'enable_monitoring': self.enable_monitoring,
            'monitoring_port': self.monitoring_port,
            'dual_agent_mode': self.dual_agent_mode,
            'agent_role': self.agent_role,
            'stream_response': self.stream_response,
            'stream_chunk_size': self.stream_chunk_size,
            'max_retries': self.max_retries,
            'retry_delay': self.retry_delay,
            'exponential_backoff': self.exponential_backoff,
            'process_pool_size': self.process_pool_size,
            'memory_limit_mb': self.memory_limit_mb
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ClaudeCodeOptions':
        """Create options from dictionary"""
        # Filter out None values and unknown keys
        valid_keys = {field.name for field in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in valid_keys and v is not None}
        return cls(**filtered_data)
    
    def copy(self, **changes) -> 'ClaudeCodeOptions':
        """Create a copy with optional changes"""
        current_dict = self.to_dict()
        current_dict.update(changes)
        return self.from_dict(current_dict)
    
    def get_cli_args(self) -> List[str]:
        """Convert options to secure Claude CLI command-line arguments"""
        args = []
        
        # Security: Sanitize all string arguments to prevent injection
        def sanitize_arg(value: str) -> str:
            """Sanitize CLI argument to prevent injection attacks"""
            if not isinstance(value, str):
                value = str(value)
            # Remove dangerous characters that could be used for injection
            dangerous_chars = [';', '&', '|', '`', '$', '(', ')', '<', '>', '"', "'", '\\']
            for char in dangerous_chars:
                value = value.replace(char, '')
            return value.strip()
        
        if self.model != "sonnet":
            args.extend(['--model', sanitize_arg(self.model)])
        
        if self.max_turns != 10:
            args.extend(['--max-turns', str(int(self.max_turns))])  # Ensure integer
        
        if self.allowed_tools:
            # Sanitize each tool name
            tools = [sanitize_arg(tool) for tool in self.allowed_tools]
            args.extend(['--allowed-tools', ','.join(tools)])
        
        if self.verbose:
            args.append('--verbose')
        
        if self.system_prompt:
            args.extend(['--system-prompt', sanitize_arg(self.system_prompt)])
        
        if not self.continue_conversation:
            args.append('--no-continue')
        
        # Add any additional arguments (e.g., --dangerously-skip-permissions)
        if self.additional_args:
            for arg in self.additional_args:
                # Security: Sanitize additional arguments too
                sanitized_arg = sanitize_arg(arg)
                if sanitized_arg:  # Only add non-empty args
                    args.append(sanitized_arg)
        
        return args
    
    def get_process_env(self) -> Dict[str, str]:
        """Get secure environment variables for Claude process"""
        # Security: Use allowlist approach for environment variables
        SAFE_ENV_VARS = {
            'PATH', 'HOME', 'USERPROFILE', 'TEMP', 'TMP', 
            'PYTHONPATH', 'ANTHROPIC_API_KEY', 'CLAUDE_CLI_PATH',
            'APPDATA', 'LOCALAPPDATA'
        }
        
        # Start with safe environment variables only
        env = {k: v for k, v in os.environ.items() if k in SAFE_ENV_VARS}
        
        # Add custom environment variables (still filtered)
        for k, v in self.environment.items():
            if k in SAFE_ENV_VARS or k.startswith('CLAUDE_'):
                env[k] = str(v)  # Ensure string values
        
        return env

# Predefined option sets for common use cases
def create_development_options(**overrides) -> ClaudeCodeOptions:
    """Create options optimized for development work"""
    defaults = {
        'verbose': True,
        'allowed_tools': ['Read', 'Write', 'Edit', 'Bash', 'MultiEdit'],
        'max_turns': 20,
        'timeout': 600,  # 10 minutes
        'max_retries': 2
    }
    defaults.update(overrides)
    return ClaudeCodeOptions(**defaults)

def create_production_options(**overrides) -> ClaudeCodeOptions:
    """Create options optimized for production use"""
    defaults = {
        'verbose': False,
        'allowed_tools': ['Read', 'Write'],
        'max_turns': 5,
        'timeout': 120,  # 2 minutes
        'max_retries': 3,
        'exponential_backoff': True
    }
    defaults.update(overrides)
    return ClaudeCodeOptions(**defaults)

def create_dual_agent_options(agent_role: Literal["manager", "worker"], **overrides) -> ClaudeCodeOptions:
    """Create options for dual-agent mode"""
    defaults = {
        'dual_agent_mode': True,
        'agent_role': agent_role,
        'enable_monitoring': True,
        'max_turns': 15 if agent_role == 'manager' else 10,
        'allowed_tools': ['Task', 'TodoWrite'] if agent_role == 'manager' else ['Read', 'Write', 'Edit', 'Bash']
    }
    defaults.update(overrides)
    return ClaudeCodeOptions(**defaults)

def create_streaming_options(**overrides) -> ClaudeCodeOptions:
    """Create options optimized for streaming responses"""
    defaults = {
        'stream_response': True,
        'stream_chunk_size': 512,
        'timeout': 300
    }
    defaults.update(overrides)
    return ClaudeCodeOptions(**defaults)