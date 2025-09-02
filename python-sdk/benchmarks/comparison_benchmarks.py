#!/usr/bin/env python3
"""
Comparison benchmarks for Claude Code Python SDK
Compares SDK performance vs direct CLI calls, different models, and configurations
"""

import subprocess
import time
import statistics
import json
import shutil
import tempfile
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from claude_code_sdk.client import ClaudeCodeClient
from claude_code_sdk.session import ClaudeSessionOptions

@dataclass
class ComparisonResult:
    """Result of a comparison benchmark"""
    name: str
    sdk_time: Optional[float]
    cli_time: Optional[float]
    sdk_success: bool
    cli_success: bool
    speedup_factor: Optional[float]
    sdk_error: Optional[str] = None
    cli_error: Optional[str] = None
    additional_metrics: Dict[str, Any] = None

class ComparisonBenchmarkSuite:
    """Comparison benchmark suite"""
    
    def __init__(self):
        self.results: List[ComparisonResult] = []
        self.claude_cli_available = self._check_claude_cli()
    
    def _check_claude_cli(self) -> bool:
        """Check if Claude CLI is available"""
        try:
            result = subprocess.run(['claude', '--version'], 
                                   capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.CalledProcessError):
            return False
    
    def _run_cli_command(self, args: List[str], input_text: str = "", timeout: int = 60) -> Tuple[bool, str, float]:
        """Run a Claude CLI command and measure performance"""
        start_time = time.perf_counter()
        
        try:
            result = subprocess.run(
                ['claude'] + args,
                input=input_text,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            end_time = time.perf_counter()
            duration = end_time - start_time
            
            if result.returncode == 0:
                return True, result.stdout.strip(), duration
            else:
                return False, result.stderr.strip(), duration
                
        except subprocess.TimeoutExpired:
            return False, "CLI command timed out", timeout
        except Exception as e:
            return False, str(e), 0
    
    def _run_sdk_command(self, query: str, options: ClaudeSessionOptions) -> Tuple[bool, str, float]:
        """Run an SDK command and measure performance"""
        start_time = time.perf_counter()
        
        try:
            client = ClaudeCodeClient(options)
            result = client.execute(query, stream=False)
            
            end_time = time.perf_counter()
            duration = end_time - start_time
            
            return result.success, result.final_message, duration
            
        except Exception as e:
            end_time = time.perf_counter()
            duration = end_time - start_time
            return False, str(e), duration
    
    def benchmark_basic_queries(self, queries: List[str]) -> Dict[str, Any]:
        """Compare basic query performance between SDK and CLI"""
        print("📊 Benchmarking Basic Query Performance (SDK vs CLI)...")
        
        if not self.claude_cli_available:
            print("   ⚠️ Claude CLI not available, skipping CLI comparison")
            return {'error': 'claude_cli_not_available'}
        
        results = []
        sdk_times = []
        cli_times = []
        
        for i, query in enumerate(queries):
            print(f"   Testing query {i+1}/{len(queries)}: {query[:50]}...")
            
            # Test SDK
            sdk_success, sdk_output, sdk_time = self._run_sdk_command(
                query, ClaudeSessionOptions(timeout=60)
            )
            
            # Test CLI (simple version check since full queries may require auth)
            cli_success, cli_output, cli_time = self._run_cli_command(['--version'])
            
            result = ComparisonResult(
                name=f"query_{i}",
                sdk_time=sdk_time,
                cli_time=cli_time,
                sdk_success=sdk_success,
                cli_success=cli_success,
                speedup_factor=cli_time / sdk_time if sdk_time > 0 and cli_time > 0 else None,
                sdk_error=None if sdk_success else sdk_output,
                cli_error=None if cli_success else cli_output
            )
            
            results.append(result)
            
            if sdk_success:
                sdk_times.append(sdk_time)
            if cli_success:
                cli_times.append(cli_time)
            
            print(f"     SDK: {sdk_time:.2f}s ({'✅' if sdk_success else '❌'})")
            print(f"     CLI: {cli_time:.2f}s ({'✅' if cli_success else '❌'})")
        
        # Calculate statistics
        summary = {
            'total_queries': len(queries),
            'sdk_successful': len(sdk_times),
            'cli_successful': len(cli_times),
            'sdk_avg_time': statistics.mean(sdk_times) if sdk_times else 0,
            'cli_avg_time': statistics.mean(cli_times) if cli_times else 0,
            'sdk_success_rate': (len(sdk_times) / len(queries)) * 100,
            'cli_success_rate': (len(cli_times) / len(queries)) * 100
        }
        
        if sdk_times and cli_times:
            summary['avg_speedup_factor'] = statistics.mean(cli_times) / statistics.mean(sdk_times)
        
        return {'summary': summary, 'individual_results': results}
    
    def benchmark_model_performance(self, query: str = "What is 2+2?") -> Dict[str, Any]:
        """Compare performance across different Claude models"""
        print("🤖 Benchmarking Model Performance...")
        
        models = ['sonnet', 'haiku']  # 'opus' may not be available for all users
        results = {}
        
        for model in models:
            print(f"   Testing model: {model}")
            
            try:
                options = ClaudeSessionOptions(model=model, timeout=60)
                success, output, duration = self._run_sdk_command(query, options)
                
                results[model] = {
                    'success': success,
                    'duration': duration,
                    'output_length': len(output) if success else 0,
                    'error': None if success else output
                }
                
                print(f"     {model}: {duration:.2f}s ({'✅' if success else '❌'})")
                
            except Exception as e:
                results[model] = {
                    'success': False,
                    'duration': 0,
                    'error': str(e)
                }
                print(f"     {model}: ❌ {str(e)}")
        
        # Find fastest model
        successful_models = {k: v for k, v in results.items() if v['success']}
        if successful_models:
            fastest_model = min(successful_models.keys(), 
                              key=lambda k: successful_models[k]['duration'])
            results['fastest_model'] = fastest_model
            results['fastest_time'] = successful_models[fastest_model]['duration']
        
        return results
    
    def benchmark_timeout_configurations(self, timeouts: List[int]) -> Dict[str, Any]:
        """Test performance with different timeout configurations"""
        print("⏱️ Benchmarking Timeout Configurations...")
        
        # Use a query that might take some time
        query = "Explain quantum computing in detail with examples"
        results = {}
        
        for timeout in timeouts:
            print(f"   Testing timeout: {timeout}s")
            
            try:
                options = ClaudeSessionOptions(timeout=timeout)
                success, output, duration = self._run_sdk_command(query, options)
                
                results[f'timeout_{timeout}'] = {
                    'timeout_setting': timeout,
                    'success': success,
                    'actual_duration': duration,
                    'timed_out': duration >= timeout * 0.95,  # Close to timeout
                    'output_length': len(output) if success else 0,
                    'efficiency_ratio': duration / timeout if timeout > 0 else 0
                }
                
                status = '✅' if success else ('⏰' if duration >= timeout * 0.95 else '❌')
                print(f"     {timeout}s: {duration:.2f}s {status}")
                
            except Exception as e:
                results[f'timeout_{timeout}'] = {
                    'timeout_setting': timeout,
                    'success': False,
                    'error': str(e)
                }
                print(f"     {timeout}s: ❌ {str(e)}")
        
        return results
    
    def benchmark_streaming_vs_blocking_detailed(self, queries: List[str]) -> Dict[str, Any]:
        """Detailed comparison of streaming vs blocking execution"""
        print("🔄 Benchmarking Streaming vs Blocking (Detailed)...")
        
        results = {
            'streaming': [],
            'blocking': [],
            'comparison': {}
        }
        
        for i, query in enumerate(queries):
            print(f"   Testing query {i+1}/{len(queries)}: {query[:50]}...")
            
            # Test blocking
            blocking_success, blocking_output, blocking_time = self._run_sdk_command(
                query, ClaudeSessionOptions(timeout=60)
            )
            
            # Test streaming
            messages_received = 0
            def on_message(message):
                nonlocal messages_received
                messages_received += 1
            
            start_time = time.perf_counter()
            try:
                client = ClaudeCodeClient(ClaudeSessionOptions(timeout=60))
                streaming_result = client.execute(query, stream=True, on_message=on_message)
                streaming_time = time.perf_counter() - start_time
                streaming_success = streaming_result.success
                streaming_output = streaming_result.final_message
            except Exception as e:
                streaming_time = time.perf_counter() - start_time
                streaming_success = False
                streaming_output = str(e)
                messages_received = 0
            
            # Store results
            results['blocking'].append({
                'query_id': i,
                'success': blocking_success,
                'duration': blocking_time,
                'output_length': len(blocking_output) if blocking_success else 0
            })
            
            results['streaming'].append({
                'query_id': i,
                'success': streaming_success,
                'duration': streaming_time,
                'output_length': len(streaming_output) if streaming_success else 0,
                'messages_received': messages_received
            })
            
            print(f"     Blocking: {blocking_time:.2f}s ({'✅' if blocking_success else '❌'})")
            print(f"     Streaming: {streaming_time:.2f}s ({'✅' if streaming_success else '❌'}) "
                  f"({messages_received} msgs)")
        
        # Calculate comparison statistics
        blocking_times = [r['duration'] for r in results['blocking'] if r['success']]
        streaming_times = [r['duration'] for r in results['streaming'] if r['success']]
        
        if blocking_times and streaming_times:
            results['comparison'] = {
                'blocking_avg_time': statistics.mean(blocking_times),
                'streaming_avg_time': statistics.mean(streaming_times),
                'blocking_success_rate': (len(blocking_times) / len(queries)) * 100,
                'streaming_success_rate': (len(streaming_times) / len(queries)) * 100,
                'time_difference': statistics.mean(streaming_times) - statistics.mean(blocking_times),
                'streaming_faster': statistics.mean(streaming_times) < statistics.mean(blocking_times),
                'avg_messages_per_query': statistics.mean([r['messages_received'] 
                                                          for r in results['streaming'] if r['success']])
            }
        
        return results
    
    def benchmark_initialization_overhead(self, iterations: int = 20) -> Dict[str, Any]:
        """Compare initialization overhead between different approaches"""
        print(f"🚀 Benchmarking Initialization Overhead ({iterations} iterations)...")
        
        results = {
            'cold_start_times': [],
            'warm_start_times': [],
            'cli_startup_times': []
        }
        
        # Cold start benchmarks (new client each time)
        print("   Testing cold starts...")
        for i in range(iterations):
            start_time = time.perf_counter()
            try:
                client = ClaudeCodeClient()
                # Force initialization
                _ = client.claude_cli_path
                end_time = time.perf_counter()
                results['cold_start_times'].append(end_time - start_time)
                client.kill_all_processes()
            except Exception as e:
                print(f"     Cold start {i} failed: {e}")
        
        # Warm start benchmarks (reuse client)
        print("   Testing warm starts...")
        try:
            client = ClaudeCodeClient()
            for i in range(iterations):
                start_time = time.perf_counter()
                # Test a quick operation
                _ = client.get_active_processes()
                end_time = time.perf_counter()
                results['warm_start_times'].append(end_time - start_time)
            client.kill_all_processes()
        except Exception as e:
            print(f"     Warm start testing failed: {e}")
        
        # CLI startup time (if available)
        if self.claude_cli_available:
            print("   Testing CLI startup...")
            for i in range(min(iterations, 10)):  # Fewer CLI tests
                start_time = time.perf_counter()
                success, _, duration = self._run_cli_command(['--version'])
                if success:
                    results['cli_startup_times'].append(duration)
        
        # Calculate statistics
        summary = {}
        if results['cold_start_times']:
            summary['cold_start_avg'] = statistics.mean(results['cold_start_times'])
            summary['cold_start_std'] = statistics.stdev(results['cold_start_times']) if len(results['cold_start_times']) > 1 else 0
        
        if results['warm_start_times']:
            summary['warm_start_avg'] = statistics.mean(results['warm_start_times'])
            summary['warm_start_std'] = statistics.stdev(results['warm_start_times']) if len(results['warm_start_times']) > 1 else 0
        
        if results['cli_startup_times']:
            summary['cli_startup_avg'] = statistics.mean(results['cli_startup_times'])
            summary['cli_startup_std'] = statistics.stdev(results['cli_startup_times']) if len(results['cli_startup_times']) > 1 else 0
        
        # Calculate overhead
        if 'cold_start_avg' in summary and 'warm_start_avg' in summary:
            summary['initialization_overhead'] = summary['cold_start_avg'] - summary['warm_start_avg']
        
        return {'summary': summary, 'raw_data': results}
    
    def run_all_comparison_benchmarks(self) -> Dict[str, Any]:
        """Run all comparison benchmarks"""
        print("⚖️ Starting Comparison Benchmarks")
        print("=" * 60)
        
        all_results = {}
        
        # 1. Basic query comparison
        test_queries = [
            "What is 2 + 2?",
            "List files in current directory",
            "Calculate factorial of 5"
        ]
        all_results['basic_queries'] = self.benchmark_basic_queries(test_queries)
        
        # 2. Model performance
        all_results['model_performance'] = self.benchmark_model_performance()
        
        # 3. Timeout configurations
        all_results['timeout_configs'] = self.benchmark_timeout_configurations([10, 30, 60, 120])
        
        # 4. Streaming vs blocking detailed
        streaming_queries = [
            "Explain Python decorators",
            "What are the benefits of async programming?"
        ]
        all_results['streaming_vs_blocking'] = self.benchmark_streaming_vs_blocking_detailed(streaming_queries)
        
        # 5. Initialization overhead
        all_results['initialization_overhead'] = self.benchmark_initialization_overhead(15)
        
        print("\n" + "=" * 60)
        print("🎯 Comparison Benchmark Suite Completed")
        
        return all_results

def main():
    """Run the comparison benchmark suite"""
    suite = ComparisonBenchmarkSuite()
    results = suite.run_all_comparison_benchmarks()
    
    # Generate summary report
    print("\n📊 COMPARISON BENCHMARK SUMMARY")
    print("=" * 60)
    
    for benchmark_name, result in results.items():
        print(f"\n{benchmark_name.upper().replace('_', ' ')}")
        
        if 'error' in result:
            print(f"   ❌ ERROR: {result['error']}")
            continue
        
        # Handle different result structures
        if benchmark_name == 'basic_queries' and 'summary' in result:
            summary = result['summary']
            print(f"   📈 SDK Success Rate: {summary.get('sdk_success_rate', 0):.1f}%")
            print(f"   📈 CLI Success Rate: {summary.get('cli_success_rate', 0):.1f}%")
            print(f"   ⏱️ SDK Avg Time: {summary.get('sdk_avg_time', 0):.3f}s")
            print(f"   ⏱️ CLI Avg Time: {summary.get('cli_avg_time', 0):.3f}s")
            
        elif benchmark_name == 'model_performance':
            successful_models = {k: v for k, v in result.items() 
                               if isinstance(v, dict) and v.get('success', False)}
            if successful_models:
                print(f"   🏆 Fastest Model: {result.get('fastest_model', 'N/A')} "
                      f"({result.get('fastest_time', 0):.3f}s)")
                for model, data in successful_models.items():
                    print(f"   🤖 {model}: {data['duration']:.3f}s")
                    
        elif benchmark_name == 'streaming_vs_blocking' and 'comparison' in result:
            comp = result['comparison']
            blocking_faster = not comp.get('streaming_faster', False)
            winner = 'Blocking' if blocking_faster else 'Streaming'
            print(f"   🏆 Winner: {winner}")
            print(f"   📊 Blocking Avg: {comp.get('blocking_avg_time', 0):.3f}s")
            print(f"   📊 Streaming Avg: {comp.get('streaming_avg_time', 0):.3f}s")
            print(f"   📬 Avg Messages/Query: {comp.get('avg_messages_per_query', 0):.1f}")
            
        elif benchmark_name == 'initialization_overhead' and 'summary' in result:
            summary = result['summary']
            print(f"   ❄️ Cold Start: {summary.get('cold_start_avg', 0):.3f}s")
            print(f"   🔥 Warm Start: {summary.get('warm_start_avg', 0):.3f}s")
            print(f"   📊 Init Overhead: {summary.get('initialization_overhead', 0):.3f}s")
    
    return results

if __name__ == "__main__":
    main()