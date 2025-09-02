#!/usr/bin/env python3
"""
Interactive Demo of Claude Code Python SDK
This demo shows the SDK's capabilities without requiring Claude CLI
"""

import asyncio
import time
from typing import AsyncGenerator

# Import the SDK
from claude_code_sdk import (
    ClaudeSDKClient,
    ClaudeCodeOptions,
    ResultMessage,
    ErrorMessage,
    create_development_options
)
from claude_code_sdk.integrations import AutomaticClaudeIntegration

class DemoClient:
    """Demo client that simulates Claude responses"""
    
    def __init__(self):
        self.options = create_development_options()
        self.integration = AutomaticClaudeIntegration(
            enable_monitoring=True,
            enable_dual_agent=False
        )
        
    async def demo_simple_query(self):
        """Demonstrate a simple query simulation"""
        print("\n" + "="*60)
        print("DEMO 1: Simple Query Simulation")
        print("="*60)
        
        prompt = "Create a Python function to calculate factorial"
        print(f"\nPrompt: {prompt}")
        print("\nSimulated response:")
        print("-"*40)
        
        # Simulate streaming response
        response_parts = [
            "Here's a Python function to calculate factorial:\n\n",
            "```python\n",
            "def factorial(n):\n",
            "    if n < 0:\n",
            "        raise ValueError('Factorial not defined for negative numbers')\n",
            "    elif n == 0 or n == 1:\n",
            "        return 1\n",
            "    else:\n",
            "        return n * factorial(n - 1)\n",
            "```\n\n",
            "This recursive implementation handles edge cases and calculates n!"
        ]
        
        for part in response_parts:
            print(part, end='', flush=True)
            await asyncio.sleep(0.1)  # Simulate streaming delay
        
        print("\n" + "-"*40)
        print("Response complete!")
    
    async def demo_integration_features(self):
        """Demonstrate integration features"""
        print("\n" + "="*60)
        print("DEMO 2: Integration Features")
        print("="*60)
        
        # Show session management
        session_id = self.integration.create_session()
        print(f"\nSession created: {session_id}")
        
        # Show statistics
        stats = self.integration.get_statistics()
        print("\nIntegration Statistics:")
        print(f"  - Total executions: {stats['total_executions']}")
        print(f"  - Success rate: {stats['success_rate']:.0%}")
        print(f"  - Monitoring enabled: {stats['monitoring_enabled']}")
        print(f"  - Dual-agent enabled: {stats['dual_agent_enabled']}")
        
        # Simulate an execution
        print("\nSimulating task execution...")
        self.integration._stats['total_executions'] += 1
        self.integration._stats['successful_executions'] += 1
        
        # Show updated stats
        updated_stats = self.integration.get_statistics()
        print(f"  - Executions after simulation: {updated_stats['total_executions']}")
        print(f"  - New success rate: {updated_stats['success_rate']:.0%}")
    
    async def demo_error_handling(self):
        """Demonstrate error handling"""
        print("\n" + "="*60)
        print("DEMO 3: Error Handling")
        print("="*60)
        
        from claude_code_sdk import (
            ClaudeTimeoutError,
            ClaudeAuthError,
            is_recoverable_error,
            classify_error
        )
        
        # Demonstrate different error types
        errors = [
            ClaudeTimeoutError("Operation timed out after 30 seconds"),
            ClaudeAuthError("Invalid API key provided"),
        ]
        
        for error in errors:
            error_info = classify_error(error)
            recoverable = is_recoverable_error(error)
            
            print(f"\nError: {error}")
            print(f"  - Type: {error_info['error_type']}")
            print(f"  - Recoverable: {recoverable}")
            print(f"  - Suggested action: {error_info['suggested_action']}")
    
    async def demo_configuration(self):
        """Demonstrate configuration options"""
        print("\n" + "="*60)
        print("DEMO 4: Configuration Options")
        print("="*60)
        
        from claude_code_sdk import (
            create_development_options,
            create_production_options,
            create_dual_agent_options,
            create_streaming_options
        )
        
        configs = [
            ("Development", create_development_options()),
            ("Production", create_production_options()),
            ("Dual-Agent (Manager)", create_dual_agent_options("manager")),
            ("Streaming", create_streaming_options()),
        ]
        
        for name, config in configs:
            print(f"\n{name} Configuration:")
            print(f"  - Verbose: {config.verbose}")
            print(f"  - Timeout: {config.timeout}ms")
            if hasattr(config, 'skip_permissions'):
                print(f"  - Skip permissions: {config.skip_permissions}")
            if hasattr(config, 'enable_dual_agent'):
                print(f"  - Dual-agent: {config.enable_dual_agent}")

async def main():
    """Run the interactive demo"""
    print("\n" + "="*60)
    print("Claude Code Python SDK - Interactive Demo")
    print("="*60)
    print("\nThis demo showcases the SDK's capabilities.")
    print("Note: Actual Claude responses require Claude CLI installation.")
    
    demo = DemoClient()
    
    # Run demos
    await demo.demo_simple_query()
    await demo.demo_integration_features()
    await demo.demo_error_handling()
    await demo.demo_configuration()
    
    print("\n" + "="*60)
    print("Demo Complete!")
    print("="*60)
    print("\nTo use with real Claude CLI:")
    print("1. Install Claude CLI: npm install -g @anthropic-ai/claude-code")
    print("2. Run: python examples/basic_usage.py")
    print("\nFor ACC integration:")
    print("Run automatic-claude-code and use the SDK within that context.")
    
    return True

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nDemo interrupted by user.")
    except Exception as e:
        print(f"\nError running demo: {e}")
        import traceback
        traceback.print_exc()