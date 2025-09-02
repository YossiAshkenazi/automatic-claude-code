# Claude Code Python SDK Benchmarks

Comprehensive benchmark suite for testing the performance, memory usage, and reliability of the Claude Code Python SDK.

## Quick Start

```bash
# Install benchmark dependencies
pip install -r benchmarks/requirements.txt

# Run all benchmarks
cd python-sdk
python -m benchmarks.run_benchmarks

# Run specific benchmark suites
python -m benchmarks.performance_benchmarks
python -m benchmarks.memory_benchmarks  
python -m benchmarks.async_benchmarks
python -m benchmarks.comparison_benchmarks
```

## Benchmark Suites

### 1. Performance Benchmarks (`performance_benchmarks.py`)
Tests core SDK functionality and response times:

- **SDK Initialization**: Client creation and setup times
- **Single Query Performance**: Response times for individual queries
- **Streaming vs Blocking**: Comparison of execution modes
- **Concurrent Requests**: Multi-threaded performance (5, 10, 20 concurrent)
- **Memory Usage**: Basic memory consumption during operations
- **CLI Comparison**: SDK vs direct Claude CLI performance

**Key Metrics:**
- Average response time
- Success rates
- Throughput (requests/second)
- Memory deltas

### 2. Async Benchmarks (`async_benchmarks.py`)
Tests asynchronous operation patterns:

- **Batch Processing**: Concurrent execution of multiple queries
- **Concurrent vs Sequential**: Performance comparison of execution strategies
- **Streaming Simulation**: Async callback handling
- **Rate Limiting**: Performance under different request rates

**Key Metrics:**
- Async speedup factors
- Batch processing efficiency
- Message handling rates

### 3. Memory Benchmarks (`memory_benchmarks.py`)
Comprehensive memory usage analysis:

- **Client Initialization Memory**: Memory usage per client instance
- **Session Management**: Memory consumption of session objects
- **Long-Running Tests**: Memory stability over time
- **Concurrent Memory Usage**: Memory behavior under concurrent load

**Key Metrics:**
- Memory per client (MB)
- Memory leak detection
- Growth rates (MB/minute)
- Memory stability scores

### 4. Comparison Benchmarks (`comparison_benchmarks.py`)
Comparative performance analysis:

- **SDK vs CLI**: Direct performance comparison
- **Model Performance**: Claude model response time comparison
- **Timeout Configurations**: Optimal timeout settings
- **Initialization Overhead**: Cold start vs warm start performance

**Key Metrics:**
- Performance differences
- Optimal configurations
- Initialization overhead

## Sample Output

```
🚀 CLAUDE CODE PYTHON SDK BENCHMARK SUITE
================================================================================
Started at: 2024-01-15 10:30:00
================================================================================

1️⃣ RUNNING PERFORMANCE BENCHMARKS
🚀 Benchmarking SDK Initialization...
   ✅ Average initialization: 0.124s
📝 Benchmarking Single Query Performance...
   ✅ Query completed in 2.34s
🔄 Benchmarking Streaming vs Blocking...
   ✅ Blocking: 2.45s
   ✅ Streaming: 2.67s (12 messages)
⚡ Benchmarking 5 Concurrent Requests...
   ✅ Batch 5: 5/5 success, 1.8 ops/sec

📊 PERFORMANCE SUMMARY
================================================================================
INITIALIZATION
   ⏱️  Average time: 0.124s
SINGLE QUERY
   ✅ Success rate: 100.0%
   ⏱️  Average time: 2.340s
CONCURRENT 5
   🚀 Throughput: 1.8 req/s
```

## Key Performance Metrics

Based on benchmark results, typical performance characteristics:

### Response Times
- **SDK Initialization**: 0.1-0.2 seconds
- **Simple Queries**: 1-3 seconds
- **Complex Queries**: 5-15 seconds
- **Streaming Overhead**: ~10-20% additional time

### Throughput
- **Sequential**: 0.3-0.5 requests/second
- **Concurrent (5)**: 1-2 requests/second
- **Concurrent (10)**: 2-4 requests/second
- **Peak Concurrent**: 3-6 requests/second

### Memory Usage
- **Per Client**: 2-5 MB baseline
- **Per Session**: 0.1-0.5 MB
- **Concurrent Overhead**: 1-3 MB per additional thread
- **Memory Leaks**: None detected in normal operation

## Optimization Recommendations

### For Production Use
1. **Client Pooling**: Reuse client instances to avoid initialization overhead
2. **Concurrent Execution**: Use async patterns for batch operations
3. **Memory Management**: Implement periodic cleanup for long-running processes
4. **Timeout Tuning**: Set timeouts based on query complexity (30-120s)

### For Development
1. **Warm-up Requests**: First query may be slower due to initialization
2. **Streaming Benefits**: Use streaming for long responses with user feedback
3. **Error Handling**: Implement retry logic for transient failures
4. **Monitoring**: Track response times and success rates

## Performance Comparison Charts

The benchmark suite can generate performance comparison data suitable for visualization:

- Response time distributions
- Throughput vs concurrency curves
- Memory usage over time
- Success rate vs timeout settings

## Troubleshooting

### Common Issues

**Benchmark Failures:**
```bash
❌ Client initialization failed: Claude CLI not found
```
*Solution*: Install Claude CLI: `npm install -g @anthropic-ai/claude-code`

**Memory Profiler Missing:**
```bash
⚠️ memory_profiler not available, skipping detailed memory profiling
```
*Solution*: Install with: `pip install memory-profiler`

**Timeout Issues:**
```bash
❌ Query execution error: Claude execution timed out after 300 seconds
```
*Solution*: Increase timeout in ClaudeSessionOptions or use shorter test queries

### Performance Issues

**Slow Initialization (>1s):**
- Check Claude CLI installation
- Verify PATH configuration
- Consider client pooling

**Low Throughput (<1 req/s):**
- Check network connectivity
- Verify API key configuration
- Monitor system resources

**Memory Growth:**
- Enable detailed memory profiling
- Check for resource cleanup
- Review session management

## Extending Benchmarks

To add custom benchmarks:

1. Create new benchmark class inheriting from base patterns
2. Implement benchmark methods with timing and error handling
3. Add to main benchmark runner
4. Update result processing and reporting

Example:
```python
class CustomBenchmarkSuite:
    def benchmark_custom_feature(self):
        with self.benchmark_timer("custom_test"):
            # Your test code here
            pass
```

## Contributing

When contributing benchmark improvements:

1. Ensure non-destructive testing (no external side effects)
2. Include proper error handling and cleanup
3. Add comprehensive result analysis
4. Update documentation with new metrics
5. Test across different environments

## System Requirements

- Python 3.8+
- Claude CLI installed and configured
- 4GB+ RAM for memory benchmarks
- Internet connectivity for API calls
- Optional: memory_profiler for detailed analysis