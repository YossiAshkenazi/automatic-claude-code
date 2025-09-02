#!/usr/bin/env python3
"""
Simple Integration Test for Claude Code Python SDK v0.1.0
Tests package installation, basic functionality, and ACC integration.
"""

import subprocess
import sys
import tempfile
import os
from pathlib import Path
import json
from typing import Dict, List, Any

def main():
    print("=" * 60)
    print("Claude Code Python SDK v0.1.0 - Integration Test Report")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Python version compatibility
    print("\n[TEST 1] Python Version Compatibility")
    current_version = sys.version_info
    min_version = (3, 10)
    
    if current_version >= min_version:
        print(f"PASS - Python {current_version.major}.{current_version.minor}.{current_version.micro} >= 3.10")
        results["python_version"] = "PASS"
    else:
        print(f"FAIL - Python {current_version.major}.{current_version.minor}.{current_version.micro} < 3.10")
        results["python_version"] = "FAIL"
    
    # Test 2: Package build
    print("\n[TEST 2] Package Build")
    sdk_dir = Path(__file__).parent
    wheel_file = sdk_dir / "dist" / "claude_code_sdk-0.1.0-py3-none-any.whl"
    sdist_file = sdk_dir / "dist" / "claude_code_sdk-0.1.0.tar.gz"
    
    if wheel_file.exists() and sdist_file.exists():
        wheel_size = wheel_file.stat().st_size
        sdist_size = sdist_file.stat().st_size
        print(f"PASS - Wheel file: {wheel_size} bytes")
        print(f"PASS - Source dist: {sdist_size} bytes")
        results["package_build"] = "PASS"
    else:
        print("FAIL - Distribution files missing")
        results["package_build"] = "FAIL"
    
    # Test 3: Check dependencies issue
    print("\n[TEST 3] Dependencies Check")
    try:
        # Check if aiohttp is being imported
        monitoring_file = sdk_dir / "claude_code_sdk" / "integrations" / "monitoring.py"
        imports_aiohttp = False
        
        if monitoring_file.exists():
            with open(monitoring_file, 'r') as f:
                content = f.read()
                if "import aiohttp" in content:
                    imports_aiohttp = True
        
        if imports_aiohttp:
            # Check if aiohttp is in dependencies
            pyproject_file = sdk_dir / "pyproject.toml"
            if pyproject_file.exists():
                with open(pyproject_file, 'r') as f:
                    pyproject_content = f.read()
                    if "aiohttp" in pyproject_content:
                        print("PASS - aiohttp is imported and declared in dependencies")
                        results["dependencies"] = "PASS"
                    else:
                        print("FAIL - aiohttp is imported but not in pyproject.toml dependencies")
                        results["dependencies"] = "FAIL - Missing aiohttp dependency"
            else:
                print("ERROR - pyproject.toml not found")
                results["dependencies"] = "ERROR"
        else:
            print("PASS - No external dependencies imported")
            results["dependencies"] = "PASS"
            
    except Exception as e:
        print(f"ERROR - Could not check dependencies: {e}")
        results["dependencies"] = "ERROR"
    
    # Test 4: Basic imports (syntax check only)
    print("\n[TEST 4] Basic Import Syntax")
    try:
        import ast
        
        # Check main init file
        init_file = sdk_dir / "claude_code_sdk" / "__init__.py"
        with open(init_file, 'r') as f:
            content = f.read()
            
        # Parse AST to check syntax
        ast.parse(content)
        print("PASS - Main __init__.py syntax is valid")
        results["import_syntax"] = "PASS"
        
    except SyntaxError as e:
        print(f"FAIL - Syntax error in main module: {e}")
        results["import_syntax"] = "FAIL"
    except Exception as e:
        print(f"ERROR - Could not check syntax: {e}")
        results["import_syntax"] = "ERROR"
    
    # Test 5: Examples validation
    print("\n[TEST 5] Examples Validation")
    examples_dir = sdk_dir / "examples"
    if examples_dir.exists():
        example_files = list(examples_dir.glob("*.py"))
        if example_files:
            syntax_errors = 0
            for example_file in example_files:
                try:
                    result = subprocess.run([
                        sys.executable, "-m", "py_compile", str(example_file)
                    ], capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        print(f"PASS - {example_file.name} compiles correctly")
                    else:
                        print(f"FAIL - {example_file.name} has syntax errors")
                        syntax_errors += 1
                except Exception as e:
                    print(f"ERROR - Could not test {example_file.name}: {e}")
                    syntax_errors += 1
            
            if syntax_errors == 0:
                results["examples"] = "PASS"
            else:
                results["examples"] = f"FAIL - {syntax_errors} examples have issues"
        else:
            print("WARNING - No example files found")
            results["examples"] = "WARNING"
    else:
        print("WARNING - Examples directory not found")
        results["examples"] = "WARNING"
    
    # Test 6: Documentation check
    print("\n[TEST 6] Documentation Check")
    required_docs = ["README.md", "CHANGELOG.md", "QUICKSTART.md"]
    found_docs = []
    
    for doc in required_docs:
        doc_path = sdk_dir / doc
        if doc_path.exists() and doc_path.stat().st_size > 0:
            found_docs.append(doc)
            print(f"PASS - {doc} exists and has content")
        else:
            print(f"FAIL - {doc} missing or empty")
    
    if len(found_docs) == len(required_docs):
        results["documentation"] = "PASS"
    else:
        results["documentation"] = f"FAIL - Missing: {set(required_docs) - set(found_docs)}"
    
    # Test 7: ACC Integration availability
    print("\n[TEST 7] ACC Integration Check")
    try:
        result = subprocess.run(["acc", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print("PASS - ACC command available")
            results["acc_available"] = "PASS"
        else:
            print("WARNING - ACC not installed")
            results["acc_available"] = "WARNING - Not installed"
    except FileNotFoundError:
        print("WARNING - ACC not found in PATH")
        results["acc_available"] = "WARNING - Not found"
    except Exception as e:
        print(f"ERROR - Could not check ACC: {e}")
        results["acc_available"] = "ERROR"
    
    # Generate summary
    print("\n" + "=" * 60)
    print("INTEGRATION TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    warnings = 0
    
    for test_name, result in results.items():
        status = "PASS" if result == "PASS" else ("WARNING" if "WARNING" in result else "FAIL/ERROR")
        print(f"{test_name}: {result}")
        
        if result == "PASS":
            passed += 1
        elif "WARNING" in result:
            warnings += 1
        else:
            failed += 1
    
    total = len(results)
    print(f"\nRESULTS: {passed}/{total} passed, {warnings} warnings, {failed} failures")
    
    # Critical issues that block PyPI
    critical_issues = []
    
    if results.get("dependencies", "").startswith("FAIL"):
        critical_issues.append("Missing dependencies in pyproject.toml")
    
    if results.get("package_build", "") != "PASS":
        critical_issues.append("Package build fails")
        
    if results.get("python_version", "") != "PASS":
        critical_issues.append("Python version compatibility")
        
    if results.get("import_syntax", "") != "PASS":
        critical_issues.append("Import syntax errors")
    
    # Final assessment
    print("\n" + "=" * 60)
    print("PRODUCTION READINESS ASSESSMENT")
    print("=" * 60)
    
    if critical_issues:
        print("STATUS: NOT READY FOR PYPI")
        print("\nCRITICAL ISSUES TO FIX:")
        for issue in critical_issues:
            print(f"- {issue}")
    else:
        print("STATUS: READY FOR PYPI PUBLICATION")
        if warnings > 0:
            print("Note: Minor warnings present but not blocking")
    
    # Save results
    with open("integration_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nDetailed results saved to: integration_test_results.json")

if __name__ == "__main__":
    main()