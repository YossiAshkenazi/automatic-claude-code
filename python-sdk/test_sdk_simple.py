#!/usr/bin/env python3
"""
Simple test script for Claude Code Python SDK
Tests all major features without Unicode characters
"""

import asyncio
import sys
import time

def print_test(name: str, status: str = "RUNNING"):
    """Print test status"""
    if status == "PASS":
        print(f"[PASS] {name}")
    elif status == "FAIL":
        print(f"[FAIL] {name}")
    elif status == "SKIP":
        print(f"[SKIP] {name}")
    else:
        print(f"[TEST] {name}...")

def print_section(title: str):
    """Print section header"""
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}\n")

async def main():
    """Run all tests"""
    print("\nClaude Code Python SDK - Test Suite")
    print(f"Python version: {sys.version.split()[0]}")
    print(f"Test time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    passed = 0
    failed = 0
    skipped = 0
    
    # Test 1: Imports
    print_section("Test 1: Import Validation")
    try:
        import claude_code_sdk
        print(f"  SDK Version: {claude_code_sdk.__version__}")
        
        from claude_code_sdk import ClaudeSDKClient, query, ClaudeCodeOptions
        print_test("Core imports", "PASS")
        passed += 1
        
        from claude_code_sdk import ResultMessage, ErrorMessage
        print_test("Message types", "PASS")
        passed += 1
        
        from claude_code_sdk.integrations import AutomaticClaudeIntegration
        print_test("Integrations", "PASS")
        passed += 1
        
    except ImportError as e:
        print_test(f"Import failed: {e}", "FAIL")
        failed += 1
    
    # Test 2: SDK Info
    print_section("Test 2: SDK Information")
    try:
        import claude_code_sdk
        info = claude_code_sdk.get_sdk_info()
        print(f"  Name: {info['name']}")
        print(f"  Version: {info['version']}")
        print(f"  Features: {len(info['features'])} available")
        print_test("SDK info", "PASS")
        passed += 1
    except Exception as e:
        print_test(f"SDK info failed: {e}", "FAIL")
        failed += 1
    
    # Test 3: Client Creation
    print_section("Test 3: Client Creation")
    try:
        from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions
        
        options = ClaudeCodeOptions(max_iterations=5, timeout=30000)
        client = ClaudeSDKClient(options)
        print_test("Client instantiation", "PASS")
        passed += 1
        
        # Test option factories
        from claude_code_sdk import create_development_options, create_production_options
        dev_opts = create_development_options()
        prod_opts = create_production_options()
        print_test("Option factories", "PASS")
        passed += 1
        
    except Exception as e:
        print_test(f"Client creation failed: {e}", "FAIL")
        failed += 1
    
    # Test 4: Integration Features
    print_section("Test 4: ACC Integration")
    try:
        from claude_code_sdk.integrations import AutomaticClaudeIntegration
        
        integration = AutomaticClaudeIntegration(
            enable_monitoring=True,
            enable_dual_agent=True
        )
        
        stats = integration.get_statistics()
        print(f"  Success rate: {stats['success_rate']:.0%}")
        print(f"  Monitoring: {stats['monitoring_enabled']}")
        print(f"  Dual-agent: {stats['dual_agent_enabled']}")
        
        session_id = integration.create_session()
        print(f"  Session created: {session_id[:20]}...")
        
        print_test("ACC integration", "PASS")
        passed += 1
        
    except Exception as e:
        print_test(f"Integration failed: {e}", "FAIL")
        failed += 1
    
    # Test 5: Monitoring
    print_section("Test 5: Monitoring")
    try:
        from claude_code_sdk.integrations import MonitoringIntegration
        
        monitoring = MonitoringIntegration()
        health = await monitoring.health_check()
        
        if health['connection_status'] == 'unavailable':
            print("  Monitoring server not running (expected)")
            print_test("Monitoring setup", "SKIP")
            skipped += 1
        else:
            print(f"  Status: {health['connection_status']}")
            print_test("Monitoring", "PASS")
            passed += 1
        
        await monitoring.close()
        
    except Exception as e:
        print_test(f"Monitoring test failed: {e}", "FAIL")
        failed += 1
    
    # Test 6: Error Handling
    print_section("Test 6: Error Handling")
    try:
        from claude_code_sdk import (
            ClaudeCodeError,
            ClaudeTimeoutError,
            is_recoverable_error
        )
        
        timeout_err = ClaudeTimeoutError("Test timeout")
        recoverable = is_recoverable_error(timeout_err)
        print(f"  Timeout recoverable: {recoverable}")
        
        print_test("Error handling", "PASS")
        passed += 1
        
    except Exception as e:
        print_test(f"Error handling failed: {e}", "FAIL")
        failed += 1
    
    # Test 7: CLI Detection
    print_section("Test 7: CLI Detection")
    try:
        from claude_code_sdk.utils import CLIDetector
        
        detector = CLIDetector()
        claude_available = await detector.check_claude_cli()
        
        if claude_available:
            version = await detector.get_claude_version()
            print(f"  Claude CLI version: {version}")
            print_test("CLI detection", "PASS")
            passed += 1
        else:
            print("  Claude CLI not installed")
            print_test("CLI detection", "SKIP")
            skipped += 1
            
    except Exception as e:
        print_test(f"CLI detection failed: {e}", "FAIL")
        failed += 1
    
    # Test 8: Package Structure
    print_section("Test 8: Package Structure")
    try:
        import claude_code_sdk
        from pathlib import Path
        
        package_dir = Path(claude_code_sdk.__file__).parent
        
        # Check for key files
        py_typed = package_dir / 'py.typed'
        if py_typed.exists():
            print("  Type hints: Enabled")
            print_test("Package structure", "PASS")
            passed += 1
        else:
            print_test("py.typed missing", "FAIL")
            failed += 1
            
    except Exception as e:
        print_test(f"Package test failed: {e}", "FAIL")
        failed += 1
    
    # Summary
    print_section("Test Summary")
    total = passed + failed + skipped
    print(f"Passed:  {passed}/{total}")
    print(f"Failed:  {failed}/{total}")
    print(f"Skipped: {skipped}/{total}")
    
    if failed == 0:
        print("\n[SUCCESS] All critical tests passed! Package is ready.")
        return True
    else:
        print(f"\n[WARNING] {failed} test(s) failed. Review the output above.")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)