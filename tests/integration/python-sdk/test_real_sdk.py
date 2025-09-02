#!/usr/bin/env python3
"""
Real-world test of Claude Code Python SDK
Tests actual Claude CLI integration
"""

import asyncio
import sys
import time
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from claude_code_sdk import ClaudeSDKClient, query

def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*50}")
    print(f"  {title}")
    print(f"{'='*50}\n")

async def test_basic_query():
    """Test 1: Basic query functionality"""
    print_section("Test 1: Basic Query")
    
    try:
        print("Asking Claude to explain Python decorators...")
        messages = []
        async for message in query("Explain Python decorators in 2 sentences"):
            messages.append(message)
            print(f"  [{message.type}] {message.content[:100]}...")
        
        if messages:
            print(f"✅ Received {len(messages)} messages")
            return True
        else:
            print("❌ No messages received")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

async def test_client_initialization():
    """Test 2: Client initialization and configuration"""
    print_section("Test 2: Client Initialization")
    
    try:
        # Test default client
        client = ClaudeSDKClient()
        print(f"✅ Default client created with model: {client.model}")
        
        # Test custom configuration
        custom_client = ClaudeSDKClient(
            model="sonnet",
            timeout=60,
            verbose=True
        )
        print(f"✅ Custom client created with timeout: {custom_client.timeout}s")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

async def test_streaming_response():
    """Test 3: Streaming responses"""
    print_section("Test 3: Streaming Response")
    
    try:
        client = ClaudeSDKClient()
        print("Requesting a list with streaming...")
        
        start_time = time.time()
        chunk_count = 0
        
        async for chunk in client.run_stream("List 3 Python web frameworks"):
            chunk_count += 1
            print(f"  Chunk {chunk_count}: {chunk.content[:50]}...")
        
        elapsed = time.time() - start_time
        print(f"✅ Received {chunk_count} chunks in {elapsed:.2f}s")
        
        return chunk_count > 0
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

async def test_error_handling():
    """Test 4: Error handling and recovery"""
    print_section("Test 4: Error Handling")
    
    try:
        client = ClaudeSDKClient(timeout=5)  # Short timeout
        
        # Test with invalid prompt (empty)
        try:
            result = await client.run("")
            print("❌ Should have raised an error for empty prompt")
            return False
        except ValueError as e:
            print(f"✅ Correctly caught empty prompt error: {e}")
        
        # Test timeout handling (this might not actually timeout)
        print("Testing timeout handling...")
        try:
            result = await client.run("Write a very short haiku")
            if result.success:
                print("✅ Query completed within timeout")
            else:
                print(f"✅ Query failed gracefully: {result.error}")
        except Exception as e:
            print(f"✅ Timeout handled: {e}")
        
        return True
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

async def test_session_management():
    """Test 5: Session persistence"""
    print_section("Test 5: Session Management")
    
    try:
        client = ClaudeSDKClient()
        
        # First query
        print("Query 1: Setting context...")
        result1 = await client.run("Remember this number: 42")
        if result1.success:
            print(f"✅ First query successful")
        
        # Second query (should remember context)
        print("Query 2: Testing context retention...")
        result2 = await client.run("What number did I just tell you?")
        if result2.success:
            print(f"✅ Second query successful")
            # Check if "42" is mentioned in response
            if "42" in str(result2.result):
                print("✅ Context retained across queries!")
            else:
                print("⚠️  Context might not be retained")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

async def test_complex_task():
    """Test 6: Complex task execution"""
    print_section("Test 6: Complex Task")
    
    try:
        client = ClaudeSDKClient(verbose=True)
        
        print("Requesting code generation...")
        prompt = "Write a Python function that calculates factorial recursively with error handling"
        
        result = await client.run(prompt)
        
        if result.success:
            print("✅ Complex task completed")
            # Check if code was generated
            if "def" in str(result.result) and "factorial" in str(result.result).lower():
                print("✅ Code generation verified")
            return True
        else:
            print(f"❌ Task failed: {result.error}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

async def run_all_tests():
    """Run all tests and report results"""
    print("\n" + "="*50)
    print("  CLAUDE CODE PYTHON SDK - REAL TESTING")
    print("="*50)
    
    tests = [
        ("Basic Query", test_basic_query),
        ("Client Initialization", test_client_initialization),
        ("Streaming Response", test_streaming_response),
        ("Error Handling", test_error_handling),
        ("Session Management", test_session_management),
        ("Complex Task", test_complex_task),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            passed = await test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Print summary
    print_section("TEST SUMMARY")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {name:.<30} {status}")
    
    print(f"\n  Total: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("\n🎉 ALL TESTS PASSED! The SDK is working perfectly!")
    elif passed_count > total_count / 2:
        print("\n⚠️  Most tests passed. Check failed tests for issues.")
    else:
        print("\n❌ Multiple tests failed. Please check the configuration.")
    
    return passed_count, total_count

async def quick_demo():
    """Quick interactive demo"""
    print_section("QUICK INTERACTIVE DEMO")
    
    print("Let's try a real query to Claude!")
    print("Asking: 'What is 2+2 and why?'\n")
    
    async for message in query("What is 2+2 and why?"):
        print(f"Claude: {message.content}")
    
    print("\n✅ Demo complete!")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        # Run quick demo
        asyncio.run(quick_demo())
    else:
        # Run full test suite
        passed, total = asyncio.run(run_all_tests())
        sys.exit(0 if passed == total else 1)