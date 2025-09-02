#!/usr/bin/env python3
"""
Basic wrapper functionality test without requiring CLI authentication
"""

import asyncio
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def test_wrapper_initialization():
    """Test that wrapper initializes correctly"""
    print("=== Testing Wrapper Initialization ===")
    
    try:
        # Test basic initialization
        options = ClaudeCliOptions(
            model="sonnet",
            max_turns=1,
            verbose=True,
            timeout=30
        )
        
        wrapper = ClaudeCliWrapper(options)
        print(f"[OK] Wrapper initialized successfully")
        print(f"   CLI Path: {wrapper.cli_path}")
        print(f"   Model: {wrapper.options.model}")
        print(f"   Available: {wrapper.is_available()}")
        
        # Test cleanup method exists
        await wrapper.cleanup()
        print("[OK] Cleanup method works")
        
        return True
        
    except Exception as e:
        print(f"[FAIL] Initialization failed: {e}")
        return False

async def test_cli_args_generation():
    """Test CLI argument generation"""
    print("\n=== Testing CLI Arguments Generation ===")
    
    try:
        options = ClaudeCliOptions(
            model="opus",
            max_turns=5,
            verbose=True,
            timeout=60
        )
        
        args = options.to_cli_args()
        print(f"[OK] CLI args generated: {args}")
        
        # Verify expected arguments
        assert "--model" in args
        assert "opus" in args
        assert "--max-turns" in args
        assert "5" in args
        
        print("[OK] CLI arguments validation passed")
        return True
        
    except Exception as e:
        print(f"[FAIL] CLI args test failed: {e}")
        return False

async def test_error_handling():
    """Test error handling without actual CLI calls"""
    print("\n=== Testing Error Handling ===")
    
    try:
        # Test with invalid CLI path
        options = ClaudeCliOptions(cli_path="/nonexistent/path/claude")
        wrapper = ClaudeCliWrapper(options)
        
        print(f"[OK] Handles invalid CLI path gracefully")
        print(f"   Available: {wrapper.is_available()}")
        
        await wrapper.cleanup()
        print("[OK] Cleanup works with invalid CLI")
        
        return True
        
    except Exception as e:
        print(f"[FAIL] Error handling test failed: {e}")
        return False

async def main():
    """Run all wrapper tests"""
    print("[TEST] CLI Wrapper Basic Functionality Tests")
    print("="*50)
    print("Note: These tests don't require CLI authentication")
    print("="*50)
    
    tests = [
        test_wrapper_initialization,
        test_cli_args_generation, 
        test_error_handling
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
    print("[RESULTS] Test Results Summary:")
    print(f"   Passed: {sum(results)}/{len(results)}")
    print(f"   Success Rate: {sum(results)/len(results)*100:.1f}%")
    
    if all(results):
        print("[OK] All wrapper infrastructure tests passed!")
        print("\n[NEXT] Next Steps:")
        print("   1. Authenticate Claude CLI: claude setup-token")
        print("   2. Run examples: python examples/01_simple_query.py")
    else:
        print("[FAIL] Some tests failed - check wrapper implementation")
    
    print("="*50)

if __name__ == "__main__":
    asyncio.run(main())