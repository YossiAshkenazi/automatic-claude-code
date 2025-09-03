#!/usr/bin/env python3
"""
Focused test for the primary failure case: "Create a simple hello.py file"

This specifically tests the scenario that was failing with 'list' object errors
before the JSON parsing fix in claude_code_sdk/core/messages.py lines 119-133.
"""

import asyncio
import os
import sys
import tempfile
import time
from pathlib import Path
import logging

# Add Python SDK to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_hello_py_creation():
    """Test the specific scenario that was failing before the fix"""
    
    # Create temporary directory
    with tempfile.TemporaryDirectory(prefix="hello_py_test_") as temp_dir:
        temp_path = Path(temp_dir)
        
        # Setup Claude CLI wrapper
        options = ClaudeCliOptions(
            model="sonnet",
            max_turns=3,
            allowed_tools=["Write"],
            verbose=True,
            dangerously_skip_permissions=True,
            working_directory=temp_path,
            timeout=30
        )
        
        wrapper = ClaudeCliWrapper(options)
        
        print(f"Testing hello.py creation in: {temp_path}")
        print(f"Claude CLI path: {wrapper.cli_path}")
        
        # The exact prompt that was causing 'list' object errors
        prompt = "Create a simple hello.py file that prints 'Hello, World!'"
        
        print(f"\nExecuting prompt: {prompt}")
        print("=" * 60)
        
        messages = []
        json_parsing_errors = []
        list_object_errors = []
        
        start_time = time.time()
        
        try:
            async for message in wrapper.execute(prompt):
                messages.append(message)
                print(f"[{message.type.upper()}] {message.content}")
                
                # Check for specific error patterns
                if "list" in message.content.lower() and "object" in message.content.lower():
                    list_object_errors.append(message.content)
                    
                if "json" in message.content.lower() and "parse" in message.content.lower():
                    json_parsing_errors.append(message.content)
                
                # Early termination on auth errors
                if message.type == "auth_error":
                    print("\n[CRITICAL] Authentication error - stopping test")
                    return False, "Authentication error", messages
        
        except Exception as e:
            duration = time.time() - start_time
            print(f"\n[ERROR] Exception during execution: {e}")
            return False, f"Exception: {e}", messages
        
        duration = time.time() - start_time
        
        # Clean up resources
        try:
            await wrapper.cleanup()
        except Exception as cleanup_error:
            print(f"[WARNING] Cleanup error: {cleanup_error}")
        
        # Check results
        print("\n" + "=" * 60)
        print("TEST RESULTS ANALYSIS")
        print("=" * 60)
        
        # Check if hello.py was created
        hello_py_path = temp_path / "hello.py"
        file_created = hello_py_path.exists()
        
        print(f"File created: {file_created}")
        print(f"Execution time: {duration:.2f}s")
        print(f"Total messages: {len(messages)}")
        print(f"JSON parsing errors: {len(json_parsing_errors)}")
        print(f"List object errors: {len(list_object_errors)}")
        
        if file_created:
            try:
                file_content = hello_py_path.read_text()
                print(f"File content:\n{file_content}")
                
                # Check if content is reasonable
                has_print = "print" in file_content.lower()
                has_hello = "hello" in file_content.lower()
                content_valid = has_print and has_hello
                
                print(f"Content validation: print={has_print}, hello={has_hello}, valid={content_valid}")
            except Exception as read_error:
                print(f"Error reading created file: {read_error}")
                content_valid = False
        else:
            content_valid = False
        
        # Determine success
        success = (
            file_created and 
            content_valid and 
            len(list_object_errors) == 0 and
            len(json_parsing_errors) == 0
        )
        
        # Summary
        print("\n" + "=" * 60)
        if success:
            print("[SUCCESS] Test passed - hello.py creation works correctly")
            print("[SUCCESS] No 'list' object errors detected")
            print("[SUCCESS] JSON parsing is working properly")
        else:
            print("[FAIL] Test failed - issues detected:")
            if not file_created:
                print("  - File was not created")
            if not content_valid:
                print("  - File content is invalid")
            if list_object_errors:
                print(f"  - {len(list_object_errors)} 'list' object errors detected")
                for error in list_object_errors:
                    print(f"    * {error}")
            if json_parsing_errors:
                print(f"  - {len(json_parsing_errors)} JSON parsing errors detected")
        
        error_summary = None
        if not success:
            error_parts = []
            if not file_created:
                error_parts.append("file not created")
            if not content_valid:
                error_parts.append("invalid content")
            if list_object_errors:
                error_parts.append(f"{len(list_object_errors)} list errors")
            if json_parsing_errors:
                error_parts.append(f"{len(json_parsing_errors)} JSON errors")
            error_summary = ", ".join(error_parts)
        
        return success, error_summary, messages

async def main():
    print("FOCUSED TEST: Hello.py Creation")
    print("Testing the primary failure case that was fixed")
    print("=" * 60)
    
    try:
        success, error, messages = await test_hello_py_creation()
        
        print("\n" + "=" * 60)
        print("FINAL RESULT")
        print("=" * 60)
        
        if success:
            print("[PASS] The JSON parsing fix is working correctly")
            print("[PASS] Tool operations are functioning without 'list' object errors")
            return 0
        else:
            print(f"[FAIL] Test failed: {error}")
            print("[FAIL] There may still be issues with the JSON parsing fix")
            return 1
    
    except Exception as e:
        print(f"\n[CRITICAL ERROR] Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        return 2

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
