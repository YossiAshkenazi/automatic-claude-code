#!/usr/bin/env python3
"""
Test Claude Code SDK with Interactive Claude CLI
Tests the actual SDK functionality with real Claude CLI
"""

import asyncio
import sys
import os

# Fix encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

async def test_basic_query():
    """Test basic query functionality"""
    print("\n" + "="*60)
    print("  TESTING BASIC SDK QUERY")  
    print("="*60)
    
    try:
        from claude_code_sdk import query
        print("[1] SDK query function imported")
        
        print("[2] Sending simple query to Claude...")
        print("    Query: 'What is 5 + 3? Just give me the number.'")
        
        # Collect messages with timeout
        messages = []
        try:
            async def collect_messages():
                async for message in query("What is 5 + 3? Just give me the number."):
                    messages.append(message)
                    print(f"    Received: {type(message).__name__}")
                    # Stop after getting a good response
                    if hasattr(message, 'result') and message.result:
                        break
                    if hasattr(message, 'content') and message.content:
                        break
                    if len(messages) >= 3:  # Safety limit
                        break
            
            # Run with 60 second timeout
            await asyncio.wait_for(collect_messages(), timeout=60.0)
            
            if messages:
                print(f"[3] SUCCESS! Received {len(messages)} message(s)")
                for i, msg in enumerate(messages):
                    if hasattr(msg, 'result'):
                        print(f"    Message {i+1} Result: {msg.result}")
                    elif hasattr(msg, 'content'):
                        print(f"    Message {i+1} Content: {msg.content}")
                    else:
                        print(f"    Message {i+1}: {str(msg)[:100]}...")
                return True
            else:
                print("[3] No messages received")
                return False
                
        except asyncio.TimeoutError:
            print("[TIMEOUT] Query timed out after 60 seconds")
            print("This might indicate authentication issues")
            return False
            
    except Exception as e:
        print(f"[ERROR] Query test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_client_execute():
    """Test synchronous client execute method"""
    print("\n" + "="*60)
    print("  TESTING CLIENT EXECUTE METHOD")
    print("="*60)
    
    try:
        from claude_code_sdk import ClaudeCodeClient
        print("[1] ClaudeCodeClient imported")
        
        print("[2] Creating client and testing execute()...")
        client = ClaudeCodeClient()
        
        # Test with timeout using asyncio
        async def run_execute():
            # The execute method is sync, so we run it in executor
            import concurrent.futures
            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                result = await loop.run_in_executor(
                    executor, 
                    client.execute,
                    "What is 10 - 7? Just the number please."
                )
            return result
        
        try:
            result = await asyncio.wait_for(run_execute(), timeout=60.0)
            
            if result:
                print(f"[3] SUCCESS! Client execute returned: {result}")
                return True
            else:
                print("[3] Client execute returned empty result")
                return False
                
        except asyncio.TimeoutError:
            print("[TIMEOUT] Client execute timed out after 60 seconds")
            return False
            
    except Exception as e:
        print(f"[ERROR] Client test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_quick_query():
    """Test quick_query convenience function"""
    print("\n" + "="*60)
    print("  TESTING QUICK_QUERY FUNCTION")
    print("="*60)
    
    try:
        from claude_code_sdk import quick_query
        print("[1] quick_query function imported")
        
        print("[2] Testing quick_query...")
        try:
            result = await asyncio.wait_for(
                quick_query("What is 2 * 4? Just the number."), 
                timeout=60.0
            )
            
            if result:
                print(f"[3] SUCCESS! quick_query returned: {result}")
                return True
            else:
                print("[3] quick_query returned empty result")
                return False
                
        except asyncio.TimeoutError:
            print("[TIMEOUT] quick_query timed out after 60 seconds")
            return False
            
    except Exception as e:
        print(f"[ERROR] quick_query test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all interactive tests"""
    print("CLAUDE CODE SDK - INTERACTIVE TESTING")
    print("Testing with real Claude CLI (interactive mode)")
    print("=" * 70)
    
    print("\nIMPORTANT:")
    print("- This will use Claude CLI in interactive mode")
    print("- Make sure you have authentication set up")
    print("- Each test has a 60-second timeout")
    
    tests = [
        ("Basic Query", test_basic_query),
        ("Client Execute", test_client_execute),
        ("Quick Query", test_quick_query)
    ]
    
    passed = 0
    results = []
    
    for name, test_func in tests:
        print(f"\n>>> Running {name} test...")
        try:
            success = await test_func()
            if success:
                print(f"    ✓ {name} - PASSED")
                passed += 1
                results.append(f"✓ {name}")
            else:
                print(f"    ✗ {name} - FAILED")
                results.append(f"✗ {name}")
        except Exception as e:
            print(f"    ✗ {name} - ERROR: {e}")
            results.append(f"✗ {name} (Error)")
    
    # Final summary
    print("\n" + "="*70)
    print("  INTERACTIVE TEST RESULTS")
    print("="*70)
    
    for result in results:
        print(f"  {result}")
    
    print(f"\nOVERALL: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("\n🎉 SUCCESS! Your SDK is fully functional with Claude CLI!")
        print("\nYour SDK is ready for:")
        print("- Production use")
        print("- Integration into other projects")  
        print("- All the usage examples from the documentation")
        
        print("\n📚 Quick usage reminder:")
        print('''
from claude_code_sdk import query, ClaudeCodeClient

# Async usage
async for message in query("Help me code"):
    print(message)

# Sync usage  
client = ClaudeCodeClient()
result = client.execute("What is Python good for?")
print(result)
        ''')
        
    elif passed > 0:
        print(f"\n⚠️ Partial success - {passed} test(s) working")
        print("Check the failed tests above for specific issues")
    else:
        print("\n❌ All tests failed")
        print("Common issues:")
        print("- Claude CLI needs authentication: claude setup-token")
        print("- Network connectivity issues")
        print("- Claude CLI not responding")
    
    return passed == len(tests)

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user!")
        print("This usually means Claude CLI is waiting for authentication")
        sys.exit(1)
    except Exception as e:
        print(f"\nTest system error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)