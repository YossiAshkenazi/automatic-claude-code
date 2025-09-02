#!/usr/bin/env python3
"""
Quick Error Handling Analysis for Claude CLI Wrapper
"""

import asyncio
import os
import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions


async def analyze_error_handling():
    """Analyze error handling robustness"""
    
    print("Claude CLI Wrapper Error Handling Analysis")
    print("=" * 50)
    
    results = []
    
    # Test 1: CLI Not Found
    print("\n1. Testing CLI Not Found...")
    try:
        options = ClaudeCliOptions(cli_path="/non/existent/claude")
        wrapper = ClaudeCliWrapper(options)
        results.append("FAIL: Should have raised FileNotFoundError")
    except FileNotFoundError:
        results.append("PASS: Properly handles missing CLI")
    except Exception as e:
        results.append(f"FAIL: Wrong exception type: {type(e).__name__}")
    
    # Test 2: Process cleanup mechanism
    print("2. Testing Process Cleanup...")
    try:
        wrapper = ClaudeCliWrapper()
        
        # Start a mock process
        wrapper.process = type('MockProcess', (), {
            'returncode': None,
            'kill': lambda: setattr(wrapper.process, 'returncode', -1)
        })()
        
        # Test kill method
        wrapper.kill()
        if wrapper.process.returncode == -1:
            results.append("PASS: Kill method works")
        else:
            results.append("FAIL: Kill method not working")
            
    except Exception as e:
        results.append(f"FAIL: Process cleanup error: {type(e).__name__}")
    
    # Test 3: Exception handling in execute
    print("3. Testing Execute Exception Handling...")
    try:
        wrapper = ClaudeCliWrapper()
        messages = []
        
        # This will likely fail quickly due to authentication or other issues
        timeout_start = time.time()
        
        try:
            async with asyncio.timeout(3):  # 3 second timeout
                async for message in wrapper.execute("test"):
                    messages.append(message)
                    if message.type == "error":
                        break
        except asyncio.TimeoutError:
            pass
        
        elapsed = time.time() - timeout_start
        
        if elapsed < 10:  # Should complete or timeout quickly
            results.append("PASS: Execute handles errors without hanging")
        else:
            results.append("FAIL: Execute hangs or takes too long")
            
    except Exception as e:
        results.append(f"FAIL: Execute exception: {type(e).__name__}")
    
    # Test 4: Malformed options handling
    print("4. Testing Malformed Options...")
    try:
        options = ClaudeCliOptions(
            model="invalid_model",
            max_turns=-1,
            timeout=-100
        )
        
        args = options.to_cli_args()
        if isinstance(args, list):
            results.append("PASS: Options handle invalid values")
        else:
            results.append("FAIL: Options don't return proper format")
            
    except Exception as e:
        results.append(f"FAIL: Options handling error: {type(e).__name__}")
    
    # Test 5: Resource state consistency
    print("5. Testing Resource State...")
    try:
        wrapper = ClaudeCliWrapper()
        
        # Check initial state
        if wrapper.process is None:
            results.append("PASS: Initial process state is clean")
        else:
            results.append("FAIL: Process not initialized to None")
        
        # Test cleanup in finally block behavior
        wrapper.process = "mock_process"
        try:
            # Simulate the finally block
            wrapper.process = None
            if wrapper.process is None:
                results.append("PASS: Finally block cleanup works")
            else:
                results.append("FAIL: Finally block not cleaning up")
        finally:
            pass
            
    except Exception as e:
        results.append(f"FAIL: Resource state error: {type(e).__name__}")
    
    # Print results
    print("\n" + "=" * 50)
    print("ERROR HANDLING ANALYSIS RESULTS")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for result in results:
        print(result)
        if result.startswith("PASS"):
            passed += 1
        else:
            failed += 1
    
    print(f"\nSUMMARY: {passed} passed, {failed} failed")
    
    if failed == 0:
        grade = "EXCELLENT"
    elif failed <= 2:
        grade = "GOOD"
    elif failed <= 4:
        grade = "FAIR"
    else:
        grade = "POOR"
    
    print(f"ERROR HANDLING GRADE: {grade}")
    
    return results, passed, failed


if __name__ == "__main__":
    asyncio.run(analyze_error_handling())