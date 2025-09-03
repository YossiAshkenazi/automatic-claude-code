#!/usr/bin/env python3
"""
Test authentication status after setup-token
"""

import subprocess
import shutil

def test_auth_status():
    """Test current authentication status"""
    print("="*50)
    print("  TESTING AUTHENTICATION STATUS")
    print("="*50)
    
    claude_path = shutil.which('claude')
    if not claude_path:
        print("[FAIL] Claude CLI not found")
        return
    
    print(f"[INFO] Claude CLI found at: {claude_path}")
    
    # Test 1: Check if claude can start without hanging
    print("\n[TEST 1] Testing basic Claude CLI response...")
    try:
        result = subprocess.run(
            [claude_path, '--help'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print("[PASS] Claude CLI responds to --help")
        else:
            print(f"[FAIL] Claude CLI help failed: {result.stderr}")
    except Exception as e:
        print(f"[ERROR] Claude CLI help test failed: {e}")
    
    # Test 2: Try simple query with different approaches
    test_queries = [
        {
            "name": "Default query",
            "args": ["what is 2+2?"]
        },
        {
            "name": "Text format query", 
            "args": ["--output-format", "text", "what is 2+2?"]
        },
        {
            "name": "Skip permissions query",
            "args": ["--dangerously-skip-permissions", "what is 2+2?"]
        },
        {
            "name": "Combined flags",
            "args": ["--output-format", "text", "--dangerously-skip-permissions", "what is 2+2?"]
        }
    ]
    
    for i, test in enumerate(test_queries, 1):
        print(f"\n[TEST {i+1}] {test['name']}...")
        
        try:
            result = subprocess.run(
                [claude_path] + test['args'],
                capture_output=True,
                text=True,
                timeout=20
            )
            
            if result.returncode == 0:
                print(f"[SUCCESS] Got response: {result.stdout[:50]}...")
                print("🎉 AUTHENTICATION IS WORKING!")
                return True
            else:
                error_msg = result.stderr.strip()
                if "Invalid API key" in error_msg:
                    print(f"[AUTH ERROR] {error_msg}")
                else:
                    print(f"[FAIL] Other error: {error_msg}")
                    
        except subprocess.TimeoutExpired:
            print("[TIMEOUT] Query hung - likely waiting for auth")
        except Exception as e:
            print(f"[ERROR] {e}")
    
    print("\n[CONCLUSION] Authentication still not working properly")
    return False

def suggest_next_steps():
    """Suggest what to try next"""
    print("\n" + "="*50)
    print("  SUGGESTED NEXT STEPS")
    print("="*50)
    
    print("""
The setup-token might not have worked properly. Try these steps:

1. **Manual Interactive Test**:
   - Open a new terminal
   - Run just: claude
   - See if it opens and asks for authentication

2. **Check for Authentication Files**:
   - Look for files in ~/.claude or similar
   - setup-token should have created auth files

3. **Try Alternative Authentication**:
   - If you have an Anthropic API key, set: 
     set ANTHROPIC_API_KEY=your-key-here
   - Then test again

4. **Browser Authentication Check**:
   - setup-token should have opened browser
   - Make sure you completed the login process
   - Try setup-token again if needed

5. **SDK Workaround**:
   - Your SDK structure is perfect
   - Once authentication works, SDK will work
   - Can create mock version for testing meanwhile
""")

def main():
    """Main test"""
    if test_auth_status():
        print("\n✅ Ready to test your SDK!")
    else:
        suggest_next_steps()

if __name__ == "__main__":
    main()