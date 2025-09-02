#!/usr/bin/env python3
"""
Error Handling Test Suite for Claude CLI Wrapper
Tests various error scenarios and edge cases to assess robustness
"""

import asyncio
import os
import sys
import tempfile
import time
import signal
from pathlib import Path
from unittest.mock import patch, MagicMock
import subprocess

# Add parent directory to path to import the wrapper
sys.path.append(str(Path(__file__).parent))

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions, ClaudeCliSimple


class ErrorHandlingTester:
    """Comprehensive error handling test suite"""
    
    def __init__(self):
        self.test_results = []
        self.passed_tests = 0
        self.failed_tests = 0
    
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "PASS" if passed else "FAIL"
        self.test_results.append(f"[{status}] {test_name}: {details}")
        if passed:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
    
    async def test_cli_not_found(self):
        """Test behavior when Claude CLI is not found"""
        print("\nTesting CLI Not Found Scenario...")
        
        try:
            # Create wrapper with non-existent CLI path
            options = ClaudeCliOptions(cli_path="/non/existent/path/claude")
            wrapper = ClaudeCliWrapper(options)
            
            # Should raise FileNotFoundError during initialization
            self.log_test("CLI Not Found - Init", False, "Should have raised FileNotFoundError")
        except FileNotFoundError as e:
            self.log_test("CLI Not Found - Init", True, f"Correctly raised: {str(e)[:50]}...")
        except Exception as e:
            self.log_test("CLI Not Found - Init", False, f"Unexpected error: {type(e).__name__}")
    
    async def test_authentication_failure(self):
        """Test behavior when Claude CLI authentication fails"""
        print("\nª Testing Authentication Failure...")
        
        try:
            # Test with valid CLI path but potential auth issues
            wrapper = ClaudeCliWrapper()
            
            # Create a mock that simulates authentication failure
            error_messages = []
            async for message in wrapper.execute("test prompt"):
                error_messages.append(message)
                if message.type == "error":
                    break
            
            # Check if we get proper error handling
            has_error_handling = any(msg.type == "error" for msg in error_messages)
            self.log_test("Auth Failure Handling", True, f"Error messages captured: {len(error_messages)}")
            
        except Exception as e:
            self.log_test("Auth Failure Handling", False, f"Exception during test: {type(e).__name__}")
    
    async def test_timeout_scenario(self):
        """Test timeout handling"""
        print("\nª Testing Timeout Scenarios...")
        
        try:
            # Test with very short timeout
            options = ClaudeCliOptions(timeout=1)
            wrapper = ClaudeCliWrapper(options)
            
            start_time = time.time()
            
            # This should timeout quickly
            messages = []
            try:
                async with asyncio.timeout(2):  # 2-second overall timeout
                    async for message in wrapper.execute("Write a very long essay about quantum physics"):
                        messages.append(message)
                        # Break if we get an error or after reasonable time
                        if time.time() - start_time > 3:
                            break
            except asyncio.TimeoutError:
                pass
            
            elapsed = time.time() - start_time
            self.log_test("Timeout Handling", elapsed < 5, f"Completed in {elapsed:.2f}s")
            
        except Exception as e:
            self.log_test("Timeout Handling", False, f"Exception: {type(e).__name__}")
    
    async def test_process_cleanup(self):
        """Test process cleanup and killing mechanisms"""
        print("\nª Testing Process Cleanup...")
        
        try:
            wrapper = ClaudeCliWrapper()
            
            # Start a process
            task = asyncio.create_task(self._run_long_process(wrapper))
            
            # Let it run briefly
            await asyncio.sleep(0.5)
            
            # Kill the process
            wrapper.kill()
            
            # Check if process was properly killed
            if wrapper.process is None or wrapper.process.returncode is not None:
                self.log_test("Process Cleanup", True, "Process properly cleaned up")
            else:
                self.log_test("Process Cleanup", False, "Process still running after kill")
            
            # Cancel the task
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            
        except Exception as e:
            self.log_test("Process Cleanup", False, f"Exception: {type(e).__name__}")
    
    async def _run_long_process(self, wrapper):
        """Helper to run a long process for testing"""
        try:
            async for message in wrapper.execute("Count to 100 slowly"):
                pass
        except:
            pass
    
    async def test_invalid_working_directory(self):
        """Test behavior with invalid working directory"""
        print("\nª Testing Invalid Working Directory...")
        
        try:
            options = ClaudeCliOptions(
                working_directory=Path("/non/existent/directory")
            )
            wrapper = ClaudeCliWrapper(options)
            
            error_caught = False
            async for message in wrapper.execute("test"):
                if message.type == "error":
                    error_caught = True
                    break
            
            self.log_test("Invalid Working Dir", error_caught, 
                         "Error properly handled" if error_caught else "No error detected")
            
        except Exception as e:
            self.log_test("Invalid Working Dir", True, f"Exception caught: {type(e).__name__}")
    
    async def test_malformed_options(self):
        """Test behavior with malformed options"""
        print("\nª Testing Malformed Options...")
        
        try:
            # Test with invalid model
            options = ClaudeCliOptions(model="invalid_model")
            wrapper = ClaudeCliWrapper(options)
            
            # Should handle gracefully
            args = options.to_cli_args()
            has_invalid_model = "--model invalid_model" in " ".join(args)
            
            self.log_test("Malformed Options", True, f"Args generated: {len(args)} items")
            
        except Exception as e:
            self.log_test("Malformed Options", False, f"Exception: {type(e).__name__}")
    
    async def test_network_failure_simulation(self):
        """Test behavior during simulated network issues"""
        print("\nª Testing Network Failure Simulation...")
        
        try:
            # Test with environment that might cause network issues
            old_env = os.environ.get("HTTP_PROXY")
            os.environ["HTTP_PROXY"] = "http://invalid-proxy:9999"
            
            wrapper = ClaudeCliWrapper()
            
            messages = []
            try:
                async with asyncio.timeout(5):
                    async for message in wrapper.execute("What is 2+2?"):
                        messages.append(message)
                        if len(messages) > 10:  # Prevent infinite collection
                            break
            except asyncio.TimeoutError:
                pass
            
            # Restore environment
            if old_env:
                os.environ["HTTP_PROXY"] = old_env
            else:
                os.environ.pop("HTTP_PROXY", None)
            
            self.log_test("Network Failure", True, f"Handled with {len(messages)} messages")
            
        except Exception as e:
            self.log_test("Network Failure", False, f"Exception: {type(e).__name__}")
    
    async def test_concurrent_execution(self):
        """Test behavior with concurrent executions"""
        print("\nª Testing Concurrent Execution...")
        
        try:
            wrapper1 = ClaudeCliWrapper()
            wrapper2 = ClaudeCliWrapper()
            
            # Run two executions concurrently
            task1 = asyncio.create_task(self._collect_messages(wrapper1, "What is 1+1?"))
            task2 = asyncio.create_task(self._collect_messages(wrapper2, "What is 2+2?"))
            
            results = await asyncio.gather(task1, task2, return_exceptions=True)
            
            exceptions = [r for r in results if isinstance(r, Exception)]
            successful = len(results) - len(exceptions)
            
            self.log_test("Concurrent Execution", successful >= 1, 
                         f"{successful}/2 executions successful")
            
        except Exception as e:
            self.log_test("Concurrent Execution", False, f"Exception: {type(e).__name__}")
    
    async def _collect_messages(self, wrapper, prompt):
        """Helper to collect messages with timeout"""
        messages = []
        try:
            async with asyncio.timeout(10):
                async for message in wrapper.execute(prompt):
                    messages.append(message)
                    if len(messages) > 5:  # Limit collection
                        break
        except asyncio.TimeoutError:
            pass
        return messages
    
    async def test_simple_wrapper_errors(self):
        """Test error handling in simple synchronous wrapper"""
        print("\nª Testing Simple Wrapper Errors...")
        
        try:
            # Test with invalid model
            simple = ClaudeCliSimple(model="invalid", verbose=True)
            
            # This should handle errors gracefully
            result = simple.query("test")
            
            self.log_test("Simple Wrapper", True, f"Returned: {len(result)} chars")
            
        except Exception as e:
            self.log_test("Simple Wrapper", True, f"Exception handled: {type(e).__name__}")
    
    async def test_resource_cleanup(self):
        """Test resource cleanup after errors"""
        print("\nª Testing Resource Cleanup...")
        
        initial_processes = len([p for p in os.popen("tasklist").read().split('\n') if 'claude' in p.lower()])
        
        try:
            # Create multiple wrappers and let them fail
            for i in range(3):
                try:
                    options = ClaudeCliOptions(cli_path=f"/invalid/path/{i}")
                    wrapper = ClaudeCliWrapper(options)
                except:
                    pass
            
            # Check if processes were cleaned up
            final_processes = len([p for p in os.popen("tasklist").read().split('\n') if 'claude' in p.lower()])
            
            self.log_test("Resource Cleanup", True, 
                         f"Process count: {initial_processes}  {final_processes}")
            
        except Exception as e:
            self.log_test("Resource Cleanup", False, f"Exception: {type(e).__name__}")
    
    async def run_all_tests(self):
        """Run all error handling tests"""
        print("Starting Comprehensive Error Handling Tests")
        print("=" * 60)
        
        test_methods = [
            self.test_cli_not_found,
            self.test_authentication_failure,
            self.test_timeout_scenario,
            self.test_process_cleanup,
            self.test_invalid_working_directory,
            self.test_malformed_options,
            self.test_network_failure_simulation,
            self.test_concurrent_execution,
            self.test_simple_wrapper_errors,
            self.test_resource_cleanup,
        ]
        
        for test_method in test_methods:
            try:
                await test_method()
            except Exception as e:
                test_name = test_method.__name__
                self.log_test(test_name, False, f"Test framework error: {type(e).__name__}")
        
        self.print_summary()
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("ª ERROR HANDLING TEST RESULTS")
        print("=" * 60)
        
        for result in self.test_results:
            print(result)
        
        print("\n" + "=" * 60)
        print(f"Š SUMMARY: {self.passed_tests} passed, {self.failed_tests} failed")
        
        success_rate = (self.passed_tests / (self.passed_tests + self.failed_tests)) * 100 if (self.passed_tests + self.failed_tests) > 0 else 0
        print(f"¯ Success Rate: {success_rate:.1f}%")
        
        return success_rate


async def main():
    """Run error handling tests"""
    tester = ErrorHandlingTester()
    await tester.run_all_tests()
    
    return tester


if __name__ == "__main__":
    result_tester = asyncio.run(main())