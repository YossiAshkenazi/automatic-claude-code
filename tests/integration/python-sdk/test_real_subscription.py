#!/usr/bin/env python3
"""
REAL test for Claude Code SDK with subscription
This is the correct way to test with your subscription plan
"""

import asyncio
import subprocess
import shutil
from claude_code_sdk import ClaudeSDKClient

def find_claude_cli():
    """Find Claude CLI on this system"""
    # Try different ways to find claude
    possible_commands = ['claude', 'claude.cmd']
    
    for cmd in possible_commands:
        if shutil.which(cmd):
            return cmd
    
    return None

async def test_real_subscription():
    """Test with your actual subscription"""
    print("="*60)
    print("  REAL CLAUDE CODE SDK TEST")
    print("  Using Your Subscription Plan")
    print("="*60)
    
    # Find Claude CLI
    claude_cmd = find_claude_cli()
    if not claude_cmd:
        print("❌ Claude CLI not found in PATH")
        print("\nMake sure Claude CLI is installed:")
        print("npm install -g @anthropic-ai/claude-code")
        return False
    
    print(f"✅ Found Claude CLI: {claude_cmd}")
    
    # Test basic Claude CLI
    print("\n1. Testing Claude CLI basic functionality...")
    try:
        result = subprocess.run([claude_cmd, '--version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"✅ Claude CLI version: {result.stdout.strip()}")
        else:
            print(f"❌ Claude CLI error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Claude CLI test failed: {e}")
        return False
    
    # Test SDK
    print("\n2. Testing SDK with your subscription...")
    try:
        client = ClaudeSDKClient()
        print("✅ SDK client created")
        
        print("\n3. Sending real query to Claude...")
        print("   Query: 'What is 5 + 3?'")
        print("   This will use your subscription, not free tier")
        
        result = await client.run("What is 5 + 3? Just give the answer.")
        
        if result and hasattr(result, 'success') and result.success:
            print("✅ SUCCESS! Got response from Claude!")
            print(f"   Response: {result.result}")
            return True
        else:
            error_msg = getattr(result, 'error', 'Unknown error') if result else 'No result'
            print(f"❌ Query failed: {error_msg}")
            return False
            
    except Exception as e:
        print(f"❌ SDK test failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        import traceback
        print(f"   Traceback: {traceback.format_exc()}")
        return False

def main():
    """Main test"""
    print("Testing Claude Code SDK with your subscription...\n")
    
    # Important notes
    print("IMPORTANT:")
    print("- This uses your Claude subscription (not free tier)")  
    print("- Make sure you're logged into Claude in your browser")
    print("- This may open browser windows for authentication")
    print("- Press Ctrl+C if it hangs\n")
    
    try:
        success = asyncio.run(test_real_subscription())
        
        if success:
            print("\n🎉 SUCCESS! Your SDK is working with subscription!")
            print("\nYou can now use it in your projects:")
            print("""
# Example usage:
from claude_code_sdk import ClaudeSDKClient
import asyncio

async def use_claude():
    client = ClaudeSDKClient()
    result = await client.run("Help me write Python code")
    print(result.result)

asyncio.run(use_claude())
""")
        else:
            print("\n❌ SDK test failed")
            print("\nTroubleshooting:")
            print("1. Make sure you can run 'claude' in terminal")
            print("2. Try 'claude' by itself to start interactive mode")
            print("3. Ensure you're logged into Claude Pro/subscription")
            print("4. Check if Claude opens in browser when you run 'claude'")
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrupted by user")
        print("This usually happens when Claude CLI hangs waiting for authentication")
        print("\nTry running 'claude' by itself first to complete authentication")
    except Exception as e:
        print(f"\n❌ Test crashed: {e}")

if __name__ == "__main__":
    main()