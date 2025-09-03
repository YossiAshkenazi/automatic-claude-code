#!/usr/bin/env python3
"""
Check Claude CLI authentication status
"""

import subprocess
import sys
import os

# Fix encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def check_claude_auth():
    """Check if Claude CLI needs authentication"""
    print("CHECKING CLAUDE CLI AUTHENTICATION")
    print("=" * 40)
    
    print("\n1. Testing Claude CLI basic response...")
    
    try:
        # Try to run Claude with a simple help command
        result = subprocess.run([
            'claude', '--help'
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            print("[OK] Claude CLI responds to --help")
        else:
            print(f"[FAIL] Claude CLI help failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Claude CLI help test failed: {e}")
        return False
    
    print("\n2. Testing if Claude CLI needs authentication...")
    
    try:
        # Try to run a simple interactive command with timeout
        # If it hangs, it's likely waiting for authentication
        process = subprocess.Popen([
            'claude'
        ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, 
           stderr=subprocess.PIPE, text=True)
        
        # Send a simple message and wait briefly
        try:
            stdout, stderr = process.communicate(input="test\n/exit\n", timeout=15)
            
            if process.returncode == 0:
                print("[OK] Claude CLI interactive mode working")
                print("Response preview:", stdout[:100] if stdout else "No output")
                return True
            else:
                print("[FAIL] Claude CLI interactive failed")
                print("Error:", stderr[:200] if stderr else "No error output")
                
                # Check for common authentication messages
                if stderr and any(word in stderr.lower() for word in ['auth', 'login', 'token', 'sign']):
                    print("\n[AUTH NEEDED] Authentication required!")
                    print("Fix: claude setup-token")
                    return False
                    
        except subprocess.TimeoutExpired:
            process.kill()
            print("[TIMEOUT] Claude CLI seems to be waiting for input")
            print("This usually means authentication is needed")
            print("\nTo fix authentication:")
            print("1. Run: claude setup-token")
            print("2. Follow the browser authentication")
            print("3. Test: claude (should start interactive session)")
            return False
            
    except Exception as e:
        print(f"[ERROR] Authentication test failed: {e}")
        return False
    
    return True

def main():
    auth_ok = check_claude_auth()
    
    if auth_ok:
        print("\n" + "=" * 40)
        print("SUCCESS: Claude CLI is ready!")
        print("Your SDK should work now.")
        print("\nNext steps:")
        print("1. python test_interactive_claude.py")
        print("2. python final_sdk_test.py")
    else:
        print("\n" + "=" * 40)
        print("ACTION REQUIRED: Set up Claude CLI authentication")
        print("\nSteps to fix:")
        print("1. claude setup-token")
        print("2. Complete browser authentication")
        print("3. Test: claude (should start interactive mode)")
        print("4. Then test your SDK")
    
    return auth_ok

if __name__ == "__main__":
    main()