#!/usr/bin/env python3
"""
Basic Usage Examples for Claude Code SDK
Demonstrates fundamental patterns and usage
"""

import asyncio
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions, query, ResultMessage

async def example_1_simple_query():
    """Example 1: Simple query using high-level function"""
    print("🔹 Example 1: Simple Query Function")
    
    try:
        async for message in query("Create a Python function that calculates the factorial of a number"):
            if isinstance(message, ResultMessage):
                print(f"✅ Result: {message.result[:200]}...")
                return message.result
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

async def example_2_client_usage():
    """Example 2: Using ClaudeSDKClient with context manager"""
    print("\n🔹 Example 2: ClaudeSDKClient Usage")
    
    options = ClaudeCodeOptions(
        model="sonnet",
        verbose=True,
        allowed_tools=["Read", "Write", "Edit"]
    )
    
    try:
        async with ClaudeSDKClient(options) as client:
            print(f"📡 Client ready with CLI path: {client.claude_cli_path}")
            
            async for message in client.query("Write a simple Hello World program in Python"):
                if isinstance(message, ResultMessage):
                    print(f"✅ Generated code: {message.result[:100]}...")
                    return message.result
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

async def example_3_streaming():
    """Example 3: Streaming responses"""
    print("\n🔹 Example 3: Streaming Responses")
    
    try:
        print("📡 Starting streaming query...")
        result_parts = []
        
        async for message in query("Explain Python decorators with examples", stream=True):
            if hasattr(message, 'content') and message.content:
                print(".", end="", flush=True)  # Progress indicator
                result_parts.append(message.content)
            elif isinstance(message, ResultMessage):
                result_parts.append(message.result)
                break
        
        print("\n✅ Streaming complete!")
        full_result = "".join(result_parts)
        print(f"📝 Total content: {len(full_result)} characters")
        return full_result
        
    except Exception as e:
        print(f"❌ Streaming error: {e}")
        return None

async def example_4_error_handling():
    """Example 4: Comprehensive error handling"""
    print("\n🔹 Example 4: Error Handling")
    
    from claude_code_sdk import ClaudeTimeoutError, ClaudeAuthError, ClaudeNotFoundError
    
    options = ClaudeCodeOptions(
        timeout=5  # Very short timeout to demonstrate timeout handling
    )
    
    try:
        async with ClaudeSDKClient(options) as client:
            async for message in client.query("Write a comprehensive web application"):
                if isinstance(message, ResultMessage):
                    print(f"✅ Unexpected success: {message.result[:50]}...")
                    
    except ClaudeTimeoutError:
        print("⏰ Query timed out - this is expected with 5s timeout")
    except ClaudeAuthError:
        print("🔐 Authentication required - run 'claude auth'")
    except ClaudeNotFoundError:
        print("🔍 Claude CLI not found - install with 'npm install -g @anthropic-ai/claude-code'")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

async def example_5_configuration():
    """Example 5: Different configuration patterns"""
    print("\n🔹 Example 5: Configuration Patterns")
    
    from claude_code_sdk import create_development_options, create_production_options
    
    # Development configuration
    print("⚙️ Development configuration:")
    dev_options = create_development_options(verbose=True)
    print(f"  Model: {dev_options.model}")
    print(f"  Tools: {dev_options.allowed_tools}")
    print(f"  Timeout: {dev_options.timeout}s")
    
    # Production configuration
    print("\n⚙️ Production configuration:")
    prod_options = create_production_options(timeout=30)
    print(f"  Model: {prod_options.model}")
    print(f"  Tools: {prod_options.allowed_tools}")
    print(f"  Timeout: {prod_options.timeout}s")
    
    # Custom configuration
    print("\n⚙️ Custom configuration:")
    custom_options = ClaudeCodeOptions(
        model="opus",
        system_prompt="You are a helpful Python programming assistant.",
        allowed_tools=["Read", "Write", "Edit", "Bash"],
        max_turns=15,
        verbose=False
    )
    print(f"  Model: {custom_options.model}")
    print(f"  System prompt: {custom_options.system_prompt[:50]}...")

async def main():
    """Run all examples"""
    print("🐍 Claude Code SDK - Basic Usage Examples")
    print("=" * 50)
    
    examples = [
        ("Simple Query", example_1_simple_query),
        ("Client Usage", example_2_client_usage), 
        ("Streaming", example_3_streaming),
        ("Error Handling", example_4_error_handling),
        ("Configuration", example_5_configuration)
    ]
    
    results = {}
    
    for name, example_func in examples:
        try:
            print(f"\n🚀 Running: {name}")
            result = await example_func()
            results[name] = result
            print(f"✅ Completed: {name}")
        except Exception as e:
            print(f"❌ Failed: {name} - {e}")
            results[name] = None
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Examples Summary")
    print("=" * 50)
    
    successful = sum(1 for result in results.values() if result is not None)
    total = len(results)
    
    for name, result in results.items():
        status = "✅" if result is not None else "❌"
        print(f"{status} {name}")
    
    print(f"\n🎯 Success rate: {successful}/{total} examples")
    
    if successful == total:
        print("🎉 All examples completed successfully!")
    elif successful > 0:
        print("⚠️ Some examples completed. Check authentication and CLI installation.")
    else:
        print("🚨 No examples completed. Please check setup and try again.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️ Examples interrupted by user")
    except Exception as e:
        print(f"💥 Examples failed: {e}")