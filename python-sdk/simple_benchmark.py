#!/usr/bin/env python3
"""
Simple Benchmark for Claude Code SDK Performance Validation
"""

import asyncio
import time
import json
from pathlib import Path
from claude_code_sdk.core.options import ClaudeCodeOptions
from claude_code_sdk.utils.cli_detector import CLIDetector

print("Claude Code SDK Performance Validation")
print("=" * 45)
print()

async def run_benchmarks():
    """Run performance benchmarks"""
    results = {}
    
    # 1. Options Creation Performance
    print("1. Testing Options Creation Performance...")
    start = time.time()
    
    for i in range(500):
        options = ClaudeCodeOptions(
            working_directory=Path.cwd(),
            session_id=f"perf_test_{i}",
            timeout=30 + (i % 60),
            model="sonnet",
            max_turns=10 + (i % 5)
        )
        # Test core functionality
        _ = options.get_cli_args()
        _ = options.to_dict()
        _ = options.get_process_env()
    
    options_time = time.time() - start
    options_rate = 500 / options_time
    
    results['options_creation'] = {
        'configs_created': 500,
        'time_seconds': round(options_time, 3),
        'rate_per_second': round(options_rate, 1),
        'passed': options_rate > 1000  # Target: >1000/sec
    }
    
    print(f"   -> Created 500 configs in {options_time:.3f} seconds")
    print(f"   -> Rate: {options_rate:.0f} configs/second")
    print(f"   -> Status: {'PASS' if results['options_creation']['passed'] else 'FAIL'}")
    print()
    
    # 2. CLI Detection Performance
    print("2. Testing CLI Detection Performance...")
    detector = CLIDetector()
    
    start = time.time()
    cli_path = await detector.detect_claude_cli()
    detection_time = (time.time() - start) * 1000
    
    results['cli_detection'] = {
        'time_ms': round(detection_time, 1),
        'cli_found': cli_path is not None,
        'cli_path': str(cli_path) if cli_path else None,
        'passed': detection_time < 3000  # Target: <3 seconds
    }
    
    print(f"   -> Detection time: {detection_time:.1f}ms")
    print(f"   -> CLI found: {cli_path is not None}")
    if cli_path:
        print(f"   -> Path: {cli_path}")
    print(f"   -> Status: {'PASS' if results['cli_detection']['passed'] else 'FAIL'}")
    print()
    
    # 3. Memory Efficiency Test
    print("3. Testing Memory Efficiency...")
    import psutil
    process = psutil.Process()
    
    start_memory = process.memory_info().rss / 1024 / 1024  # MB
    
    # Create many configuration objects
    config_objects = []
    for i in range(1000):
        options = ClaudeCodeOptions(
            working_directory=Path.cwd(),
            session_id=f"memory_test_{i}",
            timeout=30 + i
        )
        config_objects.append(options)
    
    end_memory = process.memory_info().rss / 1024 / 1024  # MB
    memory_growth = end_memory - start_memory
    memory_per_object = (memory_growth * 1024) / 1000  # KB per object
    
    results['memory_efficiency'] = {
        'objects_created': 1000,
        'memory_growth_mb': round(memory_growth, 2),
        'memory_per_object_kb': round(memory_per_object, 3),
        'passed': memory_per_object < 1.0  # Target: <1KB per object
    }
    
    print(f"   -> 1000 objects used {memory_growth:.2f}MB")
    print(f"   -> Memory per object: {memory_per_object:.3f}KB")
    print(f"   -> Status: {'PASS' if results['memory_efficiency']['passed'] else 'FAIL'}")
    print()
    
    # Clean up memory test objects
    del config_objects
    import gc
    gc.collect()
    
    # 4. Concurrent Operations Test
    print("4. Testing Concurrent Operations...")
    
    async def create_config_task(task_id):
        """Create a configuration in a concurrent task"""
        try:
            options = ClaudeCodeOptions(
                working_directory=Path.cwd(),
                session_id=f"concurrent_{task_id}",
                timeout=30 + task_id
            )
            # Simulate some work
            await asyncio.sleep(0.01)  # 10ms simulated work
            return True
        except Exception:
            return False
    
    start = time.time()
    
    # Run 50 concurrent tasks
    tasks = [create_config_task(i) for i in range(50)]
    task_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    concurrent_time = time.time() - start
    successful_tasks = sum(1 for result in task_results if result is True)
    
    results['concurrent_operations'] = {
        'total_tasks': 50,
        'successful_tasks': successful_tasks,
        'time_seconds': round(concurrent_time, 3),
        'success_rate': successful_tasks / 50,
        'passed': successful_tasks >= 45  # Target: 90% success rate
    }
    
    print(f"   -> {successful_tasks}/50 tasks completed successfully")
    print(f"   -> Total time: {concurrent_time:.3f} seconds")
    print(f"   -> Success rate: {results['concurrent_operations']['success_rate']:.1%}")
    print(f"   -> Status: {'PASS' if results['concurrent_operations']['passed'] else 'FAIL'}")
    print()
    
    return results

def print_summary(results):
    """Print performance summary"""
    print("=" * 45)
    print("PERFORMANCE BENCHMARK RESULTS")
    print("=" * 45)
    
    total_tests = len(results)
    passed_tests = sum(1 for test in results.values() if test['passed'])
    
    print(f"Tests Run: {total_tests}")
    print(f"Tests Passed: {passed_tests}")
    print(f"Success Rate: {passed_tests/total_tests:.1%}")
    print()
    
    # Individual results
    for test_name, test_result in results.items():
        status = "PASS" if test_result['passed'] else "FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    print()
    
    # Performance highlights
    print("PERFORMANCE HIGHLIGHTS:")
    print(f"- Options Creation: {results['options_creation']['rate_per_second']:.0f} configs/sec")
    print(f"- CLI Detection: {results['cli_detection']['time_ms']:.1f}ms")
    print(f"- Memory Efficiency: {results['memory_efficiency']['memory_per_object_kb']:.3f}KB per object")
    print(f"- Concurrent Success: {results['concurrent_operations']['success_rate']:.1%}")
    print()
    
    if passed_tests == total_tests:
        print("OVERALL RESULT: ALL BENCHMARKS PASSED")
        print("STATUS: PRODUCTION READY")
        return True
    else:
        print("OVERALL RESULT: SOME BENCHMARKS FAILED")
        print("STATUS: NEEDS REVIEW")
        return False

async def main():
    """Main benchmark runner"""
    try:
        results = await run_benchmarks()
        all_passed = print_summary(results)
        
        # Save results
        results_file = Path("benchmark_results.json")
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"Detailed results saved to: {results_file}")
        
        return 0 if all_passed else 1
        
    except Exception as e:
        print(f"Benchmark failed: {e}")
        return 1

if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
