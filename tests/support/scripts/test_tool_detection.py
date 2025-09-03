#!/usr/bin/env python3
"""
Test script to analyze Claude CLI wrapper's tool detection capabilities
"""

import asyncio
import sys
import os

# Add the directory containing the wrapper to path
current_dir = os.path.dirname(os.path.abspath(__file__))
python_sdk_dir = os.path.join(current_dir, 'python-sdk')
sys.path.insert(0, python_sdk_dir)

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def test_tool_detection():
    """Test the wrapper's ability to detect Claude's tool usage"""
    
    print("=== Testing Tool Detection Capabilities ===\n")
    
    # Create wrapper with tool permissions
    options = ClaudeCliOptions(
        model="sonnet",
        allowed_tools=["Read", "Write", "Edit", "Bash"],
        verbose=True,
        dangerously_skip_permissions=True,
        max_turns=3
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    # Test cases for different tool scenarios
    test_cases = [
        "List the files in the current directory using a tool",
        "Read the contents of this python file: test_tool_detection.py",
        "Write a simple hello.txt file with 'Hello World'",
        "What is the result of 2+2? No tools needed.",
        "Create a test error by trying to read a non-existent file"
    ]
    
    for i, prompt in enumerate(test_cases, 1):
        print(f"\n--- Test Case {i}: {prompt[:50]}... ---")
        
        tool_messages = []
        stream_messages = []
        error_messages = []
        
        try:
            async for message in wrapper.execute(prompt):
                if message.type == "tool_use":
                    tool_messages.append(message.content)
                    print(f"[TOOL DETECTED] {message.content}")
                elif message.type == "stream":
                    stream_messages.append(message.content)
                elif message.type == "error":
                    error_messages.append(message.content)
                    print(f"[ERROR] {message.content}")
                elif message.type == "status":
                    print(f"[STATUS] {message.content}")
        except Exception as e:
            print(f"[EXCEPTION] {e}")
        
        # Analysis
        print(f"Tool messages detected: {len(tool_messages)}")
        print(f"Stream messages: {len(stream_messages)}")
        print(f"Error messages: {len(error_messages)}")
        
        # Short delay between tests
        await asyncio.sleep(1)

def analyze_parse_line_patterns():
    """Analyze the _parse_line method for tool detection patterns"""
    
    print("\n=== Analyzing _parse_line() Tool Detection Patterns ===\n")
    
    wrapper = ClaudeCliWrapper()
    
    # Test various line patterns
    test_lines = [
        "Using tool: Read",
        "Executing: bash command",
        "USING TOOL: Write",
        "executing: edit command",
        "Tool invocation: Read file.txt",
        "Starting Read tool with parameters...",
        "Claude is using the Bash tool",
        "Invoking Write tool",
        "Error: File not found",
        "ERROR: Permission denied",
        "failed: Could not execute",
        "Processing request...",
        "Waiting for response...",
        "Loading model...",
        "Regular output line",
        '{"type": "tool_use", "content": "JSON tool message"}',
        '{"type": "stream", "content": "JSON stream message"}'
    ]
    
    print("Testing line pattern detection:")
    print("-" * 60)
    
    for line in test_lines:
        message = wrapper._parse_line(line)
        print(f"Input:  '{line}'")
        print(f"Output: type='{message.type}', content='{message.content[:50]}...'")
        print()

if __name__ == "__main__":
    # Run pattern analysis first (synchronous)
    analyze_parse_line_patterns()
    
    # Run async tool detection tests
    try:
        asyncio.run(test_tool_detection())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"\nTest failed: {e}")