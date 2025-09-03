#!/usr/bin/env python3
"""
Test Setup Validation Script
Visual Agent Management Platform

This script validates that all test components are properly set up
and can be executed without errors. It performs basic checks on:

1. Python dependencies
2. Test module imports
3. Claude CLI availability
4. Basic test execution
5. File structure validation

Run this before executing the full integration test suite.
"""

import sys
import subprocess
import importlib
import traceback
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


class TestSetupValidator:
    """Validates that the test environment is properly configured"""
    
    def __init__(self):
        self.checks_passed = 0
        self.checks_failed = 0
        self.issues = []
    
    def check_python_dependencies(self):
        """Check if required Python packages are installed"""
        logger.info("Checking Python dependencies...")
        
        required_packages = [
            'asyncio',
            'json', 
            'time',
            'uuid',
            'logging',
            'pathlib',
            'dataclasses',
            'enum',
            'typing'
        ]
        
        optional_packages = [
            ('websockets', 'WebSocket client functionality'),
            ('aiohttp', 'HTTP client for API testing'),
            ('psutil', 'System resource monitoring'),
            ('matplotlib', 'Performance chart generation'),
            ('pandas', 'Data analysis'),
            ('numpy', 'Numerical operations')
        ]
        
        # Check required packages (built-in)
        for package in required_packages:
            try:
                importlib.import_module(package)
                logger.info(f"✅ {package} - available")
                self.checks_passed += 1
            except ImportError:
                logger.error(f"❌ {package} - missing (critical)")
                self.issues.append(f"Missing critical package: {package}")
                self.checks_failed += 1
        
        # Check optional packages
        for package, description in optional_packages:
            try:
                importlib.import_module(package)
                logger.info(f"✅ {package} - available ({description})")
                self.checks_passed += 1
            except ImportError:
                logger.warning(f"⚠️ {package} - missing ({description})")
                self.issues.append(f"Missing optional package: {package} - {description}")
    
    def check_test_modules(self):
        """Check if test modules can be imported"""
        logger.info("Checking test module imports...")
        
        test_modules = [
            ('test_full_integration', 'Core integration tests'),
            ('test_performance_load', 'Performance and load tests'),
            ('test_agent_lifecycle', 'Agent lifecycle tests'),
            ('run_integration_tests', 'Master test runner')
        ]
        
        for module_name, description in test_modules:
            try:
                # Try to import the module
                module = importlib.import_module(module_name)
                
                # Check for key classes/functions
                if module_name == 'test_full_integration':
                    if hasattr(module, 'IntegrationTestSuite'):
                        logger.info(f"✅ {module_name} - {description}")
                        self.checks_passed += 1
                    else:
                        logger.error(f"❌ {module_name} - missing IntegrationTestSuite class")
                        self.issues.append(f"{module_name}: missing IntegrationTestSuite class")
                        self.checks_failed += 1
                        
                elif module_name == 'test_performance_load':
                    if hasattr(module, 'PerformanceTestSuite'):
                        logger.info(f"✅ {module_name} - {description}")
                        self.checks_passed += 1
                    else:
                        logger.error(f"❌ {module_name} - missing PerformanceTestSuite class")
                        self.issues.append(f"{module_name}: missing PerformanceTestSuite class")
                        self.checks_failed += 1
                        
                elif module_name == 'test_agent_lifecycle':
                    if hasattr(module, 'AgentLifecycleTestSuite'):
                        logger.info(f"✅ {module_name} - {description}")
                        self.checks_passed += 1
                    else:
                        logger.error(f"❌ {module_name} - missing AgentLifecycleTestSuite class")
                        self.issues.append(f"{module_name}: missing AgentLifecycleTestSuite class")
                        self.checks_failed += 1
                        
                elif module_name == 'run_integration_tests':
                    if hasattr(module, 'MasterTestRunner'):
                        logger.info(f"✅ {module_name} - {description}")
                        self.checks_passed += 1
                    else:
                        logger.error(f"❌ {module_name} - missing MasterTestRunner class")
                        self.issues.append(f"{module_name}: missing MasterTestRunner class")
                        self.checks_failed += 1
                
            except ImportError as e:
                logger.error(f"❌ {module_name} - import failed: {e}")
                self.issues.append(f"Cannot import {module_name}: {e}")
                self.checks_failed += 1
            except Exception as e:
                logger.error(f"❌ {module_name} - error: {e}")
                self.issues.append(f"Error checking {module_name}: {e}")
                self.checks_failed += 1
    
    def check_claude_cli(self):
        """Check if Claude CLI is available"""
        logger.info("Checking Claude CLI availability...")
        
        try:
            # Check if claude command exists
            result = subprocess.run(['claude', '--version'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                version = result.stdout.strip()
                logger.info(f"✅ Claude CLI available: {version}")
                self.checks_passed += 1
                
                # Check authentication status
                try:
                    auth_result = subprocess.run(['claude', 'auth', 'status'], 
                                              capture_output=True, text=True, timeout=10)
                    
                    if 'authenticated' in auth_result.stdout.lower():
                        logger.info(f"✅ Claude CLI authenticated")
                        self.checks_passed += 1
                    else:
                        logger.warning(f"⚠️ Claude CLI not authenticated")
                        logger.info("Run 'claude setup-token' to authenticate")
                        self.issues.append("Claude CLI not authenticated - tests may fail")
                        
                except subprocess.TimeoutError:
                    logger.warning(f"⚠️ Claude CLI auth check timed out")
                    self.issues.append("Claude CLI auth check timed out")
                except Exception as e:
                    logger.warning(f"⚠️ Could not check Claude CLI auth status: {e}")
                    self.issues.append(f"Claude CLI auth check failed: {e}")
            else:
                logger.error(f"❌ Claude CLI not working properly: {result.stderr}")
                self.issues.append(f"Claude CLI error: {result.stderr}")
                self.checks_failed += 1
                
        except FileNotFoundError:
            logger.error(f"❌ Claude CLI not found - install with: npm install -g @anthropic-ai/claude-code")
            self.issues.append("Claude CLI not installed")
            self.checks_failed += 1
        except subprocess.TimeoutError:
            logger.error(f"❌ Claude CLI check timed out")
            self.issues.append("Claude CLI check timed out")
            self.checks_failed += 1
        except Exception as e:
            logger.error(f"❌ Error checking Claude CLI: {e}")
            self.issues.append(f"Claude CLI check error: {e}")
            self.checks_failed += 1
    
    def check_file_structure(self):
        """Check if required files exist"""
        logger.info("Checking test file structure...")
        
        required_files = [
            'test_full_integration.py',
            'test_performance_load.py', 
            'test_agent_lifecycle.py',
            'run_integration_tests.py',
            'INTEGRATION_TESTING_GUIDE.md'
        ]
        
        for filename in required_files:
            filepath = Path(filename)
            if filepath.exists():
                logger.info(f"✅ {filename} - found")
                self.checks_passed += 1
            else:
                logger.error(f"❌ {filename} - missing")
                self.issues.append(f"Missing test file: {filename}")
                self.checks_failed += 1
        
        # Check for base wrapper files
        base_files = [
            'claude_cli_wrapper.py',
            'multi_agent_wrapper/multi_agent_wrapper.py'
        ]
        
        for filename in base_files:
            filepath = Path(filename)
            if filepath.exists():
                logger.info(f"✅ {filename} - found")
                self.checks_passed += 1
            else:
                logger.warning(f"⚠️ {filename} - missing (tests may fail)")
                self.issues.append(f"Missing base file: {filename}")
    
    def test_basic_functionality(self):
        """Test basic functionality of test components"""
        logger.info("Testing basic test functionality...")
        
        try:
            # Test basic imports work
            from test_full_integration import IntegrationTestSuite, SystemHealthChecker
            
            # Test instantiation
            test_suite = IntegrationTestSuite()
            if hasattr(test_suite, 'test_cases') and hasattr(test_suite, 'results'):
                logger.info("✅ IntegrationTestSuite instantiation works")
                self.checks_passed += 1
            else:
                logger.error("❌ IntegrationTestSuite missing required attributes")
                self.issues.append("IntegrationTestSuite instantiation failed")
                self.checks_failed += 1
                
        except Exception as e:
            logger.error(f"❌ Basic functionality test failed: {e}")
            self.issues.append(f"Basic functionality test error: {e}")
            self.checks_failed += 1
    
    def run_validation(self):
        """Run all validation checks"""
        logger.info("=" * 60)
        logger.info("🔍 Visual Agent Platform - Test Setup Validation")
        logger.info("=" * 60)
        
        self.check_python_dependencies()
        self.check_test_modules()
        self.check_claude_cli()
        self.check_file_structure()
        self.test_basic_functionality()
        
        # Summary
        logger.info("=" * 60)
        logger.info("📊 VALIDATION SUMMARY")
        logger.info("=" * 60)
        
        total_checks = self.checks_passed + self.checks_failed
        success_rate = (self.checks_passed / total_checks * 100) if total_checks > 0 else 0
        
        logger.info(f"Total Checks: {total_checks}")
        logger.info(f"Passed: {self.checks_passed} ✅")
        logger.info(f"Failed: {self.checks_failed} ❌")
        logger.info(f"Success Rate: {success_rate:.1f}%")
        
        if self.issues:
            logger.info("")
            logger.info("🔧 ISSUES TO ADDRESS:")
            for i, issue in enumerate(self.issues, 1):
                logger.info(f"  {i}. {issue}")
        
        logger.info("")
        if self.checks_failed == 0:
            logger.info("🎉 ALL CHECKS PASSED - Ready to run integration tests!")
            logger.info("Next step: python run_integration_tests.py")
            return True
        else:
            logger.info("⚠️ SOME CHECKS FAILED - Address issues before running integration tests")
            logger.info("")
            logger.info("Quick fixes:")
            logger.info("  • Install missing packages: pip install websockets aiohttp psutil")
            logger.info("  • Install Claude CLI: npm install -g @anthropic-ai/claude-code")
            logger.info("  • Authenticate Claude CLI: claude setup-token")
            return False


def main():
    """Main validation entry point"""
    validator = TestSetupValidator()
    success = validator.run_validation()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()