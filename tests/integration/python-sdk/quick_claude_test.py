#!/usr/bin/env python3
"""
Quick Claude CLI connection test
"""

import subprocess
import sys
import os
import asyncio
from pathlib import Path

# Fix encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def test_claude_cli_basic():
    """Test basic Claude CLI access"""
    print("=== TESTING CLAUDE CLI CONNECTION ===")
    
    # Test 1: Check if claude command exists
    print("\n1. Testing Claude CLI availability...")
    try:
        result = subprocess.run(['claude', '--version'], 
                              capture_output=True, 
                              text=True, 
                              timeout=10)
        if result.returncode == 0:
            print(f"[OK] Claude CLI found: {result.stdout.strip()}")
            return True
        else:
            print(f"[FAIL] Claude CLI error: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print("[FAIL] Claude CLI timed out (>10s)")
        return False
    except FileNotFoundError:
        print("[FAIL] Claude CLI not found in PATH")
        print("Install with: npm install -g @anthropic-ai/claude-code")
        return False
    except Exception as e:
        print(f"[FAIL] Claude CLI test failed: {e}")
        return False

def test_claude_cli_auth():
    """Test Claude CLI authentication"""
    print("\n2. Testing Claude CLI authentication...")
    
    try:
        # Try a simple command that requires auth
        result = subprocess.run(['claude', '--help'], 
                              capture_output=True, 
                              text=True, 
                              timeout=15)
        
        if result.returncode == 0:
            print("✅ Claude CLI responding normally")
            
            # Try to check if we can run a simple query
            print("\n3. Testing simple Claude query...")
            result = subprocess.run(['claude', '-p', 'hello', '--timeout', '30'], 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=35)
            
            if result.returncode == 0:
                print("✅ Claude CLI authentication working")
                print(f"Response: {result.stdout[:100]}...")
                return True
            else:
                print(f"❌ Claude CLI query failed: {result.stderr}")
                if "authentication" in result.stderr.lower() or "auth" in result.stderr.lower():
                    print("🔑 Authentication issue detected")
                    print("Try: claude setup-token")
                return False
                
        else:
            print(f"❌ Claude CLI help failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Claude CLI query timed out (>35s)")
        print("This usually indicates authentication waiting for input")
        print("🔑 Try running: claude setup-token")
        return False
    except Exception as e:
        print(f"❌ Claude CLI auth test failed: {e}")
        return False

def test_environment():
    """Test environment setup"""
    print("\n4. Testing environment setup...")
    
    # Check Python version
    print(f"Python: {sys.version}")
    
    # Check working directory
    print(f"Working directory: {os.getcwd()}")
    
    # Check PATH for claude
    path_dirs = os.environ.get('PATH', '').split(os.pathsep)
    claude_found = False
    for path_dir in path_dirs:
        claude_path = Path(path_dir) / 'claude.cmd'  # Windows
        if claude_path.exists():
            print(f"✅ Claude found in PATH: {claude_path}")
            claude_found = True
            break
        
        claude_path = Path(path_dir) / 'claude'  # Unix
        if claude_path.exists():
            print(f"✅ Claude found in PATH: {claude_path}")
            claude_found = True
            break
    
    if not claude_found:
        print("❌ Claude not found in PATH")
        print("Install with: npm install -g @anthropic-ai/claude-code")

def main():
    """Run all diagnostic tests"""
    print("CLAUDE CODE SDK - CONNECTION DIAGNOSIS")
    print("=" * 50)
    
    # Test basic CLI
    cli_works = test_claude_cli_basic()
    
    if cli_works:
        # Test authentication
        auth_works = test_claude_cli_auth()
        
        if auth_works:
            print("\n" + "=" * 50)
            print("✅ DIAGNOSIS: Claude CLI is working!")
            print("Your SDK should work fine now.")
            print("\nTo test SDK:")
            print("python final_sdk_test.py")
            return True
        else:
            print("\n" + "=" * 50)  
            print("🔑 DIAGNOSIS: Authentication issue")
            print("\nFIX: Run the following command:")
            print("claude setup-token")
            print("\nThen test again with:")
            print("claude -p 'hello'")
            return False
    else:
        print("\n" + "=" * 50)
        print("❌ DIAGNOSIS: Claude CLI not properly installed")
        print("\nFIX: Install Claude CLI:")
        print("npm install -g @anthropic-ai/claude-code")
        print("\nThen test with:")
        print("claude --version")
        return False
    
    # Environment check regardless
    test_environment()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nDiagnosis interrupted!")
    except Exception as e:
        print(f"\nDiagnosis error: {e}")
        sys.exit(1)