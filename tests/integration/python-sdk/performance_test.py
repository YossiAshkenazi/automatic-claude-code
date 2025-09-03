#!/usr/bin/env python3
"""
Comprehensive Performance & Load Testing Suite for Claude Code SDK
Tests concurrent clients, memory usage, streaming performance, and resource management
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
from concurrent.futures import ThreadPoolExecutor
import threading
import tracemalloc
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager

# Import SDK components
from claude_code_sdk import ClaudeCodeClient
from claude_code_sdk.core.options import ClaudeCodeOptions
from claude_code_sdk.core.messages import Message
from claude_code_sdk.exceptions import ClaudeCodeError, ClaudeTimeoutError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class BenchmarkResult:
    """Results from a performance benchmark"""
    test_name: str
    execution_time: float
    memory_usage_mb: float
    peak_memory_mb: float
    success_count: int
    error_count: int
    average_response_time: float
    throughput_qps: float
    concurrent_clients: int = 1
    total_queries: int = 0
    memory_leak_detected: bool = False
    additional_metrics: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.additional_metrics is None:
            self.additional_metrics = {}

class PerformanceTestSuite:
    """Comprehensive performance testing suite"""
    
    def __init__(self, test_working_dir: Optional[str] = None):
        self.test_dir = Path(test_working_dir or Path.cwd())
        self.results: List[BenchmarkResult] = []
        self.process = psutil.Process()
        
        # Test configurations
        self.test_prompts = {
            'simple': "What is 2+2?",
            'medium': """Explain the concept of async/await in Python. 
                        Provide code examples and best practices.""",
            'large': """Write a comprehensive guide to building scalable web applications 
                        using Python. Include sections on architecture patterns, database design, 
                        caching strategies, API design, testing approaches, deployment strategies, 
                        monitoring and observability, security considerations, performance optimization, 
                        and maintenance best practices. Provide detailed code examples for each section 
                        and explain the trade-offs between different approaches."""
        }
        
        # Performance baselines
        self.baseline_metrics = {
            'max_response_time_ms': 30000,  # 30 seconds
            'max_memory_usage_mb': 500,     # 500 MB
            'min_throughput_qps': 0.1,      # 0.1 queries per second
            'max_concurrent_clients': 20    # 20 concurrent clients
        }
    
    async def run_all_tests(self) -> List[BenchmarkResult]:
        """Run comprehensive performance test suite"""
        logger.info("Starting comprehensive performance test suite...")
        
        # Enable memory tracking
        tracemalloc.start()
        
        try:
            # 1. Baseline single query performance
            await self.test_single_query_baseline()
            
            # 2. Concurrent client performance
            await self.test_concurrent_clients()
            
            # 3. Memory usage patterns
            await self.test_memory_usage_patterns()
            
            # 4. Streaming vs blocking performance
            await self.test_streaming_vs_blocking()
            
            # 5. Large prompt handling
            await self.test_large_prompt_handling()
            
            # 6. Long-running session stability
            await self.test_long_running_session()
            
            # 7. Process management under load
            await self.test_process_management_load()
            
            # 8. Memory leak detection
            await self.test_memory_leak_detection()
            
            # 9. CLI detection speed
            await self.test_cli_detection_speed()
            
            # 10. Error recovery performance
            await self.test_error_recovery_performance()
            
        except Exception as e:
            logger.error(f"Test suite failed: {e}")
            raise
        finally:
            tracemalloc.stop()
        
        logger.info(f"Performance test suite completed. {len(self.results)} tests run.")
        return self.results
    
    async def test_single_query_baseline(self) -> BenchmarkResult:
        """Test single query execution time baseline"""
        logger.info("Testing single query baseline performance...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        
        options = ClaudeCodeOptions(
            working_directory=self.test_dir,
            timeout=30,
            stream_response=False
        )
        
        success_count = 0
        error_count = 0
        response_times = []
        
        try:
            async with ClaudeCodeClient(options) as client:
                for i in range(3):  # Test 3 simple queries
                    query_start = time.time()
                    
                    try:
                        messages = []
                        async for message in client.query(self.test_prompts['simple']):
                            messages.append(message)
                        
                        response_time = (time.time() - query_start) * 1000  # ms
                        response_times.append(response_time)
                        success_count += 1
                        
                    except Exception as e:
                        logger.error(f"Query {i+1} failed: {e}")
                        error_count += 1
                        response_times.append(30000)  # Max timeout
        
        except Exception as e:
            logger.error(f"Baseline test failed: {e}")
            error_count = 3
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        avg_response_time = statistics.mean(response_times) if response_times else 0
        throughput = success_count / execution_time if execution_time > 0 else 0
        
        result = BenchmarkResult(
            test_name="single_query_baseline",
            execution_time=execution_time,
            memory_usage_mb=end_memory - start_memory,
            peak_memory_mb=end_memory,
            success_count=success_count,
            error_count=error_count,
            average_response_time=avg_response_time,
            throughput_qps=throughput,
            total_queries=3,
            additional_metrics={
                'response_times_ms': response_times,
                'median_response_time_ms': statistics.median(response_times) if response_times else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Baseline test completed: {success_count} success, {error_count} errors, "
                   f"avg response time: {avg_response_time:.1f}ms")
        
        return result
    
    async def test_concurrent_clients(self) -> BenchmarkResult:
        """Test performance with concurrent clients"""
        logger.info("Testing concurrent client performance...")
        
        concurrent_counts = [2, 5, 10, 15]  # Test different concurrency levels
        best_result = None
        
        for concurrent_count in concurrent_counts:
            logger.info(f"Testing {concurrent_count} concurrent clients...")
            
            start_memory = self.get_memory_usage()
            start_time = time.time()
            
            success_count = 0
            error_count = 0
            response_times = []
            
            # Create concurrent tasks
            async def client_task(client_id: int) -> Dict[str, Any]:
                options = ClaudeCodeOptions(
                    working_directory=self.test_dir,
                    timeout=45,
                    stream_response=False,
                    session_id=f"concurrent_client_{client_id}"
                )
                
                client_success = 0
                client_errors = 0
                client_response_times = []
                
                try:
                    async with ClaudeCodeClient(options) as client:
                        # Each client runs 2 queries
                        for i in range(2):
                            query_start = time.time()
                            
                            try:
                                messages = []
                                async for message in client.query(self.test_prompts['simple']):
                                    messages.append(message)
                                
                                response_time = (time.time() - query_start) * 1000
                                client_response_times.append(response_time)
                                client_success += 1
                                
                            except Exception as e:
                                logger.error(f"Client {client_id} query {i+1} failed: {e}")
                                client_errors += 1
                                client_response_times.append(45000)  # Max timeout
                
                except Exception as e:
                    logger.error(f"Client {client_id} failed: {e}")
                    client_errors = 2
                
                return {
                    'success_count': client_success,
                    'error_count': client_errors,
                    'response_times': client_response_times
                }
            
            # Run concurrent clients
            try:
                tasks = [client_task(i) for i in range(concurrent_count)]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Aggregate results
                for result in results:
                    if isinstance(result, dict):
                        success_count += result['success_count']
                        error_count += result['error_count']
                        response_times.extend(result['response_times'])
                    else:
                        error_count += 2  # Failed client
                        
            except Exception as e:
                logger.error(f"Concurrent test with {concurrent_count} clients failed: {e}")
                error_count = concurrent_count * 2
            
            end_memory = self.get_memory_usage()
            execution_time = time.time() - start_time
            
            avg_response_time = statistics.mean(response_times) if response_times else 0
            throughput = success_count / execution_time if execution_time > 0 else 0
            
            result = BenchmarkResult(
                test_name=f"concurrent_clients_{concurrent_count}",
                execution_time=execution_time,
                memory_usage_mb=end_memory - start_memory,
                peak_memory_mb=end_memory,
                success_count=success_count,
                error_count=error_count,
                average_response_time=avg_response_time,
                throughput_qps=throughput,
                concurrent_clients=concurrent_count,
                total_queries=concurrent_count * 2,
                additional_metrics={
                    'response_times_ms': response_times[:10],  # Sample first 10
                    'median_response_time_ms': statistics.median(response_times) if response_times else 0,
                    'max_response_time_ms': max(response_times) if response_times else 0,
                    'min_response_time_ms': min(response_times) if response_times else 0
                }
            )
            
            self.results.append(result)
            
            # Track best performance for return
            if best_result is None or (result.error_count < best_result.error_count and 
                                     result.throughput_qps > best_result.throughput_qps):
                best_result = result
            
            logger.info(f"Concurrent test ({concurrent_count} clients): {success_count} success, "
                       f"{error_count} errors, throughput: {throughput:.2f} QPS")
            
            # Brief pause between tests
            await asyncio.sleep(2)
        
        return best_result
    
    async def test_memory_usage_patterns(self) -> BenchmarkResult:
        """Test memory usage over multiple queries"""
        logger.info("Testing memory usage patterns...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        peak_memory = start_memory
        
        options = ClaudeCodeOptions(
            working_directory=self.test_dir,
            timeout=30,
            stream_response=False
        )
        
        success_count = 0
        error_count = 0
        memory_samples = []
        
        try:
            async with ClaudeCodeClient(options) as client:
                # Run 20 queries and monitor memory
                for i in range(20):
                    try:
                        messages = []
                        async for message in client.query(self.test_prompts['simple']):
                            messages.append(message)
                        
                        success_count += 1
                        
                        # Sample memory usage
                        current_memory = self.get_memory_usage()
                        memory_samples.append(current_memory)
                        peak_memory = max(peak_memory, current_memory)
                        
                        # Force garbage collection every 5 queries
                        if (i + 1) % 5 == 0:
                            gc.collect()
                        
                    except Exception as e:
                        logger.error(f"Memory test query {i+1} failed: {e}")
                        error_count += 1
        
        except Exception as e:
            logger.error(f"Memory usage test failed: {e}")
            error_count = 20
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        # Check for potential memory leak
        memory_growth = end_memory - start_memory
        memory_leak_detected = memory_growth > 50  # >50MB growth indicates potential leak
        
        avg_response_time = (execution_time / success_count * 1000) if success_count > 0 else 0
        throughput = success_count / execution_time if execution_time > 0 else 0
        
        result = BenchmarkResult(
            test_name="memory_usage_patterns",
            execution_time=execution_time,
            memory_usage_mb=memory_growth,
            peak_memory_mb=peak_memory,
            success_count=success_count,
            error_count=error_count,
            average_response_time=avg_response_time,
            throughput_qps=throughput,
            total_queries=20,
            memory_leak_detected=memory_leak_detected,
            additional_metrics={
                'memory_samples_mb': memory_samples[-10:],  # Last 10 samples
                'memory_growth_mb': memory_growth,
                'avg_memory_per_query_mb': memory_growth / success_count if success_count > 0 else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Memory test completed: {memory_growth:.1f}MB growth, "
                   f"leak detected: {memory_leak_detected}")
        
        return result
    
    async def test_streaming_vs_blocking(self) -> BenchmarkResult:
        """Compare streaming vs blocking mode performance"""
        logger.info("Testing streaming vs blocking performance...")
        
        # Test both modes
        modes = [('blocking', False), ('streaming', True)]
        mode_results = []
        
        for mode_name, stream_mode in modes:
            logger.info(f"Testing {mode_name} mode...")
            
            start_memory = self.get_memory_usage()
            start_time = time.time()
            
            options = ClaudeCodeOptions(
                working_directory=self.test_dir,
                timeout=30,
                stream_response=stream_mode
            )
            
            success_count = 0
            error_count = 0
            response_times = []
            
            try:
                async with ClaudeCodeClient(options) as client:
                    for i in range(5):
                        query_start = time.time()
                        
                        try:
                            messages = []
                            async for message in client.query(self.test_prompts['medium']):
                                messages.append(message)
                            
                            response_time = (time.time() - query_start) * 1000
                            response_times.append(response_time)
                            success_count += 1
                            
                        except Exception as e:
                            logger.error(f"{mode_name} query {i+1} failed: {e}")
                            error_count += 1
                            response_times.append(30000)
            
            except Exception as e:
                logger.error(f"{mode_name} mode test failed: {e}")
                error_count = 5
            
            end_memory = self.get_memory_usage()
            execution_time = time.time() - start_time
            
            avg_response_time = statistics.mean(response_times) if response_times else 0
            throughput = success_count / execution_time if execution_time > 0 else 0
            
            mode_result = {
                'mode': mode_name,
                'success_count': success_count,
                'error_count': error_count,
                'avg_response_time_ms': avg_response_time,
                'throughput_qps': throughput,
                'memory_usage_mb': end_memory - start_memory
            }
            mode_results.append(mode_result)
        
        # Compare results
        if len(mode_results) == 2:
            streaming_faster = mode_results[1]['avg_response_time_ms'] < mode_results[0]['avg_response_time_ms']
            performance_diff = abs(mode_results[1]['avg_response_time_ms'] - mode_results[0]['avg_response_time_ms'])
        else:
            streaming_faster = False
            performance_diff = 0
        
        # Return combined result
        total_success = sum(r['success_count'] for r in mode_results)
        total_errors = sum(r['error_count'] for r in mode_results)
        avg_response_time = statistics.mean([r['avg_response_time_ms'] for r in mode_results if r['avg_response_time_ms'] > 0])
        
        result = BenchmarkResult(
            test_name="streaming_vs_blocking",
            execution_time=0,  # Combined test
            memory_usage_mb=sum(r['memory_usage_mb'] for r in mode_results),
            peak_memory_mb=self.get_memory_usage(),
            success_count=total_success,
            error_count=total_errors,
            average_response_time=avg_response_time if avg_response_time else 0,
            throughput_qps=0,  # Not meaningful for comparison
            total_queries=10,
            additional_metrics={
                'mode_results': mode_results,
                'streaming_faster': streaming_faster,
                'performance_difference_ms': performance_diff
            }
        )
        
        self.results.append(result)
        logger.info(f"Streaming vs blocking test completed. Streaming faster: {streaming_faster}")
        
        return result
    
    async def test_large_prompt_handling(self) -> BenchmarkResult:
        """Test handling of large prompts"""
        logger.info("Testing large prompt handling...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        
        options = ClaudeCodeOptions(
            working_directory=self.test_dir,
            timeout=60,  # Longer timeout for large prompts
            stream_response=False
        )
        
        success_count = 0
        error_count = 0
        response_times = []
        
        try:
            async with ClaudeCodeClient(options) as client:
                # Test with large prompt
                query_start = time.time()
                
                try:
                    messages = []
                    async for message in client.query(self.test_prompts['large']):
                        messages.append(message)
                    
                    response_time = (time.time() - query_start) * 1000
                    response_times.append(response_time)
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"Large prompt test failed: {e}")
                    error_count += 1
                    response_times.append(60000)
        
        except Exception as e:
            logger.error(f"Large prompt handling test failed: {e}")
            error_count = 1
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        avg_response_time = statistics.mean(response_times) if response_times else 0
        throughput = success_count / execution_time if execution_time > 0 else 0
        
        prompt_size_chars = len(self.test_prompts['large'])
        
        result = BenchmarkResult(
            test_name="large_prompt_handling",
            execution_time=execution_time,
            memory_usage_mb=end_memory - start_memory,
            peak_memory_mb=end_memory,
            success_count=success_count,
            error_count=error_count,
            average_response_time=avg_response_time,
            throughput_qps=throughput,
            total_queries=1,
            additional_metrics={
                'prompt_size_characters': prompt_size_chars,
                'prompt_size_kb': prompt_size_chars / 1024,
                'processing_rate_chars_per_sec': prompt_size_chars / (avg_response_time / 1000) if avg_response_time > 0 else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Large prompt test completed: {prompt_size_chars} chars, "
                   f"response time: {avg_response_time:.1f}ms")
        
        return result
    
    async def test_long_running_session(self) -> BenchmarkResult:
        """Test stability over a long-running session"""
        logger.info("Testing long-running session stability...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        
        options = ClaudeCodeOptions(
            working_directory=self.test_dir,
            timeout=30,
            stream_response=False
        )
        
        success_count = 0
        error_count = 0
        memory_samples = []
        response_times = []
        
        try:
            async with ClaudeCodeClient(options) as client:
                # Run queries for 2 minutes or 30 queries, whichever comes first
                end_time = start_time + 120  # 2 minutes
                query_count = 0
                
                while time.time() < end_time and query_count < 30:
                    query_start = time.time()
                    
                    try:
                        messages = []
                        prompt = self.test_prompts['simple'] if query_count % 3 == 0 else self.test_prompts['medium']
                        async for message in client.query(prompt):
                            messages.append(message)
                        
                        response_time = (time.time() - query_start) * 1000
                        response_times.append(response_time)
                        success_count += 1
                        
                        # Sample memory usage
                        current_memory = self.get_memory_usage()
                        memory_samples.append(current_memory)
                        
                        # Brief pause between queries
                        await asyncio.sleep(1)
                        
                    except Exception as e:
                        logger.error(f"Long session query {query_count + 1} failed: {e}")
                        error_count += 1
                        response_times.append(30000)
                    
                    query_count += 1
        
        except Exception as e:
            logger.error(f"Long running session test failed: {e}")
            error_count = query_count + 1
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        avg_response_time = statistics.mean(response_times) if response_times else 0
        throughput = success_count / execution_time if execution_time > 0 else 0
        
        # Check for performance degradation over time
        if len(response_times) >= 6:
            first_half_avg = statistics.mean(response_times[:len(response_times)//2])
            second_half_avg = statistics.mean(response_times[len(response_times)//2:])
            performance_degradation = (second_half_avg - first_half_avg) / first_half_avg if first_half_avg > 0 else 0
        else:
            performance_degradation = 0
        
        result = BenchmarkResult(
            test_name="long_running_session",
            execution_time=execution_time,
            memory_usage_mb=end_memory - start_memory,
            peak_memory_mb=max(memory_samples) if memory_samples else end_memory,
            success_count=success_count,
            error_count=error_count,
            average_response_time=avg_response_time,
            throughput_qps=throughput,
            total_queries=success_count + error_count,
            additional_metrics={
                'session_duration_minutes': execution_time / 60,
                'performance_degradation_percent': performance_degradation * 100,
                'memory_stability': len(set(int(m/10)*10 for m in memory_samples)) <= 3,  # Memory stays within 30MB bands
                'response_time_variance': statistics.variance(response_times) if len(response_times) > 1 else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Long session test completed: {execution_time/60:.1f} min, "
                   f"degradation: {performance_degradation*100:.1f}%")
        
        return result
    
    async def test_process_management_load(self) -> BenchmarkResult:
        """Test process management under concurrent load"""
        logger.info("Testing process management under load...")
        
        start_memory = self.get_memory_usage()
        start_time = time.time()
        
        success_count = 0
        error_count = 0
        max_concurrent_processes = 0
        
        async def stress_client(client_id: int) -> Dict[str, Any]:
            """Single client stress test"""
            options = ClaudeCodeOptions(
                working_directory=self.test_dir,
                timeout=20,
                stream_response=False,
                session_id=f"stress_client_{client_id}"
            )
            
            client_success = 0
            client_errors = 0
            
            try:
                async with ClaudeCodeClient(options) as client:
                    # Each client runs 3 quick queries
                    for i in range(3):
                        try:
                            messages = []
                            async for message in client.query(self.test_prompts['simple']):
                                messages.append(message)
                            client_success += 1
                        except Exception as e:
                            client_errors += 1
            except Exception:
                client_errors = 3
            
            return {'success': client_success, 'errors': client_errors}
        
        try:
            # Create 15 concurrent clients to stress process management
            stress_clients = 15
            tasks = [stress_client(i) for i in range(stress_clients)]
            
            # Monitor process count during execution
            monitoring_task = asyncio.create_task(self._monitor_process_count())
            
            # Run stress test
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Stop monitoring
            monitoring_task.cancel()
            try:
                max_processes = await monitoring_task
            except asyncio.CancelledError:
                max_processes = 0
            
            max_concurrent_processes = max_processes
            
            # Aggregate results
            for result in results:
                if isinstance(result, dict):
                    success_count += result['success']
                    error_count += result['errors']
                else:
                    error_count += 3  # Failed client
        
        except Exception as e:
            logger.error(f"Process management stress test failed: {e}")
            error_count = stress_clients * 3
        
        end_memory = self.get_memory_usage()
        execution_time = time.time() - start_time
        
        avg_response_time = (execution_time / success_count * 1000) if success_count > 0 else 0
        throughput = success_count / execution_time if execution_time > 0 else 0
        
        result = BenchmarkResult(
            test_name="process_management_load",
            execution_time=execution_time,
            memory_usage_mb=end_memory - start_memory,
            peak_memory_mb=end_memory,
            success_count=success_count,
            error_count=error_count,
            average_response_time=avg_response_time,
            throughput_qps=throughput,
            concurrent_clients=stress_clients,
            total_queries=stress_clients * 3,
            additional_metrics={
                'max_concurrent_processes': max_concurrent_processes,
                'process_management_stable': error_count < (success_count + error_count) * 0.1  # <10% errors
            }
        )
        
        self.results.append(result)
        logger.info(f"Process management test completed: max {max_concurrent_processes} processes")
        
        return result
    
    async def _monitor_process_count(self) -> int:
        """Monitor maximum process count during stress test"""
        max_processes = 0
        try:
            while True:
                # Count Claude-related processes
                claude_processes = 0
                for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                    try:
                        if 'claude' in proc.info['name'].lower() or \
                           any('claude' in arg.lower() for arg in (proc.info['cmdline'] or [])):
                            claude_processes += 1
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        continue
                
                max_processes = max(max_processes, claude_processes)
                await asyncio.sleep(0.5)  # Check every 500ms
        except asyncio.CancelledError:
            return max_processes
    
    async def test_memory_leak_detection(self) -> BenchmarkResult:
        """Detect potential memory leaks"""
        logger.info("Testing for memory leaks...")
        
        # Force garbage collection before starting
        gc.collect()
        start_memory = self.get_memory_usage()
        start_time = time.time()
        
        options = ClaudeCodeOptions(
            working_directory=self.test_dir,
            timeout=15,
            stream_response=False
        )
        
        memory_samples = []
        success_count = 0
        error_count = 0
        
        try:
            # Run multiple client sessions to detect leaks
            for session in range(5):
                session_start_memory = self.get_memory_usage()
                
                async with ClaudeCodeClient(options) as client:
                    # Run 10 queries per session
                    for i in range(10):
                        try:
                            messages = []
                            async for message in client.query(self.test_prompts['simple']):
                                messages.append(message)
                            success_count += 1
                        except Exception as e:
                            error_count += 1
                
                # Force garbage collection after each session
                gc.collect()
                session_end_memory = self.get_memory_usage()
                
                memory_growth = session_end_memory - session_start_memory
                memory_samples.append(memory_growth)
                
                logger.debug(f"Session {session + 1} memory growth: {memory_growth:.1f}MB")
        
        except Exception as e:
            logger.error(f"Memory leak test failed: {e}")
            error_count += 50  # Remaining queries
        
        end_memory = self.get_memory_usage()
        total_memory_growth = end_memory - start_memory
        execution_time = time.time() - start_time
        
        # Detect memory leak patterns
        if len(memory_samples) >= 3:
            # Check if memory growth is consistently increasing
            positive_growths = sum(1 for growth in memory_samples if growth > 5)  # >5MB growth
            leak_pattern_detected = positive_growths >= len(memory_samples) * 0.6  # 60% of sessions show growth
            avg_session_growth = statistics.mean(memory_samples)
        else:
            leak_pattern_detected = total_memory_growth > 50  # Simple threshold
            avg_session_growth = total_memory_growth / len(memory_samples) if memory_samples else 0
        
        avg_response_time = (execution_time / success_count * 1000) if success_count > 0 else 0
        throughput = success_count / execution_time if execution_time > 0 else 0
        
        result = BenchmarkResult(
            test_name="memory_leak_detection",
            execution_time=execution_time,
            memory_usage_mb=total_memory_growth,
            peak_memory_mb=end_memory,
            success_count=success_count,
            error_count=error_count,
            average_response_time=avg_response_time,
            throughput_qps=throughput,
            total_queries=50,
            memory_leak_detected=leak_pattern_detected,
            additional_metrics={
                'memory_samples_mb': memory_samples,
                'average_session_growth_mb': avg_session_growth,
                'sessions_with_growth': sum(1 for g in memory_samples if g > 0),
                'leak_confidence': positive_growths / len(memory_samples) if memory_samples else 0
            }
        )
        
        self.results.append(result)
        logger.info(f"Memory leak test completed: {total_memory_growth:.1f}MB total growth, "
                   f"leak detected: {leak_pattern_detected}")
        
        return result
    
    async def test_cli_detection_speed(self) -> BenchmarkResult:
        """Test CLI detection speed"""
        logger.info("Testing CLI detection speed...")
        
        start_time = time.time()
        
        detection_times = []
        success_count = 0
        error_count = 0
        
        try:
            from claude_code_sdk.utils.cli_detector import CLIDetector
            
            # Test CLI detection multiple times
            for i in range(10):
                detect_start = time.time()
                
                try:
                    detector = CLIDetector()
                    cli_path = await detector.detect_claude_cli()
                    
                    detect_time = (time.time() - detect_start) * 1000  # ms
                    detection_times.append(detect_time)
                    
                    if cli_path:
                        success_count += 1
                    else:
                        error_count += 1
                        
                except Exception as e:
                    logger.error(f"CLI detection {i+1} failed: {e}")
                    error_count += 1
                    detection_times.append(5000)  # 5 second timeout
        
        except Exception as e:
            logger.error(f"CLI detection test failed: {e}")
            error_count = 10
        
        execution_time = time.time() - start_time
        avg_detection_time = statistics.mean(detection_times) if detection_times else 0
        
        result = BenchmarkResult(
            test_name="cli_detection_speed",
            execution_time=execution_time,
            memory_usage_mb=0,  # Negligible for detection
            peak_memory_mb=self.get_memory_usage(),
            success_count=success_count,
            error_count=error_count,
            average_response_time=avg_detection_time,
            throughput_qps=success_count / execution_time if execution_time > 0 else 0,
            total_queries=10,
            additional_metrics={
                'detection_times_ms': detection_times,
                'min_detection_time_ms': min(detection_times) if detection_times else 0,
                'max_detection_time_ms': max(detection_times) if detection_times else 0,
                'detection_reliability': success_count / 10
            }
        )
        
        self.results.append(result)
        logger.info(f"CLI detection test completed: {avg_detection_time:.1f}ms avg, "
                   f"{success_count}/10 successful")
        
        return result
    
    async def test_error_recovery_performance(self) -> BenchmarkResult:
        """Test error recovery time and reliability"""
        logger.info("Testing error recovery performance...")
        
        start_time = time.time()
        
        recovery_times = []
        success_count = 0
        error_count = 0
        recovery_success_count = 0
        
        options = ClaudeCodeOptions(
            working_directory=self.test_dir,
            timeout=10,  # Short timeout to trigger errors
            stream_response=False
        )
        
        try:
            async with ClaudeCodeClient(options) as client:
                # Test error scenarios and recovery
                error_scenarios = [
                    ("invalid command that should fail", "invalid_command"),
                    (self.test_prompts['simple'], "valid_after_error"),
                    ("another invalid command", "second_error"),
                    (self.test_prompts['simple'], "recovery_test")
                ]
                
                for i, (prompt, scenario) in enumerate(error_scenarios):
                    recovery_start = time.time()
                    
                    try:
                        messages = []
                        async for message in client.query(prompt):
                            messages.append(message)
                        
                        recovery_time = (time.time() - recovery_start) * 1000
                        recovery_times.append(recovery_time)
                        success_count += 1
                        
                        # If this was after an error, count as recovery
                        if i > 0 and "after_error" in scenario or "recovery" in scenario:
                            recovery_success_count += 1
                            
                    except Exception as e:
                        recovery_time = (time.time() - recovery_start) * 1000
                        recovery_times.append(recovery_time)
                        error_count += 1
                        
                        logger.debug(f"Expected error in scenario {scenario}: {e}")
        
        except Exception as e:
            logger.error(f"Error recovery test failed: {e}")
            error_count += len(error_scenarios)
        
        execution_time = time.time() - start_time
        avg_recovery_time = statistics.mean(recovery_times) if recovery_times else 0
        
        result = BenchmarkResult(
            test_name="error_recovery_performance",
            execution_time=execution_time,
            memory_usage_mb=0,  # Not significant for this test
            peak_memory_mb=self.get_memory_usage(),
            success_count=success_count,
            error_count=error_count,
            average_response_time=avg_recovery_time,
            throughput_qps=success_count / execution_time if execution_time > 0 else 0,
            total_queries=len(error_scenarios),
            additional_metrics={
                'recovery_times_ms': recovery_times,
                'recovery_success_count': recovery_success_count,
                'recovery_success_rate': recovery_success_count / 2 if recovery_success_count > 0 else 0,  # 2 recovery attempts
                'error_handling_stable': len(recovery_times) == len(error_scenarios)
            }
        )
        
        self.results.append(result)
        logger.info(f"Error recovery test completed: {avg_recovery_time:.1f}ms avg recovery, "
                   f"{recovery_success_count} successful recoveries")
        
        return result
    
    def get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        try:
            return self.process.memory_info().rss / 1024 / 1024
        except Exception:
            return 0.0
    
    def generate_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        if not self.results:
            return {"error": "No test results available"}
        
        # Calculate overall statistics
        total_queries = sum(r.total_queries for r in self.results)
        total_successes = sum(r.success_count for r in self.results)
        total_errors = sum(r.error_count for r in self.results)
        success_rate = (total_successes / (total_successes + total_errors)) * 100 if (total_successes + total_errors) > 0 else 0
        
        # Performance benchmarks
        avg_response_times = [r.average_response_time for r in self.results if r.average_response_time > 0]
        overall_avg_response_time = statistics.mean(avg_response_times) if avg_response_times else 0
        
        peak_memory = max(r.peak_memory_mb for r in self.results)
        total_memory_growth = sum(r.memory_usage_mb for r in self.results if r.memory_usage_mb > 0)
        
        # Check performance against baselines
        performance_issues = []
        
        if overall_avg_response_time > self.baseline_metrics['max_response_time_ms']:
            performance_issues.append(f"Average response time ({overall_avg_response_time:.1f}ms) exceeds baseline ({self.baseline_metrics['max_response_time_ms']}ms)")
        
        if peak_memory > self.baseline_metrics['max_memory_usage_mb']:
            performance_issues.append(f"Peak memory usage ({peak_memory:.1f}MB) exceeds baseline ({self.baseline_metrics['max_memory_usage_mb']}MB)")
        
        # Check for memory leaks
        leak_tests = [r for r in self.results if r.memory_leak_detected]
        
        # Best and worst performing tests
        response_time_sorted = sorted(self.results, key=lambda x: x.average_response_time if x.average_response_time > 0 else float('inf'))
        throughput_sorted = sorted(self.results, key=lambda x: x.throughput_qps, reverse=True)
        
        return {
            "summary": {
                "total_tests": len(self.results),
                "total_queries": total_queries,
                "success_rate_percent": round(success_rate, 2),
                "overall_avg_response_time_ms": round(overall_avg_response_time, 2),
                "peak_memory_usage_mb": round(peak_memory, 2),
                "total_memory_growth_mb": round(total_memory_growth, 2),
                "memory_leaks_detected": len(leak_tests)
            },
            "performance_analysis": {
                "meets_baseline_requirements": len(performance_issues) == 0,
                "performance_issues": performance_issues,
                "fastest_test": {
                    "name": response_time_sorted[0].test_name,
                    "response_time_ms": round(response_time_sorted[0].average_response_time, 2)
                } if response_time_sorted and response_time_sorted[0].average_response_time > 0 else None,
                "slowest_test": {
                    "name": response_time_sorted[-1].test_name,
                    "response_time_ms": round(response_time_sorted[-1].average_response_time, 2)
                } if response_time_sorted and response_time_sorted[-1].average_response_time > 0 else None,
                "highest_throughput_test": {
                    "name": throughput_sorted[0].test_name,
                    "throughput_qps": round(throughput_sorted[0].throughput_qps, 3)
                } if throughput_sorted else None
            },
            "concurrent_performance": {
                "max_concurrent_clients_tested": max([r.concurrent_clients for r in self.results]),
                "concurrent_performance_stable": all(r.error_count < r.success_count for r in self.results if r.concurrent_clients > 1)
            },
            "memory_analysis": {
                "memory_leaks_detected": len(leak_tests) > 0,
                "leak_test_details": [{
                    "test_name": r.test_name,
                    "memory_growth_mb": round(r.memory_usage_mb, 2)
                } for r in leak_tests] if leak_tests else [],
                "peak_memory_per_test": {r.test_name: round(r.peak_memory_mb, 2) for r in self.results}
            },
            "recommendations": self._generate_recommendations(),
            "detailed_results": [asdict(result) for result in self.results]
        }
    
    def _generate_recommendations(self) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        # Analyze results for recommendations
        avg_response_times = [r.average_response_time for r in self.results if r.average_response_time > 0]
        if avg_response_times:
            overall_avg = statistics.mean(avg_response_times)
            
            if overall_avg > 10000:  # >10 seconds
                recommendations.append("Consider implementing request queuing for better response times")
            
            if overall_avg > 5000:  # >5 seconds
                recommendations.append("Investigate Claude CLI response time optimization")
        
        # Memory recommendations
        peak_memory = max(r.peak_memory_mb for r in self.results)
        if peak_memory > 200:
            recommendations.append("Monitor memory usage - consider implementing memory pooling")
        
        memory_growth = sum(r.memory_usage_mb for r in self.results if r.memory_usage_mb > 0)
        if memory_growth > 100:
            recommendations.append("Significant memory growth detected - review garbage collection strategy")
        
        # Concurrency recommendations
        concurrent_tests = [r for r in self.results if r.concurrent_clients > 1]
        if concurrent_tests:
            error_rates = [r.error_count / (r.success_count + r.error_count) for r in concurrent_tests if (r.success_count + r.error_count) > 0]
            if error_rates and max(error_rates) > 0.1:  # >10% error rate
                recommendations.append("High error rate in concurrent tests - consider connection pooling")
        
        # Error handling recommendations
        total_errors = sum(r.error_count for r in self.results)
        total_operations = sum(r.success_count + r.error_count for r in self.results)
        if total_operations > 0 and (total_errors / total_operations) > 0.05:  # >5% error rate
            recommendations.append("Implement more robust error handling and retry mechanisms")
        
        # Memory leak recommendations
        leak_tests = [r for r in self.results if r.memory_leak_detected]
        if leak_tests:
            recommendations.append("Memory leaks detected - review resource cleanup in client lifecycle")
        
        if not recommendations:
            recommendations.append("SDK performance is within acceptable parameters")
        
        return recommendations

async def main():
    """Run the complete performance test suite"""
    test_suite = PerformanceTestSuite()
    
    try:
        logger.info("Starting Claude Code SDK Performance Test Suite")
        logger.info("=" * 60)
        
        # Run all tests
        results = await test_suite.run_all_tests()
        
        # Generate and display report
        report = test_suite.generate_performance_report()
        
        print("\n" + "=" * 60)
        print("PERFORMANCE TEST RESULTS SUMMARY")
        print("=" * 60)
        
        # Summary
        summary = report['summary']
        print(f"Tests Run: {summary['total_tests']}")
        print(f"Total Queries: {summary['total_queries']}")
        print(f"Success Rate: {summary['success_rate_percent']}%")
        print(f"Avg Response Time: {summary['overall_avg_response_time_ms']}ms")
        print(f"Peak Memory: {summary['peak_memory_usage_mb']}MB")
        print(f"Memory Leaks: {summary['memory_leaks_detected']}")
        
        # Performance Analysis
        analysis = report['performance_analysis']
        print(f"\nMeets Baseline: {analysis['meets_baseline_requirements']}")
        
        if analysis['performance_issues']:
            print("\nPerformance Issues:")
            for issue in analysis['performance_issues']:
                print(f"  - {issue}")
        
        if analysis['fastest_test']:
            print(f"\nFastest Test: {analysis['fastest_test']['name']} ({analysis['fastest_test']['response_time_ms']}ms)")
        
        if analysis['highest_throughput_test']:
            print(f"Highest Throughput: {analysis['highest_throughput_test']['name']} ({analysis['highest_throughput_test']['throughput_qps']:.3f} QPS)")
        
        # Recommendations
        print("\nRecommendations:")
        for rec in report['recommendations']:
            print(f"  - {rec}")
        
        # Save detailed report
        report_file = Path("performance_test_report.json")
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\nDetailed report saved to: {report_file.absolute()}")
        
        # Return exit code based on results
        if not analysis['meets_baseline_requirements'] or summary['memory_leaks_detected'] > 0:
            print("\n❌ PERFORMANCE TESTS FAILED - Issues detected")
            return 1
        else:
            print("\n✅ PERFORMANCE TESTS PASSED - All benchmarks met")
            return 0
        
    except Exception as e:
        logger.error(f"Performance test suite failed: {e}")
        print(f"\n❌ PERFORMANCE TESTS FAILED - {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
