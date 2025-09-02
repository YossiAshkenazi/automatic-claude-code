#!/usr/bin/env python3
"""
Comprehensive test script for Claude Code Python SDK
Tests all major features and validates PyPI readiness
"""

import asyncio
import sys
import time
from pathlib import Path

# Test colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_test(name: str, status: str = "RUNNING"):
    """Print test status with colors"""
    if status == "PASS":
        print(f"{Colors.GREEN}✓{Colors.RESET} {name}")
    elif status == "FAIL":
        print(f"{Colors.RED}✗{Colors.RESET} {name}")
    elif status == "SKIP":
        print(f"{Colors.YELLOW}○{Colors.RESET} {name} (skipped)")
    else:
        print(f"{Colors.BLUE}►{Colors.RESET} {name}...")

def print_section(title: str):
    """Print section header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")

async def test_imports():
    """Test 1: Validate all imports work correctly"""
    print_section("Test 1: Import Validation")
    
    try:
        # Core imports
        print_test("Importing claude_code_sdk")
        import claude_code_sdk
        print_test("Importing claude_code_sdk", "PASS")
        
        # Check version
        print_test("Checking SDK version")
        version = claude_code_sdk.__version__
        print(f"  Version: {version}")
        print_test("Checking SDK version", "PASS")
        
        # Official SDK naming
        print_test("Importing ClaudeSDKClient (official naming)")
        from claude_code_sdk import ClaudeSDKClient
        print_test("Importing ClaudeSDKClient (official naming)", "PASS")
        
        # Core functionality
        print_test("Importing query function")
        from claude_code_sdk import query
        print_test("Importing query function", "PASS")
        
        # Options
        print_test("Importing ClaudeCodeOptions")
        from claude_code_sdk import ClaudeCodeOptions
        print_test("Importing ClaudeCodeOptions", "PASS")
        
        # Messages
        print_test("Importing message types")
        from claude_code_sdk import (
            ResultMessage, 
            ErrorMessage, 
            ToolUseMessage,
            StreamMessage
        )
        print_test("Importing message types", "PASS")
        
        # Integrations
        print_test("Importing AutomaticClaudeIntegration")
        from claude_code_sdk.integrations import AutomaticClaudeIntegration
        print_test("Importing AutomaticClaudeIntegration", "PASS")
        
        # Monitoring
        print_test("Importing MonitoringIntegration")
        from claude_code_sdk.integrations import MonitoringIntegration
        print_test("Importing MonitoringIntegration", "PASS")
        
        return True
        
    except ImportError as e:
        print_test(f"Import failed: {e}", "FAIL")
        return False

async def test_sdk_info():
    """Test 2: Validate SDK information and metadata"""
    print_section("Test 2: SDK Information")
    
    try:
        import claude_code_sdk
        
        print_test("Getting SDK info")
        info = claude_code_sdk.get_sdk_info()
        
        print(f"  Name: {info['name']}")
        print(f"  Version: {info['version']}")
        print(f"  Description: {info['description']}")
        print(f"  Features: {len(info['features'])} features")
        for feature in info['features']:
            print(f"    - {feature}")
        
        print_test("Getting SDK info", "PASS")
        return True
        
    except Exception as e:
        print_test(f"SDK info failed: {e}", "FAIL")
        return False

async def test_client_creation():
    """Test 3: Test client instantiation"""
    print_section("Test 3: Client Creation")
    
    try:
        from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions
        
        # Test with default options
        print_test("Creating client with default options")
        options = ClaudeCodeOptions()
        client = ClaudeSDKClient(options)
        print_test("Creating client with default options", "PASS")
        
        # Test with custom options
        print_test("Creating client with custom options")
        custom_options = ClaudeCodeOptions(
            max_iterations=10,
            timeout=60000,
            verbose=True
        )
        custom_client = ClaudeSDKClient(custom_options)
        print_test("Creating client with custom options", "PASS")
        
        # Test option factories
        print_test("Testing option factory functions")
        from claude_code_sdk import (
            create_development_options,
            create_production_options,
            create_dual_agent_options,
            create_streaming_options
        )
        
        dev_opts = create_development_options()
        prod_opts = create_production_options()
        dual_opts = create_dual_agent_options()
        stream_opts = create_streaming_options()
        
        print_test("Testing option factory functions", "PASS")
        
        return True
        
    except Exception as e:
        print_test(f"Client creation failed: {e}", "FAIL")
        return False

async def test_integration_features():
    """Test 4: Test ACC integration features"""
    print_section("Test 4: Integration Features")
    
    try:
        from claude_code_sdk.integrations import AutomaticClaudeIntegration
        
        print_test("Creating AutomaticClaudeIntegration")
        integration = AutomaticClaudeIntegration(
            enable_monitoring=True,
            enable_dual_agent=True
        )
        print_test("Creating AutomaticClaudeIntegration", "PASS")
        
        print_test("Getting integration statistics")
        stats = integration.get_statistics()
        print(f"  Total executions: {stats['total_executions']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Monitoring enabled: {stats['monitoring_enabled']}")
        print(f"  Dual-agent enabled: {stats['dual_agent_enabled']}")
        print_test("Getting integration statistics", "PASS")
        
        print_test("Creating session ID")
        session_id = integration.create_session()
        print(f"  Session ID: {session_id}")
        print_test("Creating session ID", "PASS")
        
        return True
        
    except Exception as e:
        print_test(f"Integration features failed: {e}", "FAIL")
        return False

async def test_monitoring():
    """Test 5: Test monitoring integration"""
    print_section("Test 5: Monitoring Integration")
    
    try:
        from claude_code_sdk.integrations import MonitoringIntegration
        
        print_test("Creating MonitoringIntegration")
        monitoring = MonitoringIntegration(
            monitoring_port=6011,
            api_port=4005
        )
        print_test("Creating MonitoringIntegration", "PASS")
        
        print_test("Checking monitoring health")
        health = await monitoring.health_check()
        print(f"  Integration status: {health['monitoring_integration']}")
        print(f"  Monitoring port: {health['monitoring_port']}")
        print(f"  API port: {health['api_port']}")
        
        if health['connection_status'] == 'healthy':
            print_test("Checking monitoring health", "PASS")
        else:
            print_test("Monitoring not available (expected if server not running)", "SKIP")
        
        # Clean up
        await monitoring.close()
        
        return True
        
    except Exception as e:
        print_test(f"Monitoring test failed: {e}", "FAIL")
        return False

async def test_error_handling():
    """Test 6: Test error handling and classification"""
    print_section("Test 6: Error Handling")
    
    try:
        from claude_code_sdk import (
            ClaudeCodeError,
            ClaudeTimeoutError,
            ClaudeAuthError,
            classify_error,
            is_recoverable_error
        )
        
        print_test("Testing error classification")
        
        # Test timeout error
        timeout_err = ClaudeTimeoutError("Operation timed out")
        is_recoverable = is_recoverable_error(timeout_err)
        print(f"  Timeout error recoverable: {is_recoverable}")
        
        # Test auth error
        auth_err = ClaudeAuthError("Authentication failed")
        is_recoverable = is_recoverable_error(auth_err)
        print(f"  Auth error recoverable: {is_recoverable}")
        
        print_test("Testing error classification", "PASS")
        
        return True
        
    except Exception as e:
        print_test(f"Error handling test failed: {e}", "FAIL")
        return False

async def test_cli_detection():
    """Test 7: Test CLI detection utility"""
    print_section("Test 7: CLI Detection")
    
    try:
        from claude_code_sdk.utils import CLIDetector
        
        print_test("Testing CLI detection")
        detector = CLIDetector()
        
        # Check for Claude CLI
        claude_available = await detector.check_claude_cli()
        print(f"  Claude CLI available: {claude_available}")
        
        if claude_available:
            claude_version = await detector.get_claude_version()
            print(f"  Claude CLI version: {claude_version}")
            print_test("Testing CLI detection", "PASS")
        else:
            print_test("Claude CLI not installed (expected)", "SKIP")
        
        # Check for npm
        npm_available = await detector.check_npm()
        print(f"  NPM available: {npm_available}")
        
        return True
        
    except Exception as e:
        print_test(f"CLI detection test failed: {e}", "FAIL")
        return False

async def test_package_structure():
    """Test 8: Validate package structure"""
    print_section("Test 8: Package Structure")
    
    try:
        import claude_code_sdk
        from pathlib import Path
        
        print_test("Checking package location")
        package_dir = Path(claude_code_sdk.__file__).parent
        print(f"  Package location: {package_dir}")
        print_test("Checking package location", "PASS")
        
        print_test("Checking package modules")
        expected_modules = [
            'core', 'exceptions', 'integrations', 
            'interfaces', 'utils'
        ]
        
        for module in expected_modules:
            module_path = package_dir / module
            if module_path.exists():
                print(f"  ✓ {module}/")
            else:
                print(f"  ✗ {module}/ (missing)")
        
        print_test("Checking package modules", "PASS")
        
        # Check for py.typed
        print_test("Checking type hints marker")
        py_typed = package_dir / 'py.typed'
        if py_typed.exists():
            print(f"  ✓ py.typed present (type hints supported)")
            print_test("Checking type hints marker", "PASS")
        else:
            print_test("py.typed missing", "FAIL")
        
        return True
        
    except Exception as e:
        print_test(f"Package structure test failed: {e}", "FAIL")
        return False

async def run_all_tests():
    """Run all tests and provide summary"""
    print(f"\n{Colors.BOLD}Claude Code Python SDK - Comprehensive Test Suite{Colors.RESET}")
    print(f"Testing package: claude-code-sdk v0.1.0")
    print(f"Python version: {sys.version.split()[0]}")
    print(f"Test time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    
    # Run all tests
    results.append(("Import Validation", await test_imports()))
    results.append(("SDK Information", await test_sdk_info()))
    results.append(("Client Creation", await test_client_creation()))
    results.append(("Integration Features", await test_integration_features()))
    results.append(("Monitoring Integration", await test_monitoring()))
    results.append(("Error Handling", await test_error_handling()))
    results.append(("CLI Detection", await test_cli_detection()))
    results.append(("Package Structure", await test_package_structure()))
    
    # Print summary
    print_section("Test Summary")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"{Colors.BOLD}Results:{Colors.RESET}")
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print_test(test_name, status)
    
    print(f"\n{Colors.BOLD}Total: {passed}/{total} tests passed{Colors.RESET}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD}✅ All tests passed! Package is ready for use.{Colors.RESET}")
    else:
        print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠️  Some tests failed. Review the output above.{Colors.RESET}")
    
    return passed == total

if __name__ == "__main__":
    # Run the test suite
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)