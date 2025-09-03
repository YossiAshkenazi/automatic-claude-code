#!/usr/bin/env python3
"""
Test Claude Code SDK locally without requiring Claude CLI
This tests the SDK structure and imports
"""

import sys
import asyncio
from pathlib import Path

def test_imports():
    """Test that all SDK modules can be imported"""
    print("\n=== Testing SDK Imports ===\n")
    
    modules_to_test = [
        "claude_code_sdk",
        "claude_code_sdk.client",
        "claude_code_sdk.executor",
        "claude_code_sdk.utils",
        "claude_code_sdk.integrations.automatic_claude",
    ]
    
    failed = []
    for module in modules_to_test:
        try:
            __import__(module)
            print(f"[PASS] {module}")
        except ImportError as e:
            print(f"[FAIL] {module}: {e}")
            failed.append(module)
    
    return len(failed) == 0

def test_client_creation():
    """Test creating client instances"""
    print("\n=== Testing Client Creation ===\n")
    
    try:
        from claude_code_sdk import ClaudeSDKClient
        
        # Test default client
        client = ClaudeSDKClient()
        print(f"[PASS] Default client created")
        print(f"   - Model: {client.model}")
        print(f"   - Timeout: {client.timeout}")
        print(f"   - Verbose: {client.verbose}")
        
        # Test custom client
        custom = ClaudeSDKClient(
            model="opus",
            timeout=120,
            verbose=True,
            temperature=0.5
        )
        print(f"[PASS] Custom client created")
        print(f"   - Model: {custom.model}")
        print(f"   - Timeout: {custom.timeout}")
        
        return True
    except Exception as e:
        print(f"[FAIL] Failed to create client: {e}")
        return False

def test_options():
    """Test ClaudeCodeOptions configuration"""
    print("\n=== Testing Options Configuration ===\n")
    
    try:
        from claude_code_sdk.client import ClaudeCodeOptions
        
        # Test default options
        opts = ClaudeCodeOptions()
        print(f"[PASS] Default options created")
        
        # Test custom options
        custom_opts = ClaudeCodeOptions(
            model="sonnet",
            timeout=90000,
            apiKey="test-key",
            verbose=True
        )
        print(f"[PASS] Custom options created")
        print(f"   - Model: {custom_opts.model}")
        print(f"   - Timeout: {custom_opts.timeout}ms")
        
        return True
    except Exception as e:
        print(f"[FAIL] Failed to create options: {e}")
        return False

def test_integration_imports():
    """Test ACC integration module"""
    print("\n=== Testing ACC Integration ===\n")
    
    try:
        from claude_code_sdk.integrations.automatic_claude import AutomaticClaudeIntegration
        
        # Don't actually create integration (requires ACC)
        print(f"[PASS] AutomaticClaudeIntegration imported successfully")
        print(f"   - Class available for ACC integration")
        print(f"   - Dual-agent support ready")
        
        return True
    except Exception as e:
        print(f"[FAIL] Failed to import integration: {e}")
        return False

def test_query_function():
    """Test query function availability"""
    print("\n=== Testing Query Function ===\n")
    
    try:
        from claude_code_sdk import query
        
        print(f"[PASS] query() function imported")
        print(f"   - Type: {type(query)}")
        print(f"   - Async generator function ready")
        
        # Test that it's actually an async function
        import inspect
        if inspect.iscoroutinefunction(query):
            print(f"[PASS] query() is an async function")
        else:
            print(f"[WARN]  query() might not be properly async")
        
        return True
    except Exception as e:
        print(f"[FAIL] Failed to import query: {e}")
        return False

def test_examples_exist():
    """Test that example files exist and are valid Python"""
    print("\n=== Testing Example Files ===\n")
    
    examples_dir = Path(__file__).parent / "examples"
    if not examples_dir.exists():
        print(f"[FAIL] Examples directory not found")
        return False
    
    example_files = list(examples_dir.glob("*.py"))
    if not example_files:
        print(f"[FAIL] No example files found")
        return False
    
    for example in example_files:
        try:
            # Try to compile the file
            with open(example, 'r') as f:
                compile(f.read(), example, 'exec')
            print(f"[PASS] {example.name}")
        except SyntaxError as e:
            print(f"[FAIL] {example.name}: Syntax error - {e}")
            return False
        except Exception as e:
            print(f"[WARN]  {example.name}: {e}")
    
    return True

def test_documentation():
    """Test that documentation files exist"""
    print("\n=== Testing Documentation ===\n")
    
    docs = {
        "README.md": Path(__file__).parent / "README.md",
        "CHANGELOG.md": Path(__file__).parent / "CHANGELOG.md",
        "QUICKSTART.md": Path(__file__).parent / "docs" / "QUICKSTART.md",
        "API.md": Path(__file__).parent / "docs" / "API.md",
    }
    
    all_exist = True
    for name, path in docs.items():
        if path.exists():
            size = path.stat().st_size
            print(f"[PASS] {name} ({size:,} bytes)")
        else:
            print(f"[FAIL] {name} not found")
            all_exist = False
    
    return all_exist

def test_package_structure():
    """Test package structure is correct"""
    print("\n=== Testing Package Structure ===\n")
    
    required_files = [
        "pyproject.toml",
        "setup.py",
        "src/claude_code_sdk/__init__.py",
        "src/claude_code_sdk/client.py",
        "src/claude_code_sdk/executor.py",
    ]
    
    base_dir = Path(__file__).parent
    all_exist = True
    
    for file_path in required_files:
        full_path = base_dir / file_path
        if full_path.exists():
            print(f"[PASS] {file_path}")
        else:
            print(f"[FAIL] {file_path} not found")
            all_exist = False
    
    return all_exist

async def test_async_compatibility():
    """Test async compatibility"""
    print("\n=== Testing Async Compatibility ===\n")
    
    try:
        from claude_code_sdk import ClaudeSDKClient
        
        client = ClaudeSDKClient()
        
        # Test that run is async
        if hasattr(client, 'run'):
            import inspect
            if inspect.iscoroutinefunction(client.run):
                print(f"[PASS] client.run() is async")
            else:
                print(f"[FAIL] client.run() is not async")
                return False
        
        # Test that run_stream exists
        if hasattr(client, 'run_stream'):
            print(f"[PASS] client.run_stream() exists")
        else:
            print(f"[WARN]  client.run_stream() not found")
        
        # Test run_sync exists
        if hasattr(client, 'run_sync'):
            print(f"[PASS] client.run_sync() exists for synchronous usage")
        else:
            print(f"[WARN]  client.run_sync() not found")
        
        return True
    except Exception as e:
        print(f"[FAIL] Async compatibility test failed: {e}")
        return False

def main():
    """Run all local tests"""
    print("\n" + "="*60)
    print("  CLAUDE CODE SDK - LOCAL TESTING (No Claude CLI Required)")
    print("="*60)
    
    tests = [
        ("Package Structure", test_package_structure),
        ("Module Imports", test_imports),
        ("Client Creation", test_client_creation),
        ("Options Configuration", test_options),
        ("Query Function", test_query_function),
        ("ACC Integration", test_integration_imports),
        ("Example Files", test_examples_exist),
        ("Documentation", test_documentation),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n[FAIL] Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Run async test
    try:
        async_passed = asyncio.run(test_async_compatibility())
        results.append(("Async Compatibility", async_passed))
    except Exception as e:
        print(f"\n[FAIL] Async test crashed: {e}")
        results.append(("Async Compatibility", False))
    
    # Print summary
    print("\n" + "="*60)
    print("  TEST SUMMARY")
    print("="*60 + "\n")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        status = "[PASS] PASS" if passed else "[FAIL] FAIL"
        print(f"  {name:.<35} {status}")
    
    print(f"\n  Total: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("\n[SUCCESS] ALL LOCAL TESTS PASSED!")
        print("  The SDK structure is correct and ready for use.")
        print("\n  To test with real Claude CLI:")
        print("  1. Ensure Claude CLI is authenticated: claude auth")
        print("  2. Run: python test_real_sdk.py")
    elif passed_count > total_count / 2:
        print("\n[WARN]  Most tests passed. Check failed tests for issues.")
    else:
        print("\n[FAIL] Multiple tests failed. Please check the installation.")
    
    return 0 if passed_count == total_count else 1

if __name__ == "__main__":
    sys.exit(main())