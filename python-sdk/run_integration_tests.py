#!/usr/bin/env python3
"""
Master Integration Test Runner
Visual Agent Management Platform

This script orchestrates the complete end-to-end integration test suite,
running all test categories in the correct order and generating comprehensive
reports that prove the system works from UI to Claude CLI.

Test Categories:
1. System Health & Prerequisites
2. Core Claude CLI Integration 
3. Agent Lifecycle Management
4. WebSocket Real-time Communication
5. Task Execution Pipelines
6. Multi-Agent Coordination
7. Performance & Load Testing
8. Error Handling & Recovery
9. Process Cleanup (Epic 3)
10. Security & Authentication

Usage:
    python run_integration_tests.py [options]
    
Options:
    --categories: Comma-separated list of test categories to run
    --skip-slow: Skip performance and load tests
    --parallel: Run tests in parallel where possible
    --output-dir: Directory for test results (default: integration_test_results)
    --verbose: Enable verbose logging
    --ci: Run in CI/CD mode (shorter timeouts, no interactive prompts)
"""

import asyncio
import argparse
import json
import time
import sys
import logging
import subprocess
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import traceback

# Import our test suites
from test_full_integration import IntegrationTestSuite, SystemHealthChecker
from test_performance_load import PerformanceTestSuite
from test_agent_lifecycle import AgentLifecycleTestSuite

# Setup logging
def setup_logging(verbose: bool = False, output_dir: Path = None):
    """Setup comprehensive logging"""
    level = logging.DEBUG if verbose else logging.INFO
    
    handlers = [logging.StreamHandler(sys.stdout)]
    
    if output_dir:
        output_dir.mkdir(exist_ok=True)
        handlers.append(logging.FileHandler(output_dir / "integration_test.log"))
    
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )
    
    # Reduce noise from some modules
    logging.getLogger('websockets').setLevel(logging.WARNING)
    logging.getLogger('aiohttp').setLevel(logging.WARNING)
    
    return logging.getLogger(__name__)


@dataclass
class TestSuiteResult:
    """Result from running a test suite"""
    suite_name: str
    success: bool
    duration_seconds: float
    tests_run: int
    tests_passed: int
    tests_failed: int
    error_message: Optional[str] = None
    detailed_results: Dict[str, Any] = field(default_factory=dict)


class MasterTestRunner:
    """Orchestrates all integration test suites"""
    
    def __init__(self, output_dir: Path, verbose: bool = False, ci_mode: bool = False):
        self.output_dir = output_dir
        self.verbose = verbose
        self.ci_mode = ci_mode
        self.logger = setup_logging(verbose, output_dir)
        self.suite_results: List[TestSuiteResult] = []
        self.start_time = 0
        self.end_time = 0
        
        # Ensure output directory exists
        self.output_dir.mkdir(exist_ok=True)
    
    async def run_system_prerequisites_check(self) -> TestSuiteResult:
        """Check system prerequisites before running tests"""
        self.logger.info("🔍 Checking System Prerequisites...")
        start_time = time.time()
        
        try:
            # Check all system components
            checks = {
                'claude_cli': await SystemHealthChecker.check_claude_cli(),
                'websocket_server': await SystemHealthChecker.check_websocket_server(4005),
                'api_server': await SystemHealthChecker.check_api_server(4005),
                'react_frontend': await SystemHealthChecker.check_react_frontend(6011)
            }
            
            # Analyze results
            all_passed = all(result[0] for result in checks.values())
            critical_passed = checks['claude_cli'][0] and checks['websocket_server'][0]
            
            detailed_results = {
                'checks': {name: {'success': result[0], 'message': result[1]} 
                          for name, result in checks.items()},
                'all_components_healthy': all_passed,
                'critical_components_healthy': critical_passed
            }
            
            # Log results
            for component, (success, message) in checks.items():
                status = "✅" if success else "❌"
                self.logger.info(f"{status} {component}: {message}")
            
            return TestSuiteResult(
                suite_name="system_prerequisites",
                success=critical_passed,  # Must have Claude CLI and WebSocket at minimum
                duration_seconds=time.time() - start_time,
                tests_run=len(checks),
                tests_passed=sum(1 for result in checks.values() if result[0]),
                tests_failed=sum(1 for result in checks.values() if not result[0]),
                detailed_results=detailed_results
            )
            
        except Exception as e:
            self.logger.error(f"Error in prerequisites check: {e}")
            return TestSuiteResult(
                suite_name="system_prerequisites",
                success=False,
                duration_seconds=time.time() - start_time,
                tests_run=0,
                tests_passed=0,
                tests_failed=1,
                error_message=str(e)
            )
    
    async def run_integration_tests(self, categories: Optional[List[str]] = None) -> TestSuiteResult:
        """Run core integration test suite"""
        self.logger.info("🚀 Running Core Integration Tests...")
        start_time = time.time()
        
        try:
            integration_suite = IntegrationTestSuite()
            
            # Configure for CI mode
            if self.ci_mode:
                # Reduce timeouts for CI
                for test_case in integration_suite.test_cases:
                    test_case.timeout_seconds = min(test_case.timeout_seconds, 180)
            
            # Run tests
            results = await integration_suite.run_test_suite(
                categories=categories,
                include_slow=not self.ci_mode,
                parallel=False  # Sequential for better error tracking
            )
            
            # Generate report
            report = integration_suite.generate_test_report()
            report_file = self.output_dir / "integration_test_report.txt"
            report_file.write_text(report)
            
            # Calculate summary
            total_tests = len(results)
            passed_tests = sum(1 for r in results if r.result.value == "PASS")
            failed_tests = total_tests - passed_tests
            
            return TestSuiteResult(
                suite_name="core_integration",
                success=failed_tests == 0,
                duration_seconds=time.time() - start_time,
                tests_run=total_tests,
                tests_passed=passed_tests,
                tests_failed=failed_tests,
                detailed_results={
                    'test_results': [
                        {
                            'name': r.test_case.name,
                            'result': r.result.value,
                            'duration': r.duration_seconds,
                            'category': r.test_case.category
                        } for r in results
                    ]
                }
            )
            
        except Exception as e:
            self.logger.error(f"Error in integration tests: {e}")
            traceback.print_exc()
            return TestSuiteResult(
                suite_name="core_integration",
                success=False,
                duration_seconds=time.time() - start_time,
                tests_run=0,
                tests_passed=0,
                tests_failed=1,
                error_message=str(e)
            )
    
    async def run_agent_lifecycle_tests(self) -> TestSuiteResult:
        """Run agent lifecycle test suite"""
        self.logger.info("🤖 Running Agent Lifecycle Tests...")
        start_time = time.time()
        
        try:
            lifecycle_suite = AgentLifecycleTestSuite()
            
            # Run comprehensive lifecycle tests
            summary = await lifecycle_suite.run_comprehensive_lifecycle_tests()
            
            # Generate report
            report = lifecycle_suite.generate_lifecycle_report(summary)
            report_file = self.output_dir / "agent_lifecycle_report.txt"
            report_file.write_text(report)
            
            # Save detailed results
            json_file = self.output_dir / "agent_lifecycle_results.json"
            json_file.write_text(json.dumps(summary, indent=2, default=str))
            
            # Calculate success metrics
            agent_success_rate = summary['agent_lifecycle']['success_rate']
            task_success_rate = summary['task_execution']['success_rate']
            coordination_success_rate = summary['coordination']['success_rate']
            
            overall_success = (
                agent_success_rate > 0.7 and
                task_success_rate > 0.6 and
                coordination_success_rate > 0.5
            )
            
            return TestSuiteResult(
                suite_name="agent_lifecycle",
                success=overall_success,
                duration_seconds=time.time() - start_time,
                tests_run=summary['agent_lifecycle']['total_agents_tested'],
                tests_passed=summary['agent_lifecycle']['successful_agents'],
                tests_failed=summary['agent_lifecycle']['total_agents_tested'] - summary['agent_lifecycle']['successful_agents'],
                detailed_results=summary
            )
            
        except Exception as e:
            self.logger.error(f"Error in agent lifecycle tests: {e}")
            traceback.print_exc()
            return TestSuiteResult(
                suite_name="agent_lifecycle",
                success=False,
                duration_seconds=time.time() - start_time,
                tests_run=0,
                tests_passed=0,
                tests_failed=1,
                error_message=str(e)
            )
    
    async def run_performance_tests(self, skip_slow: bool = False) -> TestSuiteResult:
        """Run performance and load test suite"""
        if skip_slow:
            self.logger.info("⏭️ Skipping Performance Tests (--skip-slow enabled)")
            return TestSuiteResult(
                suite_name="performance",
                success=True,
                duration_seconds=0,
                tests_run=0,
                tests_passed=0,
                tests_failed=0,
                detailed_results={'skipped': True}
            )
        
        self.logger.info("⚡ Running Performance & Load Tests...")
        start_time = time.time()
        
        try:
            perf_suite = PerformanceTestSuite()
            
            # Run baseline performance tests
            results = await perf_suite.run_baseline_performance_tests()
            
            # Generate report
            report = perf_suite.generate_performance_report()
            report_file = self.output_dir / "performance_test_report.txt"
            report_file.write_text(report)
            
            # Save performance charts (if possible)
            try:
                perf_suite.save_performance_charts(self.output_dir)
            except Exception as chart_error:
                self.logger.warning(f"Could not save performance charts: {chart_error}")
            
            # Save raw results
            results_data = []
            for result in results:
                results_data.append({
                    'test_name': result.test_name,
                    'operations_per_second': result.operations_per_second,
                    'error_rate': result.error_rate,
                    'avg_response_time_ms': result.avg_response_time_ms,
                    'memory_peak_mb': result.memory_peak_mb,
                    'success': result.error_rate < 0.1  # 10% error threshold
                })
            
            json_file = self.output_dir / "performance_results.json"
            json_file.write_text(json.dumps(results_data, indent=2))
            
            # Calculate success
            successful_tests = sum(1 for r in results if r.error_rate < 0.1)
            overall_success = successful_tests > len(results) / 2  # At least half successful
            
            return TestSuiteResult(
                suite_name="performance",
                success=overall_success,
                duration_seconds=time.time() - start_time,
                tests_run=len(results),
                tests_passed=successful_tests,
                tests_failed=len(results) - successful_tests,
                detailed_results={'results': results_data}
            )
            
        except Exception as e:
            self.logger.error(f"Error in performance tests: {e}")
            traceback.print_exc()
            return TestSuiteResult(
                suite_name="performance",
                success=False,
                duration_seconds=time.time() - start_time,
                tests_run=0,
                tests_passed=0,
                tests_failed=1,
                error_message=str(e)
            )
    
    async def run_all_test_suites(self, 
                                categories: Optional[List[str]] = None,
                                skip_slow: bool = False,
                                parallel: bool = False) -> List[TestSuiteResult]:
        """Run all test suites in order"""
        self.logger.info("🎯 Starting Master Integration Test Suite")
        self.start_time = time.time()
        
        self.suite_results.clear()
        
        # Phase 1: Prerequisites (always run first)
        prereq_result = await self.run_system_prerequisites_check()
        self.suite_results.append(prereq_result)
        
        if not prereq_result.success:
            self.logger.error("❌ Prerequisites failed - cannot continue with tests")
            self.logger.error("Please ensure:")
            self.logger.error("  1. Claude CLI is installed and authenticated")
            self.logger.error("  2. WebSocket server is running on port 4005")
            self.logger.error("  3. System has sufficient resources")
            return self.suite_results
        
        # Define test suites to run
        test_suites = [
            ("core_integration", self.run_integration_tests, [categories]),
            ("agent_lifecycle", self.run_agent_lifecycle_tests, []),
            ("performance", self.run_performance_tests, [skip_slow])
        ]
        
        if parallel:
            # Run test suites in parallel (limited)
            self.logger.info("🔄 Running test suites in parallel...")
            
            # Create tasks
            tasks = []
            for suite_name, suite_func, args in test_suites:
                if suite_name == "performance" and skip_slow:
                    continue
                task = asyncio.create_task(suite_func(*args))
                tasks.append((suite_name, task))
            
            # Execute with controlled concurrency
            for suite_name, task in tasks:
                try:
                    result = await task
                    self.suite_results.append(result)
                    
                    status = "✅ PASS" if result.success else "❌ FAIL"
                    self.logger.info(f"{status} {suite_name}: {result.tests_passed}/{result.tests_run} tests passed")
                    
                except Exception as e:
                    self.logger.error(f"Error in {suite_name}: {e}")
                    error_result = TestSuiteResult(
                        suite_name=suite_name,
                        success=False,
                        duration_seconds=0,
                        tests_run=0,
                        tests_passed=0,
                        tests_failed=1,
                        error_message=str(e)
                    )
                    self.suite_results.append(error_result)
        else:
            # Run test suites sequentially
            self.logger.info("📋 Running test suites sequentially...")
            
            for suite_name, suite_func, args in test_suites:
                if suite_name == "performance" and skip_slow:
                    continue
                
                self.logger.info(f"▶️ Starting {suite_name}...")
                
                try:
                    result = await suite_func(*args)
                    self.suite_results.append(result)
                    
                    status = "✅ PASS" if result.success else "❌ FAIL"
                    self.logger.info(f"{status} {suite_name}: {result.tests_passed}/{result.tests_run} tests passed ({result.duration_seconds:.1f}s)")
                    
                    # Add delay between test suites for stability
                    if not self.ci_mode:
                        await asyncio.sleep(2)
                        
                except Exception as e:
                    self.logger.error(f"Error in {suite_name}: {e}")
                    traceback.print_exc()
                    
                    error_result = TestSuiteResult(
                        suite_name=suite_name,
                        success=False,
                        duration_seconds=0,
                        tests_run=0,
                        tests_passed=0,
                        tests_failed=1,
                        error_message=str(e)
                    )
                    self.suite_results.append(error_result)
        
        self.end_time = time.time()
        return self.suite_results
    
    def generate_master_report(self) -> str:
        """Generate comprehensive master test report"""
        if not self.suite_results:
            return "No test results available"
        
        total_duration = self.end_time - self.start_time if self.end_time > 0 else 0
        
        # Calculate overall statistics
        total_suites = len(self.suite_results)
        successful_suites = sum(1 for r in self.suite_results if r.success)
        failed_suites = total_suites - successful_suites
        
        total_tests = sum(r.tests_run for r in self.suite_results)
        total_passed = sum(r.tests_passed for r in self.suite_results)
        total_failed = sum(r.tests_failed for r in self.suite_results)
        
        report = []
        
        # Header
        report.append("=" * 90)
        report.append("🚀 VISUAL AGENT MANAGEMENT PLATFORM - MASTER INTEGRATION TEST REPORT")
        report.append("=" * 90)
        report.append(f"Test Execution Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Total Execution Time: {total_duration:.2f} seconds")
        report.append(f"Output Directory: {self.output_dir.absolute()}")
        report.append("")
        
        # Executive Summary
        overall_success = failed_suites == 0 and total_failed == 0
        status_icon = "✅" if overall_success else "❌"
        
        report.append(f"{status_icon} EXECUTIVE SUMMARY")
        report.append("-" * 50)
        report.append(f"Overall Status: {'PASS' if overall_success else 'FAIL'}")
        report.append(f"Test Suites: {successful_suites}/{total_suites} passed ({successful_suites/total_suites*100:.1f}%)")
        report.append(f"Individual Tests: {total_passed}/{total_tests} passed ({total_passed/total_tests*100:.1f}%)")
        report.append("")
        
        # Suite-by-Suite Results
        report.append("📋 TEST SUITE RESULTS")
        report.append("-" * 50)
        
        for result in self.suite_results:
            status_icon = "✅" if result.success else "❌"
            suite_name = result.suite_name.upper().replace("_", " ")
            
            report.append(f"{status_icon} {suite_name}")
            report.append(f"    Duration: {result.duration_seconds:.2f}s")
            report.append(f"    Tests: {result.tests_passed}/{result.tests_run} passed")
            
            if not result.success and result.error_message:
                report.append(f"    Error: {result.error_message}")
            
            # Add specific insights
            if result.suite_name == "system_prerequisites":
                if result.detailed_results:
                    checks = result.detailed_results.get('checks', {})
                    critical_ok = result.detailed_results.get('critical_components_healthy', False)
                    if critical_ok:
                        report.append("    ✅ Critical components (Claude CLI, WebSocket) operational")
                    else:
                        report.append("    ❌ Critical components not ready")
            
            elif result.suite_name == "core_integration":
                if result.detailed_results:
                    categories = {}
                    for test in result.detailed_results.get('test_results', []):
                        cat = test.get('category', 'unknown')
                        if cat not in categories:
                            categories[cat] = {'total': 0, 'passed': 0}
                        categories[cat]['total'] += 1
                        if test.get('result') == 'PASS':
                            categories[cat]['passed'] += 1
                    
                    for cat, stats in categories.items():
                        success_rate = stats['passed'] / stats['total'] * 100 if stats['total'] > 0 else 0
                        report.append(f"    {cat}: {stats['passed']}/{stats['total']} ({success_rate:.0f}%)")
            
            elif result.suite_name == "agent_lifecycle":
                if result.detailed_results:
                    agent_rate = result.detailed_results.get('agent_lifecycle', {}).get('success_rate', 0) * 100
                    task_rate = result.detailed_results.get('task_execution', {}).get('success_rate', 0) * 100
                    coord_rate = result.detailed_results.get('coordination', {}).get('success_rate', 0) * 100
                    
                    report.append(f"    Agent Lifecycle: {agent_rate:.0f}% success")
                    report.append(f"    Task Execution: {task_rate:.0f}% success")
                    report.append(f"    Coordination: {coord_rate:.0f}% success")
            
            elif result.suite_name == "performance":
                if result.detailed_results and not result.detailed_results.get('skipped', False):
                    perf_results = result.detailed_results.get('results', [])
                    if perf_results:
                        avg_ops_per_sec = sum(r.get('operations_per_second', 0) for r in perf_results) / len(perf_results)
                        avg_error_rate = sum(r.get('error_rate', 0) for r in perf_results) / len(perf_results)
                        report.append(f"    Avg Throughput: {avg_ops_per_sec:.1f} ops/sec")
                        report.append(f"    Avg Error Rate: {avg_error_rate*100:.1f}%")
                elif result.detailed_results and result.detailed_results.get('skipped', False):
                    report.append("    ⏭️ Skipped (--skip-slow enabled)")
            
            report.append("")
        
        # System Readiness Assessment
        report.append("🎯 SYSTEM READINESS ASSESSMENT")
        report.append("-" * 50)
        
        if overall_success:
            report.append("✅ PRODUCTION READY")
            report.append("The Visual Agent Management Platform has passed comprehensive")
            report.append("integration testing and is ready for production deployment.")
        elif successful_suites >= total_suites * 0.8:  # 80% of suites passed
            report.append("⚠️ MOSTLY READY (Minor Issues)")
            report.append("The system passes most tests but has some issues that should")
            report.append("be addressed before full production deployment.")
        elif successful_suites >= total_suites * 0.6:  # 60% of suites passed
            report.append("🔧 NEEDS WORK")
            report.append("The system has significant issues that must be resolved")
            report.append("before considering production deployment.")
        else:
            report.append("❌ NOT READY")
            report.append("The system has major failures and requires substantial work")
            report.append("before it can be considered for production use.")
        
        report.append("")
        
        # Key Findings & Recommendations
        report.append("🔍 KEY FINDINGS & RECOMMENDATIONS")
        report.append("-" * 50)
        
        # Analyze common issues
        error_messages = [r.error_message for r in self.suite_results if r.error_message]
        auth_issues = any("authentication" in str(msg).lower() or "claude" in str(msg).lower() 
                         for msg in error_messages)
        network_issues = any("connection" in str(msg).lower() or "websocket" in str(msg).lower() 
                           for msg in error_messages)
        resource_issues = any("memory" in str(msg).lower() or "timeout" in str(msg).lower() 
                            for msg in error_messages)
        
        if auth_issues:
            report.append("• 🔐 Authentication Issues Detected")
            report.append("  - Ensure Claude CLI is properly authenticated: `claude setup-token`")
            report.append("  - Verify API keys and credentials are valid")
        
        if network_issues:
            report.append("• 🌐 Network/Connectivity Issues Detected")
            report.append("  - Check WebSocket server is running on port 4005")
            report.append("  - Verify React frontend is accessible on port 6011")
            report.append("  - Check firewall and network configuration")
        
        if resource_issues:
            report.append("• 💾 Resource Issues Detected")
            report.append("  - Monitor system memory and CPU usage")
            report.append("  - Consider increasing timeout values for slower systems")
            report.append("  - Check for memory leaks in long-running operations")
        
        # Performance recommendations
        performance_result = next((r for r in self.suite_results if r.suite_name == "performance"), None)
        if performance_result and performance_result.detailed_results:
            if not performance_result.detailed_results.get('skipped', False):
                report.append("• ⚡ Performance Optimization")
                report.append("  - Review performance test results for optimization opportunities")
                report.append("  - Consider horizontal scaling for high-load scenarios")
                report.append("  - Monitor WebSocket connection limits and throughput")
        
        # Next steps
        report.append("")
        report.append("📋 NEXT STEPS")
        report.append("-" * 30)
        
        if overall_success:
            report.append("1. Deploy to staging environment for final validation")
            report.append("2. Set up production monitoring and alerting")
            report.append("3. Prepare rollback procedures")
            report.append("4. Schedule production deployment")
        else:
            report.append("1. Address failed test cases based on error messages")
            report.append("2. Re-run integration tests after fixes")
            report.append("3. Consider running tests in different environments")
            report.append("4. Review system requirements and dependencies")
        
        report.append("")
        report.append("📁 TEST ARTIFACTS")
        report.append("-" * 30)
        report.append("All detailed test results, logs, and reports are available in:")
        report.append(f"{self.output_dir.absolute()}")
        report.append("")
        report.append("Key files:")
        report.append("• integration_test_report.txt - Core integration test details")
        report.append("• agent_lifecycle_report.txt - Agent management test details")
        report.append("• performance_test_report.txt - Performance test details")
        report.append("• integration_test.log - Complete execution log")
        
        report.append("")
        report.append("=" * 90)
        
        return "\n".join(report)
    
    def save_master_results(self) -> Path:
        """Save comprehensive test results to files"""
        
        # Generate master report
        master_report = self.generate_master_report()
        
        # Save master report
        master_report_file = self.output_dir / "MASTER_INTEGRATION_TEST_REPORT.txt"
        master_report_file.write_text(master_report)
        
        # Save summary JSON
        summary_data = {
            'execution_info': {
                'start_time': self.start_time,
                'end_time': self.end_time,
                'total_duration_seconds': self.end_time - self.start_time if self.end_time > 0 else 0,
                'ci_mode': self.ci_mode,
                'verbose': self.verbose
            },
            'overall_results': {
                'total_suites': len(self.suite_results),
                'successful_suites': sum(1 for r in self.suite_results if r.success),
                'failed_suites': sum(1 for r in self.suite_results if not r.success),
                'total_tests': sum(r.tests_run for r in self.suite_results),
                'total_passed': sum(r.tests_passed for r in self.suite_results),
                'total_failed': sum(r.tests_failed for r in self.suite_results),
                'overall_success': all(r.success for r in self.suite_results)
            },
            'suite_results': [
                {
                    'suite_name': r.suite_name,
                    'success': r.success,
                    'duration_seconds': r.duration_seconds,
                    'tests_run': r.tests_run,
                    'tests_passed': r.tests_passed,
                    'tests_failed': r.tests_failed,
                    'error_message': r.error_message,
                    'has_detailed_results': bool(r.detailed_results)
                } for r in self.suite_results
            ]
        }
        
        summary_file = self.output_dir / "master_test_summary.json"
        summary_file.write_text(json.dumps(summary_data, indent=2))
        
        return master_report_file


async def main():
    """Main entry point for integration test runner"""
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Visual Agent Management Platform - Master Integration Test Runner"
    )
    parser.add_argument(
        '--categories', 
        type=str,
        help='Comma-separated list of test categories to run'
    )
    parser.add_argument(
        '--skip-slow',
        action='store_true',
        help='Skip performance and load tests'
    )
    parser.add_argument(
        '--parallel',
        action='store_true',
        help='Run test suites in parallel where possible'
    )
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path('integration_test_results'),
        help='Directory for test results'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--ci',
        action='store_true',
        help='Run in CI/CD mode (shorter timeouts, no interactive prompts)'
    )
    
    args = parser.parse_args()
    
    # Parse categories
    categories = None
    if args.categories:
        categories = [c.strip() for c in args.categories.split(',')]
    
    print("🚀 Visual Agent Management Platform")
    print("=" * 60)
    print("Master Integration Test Suite")
    print("=" * 60)
    print(f"Output Directory: {args.output_dir.absolute()}")
    print(f"Skip Slow Tests: {args.skip_slow}")
    print(f"Parallel Execution: {args.parallel}")
    print(f"CI Mode: {args.ci}")
    print(f"Verbose Logging: {args.verbose}")
    if categories:
        print(f"Categories: {', '.join(categories)}")
    print("")
    
    # Create test runner
    runner = MasterTestRunner(
        output_dir=args.output_dir,
        verbose=args.verbose,
        ci_mode=args.ci
    )
    
    try:
        # Run all test suites
        results = await runner.run_all_test_suites(
            categories=categories,
            skip_slow=args.skip_slow,
            parallel=args.parallel
        )
        
        # Save results and generate report
        master_report_file = runner.save_master_results()
        
        # Print summary
        print("\n" + "=" * 60)
        print("🏁 TEST EXECUTION COMPLETE")
        print("=" * 60)
        
        successful_suites = sum(1 for r in results if r.success)
        total_suites = len(results)
        overall_success = successful_suites == total_suites
        
        status_icon = "✅" if overall_success else "❌"
        print(f"{status_icon} Overall Status: {'PASS' if overall_success else 'FAIL'}")
        print(f"📊 Test Suites: {successful_suites}/{total_suites} passed")
        print(f"📄 Master Report: {master_report_file.absolute()}")
        print(f"📁 All Results: {args.output_dir.absolute()}")
        print("")
        
        # Print quick summary of each suite
        for result in results:
            status_icon = "✅" if result.success else "❌"
            suite_name = result.suite_name.replace("_", " ").title()
            print(f"{status_icon} {suite_name}: {result.tests_passed}/{result.tests_run}")
        
        print("")
        
        if overall_success:
            print("🎉 All integration tests passed!")
            print("The Visual Agent Management Platform is ready for deployment.")
        else:
            print("⚠️ Some tests failed. Review the detailed reports for issues to address.")
        
        # Return appropriate exit code
        return 0 if overall_success else 1
        
    except KeyboardInterrupt:
        print("\n⏹️ Test execution interrupted by user")
        return 130
    except Exception as e:
        print(f"\n❌ Test execution failed: {e}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)