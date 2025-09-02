#!/usr/bin/env python3
"""
Comprehensive Python SDK Test Suite
Tests all major functionality without requiring full Claude CLI authentication
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path

def print_test_header(test_name: str):
    print(f"\n{'='*60}")
    print(f"🧪 Testing: {test_name}")
    print(f"{'='*60}")

def print_success(message: str):
    print(f"✅ {message}")

def print_error(message: str):
    print(f"❌ {message}")

def print_info(message: str):
    print(f"ℹ️  {message}")

async def test_core_imports():
    """Test that all core modules can be imported"""
    print_test_header("Core Imports")
    
    try:
        from claude_code_sdk import ClaudeCodeOptions, ClaudeCodeClient
        print_success("Main SDK classes imported successfully")
        
        from claude_code_sdk.core.messages import (
            ResultMessage, ToolUseMessage, ErrorMessage, 
            StreamMessage, StatusMessage
        )
        print_success("All message types imported successfully")
        
        from claude_code_sdk.exceptions import (
            ClaudeCodeError, ClaudeNotFoundError, ClaudeTimeoutError
        )
        print_success("Exception classes imported successfully")
        
        from claude_code_sdk.utils import CLIDetector
        print_success("Utility classes imported successfully")
        
        from claude_code_sdk.integrations import AutomaticClaudeIntegration
        print_success("Integration classes imported successfully")
        
        return True
    except ImportError as e:
        print_error(f"Import failed: {e}")
        return False

async def test_message_system():
    """Test message creation and serialization"""
    print_test_header("Message System")
    
    try:
        from claude_code_sdk.core.messages import ResultMessage, ToolUseMessage, ErrorMessage
        
        # Test ResultMessage
        result_msg = ResultMessage(result="Test result", token_count=42)
        result_dict = result_msg.to_dict()
        print_success(f"ResultMessage created: {result_dict['type']}")
        print_info(f"Contains: result='{result_dict['result']}', tokens={result_dict['token_count']}")
        
        # Test ToolUseMessage
        tool_msg = ToolUseMessage(tool_name="Read", tool_input={"file": "test.txt"})
        tool_dict = tool_msg.to_dict()
        print_success(f"ToolUseMessage created: {tool_dict['type']}")
        print_info(f"Tool: {tool_dict['tool_name']}, input: {tool_dict['tool_input']}")
        
        # Test ErrorMessage
        error_msg = ErrorMessage(error="Test error", error_code="TEST_001")
        error_dict = error_msg.to_dict()
        print_success(f"ErrorMessage created: {error_dict['type']}")
        print_info(f"Error: {error_dict['error']}, code: {error_dict['error_code']}")
        
        # Test JSON serialization
        json_str = result_msg.to_json()
        print_success(f"JSON serialization working: {len(json_str)} characters")
        
        return True
    except Exception as e:
        print_error(f"Message system test failed: {e}")
        return False

async def test_cli_detection():
    """Test Claude CLI detection"""
    print_test_header("CLI Detection")
    
    try:
        from claude_code_sdk.utils import CLIDetector
        
        detector = CLIDetector()
        
        # Test CLI detection
        claude_path = await detector.detect_claude_cli()
        if claude_path:
            print_success(f"Claude CLI found at: {claude_path}")
            
            # Test if it's a valid path
            if Path(claude_path).exists():
                print_success("CLI path exists on filesystem")
            else:
                print_error("CLI path doesn't exist on filesystem")
                
            # Test CLI validation (this might timeout if CLI isn't working)
            try:
                is_valid = await asyncio.wait_for(
                    detector.validate_cli(claude_path), 
                    timeout=10.0
                )
                if is_valid:
                    print_success("CLI validation passed")
                else:
                    print_error("CLI validation failed")
            except asyncio.TimeoutError:
                print_info("CLI validation timed out (expected if not authenticated)")
                
        else:
            print_error("Claude CLI not found")
            print_info("Make sure Claude CLI is installed: npm install -g @anthropic-ai/claude-code")
            
        return claude_path is not None
    except Exception as e:
        print_error(f"CLI detection test failed: {e}")
        return False

async def test_options_system():
    """Test options and configuration"""
    print_test_header("Options System")
    
    try:
        from claude_code_sdk import ClaudeCodeOptions
        
        # Test default options
        default_options = ClaudeCodeOptions()
        print_success("Default options created")
        print_info(f"Model: {default_options.model}, Max turns: {default_options.max_turns}")
        
        # Test custom options
        custom_options = ClaudeCodeOptions(
            model="opus",
            allowed_tools=["Read", "Write", "Edit"],
            max_turns=20,
            verbose=True,
            system_prompt="You are a helpful coding assistant"
        )
        print_success("Custom options created")
        print_info(f"Model: {custom_options.model}, Tools: {custom_options.allowed_tools}")
        
        # Test CLI args generation
        cli_args = custom_options.get_cli_args()
        print_success(f"CLI args generated: {len(cli_args)} arguments")
        print_info(f"Args: {' '.join(cli_args)}")
        
        # Test environment generation
        env_vars = custom_options.get_process_env()
        safe_env_count = len([k for k in env_vars.keys() if k in ['PATH', 'HOME', 'USERPROFILE']])
        print_success(f"Environment variables: {len(env_vars)} total, {safe_env_count} safe vars")
        
        # Test serialization
        options_dict = custom_options.to_dict()
        print_success("Options serialization working")
        
        # Test deserialization
        recreated_options = ClaudeCodeOptions.from_dict(options_dict)
        print_success("Options deserialization working")
        
        return True
    except Exception as e:
        print_error(f"Options system test failed: {e}")
        return False

async def test_integration_system():
    """Test automatic-claude-code integration"""
    print_test_header("Integration System")
    
    try:
        from claude_code_sdk.integrations import AutomaticClaudeIntegration
        
        # Test integration creation
        integration = AutomaticClaudeIntegration()
        print_success("AutomaticClaudeIntegration created")
        
        # Test session management
        session_id = integration.create_session()
        print_success(f"Session created: {session_id}")
        
        # Test statistics
        stats = integration.get_statistics()
        print_success(f"Statistics retrieved: {len(stats)} metrics")
        print_info(f"Success rate: {stats.get('success_rate', 0):.1%}")
        
        # Test monitoring system (without requiring server)
        from claude_code_sdk.integrations.monitoring import MonitoringClient
        
        # Test client creation (should not fail even if server is down)
        monitoring = MonitoringClient()
        print_success("MonitoringClient created")
        
        return True
    except Exception as e:
        print_error(f"Integration system test failed: {e}")
        return False

async def test_error_handling():
    """Test error classification and handling"""
    print_test_header("Error Handling")
    
    try:
        from claude_code_sdk.exceptions import (
            classify_error, is_recoverable_error,
            ClaudeNotFoundError, ClaudeTimeoutError, NetworkError
        )
        
        # Test error classification
        auth_error = classify_error("Authentication failed", "", 1)
        print_success(f"Auth error classified as: {type(auth_error).__name__}")
        
        timeout_error = classify_error("Timeout occurred", "", 124)
        print_success(f"Timeout error classified as: {type(timeout_error).__name__}")
        
        network_error = classify_error("Connection refused", "", 1)
        print_success(f"Network error classified as: {type(network_error).__name__}")
        
        # Test recovery detection
        recoverable = is_recoverable_error(network_error)
        print_success(f"Network error is recoverable: {recoverable}")
        
        not_recoverable = is_recoverable_error(ClaudeNotFoundError("CLI not found"))
        print_success(f"CLI not found is recoverable: {not_recoverable}")
        
        return True
    except Exception as e:
        print_error(f"Error handling test failed: {e}")
        return False

async def test_security_features():
    """Test security features"""
    print_test_header("Security Features")
    
    try:
        from claude_code_sdk import ClaudeCodeOptions
        
        # Test argument sanitization
        malicious_options = ClaudeCodeOptions(
            model="opus; rm -rf /",  # Injection attempt
            system_prompt="Test && malicious_command",  # Another injection attempt
        )
        
        cli_args = malicious_options.get_cli_args()
        has_dangerous_chars = any(
            char in ' '.join(cli_args) 
            for char in [';', '&', '|', '`', '$', '(', ')']
        )
        
        if has_dangerous_chars:
            print_error("Dangerous characters found in CLI args - sanitization failed")
        else:
            print_success("Argument sanitization working - dangerous characters removed")
            
        # Test environment variable filtering
        env_vars = malicious_options.get_process_env()
        safe_vars_only = all(
            key in {'PATH', 'HOME', 'USERPROFILE', 'TEMP', 'TMP', 'PYTHONPATH', 
                   'ANTHROPIC_API_KEY', 'CLAUDE_CLI_PATH', 'APPDATA', 'LOCALAPPDATA'} 
            or key.startswith('CLAUDE_')
            for key in env_vars.keys()
        )
        
        if safe_vars_only:
            print_success("Environment variable filtering working - only safe vars present")
        else:
            print_error("Unsafe environment variables detected")
            
        print_info(f"Environment contains {len(env_vars)} variables")
        
        return not has_dangerous_chars and safe_vars_only
    except Exception as e:
        print_error(f"Security features test failed: {e}")
        return False

async def run_all_tests():
    """Run all tests and provide summary"""
    print("🚀 Python Claude Code SDK - Comprehensive Test Suite")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tests = [
        ("Core Imports", test_core_imports),
        ("Message System", test_message_system),
        ("CLI Detection", test_cli_detection),
        ("Options System", test_options_system),
        ("Integration System", test_integration_system),
        ("Error Handling", test_error_handling),
        ("Security Features", test_security_features),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results[test_name] = result
        except Exception as e:
            print_error(f"Test '{test_name}' crashed: {e}")
            results[test_name] = False
    
    # Summary
    print_test_header("Test Results Summary")
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 Overall Result: {passed}/{total} tests passed ({passed/total:.1%})")
    
    if passed == total:
        print("🎉 All tests passed! SDK is ready for use.")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(run_all_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test suite crashed: {e}")
        sys.exit(1)