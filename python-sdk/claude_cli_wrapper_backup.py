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
from typing import Optional, AsyncGenerator, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum
import shutil
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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
    """
    
    def __init__(self, options: Optional[ClaudeCliOptions] = None):
        self.options = options or ClaudeCliOptions()
        self.cli_path = self._find_claude_cli()
        self.process: Optional[asyncio.subprocess.Process] = None
        
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
        Enhanced execute method with timeout enforcement, retry logic, and comprehensive error handling.
        
        Improvements:
        - Timeout enforcement using asyncio.timeout()
        - Exponential backoff retry for transient failures
        - Enhanced authentication error detection
        - Graceful process termination sequence (SIGTERM → wait → SIGKILL)
        - Better resource cleanup and error recovery
        """
        
        # Validate input
        if not prompt or not prompt.strip():
            yield CliMessage(
                type="error",
                content="Empty prompt provided",
                metadata={"validation_error": True}
            )
            return
        
        # Build command with enhanced argument handling
        cmd = [self.cli_path]
        cmd.extend(self.options.to_cli_args())
        
        # Use --output-format json for structured parsing
        cmd.extend(["--output-format", "json"])
        cmd.extend(["-p", prompt])  # Non-interactive prompt mode
        
        logger.info(f"Executing command: {' '.join(cmd[:4])}... (timeout: {self.options.timeout}s)")
        
        # Retry logic with exponential backoff
        max_retries = 3
        base_delay = 1.0
        
        for attempt in range(max_retries):
            try:
                # Implement timeout enforcement
                async with asyncio.timeout(self.options.timeout):
                    # Create subprocess with enhanced configuration
                    env = os.environ.copy()
                    
                    # Set environment variables for better CLI behavior
                    env["CLAUDE_NO_BROWSER"] = "1"  # Prevent browser launches in CI/automation
                    env["FORCE_COLOR"] = "0"  # Disable colors for parsing
                    
                    self.process = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        cwd=self.options.working_directory,
                        env=env,
                        # Process group for better cleanup
                        preexec_fn=os.setsid if hasattr(os, 'setsid') else None
                    )
                    
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
                        logger.info("Execution cancelled by user")
                        yield CliMessage(
                            type="status",
                            content="Execution cancelled",
                            metadata={"cancelled": True, "messages_received": message_count}
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
                
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff
                    yield CliMessage(
                        type="status",
                        content=f"Timeout occurred, retrying in {delay}s... (attempt {attempt + 1}/{max_retries})",
                        metadata={"retry_attempt": attempt + 1, "delay": delay}
                    )
                    await asyncio.sleep(delay)
                else:
                    yield CliMessage(
                        type="error",
                        content=f"Execution failed after {max_retries} attempts due to timeout ({self.options.timeout}s)",
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
                logger.info("Execution cancelled")
                await self._force_process_cleanup()
                raise
            
            except Exception as e:
                logger.error(f"Error running Claude CLI (attempt {attempt + 1}): {e}")
                
                # Check if this is a transient error worth retrying
                is_transient = any(keyword in str(e).lower() for keyword in [
                    "connection", "network", "timeout", "temporary", "unavailable"
                ])
                
                if is_transient and attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    yield CliMessage(
                        type="status",
                        content=f"Transient error, retrying in {delay}s... (attempt {attempt + 1}/{max_retries})",
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
            # Create concurrent tasks for stdout and stderr
            tasks = []
            
            if self.process.stdout:
                stdout_task = asyncio.create_task(
                    self._collect_stream_messages(read_stream(self.process.stdout, False))
                )
                tasks.append(stdout_task)
            
            if self.process.stderr:
                stderr_task = asyncio.create_task(
                    self._collect_stream_messages(read_stream(self.process.stderr, True))
                )
                tasks.append(stderr_task)
            
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
            for task in tasks:
                collection_task = asyncio.create_task(queue_messages(task))
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
            
            # Handle Claude CLI structured JSON responses
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

    async def cleanup(self):
        """Cleanup resources and terminate processes"""
        try:
            if self.process:
                if self.process.returncode is None:
                    # Try graceful termination first
                    self.process.terminate()
                    try:
                        await asyncio.wait_for(self.process.wait(), timeout=2.0)
                    except asyncio.TimeoutError:
                        # Force kill if graceful termination fails
                        self.process.kill()
                        await self.process.wait()
                self.process = None
                logger.info("Cleaned up Claude CLI process")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")


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