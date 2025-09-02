#!/usr/bin/env python3
"""
CLI Integration Verification Script
Verifies all components of the CLI wrapper integration project
"""

import os
import sys
import asyncio
from pathlib import Path
from typing import Dict, List, Tuple

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

def check_file_exists(filepath: str) -> Tuple[bool, str]:
    """Check if a file exists and return status."""
    path = Path(filepath)
    if path.exists():
        size = path.stat().st_size
        return True, f"[OK] {filepath} ({size:,} bytes)"
    return False, f"[FAIL] {filepath} (missing)"

def verify_files() -> Dict[str, List[Tuple[bool, str]]]:
    """Verify all expected files exist."""
    results = {}
    
    # Core wrapper files
    results["Core Wrappers"] = [
        check_file_exists("claude_cli_wrapper.py"),
        check_file_exists("gemini_cli_wrapper.py"),
        check_file_exists("unified_cli_wrapper.py"),
    ]
    
    # Example files
    results["Examples"] = [
        check_file_exists("examples/01_simple_query.py"),
        check_file_exists("examples/02_streaming_example.py"),
        check_file_exists("examples/03_multi_model_comparison.py"),
        check_file_exists("examples/04_tool_usage_example.py"),
        check_file_exists("examples/05_error_handling_example.py"),
        check_file_exists("examples/README.md"),
    ]
    
    # Test files
    results["Tests"] = [
        check_file_exists("tests/test_cli_wrappers.py"),
        check_file_exists("tests/run_cli_tests.py"),
        check_file_exists("tests/pytest.ini"),
        check_file_exists("tests/README.md"),
    ]
    
    # Documentation
    results["Documentation"] = [
        check_file_exists("CLI_INTEGRATION_SUMMARY.md"),
        check_file_exists("README.md"),
    ]
    
    return results

async def test_imports() -> Dict[str, Tuple[bool, str]]:
    """Test if modules can be imported."""
    results = {}
    
    modules = [
        "claude_cli_wrapper",
        "gemini_cli_wrapper",
        "unified_cli_wrapper",
    ]
    
    for module in modules:
        try:
            exec(f"import {module}")
            results[module] = (True, f"[OK] {module} imports successfully")
        except ImportError as e:
            results[module] = (False, f"[FAIL] {module}: {e}")
        except Exception as e:
            results[module] = (False, f"[WARN] {module}: {e}")
    
    return results

async def test_wrapper_instantiation() -> Dict[str, Tuple[bool, str]]:
    """Test if wrappers can be instantiated."""
    results = {}
    
    # Test Claude wrapper
    try:
        from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions
        options = ClaudeCliOptions(model="sonnet", verbose=False)
        wrapper = ClaudeCliWrapper(options)
        results["Claude"] = (True, f"[OK] ClaudeCliWrapper instantiated (CLI: {wrapper.cli_path})")
    except Exception as e:
        results["Claude"] = (False, f"[FAIL] ClaudeCliWrapper: {e}")
    
    # Test Gemini wrapper
    try:
        from gemini_cli_wrapper import GeminiCliWrapper, GeminiCliOptions
        options = GeminiCliOptions(model="gemini-2.5-pro", yolo=True)
        wrapper = GeminiCliWrapper(options)
        results["Gemini"] = (True, f"[OK] GeminiCliWrapper instantiated")
    except Exception as e:
        results["Gemini"] = (False, f"[FAIL] GeminiCliWrapper: {e}")
    
    # Test Unified wrapper
    try:
        from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions
        options = UnifiedCliOptions(model="auto")
        wrapper = UnifiedCliWrapper.create(options)
        results["Unified"] = (True, f"[OK] UnifiedCliWrapper created (Provider: {wrapper.provider_name})")
    except Exception as e:
        results["Unified"] = (False, f"[FAIL] UnifiedCliWrapper: {e}")
    
    return results

def print_results(title: str, results: Dict):
    """Pretty print verification results."""
    print(f"\n{'='*60}")
    print(f" {title}")
    print('='*60)
    
    if isinstance(results, dict):
        for category, items in results.items():
            if isinstance(items, list):
                print(f"\n{category}:")
                for success, message in items:
                    print(f"  {message}")
            else:
                success, message = items
                print(f"  {message}")
    
    # Calculate success rate
    total = 0
    passed = 0
    for items in results.values():
        if isinstance(items, list):
            for success, _ in items:
                total += 1
                if success:
                    passed += 1
        else:
            success, _ = items
            total += 1
            if success:
                passed += 1
    
    success_rate = (passed / total * 100) if total > 0 else 0
    print(f"\nSuccess Rate: {passed}/{total} ({success_rate:.1f}%)")

async def main():
    """Run all verification tests."""
    print("\n" + "CLI INTEGRATION VERIFICATION REPORT".center(60))
    print("="*60)
    
    # Check files
    file_results = verify_files()
    print_results("File Verification", file_results)
    
    # Test imports
    import_results = await test_imports()
    print_results("Import Tests", {"Imports": list(import_results.values())})
    
    # Test instantiation
    instantiation_results = await test_wrapper_instantiation()
    print_results("Wrapper Instantiation", {"Wrappers": list(instantiation_results.values())})
    
    # Overall summary
    print("\n" + "="*60)
    print(" OVERALL INTEGRATION STATUS")
    print("="*60)
    
    total_files = sum(len(items) for items in file_results.values())
    passed_files = sum(1 for items in file_results.values() for success, _ in items if success)
    
    total_tests = len(import_results) + len(instantiation_results)
    passed_tests = sum(1 for success, _ in import_results.values() if success)
    passed_tests += sum(1 for success, _ in instantiation_results.values() if success)
    
    print(f"\n[Files]: {passed_files}/{total_files} created")
    print(f"[Tests]: {passed_tests}/{total_tests} passed")
    
    if passed_files == total_files and passed_tests == total_tests:
        print("\n[SUCCESS] CLI INTEGRATION: FULLY OPERATIONAL")
    elif passed_files >= total_files * 0.8:
        print("\n[WARNING] CLI INTEGRATION: MOSTLY COMPLETE (Minor issues)")
    else:
        print("\n[ERROR] CLI INTEGRATION: INCOMPLETE (Major issues)")
    
    print("\n" + "="*60)
    print("\nNext Steps:")
    print("  1. Run: python examples/01_simple_query.py")
    print("  2. Test: python tests/run_cli_tests.py unit")
    print("  3. Authenticate: claude auth (if not done)")
    print("\n" + "="*60)

if __name__ == "__main__":
    asyncio.run(main())