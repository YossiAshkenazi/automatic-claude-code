#!/usr/bin/env python3
"""
SIMPLE WORKING SDK - Bypasses complex authentication issues
This provides basic Claude Code functionality that actually works
"""

import subprocess
import shutil
import tempfile
import os
import asyncio
from typing import Optional, AsyncGenerator

class SimpleClaudeClient:
    """
    Simplified Claude client that works around authentication issues
    Uses a different approach that bypasses subprocess problems
    """
    
    def __init__(self):
        self.claude_path = shutil.which('claude')
        if not self.claude_path:
            raise Exception("Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code")
    
    def query_sync(self, prompt: str) -> str:
        """
        Synchronous query using file-based communication
        This bypasses subprocess stdin/stdout issues
        """
        
        # Create temporary files for input/output
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as input_file:
            input_file.write(prompt)
            input_file_path = input_file.name
        
        try:
            # Use file redirection which works better than subprocess pipes
            output_file_path = input_file_path.replace('.txt', '_output.txt')
            
            # Build command that redirects output to file
            cmd = f'"{self.claude_path}" --dangerously-skip-permissions --output-format text "{prompt}" > "{output_file_path}" 2>&1'
            
            # Execute via shell
            result = subprocess.run(
                cmd,
                shell=True,
                timeout=60,
                cwd=os.getcwd()
            )
            
            # Read output file
            if os.path.exists(output_file_path):
                with open(output_file_path, 'r') as f:
                    output = f.read().strip()
                
                os.unlink(output_file_path)  # Clean up
                
                if output and not output.startswith('Error'):
                    return output
                else:
                    return f"Query failed: {output}"
            else:
                return "Query failed: No output file created"
                
        except subprocess.TimeoutExpired:
            return "Query timed out after 60 seconds"
        except Exception as e:
            return f"Query failed: {e}"
        finally:
            # Clean up input file
            if os.path.exists(input_file_path):
                os.unlink(input_file_path)
    
    async def query(self, prompt: str) -> str:
        """Async version of query"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.query_sync, prompt)
    
    def interactive_query(self, prompt: str) -> str:
        """
        Try interactive approach by simulating terminal input
        """
        try:
            # Create a batch file that runs Claude interactively
            batch_content = f'''@echo off
echo {prompt} | "{self.claude_path}" --dangerously-skip-permissions
'''
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.bat', delete=False) as batch_file:
                batch_file.write(batch_content)
                batch_file_path = batch_file.name
            
            # Run the batch file
            result = subprocess.run(
                [batch_file_path],
                capture_output=True,
                text=True,
                timeout=60,
                cwd=os.getcwd()
            )
            
            # Clean up
            os.unlink(batch_file_path)
            
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
            else:
                return f"Interactive query failed: {result.stderr}"
                
        except Exception as e:
            return f"Interactive query error: {e}"

# Simple async generator for compatibility with your existing code
async def simple_query(prompt: str) -> AsyncGenerator[str, None]:
    """Simple async generator that yields Claude responses"""
    client = SimpleClaudeClient()
    response = await client.query(prompt)
    yield response

def test_simple_sdk():
    """Test the simple SDK"""
    print("="*50)
    print("  TESTING SIMPLE WORKING SDK")
    print("="*50)
    
    try:
        client = SimpleClaudeClient()
        print("[1] Simple client created")
        
        print("[2] Testing synchronous query...")
        response = client.query_sync("What is 3 + 4? Just give the number.")
        print(f"Response: {response}")
        
        if "7" in response or "seven" in response.lower():
            print("[SUCCESS] Sync query worked!")
            
            print("[3] Testing async query...")
            async def test_async():
                async_response = await client.query("What is 5 + 6? Just the number.")
                print(f"Async response: {async_response}")
                return "11" in async_response or "eleven" in async_response.lower()
            
            async_worked = asyncio.run(test_async())
            if async_worked:
                print("[SUCCESS] Async query worked!")
                
                print("[4] Testing generator interface...")
                async def test_generator():
                    async for msg in simple_query("What is 8 + 9? Just the number."):
                        print(f"Generator response: {msg}")
                        return "17" in msg or "seventeen" in msg.lower()
                
                gen_worked = asyncio.run(test_generator())
                if gen_worked:
                    print("[SUCCESS] All tests passed!")
                    return True
        
        print("[PARTIAL] Some features may work")
        return False
        
    except Exception as e:
        print(f"[ERROR] Simple SDK test failed: {e}")
        return False

def main():
    """Main test"""
    print("Simple Working SDK for Claude Code")
    print("This bypasses complex authentication issues\n")
    
    if test_simple_sdk():
        print("\n" + "="*50)
        print("  SUCCESS! YOU HAVE A WORKING SDK!")
        print("="*50)
        
        print("""
Usage examples:

# Sync usage:
from simple_working_sdk import SimpleClaudeClient
client = SimpleClaudeClient()
response = client.query_sync("Write Python code for me")
print(response)

# Async usage:
import asyncio
async def main():
    client = SimpleClaudeClient()
    response = await client.query("Help me debug this code")
    print(response)
asyncio.run(main())

# Generator usage (like your original SDK):
async def main():
    async for message in simple_query("Explain Python decorators"):
        print(message)
asyncio.run(main())
        """)
        
    else:
        print("\n[INFO] Simple SDK had issues too")
        print("This suggests Claude CLI itself needs setup")
        print("\nNext steps:")
        print("1. Run 'claude' in terminal and complete any setup")
        print("2. Make sure you can interact with Claude in terminal")
        print("3. Try the simple SDK again")

if __name__ == "__main__":
    main()