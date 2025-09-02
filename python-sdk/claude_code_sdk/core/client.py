"""
Claude Code SDK - Async Client Implementation
Main async client class with context manager support
"""

import asyncio
import subprocess
import shutil
import signal
import sys
from typing import Optional, AsyncGenerator, Dict, Any, List, Callable, Union
from pathlib import Path
from contextlib import asynccontextmanager
import logging
import json
import time

from .options import ClaudeCodeOptions
from .messages import (
    BaseMessage, ResultMessage, ToolUseMessage, ToolResultMessage, 
    ErrorMessage, StreamMessage, StatusMessage, Message, parse_message
)
from ..exceptions import (
    ClaudeCodeError, ClaudeTimeoutError, ClaudeAuthError, 
    ClaudeNotFoundError, ProcessError, NetworkError, classify_error
)
from ..utils.cli_detector import CLIDetector
from ..utils.process_manager import ProcessManager

logger = logging.getLogger(__name__)

class ClaudeCodeClient:
    """
    Async Claude Code client with context manager support
    
    Usage:
        async with ClaudeCodeClient(options) as client:
            async for message in client.query("Hello Claude"):
                print(message)
    """
    
    def __init__(self, options: Optional[ClaudeCodeOptions] = None):
        self.options = options or ClaudeCodeOptions()
        self.cli_detector = CLIDetector()
        self.process_manager = ProcessManager()
        self._is_ready = False
        self._claude_cli_path: Optional[str] = None
        
        # Session management
        self._session_id = self.options.session_id
        self._conversation_context: List[Message] = []
        
        # Performance tracking
        self._stats = {
            'queries_executed': 0,
            'total_execution_time': 0.0,
            'average_response_time': 0.0,
            'errors_encountered': 0
        }
    
    async def __aenter__(self) -> 'ClaudeCodeClient':
        """Async context manager entry"""
        await self._initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit"""
        await self.close()
    
    async def _initialize(self) -> None:
        """Initialize the client and verify Claude CLI availability"""
        try:
            logger.info("Initializing Claude Code client...")
            
            # Detect and validate Claude CLI
            self._claude_cli_path = await self.cli_detector.detect_claude_cli(
                preferred_path=self.options.claude_cli_path
            )
            
            if not self._claude_cli_path:
                raise ClaudeNotFoundError(
                    "Claude CLI not found. Please install @anthropic-ai/claude-code",
                    cli_path=self.options.claude_cli_path
                )
            
            # Validate CLI works
            await self._validate_cli()
            
            self._is_ready = True
            logger.info(f"Claude Code client ready. CLI path: {self._claude_cli_path}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Claude Code client: {e}")
            if isinstance(e, ClaudeCodeError):
                raise
            else:
                raise ClaudeCodeError(f"Initialization failed: {e}")
    
    async def _validate_cli(self) -> None:
        """Validate that Claude CLI is working"""
        try:
            process = await asyncio.create_subprocess_exec(
                self._claude_cli_path, '--version',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.options.working_directory) if self.options.working_directory else None
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), 
                timeout=10.0
            )
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown CLI error"
                raise ProcessError(
                    f"Claude CLI validation failed: {error_msg}",
                    exit_code=process.returncode,
                    stderr=error_msg
                )
                
            logger.debug(f"Claude CLI version: {stdout.decode().strip()}")
            
        except asyncio.TimeoutError:
            raise ClaudeTimeoutError("Claude CLI validation timed out")
        except FileNotFoundError:
            raise ClaudeNotFoundError(f"Claude CLI not found: {self._claude_cli_path}")
    
    async def query(
        self, 
        prompt: str,
        stream: bool = None,
        on_message: Optional[Callable[[Message], None]] = None
    ) -> AsyncGenerator[Message, None]:
        """
        Execute a query and yield messages as they arrive
        
        Args:
            prompt: The prompt to send to Claude
            stream: Override streaming setting from options
            on_message: Optional callback for each message
        
        Yields:
            Messages from Claude execution
        """
        if not self._is_ready:
            raise ClaudeCodeError("Client not initialized. Use 'async with' context manager.")
        
        start_time = time.time()
        self._stats['queries_executed'] += 1
        
        # Determine streaming mode
        use_streaming = stream if stream is not None else self.options.stream_response
        
        try:
            logger.info(f"Executing query (streaming={use_streaming}): {prompt[:100]}...")
            
            # Build command
            cmd_args = self._build_command_args()
            
            # Execute with appropriate method
            if use_streaming:
                async for message in self._execute_streaming(prompt, cmd_args, on_message):
                    yield message
            else:
                async for message in self._execute_blocking(prompt, cmd_args, on_message):
                    yield message
                    
        except Exception as e:
            self._stats['errors_encountered'] += 1
            error_msg = self._create_error_message(e)
            if on_message:
                on_message(error_msg)
            yield error_msg
            raise
        finally:
            # Update stats
            execution_time = time.time() - start_time
            self._stats['total_execution_time'] += execution_time
            self._stats['average_response_time'] = (
                self._stats['total_execution_time'] / self._stats['queries_executed']
            )
    
    async def _execute_streaming(
        self, 
        prompt: str, 
        cmd_args: List[str],
        on_message: Optional[Callable[[Message], None]]
    ) -> AsyncGenerator[Message, None]:
        """Execute query with streaming output"""
        process = None
        try:
            # Start process
            process = await asyncio.create_subprocess_exec(
                self._claude_cli_path,
                *cmd_args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.options.working_directory),
                env=self.options.get_process_env()
            )
            
            # Track process
            self.process_manager.add_process(process, self._session_id)
            
            # Send prompt
            if process.stdin:
                process.stdin.write(prompt.encode())
                await process.stdin.drain()
                process.stdin.close()
            
            # Stream output
            buffer = ""
            async for line in self._read_process_output(process):
                buffer += line
                
                # Try to parse complete messages
                while '\n' in buffer:
                    line_data, buffer = buffer.split('\n', 1)
                    if line_data.strip():
                        message = parse_message(line_data.strip())
                        if message:
                            if on_message:
                                on_message(message)
                            yield message
            
            # Handle any remaining buffer
            if buffer.strip():
                message = parse_message(buffer.strip())
                if message:
                    if on_message:
                        on_message(message)
                    yield message
            
            # Wait for completion
            await asyncio.wait_for(process.wait(), timeout=self.options.timeout)
            
            # Check exit code
            if process.returncode != 0:
                stderr_data = await process.stderr.read()
                error_text = stderr_data.decode() if stderr_data else "Process failed"
                raise classify_error(error_text, stderr=error_text, exit_code=process.returncode)
                
        except asyncio.TimeoutError:
            if process:
                await self._kill_process(process)
            raise ClaudeTimeoutError(f"Query timed out after {self.options.timeout} seconds")
        finally:
            if process:
                self.process_manager.remove_process(process)
    
    async def _execute_blocking(
        self, 
        prompt: str, 
        cmd_args: List[str],
        on_message: Optional[Callable[[Message], None]]
    ) -> AsyncGenerator[Message, None]:
        """Execute query with blocking output"""
        process = None
        try:
            # Start process
            process = await asyncio.create_subprocess_exec(
                self._claude_cli_path,
                *cmd_args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.options.working_directory),
                env=self.options.get_process_env()
            )
            
            # Track process
            self.process_manager.add_process(process, self._session_id)
            
            # Send prompt and wait for completion
            stdout_data, stderr_data = await asyncio.wait_for(
                process.communicate(input=prompt.encode()),
                timeout=self.options.timeout
            )
            
            # Parse output
            if process.returncode == 0:
                output_text = stdout_data.decode()
                if output_text.strip():
                    # Create result message
                    result_msg = ResultMessage(result=output_text.strip())
                    if on_message:
                        on_message(result_msg)
                    yield result_msg
            else:
                error_text = stderr_data.decode() if stderr_data else "Process failed"
                raise classify_error(error_text, stderr=error_text, exit_code=process.returncode)
                
        except asyncio.TimeoutError:
            if process:
                await self._kill_process(process)
            raise ClaudeTimeoutError(f"Query timed out after {self.options.timeout} seconds")
        finally:
            if process:
                self.process_manager.remove_process(process)
    
    async def _read_process_output(self, process: asyncio.subprocess.Process) -> AsyncGenerator[str, None]:
        """Read process output line by line"""
        if not process.stdout:
            return
            
        while True:
            try:
                line_bytes = await asyncio.wait_for(
                    process.stdout.readline(), 
                    timeout=1.0
                )
                
                if not line_bytes:  # EOF
                    break
                    
                yield line_bytes.decode()
                
            except asyncio.TimeoutError:
                # Check if process is still alive
                if process.returncode is not None:
                    break
                continue
    
    def _build_command_args(self) -> List[str]:
        """Build command line arguments for Claude CLI"""
        return self.options.get_cli_args()
    
    def _create_error_message(self, error: Exception) -> ErrorMessage:
        """Create an error message from an exception"""
        if isinstance(error, ClaudeCodeError):
            return ErrorMessage(
                error=error.message,
                error_code=error.error_code,
                error_type=error.__class__.__name__,
                recoverable=error.recoverable
            )
        else:
            return ErrorMessage(
                error=str(error),
                error_type=error.__class__.__name__,
                recoverable=False
            )
    
    async def _kill_process(self, process: asyncio.subprocess.Process) -> None:
        """Safely kill a process"""
        try:
            if sys.platform == "win32":
                process.terminate()
            else:
                process.send_signal(signal.SIGTERM)
            
            # Wait briefly for graceful shutdown
            try:
                await asyncio.wait_for(process.wait(), timeout=2.0)
            except asyncio.TimeoutError:
                # Force kill if graceful shutdown fails
                process.kill()
                await process.wait()
                
        except ProcessLookupError:
            # Process already terminated
            pass
    
    async def close(self) -> None:
        """Close the client and clean up resources"""
        logger.info("Closing Claude Code client...")
        
        # Kill any active processes
        await self.process_manager.close_all()
        
        self._is_ready = False
        logger.info("Claude Code client closed.")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get client performance statistics"""
        return self._stats.copy()
    
    def reset_stats(self) -> None:
        """Reset performance statistics"""
        self._stats = {
            'queries_executed': 0,
            'total_execution_time': 0.0,
            'average_response_time': 0.0,
            'errors_encountered': 0
        }
    
    @property
    def is_ready(self) -> bool:
        """Check if client is ready for use"""
        return self._is_ready
    
    @property
    def claude_cli_path(self) -> Optional[str]:
        """Get the path to Claude CLI being used"""
        return self._claude_cli_path
    
    def execute(self, prompt: str, **kwargs) -> str:
        """
        Synchronous execute method for compatibility
        
        Args:
            prompt: The prompt to send to Claude
            **kwargs: Additional options
        
        Returns:
            str: Final result from Claude
        """
        import asyncio
        
        async def _async_execute():
            if not self._is_ready:
                await self._initialize()
            
            result = ""
            async for message in self.query(prompt, **kwargs):
                if hasattr(message, 'result') and message.result:
                    result = message.result
                elif hasattr(message, 'content') and message.content:
                    result = message.content
            return result
        
        return asyncio.run(_async_execute())