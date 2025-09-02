#!/usr/bin/env python3
"""
Diagnose Claude CLI Issues
Help fix common Claude CLI problems
"""

import subprocess
import sys
import json
from pathlib import Path

def run_command(cmd, timeout=10):
    """Run command with timeout"""
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True, 
            timeout=timeout
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except Exception as e:
        return False, "", str(e)

def check_claude_installation():
    """Check if Claude CLI is properly installed"""
    print("\n=== Checking Claude CLI Installation ===")
    
    success, output, error = run_command("claude --version")
    if success:
        print(f"[PASS] Claude CLI installed: {output}")
        return True
    else:
        print(f"[FAIL] Claude CLI not found: {error}")
        return False

def check_claude_config():
    """Check Claude CLI configuration"""
    print("\n=== Checking Claude CLI Configuration ===")
    
    success, output, error = run_command("claude config list")
    if success:
        try:
            config = json.loads(output)
            print(f"[INFO] Configuration found:")
            for key, value in config.items():
                print(f"  - {key}: {value}")
            
            # Check for authentication indicators
            if "apiKey" in config or "sessionToken" in config:
                print("[PASS] Authentication may be configured")
                return True
            else:
                print("[WARN] No authentication tokens found in config")
                return False
        except json.JSONDecodeError:
            print(f"[WARN] Config output not JSON: {output}")
            return False
    else:
        print(f"[FAIL] Cannot read config: {error}")
        return False

def test_simple_query():
    """Test a simple Claude query"""
    print("\n=== Testing Simple Claude Query ===")
    print("Testing: claude -p 'hello' --output-format text")
    
    success, output, error = run_command('claude -p "hello" --output-format text', timeout=30)
    if success:
        print(f"[PASS] Query successful!")
        print(f"Response: {output[:200]}...")
        return True
    else:
        print(f"[FAIL] Query failed: {error}")
        if "timeout" in error.lower():
            print("[DIAGNOSIS] Claude CLI is hanging - likely authentication issue")
        return False

def check_authentication_files():
    """Check for authentication files"""
    print("\n=== Checking Authentication Files ===")
    
    home = Path.home()
    possible_auth_files = [
        home / ".claude" / "session.json",
        home / ".claude" / "config.json",
        home / ".anthropic" / "credentials",
        home / ".config" / "claude" / "config.json",
    ]
    
    found_any = False
    for auth_file in possible_auth_files:
        if auth_file.exists():
            print(f"[FOUND] {auth_file} ({auth_file.stat().st_size} bytes)")
            found_any = True
        else:
            print(f"[MISSING] {auth_file}")
    
    if found_any:
        print("[INFO] Some authentication files found")
    else:
        print("[WARN] No authentication files found")
    
    return found_any

def provide_solutions():
    """Provide solutions for common issues"""
    print("\n" + "="*60)
    print("  SOLUTIONS FOR COMMON CLAUDE CLI ISSUES")
    print("="*60)
    
    print("""
[SOLUTION 1] Authentication Issue (Most Common)
If Claude CLI hangs on queries, you need to authenticate:

    # Option A: Interactive authentication
    claude auth

    # Option B: Use API key (if you have one)
    claude setup-token

[SOLUTION 2] First-Time Setup
If this is your first time using Claude CLI:

    1. Make sure you have a Claude account
    2. Run: claude auth
    3. Follow the browser authentication flow
    4. Accept workspace trust when prompted

[SOLUTION 3] Trust Dialog Issue
If Claude CLI asks about workspace trust:

    # Accept trust for current directory
    # This might be needed for the SDK to work

[SOLUTION 4] Check Claude CLI Status
    
    # Check if authenticated
    claude config list
    
    # Test with a simple query
    claude -p "test" --output-format text

[SOLUTION 5] Reinstall Claude CLI (If All Else Fails)
    
    # Uninstall
    npm uninstall -g @anthropic-ai/claude-code
    
    # Reinstall
    npm install -g @anthropic-ai/claude-code
    
    # Re-authenticate
    claude auth

[SOLUTION 6] Alternative: Use Claude CLI Interactively First
    
    # Just run claude without arguments
    claude
    
    # This will start interactive mode and handle authentication
    """)

def main():
    """Run all diagnostics"""
    print("="*60)
    print("  CLAUDE CLI DIAGNOSTIC TOOL")
    print("="*60)
    
    tests = [
        ("Installation", check_claude_installation),
        ("Configuration", check_claude_config),
        ("Authentication Files", check_authentication_files),
        ("Simple Query", test_simple_query),
    ]
    
    issues_found = 0
    for name, test_func in tests:
        try:
            if not test_func():
                issues_found += 1
        except Exception as e:
            print(f"[ERROR] {name} test crashed: {e}")
            issues_found += 1
    
    # Summary
    print("\n" + "="*60)
    print(f"  DIAGNOSTIC SUMMARY")
    print("="*60)
    
    if issues_found == 0:
        print("\n[SUCCESS] Claude CLI appears to be working!")
        print("Your SDK should work fine.")
    else:
        print(f"\n[ISSUES] Found {issues_found} issue(s)")
        print("Your SDK won't work until Claude CLI is fixed.")
        provide_solutions()
    
    print("\n" + "="*60)
    print("  NEXT STEPS")
    print("="*60)
    
    if issues_found == 0:
        print("""
1. Try your SDK test again:
   python my_real_test.py

2. If still hanging, try this simple test:
   python -c "from claude_code_sdk import query; import asyncio; asyncio.run(query('hello'))"
""")
    else:
        print("""
1. Fix Claude CLI authentication:
   claude auth

2. Test Claude CLI directly:
   claude -p "test" --output-format text

3. Once Claude CLI works, test your SDK:
   python my_real_test.py
""")

if __name__ == "__main__":
    main()