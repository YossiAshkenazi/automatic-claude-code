#!/usr/bin/env python3
"""
Compare UnifiedCliWrapper vs direct ClaudeCliWrapper
"""

import asyncio
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def compare_wrappers():
    """Compare the two wrapper approaches"""
    
    print("=== Wrapper Comparison ===")
    
    prompt = "Create a simple user story for: User needs to reset forgotten password"
    
    # Test 1: Direct ClaudeCliWrapper (like debug_sarah.py used)
    print("\n--- Test 1: Direct ClaudeCliWrapper ---")
    try:
        direct_options = ClaudeCliOptions(
            model="sonnet",
            max_turns=2,
            allowed_tools=["Read", "Write"],
            timeout=30
        )
        direct_wrapper = ClaudeCliWrapper(direct_options)
        
        direct_result = await direct_wrapper.execute_sync(prompt)
        print(f"Direct result length: {len(direct_result)}")
        print(f"Direct result preview: {direct_result[:200]}...")
        
        await direct_wrapper.cleanup()
        
    except Exception as e:
        print(f"Direct wrapper error: {e}")
    
    # Test 2: UnifiedCliWrapper (what Sarah PO uses)
    print("\n--- Test 2: UnifiedCliWrapper ---")
    try:
        unified_options = UnifiedCliOptions(
            model="claude:sonnet",
            max_turns=2,
            allowed_tools=["Read", "Write"],
            timeout=30
        )
        unified_wrapper = UnifiedCliWrapper.create(unified_options)
        
        unified_result = await unified_wrapper.execute_sync(prompt)
        print(f"Unified result length: {len(unified_result)}")
        print(f"Unified result preview: {unified_result[:200]}...")
        
        underlying = unified_wrapper._get_underlying_wrapper()
        await underlying.cleanup()
        
    except Exception as e:
        print(f"Unified wrapper error: {e}")

if __name__ == "__main__":
    asyncio.run(compare_wrappers())