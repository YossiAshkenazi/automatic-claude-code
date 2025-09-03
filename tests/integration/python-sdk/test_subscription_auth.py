#!/usr/bin/env python3
"""
Test different authentication methods for Claude Code SDK
Tests OAuth tokens vs API keys vs CLI authentication
"""

import os
import subprocess
import asyncio
import json
from pathlib import Path

def test_environment_auth():
    """Test if environment variable authentication works"""
    print("\n1. Testing Environment Variable Authentication")
    print("=" * 50)
    
    # Check current environment
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    auth_token = os.environ.get('ANTHROPIC_AUTH_TOKEN', '')
    
    if api_key.startswith('sk-ant-api'):
        print("[OK] Found API key format (sk-ant-api...)")
        return 'api_key'
    elif api_key.startswith('sk-ant-oat'):
        print("[WARNING] Found OAuth token in ANTHROPIC_API_KEY (won't work for API)")
        print("   OAuth tokens need browser-based authentication flow")
        return 'oauth_misplaced'
    elif auth_token.startswith('sk-ant-oat'):
        print("[INFO] Found OAuth token in ANTHROPIC_AUTH_TOKEN")
        print("   This requires claude setup-token flow")
        return 'oauth_token'
    else:
        print("[ERROR] No authentication tokens found in environment")
        return None

def test_cli_authentication():
    """Test if Claude CLI is authenticated"""
    print("\n2. Testing Claude CLI Authentication")
    print("=" * 50)
    
    try:
        # Try a simple claude command
        result = subprocess.run(
            ['claude', '-p', 'echo test'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            print("[OK] Claude CLI is authenticated and working")
            return True
        else:
            error_msg = result.stderr.lower()
            if 'auth' in error_msg or 'token' in error_msg:
                print("[ERROR] Claude CLI needs authentication")
                print("   Run: claude setup-token")
            else:
                print(f"[ERROR] Claude CLI error: {result.stderr[:200]}")
            return False
            
    except subprocess.TimeoutExpired:
        print("[TIMEOUT] Claude CLI timed out (likely needs authentication)")
        print("   Run: claude setup-token")
        return False
    except FileNotFoundError:
        print("[ERROR] Claude CLI not found")
        print("   Install: npm install -g @anthropic-ai/claude-code")
        return False

def check_oauth_token_validity(token: str):
    """Analyze OAuth token structure"""
    print("\n3. OAuth Token Analysis")
    print("=" * 50)
    
    if token.startswith('sk-ant-oat01-'):
        print("[ANALYSIS] Token format: OAuth Access Token (sk-ant-oat01)")
        print("   - Type: Short-lived access token")
        print("   - Usage: Browser-based authentication")
        print("   - Expires: Yes (needs refresh)")
        print("   - Works with: claude setup-token flow")
        print("   - Does NOT work as: ANTHROPIC_API_KEY")
        
        # Check token length (rough validity check)
        if len(token) > 100:
            print("   - Length: Valid format")
        else:
            print("   - Length: Possibly truncated")
            
        return 'oauth_access'
        
    elif token.startswith('sk-ant-api'):
        print("[ANALYSIS] Token format: API Key")
        print("   - Type: Permanent API key")
        print("   - Usage: Direct API calls")
        print("   - Expires: No (until revoked)")
        print("   - Works with: ANTHROPIC_API_KEY")
        return 'api_key'
    else:
        print("[UNKNOWN] Unknown token format")
        return 'unknown'

async def test_sdk_with_auth():
    """Test if SDK can authenticate with current setup"""
    print("\n4. Testing SDK Authentication")
    print("=" * 50)
    
    try:
        # Import our SDK
        from claude_code_sdk import ClaudeCodeClient, ClaudeCodeOptions
        
        options = ClaudeCodeOptions(
            timeout=10,
            verbose=False
        )
        
        try:
            async with ClaudeCodeClient(options) as client:
                print("[OK] SDK client initialized successfully")
                print(f"   CLI Path: {client._claude_cli_path}")
                
                # Try a simple query
                print("\n   Testing query execution...")
                response_received = False
                async for message in client.query("echo test", stream=True):
                    response_received = True
                    break  # Just check if we get any response
                
                if response_received:
                    print("   [OK] Query executed successfully!")
                    return True
                else:
                    print("   [WARNING] No response received")
                    return False
                    
        except Exception as e:
            error_str = str(e)
            if 'auth' in error_str.lower() or 'api' in error_str.lower():
                print(f"[ERROR] Authentication error: {error_str[:200]}")
                print("\n   Suggested fixes:")
                print("   1. Run: claude setup-token")
                print("   2. Or set: ANTHROPIC_API_KEY=sk-ant-api03-...")
            else:
                print(f"[ERROR] SDK error: {error_str[:200]}")
            return False
            
    except ImportError:
        print("[ERROR] SDK not properly installed")
        print("   Run: pip install -e .")
        return False

def provide_recommendations(auth_type, cli_auth, sdk_works):
    """Provide specific recommendations based on test results"""
    print("\n" + "=" * 60)
    print("RECOMMENDATIONS")
    print("=" * 60)
    
    if auth_type == 'oauth_misplaced':
        print("\n[WARNING] OAuth Token Misplacement Detected")
        print("Your sk-ant-oat01 token is in ANTHROPIC_API_KEY but won't work there.")
        print("\n[SOLUTION]:")
        print("1. Remove from ANTHROPIC_API_KEY (it won't work as API key)")
        print("2. Run: claude setup-token")
        print("3. Authenticate with your Claude subscription in browser")
        print("4. The CLI will handle OAuth tokens internally")
        
    elif auth_type == 'oauth_token':
        print("\n[INFO] OAuth Token in ANTHROPIC_AUTH_TOKEN")
        print("This might work with claude setup-token flow, but OAuth tokens expire.")
        print("\n[SOLUTION]:")
        print("1. Run: claude setup-token")
        print("2. Complete browser authentication")
        print("3. Let CLI manage token refresh automatically")
        
    elif not cli_auth:
        print("\n[ERROR] Claude CLI Not Authenticated")
        print("\n[SOLUTION] for Subscription Users:")
        print("1. Run: claude setup-token")
        print("2. Sign in with your Claude Pro/Max account")
        print("3. Complete browser authentication")
        print("\n[SOLUTION] for API Users:")
        print("1. Get API key from https://console.anthropic.com/")
        print("2. Set: export ANTHROPIC_API_KEY=sk-ant-api03-...")
        
    elif sdk_works:
        print("\n[SUCCESS] Everything is working!")
        print("Your authentication is properly configured.")
        print("\nYou can now use:")
        print("- claude (CLI commands)")
        print("- Python SDK with real-time streaming")
        
    else:
        print("\n[WARNING] Partial Setup Detected")
        print("CLI works but SDK has issues.")
        print("\n[SOLUTIONS]:")
        print("1. Restart your terminal/IDE")
        print("2. Verify SDK installation: pip install -e .")
        print("3. Check Python version: python --version (need 3.10+)")

async def main():
    print("Claude Authentication Test Suite")
    print("=" * 60)
    
    # Run all tests
    auth_type = test_environment_auth()
    cli_auth = test_cli_authentication()
    
    # Check if there's a token to analyze
    token = os.environ.get('ANTHROPIC_API_KEY', '') or os.environ.get('ANTHROPIC_AUTH_TOKEN', '')
    if token and token.startswith('sk-ant'):
        check_oauth_token_validity(token)
    
    # Test SDK
    sdk_works = await test_sdk_with_auth()
    
    # Provide recommendations
    provide_recommendations(auth_type, cli_auth, sdk_works)
    
    print("\n" + "=" * 60)
    print("Test completed. Follow recommendations above.")

if __name__ == "__main__":
    asyncio.run(main())