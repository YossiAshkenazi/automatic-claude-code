#!/usr/bin/env python3
"""
Comprehensive Tool Operations Testing

Tests all Claude CLI tool types after JSON parsing fix to ensure:
1. Write operations work without 'list' object errors
2. Read operations function correctly
3. Edit operations modify files properly
4. Bash operations execute commands
5. Error handling is robust
6. Epic 3 resource management prevents hanging
7. Complex multi-tool workflows succeed

This addresses Archon task ef45d122-9aac-4047-a9fd-77c27cb38fff
"""

import asyncio
import os
import sys
import time
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging
import traceback

# Add the Python SDK to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from claude_cli_wrapper import (
    ClaudeCliWrapper, 
    ClaudeCliOptions,
    CliMessage,
    ProcessHandleManager
)

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TestResult:
    """Test result tracking"""
    def __init__(self, test_name: str):
        self.test_name = test_name
        self.success = False
        self.error_message: Optional[str] = None
        self.duration: Optional[float] = None
        self.messages: List[CliMessage] = []
        self.resource_stats: Optional[Dict[str, Any]] = None
        
    def set_success(self, duration: float, messages: List[CliMessage], resource_stats: Optional[Dict] = None):
        self.success = True
        self.duration = duration
        self.messages = messages
        self.resource_stats = resource_stats
        
    def set_failure(self, error_message: str, duration: Optional[float] = None, messages: List[CliMessage] = None):
        self.success = False
        self.error_message = error_message
        self.duration = duration
        self.messages = messages or []
        
    def __str__(self) -> str:
        status = "[PASS]" if self.success else "[FAIL]"
        duration_str = f" ({self.duration:.2f}s)" if self.duration else ""
        error_str = f" - {self.error_message}" if self.error_message else ""
        return f"{status} {self.test_name}{duration_str}{error_str}"

class ToolOperationsTester:
    """Comprehensive tool operations tester"""
    
    def __init__(self, temp_dir: Optional[Path] = None):
        self.temp_dir = temp_dir or Path(tempfile.mkdtemp(prefix="claude_tool_test_"))
        self.temp_dir.mkdir(exist_ok=True)
        self.results: List[TestResult] = []
        
        # Initialize Claude CLI wrapper with testing options
        self.options = ClaudeCliOptions(
            model="sonnet",
            max_turns=5,
            allowed_tools=["Read", "Write", "Edit", "Bash"],
            verbose=True,
            dangerously_skip_permissions=True,
            working_directory=self.temp_dir,
            timeout=60  # 1 minute timeout for each test
        )
        
        self.wrapper = ClaudeCliWrapper(self.options)
        
        logger.info(f"Initialized tester with temp directory: {self.temp_dir}")
        logger.info(f"Claude CLI path: {self.wrapper.cli_path}")
    
    async def run_test(self, test_name: str, prompt: str, expected_patterns: List[str] = None) -> TestResult:
        """Run a single test with comprehensive monitoring"""
        result = TestResult(test_name)
        start_time = time.time()
        messages = []
        
        try:
            logger.info(f"Starting test: {test_name}")
            logger.debug(f"Prompt: {prompt}")
            
            # Get initial resource stats
            initial_stats = self.wrapper.get_resource_stats()
            
            # Execute the test
            message_count = 0
            async for message in self.wrapper.execute(prompt):
                messages.append(message)
                message_count += 1
                
                logger.debug(f"Message {message_count}: {message.type} - {message.content[:100]}...")
                
                # Check for early failures
                if message.type == "auth_error":
                    result.set_failure(f"Authentication error: {message.content}", 
                                     time.time() - start_time, messages)
                    return result
                
                if message.type == "error" and "list" in message.content.lower():
                    result.set_failure(f"JSON parsing error detected: {message.content}",
                                     time.time() - start_time, messages)
                    return result
                
                # Safety check: if we get too many messages, something is wrong
                if message_count > 100:
                    result.set_failure(f"Too many messages ({message_count}), possible infinite loop",
                                     time.time() - start_time, messages)
                    return result
            
            # Get final resource stats
            final_stats = self.wrapper.get_resource_stats()
            
            # Check expected patterns if provided
            if expected_patterns:
                all_content = " ".join([msg.content for msg in messages])
                missing_patterns = []
                for pattern in expected_patterns:
                    if pattern.lower() not in all_content.lower():
                        missing_patterns.append(pattern)
                
                if missing_patterns:
                    result.set_failure(f"Missing expected patterns: {missing_patterns}",
                                     time.time() - start_time, messages)
                    return result
            
            # Success
            duration = time.time() - start_time
            result.set_success(duration, messages, {
                'initial_stats': initial_stats,
                'final_stats': final_stats,
                'message_count': message_count
            })
            
            logger.info(f"Test completed successfully: {test_name} ({duration:.2f}s, {message_count} messages)")
            
        except Exception as e:
            error_msg = f"Exception during test: {str(e)}"
            logger.error(f"Test failed: {test_name} - {error_msg}")
            logger.debug(traceback.format_exc())
            result.set_failure(error_msg, time.time() - start_time, messages)
        
        finally:
            # Ensure cleanup
            try:
                await self.wrapper.cleanup()
            except Exception as cleanup_error:
                logger.warning(f"Cleanup error: {cleanup_error}")
        
        return result
    
    async def test_write_operations(self) -> List[TestResult]:
        """Test Write tool operations - the primary failure case"""
        tests = [
            # Basic file creation (most common failure case)
            (
                "Write: Create simple Python file", 
                "Create a simple hello.py file that prints 'Hello, World!'",
                ["hello.py", "print", "Hello, World"]
            ),
            
            # Text file creation
            (
                "Write: Create text file",
                "Create a file called test.txt with the content 'This is a test file'",
                ["test.txt", "This is a test file"]
            ),
            
            # JSON file creation
            (
                "Write: Create JSON file",
                "Create a config.json file with basic configuration: {\"name\": \"test\", \"version\": 1}",
                ["config.json", "name", "test", "version"]
            ),
            
            # Multiple files
            (
                "Write: Create multiple files",
                "Create two files: readme.md with '# Test Project' and version.txt with '1.0.0'",
                ["readme.md", "version.txt", "Test Project", "1.0.0"]
            )
        ]
        
        results = []
        for test_name, prompt, expected_patterns in tests:
            result = await self.run_test(test_name, prompt, expected_patterns)
            results.append(result)
            
            # Small delay between tests
            await asyncio.sleep(1)
        
        return results
    
    async def test_read_operations(self) -> List[TestResult]:
        """Test Read tool operations"""
        # Create test files first
        test_file = self.temp_dir / "read_test.txt"
        test_file.write_text("Sample content for reading\nLine 2\nLine 3")
        
        json_file = self.temp_dir / "read_test.json"
        json_file.write_text('{"key": "value", "number": 42}')
        
        tests = [
            # Read text file
            (
                "Read: Simple text file",
                f"Read the contents of the file {test_file.name}",
                ["Sample content", "Line 2", "Line 3"]
            ),
            
            # Read JSON file
            (
                "Read: JSON file",
                f"Read and parse the JSON file {json_file.name}",
                ["key", "value", "number", "42"]
            ),
            
            # List directory contents
            (
                "Read: Directory listing",
                "List the files in the current directory",
                ["read_test.txt", "read_test.json"]
            ),
            
            # Read non-existent file (error handling)
            (
                "Read: Non-existent file",
                "Try to read a file called nonexistent.txt",
                ["not found", "does not exist"]
            )
        ]
        
        results = []
        for test_name, prompt, expected_patterns in tests:
            result = await self.run_test(test_name, prompt, expected_patterns)
            results.append(result)
            await asyncio.sleep(1)
        
        return results
    
    async def test_edit_operations(self) -> List[TestResult]:
        """Test Edit tool operations"""
        # Create test files for editing
        edit_file = self.temp_dir / "edit_test.py"
        edit_file.write_text("def hello():\n    print('Hello')\n\nif __name__ == '__main__':\n    hello()")
        
        config_file = self.temp_dir / "config.txt"
        config_file.write_text("name=test\nversion=1.0\ndebug=false")
        
        tests = [
            # Edit Python file
            (
                "Edit: Modify Python function",
                f"In the file {edit_file.name}, change 'Hello' to 'Hello, World!'",
                ["Hello, World!"]
            ),
            
            # Edit configuration file
            (
                "Edit: Update config value",
                f"In the file {config_file.name}, change debug=false to debug=true",
                ["debug=true"]
            ),
            
            # Add new line to file
            (
                "Edit: Add new line",
                f"Add a new line 'author=tester' to the end of {config_file.name}",
                ["author=tester"]
            )
        ]
        
        results = []
        for test_name, prompt, expected_patterns in tests:
            result = await self.run_test(test_name, prompt, expected_patterns)
            results.append(result)
            await asyncio.sleep(1)
        
        return results
    
    async def test_bash_operations(self) -> List[TestResult]:
        """Test Bash tool operations"""
        tests = [
            # Simple command
            (
                "Bash: List directory",
                "Run 'ls' command to list files in current directory" if os.name != 'nt' else "Run 'dir' command to list files in current directory",
                ["read_test.txt", "edit_test.py"] if os.name != 'nt' else ["read_test.txt", "edit_test.py"]
            ),
            
            # Echo command
            (
                "Bash: Echo command",
                "Run echo command to print 'Tool test successful'",
                ["Tool test successful"]
            ),
            
            # Check Python version
            (
                "Bash: Python version",
                "Run python --version to check Python version",
                ["Python", "3."]
            ),
            
            # Create directory via bash
            (
                "Bash: Create directory",
                "Create a directory called 'bash_test_dir' using mkdir command",
                ["bash_test_dir"]
            )
        ]
        
        results = []
        for test_name, prompt, expected_patterns in tests:
            result = await self.run_test(test_name, prompt, expected_patterns)
            results.append(result)
            await asyncio.sleep(1)
        
        return results
    
    async def test_error_scenarios(self) -> List[TestResult]:
        """Test error handling scenarios"""
        tests = [
            # File permission error (if possible to create)
            (
                "Error: Invalid command",
                "Run a command that doesn't exist: 'nonexistentcommand123'",
                ["not found", "command not found", "not recognized"]
            ),
            
            # Invalid syntax
            (
                "Error: Invalid Python syntax",
                "Create a Python file with invalid syntax: def invalid_function( print('missing colon')",
                ["syntax", "error", "invalid"]
            ),
        ]
        
        results = []
        for test_name, prompt, expected_patterns in tests:
            result = await self.run_test(test_name, prompt, expected_patterns)
            results.append(result)
            await asyncio.sleep(1)
        
        return results
    
    async def test_epic3_resource_management(self) -> List[TestResult]:
        """Test Epic 3 resource management - no hanging processes"""
        tests = [
            # Long running command with timeout
            (
                "Epic3: Timeout handling",
                "Run a command that takes some time: python -c 'import time; time.sleep(0.5); print(\"completed\")'",
                ["completed"]
            ),
            
            # Multiple commands in sequence
            (
                "Epic3: Sequential commands",
                "Run these commands in sequence: echo 'first', echo 'second', echo 'third'",
                ["first", "second", "third"]
            )
        ]
        
        results = []
        for test_name, prompt, expected_patterns in tests:
            # Get resource stats before
            initial_resources = ProcessHandleManager.get_instance().get_resource_stats()
            
            result = await self.run_test(test_name, prompt, expected_patterns)
            
            # Give time for cleanup
            await asyncio.sleep(2)
            
            # Check resource stats after
            final_resources = ProcessHandleManager.get_instance().get_resource_stats()
            
            # Verify no resource leaks
            if result.success and final_resources['total_resources'] > initial_resources['total_resources']:
                result.set_failure(f"Resource leak detected: {initial_resources} -> {final_resources}")
            
            results.append(result)
            await asyncio.sleep(1)
        
        return results
    
    async def test_complex_workflows(self) -> List[TestResult]:
        """Test complex multi-tool workflows"""
        tests = [
            # Create, read, and edit workflow
            (
                "Workflow: Create-Read-Edit",
                "Create a file called workflow.txt with 'Step 1', then read it, then edit it to add 'Step 2' at the end",
                ["workflow.txt", "Step 1", "Step 2"]
            ),
            
            # Python script creation and execution
            (
                "Workflow: Python script creation and execution",
                "Create a Python script called calc.py that adds 2+3 and prints the result, then run it",
                ["calc.py", "2+3", "5"]
            )
        ]
        
        results = []
        for test_name, prompt, expected_patterns in tests:
            result = await self.run_test(test_name, prompt, expected_patterns)
            results.append(result)
            await asyncio.sleep(2)  # Longer delay for complex workflows
        
        return results
    
    async def run_all_tests(self) -> Dict[str, List[TestResult]]:
        """Run all test categories"""
        logger.info("Starting comprehensive tool operations testing")
        logger.info(f"Working directory: {self.temp_dir}")
        
        test_categories = {
            "Write Operations": self.test_write_operations,
            "Read Operations": self.test_read_operations,
            "Edit Operations": self.test_edit_operations,
            "Bash Operations": self.test_bash_operations,
            "Error Scenarios": self.test_error_scenarios,
            "Epic 3 Resource Management": self.test_epic3_resource_management,
            "Complex Workflows": self.test_complex_workflows
        }
        
        all_results = {}
        
        for category_name, test_func in test_categories.items():
            logger.info(f"\n{'=' * 60}")
            logger.info(f"Running {category_name} tests")
            logger.info(f"{'=' * 60}")
            
            try:
                category_results = await test_func()
                all_results[category_name] = category_results
                
                # Summary for this category
                passed = sum(1 for r in category_results if r.success)
                total = len(category_results)
                logger.info(f"{category_name}: {passed}/{total} tests passed")
                
            except Exception as e:
                logger.error(f"Error running {category_name} tests: {e}")
                logger.debug(traceback.format_exc())
                all_results[category_name] = []
            
            # Cleanup between categories
            try:
                await self.wrapper.cleanup()
                # Force cleanup of handle manager
                handle_manager = ProcessHandleManager.get_instance()
                cleaned, failed, errors = await handle_manager.force_cleanup_all()
                if cleaned > 0 or failed > 0:
                    logger.info(f"Cleanup between categories: {cleaned} cleaned, {failed} failed")
            except Exception as cleanup_error:
                logger.warning(f"Cleanup error between categories: {cleanup_error}")
            
            # Pause between categories
            await asyncio.sleep(3)
        
        return all_results
    
    def generate_report(self, all_results: Dict[str, List[TestResult]]) -> str:
        """Generate comprehensive test report"""
        report_lines = []
        report_lines.append("\n" + "=" * 80)
        report_lines.append("COMPREHENSIVE TOOL OPERATIONS TEST REPORT")
        report_lines.append("=" * 80)
        report_lines.append(f"Test Directory: {self.temp_dir}")
        report_lines.append(f"Claude CLI Path: {self.wrapper.cli_path}")
        report_lines.append(f"Test Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        total_tests = 0
        total_passed = 0
        total_duration = 0.0
        
        for category_name, results in all_results.items():
            report_lines.append(f"\n{category_name}:")
            report_lines.append("-" * len(category_name) + "-")
            
            category_passed = 0
            category_total = len(results)
            
            for result in results:
                report_lines.append(f"  {result}")
                if result.success:
                    category_passed += 1
                    total_passed += 1
                if result.duration:
                    total_duration += result.duration
                total_tests += 1
                
                # Add error details for failures
                if not result.success and result.error_message:
                    report_lines.append(f"    Error: {result.error_message}")
            
            if category_total > 0:
                category_percentage = (category_passed / category_total) * 100
                report_lines.append(f"  Summary: {category_passed}/{category_total} passed ({category_percentage:.1f}%)")
        
        # Overall summary
        overall_percentage = (total_passed / total_tests * 100) if total_tests > 0 else 0
        report_lines.append("\n" + "=" * 80)
        report_lines.append("OVERALL SUMMARY")
        report_lines.append("=" * 80)
        report_lines.append(f"Total Tests: {total_tests}")
        report_lines.append(f"Passed: {total_passed}")
        report_lines.append(f"Failed: {total_tests - total_passed}")
        report_lines.append(f"Success Rate: {overall_percentage:.1f}%")
        report_lines.append(f"Total Duration: {total_duration:.2f}s")
        
        # Critical assessment
        report_lines.append("\n" + "=" * 80)
        report_lines.append("CRITICAL ASSESSMENT")
        report_lines.append("=" * 80)
        
        if overall_percentage >= 90:
            report_lines.append("[EXCELLENT] Tool operations are working reliably")
        elif overall_percentage >= 80:
            report_lines.append("[GOOD] Tool operations are mostly working, minor issues present")
        elif overall_percentage >= 70:
            report_lines.append("[ACCEPTABLE] Tool operations are working but need improvement")
        elif overall_percentage >= 50:
            report_lines.append("[POOR] Significant issues with tool operations")
        else:
            report_lines.append("[CRITICAL] Major failures in tool operations")
        
        # Check for specific issues
        write_results = all_results.get("Write Operations", [])
        write_failures = [r for r in write_results if not r.success]
        if write_failures:
            report_lines.append(f"\n[WARNING] Write Operations Issues: {len(write_failures)} failures detected")
            for failure in write_failures:
                if "list" in failure.error_message.lower():
                    report_lines.append("[CRITICAL] JSON parsing 'list' object error detected!")
                    break
        
        # Resource management assessment
        epic3_results = all_results.get("Epic 3 Resource Management", [])
        epic3_failures = [r for r in epic3_results if not r.success]
        if not epic3_failures:
            report_lines.append("[SUCCESS] Epic 3 Resource Management: No hanging processes detected")
        else:
            report_lines.append(f"[FAIL] Epic 3 Resource Management: {len(epic3_failures)} resource issues detected")
        
        report_lines.append("\n" + "=" * 80)
        
        return "\n".join(report_lines)
    
    def cleanup_temp_files(self):
        """Clean up temporary test files"""
        try:
            if self.temp_dir.exists():
                shutil.rmtree(self.temp_dir)
                logger.info(f"Cleaned up temp directory: {self.temp_dir}")
        except Exception as e:
            logger.warning(f"Error cleaning up temp directory: {e}")

async def main():
    """Main test execution function"""
    print("\n" + "=" * 80)
    print("COMPREHENSIVE TOOL OPERATIONS TESTING")
    print("Testing all Claude CLI tool types after JSON parsing fix")
    print("=" * 80)
    
    tester = None
    try:
        # Initialize tester
        tester = ToolOperationsTester()
        
        # Check if Claude CLI is available
        if not tester.wrapper.is_available():
            print("[ERROR] Claude CLI not found. Please install with: npm install -g @anthropic-ai/claude-code")
            return
        
        print(f"[SUCCESS] Claude CLI found at: {tester.wrapper.cli_path}")
        print(f"[INFO] Test directory: {tester.temp_dir}")
        
        # Run all tests
        print("\n[INFO] Starting comprehensive testing...")
        all_results = await tester.run_all_tests()
        
        # Generate and display report
        report = tester.generate_report(all_results)
        print(report)
        
        # Save report to file
        report_file = Path("tool_operations_test_report.txt")
        report_file.write_text(report)
        print(f"\n[INFO] Detailed report saved to: {report_file.absolute()}")
        
        # Calculate overall success for return code
        total_tests = sum(len(results) for results in all_results.values())
        total_passed = sum(sum(1 for r in results if r.success) for results in all_results.values())
        success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
        
        if success_rate >= 80:
            print("\n[SUCCESS] TESTING COMPLETED SUCCESSFULLY")
            return 0
        else:
            print("\n[FAIL] TESTING COMPLETED WITH SIGNIFICANT FAILURES")
            return 1
    
    except KeyboardInterrupt:
        print("\n[WARNING] Testing interrupted by user")
        return 2
    except Exception as e:
        print(f"\n[ERROR] Critical error during testing: {e}")
        traceback.print_exc()
        return 3
    finally:
        # Cleanup
        if tester:
            try:
                await tester.wrapper.cleanup()
                # Force cleanup of all resources
                handle_manager = ProcessHandleManager.get_instance()
                cleaned, failed, errors = await handle_manager.force_cleanup_all(timeout=5.0)
                if cleaned > 0 or failed > 0 or errors:
                    print(f"Final cleanup: {cleaned} cleaned, {failed} failed, {len(errors)} errors")
                
                tester.cleanup_temp_files()
            except Exception as cleanup_error:
                print(f"Error during final cleanup: {cleanup_error}")

if __name__ == "__main__":
    # Run the comprehensive tests
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
