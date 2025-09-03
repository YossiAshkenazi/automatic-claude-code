#!/usr/bin/env python3
"""
Simple SDK test for Windows - No Unicode issues
Direct test of your Claude Code SDK with subscription
"""

import asyncio
import sys
import os

# Set encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

async def test_sdk_simple():
    """Simple test of the SDK"""
    print("\n" + "="*50)
    print("  TESTING YOUR CLAUDE CODE SDK")
    print("="*50)
    
    try:
        from claude_code_sdk import ClaudeSDKClient
        print("[1] SDK imported successfully")
        
        client = ClaudeSDKClient()
        print("[2] Client created successfully")
        
        print("[3] Sending simple query to Claude...")
        print("    Query: 'What is 2+2?'")
        print("    Using your subscription plan...")
        
        # This will use your subscription through Claude CLI
        result = await client.run("What is 2+2? Just give the number.")
        
        if result and hasattr(result, 'success') and result.success:
            print("[4] SUCCESS! Got response:")
            print("    " + str(result.result)[:100] + "...")
            return True
        else:
            print("[4] FAILED - No proper response")
            if result:
                print("    Error: " + str(getattr(result, 'error', 'Unknown')))
            return False
            
    except Exception as e:
        print(f"[ERROR] Test failed: {e}")
        return False

def main():
    """Main test function"""
    print("Simple test of your Claude Code Python SDK")
    print("\nThis will:")
    print("- Use your Claude subscription (not free tier)")
    print("- Connect through Claude CLI interactive mode") 
    print("- Test basic SDK functionality")
    
    try:
        success = asyncio.run(test_sdk_simple())
        
        if success:
            print("\nSUCCESS! Your SDK is working!")
            print("\nYou can now use it like this:")
            print("""
from claude_code_sdk import ClaudeSDKClient
import asyncio

async def ask_claude():
    client = ClaudeSDKClient()
    result = await client.run("Help me code something")
    print(result.result)

asyncio.run(ask_claude())
""")
        else:
            print("\nTest failed. Common issues:")
            print("1. Claude CLI needs to be able to run interactively")
            print("2. You need to be logged into Claude in browser")  
            print("3. Try running 'claude' command by itself first")
            
    except KeyboardInterrupt:
        print("\n\nTest interrupted - probably Claude CLI waiting for input")
        print("Try running 'claude' by itself first to set up authentication")
    except Exception as e:
        print(f"\nTest crashed: {e}")

if __name__ == "__main__":
    main()