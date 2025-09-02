#!/usr/bin/env python3
"""
Simple Claude CLI diagnostic - Windows compatible
"""

import subprocess
import sys
import os

# Fix encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def test_claude_basic():
    """Test if Claude CLI is available"""
    print("1. Testing Claude CLI availability...")
    
    try:
        result = subprocess.run(['claude', '--version'], 
                              capture_output=True, 
                              text=True, 
                              timeout=15)
        
        if result.returncode == 0:
            print(f"[OK] Claude CLI found: {result.stdout.strip()}")
            return True
        else:
            print(f"[FAIL] Claude CLI error: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("[FAIL] Claude CLI version check timed out")
        return False
    except FileNotFoundError:
        print("[FAIL] Claude CLI not found")
        print("Solution: npm install -g @anthropic-ai/claude-code")
        return False
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

def test_claude_simple():
    """Test simple Claude command"""
    print("\n2. Testing Claude CLI simple command...")
    
    try:
        # Test a very simple command with short timeout
        result = subprocess.run(['claude', '--help'], 
                              capture_output=True, 
                              text=True, 
                              timeout=20)
        
        if result.returncode == 0:
            print("[OK] Claude CLI help command works")
            return True
        else:
            print(f"[FAIL] Help command failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("[FAIL] Help command timed out")
        return False
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

def test_claude_quick_query():
    """Test a very quick query"""
    print("\n3. Testing quick Claude query...")
    
    try:
        # Very short query with timeout
        result = subprocess.run([
            'claude', 
            '-p', 'Hi', 
            '--timeout', '15'
        ], 
        capture_output=True, 
        text=True, 
        timeout=20)
        
        if result.returncode == 0:
            print("[OK] Claude query works")
            print(f"Response: {result.stdout[:50]}...")
            return True
        else:
            print(f"[FAIL] Query failed: {result.stderr}")
            if "authentication" in result.stderr.lower():
                print("[AUTH] Authentication required - run: claude setup-token")
            return False
            
    except subprocess.TimeoutExpired:
        print("[TIMEOUT] Query timed out - likely authentication issue")
        print("[FIX] Run: claude setup-token")
        return False
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

def main():
    print("CLAUDE CLI CONNECTION DIAGNOSTIC")
    print("=" * 40)
    
    # Test 1: Basic availability
    if not test_claude_basic():
        print("\nDIAGNOSIS: Claude CLI not installed or not in PATH")
        print("FIX: npm install -g @anthropic-ai/claude-code")
        return False
    
    # Test 2: Simple command
    if not test_claude_simple():
        print("\nDIAGNOSIS: Claude CLI installation issue")
        return False
    
    # Test 3: Authentication test
    if not test_claude_quick_query():
        print("\nDIAGNOSIS: Claude CLI authentication required")
        print("FIX: Run 'claude setup-token' then try again")
        return False
    
    print("\n" + "=" * 40)
    print("SUCCESS: Claude CLI is working!")
    print("Your SDK should work now.")
    return True

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nDiagnostic interrupted")
    except Exception as e:
        print(f"\nDiagnostic failed: {e}")