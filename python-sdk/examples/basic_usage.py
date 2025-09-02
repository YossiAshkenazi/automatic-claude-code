#!/usr/bin/env python3
"""
Basic Usage Example - ClaudeSDKClient
====================================

This example demonstrates the fundamental usage patterns of the ClaudeSDKClient
for interacting with Claude Code CLI. It shows both simple queries and more
advanced client usage with proper async/await patterns.

Requirements:
    - Python 3.10+
    - Claude Code CLI installed and configured
    - claude-code-sdk package installed

Usage:
    python basic_usage.py
"""

import asyncio
from claude_code_sdk import ClaudeSDKClient, query, quick_query
from claude_code_sdk.core.options import create_development_options
from claude_code_sdk.exceptions import ClaudeCodeError, ClaudeAuthError
import logging

# Configure logging for better debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def simple_query_example():
    """
    Demonstrates the simplest way to query Claude using the high-level interface.
    """
    print("🔵 Simple Query Example")
    print("=" * 40)
    
    try:
        # Simple one-liner query using the high-level interface
        result = await quick_query("What is the capital of France?")
        print(f"Response: {result}")
        
    except ClaudeCodeError as e:
        print(f"Error: {e}")
        
    print()


async def streaming_query_example():
    """
    Demonstrates how to handle streaming responses from Claude.
    """
    print("🔵 Streaming Query Example")
    print("=" * 40)
    
    try:
        # Stream responses as they come in
        async for message in query("Explain Python asyncio in simple terms"):
            if hasattr(message, 'result') and message.result:
                print(f"Chunk: {message.result[:100]}...")
                
    except ClaudeCodeError as e:
        print(f"Streaming error: {e}")
        
    print()


async def client_context_manager_example():
    """
    Demonstrates proper resource management using the ClaudeSDKClient
    as an async context manager.
    """
    print("🔵 Client Context Manager Example")
    print("=" * 40)
    
    # Create development options with appropriate timeouts
    options = create_development_options(
        timeout=60,
        model="claude-3-sonnet-20241022"
    )
    
    try:
        # Use client as async context manager for proper cleanup
        async with ClaudeSDKClient(options) as client:
            print("Client initialized successfully")
            
            # Execute a simple task
            response = await client.execute("Create a simple Python function that adds two numbers")
            
            # Handle the response
            if response.success:
                print("✅ Task completed successfully")
                print(f"Result: {response.result[:200]}...")
            else:
                print("❌ Task failed")
                print(f"Error: {response.error}")
                
    except ClaudeAuthError:
        print("❌ Authentication failed. Please check your Claude CLI configuration.")
    except ClaudeCodeError as e:
        print(f"❌ Claude Code error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        
    print()


async def multi_step_conversation_example():
    """
    Demonstrates how to have a multi-step conversation with Claude
    using the same client instance.
    """
    print("🔵 Multi-Step Conversation Example")
    print("=" * 40)
    
    options = create_development_options(timeout=30)
    
    try:
        async with ClaudeSDKClient(options) as client:
            # Step 1: Ask for a Python function
            print("Step 1: Requesting Python function...")
            response1 = await client.execute(
                "Create a Python function called 'fibonacci' that calculates fibonacci numbers"
            )
            
            if response1.success:
                print("✅ Function created")
                
                # Step 2: Ask for improvements
                print("Step 2: Asking for improvements...")
                response2 = await client.execute(
                    "Now optimize that fibonacci function for better performance"
                )
                
                if response2.success:
                    print("✅ Function optimized")
                    
                    # Step 3: Ask for tests
                    print("Step 3: Requesting tests...")
                    response3 = await client.execute(
                        "Create unit tests for the optimized fibonacci function"
                    )
                    
                    if response3.success:
                        print("✅ Tests created")
                        print(f"Final result preview: {response3.result[:150]}...")
                    else:
                        print(f"❌ Test creation failed: {response3.error}")
                else:
                    print(f"❌ Optimization failed: {response2.error}")
            else:
                print(f"❌ Function creation failed: {response1.error}")
                
    except ClaudeCodeError as e:
        print(f"❌ Conversation error: {e}")
        
    print()


async def error_handling_example():
    """
    Demonstrates comprehensive error handling patterns.
    """
    print("🔵 Error Handling Example")
    print("=" * 40)
    
    # Test with invalid options to trigger errors
    from claude_code_sdk.core.options import ClaudeCodeOptions
    
    invalid_options = ClaudeCodeOptions(
        timeout=1,  # Very short timeout to trigger timeout error
        model="invalid-model-name"  # Invalid model
    )
    
    try:
        async with ClaudeSDKClient(invalid_options) as client:
            await client.execute("This will likely timeout or fail")
            
    except ClaudeAuthError:
        print("🔴 Authentication error - check your Claude CLI setup")
    except Exception as e:
        print(f"🟡 Expected error for demonstration: {type(e).__name__}")
        print(f"   Error message: {str(e)[:100]}...")
        
    print()


async def configuration_example():
    """
    Demonstrates different configuration patterns and options.
    """
    print("🔵 Configuration Example")
    print("=" * 40)
    
    # Different option configurations
    configs = {
        "Development": create_development_options(
            timeout=60,
            model="claude-3-sonnet-20241022",
            verbose=True
        ),
        "Production": create_development_options(  # Using dev options for example
            timeout=120,
            model="claude-3-opus-20240229",
            verbose=False
        )
    }
    
    for config_name, options in configs.items():
        print(f"Testing {config_name} configuration:")
        
        try:
            async with ClaudeSDKClient(options) as client:
                response = await client.execute("Say hello and identify yourself")
                
                if response.success:
                    print(f"  ✅ {config_name}: {response.result[:80]}...")
                else:
                    print(f"  ❌ {config_name}: Failed - {response.error}")
                    
        except Exception as e:
            print(f"  🔴 {config_name}: Exception - {str(e)[:60]}...")
            
        print()


async def main():
    """
    Main function that runs all examples in sequence.
    """
    print("🚀 Claude SDK Client - Basic Usage Examples")
    print("=" * 50)
    print()
    
    # Run all examples
    await simple_query_example()
    await streaming_query_example()
    await client_context_manager_example()
    await multi_step_conversation_example()
    await error_handling_example()
    await configuration_example()
    
    print("✅ All basic usage examples completed!")
    print()
    print("Next steps:")
    print("- Try the advanced_streaming.py example for complex streaming patterns")
    print("- See integration_with_automatic_claude.py for system integration")
    print("- Check error_handling_retry.py for robust error recovery patterns")


if __name__ == "__main__":
    # Run the examples
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Examples interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error running examples: {e}")
        logger.exception("Error running basic usage examples")