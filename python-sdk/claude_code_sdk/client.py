"""
Claude Code SDK Client
Main interface for interacting with Claude Code CLI
"""

import subprocess
import threading
import time
import os
import shutil
from typing import Dict, List, Optional, Callable, Any
from pathlib import Path

from .session import ClaudeSession, ClaudeSessionOptions, ClaudeSessionResult, ClaudeMessage
from .exceptions import (
    ClaudeCodeError, 
    ClaudeTimeoutError, 
    ClaudeAuthError, 
    ClaudeNotFoundError,
    ClaudeConfigError
)

class ClaudeCodeClient:
    """Client for interacting with Claude Code CLI"""
    
    def __init__(self, options: Optional[ClaudeSessionOptions] = None):
        self.options = options or ClaudeSessionOptions()
        self.active_processes: Dict[str, subprocess.Popen] = {}
        self.claude_cli_path = self._find_claude_cli()
        
    def _find_claude_cli(self) -> str:
        """Find Claude CLI installation"""
        if self.options.claude_cli_path:
            if shutil.which(self.options.claude_cli_path):
                return self.options.claude_cli_path
            else:
                raise ClaudeNotFoundError(f"Claude CLI not found at: {self.options.claude_cli_path}")
        
        # Try common locations
        possible_paths = [
            'claude',  # Global installation
            'npx @anthropic-ai/claude-code',
        ]
        
        # Windows specific paths
        if os.name == 'nt':
            home = Path.home()
            possible_paths.extend([
                str(home / 'AppData' / 'Roaming' / 'npm' / 'claude.cmd'),
                str(home / 'AppData' / 'Local' / 'npm' / 'claude.cmd'),
            ])
        else:
            # Unix-like systems
            possible_paths.extend([
                '/usr/local/bin/claude',
                '/usr/bin/claude',
                str(Path.home() / '.npm-global' / 'bin' / 'claude'),
            ])
        
        for path in possible_paths:
            if shutil.which(path.split()[0]):  # Handle 'npx ...' commands
                return path
                
        raise ClaudeNotFoundError("Claude CLI not found. Please install @anthropic-ai/claude-code")
    
    def execute(self, 
                prompt: str,
                stream: bool = False,
                on_message: Optional[Callable[[ClaudeMessage], None]] = None,
                on_progress: Optional[Callable[[str], None]] = None) -> ClaudeSessionResult:
        """Execute a single prompt with Claude Code"""
        session = ClaudeSession(self.options)
        session.add_user_message(prompt)
        
        try:
            result = self._run_claude_process(
                session, 
                prompt=prompt,
                stream=stream,
                on_message=on_message,
                on_progress=on_progress
            )
            
            session.add_assistant_message(result['output'])
            return session.execute()
            
        except Exception as e:
            error_message = str(e)
            session.add_error(error_message)
            
            if isinstance(e, (ClaudeCodeError, ClaudeTimeoutError, ClaudeAuthError)):
                raise
            else:
                raise ClaudeCodeError(f"Claude Code execution failed: {error_message}")
    
    def create_session(self, options: Optional[ClaudeSessionOptions] = None) -> ClaudeSession:
        """Create a new interactive session"""
        session_options = options or self.options
        return ClaudeSession(session_options)
    
    def execute_session(self, session: ClaudeSession, prompts: List[str]) -> ClaudeSessionResult:
        """Execute multiple turns in a session"""
        for prompt in prompts:
            session.add_user_message(prompt)
            
            try:
                result = self._run_claude_process(session, prompt=prompt)
                session.add_assistant_message(result['output'])
            except Exception as e:
                error_message = str(e)
                session.add_error(error_message)
                break  # Stop on first error
                
        return session.execute()
    
    def _run_claude_process(self, 
                           session: ClaudeSession,
                           prompt: str,
                           stream: bool = False,
                           on_message: Optional[Callable[[ClaudeMessage], None]] = None,
                           on_progress: Optional[Callable[[str], None]] = None) -> Dict[str, Any]:
        """Run the actual Claude Code process"""
        
        session_info = session.get_session_info()
        args = self._build_claude_args()
        
        # Prepare environment
        env = os.environ.copy()
        env.update(self.options.environment)
        
        # Prepare working directory
        cwd = self.options.working_directory or os.getcwd()
        
        try:
            # Start Claude process
            process = subprocess.Popen(
                [self.claude_cli_path] + args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=cwd,
                env=env
            )
            
            self.active_processes[session_info['session_id']] = process
            
            # Send prompt
            if stream:
                return self._handle_streaming_process(
                    process, session_info['session_id'], prompt, on_message, on_progress
                )
            else:
                return self._handle_blocking_process(
                    process, session_info['session_id'], prompt
                )
                
        except FileNotFoundError:
            raise ClaudeNotFoundError(f"Claude CLI not found: {self.claude_cli_path}")
        except Exception as e:
            raise ClaudeCodeError(f"Failed to start Claude process: {e}")
    
    def _handle_blocking_process(self, process: subprocess.Popen, session_id: str, prompt: str) -> Dict[str, Any]:
        """Handle a blocking (non-streaming) Claude process"""
        try:
            # Send prompt and wait for completion
            stdout, stderr = process.communicate(input=prompt, timeout=self.options.timeout)
            
            self.active_processes.pop(session_id, None)
            
            if process.returncode == 0:
                return {
                    'output': stdout.strip(),
                    'exit_code': 0
                }
            else:
                # Handle specific error cases
                if 'authentication' in stderr.lower() or 'unauthorized' in stderr.lower():
                    raise ClaudeAuthError(f"Authentication required: {stderr}")
                elif 'api key' in stderr.lower():
                    raise ClaudeAuthError(f"API key issue: {stderr}")
                else:
                    raise ClaudeCodeError(f"Claude process exited with code {process.returncode}: {stderr}")
                    
        except subprocess.TimeoutExpired:
            process.kill()
            self.active_processes.pop(session_id, None)
            raise ClaudeTimeoutError(f"Claude execution timed out after {self.options.timeout} seconds")
    
    def _handle_streaming_process(self, 
                                 process: subprocess.Popen, 
                                 session_id: str, 
                                 prompt: str,
                                 on_message: Optional[Callable[[ClaudeMessage], None]],
                                 on_progress: Optional[Callable[[str], None]]) -> Dict[str, Any]:
        """Handle a streaming Claude process"""
        
        # Send prompt
        process.stdin.write(prompt)
        process.stdin.flush()
        process.stdin.close()
        
        output_lines = []
        
        try:
            # Read output line by line
            while True:
                line = process.stdout.readline()
                if not line:
                    break
                    
                line = line.strip()
                if line:
                    output_lines.append(line)
                    
                    if on_progress:
                        on_progress(line)
                    
                    if on_message:
                        message = self._parse_streaming_line(line)
                        if message:
                            on_message(message)
            
            # Wait for process to complete
            process.wait(timeout=self.options.timeout)
            self.active_processes.pop(session_id, None)
            
            if process.returncode == 0:
                return {
                    'output': '\n'.join(output_lines),
                    'exit_code': 0
                }
            else:
                stderr = process.stderr.read() if process.stderr else ''
                raise ClaudeCodeError(f"Claude process failed: {stderr}")
                
        except subprocess.TimeoutExpired:
            process.kill()
            self.active_processes.pop(session_id, None)
            raise ClaudeTimeoutError(f"Claude streaming timed out after {self.options.timeout} seconds")
    
    def _parse_streaming_line(self, line: str) -> Optional[ClaudeMessage]:
        """Parse a line of streaming output into a ClaudeMessage"""
        # Simple parsing - in a real implementation, you'd parse actual Claude output format
        if 'Tool:' in line or 'using tool' in line.lower():
            return ClaudeMessage(type='tool_use', content=line)
        elif 'Error:' in line or 'error' in line.lower():
            return ClaudeMessage(type='error', content=line, error=line)
        elif line.strip():
            return ClaudeMessage(type='assistant', content=line)
        return None
    
    def _build_claude_args(self) -> List[str]:
        """Build Claude CLI arguments from options"""
        args = []
        
        if self.options.model and self.options.model != 'sonnet':
            args.extend(['--model', self.options.model])
        
        if self.options.max_turns != 10:
            args.extend(['--max-turns', str(self.options.max_turns)])
        
        if self.options.allow_tools:
            args.extend(['--allow-tools', ','.join(self.options.allow_tools)])
        
        if self.options.verbose:
            args.append('--verbose')
            
        return args
    
    def kill_all_processes(self) -> None:
        """Kill all active Claude processes"""
        for session_id, process in list(self.active_processes.items()):
            try:
                process.terminate()
                process.wait(timeout=5)  # Give it 5 seconds to terminate gracefully
            except subprocess.TimeoutExpired:
                process.kill()  # Force kill if it doesn't terminate
            except Exception as e:
                print(f"Warning: Failed to kill process for session {session_id}: {e}")
            finally:
                self.active_processes.pop(session_id, None)
    
    def get_active_processes(self) -> List[str]:
        """Get list of active process session IDs"""
        return list(self.active_processes.keys())
    
    def __del__(self):
        """Cleanup active processes when client is destroyed"""
        self.kill_all_processes()