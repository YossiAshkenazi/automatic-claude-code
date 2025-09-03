"""
High-Level Query Interface
Simple functions that mirror the official Claude Code SDK API
"""

import asyncio
from typing import AsyncGenerator, Optional, List, Dict, Any, Callable, Union
import logging

from ..core.client import ClaudeCodeClient
from ..core.options import ClaudeCodeOptions
from ..core.messages import Message, ResultMessage
from ..exceptions import ClaudeCodeError

logger = logging.getLogger(__name__)

async def query(
    prompt: str,
    *,
    system_prompt: Optional[str] = None,
    allowed_tools: Optional[List[str]] = None,
    max_turns: int = 10,
    model: str = "sonnet",
    timeout: int = 300,
    working_directory: Optional[str] = None,
    verbose: bool = False,
    **kwargs
) -> AsyncGenerator[Message, None]:
    """
    Execute a single query against Claude Code (matches official SDK pattern)
    
    Args:
        prompt: The prompt to send to Claude
        system_prompt: System prompt to define Claude's role
        allowed_tools: List of allowed tools
        max_turns: Maximum conversation turns
        model: Claude model to use
        timeout: Timeout in seconds
        working_directory: Working directory for execution
        verbose: Enable verbose logging
        **kwargs: Additional options
    
    Yields:
        Messages from Claude execution
    
    Example:
        async for message in query("Create a Python function"):
            if isinstance(message, ResultMessage):
                print(message.result)
    """
    options = ClaudeCodeOptions(
        system_prompt=system_prompt,
        allowed_tools=allowed_tools or [],
        max_turns=max_turns,
        model=model,
        timeout=timeout,
        working_directory=working_directory,
        verbose=verbose,
        **kwargs
    )
    
    async with ClaudeCodeClient(options) as client:
        async for message in client.query(prompt):
            yield message

async def query_stream(
    prompt: str,
    on_message: Callable[[Message], None],
    *,
    system_prompt: Optional[str] = None,
    allowed_tools: Optional[List[str]] = None,
    max_turns: int = 10,
    model: str = "sonnet",
    timeout: int = 300,
    working_directory: Optional[str] = None,
    verbose: bool = False,
    **kwargs
) -> Dict[str, Any]:
    """
    Execute a streaming query with real-time message callbacks
    
    Args:
        prompt: The prompt to send to Claude
        on_message: Callback function for each message
        ... (other args same as query)
    
    Returns:
        Summary dictionary with execution results
    """
    messages = []
    final_result = ""
    success = True
    error_message = None
    
    def message_collector(message: Message):
        messages.append(message)
        on_message(message)
        nonlocal final_result
        if isinstance(message, ResultMessage):
            final_result = message.result
    
    try:
        options = ClaudeCodeOptions(
            system_prompt=system_prompt,
            allowed_tools=allowed_tools or [],
            max_turns=max_turns,
            model=model,
            timeout=timeout,
            working_directory=working_directory,
            verbose=verbose,
            stream_response=True,
            **kwargs
        )
        
        async with ClaudeCodeClient(options) as client:
            async for message in client.query(prompt, on_message=message_collector):
                pass  # Messages handled by callback
                
    except Exception as e:
        success = False
        error_message = str(e)
        logger.error(f"Query stream failed: {e}")
    
    return {
        'success': success,
        'final_result': final_result,
        'message_count': len(messages),
        'messages': messages,
        'error': error_message
    }

async def conversation(
    prompts: List[str],
    *,
    system_prompt: Optional[str] = None,
    allowed_tools: Optional[List[str]] = None,
    max_turns: int = 20,
    model: str = "sonnet",
    timeout: int = 600,
    working_directory: Optional[str] = None,
    verbose: bool = False,
    **kwargs
) -> Dict[str, Any]:
    """
    Execute a multi-turn conversation
    
    Args:
        prompts: List of prompts for conversation turns
        ... (other args same as query)
    
    Returns:
        Dictionary with conversation results
    """
    all_messages = []
    conversation_results = []
    success = True
    error_message = None
    
    try:
        options = ClaudeCodeOptions(
            system_prompt=system_prompt,
            allowed_tools=allowed_tools or [],
            max_turns=max_turns,
            model=model,
            timeout=timeout,
            working_directory=working_directory,
            verbose=verbose,
            continue_conversation=True,
            **kwargs
        )
        
        async with ClaudeCodeClient(options) as client:
            for i, prompt in enumerate(prompts):
                turn_messages = []
                turn_result = ""
                
                logger.info(f"Conversation turn {i+1}: {prompt[:100]}...")
                
                async for message in client.query(prompt):
                    turn_messages.append(message)
                    all_messages.append(message)
                    
                    if isinstance(message, ResultMessage):
                        turn_result = message.result
                
                conversation_results.append({
                    'turn': i + 1,
                    'prompt': prompt,
                    'result': turn_result,
                    'messages': turn_messages
                })
                
    except Exception as e:
        success = False
        error_message = str(e)
        logger.error(f"Conversation failed: {e}")
    
    return {
        'success': success,
        'total_turns': len(conversation_results),
        'conversation_results': conversation_results,
        'all_messages': all_messages,
        'final_result': conversation_results[-1]['result'] if conversation_results else "",
        'error': error_message
    }

async def check_claude() -> Dict[str, Any]:
    """
    Check Claude CLI availability and get diagnostic information
    
    Returns:
        Dictionary with availability and diagnostic info
    """
    try:
        # Create a minimal client to test availability
        options = ClaudeCodeOptions(timeout=10)
        
        async with ClaudeCodeClient(options) as client:
            return {
                'available': True,
                'cli_path': client.claude_cli_path,
                'client_ready': client.is_ready,
                'message': 'Claude CLI is available and working'
            }
            
    except ClaudeCodeError as e:
        return {
            'available': False,
            'error': e.message,
            'error_code': e.error_code,
            'error_type': e.__class__.__name__,
            'recoverable': e.recoverable,
            'message': f'Claude CLI check failed: {e.message}'
        }
    except Exception as e:
        return {
            'available': False,
            'error': str(e),
            'error_type': e.__class__.__name__,
            'message': f'Unexpected error during Claude CLI check: {e}'
        }

# Simple synchronous wrappers for backward compatibility
def query_sync(prompt: str, **kwargs) -> str:
    """Synchronous wrapper for query function"""
    async def _run():
        result = ""
        async for message in query(prompt, **kwargs):
            if isinstance(message, ResultMessage):
                result = message.result
                break
        return result
    
    return asyncio.run(_run())

def check_claude_sync() -> Dict[str, Any]:
    """Synchronous wrapper for check_claude function"""
    return asyncio.run(check_claude())

# Aliases for compatibility with official SDK patterns
claude_code_query = query
claude_code_stream = query_stream
claude_code_conversation = conversation