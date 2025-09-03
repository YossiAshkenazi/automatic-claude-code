#!/usr/bin/env python3
"""
SAFE SDK TEST - With proper timeout and error handling
Tests the SDK with timeouts to prevent hanging
"""

import asyncio
import sys
import os
import subprocess
from pathlib import Path

# Fix encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def check_claude_cli():
    """Check if Claude CLI is available before testing SDK"""
    print("Checking Claude CLI availability...")
    
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
    except FileNotFoundError:
        print("[FAIL] Claude CLI not installed")
        print("\nTo fix this issue:")
        print("1. Install Claude CLI: npm install -g @anthropic-ai/claude-code") 
        print("2. Verify: claude --version")
        print("3. Setup token: claude setup-token")
        print("4. Test: claude -p 'hello'")
        print("5. Then run this test again")
        return False
    except subprocess.TimeoutExpired:
        print("[FAIL] Claude CLI timed out")
        return False
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

async def test_sdk_with_timeout():
    """Test SDK with proper timeout handling"""
    print("\n" + "="*50)
    print("  TESTING SDK WITH TIMEOUT SAFETY")  
    print("="*50)
    
    try:
        # Test imports first
        print("[1] Testing SDK imports...")
        from claude_code_sdk import query, ClaudeCodeClient
        print("[OK] SDK imports successful")
        
        # Test with very short timeout
        print("[2] Testing SDK query with 30-second timeout...")
        
        async def run_query_with_timeout():
            try:
                messages = []
                async for message in query("What is 2+2? Just the number."):
                    messages.append(message)
                    print(f"    Received: {type(message).__name__}")
                    if len(messages) >= 1:  # Stop after first message
                        break
                return messages
            except Exception as e:
                print(f"    Query error: {e}")
                return None
        
        try:
            # Run with timeout
            messages = await asyncio.wait_for(run_query_with_timeout(), timeout=30.0)
            
            if messages:
                print(f"[OK] SDK query successful! Received {len(messages)} message(s)")
                for msg in messages:
                    if hasattr(msg, 'result'):
                        print(f"    Result: {msg.result}")
                    elif hasattr(msg, 'content'):
                        print(f"    Content: {msg.content}")
                return True
            else:
                print("[FAIL] No messages received")
                return False
                
        except asyncio.TimeoutError:
            print("[TIMEOUT] SDK query timed out after 30 seconds")
            print("This usually means:")
            print("- Claude CLI needs authentication: claude setup-token")  
            print("- Claude CLI is waiting for input")
            print("- Network connectivity issue")
            return False
            
    except ImportError as e:
        print(f"[ERROR] SDK import failed: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] SDK test failed: {e}")
        return False

def test_sdk_structure():
    """Test SDK structure without Claude CLI"""
    print("\n" + "="*50)
    print("  TESTING SDK STRUCTURE (No CLI needed)")
    print("="*50)
    
    try:
        # Test all imports
        from claude_code_sdk import (
            ClaudeCodeClient, ClaudeSDKClient, 
            query, quick_query,
            ClaudeCodeError, classify_error
        )
        print("[OK] All SDK components import successfully")
        
        # Test client creation
        client = ClaudeCodeClient()
        print(f"[OK] Client created: {type(client).__name__}")
        
        # Test methods exist
        if hasattr(client, 'execute') and hasattr(client, 'query'):
            print("[OK] Client has both execute() and query() methods")
        else:
            print("[FAIL] Client missing required methods")
            return False
            
        # Test error classification
        error = classify_error("Authentication failed")
        print(f"[OK] Error classification works: {type(error).__name__}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] SDK structure test failed: {e}")
        return False

async def main():
    """Main test runner with comprehensive checks"""
    print("CLAUDE CODE SDK - SAFE TESTING")
    print("Tests SDK components safely with timeouts")
    print("=" * 60)
    
    # Step 1: Check Claude CLI
    cli_available = check_claude_cli()
    
    # Step 2: Test SDK structure (always works)  
    structure_ok = test_sdk_structure()
    
    if not structure_ok:
        print("\n[CRITICAL] SDK structure broken - check installation")
        return False
    
    # Step 3: Test with Claude CLI if available
    if cli_available:
        print("\nClaude CLI is available - testing full integration...")
        integration_ok = await test_sdk_with_timeout()
        
        if integration_ok:
            print("\n" + "="*60)
            print("SUCCESS! Your SDK is fully functional!")
            print("✓ SDK structure working")
            print("✓ Claude CLI available")  
            print("✓ SDK integration working")
            print("\nYour original test (final_sdk_test.py) should work now!")
        else:
            print("\n" + "="*60) 
            print("PARTIAL SUCCESS:")
            print("✓ SDK structure working")
            print("✓ Claude CLI found")
            print("✗ SDK integration issue")
            print("\nLikely fix: claude setup-token")
    else:
        print("\n" + "="*60)
        print("PARTIAL SUCCESS:")
        print("✓ SDK structure working") 
        print("✗ Claude CLI not available")
        print("\nTo complete setup:")
        print("1. npm install -g @anthropic-ai/claude-code")
        print("2. claude setup-token") 
        print("3. Run this test again")
        
    return structure_ok and (not cli_available or integration_ok)

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted!")
        sys.exit(1)
    except Exception as e:
        print(f"\nTest system error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)