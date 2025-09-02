#!/usr/bin/env python3
"""
Quick test to verify our fixes work
"""

import sys
import os

# Set encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def test_imports():
    """Test that all imports work correctly"""
    print("Testing imports...")
    
    try:
        # Test main imports
        from claude_code_sdk import query, ClaudeCodeClient, quick_query
        print("[OK] Main imports successful")
        
        # Test exception imports
        from claude_code_sdk import ClaudeCodeError, classify_error
        print("[OK] Exception imports successful")
        
        return True
    except Exception as e:
        print(f"[ERROR] Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_error_classification():
    """Test that error classification now returns exceptions"""
    print("\nTesting error classification...")
    
    try:
        from claude_code_sdk.exceptions import classify_error, ClaudeCodeError
        
        # Test classification
        error = classify_error("Authentication failed", stderr="auth error", exit_code=1)
        
        # Should be an exception instance, not a dict
        if isinstance(error, Exception):
            print(f"[OK] classify_error returns exception: {type(error).__name__}")
            if isinstance(error, ClaudeCodeError):
                print(f"[OK] Returns proper ClaudeCodeError subclass: {error}")
                return True
            else:
                print(f"[FAIL] Not a ClaudeCodeError: {type(error)}")
                return False
        else:
            print(f"[FAIL] classify_error returns {type(error)}, not exception")
            return False
            
    except Exception as e:
        print(f"[ERROR] Error classification test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_client_methods():
    """Test that client has the expected methods"""
    print("\nTesting client methods...")
    
    try:
        from claude_code_sdk import ClaudeCodeClient
        
        client = ClaudeCodeClient()
        
        # Check methods exist
        if hasattr(client, 'execute'):
            print("[OK] Client has execute() method")
        else:
            print("[FAIL] Client missing execute() method")
            return False
            
        if hasattr(client, 'query'):
            print("[OK] Client has query() method")
        else:
            print("[FAIL] Client missing query() method")
            return False
            
        print("[OK] Client has all expected methods")
        return True
        
    except Exception as e:
        print(f"[ERROR] Client method test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("QUICK SDK FIXES VALIDATION")
    print("=" * 50)
    
    tests = [
        ("Imports", test_imports),
        ("Error Classification", test_error_classification),
        ("Client Methods", test_client_methods)
    ]
    
    passed = 0
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"[PASS] {name}")
            else:
                print(f"[FAIL] {name}")
        except Exception as e:
            print(f"[ERROR] {name}: {e}")
    
    print("\n" + "=" * 50)
    print(f"RESULTS: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("\nALL FIXES WORKING! SDK should now be functional.")
        print("\nFixed issues:")
        print("- BaseException inheritance (classify_error returns exceptions)")
        print("- Method names (added execute() method)")  
        print("- Import paths (quick_query exported)")
        return True
    else:
        print(f"\n{len(tests) - passed} issues remain")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)