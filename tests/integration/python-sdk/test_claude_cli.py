#!/usr/bin/env python3
"""
Claude CLI Test - Simple Version
Tests Claude CLI functionality without unicode issues
"""

import asyncio
import subprocess
import sys
from claude_code_sdk import ClaudeCodeClient, ClaudeCodeOptions
from claude_code_sdk.utils import CLIDetector

async def test_cli_detection():
    """Test if Claude CLI can be found and responds"""
    print("Testing Claude CLI Detection")
    print("-" * 40)
    
    try:
        detector = CLIDetector()
        claude_path = await detector.detect_claude_cli()
        
        if not claude_path:
            print("[FAIL] Claude CLI not found")
            print("Install with: npm install -g @anthropic-ai/claude-code")
            return False, None
        
        print(f"[PASS] Claude CLI found: {claude_path}")
        
        # Test if CLI responds to help command
        try:
            result = subprocess.run([claude_path, "--help"], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                print("[PASS] Claude CLI responds to --help")
                return True, claude_path
            else:
                print(f"[FAIL] Claude CLI error (code {result.returncode})")
                if result.stderr:
                    print(f"Error: {result.stderr[:200]}...")
                return False, claude_path
                
        except subprocess.TimeoutExpired:
            print("[FAIL] Claude CLI --help timed out")
            return False, claude_path
        except Exception as e:
            print(f"[FAIL] Claude CLI test error: {e}")
            return False, claude_path
            
    except Exception as e:
        print(f"[FAIL] CLI detection failed: {e}")
        return False, None

async def test_sdk_configuration():
    """Test SDK configuration with skip permissions"""
    print("\nTesting SDK Configuration")
    print("-" * 40)
    
    try:
        # Test basic options
        options = ClaudeCodeOptions(
            model="sonnet",
            verbose=True,
            additional_args=["--dangerously-skip-permissions"]
        )
        
        cli_args = options.get_cli_args()
        print(f"[PASS] Options created successfully")
        print(f"[INFO] Model: {options.model}")
        print(f"[INFO] CLI args: {' '.join(cli_args)}")
        
        # Verify skip permissions flag is included
        if "--dangerously-skip-permissions" in cli_args:
            print("[PASS] Skip permissions flag included")
        else:
            print("[FAIL] Skip permissions flag missing")
            return False
            
        return True
        
    except Exception as e:
        print(f"[FAIL] SDK configuration failed: {e}")
        return False

async def test_client_creation():
    """Test client creation with proper flags"""
    print("\nTesting Client Creation")
    print("-" * 40)
    
    try:
        options = ClaudeCodeOptions(
            model="sonnet",
            timeout=30,
            additional_args=["--dangerously-skip-permissions"]
        )
        
        async with ClaudeCodeClient(options) as client:
            print(f"[PASS] Client created successfully")
            print(f"[INFO] CLI path: {client._claude_cli_path}")
            print(f"[INFO] Options: {options.model}, timeout: {options.timeout}s")
            return True
            
    except Exception as e:
        print(f"[FAIL] Client creation failed: {e}")
        return False

async def test_simple_query():
    """Test a simple query if possible"""
    print("\nTesting Simple Query")
    print("-" * 40)
    
    try:
        options = ClaudeCodeOptions(
            model="sonnet",
            timeout=60,
            max_turns=1,
            additional_args=["--dangerously-skip-permissions"]
        )
        
        print(f"[INFO] Attempting query with timeout: {options.timeout}s")
        print(f"[INFO] Using flags: {' '.join(options.get_cli_args())}")
        
        async with ClaudeCodeClient(options) as client:
            try:
                # Try a very simple query
                prompt = "What is 2+2?"
                print(f"[INFO] Sending query: {prompt}")
                
                message_count = 0
                async for message in client.query(prompt):
                    message_count += 1
                    print(f"[INFO] Received message {message_count}: {type(message).__name__}")
                    
                    if hasattr(message, 'result') and message.result:
                        print(f"[PASS] Query successful! Result: {message.result[:100]}")
                        return True
                    elif hasattr(message, 'error'):
                        print(f"[FAIL] Query error: {message.error}")
                        return False
                
                if message_count > 0:
                    print(f"[PASS] Query completed with {message_count} messages")
                    return True
                else:
                    print("[FAIL] No messages received")
                    return False
                    
            except Exception as query_error:
                print(f"[FAIL] Query execution failed: {query_error}")
                if "authentication" in str(query_error).lower():
                    print("[INFO] This may be an authentication issue")
                    print("[INFO] Make sure Claude Code desktop app is authenticated")
                return False
                
    except Exception as e:
        print(f"[FAIL] Simple query test failed: {e}")
        return False

async def main():
    """Run all tests"""
    print("Python SDK Claude CLI Test")
    print("=" * 50)
    
    # Test 1: CLI Detection
    cli_ok, claude_path = await test_cli_detection()
    
    if not cli_ok:
        print("\n[CRITICAL] Claude CLI not working - cannot proceed")
        return
    
    # Test 2: SDK Configuration
    config_ok = await test_sdk_configuration()
    
    # Test 3: Client Creation
    client_ok = await test_client_creation()
    
    # Test 4: Simple Query (if everything else works)
    query_ok = False
    if cli_ok and config_ok and client_ok:
        query_ok = await test_simple_query()
    
    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    results = [
        ("CLI Detection", cli_ok),
        ("SDK Configuration", config_ok), 
        ("Client Creation", client_ok),
        ("Query Execution", query_ok)
    ]
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status} {name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n[SUCCESS] Python SDK is fully operational!")
        print("You can now use the SDK for real Claude queries.")
    elif passed >= 3:
        print("\n[PARTIAL] Core functionality works, query may need authentication setup.")
        print("Make sure Claude Code desktop app is installed and authenticated.")
    else:
        print("\n[SETUP NEEDED] Core issues need to be resolved.")
        
    print(f"\nMonitoring: http://localhost:6011")
    print("Usage guide: See USAGE_GUIDE.md")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted")
    except Exception as e:
        print(f"Test crashed: {e}")
        sys.exit(1)