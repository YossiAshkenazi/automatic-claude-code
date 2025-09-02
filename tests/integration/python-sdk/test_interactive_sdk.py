#!/usr/bin/env python3
"""
Test Claude Code SDK with Interactive Mode
This properly uses your Claude subscription through interactive sessions
"""

import asyncio
import sys
from claude_code_sdk import ClaudeSDKClient

async def test_subscription_mode():
    """Test using subscription through interactive Claude CLI"""
    print("\n" + "="*60)
    print("  TESTING CLAUDE CODE SDK - SUBSCRIPTION MODE")
    print("="*60)
    
    print("\nThis will use your Claude subscription (not headless mode)")
    print("Creating interactive session...\n")
    
    try:
        # Create client that will use interactive Claude CLI
        client = ClaudeSDKClient()
        
        print("Sending query to Claude using your subscription...")
        print("Query: 'Write a simple Python hello world function'\n")
        
        # This should trigger interactive Claude CLI session
        result = await client.run("Write a simple Python hello world function")
        
        if result and result.success:
            print("[SUCCESS] Got response using subscription!")
            print("\nClaude's response:")
            print("-" * 40)
            print(result.result)
            print("-" * 40)
            return True
        else:
            print(f"[FAIL] No response: {result.error if result else 'Unknown error'}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Test failed: {e}")
        return False

async def test_streaming_subscription():
    """Test streaming with subscription"""
    print("\n" + "="*60)
    print("  TESTING STREAMING WITH SUBSCRIPTION")  
    print("="*60)
    
    try:
        client = ClaudeSDKClient(verbose=True)
        
        print("Requesting streaming response...")
        print("Query: 'List 3 Python web frameworks'\n")
        
        # Check if streaming is available
        if hasattr(client, 'run_stream'):
            chunks = []
            async for chunk in client.run_stream("List 3 Python web frameworks"):
                print(f"Streaming: {chunk.content[:60]}...")
                chunks.append(chunk)
                if len(chunks) >= 5:  # Limit for demo
                    break
            
            if chunks:
                print(f"\n[SUCCESS] Streaming works! Got {len(chunks)} chunks")
                return True
            else:
                print("[INFO] No streaming chunks received")
                return False
        else:
            print("[INFO] Streaming not available, trying regular query...")
            result = await client.run("List 3 Python web frameworks")
            if result and result.success:
                print("[SUCCESS] Regular query works with subscription!")
                return True
            return False
            
    except Exception as e:
        print(f"[ERROR] Streaming test failed: {e}")
        return False

def check_claude_interactive():
    """Check if Claude CLI can start interactive mode"""
    print("\n" + "="*60)
    print("  CHECKING CLAUDE CLI INTERACTIVE MODE")
    print("="*60)
    
    import subprocess
    
    print("Testing if Claude CLI can start interactive session...")
    print("This should work with your subscription.\n")
    
    try:
        # Just check if claude command exists and responds
        result = subprocess.run(
            ["claude", "--help"], 
            capture_output=True, 
            text=True, 
            timeout=5
        )
        
        if result.returncode == 0:
            print("[SUCCESS] Claude CLI responds to --help")
            print("Interactive mode should be available")
            return True
        else:
            print(f"[FAIL] Claude CLI error: {result.stderr}")
            return False
            
    except FileNotFoundError:
        print("[FAIL] Claude CLI not found")
        return False
    except Exception as e:
        print(f"[ERROR] Check failed: {e}")
        return False

async def main():
    """Main test routine"""
    print("Testing your Claude Code SDK with subscription access...")
    
    # Check Claude CLI first
    cli_works = check_claude_interactive()
    
    if not cli_works:
        print("\n[ERROR] Claude CLI not working properly")
        print("\nPlease ensure:")
        print("1. Claude Code CLI is installed: npm install -g @anthropic-ai/claude-code")
        print("2. You're logged into Claude (browser login)")
        print("3. Your subscription is active")
        return
    
    # Test SDK with subscription
    tests = [
        ("Subscription Query", test_subscription_mode),
        ("Streaming Test", test_streaming_subscription),
    ]
    
    passed = 0
    for name, test_func in tests:
        print(f"\n>>> Running {name}...")
        try:
            if await test_func():
                passed += 1
                print(f"[PASS] {name}")
            else:
                print(f"[FAIL] {name}")
        except Exception as e:
            print(f"[ERROR] {name} crashed: {e}")
    
    # Summary
    print("\n" + "="*60)
    print(f"  RESULTS: {passed}/{len(tests)} tests passed")
    print("="*60)
    
    if passed == len(tests):
        print("\n🎉 [SUCCESS] Your SDK works with subscription!")
        print("\nYou can now use it in your projects:")
        print("""
from claude_code_sdk import ClaudeSDKClient

client = ClaudeSDKClient()
result = await client.run("Your task here")
print(result.result)
""")
    elif passed > 0:
        print("\n⚠️ [PARTIAL] Some features working")
    else:
        print("\n❌ [ISSUES] SDK not connecting to Claude CLI properly")
        print("\nTroubleshooting:")
        print("1. Try running 'claude' by itself first")
        print("2. Make sure you can chat with Claude interactively") 
        print("3. Check your subscription status")

if __name__ == "__main__":
    asyncio.run(main())