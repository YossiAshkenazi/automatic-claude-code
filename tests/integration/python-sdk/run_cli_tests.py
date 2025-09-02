#!/usr/bin/env python3
"""
Test runner for CLI wrapper tests
Provides different test execution modes and reporting
"""

import subprocess
import sys
from pathlib import Path

def run_unit_tests():
    """Run unit tests only"""
    cmd = [
        sys.executable, "-m", "pytest", 
        "tests/test_cli_wrappers.py", 
        "-m", "unit",
        "--verbose",
        "--cov=claude_cli_wrapper",
        "--cov=gemini_cli_wrapper", 
        "--cov=unified_cli_wrapper",
        "--cov-report=term-missing"
    ]
    return subprocess.run(cmd, cwd=Path(__file__).parent.parent)

def run_integration_tests():
    """Run integration tests (requires CLI installations)"""
    cmd = [
        sys.executable, "-m", "pytest",
        "tests/test_cli_wrappers.py",
        "-m", "integration",
        "--verbose",
        "-s"  # Don't capture output for integration tests
    ]
    return subprocess.run(cmd, cwd=Path(__file__).parent.parent)

def run_all_tests():
    """Run all tests with full coverage"""
    cmd = [
        sys.executable, "-m", "pytest",
        "tests/test_cli_wrappers.py",
        "--verbose", 
        "--cov=claude_cli_wrapper",
        "--cov=gemini_cli_wrapper",
        "--cov=unified_cli_wrapper",
        "--cov-report=term-missing",
        "--cov-report=html",
        "--cov-fail-under=90"
    ]
    return subprocess.run(cmd, cwd=Path(__file__).parent.parent)

def run_performance_tests():
    """Run performance benchmarks"""
    cmd = [
        sys.executable, "-m", "pytest",
        "tests/test_cli_wrappers.py::TestPerformanceBenchmarks",
        "--verbose",
        "-s"
    ]
    return subprocess.run(cmd, cwd=Path(__file__).parent.parent)

def main():
    """Main test runner with command line options"""
    if len(sys.argv) < 2:
        print("Usage: python run_cli_tests.py [unit|integration|all|performance]")
        print("  unit        - Run unit tests only")
        print("  integration - Run integration tests (requires CLI installations)")
        print("  all         - Run all tests with coverage")
        print("  performance - Run performance benchmarks")
        sys.exit(1)
        
    test_type = sys.argv[1].lower()
    
    if test_type == "unit":
        result = run_unit_tests()
    elif test_type == "integration":
        result = run_integration_tests()
    elif test_type == "all":
        result = run_all_tests()
    elif test_type == "performance":
        result = run_performance_tests()
    else:
        print(f"Unknown test type: {test_type}")
        sys.exit(1)
        
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()