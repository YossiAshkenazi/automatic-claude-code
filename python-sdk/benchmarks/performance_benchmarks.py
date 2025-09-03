#!/usr/bin/env python3
"""
Performance benchmarks for Claude Code Python SDK
Tests initialization, response times, streaming, concurrency, and memory usage
"""

import time
import asyncio
import threading
import statistics
import psutil
import os
import subprocess
import concurrent.futures
from typing import List, Dict, Any, Optional
from contextlib import contextmanager
from dataclasses import dataclass

try:
    from memory_profiler import profile
    MEMORY_PROFILER_AVAILABLE = True
except ImportError:
    MEMORY_PROFILER_AVAILABLE = False
    def profile(func):
        return func

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from claude_code_sdk.client import ClaudeCodeClient
from claude_code_sdk.session import ClaudeSessionOptions

@dataclass
class BenchmarkResult:
    """Result of a single benchmark"""
    name: str
    duration: float
    memory_usage: Optional[float] = None
    success: bool = True
    error_message: Optional[str] = None
    additional_metrics: Optional[Dict[str, Any]] = None

class PerformanceBenchmarkSuite:
    """Comprehensive performance benchmark suite for Claude Code SDK"""
    
    def __init__(self):
        self.results: List[BenchmarkResult] = []
        self.process = psutil.Process()
        
    @contextmanager
    def benchmark_timer(self, name: str):
        """Context manager for timing benchmarks"""
        start_time = time.perf_counter()
        start_memory = self.get_memory_usage()
        
        try:
            yield
            success = True
            error_msg = None
        except Exception as e:
            success = False
            error_msg = str(e)
        
        end_time = time.perf_counter()
        end_memory = self.get_memory_usage()
        
        duration = end_time - start_time
        memory_delta = end_memory - start_memory if start_memory and end_memory else None
        
        result = BenchmarkResult(
            name=name,
            duration=duration,
            memory_usage=memory_delta,
            success=success,
            error_message=error_msg
        )
        self.results.append(result)
        
    def get_memory_usage(self) -> Optional[float]:
        """Get current memory usage in MB"""
        try:
            return self.process.memory_info().rss / 1024 / 1024
        except:
            return None
    
    def benchmark_initialization(self, iterations: int = 10) -> Dict[str, float]:
        """Benchmark SDK initialization times"""
        print("[INIT] Benchmarking SDK Initialization...")
        
        init_times = []
        
        for i in range(iterations):
            with self.benchmark_timer(f"init_{i}"):
                try:
                    client = ClaudeCodeClient()
                    # Verify Claude CLI path resolution
                    _ = client.claude_cli_path
                    init_times.append(self.results[-1].duration)
                except Exception as e:
                    print(f"   [ERROR] Initialization failed: {e}")
                    break
        
        if init_times:
            avg_init = statistics.mean(init_times)
            print(f"   [SUCCESS] Average initialization: {avg_init:.3f}s")
            return {
                'average': avg_init,
                'min': min(init_times),
                'max': max(init_times),
                'std_dev': statistics.stdev(init_times) if len(init_times) > 1 else 0
            }
        else:
            print("   [ERROR] No successful initializations")
            return {'error': 'initialization_failed'}
    
    def benchmark_single_query(self, queries: List[str]) -> Dict[str, Any]:
        """Benchmark single query response times"""
        print("[QUERY] Benchmarking Single Query Performance...")
        
        try:
            client = ClaudeCodeClient(ClaudeSessionOptions(timeout=60))
        except Exception as e:
            print(f"   [ERROR] Client initialization failed: {e}")
            return {'error': f'client_init_failed: {e}'}
        
        query_times = []
        successful_queries = 0
        
        for i, query in enumerate(queries):
            print(f"   Testing query {i+1}/{len(queries)}: {query[:50]}...")
            
            with self.benchmark_timer(f"query_{i}"):
                try:
                    result = client.execute(query, stream=False)
                    if result.success:
                        successful_queries += 1
                        query_times.append(self.results[-1].duration)
                        print(f"   [SUCCESS] Query completed in {self.results[-1].duration:.2f}s")
                    else:
                        print(f"   [ERROR] Query failed: {result.final_message}")
                except Exception as e:
                    print(f"   [ERROR] Query execution error: {e}")
        
        if query_times:
            return {
                'successful_queries': successful_queries,
                'total_queries': len(queries),
                'average_time': statistics.mean(query_times),
                'min_time': min(query_times),
                'max_time': max(query_times),
                'std_dev': statistics.stdev(query_times) if len(query_times) > 1 else 0
            }
        else:
            return {'error': 'no_successful_queries', 'total_queries': len(queries)}
    
    def benchmark_streaming_vs_blocking(self, query: str = "List files in current directory") -> Dict[str, Any]:
        """Compare streaming vs blocking performance"""
        print("[STREAM] Benchmarking Streaming vs Blocking...")
        
        try:
            client = ClaudeCodeClient(ClaudeSessionOptions(timeout=60))
        except Exception as e:
            print(f"   [ERROR] Client initialization failed: {e}")
            return {'error': f'client_init_failed: {e}'}
        
        results = {}
        
        # Test blocking
        with self.benchmark_timer("blocking_query"):
            try:
                result = client.execute(query, stream=False)
                results['blocking'] = {
                    'duration': self.results[-1].duration,
                    'success': result.success,
                    'memory_delta': self.results[-1].memory_usage
                }
                print(f"   [SUCCESS] Blocking: {self.results[-1].duration:.2f}s")
            except Exception as e:
                results['blocking'] = {'error': str(e)}
                print(f"   [ERROR] Blocking failed: {e}")
        
        # Test streaming
        messages_received = 0
        def on_message(message):
            nonlocal messages_received
            messages_received += 1
        
        with self.benchmark_timer("streaming_query"):
            try:
                result = client.execute(query, stream=True, on_message=on_message)
                results['streaming'] = {
                    'duration': self.results[-1].duration,
                    'success': result.success,
                    'messages_received': messages_received,
                    'memory_delta': self.results[-1].memory_usage
                }
                print(f"   [SUCCESS] Streaming: {self.results[-1].duration:.2f}s ({messages_received} messages)")
            except Exception as e:
                results['streaming'] = {'error': str(e)}
                print(f"   [ERROR] Streaming failed: {e}")
        
        return results
    
    def benchmark_concurrent_requests(self, num_concurrent: int, query: str = "What is 2+2?") -> Dict[str, Any]:
        """Test concurrent request handling"""
        print(f"[CONCURRENT] Benchmarking {num_concurrent} Concurrent Requests...")
        
        def execute_query(query_id: int):
            try:
                client = ClaudeCodeClient(ClaudeSessionOptions(timeout=60))
                start_time = time.perf_counter()
                result = client.execute(f"{query} (Request {query_id})", stream=False)
                end_time = time.perf_counter()
                
                return {
                    'query_id': query_id,
                    'duration': end_time - start_time,
                    'success': result.success,
                    'final_message_length': len(result.final_message)
                }
            except Exception as e:
                return {
                    'query_id': query_id,
                    'error': str(e),
                    'success': False
                }
        
        start_time = time.perf_counter()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_concurrent) as executor:
            futures = [executor.submit(execute_query, i) for i in range(num_concurrent)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        end_time = time.perf_counter()
        total_time = end_time - start_time
        
        successful_results = [r for r in results if r.get('success', False)]
        
        if successful_results:
            durations = [r['duration'] for r in successful_results]
            return {
                'total_time': total_time,
                'successful_requests': len(successful_results),
                'failed_requests': num_concurrent - len(successful_results),
                'average_request_time': statistics.mean(durations),
                'min_request_time': min(durations),
                'max_request_time': max(durations),
                'requests_per_second': len(successful_results) / total_time
            }
        else:
            return {
                'error': 'all_requests_failed',
                'total_time': total_time,
                'failed_requests': num_concurrent
            }
    
    @profile
    def benchmark_memory_usage(self, operations: int = 50) -> Dict[str, Any]:
        """Benchmark memory usage with memory_profiler"""
        print(f"[MEMORY] Benchmarking Memory Usage ({operations} operations)...")
        
        if not MEMORY_PROFILER_AVAILABLE:
            print("   [WARNING] memory_profiler not available, skipping detailed memory profiling")
        
        initial_memory = self.get_memory_usage()
        
        try:
            client = ClaudeCodeClient(ClaudeSessionOptions(timeout=30))
        except Exception as e:
            return {'error': f'client_init_failed: {e}'}
        
        memory_samples = []
        
        for i in range(operations):
            try:
                pre_op_memory = self.get_memory_usage()
                
                # Simple operation
                result = client.execute(f"Calculate {i} + 1", stream=False)
                
                post_op_memory = self.get_memory_usage()
                
                if pre_op_memory and post_op_memory:
                    memory_samples.append(post_op_memory - pre_op_memory)
                
                if i % 10 == 0:
                    print(f"   Completed {i+1}/{operations} operations...")
                    
            except Exception as e:
                print(f"   [ERROR] Operation {i} failed: {e}")
                break
        
        final_memory = self.get_memory_usage()
        
        # Force cleanup
        client.kill_all_processes()
        del client
        
        if memory_samples:
            return {
                'initial_memory_mb': initial_memory,
                'final_memory_mb': final_memory,
                'total_memory_delta_mb': final_memory - initial_memory if initial_memory and final_memory else None,
                'average_per_operation_mb': statistics.mean(memory_samples),
                'max_per_operation_mb': max(memory_samples),
                'operations_completed': len(memory_samples)
            }
        else:
            return {'error': 'no_memory_samples_collected'}
    
    def benchmark_cli_comparison(self, query: str = "What is the current directory?") -> Dict[str, Any]:
        """Compare SDK performance vs direct CLI calls"""
        print("[COMPARE] Benchmarking SDK vs Direct CLI Performance...")
        
        results = {}
        
        # Test SDK
        with self.benchmark_timer("sdk_call"):
            try:
                client = ClaudeCodeClient(ClaudeSessionOptions(timeout=30))
                result = client.execute(query, stream=False)
                results['sdk'] = {
                    'duration': self.results[-1].duration,
                    'success': result.success,
                    'memory_delta': self.results[-1].memory_usage
                }
                print(f"   [SUCCESS] SDK: {self.results[-1].duration:.2f}s")
            except Exception as e:
                results['sdk'] = {'error': str(e)}
                print(f"   [ERROR] SDK failed: {e}")
        
        # Test direct CLI (if available)
        with self.benchmark_timer("cli_call"):
            try:
                start_time = time.perf_counter()
                
                # Try to run Claude CLI directly
                process = subprocess.run(
                    ['claude', '--version'],  # Simple version check
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                end_time = time.perf_counter()
                
                if process.returncode == 0:
                    results['cli'] = {
                        'duration': end_time - start_time,
                        'success': True,
                        'stdout': process.stdout.strip()
                    }
                    print(f"   [SUCCESS] CLI: {end_time - start_time:.2f}s")
                else:
                    results['cli'] = {'error': f'CLI exit code: {process.returncode}'}
                    print(f"   [ERROR] CLI failed with exit code: {process.returncode}")
                    
            except subprocess.TimeoutExpired:
                results['cli'] = {'error': 'CLI timeout'}
                print("   [ERROR] CLI timed out")
            except FileNotFoundError:
                results['cli'] = {'error': 'CLI not found'}
                print("   [ERROR] Claude CLI not found")
            except Exception as e:
                results['cli'] = {'error': str(e)}
                print(f"   [ERROR] CLI error: {e}")
        
        return results
    
    def run_all_benchmarks(self) -> Dict[str, Any]:
        """Run all benchmarks and return comprehensive results"""
        print("[COMPLETE] Starting Comprehensive Performance Benchmarks")
        print("=" * 60)
        
        all_results = {}
        
        # 1. Initialization benchmark
        all_results['initialization'] = self.benchmark_initialization(5)
        
        # 2. Single query benchmark
        test_queries = [
            "What is 2 + 2?",
            "List the current directory",
            "Calculate the fibonacci sequence up to 10"
        ]
        all_results['single_query'] = self.benchmark_single_query(test_queries)
        
        # 3. Streaming vs blocking
        all_results['streaming_vs_blocking'] = self.benchmark_streaming_vs_blocking()
        
        # 4. Concurrent requests
        for concurrency in [5, 10, 20]:
            all_results[f'concurrent_{concurrency}'] = self.benchmark_concurrent_requests(concurrency)
        
        # 5. Memory usage
        all_results['memory_usage'] = self.benchmark_memory_usage(25)
        
        # 6. CLI comparison
        all_results['cli_comparison'] = self.benchmark_cli_comparison()
        
        print("\n" + "=" * 60)
        print("[TARGET] Benchmark Suite Completed")
        
        return all_results

def main():
    """Run the benchmark suite"""
    suite = PerformanceBenchmarkSuite()
    results = suite.run_all_benchmarks()
    
    # Generate summary report
    print("\n[SUMMARY] PERFORMANCE SUMMARY")
    print("=" * 60)
    
    for benchmark_name, result in results.items():
        print(f"\n{benchmark_name.upper().replace('_', ' ')}")
        if 'error' in result:
            print(f"   [ERROR] ERROR: {result['error']}")
        else:
            if 'average' in result or 'average_time' in result:
                avg_time = result.get('average', result.get('average_time', 0))
                print(f"   [TIMER]  Average time: {avg_time:.3f}s")
            if 'successful_queries' in result:
                success_rate = (result['successful_queries'] / result['total_queries']) * 100
                print(f"   [SUCCESS] Success rate: {success_rate:.1f}%")
            if 'requests_per_second' in result:
                print(f"   [INIT] Throughput: {result['requests_per_second']:.1f} req/s")
            if 'total_memory_delta_mb' in result and result['total_memory_delta_mb']:
                print(f"   [MEMORY] Memory delta: {result['total_memory_delta_mb']:.1f} MB")
    
    return results

if __name__ == "__main__":
    main()