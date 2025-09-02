#!/usr/bin/env python3
"""
Quick test to validate Claude Code Python SDK is working
Run this to ensure the package is ready to use!
"""

import asyncio
import sys

async def main():
    print("\n" + "="*60)
    print("Claude Code Python SDK - Quick Test")
    print("="*60 + "\n")
    
    # Test 1: Basic imports
    print("[1/5] Testing basic imports...")
    try:
        import claude_code_sdk
        from claude_code_sdk import ClaudeSDKClient, query
        print(f"    OK - SDK version: {claude_code_sdk.__version__}")
    except ImportError as e:
        print(f"    FAIL - {e}")
        return False
    
    # Test 2: Client creation
    print("[2/5] Testing client creation...")
    try:
        from claude_code_sdk import ClaudeCodeOptions
        options = ClaudeCodeOptions()
        client = ClaudeSDKClient(options)
        print("    OK - Client created successfully")
    except Exception as e:
        print(f"    FAIL - {e}")
        return False
    
    # Test 3: Integration features
    print("[3/5] Testing ACC integration...")
    try:
        from claude_code_sdk.integrations import AutomaticClaudeIntegration
        integration = AutomaticClaudeIntegration()
        stats = integration.get_statistics()
        print(f"    OK - Integration ready (monitoring: {stats['monitoring_enabled']})")
    except Exception as e:
        print(f"    FAIL - {e}")
        return False
    
    # Test 4: Error handling
    print("[4/5] Testing error handling...")
    try:
        from claude_code_sdk import ClaudeTimeoutError, is_recoverable_error
        error = ClaudeTimeoutError("Test")
        recoverable = is_recoverable_error(error)
        print(f"    OK - Error handling works (recoverable: {recoverable})")
    except Exception as e:
        print(f"    FAIL - {e}")
        return False
    
    # Test 5: Package info
    print("[5/5] Testing package info...")
    try:
        info = claude_code_sdk.get_sdk_info()
        print(f"    OK - Package: {info['name']} with {len(info['features'])} features")
    except Exception as e:
        print(f"    FAIL - {e}")
        return False
    
    print("\n" + "="*60)
    print("SUCCESS! All tests passed.")
    print("The Claude Code Python SDK is ready to use!")
    print("="*60 + "\n")
    
    print("Quick start:")
    print("  from claude_code_sdk import query")
    print("  async for msg in query('Your prompt here'):")
    print("      print(msg.result)")
    print("\nFor more examples, see the examples/ directory.")
    
    return True

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted by user.")
        sys.exit(1)