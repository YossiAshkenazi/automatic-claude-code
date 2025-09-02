#!/usr/bin/env python3
"""
Your personal test of Claude Code SDK
This will actually call Claude CLI
"""

import asyncio
from claude_code_sdk import query, ClaudeSDKClient

async def test_simple_query():
    """Test a simple query to Claude"""
    print("\n=== Testing Simple Query ===")
    print("Asking Claude: 'What is Python best used for?'\n")
    
    response_received = False
    async for message in query("What is Python best used for? Give me 3 bullet points"):
        print(f"Claude says: {message.content}")
        response_received = True
    
    if response_received:
        print("\n[SUCCESS] Got response from Claude!")
    else:
        print("\n[FAIL] No response received")
    
    return response_received

async def test_code_generation():
    """Test code generation"""
    print("\n=== Testing Code Generation ===")
    print("Asking Claude to write code...\n")
    
    client = ClaudeSDKClient()
    result = await client.run("Write a Python function to reverse a string")
    
    if result and result.success:
        print("Generated code:")
        print(result.result)
        print("\n[SUCCESS] Code generated!")
        return True
    else:
        print(f"[FAIL] Code generation failed: {result.error if result else 'No result'}")
        return False

async def test_streaming():
    """Test streaming responses"""
    print("\n=== Testing Streaming ===")
    print("Asking for a list with streaming...\n")
    
    client = ClaudeSDKClient()
    chunks = []
    
    # Note: run_stream might not be implemented, so we'll handle gracefully
    try:
        async for chunk in client.run_stream("List 5 Python web frameworks"):
            print(f"Chunk: {chunk.content[:50]}...")
            chunks.append(chunk)
        
        if chunks:
            print(f"\n[SUCCESS] Received {len(chunks)} streaming chunks!")
            return True
        else:
            print("\n[INFO] No streaming chunks received")
            return False
    except AttributeError:
        print("[INFO] Streaming not available in this version")
        return False
    except Exception as e:
        print(f"[WARNING] Streaming test failed: {e}")
        return False

async def main():
    """Run all real tests"""
    print("\n" + "="*60)
    print("  CLAUDE CODE SDK - REAL WORLD TEST")
    print("  This will actually call Claude CLI!")
    print("="*60)
    
    # Check if Claude CLI is available
    import shutil
    if not shutil.which('claude'):
        print("\n[ERROR] Claude CLI not found!")
        print("Install it with: npm install -g @anthropic-ai/claude-code")
        print("Then authenticate: claude auth")
        return
    
    print("\n[INFO] Claude CLI found. Starting tests...")
    
    tests = [
        ("Simple Query", test_simple_query),
        ("Code Generation", test_code_generation),
        ("Streaming", test_streaming),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            passed = await test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n[ERROR] {name} crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*60)
    print("  TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, p in results if p)
    total = len(results)
    
    for name, success in results:
        status = "[PASS]" if success else "[FAIL]"
        print(f"  {name:.<30} {status}")
    
    print(f"\n  Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n[SUCCESS] All tests passed! The SDK is working perfectly!")
    elif passed > 0:
        print(f"\n[PARTIAL] {passed} test(s) passed. The SDK is partially working.")
    else:
        print("\n[FAIL] No tests passed. Check your Claude CLI setup.")

if __name__ == "__main__":
    asyncio.run(main())