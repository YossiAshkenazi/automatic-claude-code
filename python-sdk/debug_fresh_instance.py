#!/usr/bin/env python3
"""
Test with completely fresh wrapper instances
"""

import asyncio
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

async def test_fresh_instance():
    """Test with a completely fresh wrapper instance each time"""
    
    print("=== Test Fresh Instance ===")
    
    prompt = "Create a simple user story for: User needs to reset forgotten password"
    
    print("Creating fresh wrapper instance...")
    wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(
        model="claude:sonnet",
        max_turns=2,
        allowed_tools=["Read", "Write"],
        timeout=30
    ))
    
    underlying = wrapper._get_underlying_wrapper()
    
    print("Testing direct stream access...")
    messages = []
    async for message in underlying.execute(prompt):
        messages.append(message)
        print(f"Received: {message.type} - {len(message.content)} chars")
    
    if messages and messages[0].content:
        print(f"SUCCESS: Got content: {messages[0].content[:100]}...")
        
        # Now try execute_sync on a NEW instance
        print("\nCreating SECOND fresh wrapper for execute_sync test...")
        wrapper2 = UnifiedCliWrapper.create(UnifiedCliOptions(
            model="claude:sonnet",
            max_turns=2,
            allowed_tools=["Read", "Write"],
            timeout=30
        ))
        
        result = await wrapper2.execute_sync(prompt)
        print(f"execute_sync result length: {len(result)}")
        if result:
            print(f"execute_sync content: {result[:100]}...")
        else:
            print("execute_sync returned empty result")
            
        await wrapper2._get_underlying_wrapper().cleanup()
    
    await underlying.cleanup()

if __name__ == "__main__":
    asyncio.run(test_fresh_instance())