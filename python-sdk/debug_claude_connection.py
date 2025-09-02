#!/usr/bin/env python3
"""
Debug Claude CLI connection - bypass SDK complexity
Test different ways to call Claude CLI from Python
"""

import subprocess
import asyncio
import sys
import shutil

def test_claude_cli_direct():
    """Test calling Claude CLI directly like SDK would"""
    print("="*50)
    print("  DEBUGGING CLAUDE CLI CONNECTION")
    print("="*50)
    
    # Find Claude CLI
    claude_path = shutil.which('claude')
    if not claude_path:
        print("❌ Claude CLI not found in PATH")
        return False
    
    print(f"✅ Found Claude CLI at: {claude_path}")
    
    # Test 1: Version check (should be fast)
    print("\n[TEST 1] Version check...")
    try:
        result = subprocess.run([claude_path, '--version'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"✅ Version: {result.stdout.strip()}")
        else:
            print(f"❌ Version check failed: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print("❌ Version check timed out")
        return False
    except Exception as e:
        print(f"❌ Version check error: {e}")
        return False
    
    # Test 2: Help command (should be fast)
    print("\n[TEST 2] Help command...")
    try:
        result = subprocess.run([claude_path, '--help'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print("✅ Help command works")
        else:
            print(f"❌ Help failed: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print("❌ Help command timed out")
        return False
    except Exception as e:
        print(f"❌ Help error: {e}")
        return False
    
    # Test 3: Try a simple query with proper flags
    print("\n[TEST 3] Simple query test...")
    print("Using: --output-format json --dangerously-skip-permissions")
    
    try:
        # Use flags that should make it non-interactive
        cmd = [
            claude_path,
            '--output-format', 'json',
            '--dangerously-skip-permissions',  # Skip permission dialogs
            'what is 2+2?'
        ]
        
        print(f"Command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, 
                              capture_output=True, 
                              text=True, 
                              timeout=30,
                              cwd=r"C:\Users\Dev\automatic-claude-code")  # Safe directory
        
        if result.returncode == 0:
            print("✅ Query succeeded!")
            print(f"Output: {result.stdout[:200]}...")
            return True
        else:
            print(f"❌ Query failed with return code: {result.returncode}")
            print(f"Stdout: {result.stdout}")
            print(f"Stderr: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Query timed out (30s)")
        print("This suggests authentication or permission issues")
        return False
    except Exception as e:
        print(f"❌ Query error: {e}")
        return False

def test_alternative_approaches():
    """Test alternative ways to call Claude"""
    print("\n" + "="*50)
    print("  TESTING ALTERNATIVE APPROACHES")
    print("="*50)
    
    claude_path = shutil.which('claude')
    if not claude_path:
        return False
    
    # Test with different flag combinations
    test_configs = [
        {
            "name": "Minimal flags",
            "args": ['--output-format', 'text', 'hello']
        },
        {
            "name": "Skip permissions only", 
            "args": ['--dangerously-skip-permissions', 'hello']
        },
        {
            "name": "With working directory trust",
            "args": ['--add-dir', r'C:\Users\Dev\automatic-claude-code', 'hello']
        }
    ]
    
    for i, config in enumerate(test_configs, 1):
        print(f"\n[TEST {i}] {config['name']}")
        
        cmd = [claude_path] + config['args']
        print(f"Command: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(cmd,
                                  capture_output=True,
                                  text=True, 
                                  timeout=15,
                                  cwd=r"C:\Users\Dev\automatic-claude-code")
            
            if result.returncode == 0:
                print(f"✅ Success! Output: {result.stdout[:100]}...")
                return True
            else:
                print(f"❌ Failed: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            print("❌ Timed out")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    return False

def recommend_sdk_fix():
    """Recommend how to fix the SDK based on findings"""
    print("\n" + "="*50)
    print("  RECOMMENDATIONS FOR SDK FIX")
    print("="*50)
    
    print("""
Based on the tests above, here are the likely issues and fixes:

1. **Authentication Issue**: Claude CLI might need interactive auth setup
   Solution: Run 'claude' by itself first to complete authentication

2. **Permission Issue**: Claude CLI might be waiting for workspace trust
   Solution: Add --dangerously-skip-permissions flag to SDK calls

3. **Working Directory Issue**: Claude CLI might not trust the current directory
   Solution: Use --add-dir flag or change working directory

4. **SDK Process Management**: SDK might not be handling subprocess correctly
   Solution: Update SDK to use proper subprocess flags and timeouts

TO FIX YOUR SDK:
- Add --dangerously-skip-permissions to all Claude CLI calls
- Add --output-format json for structured responses  
- Set proper timeouts (30+ seconds)
- Handle workspace trust dialog
""")

def main():
    """Main diagnostic function"""
    print("Claude CLI Connection Diagnostics")
    print("This will help fix your SDK connection issue\n")
    
    # Run basic tests
    if test_claude_cli_direct():
        print("\n🎉 SUCCESS! Claude CLI is working from Python!")
        print("Your SDK connection issue can be fixed.")
    else:
        print("\n❌ Claude CLI not working from Python")
        print("Need to fix Claude CLI first, then SDK will work")
    
    # Try alternatives
    print("\nTrying alternative approaches...")
    if test_alternative_approaches():
        print("\n✅ Found working approach!")
    else:
        print("\n❌ All approaches failed")
    
    # Provide recommendations
    recommend_sdk_fix()

if __name__ == "__main__":
    main()