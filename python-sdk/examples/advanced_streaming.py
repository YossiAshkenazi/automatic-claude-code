#!/usr/bin/env python3
"""
Advanced Streaming Example - ClaudeSDKClient
===========================================

This example demonstrates advanced streaming patterns including:
- Real-time message processing
- Custom stream handlers  
- Message filtering and transformation
- Concurrent streaming operations
- Stream state management

Requirements:
    - Python 3.10+
    - Claude Code CLI installed and configured
    - claude-code-sdk package installed

Usage:
    python advanced_streaming.py
"""

import asyncio
import time
from typing import AsyncGenerator, List, Optional
from dataclasses import dataclass
from claude_code_sdk import ClaudeSDKClient, query_stream
from claude_code_sdk.core.options import create_streaming_options
from claude_code_sdk.interfaces.streaming import (
    StreamingHandler, MessageCollector, StreamProcessor,
    collect_all_messages, get_final_result, result_only_filter
)
from claude_code_sdk.core.messages import BaseMessage, ResultMessage, ToolUseMessage
from claude_code_sdk.exceptions import ClaudeCodeError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class StreamMetrics:
    """Tracks streaming performance metrics."""
    start_time: float
    message_count: int = 0
    total_chars: int = 0
    error_count: int = 0
    tool_uses: int = 0


class CustomStreamHandler(StreamingHandler):
    """
    Custom stream handler that processes messages with real-time analytics.
    """
    
    def __init__(self):
        self.metrics = StreamMetrics(start_time=time.time())
        self.messages: List[BaseMessage] = []
        
    async def handle_message(self, message: BaseMessage) -> None:
        """Process each streaming message."""
        self.messages.append(message)
        self.metrics.message_count += 1
        
        if isinstance(message, ResultMessage):
            self.metrics.total_chars += len(message.result or "")
            print(f"📄 Result chunk ({len(message.result or '')} chars): {(message.result or '')[:80]}...")
            
        elif isinstance(message, ToolUseMessage):
            self.metrics.tool_uses += 1
            print(f"🔧 Tool usage: {message.tool_name} - {message.description[:50]}...")
            
        elif hasattr(message, 'error') and message.error:
            self.metrics.error_count += 1
            print(f"❌ Error: {message.error}")
            
    def get_summary(self) -> dict:
        """Get streaming session summary."""
        elapsed = time.time() - self.metrics.start_time
        return {
            "duration_seconds": round(elapsed, 2),
            "messages_processed": self.metrics.message_count,
            "total_characters": self.metrics.total_chars,
            "characters_per_second": round(self.metrics.total_chars / elapsed if elapsed > 0 else 0, 1),
            "errors": self.metrics.error_count,
            "tool_uses": self.metrics.tool_uses,
            "messages": self.messages
        }


async def basic_streaming_example():
    """
    Demonstrates basic streaming with real-time processing.
    """
    print("🔵 Basic Streaming Example")
    print("=" * 40)
    
    handler = CustomStreamHandler()
    
    try:
        # Stream a complex task
        async for message in query_stream(
            "Create a Python class for a simple todo list manager with add, remove, and list methods"
        ):
            await handler.handle_message(message)
            
        # Show summary
        summary = handler.get_summary()
        print(f"\n📊 Stream Summary:")
        print(f"   Duration: {summary['duration_seconds']}s")
        print(f"   Messages: {summary['messages_processed']}")
        print(f"   Characters: {summary['total_characters']}")
        print(f"   Speed: {summary['characters_per_second']} chars/sec")
        print(f"   Errors: {summary['errors']}")
        print(f"   Tool uses: {summary['tool_uses']}")
        
    except ClaudeCodeError as e:
        print(f"Streaming error: {e}")
        
    print()


async def filtered_streaming_example():
    """
    Demonstrates message filtering during streaming.
    """
    print("🔵 Filtered Streaming Example")
    print("=" * 40)
    
    try:
        # Create a custom filter for code-related messages
        def code_filter(message: BaseMessage) -> bool:
            """Filter for messages containing code."""
            if isinstance(message, ResultMessage) and message.result:
                return any(keyword in message.result.lower() 
                          for keyword in ['def ', 'class ', 'import ', 'return '])
            return False
        
        # Stream with filtering
        code_messages = []
        async for message in query_stream("Write a Python function to calculate prime numbers"):
            if code_filter(message):
                code_messages.append(message)
                print(f"💻 Code chunk: {message.result[:100]}...")
                
        print(f"\n📝 Found {len(code_messages)} code-related messages")
        
    except ClaudeCodeError as e:
        print(f"Filtered streaming error: {e}")
        
    print()


async def concurrent_streaming_example():
    """
    Demonstrates multiple concurrent streaming operations.
    """
    print("🔵 Concurrent Streaming Example")
    print("=" * 40)
    
    async def stream_task(task_id: int, prompt: str) -> dict:
        """Stream a single task and return summary."""
        handler = CustomStreamHandler()
        
        try:
            async for message in query_stream(prompt):
                await handler.handle_message(message)
                
            summary = handler.get_summary()
            summary['task_id'] = task_id
            summary['prompt'] = prompt[:50] + "..."
            return summary
            
        except Exception as e:
            return {
                'task_id': task_id,
                'error': str(e),
                'prompt': prompt[:50] + "..."
            }
    
    # Define multiple tasks to run concurrently
    tasks = [
        (1, "Create a Python function for sorting a list"),
        (2, "Write a function to validate email addresses"),
        (3, "Create a simple calculator class"),
    ]
    
    try:
        # Run all tasks concurrently
        print("🚀 Starting 3 concurrent streaming tasks...")
        
        concurrent_tasks = [stream_task(task_id, prompt) for task_id, prompt in tasks]
        results = await asyncio.gather(*concurrent_tasks, return_exceptions=True)
        
        # Display results
        print(f"\n📊 Concurrent Streaming Results:")
        for result in results:
            if isinstance(result, Exception):
                print(f"   ❌ Task failed: {result}")
            elif 'error' in result:
                print(f"   ❌ Task {result['task_id']}: {result['error']}")
            else:
                print(f"   ✅ Task {result['task_id']}: {result['messages_processed']} messages, "
                      f"{result['duration_seconds']}s, {result['characters_per_second']} chars/sec")
                
    except Exception as e:
        print(f"Concurrent streaming error: {e}")
        
    print()


async def client_streaming_example():
    """
    Demonstrates streaming with ClaudeSDKClient context manager.
    """
    print("🔵 Client Streaming Example")
    print("=" * 40)
    
    options = create_streaming_options(
        timeout=120,
        model="claude-3-sonnet-20241022"
    )
    
    try:
        async with ClaudeSDKClient(options) as client:
            print("🔄 Starting client-based streaming...")
            
            # Use the client's streaming capability
            response_chunks = []
            
            async for chunk in client.stream("Explain how Python generators work with examples"):
                if hasattr(chunk, 'result') and chunk.result:
                    response_chunks.append(chunk.result)
                    print(f"📦 Chunk {len(response_chunks)}: {chunk.result[:60]}...")
                    
            # Combine all chunks
            full_response = "".join(response_chunks)
            print(f"\n📋 Complete response ({len(full_response)} characters):")
            print(f"   {full_response[:200]}...")
            
    except ClaudeCodeError as e:
        print(f"Client streaming error: {e}")
        
    print()


async def stream_processor_example():
    """
    Demonstrates advanced stream processing with transformation.
    """
    print("🔵 Stream Processor Example")
    print("=" * 40)
    
    class CodeExtractor(StreamProcessor):
        """Extract and format code blocks from streaming responses."""
        
        def __init__(self):
            self.code_blocks = []
            self.current_block = []
            self.in_code = False
            
        async def process_message(self, message: BaseMessage) -> Optional[BaseMessage]:
            """Process and transform messages."""
            if isinstance(message, ResultMessage) and message.result:
                lines = message.result.split('\n')
                
                for line in lines:
                    if line.strip().startswith('```'):
                        if self.in_code:
                            # End of code block
                            self.code_blocks.append('\n'.join(self.current_block))
                            self.current_block = []
                            self.in_code = False
                        else:
                            # Start of code block
                            self.in_code = True
                    elif self.in_code:
                        self.current_block.append(line)
                        
            return message  # Pass through original message
            
        def get_extracted_code(self) -> List[str]:
            """Get all extracted code blocks."""
            return self.code_blocks.copy()
    
    try:
        processor = CodeExtractor()
        
        # Process streaming response
        async for message in query_stream(
            "Create a Python web scraper using requests and BeautifulSoup with error handling"
        ):
            await processor.process_message(message)
            
        # Get extracted code
        code_blocks = processor.get_extracted_code()
        
        print(f"🔍 Extracted {len(code_blocks)} code blocks:")
        for i, block in enumerate(code_blocks, 1):
            print(f"   Block {i} ({len(block)} characters):")
            print(f"   {block[:100]}...")
            print()
            
    except ClaudeCodeError as e:
        print(f"Stream processing error: {e}")
        
    print()


async def stream_state_management_example():
    """
    Demonstrates managing streaming state across multiple operations.
    """
    print("🔵 Stream State Management Example")
    print("=" * 40)
    
    class StatefulStreamHandler:
        """Maintains state across streaming operations."""
        
        def __init__(self):
            self.conversation_history = []
            self.accumulated_response = ""
            self.operation_count = 0
            
        async def handle_streaming_operation(self, prompt: str):
            """Handle a streaming operation while maintaining state."""
            self.operation_count += 1
            operation_response = ""
            
            print(f"🔄 Operation {self.operation_count}: {prompt[:50]}...")
            
            try:
                async for message in query_stream(prompt):
                    if isinstance(message, ResultMessage) and message.result:
                        operation_response += message.result
                        self.accumulated_response += message.result
                        
                # Store in history
                self.conversation_history.append({
                    'operation': self.operation_count,
                    'prompt': prompt,
                    'response': operation_response,
                    'timestamp': time.time()
                })
                
                print(f"   ✅ Completed ({len(operation_response)} chars)")
                
            except Exception as e:
                print(f"   ❌ Failed: {e}")
                
        def get_state_summary(self) -> dict:
            """Get current state summary."""
            return {
                'operations_completed': self.operation_count,
                'total_response_length': len(self.accumulated_response),
                'conversation_history': len(self.conversation_history),
                'last_operation': self.conversation_history[-1] if self.conversation_history else None
            }
    
    try:
        handler = StatefulStreamHandler()
        
        # Sequence of related operations
        operations = [
            "Create a Python function to read a CSV file",
            "Now modify that function to handle errors gracefully",
            "Add data validation to the CSV reading function",
        ]
        
        for operation in operations:
            await handler.handle_streaming_operation(operation)
            await asyncio.sleep(0.5)  # Brief pause between operations
            
        # Show final state
        state = handler.get_state_summary()
        print(f"\n📊 Final State Summary:")
        print(f"   Operations: {state['operations_completed']}")
        print(f"   Total response length: {state['total_response_length']} characters")
        print(f"   Conversation entries: {state['conversation_history']}")
        
        if state['last_operation']:
            last_op = state['last_operation']
            print(f"   Last operation: #{last_op['operation']} - {last_op['prompt'][:40]}...")
            
    except Exception as e:
        print(f"State management error: {e}")
        
    print()


async def main():
    """
    Main function that runs all advanced streaming examples.
    """
    print("🚀 Claude SDK Client - Advanced Streaming Examples")
    print("=" * 55)
    print()
    
    # Run all examples
    await basic_streaming_example()
    await filtered_streaming_example()
    await concurrent_streaming_example()
    await client_streaming_example()
    await stream_processor_example()
    await stream_state_management_example()
    
    print("✅ All advanced streaming examples completed!")
    print()
    print("Key takeaways:")
    print("- Use custom handlers for real-time processing")
    print("- Filter messages for specific content types")
    print("- Run concurrent streams for parallel processing")
    print("- Maintain state across streaming operations")
    print("- Process and transform streams as they arrive")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Streaming examples interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error running streaming examples: {e}")
        logger.exception("Error running advanced streaming examples")