#!/usr/bin/env python3
"""
Test Script for Platform Startup System
========================================

Simple test script to verify the startup system components work correctly
without actually starting the full platform.

Usage:
    python test_startup_system_clean.py
"""

import sys
import subprocess
from pathlib import Path

def test_prerequisites():
    """Test that all prerequisites are available"""
    print("Testing Prerequisites...")
    
    tests = []
    
    # Test Python
    try:
        result = subprocess.run([sys.executable, '--version'], capture_output=True, text=True)
        python_version = result.stdout.strip()
        tests.append(("Python", True, python_version))
    except Exception as e:
        tests.append(("Python", False, str(e)))
    
    # Test Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        node_version = result.stdout.strip()
        tests.append(("Node.js", True, node_version))
    except Exception as e:
        tests.append(("Node.js", False, "Not installed"))
    
    # Test pnpm
    try:
        result = subprocess.run(['pnpm', '--version'], capture_output=True, text=True)
        pnpm_version = result.stdout.strip()
        tests.append(("pnpm", True, pnpm_version))
    except Exception as e:
        tests.append(("pnpm", False, "Not installed"))
    
    # Test Claude CLI (optional)
    try:
        result = subprocess.run(['claude', '--version'], capture_output=True, text=True)
        claude_version = result.stdout.strip()
        tests.append(("Claude CLI", True, claude_version))
    except Exception as e:
        tests.append(("Claude CLI", False, "Not installed (optional)"))
    
    # Print results
    all_passed = True
    for name, passed, info in tests:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"   {status} {name:<12}: {info}")
        if not passed and name != "Claude CLI":  # Claude CLI is optional
            all_passed = False
    
    return all_passed

def test_project_structure():
    """Test that required project structure exists"""
    print("\nTesting Project Structure...")
    
    project_root = Path(__file__).parent
    required_paths = [
        "python-sdk",
        "dual-agent-monitor", 
        "start_platform.py",
        "platform_health_check.py",
        "python-sdk/start_websocket_server.py",
        "dual-agent-monitor/package.json",
        "package.json"
    ]
    
    all_exist = True
    for path in required_paths:
        full_path = project_root / path
        exists = full_path.exists()
        status = "[PASS]" if exists else "[FAIL]"
        print(f"   {status} {path}")
        if not exists:
            all_exist = False
    
    return all_exist

def test_health_checker():
    """Test the health checker utility"""
    print("\nTesting Health Checker...")
    
    try:
        # Import and test health checker
        from platform_health_check import HealthChecker
        
        checker = HealthChecker()
        print("   [PASS] HealthChecker imported successfully")
        
        # Test port checking
        port_available = checker.check_port(9999)  # Should be available
        if port_available:
            print("   [PASS] Port checking works")
        else:
            print("   [WARN] Port 9999 unexpectedly occupied")
        
        # Test component configuration
        if 'python_backend' in checker.COMPONENTS:
            print("   [PASS] Component configuration loaded")
        else:
            print("   [FAIL] Component configuration missing")
            return False
        
        return True
        
    except Exception as e:
        print(f"   [FAIL] Health checker test failed: {e}")
        return False

def test_startup_script_imports():
    """Test that the startup script imports work"""
    print("\nTesting Startup Script...")
    
    try:
        # Test required imports
        import asyncio
        import logging
        import subprocess
        import threading
        import psutil
        import requests
        
        print("   [PASS] All required Python packages available")
        
        # Test startup script import (without running)
        sys.path.insert(0, str(Path(__file__).parent))
        
        # Import key classes without running
        from start_platform import PlatformHealthChecker, ProcessManager, PlatformStartup
        
        print("   [PASS] Startup script imports successfully")
        
        # Test instantiation
        health_checker = PlatformHealthChecker()
        process_manager = ProcessManager()
        
        print("   [PASS] Core classes instantiate successfully")
        
        return True
        
    except ImportError as e:
        print(f"   [FAIL] Missing required package: {e}")
        return False
    except Exception as e:
        print(f"   [FAIL] Startup script test failed: {e}")
        return False

def test_package_scripts():
    """Test that package.json scripts exist"""
    print("\nTesting Package Scripts...")
    
    project_root = Path(__file__).parent
    
    # Check root package.json
    root_package = project_root / "package.json"
    if not root_package.exists():
        print("   [FAIL] Root package.json not found")
        return False
    
    # Check dashboard package.json
    dashboard_package = project_root / "dual-agent-monitor" / "package.json"
    if not dashboard_package.exists():
        print("   [FAIL] Dashboard package.json not found")
        return False
    
    try:
        import json
        
        # Check root scripts
        with open(root_package) as f:
            root_data = json.load(f)
        
        required_root_scripts = ['dev:platform', 'build:all']
        for script in required_root_scripts:
            if script in root_data.get('scripts', {}):
                print(f"   [PASS] Root script '{script}' exists")
            else:
                print(f"   [WARN] Root script '{script}' missing (optional)")
        
        # Check dashboard scripts
        with open(dashboard_package) as f:
            dashboard_data = json.load(f)
        
        required_dashboard_scripts = ['dev', 'server:dev']
        for script in required_dashboard_scripts:
            if script in dashboard_data.get('scripts', {}):
                print(f"   [PASS] Dashboard script '{script}' exists")
            else:
                print(f"   [FAIL] Dashboard script '{script}' missing")
                return False
        
        print("   [PASS] Package scripts configuration looks good")
        return True
        
    except Exception as e:
        print(f"   [FAIL] Error checking package scripts: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("Platform Startup System - Test Suite")
    print("=" * 60)
    
    tests = [
        ("Prerequisites", test_prerequisites),
        ("Project Structure", test_project_structure),
        ("Health Checker", test_health_checker),
        ("Startup Script", test_startup_script_imports),
        ("Package Scripts", test_package_scripts)
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n[ERROR] Test '{name}' failed with exception: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status} {name}")
        if result:
            passed += 1
    
    print()
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("\nAll tests passed! The startup system should work correctly.")
        print("You can now run: python start_platform.py")
        return 0
    else:
        print(f"\n{total - passed} tests failed. Please address the issues before running the platform.")
        return 1

if __name__ == "__main__":
    sys.exit(main())