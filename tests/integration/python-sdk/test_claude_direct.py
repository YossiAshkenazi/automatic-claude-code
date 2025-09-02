#!/usr/bin/env python3
"""
Test Claude CLI directly - Windows compatible
Find the exact issue with SDK connection
"""

import subprocess
import shutil
import os

def main():
    print("="*50)
    print("  CLAUDE CLI DIRECT TEST")
    print("="*50)
    
    # Find Claude CLI
    claude_path = shutil.which('claude')
    if not claude_path:
        print("[FAIL] Claude CLI not found")
        return
    
    print(f"[FOUND] Claude CLI at: {claude_path}")
    
    # Test version (should work)
    print("\n[TEST 1] Version check...")
    try:
        result = subprocess.run([claude_path, '--version'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"[PASS] Version: {result.stdout.strip()}")
        else:
            print(f"[FAIL] {result.stderr}")
            return
    except Exception as e:
        print(f"[ERROR] {e}")
        return
    
    # The key test - try with flags that should work
    print("\n[TEST 2] Query with safe flags...")
    
    cmd = [
        claude_path,
        '--dangerously-skip-permissions',  # Skip permission dialogs
        '--output-format', 'text',
        'what is 2+2?'
    ]
    
    print(f"Command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.getcwd()
        )
        
        if result.returncode == 0:
            print("[SUCCESS] Got response!")
            print(f"Response: {result.stdout.strip()}")
            print("\nThis means your SDK can work!")
            print("SDK just needs these flags:")
            print("- --dangerously-skip-permissions")
            print("- --output-format text")
        else:
            print(f"[FAIL] Return code: {result.returncode}")
            print(f"Stderr: {result.stderr}")
            
    except subprocess.TimeoutExpired:
        print("[TIMEOUT] Claude CLI hanging - authentication issue")
    except Exception as e:
        print(f"[ERROR] {e}")

if __name__ == "__main__":
    main()