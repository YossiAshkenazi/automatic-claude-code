#!/usr/bin/env python3
"""
Simple Python SDK Demo
Shows basic SDK functionality without unicode characters
"""

import asyncio
from claude_code_sdk import ClaudeCodeClient, ClaudeCodeOptions
from claude_code_sdk.core.messages import ResultMessage
from claude_code_sdk.utils import CLIDetector

async def main():
    print("Python Claude Code SDK - Demo")
    print("=" * 40)
    
    # Test 1: CLI Detection
    print("\n1. Testing CLI Detection:")
    detector = CLIDetector()
    claude_path = await detector.detect_claude_cli()
    if claude_path:
        print(f"   Claude CLI found: {claude_path}")
    else:
        print("   Claude CLI not found")
        return
    
    # Test 2: Options Configuration
    print("\n2. Creating Options:")
    options = ClaudeCodeOptions(
        model="sonnet",
        verbose=True,
        max_turns=10
    )
    print(f"   Model: {options.model}")
    print(f"   Max turns: {options.max_turns}")
    print(f"   CLI args: {' '.join(options.get_cli_args())}")
    
    # Test 3: Message System
    print("\n3. Testing Messages:")
    msg = ResultMessage(result="Hello from SDK!", token_count=5)
    print(f"   Message type: {msg.type}")
    print(f"   Message content: {msg.result}")
    print(f"   JSON: {msg.to_json()}")
    
    # Test 4: Client Creation
    print("\n4. Creating Client:")
    try:
        async with ClaudeCodeClient(options) as client:
            print("   Client created successfully")
            print(f"   CLI path: {client._claude_cli_path}")
            print("   Ready for queries (requires authentication)")
    except Exception as e:
        print(f"   Client creation failed: {e}")
    
    print("\nDemo completed!")
    print("\nTo use with actual Claude queries:")
    print("1. Make sure you're authenticated with Claude CLI")
    print("2. Use client.query('your prompt here') or client.query_stream()")
    print("3. Check the monitoring dashboard at http://localhost:6011")

if __name__ == "__main__":
    asyncio.run(main())