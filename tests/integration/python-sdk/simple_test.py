#!/usr/bin/env python3
"""
Simple Python SDK Test
Tests core functionality without emojis for Windows compatibility
"""

import asyncio
import sys
from datetime import datetime

def test_header(test_name: str):
    print(f"\n{'='*50}")
    print(f"Testing: {test_name}")
    print(f"{'='*50}")

def success(message: str):
    print(f"[PASS] {message}")

def error(message: str):
    print(f"[FAIL] {message}")

def info(message: str):
    print(f"[INFO] {message}")

async def test_core_functionality():
    """Test all core SDK functionality"""
    test_header("Core SDK Functionality Test")
    
    test_results = []
    
    # Test 1: Core imports
    try:
        from claude_code_sdk import ClaudeCodeOptions, ClaudeCodeClient
        from claude_code_sdk.core.messages import ResultMessage, ToolUseMessage
        from claude_code_sdk.utils import CLIDetector
        from claude_code_sdk.integrations import AutomaticClaudeIntegration
        success("All core imports successful")
        test_results.append(True)
    except Exception as e:
        error(f"Core imports failed: {e}")
        test_results.append(False)
        return False  # Can't continue without imports
    
    # Test 2: Message system
    try:
        result_msg = ResultMessage(result="Test result", token_count=42)
        msg_dict = result_msg.to_dict()
        success(f"Message system working: {msg_dict['type']}")
        test_results.append(True)
    except Exception as e:
        error(f"Message system failed: {e}")
        test_results.append(False)
    
    # Test 3: CLI detection
    try:
        detector = CLIDetector()
        claude_path = await detector.detect_claude_cli()
        if claude_path:
            success(f"CLI found: {claude_path}")
            test_results.append(True)
        else:
            error("CLI not found")
            info("Install Claude CLI: npm install -g @anthropic-ai/claude-code")
            test_results.append(False)
    except Exception as e:
        error(f"CLI detection failed: {e}")
        test_results.append(False)
    
    # Test 4: Options system
    try:
        options = ClaudeCodeOptions(model="opus", verbose=True)
        cli_args = options.get_cli_args()
        env_vars = options.get_process_env()
        success(f"Options working: {len(cli_args)} args, {len(env_vars)} env vars")
        test_results.append(True)
    except Exception as e:
        error(f"Options system failed: {e}")
        test_results.append(False)
    
    # Test 5: Integration system
    try:
        integration = AutomaticClaudeIntegration()
        session_id = integration.create_session()
        stats = integration.get_statistics()
        success(f"Integration working: session {session_id}, {len(stats)} stats")
        test_results.append(True)
    except Exception as e:
        error(f"Integration system failed: {e}")
        test_results.append(False)
    
    # Test 6: Security features
    try:
        # Test with potentially dangerous input
        malicious_options = ClaudeCodeOptions(
            model="opus; rm -rf /",
            system_prompt="Test && malicious"
        )
        cli_args = malicious_options.get_cli_args()
        env_vars = malicious_options.get_process_env()
        
        # Check if dangerous characters were sanitized
        args_str = ' '.join(cli_args)
        has_dangerous = any(char in args_str for char in [';', '&', '|', '`'])
        
        if has_dangerous:
            error("Security test failed: dangerous characters found")
            test_results.append(False)
        else:
            success("Security features working: dangerous characters sanitized")
            test_results.append(True)
    except Exception as e:
        error(f"Security test failed: {e}")
        test_results.append(False)
    
    return test_results

async def main():
    """Run all tests and show results"""
    print("Python Claude Code SDK - Test Suite")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    test_results = await test_core_functionality()
    
    if not test_results:
        print("\n[CRITICAL] Core imports failed - cannot continue testing")
        return False
    
    # Calculate results
    passed = sum(test_results)
    total = len(test_results)
    success_rate = passed / total if total > 0 else 0
    
    print(f"\n{'='*50}")
    print("TEST RESULTS SUMMARY")
    print(f"{'='*50}")
    print(f"Tests passed: {passed}/{total} ({success_rate:.1%})")
    
    if passed == total:
        print("[SUCCESS] All tests passed! SDK is ready to use.")
        return True
    elif passed >= total * 0.8:
        print("[WARNING] Most tests passed, but some issues detected.")
        return True
    else:
        print("[ERROR] Multiple tests failed. SDK needs attention.")
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"Test crashed: {e}")
        sys.exit(1)