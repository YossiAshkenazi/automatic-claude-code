#!/usr/bin/env python3
"""
Test runner for Claude CLI Wrapper tests
Part of Story 1.1: Comprehensive CLI Wrapper Testing & Validation
"""

import sys
import subprocess
import os
from pathlib import Path

def run_tests():
    """Run the test suite with coverage reporting"""
    
    # Ensure we're in the right directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print("[TEST] Running Claude CLI Wrapper Test Suite")
    print("=" * 50)
    
    # Check if pytest is available
    try:
        import pytest
        print("[OK] pytest found")
    except ImportError:
        print("[INSTALL] pytest not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pytest", "pytest-asyncio", "pytest-cov"])
        import pytest
    
    # Check if pytest-asyncio is available
    try:
        import pytest_asyncio
        print("[OK] pytest-asyncio found")
    except ImportError:
        print("[INSTALL] pytest-asyncio not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pytest-asyncio"])
    
    # Run tests with coverage
    test_args = [
        "tests/test_claude_cli_wrapper.py",
        "-v",                    # Verbose output
        "--tb=short",           # Short traceback format
        "--asyncio-mode=auto",  # Auto-detect asyncio mode
        "-x",                   # Stop on first failure
        "--durations=10"        # Show 10 slowest tests
    ]
    
    # Add coverage if available
    try:
        import coverage
        test_args.extend([
            "--cov=claude_cli_wrapper",
            "--cov-report=term-missing",
            "--cov-report=html:htmlcov"
        ])
        print("[OK] Coverage reporting enabled")
    except ImportError:
        print("[WARN] Coverage not available (install with: pip install pytest-cov)")
    
    print(f"\n[RUN] Running: pytest {' '.join(test_args)}")
    print("-" * 50)
    
    # Run the tests
    exit_code = pytest.main(test_args)
    
    print("-" * 50)
    if exit_code == 0:
        print("[SUCCESS] All tests passed!")
        if 'coverage' in locals():
            print("[INFO] Coverage report generated in htmlcov/ directory")
    else:
        print("[FAILED] Some tests failed")
        print("See output above for details")
    
    return exit_code

def run_specific_test(test_name):
    """Run a specific test"""
    import pytest  # Import here to ensure it's available
    
    test_args = [
        "tests/test_claude_cli_wrapper.py",
        "-v",
        "--tb=short",
        "--asyncio-mode=auto",
        "-k", test_name
    ]
    
    print(f"[TARGET] Running specific test: {test_name}")
    return pytest.main(test_args)

def run_integration_tests():
    """Run only integration tests"""
    return run_specific_test("integration")

def run_parsing_tests():
    """Run only parsing tests"""
    return run_specific_test("parsing")

def run_async_tests():
    """Run only async tests"""
    return run_specific_test("async")

def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "parsing":
            return run_parsing_tests()
        elif command == "async":
            return run_async_tests()
        elif command == "integration":
            return run_integration_tests()
        elif command.startswith("test_"):
            return run_specific_test(command)
        else:
            print(f"Unknown command: {command}")
            print("Available commands: parsing, async, integration, or specific test name")
            return 1
    else:
        return run_tests()

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)