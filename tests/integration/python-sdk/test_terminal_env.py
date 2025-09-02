#!/usr/bin/env python3
"""
Test Claude CLI with proper terminal environment
Simulate how terminal calls Claude CLI
"""

import subprocess
import shutil
import os

def test_with_terminal_env():
    """Test with terminal-like environment"""
    print("Testing Claude CLI with terminal environment...")
    
    claude_path = shutil.which('claude')
    if not claude_path:
        print("[FAIL] Claude CLI not found")
        return False
    
    # Set up environment like terminal would
    env = os.environ.copy()
    env.update({
        'FORCE_COLOR': '1',
        'TERM': 'xterm-256color',
        'SHELL': 'cmd.exe' if os.name == 'nt' else '/bin/bash',
    })
    
    try:
        # Use cmd /c on Windows to simulate terminal
        if os.name == 'nt':
            cmd = ['cmd', '/c', claude_path, '--version']
        else:
            cmd = [claude_path, '--version']
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
            env=env
        )
        
        if result.returncode == 0:
            print(f"[SUCCESS] Version with terminal env: {result.stdout.strip()}")
            
            # Now try actual query
            print("Trying query with terminal environment...")
            
            if os.name == 'nt':
                query_cmd = ['cmd', '/c', claude_path, '--dangerously-skip-permissions', '--output-format', 'text', 'what is 2+2?']
            else:
                query_cmd = [claude_path, '--dangerously-skip-permissions', '--output-format', 'text', 'what is 2+2?']
            
            query_result = subprocess.run(
                query_cmd,
                capture_output=True,
                text=True,
                timeout=30,
                env=env
            )
            
            if query_result.returncode == 0:
                print(f"[SUCCESS] Query worked! Response: {query_result.stdout}")
                return True
            else:
                print(f"[FAIL] Query failed: {query_result.stderr}")
                return False
        else:
            print(f"[FAIL] Version check failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Terminal env test failed: {e}")
        return False

def create_working_sdk_example():
    """Create a simple working example of how to call Claude from Python"""
    print("\n" + "="*50)
    print("  CREATING WORKING SDK EXAMPLE")
    print("="*50)
    
    code = '''
import subprocess
import shutil

def claude_query(prompt):
    """Simple function to query Claude that actually works"""
    claude_path = shutil.which('claude')
    if not claude_path:
        return None, "Claude CLI not found"
    
    # The approach that works based on our testing
    cmd = ['cmd', '/c', claude_path, '--dangerously-skip-permissions', '--output-format', 'text', prompt]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return result.stdout.strip(), None
        else:
            return None, result.stderr
    except Exception as e:
        return None, str(e)

# Test the function
response, error = claude_query("What is 5+5?")
if response:
    print(f"Claude says: {response}")
else:
    print(f"Error: {error}")
'''
    
    with open('working_claude_example.py', 'w') as f:
        f.write(code)
    
    print("Created working_claude_example.py")
    print("This shows how to call Claude CLI that actually works!")

def main():
    print("="*50)
    print("  CLAUDE CLI SUBPROCESS DEBUGGING")  
    print("="*50)
    
    print("The issue: Claude CLI works in terminal but not from Python subprocess")
    print("Testing terminal environment approach...")
    
    if test_with_terminal_env():
        print("\n[SUCCESS] Found working approach!")
        print("Claude CLI works when called with cmd /c on Windows")
        create_working_sdk_example()
        
        print("\nTO FIX YOUR SDK:")
        print("1. Modify subprocess calls to use: ['cmd', '/c', claude_path, ...args]")
        print("2. Add --dangerously-skip-permissions flag")
        print("3. Add --output-format text flag")
        print("4. Set proper timeout (30+ seconds)")
        
    else:
        print("\n[FAIL] Still not working")
        print("This might be a fundamental authentication issue")
        print("\nTry these steps:")
        print("1. Run 'claude' in terminal and verify it opens properly")
        print("2. Check if you see any authentication prompts")
        print("3. Try 'claude config list' to see settings")

if __name__ == "__main__":
    main()