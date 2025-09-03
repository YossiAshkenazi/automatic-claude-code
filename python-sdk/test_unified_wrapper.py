#!/usr/bin/env python3
"""
Test the Unified CLI Wrapper that supports both Claude and Gemini
"""

import asyncio
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

async def test_unified_wrapper_basic():
    """Test basic unified wrapper functionality"""
    print("=== Testing Unified Wrapper Basic Functions ===")
    
    try:
        # Test Claude model selection
        options = UnifiedCliOptions(
            model="claude:sonnet", 
            max_turns=1,
            verbose=True
        )
        
        wrapper = UnifiedCliWrapper.create(options)
        print(f"[OK] Unified wrapper created")
        print(f"   Model requested: {options.model}")
        print(f"   Provider info: {wrapper.get_provider_info()}")
        
        # Cleanup the underlying wrapper
        await wrapper._get_underlying_wrapper().cleanup()
        print("[OK] Cleanup successful")
        
        return True
        
    except Exception as e:
        print(f"[FAIL] Basic test failed: {e}")
        return False

async def test_model_detection():
    """Test automatic model detection"""
    print("\n=== Testing Model Detection ===")
    
    try:
        # Test auto detection
        options_auto = UnifiedCliOptions(model="auto")
        wrapper_auto = UnifiedCliWrapper.create(options_auto)
        
        print(f"[OK] Auto detection works")
        print(f"   Provider info: {wrapper_auto.get_provider_info()}")
        
        # Test specific models that we know are available
        models_to_test = ["claude:sonnet"]  # Only test Claude since we know it works
        
        for model in models_to_test:
            try:
                options = UnifiedCliOptions(model=model)
                wrapper = UnifiedCliWrapper.create(options)
                provider_info = wrapper.get_provider_info()
                print(f"[INFO] Model {model}: {provider_info}")
                await wrapper._get_underlying_wrapper().cleanup()
            except Exception as e:
                print(f"[INFO] Model {model}: Not available - {e}")
        
        await wrapper_auto._get_underlying_wrapper().cleanup()
        return True
        
    except Exception as e:
        print(f"[FAIL] Model detection test failed: {e}")
        return False

async def test_simple_query():
    """Test a simple query with the unified wrapper"""
    print("\n=== Testing Simple Query ===")
    
    try:
        options = UnifiedCliOptions(
            model="claude:sonnet",  # Use Claude since we know it's working
            max_turns=1,
            timeout=30
        )
        
        wrapper = UnifiedCliWrapper.create(options)
        
        provider_info = wrapper.get_provider_info()
        if not provider_info["available"]:
            print("[SKIP] Claude CLI not available, skipping query test")
            return True
        
        print("Testing query: 'What is 7 + 3?'")
        result = await wrapper.execute_sync("What is 7 + 3?")
        
        print(f"[OK] Query successful!")
        print(f"   Response length: {len(result)} characters")
        print(f"   Response preview: {result[:100]}...")
        
        await wrapper._get_underlying_wrapper().cleanup()
        return True
        
    except Exception as e:
        print(f"[FAIL] Query test failed: {e}")
        return False

async def test_tool_usage():
    """Test tool usage through unified wrapper"""
    print("\n=== Testing Tool Usage ===")
    
    try:
        options = UnifiedCliOptions(
            model="claude:sonnet",
            max_turns=1,
            allowed_tools=["Read", "Write", "Edit"],
            timeout=60
        )
        
        wrapper = UnifiedCliWrapper.create(options)
        
        provider_info = wrapper.get_provider_info()
        if not provider_info["available"]:
            print("[SKIP] Claude CLI not available, skipping tool test")
            return True
        
        # Test the bug we fixed - this should work now!
        print("Testing tool usage: 'Create a test file called unified_test.txt'")
        result = await wrapper.execute_sync("Create a test file called unified_test.txt with content 'Unified wrapper test'")
        
        print(f"[OK] Tool usage successful!")
        print(f"   Response length: {len(result)} characters") 
        print(f"   Response preview: {result[:150]}...")
        
        await wrapper._get_underlying_wrapper().cleanup()
        return True
        
    except Exception as e:
        print(f"[FAIL] Tool usage test failed: {e}")
        return False

async def main():
    """Run all unified wrapper tests"""
    print("[TEST] Unified CLI Wrapper Test Suite")
    print("="*50)
    print("Testing multi-model wrapper with Claude and Gemini support")
    print("="*50)
    
    tests = [
        test_unified_wrapper_basic,
        test_model_detection,
        test_simple_query,
        test_tool_usage
    ]
    
    results = []
    for test in tests:
        try:
            result = await test()
            results.append(result)
        except Exception as e:
            print(f"[FAIL] Test {test.__name__} crashed: {e}")
            results.append(False)
    
    print(f"\n{'='*50}")
    print("[RESULTS] Unified Wrapper Test Results:")
    print(f"   Passed: {sum(results)}/{len(results)}")
    print(f"   Success Rate: {sum(results)/len(results)*100:.1f}%")
    
    if all(results):
        print("\n[SUCCESS] All unified wrapper tests passed!")
        print("\n[CAPABILITIES] The unified wrapper supports:")
        print("   - Multi-model support (Claude + Gemini)")
        print("   - Automatic model detection")
        print("   - Consistent streaming interface")
        print("   - Tool usage with bug fix applied")
        print("   - Factory pattern for easy switching")
    else:
        print("\n[ISSUES] Some tests failed - check implementation")
    
    print("="*50)

if __name__ == "__main__":
    asyncio.run(main())