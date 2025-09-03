#!/usr/bin/env python3
"""
Fix execute_sync by using a more direct approach
"""

import asyncio
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

async def test_fixed_execute_sync():
    """Test a direct fix for execute_sync"""
    
    print("=== Test Fixed execute_sync ===")
    
    wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(
        model="claude:sonnet",
        max_turns=2, 
        allowed_tools=["Read", "Write"],
        timeout=30
    ))
    
    underlying = wrapper._get_underlying_wrapper()
    
    prompt = "Create a simple user story for: User needs to reset forgotten password"
    
    # Method 1: Direct approach (we know this works)
    print("Method 1: Direct underlying.execute() - KNOWN TO WORK")
    async for message in underlying.execute(prompt):
        if message.type == "result":
            print(f"Direct result: {message.content[:200]}...")
            break
    
    # Method 2: Create our own execute_sync implementation
    print("\nMethod 2: Custom execute_sync implementation")
    
    async def custom_execute_sync(wrapper_instance, prompt_text):
        """Custom implementation that should work"""
        output_parts = []
        
        async for msg in wrapper_instance.execute(prompt_text):
            print(f"Custom - processing message: {msg.type}, content_len: {len(msg.content)}")
            if msg.type in ["stream", "result"] and msg.content:
                output_parts.append(msg.content)
            elif msg.type == "error":
                print(f"Custom - Error: {msg.content}")
        
        return "\n".join(output_parts)
    
    # Create a NEW wrapper instance to avoid any state issues
    wrapper2 = UnifiedCliWrapper.create(UnifiedCliOptions(
        model="claude:sonnet",
        max_turns=2,
        allowed_tools=["Read", "Write"], 
        timeout=30
    ))
    
    underlying2 = wrapper2._get_underlying_wrapper()
    custom_result = await custom_execute_sync(underlying2, prompt)
    
    print(f"Custom result length: {len(custom_result)}")
    if custom_result:
        print(f"Custom result: {custom_result[:200]}...")
    else:
        print("Custom result is empty")
    
    # Cleanup
    await underlying.cleanup()
    await underlying2.cleanup()

if __name__ == "__main__":
    asyncio.run(test_fixed_execute_sync())