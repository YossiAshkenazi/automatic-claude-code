#!/usr/bin/env python3
"""
Integration Examples with Automatic Claude Code System
Demonstrates dual-agent architecture and monitoring integration
"""

import asyncio
import time
from claude_code_sdk.integrations import AutomaticClaudeIntegration, MonitoringIntegration
from claude_code_sdk import ClaudeSDKClient, create_dual_agent_options

async def example_1_basic_integration():
    """Example 1: Basic integration with monitoring"""
    print("🔹 Example 1: Basic Integration with Monitoring")
    
    try:
        integration = AutomaticClaudeIntegration(
            dashboard_url="http://localhost:6011",
            api_url="http://localhost:4005",
            enable_monitoring=True,
            enable_dual_agent=False  # Single agent mode
        )
        
        print(f"[STATS] Dashboard: {integration.dashboard_url}")
        print(f"🔗 API URL: {integration.api_url}")
        
        # Execute task with monitoring
        start_time = time.time()
        result = await integration.execute_with_monitoring(
            "Create a simple Python function to validate email addresses using regex",
            agent_role="worker",
            timeout=120
        )
        
        execution_time = time.time() - start_time
        
        print(f"[OK] Task completed in {execution_time:.2f}s")
        print(f"[RESULT] Success: {result.get('success', False)}")
        if result.get('final_result'):
            print(f"[NOTE] Result preview: {result['final_result'][:200]}...")
        
        # Get execution statistics
        stats = result.get('statistics', {})
        print(f"📈 Statistics: {len(stats)} metrics collected")
        
        return result
        
    except Exception as e:
        print(f"[FAIL] Basic integration failed: {e}")
        return None

async def example_2_dual_agent_coordination():
    """Example 2: Dual-agent coordination"""
    print("\n🔹 Example 2: Dual-Agent Coordination")
    
    try:
        integration = AutomaticClaudeIntegration(
            enable_dual_agent=True,
            enable_monitoring=True,
            manager_model="opus",  # Higher capability for management
            worker_model="sonnet"  # Efficient for execution
        )
        
        print("🤖 Dual-agent system initialized")
        print("🧠 Manager: Opus model (strategic planning)")
        print("[FAST] Worker: Sonnet model (efficient execution)")
        
        # Execute complex task requiring coordination
        result = await integration.execute_dual_agent_session(
            "Create a complete REST API with authentication, user management, and database integration using FastAPI",
            max_iterations=10,
            coordination_timeout=300
        )
        
        print(f"[OK] Dual-agent session completed")
        print(f"[RESULT] Success: {result.get('success', False)}")
        print(f"[RETRY] Iterations: {result.get('total_iterations', 0)}")
        print(f"[TIME] Total time: {result.get('total_time', 0):.2f}s")
        
        # Coordination statistics
        coordination = result.get('coordination_stats', {})
        if coordination:
            print(f"[STATS] Manager-Worker exchanges: {coordination.get('exchanges', 0)}")
            print(f"[RESULT] Task completion rate: {coordination.get('completion_rate', 0):.2%}")
        
        return result
        
    except Exception as e:
        print(f"[FAIL] Dual-agent coordination failed: {e}")
        return None

async def example_3_real_time_monitoring():
    """Example 3: Real-time monitoring integration"""
    print("\n🔹 Example 3: Real-Time Monitoring")
    
    try:
        monitoring = MonitoringIntegration(
            monitoring_port=6011,
            api_port=4005,
            websocket_enabled=True
        )
        
        # Check monitoring server health
        health = await monitoring.get_health()
        print(f"🏥 Monitoring health: {health.get('status', 'unknown')}")
        
        if health.get('status') == 'healthy':
            print("[STATS] Monitoring server is running")
            
            # Send custom events
            await monitoring.send_event("sdk_example_start", {
                "example": "real_time_monitoring",
                "timestamp": time.time()
            })
            
            # Monitor a task execution
            start_time = time.time()
            
            # Use regular SDK client with monitoring
            options = create_dual_agent_options("worker")
            async with ClaudeSDKClient(options) as client:
                async for message in client.query("Create a Python script for web scraping with error handling"):
                    # Send progress events
                    await monitoring.track_query_performance(
                        duration=time.time() - start_time,
                        message_type=type(message).__name__,
                        agent_role="worker"
                    )
                    
                    if hasattr(message, 'result') and message.result:
                        break
            
            execution_time = time.time() - start_time
            
            # Send completion event
            await monitoring.send_event("sdk_example_complete", {
                "example": "real_time_monitoring", 
                "execution_time": execution_time,
                "success": True
            })
            
            # Get metrics summary
            metrics = await monitoring.get_metrics_summary()
            print(f"📈 Metrics collected: {len(metrics)} data points")
            
            print(f"[OK] Real-time monitoring completed in {execution_time:.2f}s")
            
        else:
            print("[WARN] Monitoring server not available - running without monitoring")
            
    except Exception as e:
        print(f"[FAIL] Real-time monitoring failed: {e}")

async def example_4_performance_tracking():
    """Example 4: Performance tracking and optimization"""
    print("\n🔹 Example 4: Performance Tracking")
    
    class PerformanceTracker:
        def __init__(self):
            self.metrics = {
                'query_count': 0,
                'total_time': 0,
                'average_response_time': 0,
                'token_usage': 0,
                'error_count': 0
            }
        
        async def track_query(self, query_func, *args, **kwargs):
            start_time = time.time()
            self.metrics['query_count'] += 1
            
            try:
                result = await query_func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                self.metrics['total_time'] += execution_time
                self.metrics['average_response_time'] = (
                    self.metrics['total_time'] / self.metrics['query_count']
                )
                
                return result, execution_time
                
            except Exception as e:
                self.metrics['error_count'] += 1
                raise e
        
        def get_performance_report(self):
            return {
                'total_queries': self.metrics['query_count'],
                'total_time': f"{self.metrics['total_time']:.2f}s",
                'average_response': f"{self.metrics['average_response_time']:.2f}s",
                'error_rate': f"{(self.metrics['error_count'] / max(1, self.metrics['query_count'])) * 100:.1f}%",
                'queries_per_minute': f"{(self.metrics['query_count'] / max(1, self.metrics['total_time'])) * 60:.1f}"
            }
    
    tracker = PerformanceTracker()
    
    try:
        integration = AutomaticClaudeIntegration(enable_monitoring=True)
        
        # Track multiple queries
        queries = [
            "Write a Python function to parse CSV files",
            "Create a simple web server using Flask",
            "Implement a binary search algorithm"
        ]
        
        print(f"[STATS] Tracking performance for {len(queries)} queries...")
        
        for i, query_text in enumerate(queries, 1):
            print(f"[RETRY] Query {i}/{len(queries)}: {query_text[:50]}...")
            
            result, exec_time = await tracker.track_query(
                integration.execute_with_monitoring,
                query_text,
                agent_role="worker"
            )
            
            print(f"   [OK] Completed in {exec_time:.2f}s")
        
        # Performance report
        report = tracker.get_performance_report()
        print(f"\n📈 Performance Report:")
        for metric, value in report.items():
            print(f"   {metric.replace('_', ' ').title()}: {value}")
        
    except Exception as e:
        print(f"[FAIL] Performance tracking failed: {e}")

async def example_5_custom_integration():
    """Example 5: Custom integration patterns"""
    print("\n🔹 Example 5: Custom Integration Patterns")
    
    class CustomIntegration:
        def __init__(self):
            self.session_data = {}
            self.event_log = []
        
        async def execute_with_context(self, prompt, context_data=None):
            """Execute with custom context and logging"""
            session_id = f"session_{int(time.time())}"
            self.session_data[session_id] = {
                'start_time': time.time(),
                'context': context_data or {},
                'events': []
            }
            
            try:
                # Log start event
                self.log_event(session_id, "session_start", {"prompt": prompt[:100]})
                
                # Execute with automatic claude integration
                integration = AutomaticClaudeIntegration()
                result = await integration.execute_with_monitoring(
                    prompt,
                    agent_role="worker"
                )
                
                # Log completion
                self.log_event(session_id, "session_complete", {
                    "success": result.get('success', False),
                    "execution_time": time.time() - self.session_data[session_id]['start_time']
                })
                
                return {
                    'session_id': session_id,
                    'result': result,
                    'session_data': self.session_data[session_id]
                }
                
            except Exception as e:
                self.log_event(session_id, "session_error", {"error": str(e)})
                raise
        
        def log_event(self, session_id, event_type, data):
            """Log custom events"""
            event = {
                'session_id': session_id,
                'event_type': event_type,
                'timestamp': time.time(),
                'data': data
            }
            self.event_log.append(event)
            self.session_data[session_id]['events'].append(event)
        
        def get_analytics(self):
            """Get analytics from logged events"""
            return {
                'total_sessions': len(self.session_data),
                'total_events': len(self.event_log),
                'event_types': list(set(event['event_type'] for event in self.event_log)),
                'average_session_time': sum(
                    session['events'][-1]['timestamp'] - session['start_time']
                    for session in self.session_data.values()
                    if session['events']
                ) / max(1, len(self.session_data))
            }
    
    try:
        custom = CustomIntegration()
        
        # Execute multiple tasks with context
        tasks = [
            ("Create a Python data processing pipeline", {"domain": "data_science"}),
            ("Implement a simple chat bot", {"domain": "ai_ml"}),
            ("Write unit tests for a calculator", {"domain": "testing"})
        ]
        
        results = []
        for prompt, context in tasks:
            print(f"[RETRY] Executing: {prompt[:50]}...")
            
            result = await custom.execute_with_context(prompt, context)
            results.append(result)
            
            print(f"   [OK] Session: {result['session_id']}")
            print(f"   [STATS] Events: {len(result['session_data']['events'])}")
        
        # Analytics
        analytics = custom.get_analytics()
        print(f"\n[STATS] Custom Integration Analytics:")
        print(f"   Total Sessions: {analytics['total_sessions']}")
        print(f"   Total Events: {analytics['total_events']}")
        print(f"   Event Types: {', '.join(analytics['event_types'])}")
        print(f"   Avg Session Time: {analytics['average_session_time']:.2f}s")
        
    except Exception as e:
        print(f"[FAIL] Custom integration failed: {e}")

async def main():
    """Run all integration examples"""
    print("🔗 Claude Code SDK - Integration Examples")
    print("=" * 60)
    
    examples = [
        ("Basic Integration", example_1_basic_integration),
        ("Dual-Agent Coordination", example_2_dual_agent_coordination),
        ("Real-Time Monitoring", example_3_real_time_monitoring),
        ("Performance Tracking", example_4_performance_tracking),
        ("Custom Integration", example_5_custom_integration)
    ]
    
    successful = 0
    
    for name, example_func in examples:
        try:
            print(f"\n[START] Running: {name}")
            await example_func()
            print(f"[OK] Completed: {name}")
            successful += 1
        except Exception as e:
            print(f"[FAIL] Failed: {name} - {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print("[STATS] Integration Examples Summary")
    print("=" * 60)
    print(f"[RESULT] Success rate: {successful}/{len(examples)} examples")
    
    if successful == len(examples):
        print("🎉 All integration examples completed!")
        print("🌟 Ready for production dual-agent deployments!")
    elif successful >= 3:
        print("[WARN] Most examples completed. Some features may require monitoring server.")
    else:
        print("🚨 Multiple examples failed. Check automatic-claude-code system setup.")
    
    print("\n[TIP] Tips:")
    print("   • Start monitoring server: cd dual-agent-monitor && npm run dev")
    print("   • Check API health: curl http://localhost:4005/api/health")
    print("   • View dashboard: http://localhost:6011")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️ Integration examples interrupted")
    except Exception as e:
        print(f"💥 Examples crashed: {e}")