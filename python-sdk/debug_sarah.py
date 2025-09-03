#!/usr/bin/env python3
"""
Debug Sarah PO integration to see what's happening with message types
"""

import asyncio
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

async def debug_sarah_execution():
    """Debug what messages we get from Claude CLI"""
    
    print("=== Debug Sarah Execution ===")
    
    # Use same setup as Sarah PO
    wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(
        model="claude:sonnet",
        max_turns=2,
        allowed_tools=["Read", "Write"],
        timeout=30
    ))
    
    prompt = "Create a simple user story for: User needs to reset forgotten password"
    
    print(f"Executing prompt: {prompt}")
    print("--- Raw message stream ---")
    
    all_messages = []
    
    # Get underlying wrapper to access raw messages
    underlying = wrapper._get_underlying_wrapper()
    
    async for message in underlying.execute(prompt):
        print(f"Message type: {message.type}")
        print(f"Message content: {message.content}")
        print(f"Message data: {getattr(message, 'data', 'No data field')}")
        print("---")
        all_messages.append(message)
    
    print(f"\nTotal messages received: {len(all_messages)}")
    
    # Now test execute_sync
    print("\n--- Testing execute_sync ---")
    result = await wrapper.execute_sync(prompt)
    print(f"execute_sync result: '{result}'")
    
    # Cleanup
    await underlying.cleanup()

if __name__ == "__main__":
    asyncio.run(debug_sarah_execution())