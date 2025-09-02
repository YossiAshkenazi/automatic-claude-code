#!/usr/bin/env python3
"""
Streaming Example - Real-time response streaming from Claude CLI
Demonstrates: Streaming responses, real-time output, progress indicators
"""

import asyncio
import sys
from pathlib import Path
import time

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions, CliMessage


async def basic_streaming_example():
    """Basic streaming example with real-time output"""
    
    options = ClaudeCliOptions(
        model="sonnet",
        max_turns=5,
        verbose=False,  # Keep output clean for streaming
        timeout=120
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("❌ Claude CLI not available")
        return
    
    print("🎬 Streaming Response Example")
    print("=" * 50)
    
    # Complex prompt that will generate substantial response
    prompt = """
    Write a detailed explanation of how async/await works in Python, including:
    1. The event loop concept
    2. Coroutines vs regular functions
    3. Two practical examples with code
    4. Common pitfalls to avoid
    
    Make it educational and comprehensive.
    """
    
    try:
        print("📝 Query: How async/await works in Python (detailed)")
        print("\n🔄 Streaming response:\n")
        print("=" * 60)
        
        full_response = ""
        message_count = 0
        start_time = time.time()
        
        # Stream the response
        async for message in wrapper.execute(prompt):
            message_count += 1
            
            if message.type == "content":
                # Print content as it arrives
                print(message.content, end="", flush=True)
                full_response += message.content
                
            elif message.type == "tool_use":
                print(f"\n🔧 [Tool: {message.content}]", flush=True)
                
            elif message.type == "thinking":
                print(f"\n💭 [Thinking: {message.content[:50]}...]", flush=True)
                
            elif message.type == "error":
                print(f"\n❌ [Error: {message.content}]", flush=True)
                
        elapsed = time.time() - start_time
        
        print(f"\n\n{'='*60}")
        print(f"✅ Streaming completed!")
        print(f"📊 Stats: {message_count} messages, {len(full_response)} chars, {elapsed:.2f}s")
        
    except Exception as e:
        print(f"❌ Streaming error: {e}")
    finally:
        await wrapper.cleanup()


async def progress_streaming_example():
    """Streaming with progress indicators and formatting"""
    
    options = ClaudeCliOptions(
        model="sonnet",
        max_turns=3,
        verbose=False
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("❌ Claude CLI not available")
        return
    
    print("\n🎯 Enhanced Streaming with Progress")
    print("=" * 50)
    
    prompt = "Create a Python script that demonstrates 5 different design patterns with examples"
    
    try:
        print("📝 Generating Python design patterns examples...")
        print("🔄 Progress: ", end="", flush=True)
        
        response_parts = []
        char_count = 0
        
        async for message in wrapper.execute(prompt):
            if message.type == "content":
                response_parts.append(message.content)
                char_count += len(message.content)
                
                # Show progress dots
                if char_count % 100 == 0:  # Every 100 characters
                    print(".", end="", flush=True)
                    
            elif message.type == "tool_use":
                print(f"\n🔧 Using tool: {message.content}")
                print("🔄 Continuing: ", end="", flush=True)
        
        print("\n\n📖 Complete Response:")
        print("=" * 50)
        
        full_response = "".join(response_parts)
        
        # Pretty print with line numbers for code blocks
        lines = full_response.split('\n')
        for i, line in enumerate(lines, 1):
            if line.strip().startswith('```'):
                print(f"│ {line}")
            elif line.strip().startswith('#') or line.strip().startswith('def ') or line.strip().startswith('class '):
                print(f"│ {line}")
            else:
                print(f"│ {line}")
        
        print(f"\n✅ Generated {len(lines)} lines, {char_count} characters")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await wrapper.cleanup()


async def multi_query_streaming():
    """Demonstrate multiple streaming queries in sequence"""
    
    options = ClaudeCliOptions(
        model="sonnet",
        max_turns=2,
        verbose=False
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("❌ Claude CLI not available")
        return
    
    queries = [
        "Explain Python decorators in 2 sentences",
        "Write a simple decorator example",
        "What's the difference between @property and @staticmethod?"
    ]
    
    print("\n🔄 Multiple Streaming Queries")
    print("=" * 50)
    
    try:
        for i, query in enumerate(queries, 1):
            print(f"\n📝 Query {i}: {query}")
            print(f"🤖 Response {i}:")
            print("-" * 40)
            
            async for message in wrapper.execute(query):
                if message.type == "content":
                    print(message.content, end="", flush=True)
            
            print()  # New line after each response
            
            # Small delay between queries
            await asyncio.sleep(1)
        
        print("\n✅ All queries completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await wrapper.cleanup()


if __name__ == "__main__":
    print("🎬 Claude CLI Wrapper - Streaming Examples")
    
    # Run all streaming examples
    asyncio.run(basic_streaming_example())
    
    input("\n⏸️  Press Enter to continue to enhanced streaming...")
    asyncio.run(progress_streaming_example())
    
    input("\n⏸️  Press Enter to continue to multi-query streaming...")
    asyncio.run(multi_query_streaming())