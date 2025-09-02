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
from pathlib import Path
from typing import Optional, AsyncGenerator, Dict, Any, List
from dataclasses import dataclass, field
import shutil
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
        Execute a Claude CLI command and stream the output.
        
        This is the core method that mimics Dan's Gemini CLI approach:
        1. Build the command with all necessary flags
        2. Create subprocess with asyncio
        3. Stream output line by line
        4. Parse and yield messages
        """
        
        # Build command
        cmd = [self.cli_path]
        cmd.extend(self.options.to_cli_args())
        cmd.extend(["-p", prompt])  # Non-interactive prompt mode
        
        logger.info(f"Executing command: {' '.join(cmd[:3])}...")
        
        try:
            # Create subprocess (similar to Dan's Gemini implementation)
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
                    content=f"Process exited with code {return_code}",
                    metadata={"return_code": return_code}
                )
        
        except FileNotFoundError:
            yield CliMessage(
                type="error",
                content=f"Claude CLI not found at '{self.cli_path}'",
                metadata={"cli_path": self.cli_path}
            )
        except Exception as e:
            yield CliMessage(
                type="error",
                content=f"Error running Claude CLI: {str(e)}",
                metadata={"exception": type(e).__name__}
            )
        finally:
            self.process = None
    
    async def _stream_output(self) -> AsyncGenerator[CliMessage, None]:
        """
        Stream and parse output from the CLI process with proper async handling.
        """
        if not self.process:
            return
        
        try:
            # Read stdout line by line
            while True:
                try:
                    line = await self.process.stdout.readline()
                    if not line:
                        break
                    
                    decoded = line.decode('utf-8', errors='replace').rstrip()
                    if decoded:
                        message = self._parse_line(decoded, False)
                        yield message
                        
                except asyncio.CancelledError:
                    logger.info("Stream output cancelled")
                    break
                except Exception as e:
                    logger.error(f"Error reading stdout: {e}")
                    break
            
            # Check for any stderr output
            try:
                if self.process.stderr:
                    while True:
                        line = await asyncio.wait_for(self.process.stderr.readline(), timeout=0.1)
                        if not line:
                            break
                        
                        decoded = line.decode('utf-8', errors='replace').rstrip()
                        if decoded:
                            message = self._parse_line(decoded, True)
                            yield message
            except asyncio.TimeoutError:
                # No more stderr output
                pass
            except Exception as e:
                logger.error(f"Error reading stderr: {e}")
        
        except asyncio.CancelledError:
            logger.info("Stream cancelled during execution")
            raise
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield CliMessage(type="error", content=str(e))
        finally:
            # Ensure process cleanup
            if self.process and self.process.returncode is None:
                try:
                    await asyncio.wait_for(self.process.wait(), timeout=1.0)
                except asyncio.TimeoutError:
                    logger.warning("Process did not terminate gracefully")
    
    def _parse_line(self, line: str, is_stderr: bool = False) -> CliMessage:
        """
        Parse a line of output into a CliMessage.
        
        This is where we interpret Claude CLI output format.
        We can enhance this based on actual CLI output patterns.
        """
        
        # Try to parse as JSON (some CLI tools output JSON)
        try:
            data = json.loads(line)
            return CliMessage(
                type=data.get("type", "stream"),
                content=data.get("content", line),
                metadata=data
            )
        except json.JSONDecodeError:
            pass
        
        # Check for common patterns
        line_lower = line.lower()
        
        # Tool usage patterns
        if "using tool:" in line_lower or "executing:" in line_lower:
            return CliMessage(
                type="tool_use",
                content=line,
                metadata={"is_stderr": is_stderr}
            )
        
        # Error patterns
        if is_stderr or "error:" in line_lower or "failed:" in line_lower:
            return CliMessage(
                type="error",
                content=line,
                metadata={"is_stderr": is_stderr}
            )
        
        # Status patterns
        if "waiting" in line_lower or "processing" in line_lower or "loading" in line_lower:
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