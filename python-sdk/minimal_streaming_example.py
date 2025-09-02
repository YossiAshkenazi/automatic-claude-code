#!/usr/bin/env python3
"""
Minimal Claude Code SDK Streaming Example
A simple script demonstrating real-time output streaming with the Claude Code SDK.

Usage:
    python minimal_streaming_example.py

Requirements:
    - Claude CLI installed (@anthropic-ai/claude-code)
    - Valid authentication configured
"""

import asyncio
import sys
import time
from pathlib import Path

# Import the Claude Code SDK components
from claude_code_sdk.core.client import ClaudeCodeClient
from claude_code_sdk.core.options import ClaudeCodeOptions
from claude_code_sdk.core.messages import Message, ResultMessage, ErrorMessage, StreamMessage, ToolUseMessage
from claude_code_sdk.exceptions import (
    ClaudeCodeError, ClaudeAuthError, ClaudeNotFoundError, ClaudeTimeoutError, classify_error
)
from claude_code_sdk.interfaces.streaming import StreamingHandler, MessageCollector

def print_message(prefix: str, content: str, color: str = ""):
    """Print a formatted message with optional color and timestamp"""
    timestamp = time.strftime("%H:%M:%S")
    if color == "green":
        print(f"\033[92m[{timestamp}] {prefix}: {content}\033[0m")
    elif color == "red":
        print(f"\033[91m[{timestamp}] {prefix}: {content}\033[0m")
    elif color == "yellow":
        print(f"\033[93m[{timestamp}] {prefix}: {content}\033[0m")
    elif color == "blue":
        print(f"\033[94m[{timestamp}] {prefix}: {content}\033[0m")
    else:
        print(f"[{timestamp}] {prefix}: {content}")

async def stream_claude_response(prompt: str, working_dir: str = None):
    """
    Execute a prompt and stream the response in real-time
    
    Args:
        prompt: The prompt to send to Claude
        working_dir: Working directory for Claude execution
    """
    
    print_message("INIT", "Starting minimal Claude Code SDK streaming example...", "blue")
    print_message("PROMPT", f"Query: {prompt[:100]}{'...' if len(prompt) > 100 else ''}", "blue")
    
    # Configure options for streaming
    options = ClaudeCodeOptions(
        stream_response=True,
        verbose=False,  # Keep it minimal
        timeout=60,
        working_directory=Path(working_dir) if working_dir else Path.cwd()
    )
    
    # Create streaming handler for real-time output
    def on_stream_content(content: str):
        print_message("STREAM", content.strip(), "green")
    
    def on_tool_use(tool_msg: ToolUseMessage):
        print_message("TOOL", f"Using {tool_msg.tool_name}", "yellow")
    
    def on_error(error_msg: ErrorMessage):
        print_message("ERROR", f"{error_msg.error}", "red")
    
    def on_result(result: str):
        print_message("RESULT", f"Final result received ({len(result)} chars)", "green")
    
    streaming_handler = StreamingHandler(
        on_stream=on_stream_content,
        on_tool_use=on_tool_use,
        on_error=on_error,
        on_result=on_result,
        collect_messages=True
    )
    
    start_time = time.time()
    
    try:
        # Use async context manager for proper resource cleanup
        async with ClaudeCodeClient(options) as client:
            print_message("CLIENT", "Connected to Claude Code CLI", "green")
            print_message("CLIENT", f"CLI Path: {client.claude_cli_path}", "blue")
            
            print_message("EXEC", "Starting query execution...", "blue")
            print("-" * 50)
            
            # Stream messages as they arrive
            final_result = ""
            message_count = 0
            
            async for message in client.query(prompt, stream=True):
                message_count += 1
                
                # Handle the message through our streaming handler
                streaming_handler.handle_message(message)
                
                # Keep track of the final result
                if isinstance(message, ResultMessage) and message.result:
                    final_result = message.result
                elif hasattr(message, 'content') and message.content:
                    final_result += message.content
            
            print("-" * 50)
            
            # Show summary
            duration = time.time() - start_time
            collector = streaming_handler.get_collector()
            
            print_message("SUMMARY", f"Execution completed in {duration:.2f} seconds", "blue")
            print_message("SUMMARY", f"Messages received: {message_count}", "blue")
            
            if collector:
                summary = collector.get_summary()
                print_message("SUMMARY", f"Tool uses: {summary['tools_used']}", "blue")
                print_message("SUMMARY", f"Errors: {len(collector.get_errors())}", "blue")
                
                if summary['final_result']:
                    print_message("SUMMARY", f"Final result length: {len(summary['final_result'])} chars", "blue")
            
            print_message("SUCCESS", "Streaming example completed successfully!", "green")
            return final_result
            
    except ClaudeNotFoundError as e:
        print_message("ERROR", "Claude CLI not found. Please install it:", "red")
        print_message("HELP", "npm install -g @anthropic-ai/claude-code", "yellow")
        return None
        
    except ClaudeAuthError as e:
        print_message("ERROR", "Authentication failed. Please configure Claude CLI:", "red")
        print_message("HELP", "Run 'claude auth' to set up authentication", "yellow")
        return None
        
    except ClaudeTimeoutError as e:
        print_message("ERROR", f"Query timed out after {options.timeout} seconds", "red")
        return None
        
    except ClaudeCodeError as e:
        print_message("ERROR", f"Claude SDK error: {e.message}", "red")
        if hasattr(e, 'error_code'):
            print_message("ERROR", f"Error code: {e.error_code}", "red")
        return None
        
    except Exception as e:
        print_message("ERROR", f"Unexpected error: {str(e)}", "red")
        return None

async def main():
    """Main entry point"""
    print("🤖 Minimal Claude Code SDK - Real-time Streaming Example")
    print("=" * 60)
    
    # Default prompt for demonstration
    default_prompt = "What is 2+2? Please show your calculation step by step."
    
    # Allow custom prompt from command line
    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
    else:
        prompt = default_prompt
        print_message("INFO", "Using default prompt. Pass custom prompt as arguments.", "yellow")
    
    try:
        # Execute the streaming query
        result = await stream_claude_response(prompt)
        
        if result is not None:
            print_message("COMPLETE", "Example finished successfully", "green")
            return 0
        else:
            print_message("FAILED", "Example failed to complete", "red")
            return 1
            
    except KeyboardInterrupt:
        print_message("INTERRUPT", "Execution interrupted by user", "yellow")
        return 1
    except Exception as e:
        print_message("CRASH", f"Example crashed: {str(e)}", "red")
        return 1

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except Exception as e:
        print(f"💥 Fatal error: {e}")
        sys.exit(1)