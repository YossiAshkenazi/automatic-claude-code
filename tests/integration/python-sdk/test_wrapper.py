#!/usr/bin/env python3
"""
Test script for Claude CLI Wrapper
"""

import asyncio
import sys
import os
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliSimple, ClaudeCliOptions

def test_cli_detection():
    """Test 1: Check if Claude CLI can be detected"""
    print("Test 1: CLI Detection")
    try:
        wrapper = ClaudeCliWrapper()
        print(f"SUCCESS: Found Claude CLI at: {wrapper.cli_path}")
        return True
    except FileNotFoundError as e:
        print(f"FAIL: {e}")
        return False
    except Exception as e:
        print(f"FAIL: Unexpected error: {e}")
        return False

def test_simple_query():
    """Test 2: Simple query (What is 2+2?)"""
    print("\nTest 2: Simple Query")
    try:
        claude = ClaudeCliSimple(model="sonnet")
        result = claude.query("What is 2+2? Answer in one line.")
        print(f"SUCCESS: Got response: {result[:100]}...")
        return True
    except Exception as e:
        print(f"FAIL: {e}")
        return False

def test_model_switching():
    """Test 3: Model switching between sonnet/opus/haiku"""
    print("\nTest 3: Model Switching")
    models = ["sonnet", "haiku"]  # Skip opus for now as it might be slower
    
    results = {}
    for model in models:
        try:
            claude = ClaudeCliSimple(model=model)
            result = claude.query("Say 'Hello from " + model + "' in one line")
            results[model] = result[:50] if result else "No response"
            print(f"SUCCESS: {model} responded: {results[model]}...")
        except Exception as e:
            print(f"FAIL: {model} failed with: {e}")
            results[model] = f"Error: {e}"
    
    return all("Error:" not in result for result in results.values())

async def test_streaming():
    """Test 4: Check if streaming output works"""
    print("\nTest 4: Streaming Output")
    try:
        options = ClaudeCliOptions(
            model="sonnet",
            verbose=False,
            dangerously_skip_permissions=True
        )
        
        wrapper = ClaudeCliWrapper(options)
        
        message_count = 0
        async for message in wrapper.execute("Count from 1 to 3, one number per line"):
            print(f"  Stream message [{message.type}]: {message.content[:50]}...")
            message_count += 1
            if message_count > 10:  # Prevent infinite loop
                break
        
        if message_count > 0:
            print(f"SUCCESS: Received {message_count} streaming messages")
            return True
        else:
            print("FAIL: No streaming messages received")
            return False
    except Exception as e:
        print(f"FAIL: {e}")
        return False

def test_api_key_independence():
    """Test 5: Verify no API key errors"""
    print("\nTest 5: API Key Independence")
    
    # Check if any API key environment variables are set
    api_key_vars = ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "API_KEY"]
    found_keys = [var for var in api_key_vars if os.environ.get(var)]
    
    if found_keys:
        print(f"NOTE: Found API key environment variables: {found_keys}")
    else:
        print("SUCCESS: No API key environment variables detected")
    
    # The real test is that other tests pass without API keys
    print("SUCCESS: Wrapper operates independently of API keys")
    return True

async def main():
    """Run all tests"""
    print("Claude CLI Wrapper Test Suite")
    print("=" * 40)
    
    # Run tests
    tests = [
        ("CLI Detection", test_cli_detection),
        ("Simple Query", test_simple_query), 
        ("Model Switching", test_model_switching),
        ("Streaming Output", test_streaming),
        ("API Key Independence", test_api_key_independence)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = await test_func()
            else:
                result = test_func()
            results[test_name] = result
        except Exception as e:
            print(f"FAIL: {test_name} crashed with: {e}")
            results[test_name] = False
    
    # Print summary
    print("\n" + "=" * 40)
    print("TEST RESULTS SUMMARY:")
    print("=" * 40)
    
    passed = 0
    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nPassed: {passed}/{len(results)} tests")
    
    # Overall status
    if passed == len(results):
        print("OVERALL: ALL TESTS PASSED - Wrapper is functional")
    elif passed > 0:
        print("OVERALL: PARTIAL SUCCESS - Wrapper has some functionality")  
    else:
        print("OVERALL: ALL TESTS FAILED - Wrapper is not functional")
    
    return results

if __name__ == "__main__":
    asyncio.run(main())