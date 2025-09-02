#!/usr/bin/env python3
"""
Gemini CLI Wrapper - Direct CLI execution following Dan Disler's pattern
Based on agentic-drop-zones implementation for Gemini CLI interaction

This wrapper uses subprocess to execute Gemini CLI directly,
maintaining the same interface as ClaudeCliWrapper for easy switching.
"""

import asyncio
import os
import sys
import json
from pathlib import Path
from typing import Optional, AsyncGenerator, Dict, Any, List
from dataclasses import dataclass, field
import shutil
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class GeminiCliOptions:
    """Options for Gemini CLI execution"""
    model: str = "gemini-2.5-pro"  # gemini-2.5-pro, gemini-exp-1206, etc.
    max_turns: int = 10
    allowed_tools: List[str] = field(default_factory=lambda: ["Read", "Write", "Edit", "Bash"])
    verbose: bool = False
    yolo: bool = True  # Auto-approve tool calls (Dan's pattern)
    sandbox: bool = True  # Enable sandboxing for security
    working_directory: Optional[Path] = None
    timeout: int = 300  # 5 minutes default
    cli_path: Optional[str] = None  # Custom path to gemini CLI

    def to_cli_args(self) -> List[str]:
        """Convert options to CLI arguments"""
        args = []
        
        # Yolo flag (auto-approve, following Dan's pattern)
        if self.yolo:
            args.append("--yolo")
        
        # Sandbox flag (security, following Dan's pattern)
        if self.sandbox:
            args.append("--sandbox")
        
        # Model
        args.extend(["-m", self.model])
        
        # Verbose
        if self.verbose:
            args.append("-v")
        
        return args


@dataclass
class CliMessage:
    """Message from CLI output - same interface as Claude wrapper"""
    type: str  # stream, tool_use, result, error, status
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class GeminiCliWrapper:
    """
    Wrapper for Gemini CLI using subprocess execution.
    
    Follows Dan Disler's pattern from agentic-drop-zones while maintaining
    the same interface as ClaudeCliWrapper for easy switching.
    """
    
    def __init__(self, options: Optional[GeminiCliOptions] = None):
        self.options = options or GeminiCliOptions()
        self.cli_path = self._find_gemini_cli()
        self.process: Optional[asyncio.subprocess.Process] = None
        
    def _find_gemini_cli(self) -> str:
        """Find Gemini CLI executable"""
        # Check custom path first
        if self.options.cli_path:
            if os.path.exists(self.options.cli_path):
                return self.options.cli_path
            else:
                logger.warning(f"Custom CLI path not found: {self.options.cli_path}")
        
        # Check environment variable
        env_path = os.environ.get("GEMINI_CLI_PATH", "")
        if env_path and os.path.exists(env_path):
            return env_path
        
        # Try to find in PATH
        gemini_path = shutil.which("gemini")
        if gemini_path:
            return gemini_path
        
        # Common installation paths
        common_paths = [
            "/usr/local/bin/gemini",
            "/opt/homebrew/bin/gemini",
            os.path.expanduser("~/.cargo/bin/gemini"),  # Rust installations
            os.path.expanduser("~/go/bin/gemini"),      # Go installations
            os.path.expanduser("~/AppData/Roaming/npm/gemini.cmd"),  # Windows npm
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                return path
        
        raise FileNotFoundError(
            "Gemini CLI not found. Please install from: https://github.com/replit/gemini-cli"
        )
    
    async def execute(self, prompt: str) -> AsyncGenerator[CliMessage, None]:
        """
        Execute a Gemini CLI command and stream the output.
        
        Following Dan's pattern:
        1. Build command with --yolo and --sandbox flags
        2. Create subprocess with asyncio
        3. Stream output line by line
        4. Parse and yield messages
        """
        
        # Build command (following Dan's exact pattern)
        cmd = [self.cli_path]
        cmd.extend(self.options.to_cli_args())
        cmd.extend(["-p", prompt])  # Prompt flag
        
        logger.info(f"Executing Gemini CLI: {' '.join(cmd[:4])}...")
        
        try:
            # Create subprocess (Dan's pattern)
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.options.working_directory,
                env=os.environ.copy()
            )
            
            # Stream output line by line
            async for message in self._stream_output():
                yield message
            
            # Wait for process to complete
            return_code = await self.process.wait()
            
            if return_code != 0:
                yield CliMessage(
                    type="error",
                    content=f"Gemini CLI exited with code {return_code}",
                    metadata={"return_code": return_code}
                )
        
        except FileNotFoundError:
            yield CliMessage(
                type="error",
                content=f"Gemini CLI not found at '{self.cli_path}'. Install from: https://github.com/replit/gemini-cli",
                metadata={"cli_path": self.cli_path}
            )
        except Exception as e:
            yield CliMessage(
                type="error",
                content=f"Error running Gemini CLI: {str(e)}",
                metadata={"exception": type(e).__name__}
            )
        finally:
            self.process = None
    
    async def _stream_output(self) -> AsyncGenerator[CliMessage, None]:
        """
        Stream and parse output from the CLI process.
        
        Following Dan's streaming approach with concurrent stdout/stderr reading.
        """
        if not self.process:
            return
        
        async def read_stream(stream, is_stderr=False):
            """Read from stream and yield parsed messages"""
            while True:
                line = await stream.readline()
                if not line:
                    break
                
                decoded = line.decode('utf-8', errors='replace').rstrip()
                if decoded:
                    yield self._parse_line(decoded, is_stderr)
        
        # Read both streams concurrently (Dan's pattern)
        tasks = []
        if self.process.stdout:
            tasks.append(read_stream(self.process.stdout, False))
        if self.process.stderr:
            tasks.append(read_stream(self.process.stderr, True))
        
        # Yield messages as they arrive
        async for message in self._merge_streams(tasks):
            yield message
    
    async def _merge_streams(self, streams):
        """Merge multiple async generators"""
        pending = {asyncio.create_task(stream.__anext__()): stream for stream in streams}
        
        while pending:
            done, _ = await asyncio.wait(pending.keys(), return_when=asyncio.FIRST_COMPLETED)
            
            for task in done:
                stream = pending.pop(task)
                try:
                    message = task.result()
                    yield message
                    # Schedule next read from this stream
                    pending[asyncio.create_task(stream.__anext__())] = stream
                except StopAsyncIteration:
                    # Stream ended, don't reschedule
                    pass
                except Exception as e:
                    logger.error(f"Error reading stream: {e}")
    
    def _parse_line(self, line: str, is_stderr: bool = False) -> CliMessage:
        """
        Parse a line of output into a CliMessage.
        
        Gemini CLI output patterns may differ from Claude,
        but we maintain the same message types for compatibility.
        """
        
        # Try to parse as JSON first
        try:
            data = json.loads(line)
            return CliMessage(
                type=data.get("type", "stream"),
                content=data.get("content", line),
                metadata=data
            )
        except json.JSONDecodeError:
            pass
        
        # Check for Gemini-specific patterns
        line_lower = line.lower()
        
        # Tool usage patterns
        if any(pattern in line_lower for pattern in [
            "using tool", "executing", "running", "calling function"
        ]):
            return CliMessage(
                type="tool_use",
                content=line,
                metadata={"is_stderr": is_stderr}
            )
        
        # Error patterns
        if is_stderr or any(pattern in line_lower for pattern in [
            "error:", "failed:", "exception:", "panic:"
        ]):
            return CliMessage(
                type="error",
                content=line,
                metadata={"is_stderr": is_stderr}
            )
        
        # Status patterns
        if any(pattern in line_lower for pattern in [
            "waiting", "processing", "loading", "thinking", "analyzing"
        ]):
            return CliMessage(
                type="status",
                content=line,
                metadata={"is_stderr": is_stderr}
            )
        
        # Default to stream type
        return CliMessage(
            type="stream",
            content=line,
            metadata={"is_stderr": is_stderr}
        )
    
    async def execute_sync(self, prompt: str) -> str:
        """
        Execute and collect all output synchronously.
        Same interface as ClaudeCliWrapper for compatibility.
        """
        output = []
        
        async for message in self.execute(prompt):
            if message.type in ["stream", "result"]:
                output.append(message.content)
            elif message.type == "error":
                logger.error(f"Error: {message.content}")
        
        return "\n".join(output)
    
    def kill(self):
        """Kill the running process if it exists"""
        if self.process and self.process.returncode is None:
            self.process.kill()
            logger.info("Killed running Gemini CLI process")


# Simple synchronous wrapper for ease of use
class GeminiCliSimple:
    """Simple synchronous wrapper - same interface as ClaudeCliSimple"""
    
    def __init__(self, model: str = "gemini-2.5-pro", verbose: bool = False):
        self.options = GeminiCliOptions(
            model=model,
            verbose=verbose,
            yolo=True,     # Auto-approve (Dan's pattern)
            sandbox=True   # Security (Dan's pattern)
        )
        self.wrapper = GeminiCliWrapper(self.options)
    
    def query(self, prompt: str) -> str:
        """Simple synchronous query"""
        return asyncio.run(self.wrapper.execute_sync(prompt))
    
    async def stream_query(self, prompt: str):
        """Async streaming query"""
        async for message in self.wrapper.execute(prompt):
            yield message


# Example usage
async def example_streaming():
    """Example of streaming usage"""
    print("=== Gemini Streaming Example ===")
    
    options = GeminiCliOptions(
        model="gemini-2.5-pro",
        verbose=True,
        yolo=True,    # Dan's pattern
        sandbox=True  # Dan's pattern
    )
    
    wrapper = GeminiCliWrapper(options)
    
    prompt = "Write a simple Python hello world function"
    
    async for message in wrapper.execute(prompt):
        print(f"[{message.type.upper()}] {message.content}")


def example_simple():
    """Example of simple synchronous usage"""
    print("=== Gemini Simple Example ===")
    
    gemini = GeminiCliSimple(model="gemini-2.5-pro")
    result = gemini.query("What is 2+2? Answer in one line.")
    
    print(f"Result: {result}")


async def main():
    """Run examples"""
    print("\nGemini CLI Wrapper - Following Dan's Pattern!")
    print("=" * 50)
    print("Uses --yolo and --sandbox flags from agentic-drop-zones\n")
    
    # Check if CLI is available
    try:
        wrapper = GeminiCliWrapper()
        print(f"✅ Found Gemini CLI at: {wrapper.cli_path}")
    except FileNotFoundError as e:
        print(f"❌ {e}")
        return
    
    # Run examples
    print("\n" + "=" * 50)
    example_simple()
    
    print("\n" + "=" * 50)
    await example_streaming()


if __name__ == "__main__":
    asyncio.run(main())