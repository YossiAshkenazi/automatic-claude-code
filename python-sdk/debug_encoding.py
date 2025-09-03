#!/usr/bin/env python3
"""
Debug encoding issue with Sarah PO
"""

import asyncio
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

async def debug_encoding():
    """Debug the encoding issue step by step"""
    
    print("=== Debug Encoding Issue ===")
    
    wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(
        model="claude:sonnet",
        max_turns=2,
        allowed_tools=["Read", "Write"],
        timeout=30
    ))
    
    prompt = "Create a simple user story for: User needs to reset forgotten password"
    
    print(f"Executing: {prompt}")
    
    try:
        result = await wrapper.execute_sync(prompt)
        print(f"Raw result type: {type(result)}")
        print(f"Raw result length: {len(result)}")
        
        # Check for problematic characters
        for i, char in enumerate(result):
            if ord(char) > 127:
                print(f"Non-ASCII char at position {i}: {char!r} (ord={ord(char)})")
                if i > 10:  # Stop after first few
                    break
        
        # Try safe printing
        safe_result = result.encode('ascii', errors='replace').decode('ascii')
        print(f"Safe ASCII version:")
        print(safe_result)
        
    except Exception as e:
        print(f"Exception: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        underlying = wrapper._get_underlying_wrapper()
        await underlying.cleanup()

if __name__ == "__main__":
    asyncio.run(debug_encoding())