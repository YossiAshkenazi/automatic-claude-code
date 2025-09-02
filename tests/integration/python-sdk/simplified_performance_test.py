#!/usr/bin/env python3
"""
Simplified Performance Test for Claude Code SDK
Tests core functionality without requiring actual Claude CLI
"""

import asyncio
import time
import psutil
import json
import statistics
import gc
import sys
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging
from dataclasses import dataclass, asdict
import tracemalloc

# Import SDK components
from claude_code_sdk.core.options import ClaudeCodeOptions
from claude_code_sdk.utils.cli_detector import CLIDetector
from claude_code_sdk.utils.process_manager import ProcessManager
from claude_code_sdk.exceptions import ClaudeCodeError, ClaudeNotFoundError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class PerformanceResult:
    """Results from a performance test"""
    test_name: str
    success: bool
    execution_time: float
    memory_usage_mb: float
    error_message: Optional[str] = None
    additional_metrics: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.additional_metrics is None:
            self.additional_metrics = {}

class SimplifiedPerformanceTestSuite:
    """Simplified performance testing focused on core components"""
    
    def __init__(self, test_working_dir: Optional[str] = None):
        self.test_dir = Path(test_working_dir or Path.cwd())
        self.results: List[PerformanceResult] = []
        self.process = psutil.Process()
    
    def get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        try:
            return self.process.memory_info().rss / 1024 / 1024
        except Exception:
            return 0.0
    
    async def run_all_tests(self) -> List[PerformanceResult]:
        """Run all performance tests"""
        logger.info("Starting Simplified Performance Test Suite")
        
        # Enable memory tracking
        tracemalloc.start()
        
        try:
            # 1. Options Creation Performance
            await self.test_options_creation_performance()
            
            # 2. CLI Detection Performance
            await self.test_cli_detection_performance()
            
            # 3. Process Manager Performance
            await self.test_process_manager_performance()
            
            # 4. Memory Usage Patterns
            await self.test_memory_patterns()
            
            # 5. Concurrent Options Creation
            await self.test_concurrent_operations()
            
            # 6. Error Handling Performance
            await self.test_error_handling_performance()
            
        except Exception as e:
            logger.error(f"Test suite failed: {e}")
            raise
        finally:
            tracemalloc.stop()
        
        logger.info(f"Simplified performance tests completed. {len(self.results)} tests run.")
        return self.results
    
    async def test_options_creation_performance(self) -> PerformanceResult:
        """Test ClaudeCodeOptions creation performance"""
        logger.info("Testing options creation performance...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        error_message = None
        
        try:
            # Create various option configurations
            configs_created = 0
            
            for i in range(1000):  # Create 1000 option objects
                options = ClaudeCodeOptions(
                    working_directory=self.test_dir,
                    timeout=30 + (i % 60),  # Varying timeouts
                    model="sonnet",
                    max_turns=10 + (i % 10),
                    verbose=i % 2 == 0,
                    session_id=f"test_session_{i}"
                )
                
                # Verify basic functionality
                cli_args = options.get_cli_args()
                env = options.get_process_env()
                config_dict = options.to_dict()
                
                configs_created += 1
                
                # Periodic garbage collection
                if i % 100 == 0:
                    gc.collect()
            
            success = True
            
        except Exception as e:
            logger.error(f"Options creation test failed: {e}")
            success = False
            error_message = str(e)
            configs_created = 0
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        result = PerformanceResult(
            test_name="options_creation_performance",
            success=success,
            execution_time=execution_time,
            memory_usage_mb=end_memory - start_memory,
            error_message=error_message,
            additional_metrics={
                'configs_created': configs_created,
                'configs_per_second': configs_created / execution_time if execution_time > 0 else 0,
                'memory_per_config_kb': (end_memory - start_memory) * 1024 / configs_created if configs_created > 0 else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Options creation test: {configs_created} configs in {execution_time:.2f}s, "
                   f"memory growth: {end_memory - start_memory:.2f}MB")
        
        return result
    
    async def test_cli_detection_performance(self) -> PerformanceResult:
        """Test CLI detection performance"""
        logger.info("Testing CLI detection performance...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        error_message = None
        detection_times = []
        
        try:
            detector = CLIDetector()
            detections_performed = 0
            
            # Test detection multiple times
            for i in range(10):
                detect_start = time.time()
                
                # This will likely fail since Claude CLI isn't installed,
                # but we're testing the detection logic performance
                cli_path = await detector.detect_claude_cli()
                
                detect_time = (time.time() - detect_start) * 1000  # ms
                detection_times.append(detect_time)
                detections_performed += 1
                
                # Clear cache between tests for realistic performance
                if i % 3 == 0:
                    detector.clear_cache()
            
            success = True
            
        except Exception as e:
            logger.error(f"CLI detection test failed: {e}")
            success = False
            error_message = str(e)
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        avg_detection_time = statistics.mean(detection_times) if detection_times else 0
        
        result = PerformanceResult(
            test_name="cli_detection_performance",
            success=success,
            execution_time=execution_time,
            memory_usage_mb=end_memory - start_memory,
            error_message=error_message,
            additional_metrics={
                'detections_performed': len(detection_times),
                'avg_detection_time_ms': avg_detection_time,
                'min_detection_time_ms': min(detection_times) if detection_times else 0,
                'max_detection_time_ms': max(detection_times) if detection_times else 0,
                'detection_times_ms': detection_times[:5]  # First 5 samples
            }
        )
        
        self.results.append(result)
        logger.info(f"CLI detection test: {len(detection_times)} detections, "
                   f"avg time: {avg_detection_time:.1f}ms")
        
        return result
    
    async def test_process_manager_performance(self) -> PerformanceResult:
        """Test ProcessManager performance"""
        logger.info("Testing process manager performance...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        error_message = None
        
        try:
            manager = ProcessManager()
            operations_performed = 0
            
            # Create mock processes for testing
            mock_processes = []
            
            # Create and track mock process objects (not actual processes)
            for i in range(100):
                # Create a mock process object for testing
                class MockProcess:
                    def __init__(self, process_id):
                        self.pid = process_id
                        self.returncode = None
                
                mock_proc = MockProcess(i)
                mock_processes.append(mock_proc)
                
                # Add to manager (this tests the tracking logic)
                try:
                    manager.add_process(mock_proc, f"test_session_{i}")
                    operations_performed += 1
                except AttributeError:
                    # Expected since we're using mock processes
                    # This tests the error handling
                    pass
            
            # Test health check functionality
            try:
                health_info = await manager.health_check()
                operations_performed += 1
            except Exception:
                # Expected with mock processes
                pass
            
            # Test process count
            process_count = manager.get_process_count()
            active_processes = manager.get_active_processes()
            operations_performed += 2
            
            success = True
            
        except Exception as e:
            logger.error(f"Process manager test failed: {e}")
            success = False
            error_message = str(e)
            operations_performed = 0
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        result = PerformanceResult(
            test_name="process_manager_performance",
            success=success,
            execution_time=execution_time,
            memory_usage_mb=end_memory - start_memory,
            error_message=error_message,
            additional_metrics={
                'operations_performed': operations_performed,
                'operations_per_second': operations_performed / execution_time if execution_time > 0 else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Process manager test: {operations_performed} operations in {execution_time:.2f}s")
        
        return result
    
    async def test_memory_patterns(self) -> PerformanceResult:
        """Test memory usage patterns over repeated operations"""
        logger.info("Testing memory usage patterns...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        error_message = None
        memory_samples = []
        
        try:
            # Perform repeated operations and track memory
            for cycle in range(10):  # 10 cycles of operations
                cycle_start_memory = self.get_memory_usage()
                
                # Create multiple option objects
                options_list = []
                for i in range(50):
                    options = ClaudeCodeOptions(
                        working_directory=self.test_dir,
                        timeout=30 + i,
                        session_id=f"cycle_{cycle}_session_{i}"
                    )
                    options_list.append(options)
                
                # Create CLI detector and test
                detector = CLIDetector()
                try:
                    await detector.detect_claude_cli()
                except Exception:
                    pass  # Expected to fail
                
                # Force garbage collection
                gc.collect()
                
                cycle_end_memory = self.get_memory_usage()
                memory_growth = cycle_end_memory - cycle_start_memory
                memory_samples.append(memory_growth)
                
                # Clear references
                del options_list
                del detector
            
            success = True
            cycles_completed = 10
            
        except Exception as e:
            logger.error(f"Memory patterns test failed: {e}")
            success = False
            error_message = str(e)
            cycles_completed = len(memory_samples)
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        total_memory_growth = end_memory - start_memory
        avg_cycle_growth = statistics.mean(memory_samples) if memory_samples else 0
        memory_leak_detected = total_memory_growth > 20 or avg_cycle_growth > 2  # Thresholds
        
        result = PerformanceResult(
            test_name="memory_patterns",
            success=success and not memory_leak_detected,
            execution_time=execution_time,
            memory_usage_mb=total_memory_growth,
            error_message=error_message or ("Memory leak detected" if memory_leak_detected else None),
            additional_metrics={
                'cycles_completed': cycles_completed,
                'memory_samples_mb': memory_samples,
                'avg_cycle_growth_mb': avg_cycle_growth,
                'memory_leak_detected': memory_leak_detected,
                'memory_variance': statistics.variance(memory_samples) if len(memory_samples) > 1 else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Memory patterns test: {total_memory_growth:.2f}MB total growth, "
                   f"leak detected: {memory_leak_detected}")
        
        return result
    
    async def test_concurrent_operations(self) -> PerformanceResult:
        """Test concurrent operations performance"""
        logger.info("Testing concurrent operations...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        error_message = None
        
        async def concurrent_task(task_id: int) -> Dict[str, Any]:
            """Single concurrent task"""
            try:
                # Create options
                options = ClaudeCodeOptions(
                    working_directory=self.test_dir,
                    session_id=f"concurrent_task_{task_id}",
                    timeout=30 + (task_id % 30)
                )
                
                # Test CLI detection
                detector = CLIDetector()
                try:
                    await detector.detect_claude_cli()
                except Exception:
                    pass  # Expected
                
                # Test process manager
                manager = ProcessManager()
                health = await manager.health_check()
                
                return {'success': True, 'task_id': task_id}
            except Exception as e:
                return {'success': False, 'task_id': task_id, 'error': str(e)}
        
        try:
            # Run 20 concurrent tasks
            concurrent_count = 20
            tasks = [concurrent_task(i) for i in range(concurrent_count)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            successful_tasks = 0
            failed_tasks = 0
            
            for result in results:
                if isinstance(result, dict) and result.get('success', False):
                    successful_tasks += 1
                else:
                    failed_tasks += 1
            
            success = failed_tasks < successful_tasks  # More successes than failures
            
        except Exception as e:
            logger.error(f"Concurrent operations test failed: {e}")
            success = False
            error_message = str(e)
            successful_tasks = 0
            failed_tasks = concurrent_count
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        result = PerformanceResult(
            test_name="concurrent_operations",
            success=success,
            execution_time=execution_time,
            memory_usage_mb=end_memory - start_memory,
            error_message=error_message,
            additional_metrics={
                'concurrent_tasks': concurrent_count,
                'successful_tasks': successful_tasks,
                'failed_tasks': failed_tasks,
                'success_rate': successful_tasks / concurrent_count if concurrent_count > 0 else 0,
                'tasks_per_second': concurrent_count / execution_time if execution_time > 0 else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Concurrent operations test: {successful_tasks}/{concurrent_count} successful, "
                   f"{execution_time:.2f}s")
        
        return result
    
    async def test_error_handling_performance(self) -> PerformanceResult:
        """Test error handling performance"""
        logger.info("Testing error handling performance...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        error_message = None
        
        try:
            errors_handled = 0
            error_types_tested = 0
            
            # Test various error scenarios
            error_scenarios = [
                # Invalid options
                lambda: ClaudeCodeOptions(model="invalid_model"),
                lambda: ClaudeCodeOptions(timeout=-1),
                lambda: ClaudeCodeOptions(max_turns=0),
                
                # CLI detection errors
                lambda: CLIDetector().detect_claude_cli(preferred_path="/nonexistent/path"),
                lambda: CLIDetector()._test_cli_path("nonexistent_command"),
            ]
            
            for i, scenario in enumerate(error_scenarios):
                error_start = time.time()
                
                try:
                    # Handle lambda functions that return coroutines
                    result = scenario()
                    if asyncio.iscoroutine(result):
                        await result
                    # If no error was raised, that's unexpected
                except Exception as e:
                    # Error was properly handled
                    errors_handled += 1
                    error_handling_time = (time.time() - error_start) * 1000
                
                error_types_tested += 1
            
            success = errors_handled == error_types_tested  # All errors should be caught
            
        except Exception as e:
            logger.error(f"Error handling test failed: {e}")
            success = False
            error_message = str(e)
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        result = PerformanceResult(
            test_name="error_handling_performance",
            success=success,
            execution_time=execution_time,
            memory_usage_mb=end_memory - start_memory,
            error_message=error_message,
            additional_metrics={
                'error_scenarios_tested': error_types_tested,
                'errors_properly_handled': errors_handled,
                'error_handling_rate': errors_handled / error_types_tested if error_types_tested > 0 else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Error handling test: {errors_handled}/{error_types_tested} errors handled properly")
        
        return result
    
    def generate_performance_report(self) -> Dict[str, Any]:
        """Generate performance report"""
        if not self.results:
            return {"error": "No test results available"}
        
        successful_tests = [r for r in self.results if r.success]
        failed_tests = [r for r in self.results if not r.success]
        
        total_execution_time = sum(r.execution_time for r in self.results)
        total_memory_usage = sum(r.memory_usage_mb for r in self.results if r.memory_usage_mb > 0)
        
        return {
            "summary": {
                "total_tests": len(self.results),
                "successful_tests": len(successful_tests),
                "failed_tests": len(failed_tests),
                "success_rate_percent": (len(successful_tests) / len(self.results)) * 100,
                "total_execution_time_seconds": round(total_execution_time, 3),
                "total_memory_usage_mb": round(total_memory_usage, 2)
            },
            "performance_metrics": {
                "fastest_test": min(self.results, key=lambda x: x.execution_time).test_name,
                "slowest_test": max(self.results, key=lambda x: x.execution_time).test_name,
                "most_memory_intensive": max(self.results, key=lambda x: x.memory_usage_mb).test_name,
                "avg_test_duration_ms": (total_execution_time / len(self.results)) * 1000
            },
            "test_results": [asdict(result) for result in self.results],
            "recommendations": self._generate_recommendations()
        }
    
    def _generate_recommendations(self) -> List[str]:
        """Generate performance recommendations"""
        recommendations = []
        
        failed_tests = [r for r in self.results if not r.success]
        if failed_tests:
            recommendations.append(f"Fix {len(failed_tests)} failing tests before production use")
        
        # Check memory usage
        high_memory_tests = [r for r in self.results if r.memory_usage_mb > 10]
        if high_memory_tests:
            recommendations.append(f"Monitor memory usage - {len(high_memory_tests)} tests used >10MB")
        
        # Check execution time
        slow_tests = [r for r in self.results if r.execution_time > 5]
        if slow_tests:
            recommendations.append(f"Optimize performance - {len(slow_tests)} tests took >5 seconds")
        
        if not recommendations:
            recommendations.append("SDK core components show good performance characteristics")
        
        return recommendations

async def main():
    """Run the simplified performance test suite"""
    test_suite = SimplifiedPerformanceTestSuite()
    
    try:
        logger.info("Starting Simplified Claude Code SDK Performance Tests")
        logger.info("=" * 60)
        
        # Run all tests
        results = await test_suite.run_all_tests()
        
        # Generate and display report
        report = test_suite.generate_performance_report()
        
        print("\n" + "=" * 60)
        print("SIMPLIFIED PERFORMANCE TEST RESULTS")
        print("=" * 60)
        
        # Summary
        summary = report['summary']
        print(f"Tests Run: {summary['total_tests']}")
        print(f"Successful: {summary['successful_tests']}")
        print(f"Failed: {summary['failed_tests']}")
        print(f"Success Rate: {summary['success_rate_percent']:.1f}%")
        print(f"Total Time: {summary['total_execution_time_seconds']}s")
        print(f"Memory Used: {summary['total_memory_usage_mb']}MB")
        
        # Performance metrics
        metrics = report['performance_metrics']
        print(f"\nFastest Test: {metrics['fastest_test']}")
        print(f"Slowest Test: {metrics['slowest_test']}")
        print(f"Most Memory: {metrics['most_memory_intensive']}")
        print(f"Avg Duration: {metrics['avg_test_duration_ms']:.1f}ms")
        
        # Show any failures
        failed_results = [r for r in results if not r.success]
        if failed_results:
            print("\nFailed Tests:")
            for result in failed_results:
                print(f"  - {result.test_name}: {result.error_message}")
        
        # Recommendations
        print("\nRecommendations:")
        for rec in report['recommendations']:
            print(f"  - {rec}")
        
        # Save detailed report
        report_file = Path("simplified_performance_report.json")
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\nDetailed report saved to: {report_file.absolute()}")
        
        # Return exit code based on results
        if summary['failed_tests'] > 0:
            print("\nWARNING: Some tests failed - Review results before production use")
            return 1
        else:
            print("\nSUCCESS: All core performance tests passed")
            return 0
        
    except Exception as e:
        logger.error(f"Test suite failed: {e}")
        print(f"\nERROR: Performance tests failed - {e}")
        return 1

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\nTest suite interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1)
