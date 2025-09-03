#!/usr/bin/env python3
"""
Generate performance charts and visualizations from benchmark results
"""

import json
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

try:
    import seaborn as sns
    sns.set_style("whitegrid")
    SEABORN_AVAILABLE = True
except ImportError:
    SEABORN_AVAILABLE = False

class ChartGenerator:
    """Generate performance visualization charts from benchmark data"""
    
    def __init__(self, results: Dict[str, Any]):
        self.results = results
        self.output_dir = os.path.join(os.path.dirname(__file__), 'charts')
        os.makedirs(self.output_dir, exist_ok=True)
    
    def generate_all_charts(self) -> List[str]:
        """Generate all available charts and return list of files created"""
        chart_files = []
        
        try:
            # Response time chart
            if 'performance' in self.results:
                response_chart = self.create_response_time_chart()
                if response_chart:
                    chart_files.append(response_chart)
            
            # Concurrency performance chart
            if 'performance' in self.results:
                concurrency_chart = self.create_concurrency_chart()
                if concurrency_chart:
                    chart_files.append(concurrency_chart)
            
            # Memory usage chart
            if 'memory' in self.results:
                memory_chart = self.create_memory_usage_chart()
                if memory_chart:
                    chart_files.append(memory_chart)
            
            # Comparison chart
            if 'comparison' in self.results:
                comparison_chart = self.create_comparison_chart()
                if comparison_chart:
                    chart_files.append(comparison_chart)
            
            # Async performance chart
            if 'async' in self.results:
                async_chart = self.create_async_performance_chart()
                if async_chart:
                    chart_files.append(async_chart)
            
            print(f"Generated {len(chart_files)} performance charts in {self.output_dir}")
            
        except Exception as e:
            print(f"Error generating charts: {e}")
        
        return chart_files
    
    def create_response_time_chart(self) -> Optional[str]:
        """Create response time distribution chart"""
        perf_data = self.results.get('performance', {})
        if not perf_data:
            return None
        
        plt.figure(figsize=(12, 8))
        
        # Collect response time data
        response_times = []
        labels = []
        
        # Single query times
        if 'single_query' in perf_data and 'average_time' in perf_data['single_query']:
            response_times.append(perf_data['single_query']['average_time'])
            labels.append('Single Query Avg')
        
        # Streaming vs blocking
        if 'streaming_vs_blocking' in perf_data:
            streaming_data = perf_data['streaming_vs_blocking']
            if 'blocking' in streaming_data and 'duration' in streaming_data['blocking']:
                response_times.append(streaming_data['blocking']['duration'])
                labels.append('Blocking Mode')
            
            if 'streaming' in streaming_data and 'duration' in streaming_data['streaming']:
                response_times.append(streaming_data['streaming']['duration'])
                labels.append('Streaming Mode')
        
        # Concurrent response times (average from different concurrency levels)
        concurrent_times = []
        for key, value in perf_data.items():
            if key.startswith('concurrent_') and isinstance(value, dict):
                if 'successful_requests' in value and 'total_time' in value:
                    avg_time = value['total_time'] / max(value['successful_requests'], 1)
                    concurrent_times.append(avg_time)
        
        if concurrent_times:
            response_times.append(np.mean(concurrent_times))
            labels.append('Concurrent Avg')
        
        if response_times:
            # Create bar chart
            plt.subplot(2, 1, 1)
            bars = plt.bar(labels, response_times, alpha=0.7, color=['skyblue', 'lightgreen', 'coral', 'gold'])
            plt.title('Response Time Comparison', fontsize=14, fontweight='bold')
            plt.ylabel('Time (seconds)')
            plt.xticks(rotation=45, ha='right')
            
            # Add value labels on bars
            for bar, time in zip(bars, response_times):
                plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                        f'{time:.2f}s', ha='center', va='bottom')
            
            # Create histogram if we have multiple data points
            if len(response_times) > 2:
                plt.subplot(2, 1, 2)
                plt.hist(response_times, bins=max(3, len(response_times)//2), alpha=0.7, color='lightblue')
                plt.title('Response Time Distribution', fontsize=14, fontweight='bold')
                plt.xlabel('Time (seconds)')
                plt.ylabel('Frequency')
            
            plt.tight_layout()
            filename = os.path.join(self.output_dir, 'response_times.png')
            plt.savefig(filename, dpi=300, bbox_inches='tight')
            plt.close()
            
            return filename
        
        plt.close()
        return None
    
    def create_concurrency_chart(self) -> Optional[str]:
        """Create concurrency performance chart"""
        perf_data = self.results.get('performance', {})
        if not perf_data:
            return None
        
        # Extract concurrency data
        concurrency_levels = []
        throughput_values = []
        success_rates = []
        
        for key, value in perf_data.items():
            if key.startswith('concurrent_') and isinstance(value, dict):
                try:
                    level = int(key.split('_')[1])
                    throughput = value.get('requests_per_second', 0)
                    
                    if throughput > 0:
                        concurrency_levels.append(level)
                        throughput_values.append(throughput)
                        
                        # Calculate success rate
                        total_requests = value.get('failed_requests', 0) + value.get('successful_requests', 0)
                        success_rate = (value.get('successful_requests', 0) / max(total_requests, 1)) * 100
                        success_rates.append(success_rate)
                except (ValueError, KeyError):
                    continue
        
        if concurrency_levels:
            plt.figure(figsize=(12, 8))
            
            # Throughput chart
            plt.subplot(2, 1, 1)
            plt.plot(concurrency_levels, throughput_values, marker='o', linewidth=2, markersize=8, color='blue')
            plt.title('Throughput vs Concurrency Level', fontsize=14, fontweight='bold')
            plt.xlabel('Concurrent Requests')
            plt.ylabel('Throughput (requests/second)')
            plt.grid(True, alpha=0.3)
            
            # Add value labels
            for x, y in zip(concurrency_levels, throughput_values):
                plt.annotate(f'{y:.1f}', (x, y), textcoords="offset points", 
                           xytext=(0,10), ha='center')
            
            # Success rate chart
            plt.subplot(2, 1, 2)
            bars = plt.bar(concurrency_levels, success_rates, alpha=0.7, color='green')
            plt.title('Success Rate vs Concurrency Level', fontsize=14, fontweight='bold')
            plt.xlabel('Concurrent Requests')
            plt.ylabel('Success Rate (%)')
            plt.ylim(0, 105)
            
            # Add value labels on bars
            for bar, rate in zip(bars, success_rates):
                plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                        f'{rate:.1f}%', ha='center', va='bottom')
            
            plt.tight_layout()
            filename = os.path.join(self.output_dir, 'concurrency_performance.png')
            plt.savefig(filename, dpi=300, bbox_inches='tight')
            plt.close()
            
            return filename
        
        plt.close()
        return None
    
    def create_memory_usage_chart(self) -> Optional[str]:
        """Create memory usage analysis chart"""
        memory_data = self.results.get('memory', {})
        if not memory_data:
            return None
        
        plt.figure(figsize=(14, 10))
        
        # Memory metrics to visualize
        metrics = []
        values = []
        categories = []
        
        # Client initialization memory
        if 'client_initialization' in memory_data:
            client_data = memory_data['client_initialization']
            if 'avg_memory_per_client_mb' in client_data:
                metrics.append('Avg Memory/Client')
                values.append(client_data['avg_memory_per_client_mb'])
                categories.append('Initialization')
        
        # Session memory
        if 'session_memory' in memory_data:
            session_data = memory_data['session_memory']
            if 'avg_memory_per_session_mb' in session_data:
                metrics.append('Avg Memory/Session')
                values.append(session_data['avg_memory_per_session_mb'])
                categories.append('Sessions')
        
        # Long running memory delta
        if 'long_running' in memory_data:
            lr_data = memory_data['long_running']
            if 'total_memory_change_mb' in lr_data:
                metrics.append('Long-Running Delta')
                values.append(abs(lr_data['total_memory_change_mb']))
                categories.append('Long-Running')
        
        # Concurrent memory overhead
        if 'concurrent_memory' in memory_data:
            conc_data = memory_data['concurrent_memory']
            if 'memory_per_thread_mb' in conc_data:
                metrics.append('Memory/Thread')
                values.append(conc_data['memory_per_thread_mb'])
                categories.append('Concurrent')
        
        if metrics:
            # Memory usage bar chart
            plt.subplot(2, 2, 1)
            colors = ['skyblue', 'lightgreen', 'coral', 'gold']
            bars = plt.bar(metrics, values, color=colors[:len(metrics)], alpha=0.7)
            plt.title('Memory Usage by Component', fontsize=12, fontweight='bold')
            plt.ylabel('Memory (MB)')
            plt.xticks(rotation=45, ha='right')
            
            # Add value labels
            for bar, value in zip(bars, values):
                plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05,
                        f'{value:.2f}MB', ha='center', va='bottom', fontsize=10)
        
        # Memory growth over time (if available)
        if 'long_running' in memory_data:
            lr_data = memory_data['long_running']
            plt.subplot(2, 2, 2)
            
            growth_rate = lr_data.get('growth_rate_mb_per_minute', 0)
            duration = lr_data.get('duration_seconds', 60) / 60  # Convert to minutes
            
            # Simulate memory timeline
            time_points = np.linspace(0, duration, 10)
            memory_points = [lr_data.get('initial_memory_mb', 0) + (growth_rate * t) for t in time_points]
            
            plt.plot(time_points, memory_points, marker='o', color='red', linewidth=2)
            plt.title(f'Memory Growth Over Time\n({growth_rate:+.2f} MB/min)', fontsize=12, fontweight='bold')
            plt.xlabel('Time (minutes)')
            plt.ylabel('Memory (MB)')
            plt.grid(True, alpha=0.3)
        
        # Memory leak detection summary
        plt.subplot(2, 2, 3)
        leak_data = []
        leak_labels = []
        
        for test_name, test_data in memory_data.items():
            if isinstance(test_data, dict):
                if 'memory_leak_detected' in test_data:
                    leak_detected = test_data['memory_leak_detected']
                    leak_data.append(1 if leak_detected else 0)
                    leak_labels.append(test_name.replace('_', ' ').title())
        
        if leak_data:
            colors = ['red' if leak else 'green' for leak in leak_data]
            bars = plt.bar(leak_labels, leak_data, color=colors, alpha=0.7)
            plt.title('Memory Leak Detection Results', fontsize=12, fontweight='bold')
            plt.ylabel('Leak Detected (1=Yes, 0=No)')
            plt.ylim(-0.1, 1.1)
            plt.xticks(rotation=45, ha='right')
        
        # Memory efficiency scores
        plt.subplot(2, 2, 4)
        efficiency_scores = []
        efficiency_labels = []
        
        for test_name, test_data in memory_data.items():
            if isinstance(test_data, dict):
                if 'memory_efficiency_score' in test_data:
                    score = test_data['memory_efficiency_score']
                    efficiency_scores.append(score)
                    efficiency_labels.append(test_name.replace('_', ' ').title())
                elif 'concurrent_efficiency_score' in test_data:
                    score = test_data['concurrent_efficiency_score']
                    efficiency_scores.append(score)
                    efficiency_labels.append(test_name.replace('_', ' ').title())
        
        if efficiency_scores:
            bars = plt.bar(efficiency_labels, efficiency_scores, alpha=0.7, color='purple')
            plt.title('Memory Efficiency Scores', fontsize=12, fontweight='bold')
            plt.ylabel('Efficiency Score (0-1)')
            plt.ylim(0, 1.1)
            plt.xticks(rotation=45, ha='right')
            
            # Add score labels
            for bar, score in zip(bars, efficiency_scores):
                plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                        f'{score:.2f}', ha='center', va='bottom', fontsize=10)
        
        plt.tight_layout()
        filename = os.path.join(self.output_dir, 'memory_analysis.png')
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        return filename
    
    def create_comparison_chart(self) -> Optional[str]:
        """Create SDK vs CLI comparison chart"""
        comparison_data = self.results.get('comparison', {})
        if not comparison_data:
            return None
        
        plt.figure(figsize=(12, 8))
        
        # Model performance comparison
        if 'model_performance' in comparison_data:
            model_data = comparison_data['model_performance']
            models = []
            times = []
            
            for model, data in model_data.items():
                if isinstance(data, dict) and data.get('success', False):
                    models.append(model.title())
                    times.append(data['duration'])
            
            if models:
                plt.subplot(2, 2, 1)
                bars = plt.bar(models, times, alpha=0.7, color=['blue', 'green', 'orange'][:len(models)])
                plt.title('Model Performance Comparison', fontsize=12, fontweight='bold')
                plt.ylabel('Response Time (seconds)')
                
                # Add value labels
                for bar, time in zip(bars, times):
                    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                            f'{time:.2f}s', ha='center', va='bottom')
        
        # Streaming vs Blocking comparison
        if 'streaming_vs_blocking' in comparison_data:
            stream_data = comparison_data['streaming_vs_blocking']
            if 'comparison' in stream_data:
                comp = stream_data['comparison']
                
                plt.subplot(2, 2, 2)
                modes = ['Blocking', 'Streaming']
                avg_times = [comp.get('blocking_avg_time', 0), comp.get('streaming_avg_time', 0)]
                
                bars = plt.bar(modes, avg_times, alpha=0.7, color=['skyblue', 'lightcoral'])
                plt.title('Streaming vs Blocking Performance', fontsize=12, fontweight='bold')
                plt.ylabel('Average Time (seconds)')
                
                # Add value labels
                for bar, time in zip(bars, avg_times):
                    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                            f'{time:.2f}s', ha='center', va='bottom')
        
        # CLI vs SDK comparison (if available)
        if 'cli_comparison' in comparison_data:
            cli_data = comparison_data['cli_comparison']
            
            plt.subplot(2, 2, 3)
            methods = []
            times = []
            
            if 'sdk' in cli_data and 'duration' in cli_data['sdk']:
                methods.append('SDK')
                times.append(cli_data['sdk']['duration'])
            
            if 'cli' in cli_data and 'duration' in cli_data['cli']:
                methods.append('CLI')
                times.append(cli_data['cli']['duration'])
            
            if methods:
                bars = plt.bar(methods, times, alpha=0.7, color=['blue', 'green'])
                plt.title('SDK vs CLI Performance', fontsize=12, fontweight='bold')
                plt.ylabel('Execution Time (seconds)')
                
                # Add value labels
                for bar, time in zip(bars, times):
                    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.001,
                            f'{time:.3f}s', ha='center', va='bottom')
        
        # Initialization overhead
        if 'initialization_overhead' in comparison_data:
            init_data = comparison_data['initialization_overhead']
            if 'summary' in init_data:
                summary = init_data['summary']
                
                plt.subplot(2, 2, 4)
                init_types = []
                init_times = []
                
                if 'cold_start_avg' in summary:
                    init_types.append('Cold Start')
                    init_times.append(summary['cold_start_avg'])
                
                if 'warm_start_avg' in summary:
                    init_types.append('Warm Start')
                    init_times.append(summary['warm_start_avg'])
                
                if 'cli_startup_avg' in summary:
                    init_types.append('CLI Startup')
                    init_times.append(summary['cli_startup_avg'])
                
                if init_types:
                    bars = plt.bar(init_types, init_times, alpha=0.7, 
                                 color=['red', 'orange', 'yellow'][:len(init_types)])
                    plt.title('Initialization Overhead', fontsize=12, fontweight='bold')
                    plt.ylabel('Time (seconds)')
                    plt.xticks(rotation=45, ha='right')
                    
                    # Add value labels
                    for bar, time in zip(bars, init_times):
                        plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.001,
                                f'{time:.3f}s', ha='center', va='bottom')
        
        plt.tight_layout()
        filename = os.path.join(self.output_dir, 'comparison_analysis.png')
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        return filename
    
    def create_async_performance_chart(self) -> Optional[str]:
        """Create async performance visualization"""
        async_data = self.results.get('async', {})
        if not async_data:
            return None
        
        plt.figure(figsize=(12, 8))
        
        # Batch processing performance
        if 'batch_processing' in async_data:
            batch_data = async_data['batch_processing']
            batch_sizes = []
            throughputs = []
            
            for key, value in batch_data.items():
                if key.startswith('batch_') and isinstance(value, dict):
                    try:
                        size = value['batch_size']
                        throughput = value.get('throughput_ops_per_sec', 0)
                        if throughput > 0:
                            batch_sizes.append(size)
                            throughputs.append(throughput)
                    except (KeyError, ValueError):
                        continue
            
            if batch_sizes:
                plt.subplot(2, 2, 1)
                plt.plot(batch_sizes, throughputs, marker='o', linewidth=2, markersize=8, color='blue')
                plt.title('Async Batch Processing Performance', fontsize=12, fontweight='bold')
                plt.xlabel('Batch Size')
                plt.ylabel('Throughput (ops/second)')
                plt.grid(True, alpha=0.3)
                
                # Add value labels
                for x, y in zip(batch_sizes, throughputs):
                    plt.annotate(f'{y:.1f}', (x, y), textcoords="offset points", 
                               xytext=(0,10), ha='center')
        
        # Concurrent vs Sequential speedup
        if 'concurrent_vs_sequential' in async_data:
            comp_data = async_data['concurrent_vs_sequential']
            
            plt.subplot(2, 2, 2)
            methods = ['Sequential', 'Concurrent']
            times = [comp_data.get('sequential', {}).get('duration', 0),
                    comp_data.get('concurrent', {}).get('duration', 0)]
            
            if all(t > 0 for t in times):
                bars = plt.bar(methods, times, alpha=0.7, color=['red', 'green'])
                plt.title('Sequential vs Concurrent Execution', fontsize=12, fontweight='bold')
                plt.ylabel('Total Time (seconds)')
                
                # Add value labels and speedup annotation
                for bar, time in zip(bars, times):
                    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                            f'{time:.2f}s', ha='center', va='bottom')
                
                if 'speedup' in comp_data:
                    speedup = comp_data['speedup'].get('time_speedup', 1)
                    plt.text(0.5, max(times) * 0.8, f'{speedup:.1f}x speedup', 
                           ha='center', va='center', fontsize=12, fontweight='bold',
                           bbox=dict(boxstyle="round,pad=0.3", facecolor="yellow", alpha=0.7))
        
        # Success rates comparison
        plt.subplot(2, 2, 3)
        success_data = []
        success_labels = []
        
        if 'concurrent_vs_sequential' in async_data:
            comp_data = async_data['concurrent_vs_sequential']
            if 'sequential' in comp_data:
                success_data.append(comp_data['sequential'].get('success_rate', 0))
                success_labels.append('Sequential')
            if 'concurrent' in comp_data:
                success_data.append(comp_data['concurrent'].get('success_rate', 0))
                success_labels.append('Concurrent')
        
        if success_data:
            bars = plt.bar(success_labels, success_data, alpha=0.7, color=['orange', 'purple'])
            plt.title('Success Rate Comparison', fontsize=12, fontweight='bold')
            plt.ylabel('Success Rate (%)')
            plt.ylim(0, 105)
            
            # Add value labels
            for bar, rate in zip(bars, success_data):
                plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                        f'{rate:.1f}%', ha='center', va='bottom')
        
        # Rate limiting performance
        if 'rate_limiting' in async_data:
            rate_data = async_data['rate_limiting']
            target_rates = []
            actual_rates = []
            
            for key, value in rate_data.items():
                if key.startswith('rps_') and isinstance(value, dict):
                    try:
                        target = value['target_rps']
                        actual = value.get('actual_rps', 0)
                        if actual > 0:
                            target_rates.append(target)
                            actual_rates.append(actual)
                    except (KeyError, ValueError):
                        continue
            
            if target_rates:
                plt.subplot(2, 2, 4)
                
                # Plot target vs actual rates
                x_pos = np.arange(len(target_rates))
                width = 0.35
                
                plt.bar(x_pos - width/2, target_rates, width, label='Target RPS', alpha=0.7, color='lightblue')
                plt.bar(x_pos + width/2, actual_rates, width, label='Actual RPS', alpha=0.7, color='lightgreen')
                
                plt.title('Rate Limiting Performance', fontsize=12, fontweight='bold')
                plt.xlabel('Test Scenarios')
                plt.ylabel('Requests Per Second')
                plt.xticks(x_pos, [f'Test {i+1}' for i in range(len(target_rates))])
                plt.legend()
        
        plt.tight_layout()
        filename = os.path.join(self.output_dir, 'async_performance.png')
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        return filename

def load_benchmark_results(results_file: str) -> Optional[Dict[str, Any]]:
    """Load benchmark results from JSON file"""
    try:
        with open(results_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading results file {results_file}: {e}")
        return None

def main():
    """Generate charts from benchmark results"""
    print("Performance Chart Generator for Claude Code Python SDK")
    print("=" * 60)
    
    # Look for recent benchmark results
    benchmark_dir = os.path.dirname(__file__)
    result_files = [f for f in os.listdir(benchmark_dir) if f.startswith('benchmark_results_') and f.endswith('.json')]
    
    if not result_files:
        print("No benchmark result files found. Run benchmarks first:")
        print("  python -m benchmarks.run_benchmarks")
        return
    
    # Use most recent results file
    latest_file = max(result_files, key=lambda f: os.path.getmtime(os.path.join(benchmark_dir, f)))
    results_path = os.path.join(benchmark_dir, latest_file)
    
    print(f"Loading results from: {latest_file}")
    
    results = load_benchmark_results(results_path)
    if not results:
        print("Failed to load benchmark results")
        return
    
    # Generate charts
    generator = ChartGenerator(results)
    chart_files = generator.generate_all_charts()
    
    print(f"\nGenerated {len(chart_files)} performance charts:")
    for chart_file in chart_files:
        print(f"  - {os.path.basename(chart_file)}")
    
    print(f"\nCharts saved in: {generator.output_dir}")

if __name__ == "__main__":
    main()