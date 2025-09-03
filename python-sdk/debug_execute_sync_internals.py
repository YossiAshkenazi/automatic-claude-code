#!/usr/bin/env python3
"""
Debug what happens inside execute_sync method
"""

import asyncio
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

async def debug_execute_sync_internals():
    """Replicate execute_sync logic with debugging"""
    
    print("=== Debug execute_sync Internals ===")
    
    wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(
        model="claude:sonnet", 
        max_turns=2,
        allowed_tools=["Read", "Write"],
        timeout=30
    ))
    
    underlying = wrapper._get_underlying_wrapper()
    
    prompt = "Create a simple user story for: User needs to reset forgotten password"
    
    print("Step 1: Replicating execute_sync logic with debugging...")
    output = []
    message_count = 0
    
    async for message in underlying.execute(prompt):
        message_count += 1
        print(f"Message {message_count}:")
        print(f"  Type: '{message.type}'")
        print(f"  Content length: {len(message.content)}")
        print(f"  Content preview: {message.content[:100]}...")
        
        # Exact execute_sync logic
        if message.type in ["stream", "result"]:
            print(f"  -> Adding to output (current output items: {len(output)})")
            output.append(message.content)
        elif message.type == "error":
            print(f"  -> Error: {message.content}")
        else:
            print(f"  -> Ignoring message type: {message.type}")
    
    result = "\n".join(output)
    print(f"\nFinal result:")
    print(f"  Total messages processed: {message_count}")
    print(f"  Output items collected: {len(output)}")
    print(f"  Final result length: {len(result)}")
    print(f"  Final result: {result[:200]}...")
    
    await underlying.cleanup()

if __name__ == "__main__":
    asyncio.run(debug_execute_sync_internals())