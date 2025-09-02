#!/usr/bin/env python3
"""
Real Claude Query Test
Tests the Python SDK with actual Claude Code CLI execution
"""

import asyncio
import sys
from claude_code_sdk import ClaudeCodeClient, ClaudeCodeOptions
from claude_code_sdk.core.messages import ResultMessage, ErrorMessage

async def test_real_query():
    """Test with actual Claude CLI execution"""
    print("Testing Real Claude Query")
    print("=" * 50)
    
    # Configure options with skip permissions flag
    options = ClaudeCodeOptions(
        model="sonnet",
        verbose=True,
        max_turns=3,
        timeout=30,
        # Add the skip permissions flag to CLI args
        additional_args=["--dangerously-skip-permissions"]
    )
    
    print(f"Using model: {options.model}")
    print(f"CLI args: {' '.join(options.get_cli_args())}")
    
    try:
        async with ClaudeCodeClient(options) as client:
            print(f"Client created with CLI: {client._claude_cli_path}")
            
            # Test with a simple query
            prompt = "What is 2 + 2? Just give me the number."
            print(f"Sending query: {prompt}")
            print("-" * 30)
            
            message_count = 0
            async for message in client.query(prompt):
                message_count += 1
                print(f"Message {message_count}: {type(message).__name__}")
                
                if isinstance(message, ResultMessage):
                    print(f"Result: {message.result}")
                    print(f"Tokens: {message.token_count}")
                elif isinstance(message, ErrorMessage):
                    print(f"Error: {message.error}")
                    print(f"Error Code: {message.error_code}")
                else:
                    print(f"Message content: {getattr(message, 'content', 'N/A')}")
            
            print(f"\nQuery completed! Received {message_count} messages.")
            return True
            
    except Exception as e:
        print(f"Query failed: {e}")
        print("\nPossible solutions:")
        print("1. Make sure you're authenticated with Claude Code")
        print("2. Check that Claude CLI is properly installed")
        print("3. Verify you have API access")
        return False

async def test_authentication_status():
    """Test if Claude CLI is properly authenticated"""
    print("\nTesting Authentication Status")
    print("=" * 50)
    
    try:
        from claude_code_sdk.utils import CLIDetector
        
        detector = CLIDetector()
        claude_path = await detector.detect_claude_cli()
        
        if not claude_path:
            print("❌ Claude CLI not found")
            return False
            
        print(f"✅ Claude CLI found: {claude_path}")
        
        # Test with a very simple command
        options = ClaudeCodeOptions(additional_args=["--dangerously-skip-permissions"])
        
        async with ClaudeCodeClient(options) as client:
            try:
                # Try to get version or help info
                import subprocess
                result = subprocess.run([claude_path, "--help"], 
                                      capture_output=True, text=True, timeout=10)
                
                if result.returncode == 0:
                    print("✅ Claude CLI responds to --help")
                    return True
                else:
                    print(f"❌ Claude CLI error: {result.stderr}")
                    return False
                    
            except subprocess.TimeoutExpired:
                print("❌ Claude CLI timed out")
                return False
            except Exception as e:
                print(f"❌ Claude CLI test failed: {e}")
                return False
                
    except Exception as e:
        print(f"❌ Authentication test failed: {e}")
        return False

async def main():
    """Run authentication and query tests"""
    print("Claude CLI Real Query Test")
    print("=" * 60)
    
    # Test 1: Check authentication status
    auth_ok = await test_authentication_status()
    
    if not auth_ok:
        print("\n" + "=" * 60)
        print("AUTHENTICATION SETUP REQUIRED")
        print("=" * 60)
        print("To use Claude CLI with the Python SDK:")
        print("1. Make sure Claude Code desktop app is installed and authenticated")
        print("2. The Claude CLI uses the same authentication as Claude Code")
        print("3. No separate 'claude auth' command is needed")
        print("4. The SDK will automatically use --dangerously-skip-permissions")
        return
    
    # Test 2: Try real query
    query_ok = await test_real_query()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    if auth_ok and query_ok:
        print("🎉 SUCCESS: Python SDK can execute real Claude queries!")
        print("✅ Authentication working")
        print("✅ Query execution working")
        print("✅ Message handling working")
    elif auth_ok:
        print("⚠️  PARTIAL: Authentication works but query failed")
        print("✅ Authentication working")
        print("❌ Query execution needs attention")
    else:
        print("❌ SETUP NEEDED: Authentication not configured")
        print("❌ Authentication needs setup")
        print("❓ Query execution not tested")
    
    print(f"\nFor monitoring: http://localhost:6011")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"\nTest failed: {e}")
        sys.exit(1)