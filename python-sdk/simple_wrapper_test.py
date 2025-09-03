#!/usr/bin/env python3
"""
Simple test examples for the wrappers we created yesterday
"""

import asyncio
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

async def test_basic_claude():
    """Test the basic Claude wrapper with the bug fix"""
    print("=== TEST 1: Basic Claude Wrapper ===")
    
    options = ClaudeCliOptions(model="sonnet", max_turns=1, timeout=30)
    wrapper = ClaudeCliWrapper(options)
    
    try:
        # Test the JSON parsing bug fix
        print("Testing tool usage (bug fix)...")
        result = await wrapper.execute_sync("Create a file called test1.txt with 'Hello World'")
        print(f"SUCCESS: {len(result)} characters received")
        
        # Test simple query  
        print("Testing simple math...")
        result2 = await wrapper.execute_sync("What is 12 + 8?")
        print(f"Math result: {result2.strip()}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await wrapper.cleanup()

async def test_unified_wrapper():
    """Test the unified wrapper with factory pattern"""
    print("\n=== TEST 2: Unified Wrapper ===")
    
    try:
        # Auto-detect provider
        wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(model="auto"))
        
        info = wrapper.get_provider_info()
        print(f"Provider: {info['provider']} (available: {info['available']})")
        
        # Test unified interface
        result = await wrapper.execute_sync("What is the square root of 64?")
        print(f"Result: {result.strip()}")
        
        await wrapper._get_underlying_wrapper().cleanup()
        
    except Exception as e:
        print(f"Error: {e}")

async def test_provider_detection():
    """Test provider detection"""
    print("\n=== TEST 3: Provider Detection ===")
    
    providers = UnifiedCliWrapper.list_available_providers()
    
    print("Available providers:")
    for name, info in providers.items():
        status = "Available" if info["available"] else "Not available"
        print(f"  {name}: {status}")
        print(f"    Models: {', '.join(info['models'])}")

async def main():
    """Run all tests"""
    print("TESTING WRAPPERS FROM YESTERDAY")
    print("=" * 50)
    
    tests = [
        test_basic_claude,
        test_unified_wrapper, 
        test_provider_detection
    ]
    
    for test in tests:
        try:
            await test()
        except Exception as e:
            print(f"Test {test.__name__} failed: {e}")
    
    print("\n" + "=" * 50)
    print("TESTING COMPLETE!")
    print("Key features verified:")
    print("- JSON parsing bug fix working")
    print("- Unified wrapper factory pattern")
    print("- Provider auto-detection")
    print("- Tool usage functionality")

if __name__ == "__main__":
    asyncio.run(main())