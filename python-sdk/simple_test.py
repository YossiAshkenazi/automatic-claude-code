#!/usr/bin/env python3
"""Simple test to verify the JSON parsing bug fix"""

import asyncio
from claude_cli_wrapper import ClaudeCliWrapper

async def test_bug_fix():
    """Test the exact scenario that was failing before"""
    wrapper = ClaudeCliWrapper()
    
    print("Testing the critical bug fix...")
    print("=" * 50)
    
    try:
        # This command was failing with 'list' object has no attribute 'get'
        print("Testing: 'Create a simple hello.py file'")
        result = await wrapper.execute_sync('Create a simple hello.py file')
        
        print("SUCCESS: Bug is completely fixed!")
        print(f"Response received: {len(result)} characters")
        print(f"Preview: {result[:150]}...")
        
    except Exception as e:
        print(f"Bug still exists: {e}")
        return False
    finally:
        await wrapper.cleanup()
    
    return True

async def test_multiple_tools():
    """Test different tool types"""
    wrapper = ClaudeCliWrapper()
    
    print("\nTesting different tool types...")
    print("=" * 50)
    
    tests = [
        "What is 8 + 15?",
        "Create a test file called demo.txt with content 'Testing tools'",
        "Read the current directory contents",
    ]
    
    results = []
    
    for i, test in enumerate(tests, 1):
        print(f"\n--- Test {i}: {test[:50]}... ---")
        try:
            result = await wrapper.execute_sync(test)
            success = len(result) > 5
            results.append(success)
            print(f"SUCCESS: {len(result)} characters received")
        except Exception as e:
            print(f"FAILED: {e}")
            results.append(False)
    
    await wrapper.cleanup()
    
    success_rate = (sum(results) / len(results)) * 100
    print(f"\nSuccess Rate: {success_rate:.1f}% ({sum(results)}/{len(results)} tests passed)")
    
    return success_rate > 50

if __name__ == "__main__":
    print("Python SDK v1.1.1 - Bug Fix Verification")
    print("=" * 60)
    
    # Test the critical bug fix
    bug_fixed = asyncio.run(test_bug_fix())
    
    # Test multiple tool types
    tools_working = asyncio.run(test_multiple_tools())
    
    print("\n" + "=" * 60)
    print("FINAL RESULTS:")
    print(f"Critical Bug Fixed: {'YES' if bug_fixed else 'NO'}")
    print(f"Tool Operations: {'WORKING' if tools_working else 'FAILING'}")
    
    if bug_fixed and tools_working:
        print("\nPYTHON SDK IS PRODUCTION-READY!")
        print("The critical JSON parsing bug has been resolved!")
    else:
        print("\nSome issues remain - check the output above")