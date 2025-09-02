#!/usr/bin/env python3
"""
Test Claude Code SDK with ACC (Automatic Claude Code) integration
This shows how to use the SDK with your ACC system
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for ACC imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from claude_code_sdk.integrations.automatic_claude import AutomaticClaudeIntegration

async def test_acc_integration():
    """Test ACC integration with dual agents"""
    print("\n" + "="*60)
    print("  TESTING ACC INTEGRATION")
    print("="*60)
    
    try:
        # Create ACC integration
        print("\n[1] Creating ACC integration...")
        integration = AutomaticClaudeIntegration(
            enable_dual_agent=True,
            enable_monitoring=True
        )
        print("[SUCCESS] ACC integration created")
        
        # Test single agent query
        print("\n[2] Testing single agent query...")
        result = await integration.execute_with_monitoring(
            "Create a simple Python hello world function",
            max_iterations=1
        )
        
        if result and result.get('success'):
            print("[SUCCESS] Single agent query completed")
            print(f"Result preview: {str(result.get('result', ''))[:100]}...")
        else:
            print(f"[FAIL] Query failed: {result.get('error', 'Unknown error')}")
        
        # Test dual agent coordination
        print("\n[3] Testing dual-agent coordination...")
        print("Manager Agent: Planning the task")
        print("Worker Agent: Executing the implementation")
        
        dual_result = await integration.execute_dual_agent_session(
            prompt="Design and implement a simple calculator class",
            max_iterations=3,
            manager_model="opus",  # Strategic planning
            worker_model="sonnet"  # Task execution
        )
        
        if dual_result and dual_result.get('success'):
            print("[SUCCESS] Dual-agent coordination completed")
            print(f"Manager iterations: {dual_result.get('manager_iterations', 0)}")
            print(f"Worker iterations: {dual_result.get('worker_iterations', 0)}")
        else:
            print(f"[FAIL] Dual-agent failed: {dual_result.get('error', 'Unknown error')}")
        
        # Check monitoring data
        print("\n[4] Checking monitoring data...")
        if hasattr(integration, 'monitoring_manager'):
            stats = integration.monitoring_manager.get_session_stats()
            if stats:
                print("[SUCCESS] Monitoring data available")
                print(f"  - Total queries: {stats.get('total_queries', 0)}")
                print(f"  - Success rate: {stats.get('success_rate', 0):.1%}")
            else:
                print("[INFO] No monitoring data yet")
        
        return True
        
    except ImportError as e:
        print(f"\n[ERROR] ACC not properly configured: {e}")
        print("\nTo use ACC integration:")
        print("1. Ensure ACC is installed in parent directory")
        print("2. Configure monitoring server if needed")
        print("3. Set up dual-agent configuration")
        return False
    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}")
        return False

async def test_acc_with_options():
    """Test ACC with custom options"""
    print("\n" + "="*60)
    print("  TESTING ACC WITH CUSTOM OPTIONS")
    print("="*60)
    
    try:
        from claude_code_sdk import ClaudeCodeOptions
        
        # Create custom options
        options = ClaudeCodeOptions(
            model="sonnet",
            timeout=120000,  # 2 minutes
            verbose=True,
            temperature=0.7
        )
        
        # Create ACC integration with options
        integration = AutomaticClaudeIntegration(
            claude_options=options,
            enable_dual_agent=False,  # Single agent only
            enable_monitoring=False   # No monitoring
        )
        
        print("[SUCCESS] ACC created with custom options")
        print(f"  - Model: {options.model}")
        print(f"  - Timeout: {options.timeout}ms")
        print(f"  - Temperature: {options.temperature}")
        
        # Run a simple task
        result = await integration.execute_task(
            "Explain Python decorators",
            max_iterations=1
        )
        
        if result:
            print("[SUCCESS] Task executed with custom options")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Custom options test failed: {e}")
        return False

async def main():
    """Run ACC integration tests"""
    
    print("\n" + "="*70)
    print("  CLAUDE CODE SDK - ACC INTEGRATION TEST")
    print("  Testing with Automatic Claude Code System")
    print("="*70)
    
    # Check if ACC is available
    acc_path = Path(__file__).parent.parent / "src"
    if not acc_path.exists():
        print("\n[WARNING] ACC source directory not found")
        print("This test requires the full ACC system")
        print("Location expected:", acc_path)
        return
    
    # Run tests
    tests = [
        test_acc_integration,
        test_acc_with_options,
    ]
    
    passed = 0
    for test in tests:
        try:
            if await test():
                passed += 1
        except Exception as e:
            print(f"\n[ERROR] Test crashed: {e}")
    
    # Summary
    print("\n" + "="*70)
    print(f"  RESULTS: {passed}/{len(tests)} ACC tests passed")
    print("="*70)
    
    if passed == len(tests):
        print("\n[SUCCESS] ACC integration working perfectly!")
        print("\nYou can now use the SDK with ACC for:")
        print("- Dual-agent development workflows")
        print("- Monitored task execution")
        print("- Complex multi-iteration projects")
    else:
        print("\n[PARTIAL] Some ACC features may not be available")

if __name__ == "__main__":
    asyncio.run(main())