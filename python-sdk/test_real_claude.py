#!/usr/bin/env python3
"""
Test real Claude CLI integration
Run this after setting up authentication with: claude setup-token
"""

import asyncio
import sys
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def test_simple_query():
    """Test a simple mathematical query"""
    print("🧪 Testing simple query: 'What is 2+2?'")
    print("-" * 50)
    
    wrapper = ClaudeCliWrapper()
    
    try:
        async for message in wrapper.execute("What is 2+2?"):
            if message.type == "auth_error":
                print(f"🔑 {message.type.upper()}: {message.content}")
                print("\n💡 Please run: claude setup-token")
                return False
            elif message.type == "error":
                print(f"❌ {message.type.upper()}: {message.content}")
                return False
            elif message.type in ["stream", "result"]:
                print(f"📝 {message.type.upper()}: {message.content}")
            elif message.type == "status":
                print(f"⏳ {message.type.upper()}: {message.content}")
            else:
                print(f"🔍 {message.type.upper()}: {message.content}")
        
        print("✅ Simple query completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error during execution: {e}")
        return False

async def test_tool_usage():
    """Test tool usage with file operations"""
    print("\n🧪 Testing tool usage: 'Create a simple hello.py file'")
    print("-" * 50)
    
    options = ClaudeCliOptions(
        verbose=True,
        allowed_tools=["Read", "Write", "Edit"],
        timeout=60
    )
    wrapper = ClaudeCliWrapper(options)
    
    try:
        async for message in wrapper.execute("Create a simple hello.py file with a hello world function"):
            if message.type == "auth_error":
                print(f"🔑 {message.type.upper()}: {message.content}")
                return False
            elif message.type == "tool_action":
                print(f"🔧 TOOL ACTION: {message.content}")
            elif message.type == "tool_use":
                print(f"🛠️  TOOL USE: {message.content}")
            elif message.type == "error":
                print(f"❌ ERROR: {message.content}")
                return False
            elif message.type == "progress":
                print(f"📊 PROGRESS: {message.content}")
            elif message.type in ["stream", "result"]:
                content = message.content[:100] + "..." if len(message.content) > 100 else message.content
                print(f"📝 {message.type.upper()}: {content}")
            else:
                print(f"🔍 {message.type.upper()}: {message.content}")
        
        print("✅ Tool usage test completed!")
        return True
        
    except Exception as e:
        print(f"❌ Error during tool usage: {e}")
        return False

async def test_authentication_check():
    """Test if authentication is properly set up"""
    print("🧪 Testing authentication status")
    print("-" * 50)
    
    wrapper = ClaudeCliWrapper()
    
    try:
        # Try a very simple query to check auth
        async for message in wrapper.execute("Hi"):
            if message.type == "auth_error":
                print("❌ Authentication not set up")
                print(message.content)
                return False
            elif message.type == "error":
                if "invalid api key" in message.content.lower():
                    print("❌ Authentication error detected")
                    print("💡 Please run: claude setup-token")
                    return False
                else:
                    print(f"❌ Other error: {message.content}")
                    return False
            elif message.type in ["stream", "result"]:
                print("✅ Authentication working!")
                print(f"Response: {message.content}")
                return True
            
        return True
        
    except Exception as e:
        print(f"❌ Error checking authentication: {e}")
        return False

async def main():
    """Run all integration tests"""
    print("🚀 Claude CLI Wrapper - Real Integration Tests")
    print("=" * 60)
    print(f"Python: {sys.version}")
    print(f"Platform: {sys.platform}")
    
    # Check if wrapper can be created
    try:
        wrapper = ClaudeCliWrapper()
        print(f"✅ Claude CLI found at: {wrapper.cli_path}")
    except FileNotFoundError as e:
        print(f"❌ {e}")
        print("💡 Install with: npm install -g @anthropic-ai/claude-code")
        return
    
    # Test authentication first
    auth_ok = await test_authentication_check()
    
    if auth_ok:
        print("\n" + "=" * 60)
        # Run more comprehensive tests
        simple_ok = await test_simple_query()
        
        if simple_ok:
            print("\n" + "=" * 60)
            tool_ok = await test_tool_usage()
            
            if tool_ok:
                print("\n" + "=" * 60)
                print("🎉 ALL TESTS PASSED!")
                print("✅ CLI wrapper is working with real Claude CLI")
                print("✅ Authentication is properly configured")
                print("✅ Tool usage is functional")
            else:
                print("\n⚠️  Simple query works, but tool usage had issues")
        else:
            print("\n⚠️  Authentication works, but simple query had issues")
    else:
        print("\n💡 Set up authentication first, then run this test again:")
        print("   claude setup-token")

if __name__ == "__main__":
    asyncio.run(main())