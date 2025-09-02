"""
Claude Code Query Interface
High-level interface similar to the official Python SDK
"""

from typing import Optional, List, Dict, Any, Callable
import subprocess
import shutil

from .client import ClaudeCodeClient
from .session import ClaudeSessionOptions, ClaudeMessage
from .exceptions import ClaudeCodeError, ClaudeNotFoundError

def query(prompt: str, 
         model: str = 'sonnet',
         max_turns: int = 10,
         timeout: int = 300,
         working_directory: Optional[str] = None,
         allow_tools: Optional[List[str]] = None,
         verbose: bool = False,
         return_messages: bool = False,
         **kwargs) -> Dict[str, Any]:
    """
    Simple query function - equivalent to the official Python SDK's query()
    
    Args:
        prompt: The prompt to send to Claude
        model: Model to use ('sonnet', 'opus', 'haiku')
        max_turns: Maximum number of conversation turns
        timeout: Timeout in seconds
        working_directory: Working directory for Claude execution
        allow_tools: List of allowed tools
        verbose: Enable verbose output
        return_messages: Whether to return full message history
        **kwargs: Additional options
    
    Returns:
        Dictionary with execution results
    """
    options = ClaudeSessionOptions(
        model=model,
        max_turns=max_turns,
        timeout=timeout,
        working_directory=working_directory,
        allow_tools=allow_tools or [],
        verbose=verbose,
        **kwargs
    )
    
    client = ClaudeCodeClient(options)
    
    try:
        result = client.execute(prompt)
        
        response = {
            'content': result.final_message,
            'session_id': result.session_id,
            'success': result.success,
            'execution_time': result.execution_time,
            'total_turns': result.total_turns
        }
        
        if return_messages:
            response['messages'] = [msg.to_dict() for msg in result.messages]
            
        return response
        
    except Exception as e:
        return {
            'content': f'Error: {str(e)}',
            'session_id': 'error-session',
            'success': False,
            'execution_time': 0.0,
            'total_turns': 0,
            'error': str(e)
        }

def query_stream(prompt: str,
                on_message: Callable[[ClaudeMessage], None],
                on_progress: Optional[Callable[[str], None]] = None,
                model: str = 'sonnet',
                max_turns: int = 10,
                timeout: int = 300,
                working_directory: Optional[str] = None,
                allow_tools: Optional[List[str]] = None,
                verbose: bool = False,
                return_messages: bool = False,
                **kwargs) -> Dict[str, Any]:
    """
    Streaming query function with real-time callbacks
    
    Args:
        prompt: The prompt to send to Claude
        on_message: Callback function for each message
        on_progress: Optional callback for progress updates
        ... (other args same as query)
    
    Returns:
        Dictionary with execution results
    """
    options = ClaudeSessionOptions(
        model=model,
        max_turns=max_turns,
        timeout=timeout,
        working_directory=working_directory,
        allow_tools=allow_tools or [],
        verbose=verbose,
        **kwargs
    )
    
    client = ClaudeCodeClient(options)
    
    try:
        result = client.execute(
            prompt, 
            stream=True, 
            on_message=on_message,
            on_progress=on_progress
        )
        
        response = {
            'content': result.final_message,
            'session_id': result.session_id,
            'success': result.success,
            'execution_time': result.execution_time,
            'total_turns': result.total_turns
        }
        
        if return_messages:
            response['messages'] = [msg.to_dict() for msg in result.messages]
            
        return response
        
    except Exception as e:
        return {
            'content': f'Error: {str(e)}',
            'session_id': 'error-session',
            'success': False,
            'execution_time': 0.0,
            'total_turns': 0,
            'error': str(e)
        }

def conversation(prompts: List[str],
                model: str = 'sonnet',
                max_turns: int = 10,
                timeout: int = 300,
                working_directory: Optional[str] = None,
                allow_tools: Optional[List[str]] = None,
                verbose: bool = False,
                return_messages: bool = False,
                **kwargs) -> Dict[str, Any]:
    """
    Multi-turn conversation function
    
    Args:
        prompts: List of prompts for multi-turn conversation
        ... (other args same as query)
    
    Returns:
        Dictionary with execution results
    """
    options = ClaudeSessionOptions(
        model=model,
        max_turns=max_turns,
        timeout=timeout,
        working_directory=working_directory,
        allow_tools=allow_tools or [],
        verbose=verbose,
        **kwargs
    )
    
    client = ClaudeCodeClient(options)
    session = client.create_session(options)
    
    try:
        result = client.execute_session(session, prompts)
        
        response = {
            'content': result.final_message,
            'session_id': result.session_id,
            'success': result.success,
            'execution_time': result.execution_time,
            'total_turns': result.total_turns
        }
        
        if return_messages:
            response['messages'] = [msg.to_dict() for msg in result.messages]
            
        return response
        
    except Exception as e:
        return {
            'content': f'Error: {str(e)}',
            'session_id': 'error-session',
            'success': False,
            'execution_time': 0.0,
            'total_turns': 0,
            'error': str(e)
        }

def check_claude() -> Dict[str, Any]:
    """
    Check if Claude CLI is available and get version info
    
    Returns:
        Dictionary with availability status and version info
    """
    try:
        # Try to find claude command
        claude_path = shutil.which('claude')
        if not claude_path:
            return {
                'available': False,
                'error': 'Claude CLI not found in PATH'
            }
        
        # Try to get version
        try:
            result = subprocess.run(
                ['claude', '--version'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode == 0:
                return {
                    'available': True,
                    'version': result.stdout.strip(),
                    'path': claude_path
                }
            else:
                return {
                    'available': False,
                    'error': f'Claude CLI returned error: {result.stderr}'
                }
                
        except subprocess.TimeoutExpired:
            return {
                'available': False,
                'error': 'Claude CLI version check timed out'
            }
            
    except Exception as e:
        return {
            'available': False,
            'error': f'Error checking Claude CLI: {str(e)}'
        }

# Convenience aliases matching the official SDK
claude_code_query = query
claude_code_stream = query_stream