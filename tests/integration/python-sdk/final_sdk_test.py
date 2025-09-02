#!/usr/bin/env python3
"""
FINAL SDK TEST - Using correct SDK interface
This uses your actual SDK with subscription
"""

import asyncio
import sys
import os

# Set encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

async def test_query_function():
    """Test the main query function"""
    print("\n" + "="*50)
    print("  TESTING query() FUNCTION")
    print("="*50)
    
    try:
        from claude_code_sdk import query
        print("[1] query() function imported")
        
        print("[2] Sending query to Claude...")
        print("    Query: 'What is 5 + 3? Just give the answer.'")
        print("    This uses your subscription...")
        
        # Collect all messages
        messages = []
        async for message in query("What is 5 + 3? Just give the answer."):
            messages.append(message)
            print(f"    Received: {type(message).__name__} - {str(message)[:50]}...")
        
        if messages:
            print(f"[3] SUCCESS! Received {len(messages)} message(s)")
            
            # Try to find result message
            for msg in messages:
                if hasattr(msg, 'result'):
                    print(f"    Result: {msg.result}")
                elif hasattr(msg, 'content'):
                    print(f"    Content: {msg.content}")
            
            return True
        else:
            print("[3] No messages received")
            return False
            
    except Exception as e:
        print(f"[ERROR] query() test failed: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return False

async def test_client_usage():
    """Test the ClaudeCodeClient"""
    print("\n" + "="*50)
    print("  TESTING ClaudeCodeClient")
    print("="*50)
    
    try:
        from claude_code_sdk import ClaudeCodeClient
        print("[1] ClaudeCodeClient imported")
        
        client = ClaudeCodeClient()
        print("[2] Client created")
        
        print("[3] Testing client.execute() method...")
        print("    Query: 'Hello Claude! What is Python good for?'")
        
        # Use the correct method based on what we saw in the code
        result = client.execute("Hello Claude! What is Python good for?")
        
        if result:
            print("[4] SUCCESS! Got result from client")
            print(f"    Result type: {type(result).__name__}")
            print(f"    Result: {str(result)[:100]}...")
            return True
        else:
            print("[4] No result from client")
            return False
            
    except Exception as e:
        print(f"[ERROR] Client test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_quick_query():
    """Test the quick_query convenience function"""
    print("\n" + "="*50)
    print("  TESTING quick_query()")
    print("="*50)
    
    try:
        from claude_code_sdk import quick_query
        print("[1] quick_query imported")
        
        print("[2] Sending quick query...")
        result = await quick_query("What is 10 - 7? Just the number please.")
        
        if result:
            print(f"[3] SUCCESS! Quick result: {result}")
            return True
        else:
            print("[3] No result from quick_query")
            return False
            
    except Exception as e:
        print(f"[ERROR] quick_query test failed: {e}")
        return False

def main():
    """Main test runner"""
    print("FINAL TEST OF YOUR CLAUDE CODE SDK")
    print("Using your Claude subscription")
    print("\nIMPORTANT:")
    print("- This will use your Claude subscription plan")
    print("- Make sure you can run 'claude' command normally")
    print("- This may take a moment...")
    
    async def run_all_tests():
        tests = [
            ("query() function", test_query_function),
            ("ClaudeCodeClient", test_client_usage), 
            ("quick_query()", test_quick_query)
        ]
        
        passed = 0
        for name, test_func in tests:
            print(f"\n>>> Running {name} test...")
            try:
                if await test_func():
                    print(f"    [PASS] {name}")
                    passed += 1
                else:
                    print(f"    [FAIL] {name}")
            except Exception as e:
                print(f"    [ERROR] {name}: {e}")
        
        print("\n" + "="*50)
        print(f"  FINAL RESULTS: {passed}/{len(tests)} tests passed")
        print("="*50)
        
        if passed == len(tests):
            print("\nCONGRATULATIONS! Your SDK is working perfectly!")
            print("\nYou can now use it in your projects:")
            print("""
# Simple usage
from claude_code_sdk import query
async for msg in query("Help me with Python"):
    print(msg)

# Quick usage
from claude_code_sdk import quick_query
result = await quick_query("What is 2+2?")
print(result)

# Client usage
from claude_code_sdk import ClaudeCodeClient
client = ClaudeCodeClient()
result = client.execute("Code review this function")
print(result)
""")
            return True
        elif passed > 0:
            print(f"\nPartial success - {passed} test(s) working")
            return False
        else:
            print("\nAll tests failed. Check:")
            print("1. Can you run 'claude' command by itself?")
            print("2. Are you logged into Claude in your browser?")
            print("3. Is your subscription active?")
            return False
    
    try:
        return asyncio.run(run_all_tests())
    except KeyboardInterrupt:
        print("\n\nTest interrupted!")
        print("This usually means Claude CLI is waiting for input.")
        print("Try running 'claude' command by itself first.")
        return False
    except Exception as e:
        print(f"\nTest system failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)