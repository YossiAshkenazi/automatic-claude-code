#!/usr/bin/env python3
"""
Debug the execute_sync method specifically
"""

import asyncio
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

async def debug_execute_sync():
    """Debug execute_sync step by step to find the bug"""
    
    print("=== Debug execute_sync Implementation ===")
    
    wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(
        model="claude:sonnet",
        max_turns=2,
        allowed_tools=["Read", "Write"],
        timeout=30
    ))
    
    underlying = wrapper._get_underlying_wrapper()
    
    prompt = "Create a simple user story for: User needs to reset forgotten password"
    
    print("Step 1: Manual implementation of execute_sync logic")
    output = []
    
    async for message in underlying.execute(prompt):
        print(f"Processing message: type='{message.type}', content_length={len(message.content)}")
        
        # This is the exact logic from execute_sync (lines 1288-1290)
        if message.type in ["stream", "result"]:
            print(f"Adding to output: {message.content[:100]}...")
            output.append(message.content)
        else:
            print(f"Skipping message type: {message.type}")
    
    manual_result = "\n".join(output)
    print(f"Manual result length: {len(manual_result)}")
    print(f"Manual result: {manual_result[:200]}...")
    
    print("\nStep 2: Using actual execute_sync method")
    actual_result = await underlying.execute_sync(prompt)
    print(f"Actual result length: {len(actual_result)}")
    print(f"Actual result: {actual_result[:200]}...")
    
    # Cleanup
    await underlying.cleanup()

if __name__ == "__main__":
    asyncio.run(debug_execute_sync())