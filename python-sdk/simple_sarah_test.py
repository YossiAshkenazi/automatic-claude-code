#!/usr/bin/env python3
"""
Simple Sarah test with shorter prompts and longer timeout
"""

import asyncio
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def simple_sarah_test():
    """Test with simple prompts first"""
    
    print("=== Simple Sarah Test ===")
    
    wrapper = ClaudeCliWrapper(ClaudeCliOptions(
        model="sonnet",
        max_turns=1,
        allowed_tools=["Read", "Write"],
        timeout=60  # Longer timeout
    ))
    
    try:
        # Test 1: Very simple story prompt
        print("Test 1: Simple story prompt")
        simple_prompt = "Write a short user story for password reset"
        result1 = await wrapper.execute_sync(simple_prompt)
        print(f"Result 1 length: {len(result1)}")
        if result1:
            print(f"Result 1: {result1[:200]}...")
        else:
            print("Empty result 1")
        
        print("\n" + "="*50)
        
        # Test 2: Minimal story prompt
        print("Test 2: Minimal story prompt")  
        minimal_prompt = "Create user story: user forgets password"
        result2 = await wrapper.execute_sync(minimal_prompt)
        print(f"Result 2 length: {len(result2)}")
        if result2:
            print(f"Result 2: {result2}")
        else:
            print("Empty result 2")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await wrapper.cleanup()

if __name__ == "__main__":
    asyncio.run(simple_sarah_test())