#!/usr/bin/env python3
"""
Async performance benchmarks for Claude Code Python SDK
Tests async operations, batch processing, and concurrent execution patterns
"""

import asyncio
import time
import statistics
import concurrent.futures
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from claude_code_sdk.client import ClaudeCodeClient
from claude_code_sdk.session import ClaudeSessionOptions

@dataclass
class AsyncBenchmarkResult:
    """Result of an async benchmark"""
    name: str
    total_duration: float
    avg_operation_time: float
    operations_completed: int
    operations_failed: int
    throughput_ops_per_sec: float
    success_rate: float
    memory_usage_mb: Optional[float] = None

class AsyncBenchmarkSuite:
    """Async performance benchmark suite"""
    
    def __init__(self):
        self.results: List[AsyncBenchmarkResult] = []
    
    async def async_client_wrapper(self, query: str, options: ClaudeSessionOptions) -> Dict[str, Any]:
        """Async wrapper around synchronous Claude client"""
        loop = asyncio.get_event_loop()
        
        def run_sync():
            try:
                client = ClaudeCodeClient(options)
                result = client.execute(query, stream=False)
                return {
                    'success': result.success,
                    'final_message': result.final_message,
                    'execution_time': result.execution_time
                }
            except Exception as e:
                return {
                    'success': False,
                    'error': str(e),
                    'execution_time': 0
                }
        
        return await loop.run_in_executor(None, run_sync)
    
    async def benchmark_async_batch_processing(self, batch_sizes: List[int]) -> Dict[str, Any]:
        """Test async batch processing with different batch sizes"""
        print("📦 Benchmarking Async Batch Processing...")
        
        results = {}
        base_query = "Calculate {} + {}"
        
        for batch_size in batch_sizes:
            print(f"   Testing batch size: {batch_size}")
            
            # Generate queries
            queries = [base_query.format(i, i+1) for i in range(batch_size)]
            options = ClaudeSessionOptions(timeout=30)
            
            start_time = time.perf_counter()
            
            # Execute all queries concurrently
            tasks = [self.async_client_wrapper(query, options) for query in queries]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.perf_counter()
            total_duration = end_time - start_time
            
            # Analyze results
            successful = sum(1 for r in batch_results if isinstance(r, dict) and r.get('success', False))
            failed = batch_size - successful
            
            results[f'batch_{batch_size}'] = {
                'batch_size': batch_size,
                'total_duration': total_duration,
                'successful_operations': successful,
                'failed_operations': failed,
                'throughput_ops_per_sec': successful / total_duration if total_duration > 0 else 0,
                'success_rate': (successful / batch_size) * 100,
                'avg_operation_time': total_duration / batch_size if batch_size > 0 else 0
            }
            
            print(f"   ✅ Batch {batch_size}: {successful}/{batch_size} success, "
                  f"{results[f'batch_{batch_size}']['throughput_ops_per_sec']:.1f} ops/sec")
        
        return results
    
    async def benchmark_concurrent_vs_sequential(self, num_operations: int = 20) -> Dict[str, Any]:
        """Compare concurrent vs sequential execution"""
        print(f"🔄 Benchmarking Concurrent vs Sequential ({num_operations} operations)...")
        
        queries = [f"What is {i} multiplied by 2?" for i in range(num_operations)]
        options = ClaudeSessionOptions(timeout=30)
        results = {}
        
        # Sequential execution
        print("   Running sequential execution...")
        start_time = time.perf_counter()
        sequential_results = []
        
        for query in queries:
            try:
                client = ClaudeCodeClient(options)
                result = client.execute(query, stream=False)
                sequential_results.append({'success': result.success})
            except Exception as e:
                sequential_results.append({'success': False, 'error': str(e)})
        
        sequential_duration = time.perf_counter() - start_time
        sequential_success = sum(1 for r in sequential_results if r.get('success', False))
        
        results['sequential'] = {
            'duration': sequential_duration,
            'successful_operations': sequential_success,
            'throughput_ops_per_sec': sequential_success / sequential_duration,
            'success_rate': (sequential_success / num_operations) * 100
        }
        
        print(f"   ✅ Sequential: {sequential_duration:.2f}s, {results['sequential']['throughput_ops_per_sec']:.1f} ops/sec")
        
        # Concurrent execution
        print("   Running concurrent execution...")
        start_time = time.perf_counter()
        
        tasks = [self.async_client_wrapper(query, options) for query in queries]
        concurrent_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        concurrent_duration = time.perf_counter() - start_time
        concurrent_success = sum(1 for r in concurrent_results if isinstance(r, dict) and r.get('success', False))
        
        results['concurrent'] = {
            'duration': concurrent_duration,
            'successful_operations': concurrent_success,
            'throughput_ops_per_sec': concurrent_success / concurrent_duration,
            'success_rate': (concurrent_success / num_operations) * 100
        }
        
        print(f"   ✅ Concurrent: {concurrent_duration:.2f}s, {results['concurrent']['throughput_ops_per_sec']:.1f} ops/sec")
        
        # Calculate speedup
        if sequential_duration > 0 and concurrent_duration > 0:
            speedup = sequential_duration / concurrent_duration
            results['speedup'] = {
                'time_speedup': speedup,
                'throughput_improvement': (results['concurrent']['throughput_ops_per_sec'] / 
                                         results['sequential']['throughput_ops_per_sec']) - 1
            }
            print(f"   🚀 Speedup: {speedup:.1f}x faster")
        
        return results
    
    async def benchmark_async_streaming_simulation(self, queries: List[str]) -> Dict[str, Any]:
        """Simulate async streaming with callbacks"""
        print("📡 Benchmarking Async Streaming Simulation...")
        
        results = {
            'queries_processed': 0,
            'total_messages_received': 0,
            'avg_response_time': 0,
            'streaming_overhead': 0
        }
        
        async def simulate_streaming_query(query: str, query_id: int) -> Dict[str, Any]:
            messages_received = 0
            
            def message_callback(message):
                nonlocal messages_received
                messages_received += 1
            
            start_time = time.perf_counter()
            
            try:
                client = ClaudeCodeClient(ClaudeSessionOptions(timeout=30))
                result = client.execute(query, stream=True, on_message=message_callback)
                
                end_time = time.perf_counter()
                
                return {
                    'query_id': query_id,
                    'success': result.success,
                    'duration': end_time - start_time,
                    'messages_received': messages_received,
                    'response_length': len(result.final_message)
                }
            except Exception as e:
                return {
                    'query_id': query_id,
                    'success': False,
                    'error': str(e),
                    'messages_received': 0
                }
        
        # Run all streaming queries concurrently
        tasks = [simulate_streaming_query(query, i) for i, query in enumerate(queries)]
        query_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        successful_results = [r for r in query_results if isinstance(r, dict) and r.get('success', False)]
        
        if successful_results:
            durations = [r['duration'] for r in successful_results]
            messages = [r['messages_received'] for r in successful_results]
            
            results.update({
                'queries_processed': len(successful_results),
                'total_queries': len(queries),
                'total_messages_received': sum(messages),
                'avg_response_time': statistics.mean(durations),
                'avg_messages_per_query': statistics.mean(messages) if messages else 0,
                'success_rate': (len(successful_results) / len(queries)) * 100
            })
            
            print(f"   ✅ Processed {len(successful_results)}/{len(queries)} queries")
            print(f"   📬 Received {sum(messages)} total messages")
            print(f"   ⏱️ Average response time: {results['avg_response_time']:.2f}s")
        else:
            results['error'] = 'no_successful_queries'
            print("   ❌ No successful streaming queries")
        
        return results
    
    async def benchmark_rate_limiting_simulation(self, requests_per_second: List[int]) -> Dict[str, Any]:
        """Test performance under different rate limiting scenarios"""
        print("⏳ Benchmarking Rate Limiting Scenarios...")
        
        results = {}
        base_query = "What is the square root of {}?"
        
        for rps in requests_per_second:
            print(f"   Testing {rps} requests per second...")
            
            num_requests = min(rps * 2, 50)  # Run for 2 seconds or max 50 requests
            interval = 1.0 / rps if rps > 0 else 0
            
            async def rate_limited_request(request_id: int) -> Dict[str, Any]:
                # Wait for rate limit
                await asyncio.sleep(request_id * interval)
                
                query = base_query.format(request_id)
                start_time = time.perf_counter()
                
                try:
                    result = await self.async_client_wrapper(query, ClaudeSessionOptions(timeout=30))
                    end_time = time.perf_counter()
                    
                    return {
                        'request_id': request_id,
                        'success': result.get('success', False),
                        'duration': end_time - start_time,
                        'queue_time': request_id * interval
                    }
                except Exception as e:
                    return {
                        'request_id': request_id,
                        'success': False,
                        'error': str(e)
                    }
            
            start_time = time.perf_counter()
            
            # Execute rate-limited requests
            tasks = [rate_limited_request(i) for i in range(num_requests)]
            request_results = await asyncio.gather(*tasks)
            
            total_time = time.perf_counter() - start_time
            successful = sum(1 for r in request_results if r.get('success', False))
            
            results[f'rps_{rps}'] = {
                'target_rps': rps,
                'actual_rps': successful / total_time,
                'total_time': total_time,
                'successful_requests': successful,
                'total_requests': num_requests,
                'success_rate': (successful / num_requests) * 100 if num_requests > 0 else 0
            }
            
            print(f"   ✅ Target: {rps} RPS, Actual: {results[f'rps_{rps}']['actual_rps']:.1f} RPS")
        
        return results
    
    async def run_all_async_benchmarks(self) -> Dict[str, Any]:
        """Run all async benchmarks"""
        print("🚀 Starting Async Performance Benchmarks")
        print("=" * 60)
        
        all_results = {}
        
        # 1. Batch processing
        all_results['batch_processing'] = await self.benchmark_async_batch_processing([5, 10, 20, 50])
        
        # 2. Concurrent vs sequential
        all_results['concurrent_vs_sequential'] = await self.benchmark_concurrent_vs_sequential(15)
        
        # 3. Async streaming simulation
        streaming_queries = [
            "Explain quantum computing",
            "List programming best practices", 
            "Describe machine learning algorithms"
        ]
        all_results['async_streaming'] = await self.benchmark_async_streaming_simulation(streaming_queries)
        
        # 4. Rate limiting simulation
        all_results['rate_limiting'] = await self.benchmark_rate_limiting_simulation([1, 5, 10])
        
        print("\n" + "=" * 60)
        print("🎯 Async Benchmark Suite Completed")
        
        return all_results

async def main():
    """Run the async benchmark suite"""
    suite = AsyncBenchmarkSuite()
    results = await suite.run_all_async_benchmarks()
    
    # Generate summary report
    print("\n📊 ASYNC PERFORMANCE SUMMARY")
    print("=" * 60)
    
    for benchmark_name, result in results.items():
        print(f"\n{benchmark_name.upper().replace('_', ' ')}")
        if 'error' in result:
            print(f"   ❌ ERROR: {result['error']}")
        elif isinstance(result, dict):
            # Handle different result structures
            if 'speedup' in result:
                speedup_data = result['speedup']
                print(f"   🚀 Time speedup: {speedup_data.get('time_speedup', 0):.1f}x")
                print(f"   📈 Throughput improvement: {speedup_data.get('throughput_improvement', 0)*100:.1f}%")
            
            # Show throughput metrics
            for key, value in result.items():
                if isinstance(value, dict) and 'throughput_ops_per_sec' in value:
                    print(f"   {key}: {value['throughput_ops_per_sec']:.1f} ops/sec "
                          f"({value.get('success_rate', 0):.1f}% success)")
    
    return results

if __name__ == "__main__":
    asyncio.run(main())