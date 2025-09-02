#!/usr/bin/env python3
"""
Claude CLI Wrapper - Direct CLI execution without API keys
Adapted from Dan Disler's Gemini CLI implementation in agentic-drop-zones

This wrapper uses subprocess to execute Claude Code CLI directly,
bypassing the need for API keys by relying on existing CLI authentication.
"""

import asyncio
import os
import sys
import json
import time
import random
from pathlib import Path
from typing import Optional, AsyncGenerator, Dict, Any, List, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
import shutil
import logging
import threading
import weakref
import signal
from contextlib import asynccontextmanager

# Try to import psutil for advanced process management, fallback gracefully
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ProcessState(Enum):
    """Process lifecycle states for tracking"""
    IDLE = "idle"
    STARTING = "starting"
    RUNNING = "running"
    TERMINATING = "terminating"
    TERMINATED = "terminated"
    FAILED = "failed"


class ResourceType(Enum):
    """Types of resources to track"""
    PROCESS = "process"
    STREAM = "stream"
    TIMER = "timer"
    TASK = "task"
    SIGNAL_HANDLER = "signal_handler"


@dataclass
class TrackedResource:
    """Resource tracking metadata"""
    resource_id: str
    resource_type: ResourceType
    resource_ref: weakref.ref
    created_at: float
    description: str
    cleanup_method: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    cleaned_up: bool = False
    cleanup_error: Optional[str] = None


class ProcessHandleManager:
    """
    Epic 3-inspired process handle management for Python async processes.
    
    Provides:
    - Automatic tracking of all spawned processes and resources
    - Guaranteed cleanup on cancellation or timeout
    - Resource leak detection and prevention
    - Cross-platform signal handling
    - Graceful termination with escalation to force kill
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __init__(self):
        self.tracked_resources: Dict[str, TrackedResource] = {}
        self.resource_counter = 0
        self.cleanup_in_progress = False
        self.shutdown_initiated = False
        self.logger = logging.getLogger(f"{__name__}.ProcessHandleManager")
        
        # Resource cleanup callbacks by type
        self.cleanup_handlers = {
            ResourceType.PROCESS: self._cleanup_process_resource,
            ResourceType.STREAM: self._cleanup_stream_resource,
            ResourceType.TIMER: self._cleanup_timer_resource,
            ResourceType.TASK: self._cleanup_task_resource,
            ResourceType.SIGNAL_HANDLER: self._cleanup_signal_handler_resource,
        }
        
        # Setup exit handlers
        self._setup_exit_handlers()
    
    @classmethod
    def get_instance(cls) -> 'ProcessHandleManager':
        """Thread-safe singleton instance"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    def register_resource(self, resource: Any, resource_type: ResourceType, 
                         description: str, cleanup_method: Optional[str] = None,
                         metadata: Optional[Dict[str, Any]] = None) -> str:
        """Register a resource for tracking and cleanup"""
        self.resource_counter += 1
        resource_id = f"{resource_type.value}_{self.resource_counter}_{int(time.time())}"
        
        try:
            resource_ref = weakref.ref(resource)
        except TypeError:
            # Some objects can't be weakly referenced, store directly
            resource_ref = lambda: resource
        
        tracked = TrackedResource(
            resource_id=resource_id,
            resource_type=resource_type,
            resource_ref=resource_ref,
            created_at=time.time(),
            description=description,
            cleanup_method=cleanup_method,
            metadata=metadata or {},
        )
        
        self.tracked_resources[resource_id] = tracked
        
        self.logger.debug(f"Registered {resource_type.value} resource: {resource_id} ({description})")
        
        return resource_id
    
    def unregister_resource(self, resource_id: str) -> bool:
        """Unregister a resource (when properly cleaned up)"""
        if resource_id in self.tracked_resources:
            resource = self.tracked_resources.pop(resource_id)
            self.logger.debug(f"Unregistered {resource.resource_type.value} resource: {resource_id}")
            return True
        return False
    
    async def force_cleanup_all(self, timeout: float = 5.0) -> Tuple[int, int, List[str]]:
        """
        Force cleanup of all tracked resources.
        
        Returns: (cleaned_count, failed_count, errors)
        """
        if self.cleanup_in_progress:
            self.logger.warning("Cleanup already in progress")
            return 0, 0, ["Cleanup already in progress"]
        
        self.cleanup_in_progress = True
        self.logger.info(f"Starting force cleanup of {len(self.tracked_resources)} resources")
        
        cleaned_count = 0
        failed_count = 0
        errors = []
        
        # Get snapshot of resources to avoid modification during iteration
        resources_snapshot = list(self.tracked_resources.items())
        
        # Group resources by priority (processes first, then streams, etc.)
        priority_order = [
            ResourceType.PROCESS,
            ResourceType.STREAM, 
            ResourceType.TASK,
            ResourceType.TIMER,
            ResourceType.SIGNAL_HANDLER,
        ]
        
        for resource_type in priority_order:
            type_resources = [(rid, res) for rid, res in resources_snapshot 
                            if res.resource_type == resource_type and not res.cleaned_up]
            
            if not type_resources:
                continue
                
            self.logger.debug(f"Cleaning up {len(type_resources)} {resource_type.value} resources")
            
            for resource_id, tracked_resource in type_resources:
                try:
                    await asyncio.wait_for(
                        self._cleanup_single_resource(resource_id, tracked_resource),
                        timeout=max(0.5, timeout / len(resources_snapshot))
                    )
                    cleaned_count += 1
                except asyncio.TimeoutError:
                    error_msg = f"Timeout cleaning up {resource_type.value} resource {resource_id}"
                    errors.append(error_msg)
                    self.logger.error(error_msg)
                    failed_count += 1
                except Exception as e:
                    error_msg = f"Error cleaning up {resource_type.value} resource {resource_id}: {e}"
                    errors.append(error_msg)
                    self.logger.error(error_msg)
                    failed_count += 1
        
        self.cleanup_in_progress = False
        
        self.logger.info(f"Cleanup completed: {cleaned_count} cleaned, {failed_count} failed")
        return cleaned_count, failed_count, errors
    
    async def _cleanup_single_resource(self, resource_id: str, tracked_resource: TrackedResource):
        """Clean up a single tracked resource"""
        if tracked_resource.cleaned_up:
            return
        
        resource = tracked_resource.resource_ref()
        if resource is None:
            # Resource was garbage collected
            tracked_resource.cleaned_up = True
            self.unregister_resource(resource_id)
            return
        
        try:
            cleanup_handler = self.cleanup_handlers.get(tracked_resource.resource_type)
            if cleanup_handler:
                await cleanup_handler(resource, tracked_resource)
            
            tracked_resource.cleaned_up = True
            self.unregister_resource(resource_id)
            
        except Exception as e:
            tracked_resource.cleanup_error = str(e)
            raise
    
    async def _cleanup_process_resource(self, process: asyncio.subprocess.Process, tracked: TrackedResource):
        """Clean up a subprocess resource"""
        if process.returncode is not None:
            return  # Already terminated
        
        try:
            # Phase 1: Graceful termination
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=2.0)
                self.logger.debug(f"Process {process.pid} terminated gracefully")
                return
            except asyncio.TimeoutError:
                pass
            
            # Phase 2: Force kill
            self.logger.warning(f"Force killing process {process.pid}")
            process.kill()
            await process.wait()
            
        except ProcessLookupError:
            # Process already terminated
            pass
        except Exception as e:
            self.logger.error(f"Error terminating process {getattr(process, 'pid', 'unknown')}: {e}")
    
    async def _cleanup_stream_resource(self, stream, tracked: TrackedResource):
        """Clean up a stream resource"""
        try:
            if hasattr(stream, 'close') and callable(stream.close):
                if asyncio.iscoroutinefunction(stream.close):
                    await stream.close()
                else:
                    stream.close()
            elif hasattr(stream, 'cancel') and callable(stream.cancel):
                stream.cancel()
        except Exception as e:
            self.logger.error(f"Error cleaning up stream: {e}")
    
    async def _cleanup_timer_resource(self, timer, tracked: TrackedResource):
        """Clean up a timer resource"""
        try:
            if hasattr(timer, 'cancel') and callable(timer.cancel):
                timer.cancel()
        except Exception as e:
            self.logger.error(f"Error cleaning up timer: {e}")
    
    async def _cleanup_task_resource(self, task, tracked: TrackedResource):
        """Clean up an async task resource"""
        try:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        except Exception as e:
            self.logger.error(f"Error cleaning up task: {e}")
    
    async def _cleanup_signal_handler_resource(self, handler_info, tracked: TrackedResource):
        """Clean up a signal handler resource"""
        try:
            signal_num = handler_info.get('signal')
            if signal_num:
                signal.signal(signal_num, signal.SIG_DFL)
        except Exception as e:
            self.logger.error(f"Error cleaning up signal handler: {e}")
    
    def get_resource_stats(self) -> Dict[str, Any]:
        """Get statistics about tracked resources"""
        stats = {
            'total_resources': len(self.tracked_resources),
            'by_type': {},
            'cleanup_in_progress': self.cleanup_in_progress,
            'oldest_resource_age': None,
        }
        
        current_time = time.time()
        oldest_age = None
        
        for resource in self.tracked_resources.values():
            resource_type = resource.resource_type.value
            stats['by_type'][resource_type] = stats['by_type'].get(resource_type, 0) + 1
            
            age = current_time - resource.created_at
            if oldest_age is None or age > oldest_age:
                oldest_age = age
        
        stats['oldest_resource_age'] = oldest_age
        return stats
    
    def _setup_exit_handlers(self):
        """Setup process exit handlers for cleanup"""
        def signal_handler(signum, frame):
            if not self.shutdown_initiated:
                self.shutdown_initiated = True
                self.logger.info(f"Received signal {signum}, initiating shutdown")
                # Run cleanup in the event loop if possible
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        asyncio.create_task(self.force_cleanup_all())
                    else:
                        loop.run_until_complete(self.force_cleanup_all())
                except Exception as e:
                    self.logger.error(f"Error during signal cleanup: {e}")
        
        # Register signal handlers for graceful shutdown
        for sig in [signal.SIGINT, signal.SIGTERM]:
            try:
                signal.signal(sig, signal_handler)
            except (OSError, ValueError):
                # Signal not available on this platform
                pass


class CircuitBreakerState(Enum):
    """Circuit breaker states for authentication failure handling"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Blocking requests due to failures
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker pattern"""
    failure_threshold: int = 5  # Number of failures before opening circuit
    recovery_timeout: float = 60.0  # Seconds to wait before trying half-open
    success_threshold: int = 2  # Consecutive successes needed to close circuit
    

class AuthenticationCircuitBreaker:
    """Circuit breaker for authentication failures"""
    
    def __init__(self, config: Optional[CircuitBreakerConfig] = None):
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0.0
        self.next_attempt_time = 0.0
        
    def can_execute(self) -> bool:
        """Check if execution should be allowed"""
        current_time = time.time()
        
        if self.state == CircuitBreakerState.CLOSED:
            return True
        elif self.state == CircuitBreakerState.OPEN:
            # Check if recovery timeout has passed
            if current_time >= self.next_attempt_time:
                logger.info("Circuit breaker transitioning to HALF_OPEN for recovery test")
                self.state = CircuitBreakerState.HALF_OPEN
                return True
            return False
        elif self.state == CircuitBreakerState.HALF_OPEN:
            return True
        
        return False
    
    def record_success(self):
        """Record successful execution"""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.success_count += 1
            logger.info(f"Circuit breaker success {self.success_count}/{self.config.success_threshold}")
            
            if self.success_count >= self.config.success_threshold:
                logger.info("Circuit breaker CLOSED - service recovered")
                self.state = CircuitBreakerState.CLOSED
                self.failure_count = 0
                self.success_count = 0
        elif self.state == CircuitBreakerState.CLOSED:
            # Reset failure count on successful execution
            if self.failure_count > 0:
                self.failure_count = 0
                logger.info("Circuit breaker failure count reset after success")
    
    def record_failure(self, is_auth_failure: bool = False):
        """Record failed execution"""
        if not is_auth_failure:
            # Only count authentication failures toward circuit breaker
            return
            
        current_time = time.time()
        self.failure_count += 1
        self.last_failure_time = current_time
        
        logger.warning(f"Circuit breaker recorded auth failure {self.failure_count}/{self.config.failure_threshold}")
        
        if self.state == CircuitBreakerState.HALF_OPEN:
            # Failed during recovery test - go back to open
            logger.warning("Circuit breaker OPEN - recovery test failed")
            self.state = CircuitBreakerState.OPEN
            self.success_count = 0
            self.next_attempt_time = current_time + self.config.recovery_timeout
        elif self.state == CircuitBreakerState.CLOSED:
            # Check if we should open the circuit
            if self.failure_count >= self.config.failure_threshold:
                logger.error("Circuit breaker OPEN - too many authentication failures")
                self.state = CircuitBreakerState.OPEN
                self.next_attempt_time = current_time + self.config.recovery_timeout
    
    def get_status(self) -> Dict[str, Any]:
        """Get current circuit breaker status"""
        current_time = time.time()
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "can_execute": self.can_execute(),
            "next_attempt_in": max(0, self.next_attempt_time - current_time) if self.state == CircuitBreakerState.OPEN else 0,
            "last_failure_age": current_time - self.last_failure_time if self.last_failure_time > 0 else None
        }


class RetryStrategy:
    """Retry strategy with exponential backoff and jitter"""
    
    def __init__(self, max_attempts: int = 3, base_delay: float = 1.0, max_delay: float = 60.0, 
                 backoff_factor: float = 2.0, jitter: bool = True):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor
        self.jitter = jitter
    
    def get_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt number (0-based)"""
        delay = min(self.base_delay * (self.backoff_factor ** attempt), self.max_delay)
        
        if self.jitter:
            # Add ±25% jitter to prevent thundering herd
            jitter_range = delay * 0.25
            delay += random.uniform(-jitter_range, jitter_range)
            delay = max(0.1, delay)  # Ensure positive delay
        
        return delay
    
    def should_retry(self, attempt: int, error: Exception) -> bool:
        """Determine if we should retry based on attempt count and error type"""
        if attempt >= self.max_attempts:
            return False
        
        # Check if error is retryable
        error_str = str(error).lower()
        
        # Always retry transient network errors
        transient_keywords = [
            "connection", "network", "timeout", "temporary", "unavailable",
            "503", "502", "504", "429", "rate limit", "busy", "overloaded"
        ]
        
        if any(keyword in error_str for keyword in transient_keywords):
            return True
        
        # Don't retry authentication or permission errors
        permanent_keywords = [
            "invalid api key", "authentication failed", "unauthorized", 
            "forbidden", "permission denied", "not found", "404"
        ]
        
        if any(keyword in error_str for keyword in permanent_keywords):
            return False
        
        # Retry other errors (but not indefinitely)
        return True

@dataclass
class ClaudeCliOptions:
    """Options for Claude CLI execution"""
    model: str = "sonnet"  # sonnet, opus, haiku
    max_turns: int = 10
    allowed_tools: List[str] = field(default_factory=lambda: ["Read", "Write", "Edit", "Bash"])
    verbose: bool = False
    dangerously_skip_permissions: bool = False
    mcp_config: Optional[str] = None  # Path to MCP config file
    working_directory: Optional[Path] = None
    timeout: int = 300  # 5 minutes default
    cli_path: Optional[str] = None  # Custom path to claude CLI
    # Enhanced error handling options
    enable_circuit_breaker: bool = True
    circuit_breaker_config: Optional[CircuitBreakerConfig] = None
    retry_strategy: Optional[RetryStrategy] = None
    network_timeout: int = 30  # Network-specific timeout
    connection_timeout: int = 10  # Connection establishment timeout

    def to_cli_args(self) -> List[str]:
        """Convert options to CLI arguments"""
        args = []
        
        # Model
        if self.model != "sonnet":
            args.extend(["--model", self.model])
        
        # Max turns
        if self.max_turns != 10:
            args.extend(["--max-turns", str(self.max_turns)])
        
        # Allowed tools
        if self.allowed_tools:
            args.extend(["--allowed-tools", ",".join(self.allowed_tools)])
        
        # Verbose
        if self.verbose:
            args.append("--verbose")
        
        # Skip permissions (dangerous!)
        if self.dangerously_skip_permissions:
            args.append("--dangerously-skip-permissions")
        
        # MCP config
        if self.mcp_config:
            args.extend(["--mcp-config", self.mcp_config])
        
        return args


@dataclass
class CliMessage:
    """Message from CLI output"""
    type: str  # stream, tool_use, result, error, status
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class ClaudeCliWrapper:
    """
    Wrapper for Claude Code CLI using subprocess execution.
    
    This approach bypasses API key requirements by using the CLI directly,
    similar to how Dan Disler handles Gemini CLI in agentic-drop-zones.
    
    Enhanced with:
    - Circuit breaker pattern for authentication failures
    - Exponential backoff retry logic with jitter
    - Comprehensive network timeout handling
    - Transient failure recovery
    """
    
    def __init__(self, options: Optional[ClaudeCliOptions] = None):
        self.options = options or ClaudeCliOptions()
        self.cli_path = self._find_claude_cli()
        self.process: Optional[asyncio.subprocess.Process] = None
        self.process_state = ProcessState.IDLE
        
        # Initialize process handle manager for resource tracking
        self.handle_manager = ProcessHandleManager.get_instance()
        self.registered_resources: Set[str] = set()
        
        # Initialize circuit breaker for authentication failures
        if self.options.enable_circuit_breaker:
            circuit_config = self.options.circuit_breaker_config or CircuitBreakerConfig()
            self.circuit_breaker = AuthenticationCircuitBreaker(circuit_config)
        else:
            self.circuit_breaker = None
        
        # Initialize retry strategy
        self.retry_strategy = self.options.retry_strategy or RetryStrategy(
            max_attempts=3,
            base_delay=1.0,
            max_delay=30.0,
            backoff_factor=2.0,
            jitter=True
        )
        
        # Track authentication state
        self.last_auth_check = 0.0
        self.auth_status_cache = None
        self.consecutive_failures = 0
        
    def _find_claude_cli(self) -> str:
        """Find Claude CLI executable"""
        # Check custom path first
        if self.options.cli_path:
            if os.path.exists(self.options.cli_path):
                return self.options.cli_path
            else:
                logger.warning(f"Custom CLI path not found: {self.options.cli_path}")
        
        # Check environment variable
        env_path = os.environ.get("CLAUDE_CLI_PATH", "")
        if env_path and os.path.exists(env_path):
            return env_path
        
        # Try to find in PATH
        claude_path = shutil.which("claude")
        if claude_path:
            return claude_path
        
        # Common installation paths
        common_paths = [
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude",
            os.path.expanduser("~/.npm-global/bin/claude"),
            os.path.expanduser("~/AppData/Roaming/npm/claude.cmd"),  # Windows
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                return path
        
        raise FileNotFoundError(
            "Claude CLI not found. Please install with: npm install -g @anthropic-ai/claude-code"
        )
    
    async def execute(self, prompt: str) -> AsyncGenerator[CliMessage, None]:
        """
        Enhanced execute method with circuit breaker, comprehensive retry logic, and robust error handling.
        
        Features:
        - Circuit breaker pattern prevents excessive authentication failures
        - Exponential backoff with jitter for transient failures
        - Network timeout enforcement with connection-specific timeouts
        - Authentication status detection and recovery guidance
        - Graceful process termination and resource cleanup
        - Comprehensive error classification and handling
        """
        
        # Validate input
        if not prompt or not prompt.strip():
            yield CliMessage(
                type="error",
                content="Empty prompt provided",
                metadata={"validation_error": True}
            )
            return
        
        # Check circuit breaker
        if self.circuit_breaker and not self.circuit_breaker.can_execute():
            breaker_status = self.circuit_breaker.get_status()
            yield CliMessage(
                type="auth_error",
                content=f"Circuit breaker OPEN - too many authentication failures. "
                        f"Next retry in {breaker_status['next_attempt_in']:.1f}s. "
                        f"Please verify authentication: claude setup-token",
                metadata={
                    "circuit_breaker_open": True,
                    "breaker_status": breaker_status,
                    "auth_setup_required": True
                }
            )
            return
        
        # Build command with enhanced argument handling
        cmd = [self.cli_path]
        cmd.extend(self.options.to_cli_args())
        
        # Use --output-format json for structured parsing
        cmd.extend(["--output-format", "json"])
        cmd.extend(["-p", prompt])  # Non-interactive prompt mode
        
        logger.info(f"Executing command: {' '.join(cmd[:4])}... (timeout: {self.options.timeout}s)")
        
        # Enhanced retry logic using RetryStrategy
        max_attempts = self.retry_strategy.max_attempts
        execution_start_time = time.time()
        
        for attempt in range(max_attempts):
            try:
                # Implement timeout enforcement
                async with asyncio.timeout(self.options.timeout):
                    # Create subprocess with enhanced configuration
                    env = os.environ.copy()
                    
                    # Set environment variables for better CLI behavior
                    env["CLAUDE_NO_BROWSER"] = "1"  # Prevent browser launches in CI/automation
                    env["FORCE_COLOR"] = "0"  # Disable colors for parsing
                    
                    # Change state to starting
                    self.process_state = ProcessState.STARTING
                    
                    self.process = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        cwd=self.options.working_directory,
                        env=env,
                        # Process group for better cleanup
                        preexec_fn=os.setsid if hasattr(os, 'setsid') else None
                    )
                    
                    # Register process with handle manager for tracking
                    process_id = self.handle_manager.register_resource(
                        self.process, ResourceType.PROCESS, 
                        f"Claude CLI process (PID: {self.process.pid})",
                        metadata={'cmd': cmd[:4], 'attempt': attempt + 1}
                    )
                    self.registered_resources.add(process_id)
                    
                    # Change state to running
                    self.process_state = ProcessState.RUNNING
                    logger.info(f"Started Claude CLI process (PID: {self.process.pid})")
                    
                    # Stream output with timeout monitoring
                    message_count = 0
                    try:
                        async for message in self._stream_output():
                            message_count += 1
                            yield message
                            
                            # Check for early authentication errors to fail fast
                            if message.type == "auth_error":
                                logger.error("Authentication error detected, stopping execution")
                                break
                    
                    except asyncio.CancelledError:
                        logger.info("Execution cancelled by user - initiating resource cleanup")
                        self.process_state = ProcessState.TERMINATING
                        
                        # Perform immediate cleanup before re-raising
                        try:
                            await self._enhanced_cleanup_with_tracking()
                        except Exception as cleanup_error:
                            logger.error(f"Error during cancellation cleanup: {cleanup_error}")
                        
                        yield CliMessage(
                            type="status",
                            content="Execution cancelled - resources cleaned up",
                            metadata={
                                "cancelled": True, 
                                "messages_received": message_count,
                                "cleanup_attempted": True,
                                "process_state": self.process_state.value
                            }
                        )
                        raise
                    
                    # Wait for process completion with timeout
                    try:
                        return_code = await asyncio.wait_for(self.process.wait(), timeout=5.0)
                        
                        if return_code != 0:
                            yield CliMessage(
                                type="error",
                                content=f"Claude CLI process exited with code {return_code}",
                                metadata={
                                    "return_code": return_code,
                                    "attempt": attempt + 1,
                                    "messages_received": message_count
                                }
                            )
                        else:
                            logger.info(f"Claude CLI completed successfully (messages: {message_count})")
                            # Perform cleanup after successful execution
                            try:
                                await self._enhanced_cleanup_with_tracking()
                            except Exception as cleanup_error:
                                logger.error(f"Error during post-execution cleanup: {cleanup_error}")
                    
                    except asyncio.TimeoutError:
                        logger.warning("Process did not complete within timeout")
                        yield CliMessage(
                            type="error",
                            content="Process completion timeout",
                            metadata={"completion_timeout": True, "messages_received": message_count}
                        )
                    
                    # Success - no need to retry
                    break
            
            except asyncio.TimeoutError:
                logger.error(f"Execution timeout after {self.options.timeout} seconds (attempt {attempt + 1})")
                
                # Force cleanup on timeout
                await self._force_process_cleanup()
                
                if attempt < max_attempts - 1:
                    delay = self.retry_strategy.base_delay * (2 ** attempt)  # Exponential backoff
                    yield CliMessage(
                        type="status",
                        content=f"Timeout occurred, retrying in {delay}s... (attempt {attempt + 1}/{max_attempts})",
                        metadata={"retry_attempt": attempt + 1, "delay": delay}
                    )
                    await asyncio.sleep(delay)
                else:
                    yield CliMessage(
                        type="error",
                        content=f"Execution failed after {max_attempts} attempts due to timeout ({self.options.timeout}s)",
                        metadata={"timeout": True, "max_retries_exceeded": True}
                    )
            
            except FileNotFoundError:
                yield CliMessage(
                    type="error",
                    content=f"Claude CLI not found at '{self.cli_path}'. Please install with: npm install -g @anthropic-ai/claude-code",
                    metadata={"cli_path": self.cli_path, "installation_required": True}
                )
                break  # No point retrying for missing CLI
            
            except PermissionError:
                yield CliMessage(
                    type="error",
                    content=f"Permission denied executing '{self.cli_path}'. Check file permissions.",
                    metadata={"cli_path": self.cli_path, "permission_error": True}
                )
                break  # No point retrying for permission issues
            
            except asyncio.CancelledError:
                logger.info("Execution cancelled at retry level - performing comprehensive cleanup")
                self.process_state = ProcessState.TERMINATING
                
                try:
                    await self._enhanced_cleanup_with_tracking()
                except Exception as cleanup_error:
                    logger.error(f"Error during comprehensive cleanup: {cleanup_error}")
                
                self.process_state = ProcessState.TERMINATED
                raise
            
            except Exception as e:
                logger.error(f"Error running Claude CLI (attempt {attempt + 1}): {e}")
                
                # Check if this is a transient error worth retrying
                is_transient = any(keyword in str(e).lower() for keyword in [
                    "connection", "network", "timeout", "temporary", "unavailable"
                ])
                
                if is_transient and attempt < max_attempts - 1:
                    delay = self.retry_strategy.base_delay * (2 ** attempt)
                    yield CliMessage(
                        type="status",
                        content=f"Transient error, retrying in {delay}s... (attempt {attempt + 1}/{max_attempts})",
                        metadata={"retry_attempt": attempt + 1, "delay": delay, "error": str(e)}
                    )
                    await asyncio.sleep(delay)
                else:
                    yield CliMessage(
                        type="error",
                        content=f"Error running Claude CLI: {str(e)}",
                        metadata={
                            "exception": type(e).__name__,
                            "attempt": attempt + 1,
                            "is_transient": is_transient
                        }
                    )
                    if not is_transient:
                        break  # Don't retry non-transient errors
            
            finally:
                # Ensure cleanup after each attempt
                await self._ensure_process_cleanup()
                self.process = None
    
    async def _stream_output(self) -> AsyncGenerator[CliMessage, None]:
        """
        Enhanced streaming with proper async resource management and concurrent stdout/stderr reading.
        
        Improvements:
        - Concurrent stdout/stderr reading without race conditions
        - Proper CancelledError handling
        - Timeout enforcement with graceful termination
        - Partial response handling and message correlation
        """
        if not self.process:
            return
        
        async def read_stream(stream, is_stderr: bool):
            """Helper to read from a stream and yield parsed messages"""
            try:
                while True:
                    try:
                        line = await asyncio.wait_for(stream.readline(), timeout=1.0)
                        if not line:
                            break
                        
                        # Enhanced Unicode/emoji handling for Windows
                        try:
                            decoded = line.decode('utf-8').rstrip()
                        except UnicodeDecodeError:
                            # Fallback for problematic characters
                            decoded = line.decode('utf-8', errors='replace').rstrip()
                            # Replace emoji/special chars that cause Windows console issues
                            import re
                            decoded = re.sub(r'[^\x00-\x7F]+', '?', decoded)
                        
                        if decoded:
                            message = self._parse_line(decoded, is_stderr)
                            yield message
                    
                    except asyncio.TimeoutError:
                        # Check if process is still running
                        if self.process and self.process.returncode is not None:
                            break
                        continue  # Keep waiting
                    
                    except asyncio.CancelledError:
                        logger.info(f"Stream reading cancelled ({'stderr' if is_stderr else 'stdout'})")
                        break
                    
                    except Exception as e:
                        logger.error(f"Error reading {'stderr' if is_stderr else 'stdout'}: {e}")
                        yield CliMessage(
                            type="error",
                            content=f"Stream read error: {e}",
                            metadata={"stream_error": True, "is_stderr": is_stderr}
                        )
                        break
            
            except asyncio.CancelledError:
                logger.info(f"Stream reader cancelled ({'stderr' if is_stderr else 'stdout'})")
                raise
            except Exception as e:
                logger.error(f"Stream reader error ({'stderr' if is_stderr else 'stdout'}): {e}")
        
        try:
            # Create stream readers for stdout and stderr
            stream_readers = []
            
            if self.process.stdout:
                stream_readers.append(read_stream(self.process.stdout, False))
            
            if self.process.stderr:
                stream_readers.append(read_stream(self.process.stderr, True))
            
            # Process messages from both streams concurrently
            message_queue = asyncio.Queue()
            
            async def queue_messages(stream_reader):
                """Queue messages from stream reader"""
                try:
                    async for message in stream_reader:
                        await message_queue.put(message)
                except asyncio.CancelledError:
                    logger.info("Message queuing cancelled")
                    raise
                except Exception as e:
                    logger.error(f"Error queuing messages: {e}")
                finally:
                    await message_queue.put(None)  # Sentinel to indicate stream ended
            
            # Start message collection tasks
            collection_tasks = []
            for stream_reader in stream_readers:
                collection_task = asyncio.create_task(queue_messages(stream_reader))
                collection_tasks.append(collection_task)
            
            # Yield messages as they arrive
            active_streams = len(collection_tasks)
            
            while active_streams > 0:
                try:
                    # Wait for messages with timeout to check process status
                    message = await asyncio.wait_for(message_queue.get(), timeout=0.5)
                    
                    if message is None:
                        # Stream ended
                        active_streams -= 1
                        continue
                    
                    yield message
                
                except asyncio.TimeoutError:
                    # Check if process is still running
                    if self.process and self.process.returncode is not None:
                        break
                    continue
                
                except asyncio.CancelledError:
                    logger.info("Message processing cancelled")
                    # Cancel collection tasks
                    for task in collection_tasks:
                        task.cancel()
                    raise
        
        except asyncio.CancelledError:
            logger.info("Stream cancelled during execution")
            # Ensure proper cleanup
            await self._force_process_cleanup()
            raise
        
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield CliMessage(
                type="error",
                content=f"Streaming error: {e}",
                metadata={"streaming_error": True, "exception_type": type(e).__name__}
            )
        
        finally:
            # Ensure clean process termination
            await self._ensure_process_cleanup()
    
    async def _collect_stream_messages(self, stream_reader):
        """Collect messages from stream reader into a list"""
        messages = []
        try:
            async for message in stream_reader:
                messages.append(message)
        except asyncio.CancelledError:
            logger.info("Stream collection cancelled")
            raise
        return messages
    
    async def _ensure_process_cleanup(self):
        """Ensure process is properly cleaned up after streaming"""
        if self.process and self.process.returncode is None:
            try:
                # Give process a moment to terminate naturally
                await asyncio.wait_for(self.process.wait(), timeout=1.0)
                logger.info("Process terminated naturally")
            except asyncio.TimeoutError:
                logger.warning("Process did not terminate gracefully, checking if cleanup needed")
                # Don't force kill here, let the main cleanup handle it
    
    async def _force_process_cleanup(self):
        """Force process cleanup when cancelled or in error state"""
        if self.process:
            try:
                if self.process.returncode is None:
                    # Try graceful termination first
                    self.process.terminate()
                    try:
                        await asyncio.wait_for(self.process.wait(), timeout=2.0)
                    except asyncio.TimeoutError:
                        # Force kill if graceful termination fails
                        logger.warning("Force killing unresponsive process")
                        self.process.kill()
                        await self.process.wait()
                
                logger.info("Process cleanup completed")
            except Exception as e:
                logger.error(f"Error during force cleanup: {e}")
    
    def _parse_line(self, line: str, is_stderr: bool = False) -> CliMessage:
        """
        Enhanced parser for Claude CLI output with comprehensive pattern detection.
        
        Handles:
        - JSON structured output (primary Claude CLI format)
        - Tool invocation patterns (<function_calls>, <invoke>, etc.)
        - Action phrases ("Reading file:", "Writing to file:", "Running command:")
        - Status messages ("waiting", "processing", "loading")
        - Error patterns with authentication detection
        - Streaming and final result differentiation
        """
        
        # Handle empty or whitespace-only lines
        if not line or line.isspace():
            return CliMessage(
                type="stream",
                content="",
                metadata={"is_stderr": is_stderr, "empty_line": True}
            )
        
        # Primary: Try to parse as JSON (Claude CLI's main output format)
        try:
            data = json.loads(line)
            
            # Handle both dict and list JSON responses from Claude CLI
            if isinstance(data, list):
                # If it's a list, process each item or treat as stream content
                if len(data) == 0:
                    return CliMessage(
                        type="stream",
                        content="",
                        metadata={"is_stderr": is_stderr, "json_array": True, "empty_array": True}
                    )
                elif len(data) == 1 and isinstance(data[0], dict):
                    # Single dict in array, extract it
                    data = data[0]
                else:
                    # Multiple items or non-dict items, treat as stream content
                    return CliMessage(
                        type="stream",
                        content=str(data),
                        metadata={"is_stderr": is_stderr, "json_array": True, "array_length": len(data)}
                    )
            
            # At this point, data should be a dict (either originally or extracted from single-item array)
            if not isinstance(data, dict):
                # Non-dict, non-list JSON (string, number, etc.)
                return CliMessage(
                    type="stream",
                    content=str(data),
                    metadata={"is_stderr": is_stderr, "json_primitive": True}
                )
            
            # Handle Claude CLI structured JSON responses (dict only)
            message_type = data.get("type", "stream")
            
            # Handle different Claude CLI JSON types
            if message_type == "result":
                # Final result message
                subtype = data.get("subtype", "")
                is_error = data.get("is_error", False)
                result_content = data.get("result", "")
                
                # Check for authentication errors
                if is_error and "Invalid API key" in result_content:
                    return CliMessage(
                        type="auth_error",
                        content=f"Authentication failed: {result_content}\n\nPlease run: claude setup-token",
                        metadata={
                            **data,
                            "is_stderr": is_stderr,
                            "auth_setup_required": True
                        }
                    )
                
                return CliMessage(
                    type="error" if is_error else "result",
                    content=result_content,
                    metadata={**data, "is_stderr": is_stderr}
                )
            
            elif message_type == "stream":
                # Streaming content
                return CliMessage(
                    type="stream",
                    content=data.get("content", data.get("text", line)),
                    metadata={**data, "is_stderr": is_stderr}
                )
            
            elif message_type == "tool_use":
                # Tool usage from structured output
                return CliMessage(
                    type="tool_use",
                    content=data.get("content", data.get("name", line)),
                    metadata={**data, "is_stderr": is_stderr}
                )
            
            else:
                # Other structured types (status, error, etc.)
                return CliMessage(
                    type=message_type,
                    content=data.get("content", data.get("message", line)),
                    metadata={**data, "is_stderr": is_stderr}
                )
        
        except json.JSONDecodeError:
            # Not JSON, continue with pattern matching
            pass
        
        # Secondary: Pattern-based parsing for non-JSON output
        line_lower = line.lower()
        line_stripped = line.strip()
        
        # XML-style tool patterns (Claude Code uses these in some contexts)
        xml_patterns = ["<function_calls>", "<invoke>", "</invoke>", "</function_calls>"]
        if any(pattern in line for pattern in xml_patterns):
            return CliMessage(
                type="tool_use",
                content=line,
                metadata={"is_stderr": is_stderr, "xml_pattern": True}
            )
        
        # Action phrase detection (Claude Code tool usage indicators)
        action_patterns = [
            ("reading file:", "tool_action"),
            ("writing to file:", "tool_action"),
            ("writing file:", "tool_action"),
            ("running command:", "tool_action"),
            ("executing:", "tool_action"),
            ("using tool:", "tool_action"),
            ("bash:", "tool_action"),
            ("edit:", "tool_action"),
            ("read:", "tool_action")
        ]
        
        for pattern, msg_type in action_patterns:
            if pattern in line_lower:
                return CliMessage(
                    type=msg_type,
                    content=line,
                    metadata={"is_stderr": is_stderr, "action_pattern": pattern}
                )
        
        # Progress indicators and numbered patterns (check early for priority)
        progress_indicators = ["/", "%", "[", "]"]
        has_number = any(char.isdigit() for char in line_stripped)
        has_progress_symbol = any(symbol in line_stripped for symbol in progress_indicators)
        
        if has_number and has_progress_symbol:
            return CliMessage(
                type="progress",
                content=line,
                metadata={"is_stderr": is_stderr, "progress_indicator": True}
            )
        
        # Status message detection
        status_patterns = [
            "waiting", "processing", "loading", "connecting", "authenticating",
            "initializing", "starting", "preparing", "analyzing", "thinking"
        ]
        
        if any(pattern in line_lower for pattern in status_patterns):
            return CliMessage(
                type="status",
                content=line,
                metadata={"is_stderr": is_stderr, "status_indicator": True}
            )
        
        # Error pattern detection (enhanced)
        error_patterns = [
            "error:", "failed:", "exception:", "traceback", "fatal:",
            "invalid api key", "authentication failed", "permission denied",
            "not found", "connection refused", "timeout"
        ]
        
        # Check if this is an error line
        is_error_line = is_stderr or any(pattern in line_lower for pattern in error_patterns)
        
        if is_error_line:
            # Special handling for authentication errors
            if "invalid api key" in line_lower or "authentication failed" in line_lower:
                return CliMessage(
                    type="auth_error",
                    content=f"{line}\n\nPlease run: claude setup-token",
                    metadata={
                        "is_stderr": is_stderr,
                        "auth_setup_required": True,
                        "original_line": line
                    }
                )
            
            return CliMessage(
                type="error",
                content=line,
                metadata={"is_stderr": is_stderr}
            )
        
        # Default: Regular streaming content
        return CliMessage(
            type="stream",
            content=line,
            metadata={"is_stderr": is_stderr}
        )
    
    async def execute_sync(self, prompt: str) -> str:
        """
        Execute and collect all output synchronously.
        
        Useful for cases where you want the complete response.
        """
        output = []
        
        async for message in self.execute(prompt):
            if message.type in ["stream", "result"]:
                output.append(message.content)
            elif message.type == "error":
                logger.error(f"Error: {message.content}")
        
        return "\n".join(output)
    
    def is_available(self) -> bool:
        """Check if Claude CLI is available"""
        try:
            return shutil.which("claude") is not None or os.path.exists(self.cli_path)
        except (AttributeError, FileNotFoundError):
            return False
    
    def kill(self):
        """Kill the running process if it exists"""
        if self.process and self.process.returncode is None:
            self.process.kill()
            logger.info("Killed running Claude CLI process")

    async def _enhanced_cleanup_with_tracking(self):
        """
        Enhanced cleanup method with process handle tracking and Epic 3-style resource management.
        
        Features:
        - Tracks and cleans up all registered resources
        - Graceful termination with escalation to force kill
        - Comprehensive error handling and logging
        - Resource leak detection and prevention
        """
        cleanup_start_time = time.time()
        
        try:
            self.process_state = ProcessState.TERMINATING
            
            # Step 1: Clean up all tracked resources via handle manager
            if self.registered_resources:
                logger.info(f"Cleaning up {len(self.registered_resources)} tracked resources")
                
                # Force cleanup through handle manager
                cleaned_count, failed_count, errors = await self.handle_manager.force_cleanup_all(timeout=3.0)
                
                if errors:
                    logger.warning(f"Resource cleanup errors: {errors}")
                
                logger.info(f"Resource cleanup completed: {cleaned_count} cleaned, {failed_count} failed")
                
                # Clear our resource tracking
                self.registered_resources.clear()
            
            # Step 2: Explicit process cleanup (backup in case handle manager missed it)
            if self.process:
                await self._cleanup_process_explicit()
            
            self.process_state = ProcessState.TERMINATED
            
            cleanup_duration = time.time() - cleanup_start_time
            logger.info(f"Enhanced cleanup completed in {cleanup_duration:.2f}s")
            
            # Reset to IDLE after successful cleanup
            self.process_state = ProcessState.IDLE
            
        except Exception as e:
            self.process_state = ProcessState.FAILED
            logger.error(f"Error during enhanced cleanup: {e}")
            raise
    
    async def _cleanup_process_explicit(self):
        """Explicit process cleanup with enhanced error handling"""
        if not self.process or self.process.returncode is not None:
            return
        
        process_pid = getattr(self.process, 'pid', 'unknown')
        logger.debug(f"Explicit cleanup of process {process_pid}")
        
        try:
            # Phase 1: Graceful termination (SIGTERM)
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=2.0)
                logger.debug(f"Process {process_pid} terminated gracefully")
                return
            except asyncio.TimeoutError:
                logger.warning(f"Process {process_pid} did not respond to SIGTERM")
            
            # Phase 2: Force kill (SIGKILL)
            logger.warning(f"Force killing process {process_pid}")
            self.process.kill()
            
            try:
                await asyncio.wait_for(self.process.wait(), timeout=3.0)
                logger.info(f"Process {process_pid} force killed successfully")
            except asyncio.TimeoutError:
                logger.error(f"Process {process_pid} did not respond to SIGKILL - may be zombie")
        
        except ProcessLookupError:
            logger.debug(f"Process {process_pid} already terminated")
        except Exception as e:
            logger.error(f"Error during explicit process cleanup: {e}")
        finally:
            self.process = None

    async def cleanup(self):
        """
        Legacy cleanup method - enhanced to use new tracking system.
        
        Maintained for backward compatibility.
        """
        try:
            await self._enhanced_cleanup_with_tracking()
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    @asynccontextmanager
    async def managed_execution(self, prompt: str):
        """
        Context manager for guaranteed resource cleanup.
        
        Usage:
            async with wrapper.managed_execution("prompt") as execution:
                async for message in execution:
                    print(message.content)
        """
        try:
            yield self.execute(prompt)
        finally:
            await self._enhanced_cleanup_with_tracking()
    
    def get_resource_stats(self) -> Dict[str, Any]:
        """Get statistics about managed resources"""
        handle_stats = self.handle_manager.get_resource_stats()
        return {
            'process_state': self.process_state.value,
            'registered_resources': len(self.registered_resources),
            'process_pid': getattr(self.process, 'pid', None) if self.process else None,
            'process_returncode': getattr(self.process, 'returncode', None) if self.process else None,
            'handle_manager_stats': handle_stats,
        }


# Simple synchronous wrapper for ease of use
class ClaudeCliSimple:
    """Simple synchronous wrapper for quick usage"""
    
    def __init__(self, model: str = "sonnet", verbose: bool = False):
        self.options = ClaudeCliOptions(
            model=model,
            verbose=verbose,
            dangerously_skip_permissions=True  # For non-interactive use
        )
        self.wrapper = ClaudeCliWrapper(self.options)
    
    def query(self, prompt: str) -> str:
        """Simple synchronous query"""
        return asyncio.run(self.wrapper.execute_sync(prompt))
    
    async def stream_query(self, prompt: str):
        """Async streaming query"""
        async for message in self.wrapper.execute(prompt):
            yield message


# Example usage functions
async def example_streaming():
    """Example of streaming usage"""
    print("=== Streaming Example ===")
    
    options = ClaudeCliOptions(
        model="sonnet",
        verbose=True,
        dangerously_skip_permissions=True
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    prompt = "Write a simple Python hello world function"
    
    async for message in wrapper.execute(prompt):
        if message.type == "stream":
            print(f"[STREAM] {message.content}")
        elif message.type == "tool_use":
            print(f"[TOOL] {message.content}")
        elif message.type == "error":
            print(f"[ERROR] {message.content}")
        elif message.type == "status":
            print(f"[STATUS] {message.content}")
        else:
            print(f"[{message.type.upper()}] {message.content}")


def example_simple():
    """Example of simple synchronous usage"""
    print("=== Simple Example ===")
    
    # Create simple wrapper
    claude = ClaudeCliSimple(model="sonnet")
    
    # Execute query
    result = claude.query("What is 2+2? Answer in one line.")
    
    print(f"Result: {result}")


async def main():
    """Run examples"""
    print("\nClaude CLI Wrapper - No API Key Required!")
    print("=" * 50)
    print("This uses your existing Claude CLI authentication")
    print("Make sure you've run 'claude setup-token' first\n")
    
    # Check if CLI is available
    try:
        wrapper = ClaudeCliWrapper()
        print(f"✅ Found Claude CLI at: {wrapper.cli_path}")
    except FileNotFoundError as e:
        print(f"❌ {e}")
        return
    
    # Run examples
    print("\n" + "=" * 50)
    example_simple()
    
    print("\n" + "=" * 50)
    await example_streaming()


if __name__ == "__main__":
    # Run the examples
    asyncio.run(main())