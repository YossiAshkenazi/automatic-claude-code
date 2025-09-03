#!/usr/bin/env python3
"""
Simple test for Claude Code SDK - Windows compatible
Tests basic functionality without requiring Claude CLI to be running
"""

import sys
import os

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def test_sdk_import():
    """Test 1: Can we import the SDK?"""
    print("\n[TEST 1] Importing SDK...")
    try:
        import claude_code_sdk
        print("[PASS] SDK imported successfully")
        print(f"       Version: {claude_code_sdk.__version__}")
        return True
    except ImportError as e:
        print(f"[FAIL] Cannot import SDK: {e}")
        return False

def test_client_creation():
    """Test 2: Can we create a client?"""
    print("\n[TEST 2] Creating client...")
    try:
        from claude_code_sdk import ClaudeSDKClient
        
        # Create client (won't connect to Claude yet)
        client = ClaudeSDKClient()
        print("[PASS] Client created successfully")
        print(f"       Type: {type(client).__name__}")
        
        # Check attributes
        attrs = ['timeout', 'verbose']
        for attr in attrs:
            if hasattr(client, attr):
                print(f"       - {attr}: {getattr(client, attr)}")
        
        return True
    except Exception as e:
        print(f"[FAIL] Cannot create client: {e}")
        return False

def test_query_function():
    """Test 3: Is the query function available?"""
    print("\n[TEST 3] Testing query function...")
    try:
        from claude_code_sdk import query
        print("[PASS] query() function imported")
        print(f"       Type: {type(query).__name__}")
        return True
    except ImportError as e:
        print(f"[FAIL] Cannot import query: {e}")
        return False

def test_acc_integration():
    """Test 4: Can we import ACC integration?"""
    print("\n[TEST 4] Testing ACC integration...")
    try:
        from claude_code_sdk.integrations.automatic_claude import AutomaticClaudeIntegration
        print("[PASS] ACC integration available")
        print("       Dual-agent support ready")
        return True
    except ImportError as e:
        print(f"[FAIL] Cannot import ACC integration: {e}")
        return False

def test_documentation():
    """Test 5: Are docs present?"""
    print("\n[TEST 5] Checking documentation...")
    from pathlib import Path
    
    sdk_dir = Path(__file__).parent
    docs = {
        "README.md": sdk_dir / "README.md",
        "CHANGELOG.md": sdk_dir / "CHANGELOG.md",
    }
    
    found = 0
    for name, path in docs.items():
        if path.exists():
            print(f"[PASS] {name} found ({path.stat().st_size:,} bytes)")
            found += 1
        else:
            print(f"[FAIL] {name} not found")
    
    return found == len(docs)

def main():
    """Run all tests"""
    print("\n" + "="*50)
    print("  CLAUDE CODE SDK - SIMPLE TEST")
    print("="*50)
    
    tests = [
        test_sdk_import,
        test_client_creation,
        test_query_function,
        test_acc_integration,
        test_documentation,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"[ERROR] Test crashed: {e}")
    
    # Summary
    print("\n" + "="*50)
    print(f"  RESULTS: {passed}/{total} tests passed")
    print("="*50)
    
    if passed == total:
        print("\n[SUCCESS] All tests passed!")
        print("\nTo test with real Claude CLI:")
        print("1. Make sure Claude CLI is installed:")
        print("   npm install -g @anthropic-ai/claude-code")
        print("2. Authenticate Claude CLI:")
        print("   claude auth")
        print("3. Run a real query:")
        print("   python -c \"from claude_code_sdk import query; import asyncio; asyncio.run(query('Hello'))\"")
    else:
        print(f"\n[WARNING] {total - passed} test(s) failed")
        print("Check the errors above for details")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())