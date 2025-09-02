#!/usr/bin/env python3
"""Debug script to capture and analyze Claude CLI output"""

import asyncio
import subprocess
import json
import sys

async def debug_claude_output():
    """Capture raw Claude CLI output to understand the structure"""
    
    # Run a simple Claude CLI command and capture raw output
    claude_path = "C:\\Users\\yossi\\AppData\\Roaming\\npm\\claude.CMD"
    
    cmd = [
        claude_path,
        "--allowed-tools", "Read,Write,Edit,Bash",
        "--verbose",
        "What is 2+2?"
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    print("=" * 50)
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Read all output
        stdout, stderr = await process.communicate()
        
        print("STDOUT:")
        print("-" * 30)
        stdout_text = stdout.decode('utf-8', errors='replace')
        for i, line in enumerate(stdout_text.splitlines(), 1):
            print(f"{i:3d}: {repr(line)}")
            
            # Try to parse each line as JSON
            if line.strip():
                try:
                    data = json.loads(line)
                    print(f"     JSON: {type(data)} - {data}")
                except json.JSONDecodeError:
                    print(f"     TEXT: {line}")
        
        print("\nSTDERR:")
        print("-" * 30)
        stderr_text = stderr.decode('utf-8', errors='replace')
        for i, line in enumerate(stderr_text.splitlines(), 1):
            print(f"{i:3d}: {repr(line)}")
        
        print(f"\nReturn code: {process.returncode}")
        
    except Exception as e:
        print(f"Error running Claude CLI: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_claude_output())