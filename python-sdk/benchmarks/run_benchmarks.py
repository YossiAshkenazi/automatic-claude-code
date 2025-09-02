#!/usr/bin/env python3
"""
Main benchmark runner for Claude Code Python SDK
Orchestrates all benchmark suites and generates comprehensive reports
"""

import json
import time
import sys
import os
import asyncio
from datetime import datetime
from typing import Dict, Any

# Add SDK to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from benchmarks.performance_benchmarks import PerformanceBenchmarkSuite
from benchmarks.async_benchmarks import AsyncBenchmarkSuite
from benchmarks.memory_benchmarks import MemoryBenchmarkSuite
from benchmarks.comparison_benchmarks import ComparisonBenchmarkSuite

class BenchmarkRunner:
    """Main benchmark orchestrator"""
    
    def __init__(self):
        self.start_time = datetime.now()
        self.results = {}
        
    def run_all_benchmarks(self, include_async: bool = True, 
                          include_memory: bool = True,
                          include_comparison: bool = True) -> Dict[str, Any]:
        """Run all benchmark suites"""
        print("CLAUDE CODE PYTHON SDK BENCHMARK SUITE")
        print("=" * 80)
        print(f"Started at: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        
        # 1. Performance Benchmarks (Core functionality)
        print("\n[1] RUNNING PERFORMANCE BENCHMARKS")
        performance_suite = PerformanceBenchmarkSuite()
        self.results['performance'] = performance_suite.run_all_benchmarks()
        
        # 2. Async Benchmarks
        if include_async:
            print("\n[2] RUNNING ASYNC BENCHMARKS")
            async_suite = AsyncBenchmarkSuite()
            self.results['async'] = asyncio.run(async_suite.run_all_async_benchmarks())
        
        # 3. Memory Benchmarks
        if include_memory:
            print("\n[3] RUNNING MEMORY BENCHMARKS")
            memory_suite = MemoryBenchmarkSuite()
            self.results['memory'] = memory_suite.run_all_memory_benchmarks()
        
        # 4. Comparison Benchmarks
        if include_comparison:
            print("\n[4] RUNNING COMPARISON BENCHMARKS")
            comparison_suite = ComparisonBenchmarkSuite()
            self.results['comparison'] = comparison_suite.run_all_comparison_benchmarks()
        
        self.end_time = datetime.now()
        total_duration = (self.end_time - self.start_time).total_seconds()
        
        self.results['meta'] = {
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'total_duration_seconds': total_duration,
            'suites_run': {
                'performance': True,
                'async': include_async,
                'memory': include_memory,
                'comparison': include_comparison
            }
        }
        
        print(f"\n[COMPLETE] ALL BENCHMARKS COMPLETED")
        print(f"Total Duration: {total_duration:.1f} seconds")
        
        return self.results
    
    def generate_performance_report(self) -> str:
        """Generate a comprehensive performance report"""
        report = []
        report.append("# Claude Code Python SDK Performance Report")
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Executive Summary
        report.append("## Executive Summary")
        report.append("")
        
        # Get key metrics
        perf_results = self.results.get('performance', {})
        async_results = self.results.get('async', {})
        memory_results = self.results.get('memory', {})
        comparison_results = self.results.get('comparison', {})
        
        # SDK Performance
        if 'single_query' in perf_results and 'average_time' in perf_results['single_query']:
            avg_response_time = perf_results['single_query']['average_time']
            report.append(f"- **Average Query Response Time**: {avg_response_time:.2f} seconds")
        
        if 'initialization' in perf_results and 'average' in perf_results['initialization']:
            init_time = perf_results['initialization']['average']
            report.append(f"- **SDK Initialization Time**: {init_time:.3f} seconds")
        
        # Concurrent Performance
        concurrent_keys = [k for k in perf_results.keys() if k.startswith('concurrent_')]
        if concurrent_keys:
            best_throughput = 0
            best_concurrency = 0
            for key in concurrent_keys:
                if 'requests_per_second' in perf_results[key]:
                    rps = perf_results[key]['requests_per_second']
                    if rps > best_throughput:
                        best_throughput = rps
                        best_concurrency = int(key.split('_')[1])
            
            if best_throughput > 0:
                report.append(f"- **Peak Throughput**: {best_throughput:.1f} requests/second ({best_concurrency} concurrent)")
        
        # Memory Usage
        if 'client_initialization' in memory_results:
            mem_per_client = memory_results['client_initialization'].get('avg_memory_per_client_mb', 0)
            if mem_per_client > 0:
                report.append(f"- **Memory per Client**: {mem_per_client:.1f} MB")
        
        # Async Performance
        if 'concurrent_vs_sequential' in async_results and 'speedup' in async_results['concurrent_vs_sequential']:
            speedup = async_results['concurrent_vs_sequential']['speedup'].get('time_speedup', 1)
            report.append(f"- **Async Speedup**: {speedup:.1f}x faster than sequential")
        
        report.append("")
        
        # Detailed Results
        report.append("## Detailed Results")
        report.append("")
        
        # Performance Benchmarks
        if perf_results:
            report.append("### Performance Benchmarks")
            report.append("")
            
            for bench_name, result in perf_results.items():
                if isinstance(result, dict) and 'error' not in result:
                    report.append(f"#### {bench_name.replace('_', ' ').title()}")
                    report.append("")
                    
                    if 'average_time' in result:
                        report.append(f"- Average Time: {result['average_time']:.3f}s")
                    if 'success_rate' in result:
                        success_rate = (result['successful_queries'] / result['total_queries']) * 100
                        report.append(f"- Success Rate: {success_rate:.1f}%")
                    if 'requests_per_second' in result:
                        report.append(f"- Throughput: {result['requests_per_second']:.1f} requests/second")
                    
                    report.append("")
        
        # Memory Results
        if memory_results:
            report.append("### Memory Benchmarks")
            report.append("")
            
            for bench_name, result in memory_results.items():
                if isinstance(result, dict) and 'error' not in result:
                    report.append(f"#### {bench_name.replace('_', ' ').title()}")
                    report.append("")
                    
                    if 'total_memory_delta_mb' in result:
                        delta = result['total_memory_delta_mb']
                        report.append(f"- Memory Delta: {delta:+.1f} MB")
                    if 'memory_leak_detected' in result:
                        leak_status = "Yes" if result['memory_leak_detected'] else "No"
                        report.append(f"- Memory Leaks Detected: {leak_status}")
                    if 'growth_rate_mb_per_minute' in result:
                        rate = result['growth_rate_mb_per_minute']
                        report.append(f"- Growth Rate: {rate:+.2f} MB/minute")
                    
                    report.append("")
        
        # Recommendations
        report.append("## Recommendations")
        report.append("")
        
        recommendations = self._generate_recommendations()
        for rec in recommendations:
            report.append(f"- {rec}")
        
        report.append("")
        
        # Optimization Opportunities
        report.append("## Optimization Opportunities")
        report.append("")
        
        optimizations = self._generate_optimizations()
        for opt in optimizations:
            report.append(f"- {opt}")
        
        return "\n".join(report)
    
    def _generate_recommendations(self) -> list:
        """Generate performance recommendations based on results"""
        recommendations = []
        
        perf_results = self.results.get('performance', {})
        memory_results = self.results.get('memory', {})
        async_results = self.results.get('async', {})
        
        # Response time recommendations
        if 'single_query' in perf_results:
            avg_time = perf_results['single_query'].get('average_time', 0)
            if avg_time > 10:
                recommendations.append("Consider implementing query caching for response times >10s")
            elif avg_time > 5:
                recommendations.append("Monitor response times; consider timeout optimization")
        
        # Concurrency recommendations
        concurrent_results = {k: v for k, v in perf_results.items() if k.startswith('concurrent_')}
        if concurrent_results:
            best_rps = max([r.get('requests_per_second', 0) for r in concurrent_results.values()])
            if best_rps < 1:
                recommendations.append("Low concurrent throughput; consider connection pooling")
            elif best_rps > 10:
                recommendations.append("Excellent concurrent performance; suitable for production use")
        
        # Memory recommendations
        if 'client_initialization' in memory_results:
            leak_detected = memory_results['client_initialization'].get('memory_leak_detected', False)
            if leak_detected:
                recommendations.append("Memory leak detected in client initialization; review cleanup procedures")
        
        if 'long_running' in memory_results:
            growth_rate = memory_results['long_running'].get('growth_rate_mb_per_minute', 0)
            if abs(growth_rate) > 5:
                recommendations.append("High memory growth rate detected; implement periodic cleanup")
        
        # Async recommendations
        if 'concurrent_vs_sequential' in async_results:
            speedup = async_results['concurrent_vs_sequential'].get('speedup', {}).get('time_speedup', 1)
            if speedup < 2:
                recommendations.append("Limited async performance benefit; review concurrent execution patterns")
            elif speedup > 5:
                recommendations.append("Excellent async performance; prioritize concurrent execution for batch operations")
        
        return recommendations
    
    def _generate_optimizations(self) -> list:
        """Generate optimization opportunities"""
        optimizations = []
        
        perf_results = self.results.get('performance', {})
        memory_results = self.results.get('memory', {})
        
        # Initialization optimizations
        if 'initialization' in perf_results:
            init_time = perf_results['initialization'].get('average', 0)
            if init_time > 0.1:
                optimizations.append("SDK initialization >100ms; consider lazy loading or client pooling")
        
        # Streaming optimizations
        if 'streaming_vs_blocking' in perf_results:
            streaming_data = perf_results['streaming_vs_blocking'].get('streaming', {})
            blocking_data = perf_results['streaming_vs_blocking'].get('blocking', {})
            
            if streaming_data.get('duration', 0) > blocking_data.get('duration', 0):
                optimizations.append("Streaming slower than blocking; review message handling overhead")
        
        # Memory optimizations
        if 'concurrent_memory' in memory_results:
            memory_per_thread = memory_results['concurrent_memory'].get('memory_per_thread_mb', 0)
            if memory_per_thread > 50:
                optimizations.append("High memory usage per thread; consider lighter client instances")
        
        # Timeout optimizations
        comparison_results = self.results.get('comparison', {})
        if 'timeout_configs' in comparison_results:
            timeout_results = comparison_results['timeout_configs']
            efficient_timeouts = [k for k, v in timeout_results.items() 
                                if isinstance(v, dict) and v.get('efficiency_ratio', 0) > 0.8]
            if efficient_timeouts:
                optimizations.append("Optimize timeout settings based on actual usage patterns")
        
        return optimizations
    
    def save_results(self, filename: str = None) -> str:
        """Save benchmark results to JSON file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"benchmark_results_{timestamp}.json"
        
        filepath = os.path.join(os.path.dirname(__file__), filename)
        
        with open(filepath, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        return filepath
    
    def save_report(self, filename: str = None) -> str:
        """Save performance report to markdown file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"performance_report_{timestamp}.md"
        
        filepath = os.path.join(os.path.dirname(__file__), filename)
        report = self.generate_performance_report()
        
        with open(filepath, 'w') as f:
            f.write(report)
        
        return filepath

def main():
    """Main benchmark execution"""
    print("Claude Code Python SDK Benchmark Suite")
    print("Starting comprehensive performance testing...")
    
    runner = BenchmarkRunner()
    
    try:
        # Run all benchmarks
        results = runner.run_all_benchmarks(
            include_async=True,
            include_memory=True,
            include_comparison=True
        )
        
        # Save results
        results_file = runner.save_results()
        report_file = runner.save_report()
        
        print(f"\n[SUMMARY] BENCHMARK SUMMARY")
        print("=" * 50)
        
        # Quick summary
        perf_results = results.get('performance', {})
        if 'single_query' in perf_results:
            avg_time = perf_results['single_query'].get('average_time', 0)
            success_rate = (perf_results['single_query'].get('successful_queries', 0) / 
                          perf_results['single_query'].get('total_queries', 1)) * 100
            print(f"Average Response Time: {avg_time:.2f}s")
            print(f"Success Rate: {success_rate:.1f}%")
        
        concurrent_keys = [k for k in perf_results.keys() if k.startswith('concurrent_')]
        if concurrent_keys:
            best_throughput = max([perf_results[k].get('requests_per_second', 0) 
                                 for k in concurrent_keys])
            print(f"Peak Throughput: {best_throughput:.1f} requests/second")
        
        memory_results = results.get('memory', {})
        if 'client_initialization' in memory_results:
            leak_detected = memory_results['client_initialization'].get('memory_leak_detected', False)
            print(f"Memory Leaks: {'Detected' if leak_detected else 'None detected'}")
        
        print(f"\nResults saved to: {results_file}")
        print(f"Report saved to: {report_file}")
        
        return results
        
    except KeyboardInterrupt:
        print("\n[WARNING] Benchmarks interrupted by user")
        return None
    except Exception as e:
        print(f"\n[ERROR] Benchmark failed with error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    main()