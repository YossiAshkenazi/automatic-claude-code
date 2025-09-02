#!/usr/bin/env python3
"""
Memory usage benchmarks for Claude Code Python SDK
Tests memory consumption, leaks, and cleanup efficiency
"""

import gc
import time
import psutil
import os
import threading
from typing import List, Dict, Any, Optional
from contextlib import contextmanager
import sys
import weakref

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from claude_code_sdk.client import ClaudeCodeClient
from claude_code_sdk.session import ClaudeSessionOptions, ClaudeSession

try:
    from memory_profiler import LineProfiler, profile
    import tracemalloc
    MEMORY_TOOLS_AVAILABLE = True
except ImportError:
    MEMORY_TOOLS_AVAILABLE = False
    def profile(func):
        return func

class MemoryBenchmarkSuite:
    """Memory usage benchmark suite"""
    
    def __init__(self):
        self.process = psutil.Process()
        
    def get_memory_info(self) -> Dict[str, float]:
        """Get current memory usage info"""
        try:
            memory_info = self.process.memory_info()
            return {
                'rss_mb': memory_info.rss / 1024 / 1024,  # Resident Set Size
                'vms_mb': memory_info.vms / 1024 / 1024,  # Virtual Memory Size
                'percent': self.process.memory_percent(),
                'available_mb': psutil.virtual_memory().available / 1024 / 1024
            }
        except Exception as e:
            return {'error': str(e)}
    
    @contextmanager
    def memory_monitor(self, operation_name: str):
        """Context manager for monitoring memory usage during operations"""
        gc.collect()  # Clean up before measurement
        initial_memory = self.get_memory_info()
        
        if MEMORY_TOOLS_AVAILABLE:
            tracemalloc.start()
        
        start_time = time.perf_counter()
        
        try:
            yield initial_memory
        finally:
            end_time = time.perf_counter()
            
            if MEMORY_TOOLS_AVAILABLE:
                current, peak = tracemalloc.get_traced_memory()
                tracemalloc.stop()
                tracemalloc_data = {
                    'current_mb': current / 1024 / 1024,
                    'peak_mb': peak / 1024 / 1024
                }
            else:
                tracemalloc_data = {}
            
            final_memory = self.get_memory_info()
            
            print(f"   Memory for {operation_name}:")
            print(f"     Initial: {initial_memory.get('rss_mb', 0):.1f} MB")
            print(f"     Final: {final_memory.get('rss_mb', 0):.1f} MB")
            print(f"     Delta: {final_memory.get('rss_mb', 0) - initial_memory.get('rss_mb', 0):+.1f} MB")
            if tracemalloc_data:
                print(f"     Peak traced: {tracemalloc_data['peak_mb']:.1f} MB")
            print(f"     Duration: {end_time - start_time:.2f}s")
    
    def benchmark_client_initialization_memory(self, iterations: int = 50) -> Dict[str, Any]:
        """Test memory usage during client initialization"""
        print(f"🚀 Benchmarking Client Initialization Memory ({iterations} iterations)...")
        
        with self.memory_monitor("client_initialization") as initial_memory:
            clients = []
            memory_samples = []
            
            for i in range(iterations):
                pre_init_memory = self.get_memory_info()
                
                try:
                    client = ClaudeCodeClient()
                    clients.append(client)
                    
                    post_init_memory = self.get_memory_info()
                    memory_delta = (post_init_memory.get('rss_mb', 0) - 
                                   pre_init_memory.get('rss_mb', 0))
                    memory_samples.append(memory_delta)
                    
                    if (i + 1) % 10 == 0:
                        print(f"     Created {i + 1}/{iterations} clients...")
                        
                except Exception as e:
                    print(f"     ❌ Failed to create client {i}: {e}")
                    break
            
            # Clean up clients
            cleanup_start = time.perf_counter()
            for client in clients:
                try:
                    client.kill_all_processes()
                    del client
                except Exception as e:
                    print(f"     ⚠️ Cleanup warning: {e}")
            
            clients.clear()
            gc.collect()
            cleanup_time = time.perf_counter() - cleanup_start
            
            final_memory = self.get_memory_info()
            
            return {
                'iterations_completed': len(memory_samples),
                'avg_memory_per_client_mb': sum(memory_samples) / len(memory_samples) if memory_samples else 0,
                'max_memory_per_client_mb': max(memory_samples) if memory_samples else 0,
                'total_memory_delta_mb': (final_memory.get('rss_mb', 0) - 
                                         initial_memory.get('rss_mb', 0)),
                'cleanup_time_seconds': cleanup_time,
                'memory_leak_detected': abs(final_memory.get('rss_mb', 0) - 
                                          initial_memory.get('rss_mb', 0)) > 1.0  # >1MB difference suggests leak
            }
    
    def benchmark_session_memory_usage(self, num_sessions: int = 20) -> Dict[str, Any]:
        """Test memory usage with multiple sessions"""
        print(f"📝 Benchmarking Session Memory Usage ({num_sessions} sessions)...")
        
        with self.memory_monitor("session_management") as initial_memory:
            sessions = []
            memory_samples = []
            
            # Create sessions
            for i in range(num_sessions):
                pre_session_memory = self.get_memory_info()
                
                try:
                    options = ClaudeSessionOptions(max_turns=5, timeout=30)
                    session = ClaudeSession(options)
                    
                    # Add some messages to the session
                    session.add_user_message(f"Test message {i}")
                    session.add_assistant_message(f"Response to test {i}")
                    
                    sessions.append(session)
                    
                    post_session_memory = self.get_memory_info()
                    memory_delta = (post_session_memory.get('rss_mb', 0) - 
                                   pre_session_memory.get('rss_mb', 0))
                    memory_samples.append(memory_delta)
                    
                except Exception as e:
                    print(f"     ❌ Failed to create session {i}: {e}")
            
            # Test session operations
            operations_memory = []
            for i, session in enumerate(sessions[:10]):  # Test first 10 sessions
                pre_op_memory = self.get_memory_info()
                
                try:
                    # Add more messages
                    for j in range(5):
                        session.add_user_message(f"Operation {j} in session {i}")
                        session.add_assistant_message(f"Response {j} in session {i}")
                    
                    # Get session info
                    _ = session.get_session_info()
                    _ = session.get_messages()
                    
                    post_op_memory = self.get_memory_info()
                    op_memory_delta = (post_op_memory.get('rss_mb', 0) - 
                                      pre_op_memory.get('rss_mb', 0))
                    operations_memory.append(op_memory_delta)
                    
                except Exception as e:
                    print(f"     ⚠️ Session operation failed: {e}")
            
            # Clean up
            for session in sessions:
                session.clear()
            sessions.clear()
            gc.collect()
            
            final_memory = self.get_memory_info()
            
            return {
                'sessions_created': len(memory_samples),
                'avg_memory_per_session_mb': sum(memory_samples) / len(memory_samples) if memory_samples else 0,
                'max_memory_per_session_mb': max(memory_samples) if memory_samples else 0,
                'avg_operation_memory_mb': sum(operations_memory) / len(operations_memory) if operations_memory else 0,
                'total_memory_delta_mb': (final_memory.get('rss_mb', 0) - 
                                         initial_memory.get('rss_mb', 0)),
                'operations_tested': len(operations_memory),
                'memory_efficiency_score': min(1.0, 1.0 / (sum(memory_samples) / len(memory_samples) + 0.1)) if memory_samples else 0
            }
    
    def benchmark_long_running_memory(self, duration_seconds: int = 60) -> Dict[str, Any]:
        """Test memory usage over a long-running period"""
        print(f"⏳ Benchmarking Long-Running Memory Usage ({duration_seconds}s)...")
        
        with self.memory_monitor("long_running_test") as initial_memory:
            memory_snapshots = []
            client = None
            
            try:
                client = ClaudeCodeClient(ClaudeSessionOptions(timeout=30))
                start_time = time.perf_counter()
                operation_count = 0
                
                while (time.perf_counter() - start_time) < duration_seconds:
                    try:
                        # Perform periodic operations
                        query = f"Calculate {operation_count} plus {operation_count + 1}"
                        result = client.execute(query, stream=False)
                        
                        operation_count += 1
                        
                        # Take memory snapshot every 10 operations
                        if operation_count % 10 == 0:
                            current_memory = self.get_memory_info()
                            memory_snapshots.append({
                                'operation_count': operation_count,
                                'memory_mb': current_memory.get('rss_mb', 0),
                                'timestamp': time.perf_counter() - start_time
                            })
                            
                            print(f"     Operations: {operation_count}, "
                                  f"Memory: {current_memory.get('rss_mb', 0):.1f} MB")
                        
                        # Brief pause to simulate realistic usage
                        time.sleep(0.1)
                        
                    except Exception as e:
                        print(f"     ⚠️ Operation {operation_count} failed: {e}")
                        break
                
                # Final cleanup
                if client:
                    client.kill_all_processes()
                
                final_memory = self.get_memory_info()
                
                # Analyze memory trends
                if len(memory_snapshots) >= 2:
                    initial_op_memory = memory_snapshots[0]['memory_mb']
                    final_op_memory = memory_snapshots[-1]['memory_mb']
                    memory_trend = final_op_memory - initial_op_memory
                    
                    # Calculate memory growth rate
                    duration_minutes = duration_seconds / 60.0
                    growth_rate_mb_per_minute = memory_trend / duration_minutes if duration_minutes > 0 else 0
                else:
                    memory_trend = 0
                    growth_rate_mb_per_minute = 0
                
                return {
                    'duration_seconds': duration_seconds,
                    'operations_completed': operation_count,
                    'operations_per_second': operation_count / duration_seconds if duration_seconds > 0 else 0,
                    'memory_snapshots': len(memory_snapshots),
                    'initial_memory_mb': initial_memory.get('rss_mb', 0),
                    'final_memory_mb': final_memory.get('rss_mb', 0),
                    'total_memory_change_mb': final_memory.get('rss_mb', 0) - initial_memory.get('rss_mb', 0),
                    'memory_trend_mb': memory_trend,
                    'growth_rate_mb_per_minute': growth_rate_mb_per_minute,
                    'memory_stable': abs(growth_rate_mb_per_minute) < 1.0  # <1MB/minute growth is stable
                }
                
            except Exception as e:
                return {'error': str(e)}
            finally:
                if client:
                    try:
                        client.kill_all_processes()
                        del client
                    except Exception as e:
                        print(f"     ⚠️ Final cleanup warning: {e}")
                gc.collect()
    
    def benchmark_concurrent_memory_usage(self, num_threads: int = 10) -> Dict[str, Any]:
        """Test memory usage under concurrent operations"""
        print(f"🔄 Benchmarking Concurrent Memory Usage ({num_threads} threads)...")
        
        with self.memory_monitor("concurrent_operations") as initial_memory:
            thread_results = []
            threads = []
            
            def worker_thread(thread_id: int):
                try:
                    client = ClaudeCodeClient(ClaudeSessionOptions(timeout=30))
                    
                    for operation in range(5):  # 5 operations per thread
                        query = f"Thread {thread_id}, operation {operation}: calculate {operation}^2"
                        result = client.execute(query, stream=False)
                        
                        if not result.success:
                            break
                    
                    client.kill_all_processes()
                    thread_results.append({
                        'thread_id': thread_id,
                        'success': True,
                        'operations_completed': operation + 1
                    })
                    
                except Exception as e:
                    thread_results.append({
                        'thread_id': thread_id,
                        'success': False,
                        'error': str(e)
                    })
            
            # Start threads
            for i in range(num_threads):
                thread = threading.Thread(target=worker_thread, args=(i,))
                thread.start()
                threads.append(thread)
            
            # Monitor memory during execution
            memory_snapshots = []
            while any(thread.is_alive() for thread in threads):
                current_memory = self.get_memory_info()
                active_threads = sum(1 for thread in threads if thread.is_alive())
                memory_snapshots.append({
                    'memory_mb': current_memory.get('rss_mb', 0),
                    'active_threads': active_threads
                })
                time.sleep(1)
            
            # Wait for all threads to complete
            for thread in threads:
                thread.join(timeout=60)
            
            final_memory = self.get_memory_info()
            
            # Analyze results
            successful_threads = sum(1 for r in thread_results if r.get('success', False))
            peak_memory = max(s['memory_mb'] for s in memory_snapshots) if memory_snapshots else 0
            
            return {
                'threads_launched': num_threads,
                'threads_successful': successful_threads,
                'total_operations': sum(r.get('operations_completed', 0) for r in thread_results),
                'initial_memory_mb': initial_memory.get('rss_mb', 0),
                'peak_memory_mb': peak_memory,
                'final_memory_mb': final_memory.get('rss_mb', 0),
                'memory_overhead_mb': peak_memory - initial_memory.get('rss_mb', 0),
                'memory_per_thread_mb': (peak_memory - initial_memory.get('rss_mb', 0)) / num_threads if num_threads > 0 else 0,
                'memory_snapshots_taken': len(memory_snapshots),
                'concurrent_efficiency_score': successful_threads / num_threads if num_threads > 0 else 0
            }
    
    def run_all_memory_benchmarks(self) -> Dict[str, Any]:
        """Run all memory benchmarks"""
        print("🧠 Starting Memory Usage Benchmarks")
        print("=" * 60)
        
        all_results = {}
        
        # 1. Client initialization memory
        all_results['client_initialization'] = self.benchmark_client_initialization_memory(30)
        
        # 2. Session memory usage
        all_results['session_memory'] = self.benchmark_session_memory_usage(15)
        
        # 3. Long-running memory test
        all_results['long_running'] = self.benchmark_long_running_memory(30)
        
        # 4. Concurrent memory usage
        all_results['concurrent_memory'] = self.benchmark_concurrent_memory_usage(5)
        
        print("\n" + "=" * 60)
        print("🎯 Memory Benchmark Suite Completed")
        
        return all_results

def main():
    """Run the memory benchmark suite"""
    if not MEMORY_TOOLS_AVAILABLE:
        print("⚠️ Warning: memory_profiler and tracemalloc not fully available")
        print("   Install with: pip install memory_profiler")
        print("   Some detailed memory analysis may be limited\n")
    
    suite = MemoryBenchmarkSuite()
    results = suite.run_all_memory_benchmarks()
    
    # Generate summary report
    print("\n📊 MEMORY USAGE SUMMARY")
    print("=" * 60)
    
    for benchmark_name, result in results.items():
        print(f"\n{benchmark_name.upper().replace('_', ' ')}")
        if 'error' in result:
            print(f"   ❌ ERROR: {result['error']}")
        else:
            if 'avg_memory_per_client_mb' in result:
                print(f"   💾 Avg memory per client: {result['avg_memory_per_client_mb']:.2f} MB")
            if 'total_memory_delta_mb' in result:
                delta = result['total_memory_delta_mb']
                print(f"   📊 Total memory delta: {delta:+.1f} MB")
            if 'memory_leak_detected' in result:
                leak_status = "DETECTED" if result['memory_leak_detected'] else "None"
                print(f"   🔍 Memory leaks: {leak_status}")
            if 'growth_rate_mb_per_minute' in result:
                rate = result['growth_rate_mb_per_minute']
                print(f"   📈 Growth rate: {rate:+.2f} MB/minute")
            if 'memory_stable' in result:
                stability = "STABLE" if result['memory_stable'] else "UNSTABLE"
                print(f"   ⚖️ Memory stability: {stability}")
    
    return results

if __name__ == "__main__":
    main()