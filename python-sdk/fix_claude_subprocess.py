#!/usr/bin/env python3
"""
Fix Claude CLI subprocess issue
Test different ways to call Claude that actually work
"""

import subprocess
import shutil
import os

def test_interactive_approach():
    """Test using stdin/stdout with Claude in interactive mode"""
    print("\n[TEST] Interactive stdin/stdout approach...")
    
    claude_path = shutil.which('claude')
    if not claude_path:
        return False
    
    try:
        # Start Claude in interactive mode without arguments
        process = subprocess.Popen(
            [claude_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=os.getcwd()
        )
        
        # Send the query
        stdout, stderr = process.communicate(
            input="what is 2+2?\n",
            timeout=30
        )
        
        if process.returncode == 0 and stdout:
            print(f"[SUCCESS] Interactive approach worked!")
            print(f"Response: {stdout[:200]}...")
            return True
        else:
            print(f"[FAIL] Interactive failed: {stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        process.kill()
        print("[TIMEOUT] Interactive approach timed out")
        return False
    except Exception as e:
        print(f"[ERROR] Interactive approach failed: {e}")
        return False

def test_with_session_id():
    """Test with explicit session ID"""
    print("\n[TEST] With session ID approach...")
    
    claude_path = shutil.which('claude')
    if not claude_path:
        return False
    
    try:
        cmd = [
            claude_path,
            '--session-id', '12345678-1234-1234-1234-123456789012',
            '--dangerously-skip-permissions',
            '--output-format', 'text',
            'what is 2+2?'
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.getcwd()
        )
        
        if result.returncode == 0:
            print(f"[SUCCESS] Session ID approach worked!")
            print(f"Response: {result.stdout}")
            return True
        else:
            print(f"[FAIL] Session ID failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Session ID approach failed: {e}")
        return False

def test_with_model_flag():
    """Test with explicit model specification"""
    print("\n[TEST] With model flag approach...")
    
    claude_path = shutil.which('claude')
    if not claude_path:
        return False
    
    try:
        cmd = [
            claude_path,
            '--model', 'sonnet',
            '--dangerously-skip-permissions',
            '--output-format', 'text',
            'what is 2+2?'
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.getcwd()
        )
        
        if result.returncode == 0:
            print(f"[SUCCESS] Model flag approach worked!")
            print(f"Response: {result.stdout}")
            return True
        else:
            print(f"[FAIL] Model flag failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Model flag approach failed: {e}")
        return False

def test_workspace_trust():
    """Test by explicitly trusting workspace"""
    print("\n[TEST] Workspace trust approach...")
    
    claude_path = shutil.which('claude')
    if not claude_path:
        return False
    
    try:
        # First, try to set workspace trust
        trust_cmd = [claude_path, 'config', 'set', 'hasTrustDialogAccepted', 'true']
        subprocess.run(trust_cmd, capture_output=True, timeout=10)
        
        # Then try the query
        cmd = [
            claude_path,
            '--output-format', 'text',
            'what is 2+2?'
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.getcwd()
        )
        
        if result.returncode == 0:
            print(f"[SUCCESS] Workspace trust approach worked!")
            print(f"Response: {result.stdout}")
            return True
        else:
            print(f"[FAIL] Workspace trust failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Workspace trust approach failed: {e}")
        return False

def main():
    """Test all approaches to find what works"""
    print("="*50)
    print("  FIXING CLAUDE CLI SUBPROCESS ISSUE")
    print("="*50)
    
    print("Testing different approaches to call Claude CLI from Python...")
    
    approaches = [
        test_interactive_approach,
        test_with_session_id,
        test_with_model_flag,
        test_workspace_trust,
    ]
    
    working_approaches = []
    
    for approach in approaches:
        try:
            if approach():
                working_approaches.append(approach.__name__)
        except Exception as e:
            print(f"[ERROR] {approach.__name__} crashed: {e}")
    
    print("\n" + "="*50)
    print("  RESULTS")
    print("="*50)
    
    if working_approaches:
        print(f"[SUCCESS] Found {len(working_approaches)} working approach(es):")
        for approach in working_approaches:
            print(f"  - {approach}")
        print("\nNow we can fix your SDK to use the working approach!")
    else:
        print("[FAIL] None of the approaches worked")
        print("\nThis suggests a deeper authentication or configuration issue")
        print("Try these manual steps:")
        print("1. Run 'claude' in terminal")
        print("2. Complete any authentication prompts")
        print("3. Try 'claude config list' to see current settings")

if __name__ == "__main__":
    main()