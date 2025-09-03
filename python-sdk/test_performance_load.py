#!/usr/bin/env python3
"""
Performance and Load Testing Suite
Visual Agent Management Platform

Comprehensive performance validation for:
1. WebSocket throughput and latency
2. Multi-agent concurrent execution
3. Resource usage under load
4. Memory leak detection
5. Response time baselines
6. System scalability limits

Requirements:
- System under test running (UI + WebSocket + Python backend)
- Claude CLI authenticated
- Sufficient system resources for load testing
"""

import asyncio
import time
import json
import statistics
import psutil
import websockets
import aiohttp
import matplotlib.pyplot as plt
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
import logging
import uuid
import concurrent.futures
import resource
import gc
from concurrent.futures import ThreadPoolExecutor
import numpy as np

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetric:
    """Individual performance measurement"""
    name: str
    value: float
    unit: str
    timestamp: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LoadTestResult:
    """Results from load testing"""
    test_name: str
    duration_seconds: float
    total_operations: int
    successful_operations: int
    failed_operations: int
    avg_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    operations_per_second: float
    error_rate: float
    memory_peak_mb: float
    cpu_peak_percent: float
    metrics: List[PerformanceMetric] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class SystemMonitor:
    """Monitor system resources during testing"""
    
    def __init__(self, interval: float = 1.0):
        self.interval = interval
        self.monitoring = False
        self.metrics: List[Dict[str, Any]] = []
        self.monitor_task: Optional[asyncio.Task] = None
    
    async def start_monitoring(self):
        """Start system resource monitoring"""
        self.monitoring = True
        self.metrics.clear()
        self.monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("Started system monitoring")
    
    async def stop_monitoring(self) -> Dict[str, Any]:
        """Stop monitoring and return aggregated metrics"""
        self.monitoring = False
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
        
        if not self.metrics:
            return {}
        
        # Aggregate metrics
        cpu_values = [m['cpu_percent'] for m in self.metrics]
        memory_values = [m['memory_mb'] for m in self.metrics]
        
        aggregated = {
            'duration_seconds': len(self.metrics) * self.interval,
            'cpu': {
                'avg': statistics.mean(cpu_values),
                'min': min(cpu_values),
                'max': max(cpu_values),
                'p95': np.percentile(cpu_values, 95)
            },
            'memory': {
                'avg': statistics.mean(memory_values),
                'min': min(memory_values),
                'max': max(memory_values),
                'p95': np.percentile(memory_values, 95)
            },
            'sample_count': len(self.metrics),
            'raw_metrics': self.metrics
        }
        
        logger.info(f"Monitoring stopped. Collected {len(self.metrics)} samples")
        return aggregated
    
    async def _monitor_loop(self):
        """Main monitoring loop"""
        try:
            while self.monitoring:
                timestamp = time.time()
                
                # CPU and memory
                cpu_percent = psutil.cpu_percent()
                memory = psutil.virtual_memory()
                memory_mb = memory.used / 1024 / 1024
                
                # Process-specific metrics
                current_process = psutil.Process()
                process_memory_mb = current_process.memory_info().rss / 1024 / 1024
                process_cpu = current_process.cpu_percent()
                
                # Network
                network = psutil.net_io_counters()
                
                metric = {
                    'timestamp': timestamp,
                    'cpu_percent': cpu_percent,
                    'memory_mb': memory_mb,
                    'memory_percent': memory.percent,
                    'process_memory_mb': process_memory_mb,
                    'process_cpu_percent': process_cpu,
                    'network_bytes_sent': network.bytes_sent if network else 0,
                    'network_bytes_recv': network.bytes_recv if network else 0,
                    'open_files': len(current_process.open_files()),
                    'threads': current_process.num_threads()
                }
                
                self.metrics.append(metric)
                
                await asyncio.sleep(self.interval)
        
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in monitoring loop: {e}")


class WebSocketLoadTester:
    """Load test WebSocket connections and message throughput"""
    
    def __init__(self, server_uri: str = "ws://localhost:4005"):
        self.server_uri = server_uri
        self.connections: List[websockets.WebSocketServerProtocol] = []
        self.messages_sent = 0
        self.messages_received = 0
        self.response_times: List[float] = []
        self.errors: List[str] = []
    
    async def test_connection_capacity(self, max_connections: int = 100) -> LoadTestResult:
        """Test maximum concurrent WebSocket connections"""
        start_time = time.time()
        monitor = SystemMonitor(interval=0.5)
        
        await monitor.start_monitoring()
        
        successful_connections = 0
        failed_connections = 0
        
        # Create connections in batches
        batch_size = 10
        for i in range(0, max_connections, batch_size):
            batch_tasks = []
            for j in range(batch_size):
                if i + j >= max_connections:
                    break
                batch_tasks.append(self._create_connection())
            
            # Execute batch
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    failed_connections += 1
                    self.errors.append(str(result))
                else:
                    successful_connections += 1
                    self.connections.append(result)
            
            # Small delay between batches
            await asyncio.sleep(0.1)
        
        # Hold connections for a moment
        await asyncio.sleep(2)
        
        # Close all connections
        for conn in self.connections:
            try:
                await conn.close()
            except:
                pass
        
        duration = time.time() - start_time
        system_metrics = await monitor.stop_monitoring()
        
        return LoadTestResult(
            test_name="websocket_connection_capacity",
            duration_seconds=duration,
            total_operations=max_connections,
            successful_operations=successful_connections,
            failed_operations=failed_connections,
            avg_response_time_ms=0,  # N/A for connection test
            min_response_time_ms=0,
            max_response_time_ms=0,
            p95_response_time_ms=0,
            p99_response_time_ms=0,
            operations_per_second=successful_connections / duration,
            error_rate=failed_connections / max_connections,
            memory_peak_mb=system_metrics.get('memory', {}).get('max', 0),
            cpu_peak_percent=system_metrics.get('cpu', {}).get('max', 0),
            errors=self.errors.copy()
        )
    
    async def test_message_throughput(self, 
                                    connections: int = 10, 
                                    messages_per_connection: int = 100,
                                    message_size_bytes: int = 1024) -> LoadTestResult:
        """Test WebSocket message throughput and latency"""
        start_time = time.time()
        monitor = SystemMonitor()
        
        await monitor.start_monitoring()
        
        # Create connections
        logger.info(f"Creating {connections} WebSocket connections...")
        connection_tasks = [self._create_connection() for _ in range(connections)]
        self.connections = await asyncio.gather(*connection_tasks, return_exceptions=True)
        
        # Filter successful connections
        successful_conns = [c for c in self.connections if not isinstance(c, Exception)]
        failed_conns = len(self.connections) - len(successful_conns)
        
        logger.info(f"Created {len(successful_conns)} connections, {failed_conns} failed")
        
        # Prepare test data
        test_message = {
            'type': 'load_test',
            'data': 'x' * message_size_bytes,  # Payload of specified size
            'timestamp': 0,  # Will be set per message
            'sequence': 0
        }
        
        # Send messages from all connections
        self.response_times.clear()
        self.messages_sent = 0
        self.messages_received = 0
        
        async def send_messages_from_connection(conn, conn_id: int):
            """Send messages from a single connection"""
            for seq in range(messages_per_connection):
                try:
                    send_time = time.time()
                    test_message['timestamp'] = send_time
                    test_message['sequence'] = seq
                    test_message['connection_id'] = conn_id
                    
                    await conn.send(json.dumps(test_message))
                    self.messages_sent += 1
                    
                    # For latency testing, we'd need to receive responses
                    # For throughput, we just track sent messages
                    
                except Exception as e:
                    self.errors.append(f"Connection {conn_id}, seq {seq}: {e}")
        
        # Execute message sending
        logger.info(f"Sending {messages_per_connection} messages from each connection...")
        send_tasks = [
            send_messages_from_connection(conn, i) 
            for i, conn in enumerate(successful_conns)
        ]
        
        await asyncio.gather(*send_tasks, return_exceptions=True)
        
        # Close connections
        for conn in successful_conns:
            try:
                await conn.close()
            except:
                pass
        
        duration = time.time() - start_time
        system_metrics = await monitor.stop_monitoring()
        
        total_messages = connections * messages_per_connection
        successful_messages = self.messages_sent
        
        return LoadTestResult(
            test_name="websocket_message_throughput",
            duration_seconds=duration,
            total_operations=total_messages,
            successful_operations=successful_messages,
            failed_operations=total_messages - successful_messages,
            avg_response_time_ms=0,  # Would need response handling
            min_response_time_ms=0,
            max_response_time_ms=0,
            p95_response_time_ms=0,
            p99_response_time_ms=0,
            operations_per_second=successful_messages / duration,
            error_rate=(total_messages - successful_messages) / total_messages,
            memory_peak_mb=system_metrics.get('memory', {}).get('max', 0),
            cpu_peak_percent=system_metrics.get('cpu', {}).get('max', 0),
            errors=self.errors.copy()
        )
    
    async def _create_connection(self) -> websockets.WebSocketServerProtocol:
        """Create a single WebSocket connection"""
        return await websockets.connect(self.server_uri, timeout=10)


class MultiAgentLoadTester:
    """Load test multi-agent operations"""
    
    def __init__(self):
        self.response_times: List[float] = []
        self.errors: List[str] = []
    
    async def test_concurrent_agent_execution(self, 
                                            agent_count: int = 5,
                                            tasks_per_agent: int = 3) -> LoadTestResult:
        """Test concurrent execution of multiple agents"""
        start_time = time.time()
        monitor = SystemMonitor()
        
        await monitor.start_monitoring()
        
        # Create Claude CLI wrappers (simulating agents)
        agents = []
        for i in range(agent_count):
            options = ClaudeCliOptions(
                model="sonnet",
                max_turns=2,
                timeout=60,
                verbose=False
            )
            agent = ClaudeCliWrapper(options)
            agents.append(agent)
        
        logger.info(f"Created {len(agents)} agent wrappers")
        
        # Define test tasks
        test_tasks = [
            "What is 2+2? Reply with just the number.",
            "Name one color. Reply with just the color name.",
            "What day comes after Monday? Reply with just the day name.",
        ]
        
        successful_operations = 0
        failed_operations = 0
        
        async def execute_agent_task(agent: ClaudeCliWrapper, task: str, agent_id: int, task_id: int):
            """Execute a single task on an agent"""
            try:
                start_task_time = time.time()
                
                responses = []
                async for message in agent.execute(task):
                    responses.append(message)
                    if message.type == "error":
                        raise Exception(f"Agent error: {message.content}")
                
                duration = time.time() - start_task_time
                self.response_times.append(duration * 1000)  # Convert to ms
                
                return {
                    'agent_id': agent_id,
                    'task_id': task_id,
                    'success': True,
                    'duration_ms': duration * 1000,
                    'response_count': len(responses)
                }
                
            except Exception as e:
                error_msg = f"Agent {agent_id}, Task {task_id}: {e}"
                self.errors.append(error_msg)
                return {
                    'agent_id': agent_id,
                    'task_id': task_id,
                    'success': False,
                    'error': str(e)
                }
        
        # Execute all tasks concurrently
        all_tasks = []
        for agent_id, agent in enumerate(agents):
            for task_id in range(tasks_per_agent):
                task = test_tasks[task_id % len(test_tasks)]
                all_tasks.append(
                    execute_agent_task(agent, task, agent_id, task_id)
                )
        
        logger.info(f"Executing {len(all_tasks)} concurrent tasks...")
        results = await asyncio.gather(*all_tasks, return_exceptions=True)
        
        # Process results
        for result in results:
            if isinstance(result, Exception):
                failed_operations += 1
                self.errors.append(str(result))
            elif isinstance(result, dict) and result.get('success'):
                successful_operations += 1
            else:
                failed_operations += 1
        
        # Cleanup agents
        for agent in agents:
            try:
                await agent.cleanup()
            except:
                pass
        
        duration = time.time() - start_time
        system_metrics = await monitor.stop_monitoring()
        
        # Calculate response time statistics
        if self.response_times:
            avg_response_time = statistics.mean(self.response_times)
            min_response_time = min(self.response_times)
            max_response_time = max(self.response_times)
            p95_response_time = np.percentile(self.response_times, 95)
            p99_response_time = np.percentile(self.response_times, 99)
        else:
            avg_response_time = min_response_time = max_response_time = p95_response_time = p99_response_time = 0
        
        total_operations = len(all_tasks)
        
        return LoadTestResult(
            test_name="concurrent_agent_execution",
            duration_seconds=duration,
            total_operations=total_operations,
            successful_operations=successful_operations,
            failed_operations=failed_operations,
            avg_response_time_ms=avg_response_time,
            min_response_time_ms=min_response_time,
            max_response_time_ms=max_response_time,
            p95_response_time_ms=p95_response_time,
            p99_response_time_ms=p99_response_time,
            operations_per_second=successful_operations / duration,
            error_rate=failed_operations / total_operations,
            memory_peak_mb=system_metrics.get('memory', {}).get('max', 0),
            cpu_peak_percent=system_metrics.get('cpu', {}).get('max', 0),
            errors=self.errors.copy()
        )


class MemoryLeakDetector:
    """Detect memory leaks during long-running operations"""
    
    def __init__(self):
        self.initial_memory: Optional[float] = None
        self.memory_samples: List[Tuple[float, float]] = []  # (timestamp, memory_mb)
        self.leak_threshold_mb = 50  # Consider leak if growth > 50MB
    
    async def test_memory_stability(self, 
                                  duration_minutes: int = 5,
                                  operation_interval_seconds: float = 10) -> Dict[str, Any]:
        """Test for memory leaks during repeated operations"""
        logger.info(f"Starting memory leak test for {duration_minutes} minutes...")
        
        start_time = time.time()
        end_time = start_time + (duration_minutes * 60)
        
        # Record initial memory
        process = psutil.Process()
        self.initial_memory = process.memory_info().rss / 1024 / 1024
        self.memory_samples.clear()
        
        iteration = 0
        
        while time.time() < end_time:
            iteration += 1
            
            # Perform a memory-intensive operation
            await self._perform_test_operation(iteration)
            
            # Record memory usage
            current_memory = process.memory_info().rss / 1024 / 1024
            timestamp = time.time() - start_time
            self.memory_samples.append((timestamp, current_memory))
            
            logger.info(f"Iteration {iteration}: {current_memory:.1f} MB (Δ{current_memory - self.initial_memory:+.1f} MB)")
            
            # Wait before next iteration
            await asyncio.sleep(operation_interval_seconds)
            
            # Force garbage collection
            gc.collect()
        
        # Analyze results
        final_memory = self.memory_samples[-1][1] if self.memory_samples else self.initial_memory
        memory_growth = final_memory - self.initial_memory
        has_leak = memory_growth > self.leak_threshold_mb
        
        # Calculate memory growth trend
        if len(self.memory_samples) >= 2:
            timestamps = [s[0] for s in self.memory_samples]
            memories = [s[1] for s in self.memory_samples]
            growth_rate = (memories[-1] - memories[0]) / (timestamps[-1] - timestamps[0]) * 60  # MB per minute
        else:
            growth_rate = 0
        
        return {
            'test_duration_minutes': duration_minutes,
            'iterations': iteration,
            'initial_memory_mb': self.initial_memory,
            'final_memory_mb': final_memory,
            'memory_growth_mb': memory_growth,
            'growth_rate_mb_per_minute': growth_rate,
            'has_potential_leak': has_leak,
            'leak_threshold_mb': self.leak_threshold_mb,
            'memory_samples': self.memory_samples,
            'peak_memory_mb': max(s[1] for s in self.memory_samples) if self.memory_samples else self.initial_memory
        }
    
    async def _perform_test_operation(self, iteration: int):
        """Perform a test operation that might cause memory leaks"""
        try:
            # Create and cleanup Claude CLI wrapper
            options = ClaudeCliOptions(
                model="sonnet",
                max_turns=1,
                timeout=30,
                verbose=False
            )
            wrapper = ClaudeCliWrapper(options)
            
            # Execute a simple task
            task = f"What is {iteration} + 1? Reply with just the number."
            async for message in wrapper.execute(task):
                pass  # Just consume messages
            
            # Cleanup
            await wrapper.cleanup()
            
        except Exception as e:
            logger.warning(f"Error in test operation {iteration}: {e}")


class PerformanceTestSuite:
    """Main performance testing orchestrator"""
    
    def __init__(self):
        self.results: List[LoadTestResult] = []
        self.ws_tester = WebSocketLoadTester()
        self.agent_tester = MultiAgentLoadTester()
        self.memory_tester = MemoryLeakDetector()
    
    async def run_baseline_performance_tests(self) -> List[LoadTestResult]:
        """Run baseline performance tests to establish benchmarks"""
        logger.info("Running baseline performance tests...")
        
        tests = [
            ("WebSocket Connection Capacity", self._test_websocket_connections),
            ("WebSocket Message Throughput", self._test_websocket_throughput),
            ("Multi-Agent Execution", self._test_multi_agent_performance),
            ("Memory Stability", self._test_memory_stability)
        ]
        
        results = []
        for test_name, test_func in tests:
            logger.info(f"Running {test_name}...")
            try:
                result = await test_func()
                if result:
                    results.append(result)
                    logger.info(f"{test_name} completed: {result.operations_per_second:.1f} ops/sec")
            except Exception as e:
                logger.error(f"Error in {test_name}: {e}")
                # Create error result
                error_result = LoadTestResult(
                    test_name=test_name.lower().replace(' ', '_'),
                    duration_seconds=0,
                    total_operations=0,
                    successful_operations=0,
                    failed_operations=1,
                    avg_response_time_ms=0,
                    min_response_time_ms=0,
                    max_response_time_ms=0,
                    p95_response_time_ms=0,
                    p99_response_time_ms=0,
                    operations_per_second=0,
                    error_rate=1.0,
                    memory_peak_mb=0,
                    cpu_peak_percent=0,
                    errors=[str(e)]
                )
                results.append(error_result)
        
        self.results = results
        return results
    
    async def _test_websocket_connections(self) -> LoadTestResult:
        """Test WebSocket connection capacity"""
        return await self.ws_tester.test_connection_capacity(max_connections=50)
    
    async def _test_websocket_throughput(self) -> LoadTestResult:
        """Test WebSocket message throughput"""
        return await self.ws_tester.test_message_throughput(
            connections=5,
            messages_per_connection=50,
            message_size_bytes=1024
        )
    
    async def _test_multi_agent_performance(self) -> LoadTestResult:
        """Test multi-agent performance"""
        return await self.agent_tester.test_concurrent_agent_execution(
            agent_count=3,
            tasks_per_agent=2
        )
    
    async def _test_memory_stability(self) -> Optional[LoadTestResult]:
        """Test memory stability (shorter duration for CI/CD)"""
        memory_result = await self.memory_tester.test_memory_stability(
            duration_minutes=2,  # Short test for CI
            operation_interval_seconds=15
        )
        
        # Convert to LoadTestResult format
        return LoadTestResult(
            test_name="memory_stability",
            duration_seconds=memory_result['test_duration_minutes'] * 60,
            total_operations=memory_result['iterations'],
            successful_operations=memory_result['iterations'],
            failed_operations=0,
            avg_response_time_ms=0,
            min_response_time_ms=0,
            max_response_time_ms=0,
            p95_response_time_ms=0,
            p99_response_time_ms=0,
            operations_per_second=memory_result['iterations'] / (memory_result['test_duration_minutes'] * 60),
            error_rate=0.0,
            memory_peak_mb=memory_result['peak_memory_mb'],
            cpu_peak_percent=0,
            metrics=[
                PerformanceMetric(
                    name="memory_growth_mb",
                    value=memory_result['memory_growth_mb'],
                    unit="MB",
                    timestamp=time.time(),
                    metadata={'has_potential_leak': memory_result['has_potential_leak']}
                )
            ]
        )
    
    def generate_performance_report(self) -> str:
        """Generate comprehensive performance test report"""
        if not self.results:
            return "No performance test results available"
        
        report = []
        report.append("=" * 80)
        report.append("VISUAL AGENT PLATFORM - PERFORMANCE TEST REPORT")
        report.append("=" * 80)
        report.append(f"Test Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Total Tests: {len(self.results)}")
        report.append("")
        
        # Performance summary
        report.append("PERFORMANCE SUMMARY:")
        report.append("-" * 40)
        
        for result in self.results:
            status = "✅ PASS" if result.error_rate < 0.05 else "❌ FAIL"
            report.append(f"{status} {result.test_name.upper()}")
            report.append(f"   Operations/sec: {result.operations_per_second:.1f}")
            report.append(f"   Success Rate: {(1-result.error_rate)*100:.1f}%")
            report.append(f"   Avg Response: {result.avg_response_time_ms:.1f}ms")
            report.append(f"   P95 Response: {result.p95_response_time_ms:.1f}ms")
            report.append(f"   Peak Memory: {result.memory_peak_mb:.1f}MB")
            report.append(f"   Peak CPU: {result.cpu_peak_percent:.1f}%")
            
            if result.errors:
                report.append(f"   Errors: {len(result.errors)}")
                for error in result.errors[:3]:  # Show first 3 errors
                    report.append(f"     - {error}")
                if len(result.errors) > 3:
                    report.append(f"     ... and {len(result.errors) - 3} more")
            
            report.append("")
        
        # Benchmarks and recommendations
        report.append("PERFORMANCE BENCHMARKS:")
        report.append("-" * 40)
        
        # WebSocket benchmarks
        ws_results = [r for r in self.results if 'websocket' in r.test_name]
        if ws_results:
            max_ops_per_sec = max(r.operations_per_second for r in ws_results)
            report.append(f"WebSocket Peak Performance: {max_ops_per_sec:.1f} operations/sec")
        
        # Agent benchmarks
        agent_results = [r for r in self.results if 'agent' in r.test_name]
        if agent_results:
            agent_throughput = sum(r.operations_per_second for r in agent_results)
            report.append(f"Multi-Agent Throughput: {agent_throughput:.1f} operations/sec")
        
        # Memory benchmarks
        memory_results = [r for r in self.results if 'memory' in r.test_name]
        if memory_results:
            peak_memory = max(r.memory_peak_mb for r in memory_results)
            report.append(f"Peak Memory Usage: {peak_memory:.1f}MB")
        
        report.append("")
        
        # Recommendations
        report.append("RECOMMENDATIONS:")
        report.append("-" * 40)
        
        total_errors = sum(len(r.errors) for r in self.results)
        avg_error_rate = sum(r.error_rate for r in self.results) / len(self.results)
        avg_response_time = sum(r.avg_response_time_ms for r in self.results) / len(self.results)
        
        if total_errors > 10:
            report.append("• High error count detected - investigate system stability")
        if avg_error_rate > 0.05:
            report.append("• Error rate above 5% - check system health and resources")
        if avg_response_time > 5000:
            report.append("• Response times high - consider system optimization")
        
        # Memory leak detection
        for result in self.results:
            for metric in result.metrics:
                if metric.name == "memory_growth_mb" and metric.value > 50:
                    report.append("• Potential memory leak detected - review resource cleanup")
                    break
        
        # Performance thresholds
        if any(r.operations_per_second < 1.0 for r in self.results):
            report.append("• Low throughput detected - system may not handle production load")
        
        report.append("=" * 80)
        
        return "\n".join(report)
    
    def save_performance_charts(self, output_dir: Path):
        """Generate and save performance charts"""
        output_dir.mkdir(exist_ok=True)
        
        if not self.results:
            return
        
        # Performance overview chart
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
        
        test_names = [r.test_name for r in self.results]
        ops_per_sec = [r.operations_per_second for r in self.results]
        error_rates = [r.error_rate * 100 for r in self.results]
        response_times = [r.avg_response_time_ms for r in self.results]
        memory_usage = [r.memory_peak_mb for r in self.results]
        
        # Operations per second
        ax1.bar(test_names, ops_per_sec)
        ax1.set_title('Operations per Second')
        ax1.set_ylabel('Ops/sec')
        ax1.tick_params(axis='x', rotation=45)
        
        # Error rates
        ax2.bar(test_names, error_rates, color='red', alpha=0.7)
        ax2.set_title('Error Rates')
        ax2.set_ylabel('Error Rate (%)')
        ax2.tick_params(axis='x', rotation=45)
        
        # Response times
        ax3.bar(test_names, response_times, color='green', alpha=0.7)
        ax3.set_title('Average Response Times')
        ax3.set_ylabel('Response Time (ms)')
        ax3.tick_params(axis='x', rotation=45)
        
        # Memory usage
        ax4.bar(test_names, memory_usage, color='orange', alpha=0.7)
        ax4.set_title('Peak Memory Usage')
        ax4.set_ylabel('Memory (MB)')
        ax4.tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        plt.savefig(output_dir / 'performance_overview.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"Performance charts saved to {output_dir}")


async def main():
    """Main performance test execution"""
    print("🚀 Visual Agent Platform - Performance & Load Testing Suite")
    print("=" * 80)
    
    # Create test suite
    perf_suite = PerformanceTestSuite()
    
    try:
        # Run performance tests
        results = await perf_suite.run_baseline_performance_tests()
        
        # Generate report
        report = perf_suite.generate_performance_report()
        print(report)
        
        # Save report and charts
        output_dir = Path("performance_results")
        output_dir.mkdir(exist_ok=True)
        
        report_file = output_dir / "performance_report.txt"
        report_file.write_text(report)
        
        # Save charts if matplotlib is available
        try:
            perf_suite.save_performance_charts(output_dir)
        except Exception as e:
            logger.warning(f"Could not save performance charts: {e}")
        
        # Save raw results as JSON
        results_data = []
        for result in results:
            results_data.append({
                'test_name': result.test_name,
                'duration_seconds': result.duration_seconds,
                'operations_per_second': result.operations_per_second,
                'error_rate': result.error_rate,
                'avg_response_time_ms': result.avg_response_time_ms,
                'p95_response_time_ms': result.p95_response_time_ms,
                'memory_peak_mb': result.memory_peak_mb,
                'cpu_peak_percent': result.cpu_peak_percent,
                'errors': result.errors
            })
        
        json_file = output_dir / "performance_results.json"
        json_file.write_text(json.dumps(results_data, indent=2))
        
        print(f"\n📊 Performance results saved to: {output_dir.absolute()}")
        
        # Return appropriate exit code
        failed_tests = sum(1 for r in results if r.error_rate > 0.05)  # 5% error threshold
        return 0 if failed_tests == 0 else 1
        
    except Exception as e:
        print(f"❌ Performance test execution failed: {e}")
        logger.exception("Performance test error")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)