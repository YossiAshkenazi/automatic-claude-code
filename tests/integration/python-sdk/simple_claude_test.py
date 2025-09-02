#!/usr/bin/env python3
"""
Simple test to see if we can authenticate with Claude CLI
"""
import subprocess
import os
import sys

# Fix encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def test_claude():
    """Test Claude CLI functionality"""
    print("SIMPLE CLAUDE CLI TEST")
    print("=" * 30)

    # Test 1: Can we run claude with full path?
    claude_path = r"C:\Users\yossi\AppData\Roaming\npm\claude.cmd"

    print(f"\n1. Testing Claude CLI at: {claude_path}")

    try:
        result = subprocess.run([claude_path, '--version'], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            print(f"[OK] Version: {result.stdout.strip()}")
            
            # Test 2: Try a simple interactive command
            print("\n2. Testing simple query...")
            print("   Sending: 'What is 2+2? Just the number please.'")
            
            # Try with timeout
            try:
                result = subprocess.run([
                    claude_path,
                    "What is 2+2? Just the number please."
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0 and result.stdout:
                    print(f"[SUCCESS] Claude responded: {result.stdout.strip()}")
                    print("\nYour Claude CLI is working!")
                    print("Now your SDK should work too!")
                    return True
                else:
                    print(f"[INFO] Claude exit code: {result.returncode}")
                    print(f"[INFO] stdout: {result.stdout[:200] if result.stdout else 'None'}")  
                    print(f"[INFO] stderr: {result.stderr[:200] if result.stderr else 'None'}")
                    
                    if result.stderr and "authentication" in result.stderr.lower():
                        print("\n[AUTH] Authentication needed!")
                        print("Run: claude setup-token")
                        return False
                        
            except subprocess.TimeoutExpired:
                print("[TIMEOUT] Command timed out - likely authentication issue")
                print("Try: claude setup-token")
                return False
                
        else:
            print(f"[FAIL] Claude version check failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

if __name__ == "__main__":
    success = test_claude()
    
    if success:
        print("\n" + "=" * 50)
        print("READY TO TEST YOUR SDK!")
        print("Run: python final_sdk_test.py")
    else:
        print("\n" + "=" * 50)
        print("Claude CLI needs setup")
        print("Run: claude setup-token")
        
    sys.exit(0 if success else 1)