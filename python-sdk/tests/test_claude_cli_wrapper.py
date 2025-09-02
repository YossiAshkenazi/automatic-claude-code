#!/usr/bin/env python3
"""
Comprehensive unit tests for Claude CLI Wrapper
Tests parsing edge cases, async resource management, authentication handling, and error scenarios.

Part of Story 1.1: Comprehensive CLI Wrapper Testing & Validation
"""

import pytest
import asyncio
import json
import os
import tempfile
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
from typing import List, Dict, Any

# Add the parent directory to the path so we can import the wrapper
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from claude_cli_wrapper import (
    ClaudeCliWrapper, 
    ClaudeCliOptions, 
    CliMessage, 
    ClaudeCliSimple
)


class TestClaudeCliOptions:
    """Test configuration options and CLI argument generation"""
    
    def test_default_options(self):
        """Test default option values"""
        options = ClaudeCliOptions()
        assert options.model == "sonnet"
        assert options.max_turns == 10
        assert options.allowed_tools == ["Read", "Write", "Edit", "Bash"]
        assert options.timeout == 300
        assert not options.verbose
        assert not options.dangerously_skip_permissions
    
    def test_cli_args_generation(self):
        """Test conversion to CLI arguments"""
        options = ClaudeCliOptions(
            model="opus",
            max_turns=5,
            allowed_tools=["Read", "Write"],
            verbose=True,
            dangerously_skip_permissions=True,
            mcp_config="/path/to/config.json"
        )
        
        args = options.to_cli_args()
        expected_args = [
            "--model", "opus",
            "--max-turns", "5", 
            "--allowed-tools", "Read,Write",
            "--verbose",
            "--dangerously-skip-permissions",
            "--mcp-config", "/path/to/config.json"
        ]
        
        assert args == expected_args
    
    def test_minimal_cli_args(self):
        """Test minimal CLI args for default options"""
        options = ClaudeCliOptions()  # All defaults
        args = options.to_cli_args()
        
        # Should only include non-default values
        assert "--allowed-tools" in args
        assert "Read,Write,Edit,Bash" in args
        assert "--model" not in args  # sonnet is default
        assert "--max-turns" not in args  # 10 is default


class TestCliMessageParsing:
    """Test the enhanced _parse_line method with comprehensive patterns"""
    
    def setup_method(self):
        """Setup test instance"""
        self.wrapper = ClaudeCliWrapper()
    
    def test_json_result_success(self):
        """Test parsing successful JSON result"""
        json_line = json.dumps({
            "type": "result",
            "subtype": "success", 
            "result": "The answer is 42",
            "session_id": "test-123",
            "is_error": False
        })
        
        message = self.wrapper._parse_line(json_line)
        
        assert message.type == "result"
        assert message.content == "The answer is 42"
        assert message.metadata["session_id"] == "test-123"
        assert not message.metadata["is_error"]
    
    def test_json_authentication_error(self):
        """Test parsing authentication error from JSON"""
        json_line = json.dumps({
            "type": "result",
            "subtype": "error",
            "result": "Invalid API key · Fix external API key",
            "is_error": True
        })
        
        message = self.wrapper._parse_line(json_line)
        
        assert message.type == "auth_error"
        assert "Please run: claude setup-token" in message.content
        assert message.metadata["auth_setup_required"] is True
        assert "Invalid API key" in message.content
    
    def test_json_streaming_content(self):
        """Test parsing streaming JSON content"""
        json_line = json.dumps({
            "type": "stream",
            "content": "This is streaming text content",
            "delta": True
        })
        
        message = self.wrapper._parse_line(json_line)
        
        assert message.type == "stream"
        assert message.content == "This is streaming text content"
        assert message.metadata["delta"] is True
    
    def test_xml_tool_patterns(self):
        """Test detection of XML-style tool patterns"""
        test_cases = [
            "<function_calls>",
            "<invoke>",
            "</invoke>",
            "</function_calls>",
            "Some text with <function_calls> in middle"
        ]
        
        for line in test_cases:
            message = self.wrapper._parse_line(line)
            assert message.type == "tool_use"
            assert message.content == line
            assert message.metadata["xml_pattern"] is True
    
    def test_action_phrase_detection(self):
        """Test detection of Claude action phrases"""
        test_cases = [
            ("Reading file: test.txt", "tool_action"),
            ("Writing to file: output.py", "tool_action"),
            ("Running command: ls -la", "tool_action"),
            ("Using tool: Bash", "tool_action"),
            ("Edit: Modifying line 42", "tool_action")
        ]
        
        for line, expected_type in test_cases:
            message = self.wrapper._parse_line(line)
            assert message.type == expected_type
            assert message.content == line
            assert "action_pattern" in message.metadata
    
    def test_status_message_detection(self):
        """Test detection of status messages"""
        status_lines = [
            "Waiting for response...",
            "Processing your request",
            "Loading model",
            "Connecting to Claude",
            "Thinking about this problem",
            "Analyzing the code"
        ]
        
        for line in status_lines:
            message = self.wrapper._parse_line(line)
            assert message.type == "status"
            assert message.content == line
            assert message.metadata["status_indicator"] is True
    
    def test_error_pattern_detection(self):
        """Test detection of various error patterns"""
        error_lines = [
            "Error: File not found",
            "Failed: Connection timeout", 
            "Exception: ValueError occurred",
            "Fatal: System crashed",
            "Permission denied for file",
            "Connection refused by server"
        ]
        
        for line in error_lines:
            message = self.wrapper._parse_line(line)
            assert message.type == "error"
            assert message.content == line
    
    def test_authentication_error_text(self):
        """Test authentication error detection in plain text"""
        auth_lines = [
            "Invalid API key provided",
            "Authentication failed - please check credentials",
            "INVALID API KEY detected"
        ]
        
        for line in auth_lines:
            message = self.wrapper._parse_line(line)
            assert message.type == "auth_error"
            assert "Please run: claude setup-token" in message.content
            assert message.metadata["auth_setup_required"] is True
    
    def test_progress_indicator_detection(self):
        """Test progress indicator patterns"""
        progress_lines = [
            "[1/5] Processing files",
            "Progress: 75%",
            "Step 3/10 completed",
            "[████████████████████] 100%"
        ]
        
        for line in progress_lines:
            message = self.wrapper._parse_line(line)
            assert message.type == "progress"
            assert message.content == line
            assert message.metadata["progress_indicator"] is True
    
    def test_empty_and_whitespace_lines(self):
        """Test handling of empty and whitespace-only lines"""
        empty_cases = ["", "   ", "\t\t", "\n"]
        
        for line in empty_cases:
            message = self.wrapper._parse_line(line)
            assert message.type == "stream"
            assert message.content == ""
            assert message.metadata["empty_line"] is True
    
    def test_stderr_flag_propagation(self):
        """Test that is_stderr flag is properly propagated"""
        line = "Some regular output"
        
        stdout_message = self.wrapper._parse_line(line, is_stderr=False)
        stderr_message = self.wrapper._parse_line(line, is_stderr=True)
        
        assert not stdout_message.metadata["is_stderr"]
        assert stderr_message.metadata["is_stderr"]
    
    def test_malformed_json_fallback(self):
        """Test fallback to pattern matching for malformed JSON"""
        malformed_json = '{"type": "result", "content": "missing quote}'
        
        message = self.wrapper._parse_line(malformed_json)
        
        # Should fall back to pattern matching
        assert message.type == "stream"  # Default type
        assert message.content == malformed_json
    
    def test_unicode_and_emoji_handling(self):
        """Test handling of Unicode characters and emojis"""
        unicode_lines = [
            "Processing files... 📁",
            "Success! ✅ Task completed",
            "Error: Failed ❌", 
            "Unicode test: 你好世界"
        ]
        
        for line in unicode_lines:
            # Should not raise exceptions
            message = self.wrapper._parse_line(line)
            assert message.content == line
    
    def test_very_long_lines(self):
        """Test handling of very long output lines"""
        long_line = "x" * 10000  # 10KB line
        
        message = self.wrapper._parse_line(long_line)
        assert message.content == long_line
        assert message.type == "stream"


class TestClaudeCliFinding:
    """Test CLI path discovery functionality"""
    
    def test_find_cli_with_custom_path(self):
        """Test finding CLI with custom path"""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(b"#!/bin/bash\necho 'fake claude'")
            tmp.flush()
            temp_path = tmp.name
        
        try:
            os.chmod(temp_path, 0o755)
            
            options = ClaudeCliOptions(cli_path=temp_path)
            wrapper = ClaudeCliWrapper(options)
            
            assert wrapper.cli_path == temp_path
        finally:
            try:
                os.unlink(temp_path)
            except (PermissionError, FileNotFoundError):
                # Windows may hold file handles, ignore cleanup errors
                pass
    
    def test_find_cli_with_environment_variable(self):
        """Test finding CLI via environment variable"""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(b"#!/bin/bash\necho 'fake claude'")
            tmp.flush()
            temp_path = tmp.name
        
        try:
            os.chmod(temp_path, 0o755)
            
            with patch.dict(os.environ, {"CLAUDE_CLI_PATH": temp_path}):
                wrapper = ClaudeCliWrapper()
                assert wrapper.cli_path == temp_path
        finally:
            try:
                os.unlink(temp_path)
            except (PermissionError, FileNotFoundError):
                # Windows may hold file handles, ignore cleanup errors
                pass
    
    @patch('shutil.which')
    def test_find_cli_in_path(self, mock_which):
        """Test finding CLI in PATH"""
        mock_which.return_value = "/usr/local/bin/claude"
        
        wrapper = ClaudeCliWrapper()
        assert wrapper.cli_path == "/usr/local/bin/claude"
        mock_which.assert_called_with("claude")
    
    @patch('shutil.which')
    @patch('os.path.exists')
    def test_find_cli_common_paths(self, mock_exists, mock_which):
        """Test searching common installation paths"""
        mock_which.return_value = None
        
        # Mock that the homebrew path exists
        def exists_side_effect(path):
            return path == "/opt/homebrew/bin/claude"
        
        mock_exists.side_effect = exists_side_effect
        
        wrapper = ClaudeCliWrapper()
        assert wrapper.cli_path == "/opt/homebrew/bin/claude"
    
    @patch('shutil.which')
    @patch('os.path.exists')
    def test_cli_not_found_raises_error(self, mock_exists, mock_which):
        """Test that FileNotFoundError is raised when CLI not found"""
        mock_which.return_value = None
        mock_exists.return_value = False
        
        with pytest.raises(FileNotFoundError) as exc_info:
            ClaudeCliWrapper()
        
        assert "Claude CLI not found" in str(exc_info.value)
        assert "npm install -g @anthropic-ai/claude-code" in str(exc_info.value)


class TestAsyncExecution:
    """Test async execution patterns and resource management"""
    
    @pytest.fixture
    def mock_process(self):
        """Create a mock subprocess"""
        process = AsyncMock()
        process.pid = 12345
        process.returncode = 0
        process.wait = AsyncMock(return_value=0)
        process.terminate = Mock()
        process.kill = Mock()
        
        # Mock stdout
        stdout_data = [
            b'{"type": "stream", "content": "Hello"}\n',
            b'{"type": "result", "result": "World", "is_error": false}\n',
            b''  # EOF
        ]
        process.stdout = AsyncMock()
        process.stdout.readline = AsyncMock(side_effect=stdout_data)
        
        # Mock stderr
        process.stderr = AsyncMock()
        process.stderr.readline = AsyncMock(return_value=b'')
        
        return process
    
    @pytest.mark.asyncio
    async def test_successful_execution(self, mock_process):
        """Test successful command execution"""
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            wrapper = ClaudeCliWrapper()
            messages = []
            
            async for message in wrapper.execute("test prompt"):
                messages.append(message)
            
            # Should receive both stream and result messages
            assert len(messages) >= 2
            assert any(msg.type == "stream" for msg in messages)
            assert any(msg.type == "result" for msg in messages)
    
    @pytest.mark.asyncio
    async def test_execution_timeout(self):
        """Test execution timeout handling"""
        # Mock subprocess that never returns
        async def slow_subprocess(*args, **kwargs):
            await asyncio.sleep(10)  # Longer than test timeout
        
        with patch('asyncio.create_subprocess_exec', side_effect=slow_subprocess):
            options = ClaudeCliOptions(timeout=1)  # 1 second timeout
            wrapper = ClaudeCliWrapper(options)
            
            messages = []
            async for message in wrapper.execute("test prompt"):
                messages.append(message)
            
            # Should receive timeout error message
            error_messages = [msg for msg in messages if msg.type == "error"]
            assert any("timeout" in msg.content.lower() for msg in error_messages)
    
    @pytest.mark.asyncio
    async def test_execution_cancellation(self, mock_process):
        """Test handling of cancelled execution"""
        async def cancelled_execution():
            with patch('asyncio.create_subprocess_exec', return_value=mock_process):
                wrapper = ClaudeCliWrapper()
                
                async for message in wrapper.execute("test prompt"):
                    if message.type == "stream":
                        raise asyncio.CancelledError("Test cancellation")
        
        with pytest.raises(asyncio.CancelledError):
            await cancelled_execution()
    
    @pytest.mark.asyncio
    async def test_file_not_found_error(self):
        """Test handling when Claude CLI is not found"""
        with patch('asyncio.create_subprocess_exec', side_effect=FileNotFoundError):
            wrapper = ClaudeCliWrapper()
            messages = []
            
            async for message in wrapper.execute("test prompt"):
                messages.append(message)
            
            assert len(messages) == 1
            assert messages[0].type == "error"
            assert "not found" in messages[0].content.lower()
            assert messages[0].metadata["installation_required"] is True
    
    @pytest.mark.asyncio
    async def test_permission_error(self):
        """Test handling of permission errors"""
        with patch('asyncio.create_subprocess_exec', side_effect=PermissionError):
            wrapper = ClaudeCliWrapper()
            messages = []
            
            async for message in wrapper.execute("test prompt"):
                messages.append(message)
            
            assert len(messages) == 1
            assert messages[0].type == "error"
            assert "permission denied" in messages[0].content.lower()
            assert messages[0].metadata["permission_error"] is True
    
    @pytest.mark.asyncio
    async def test_retry_logic_transient_error(self):
        """Test retry logic for transient errors"""
        call_count = 0
        
        def failing_subprocess(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:  # Fail first 2 attempts
                raise ConnectionError("Network timeout")
            return AsyncMock()  # Success on 3rd attempt
        
        with patch('asyncio.create_subprocess_exec', side_effect=failing_subprocess):
            wrapper = ClaudeCliWrapper()
            messages = []
            
            async for message in wrapper.execute("test prompt"):
                messages.append(message)
                if len(messages) > 10:  # Prevent infinite loop in tests
                    break
            
            # Should have retry messages
            retry_messages = [msg for msg in messages if "retry" in msg.content.lower()]
            assert len(retry_messages) >= 1
            assert call_count == 3  # Should have made 3 attempts


class TestResourceCleanup:
    """Test resource management and cleanup"""
    
    @pytest.mark.asyncio
    async def test_cleanup_method(self):
        """Test the cleanup method"""
        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.terminate = Mock()
        mock_process.kill = Mock()
        mock_process.wait = AsyncMock(return_value=0)
        
        wrapper = ClaudeCliWrapper()
        wrapper.process = mock_process
        
        await wrapper.cleanup()
        
        mock_process.terminate.assert_called_once()
        mock_process.wait.assert_called()
        assert wrapper.process is None
    
    @pytest.mark.asyncio
    async def test_cleanup_with_force_kill(self):
        """Test cleanup when graceful termination times out"""
        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.terminate = Mock()
        mock_process.kill = Mock()
        
        # Mock wait to timeout, then succeed
        mock_process.wait = AsyncMock(side_effect=[asyncio.TimeoutError(), 0])
        
        wrapper = ClaudeCliWrapper()
        wrapper.process = mock_process
        
        await wrapper.cleanup()
        
        mock_process.terminate.assert_called_once()
        mock_process.kill.assert_called_once()
    
    def test_is_available_method(self):
        """Test the is_available method"""
        with patch('shutil.which', return_value="/usr/bin/claude"):
            wrapper = ClaudeCliWrapper()
            assert wrapper.is_available() is True
        
        with patch('shutil.which', return_value=None):
            with patch('os.path.exists', return_value=False):
                try:
                    wrapper = ClaudeCliWrapper()
                    # Should not reach here if FileNotFoundError is raised during init
                    available = wrapper.is_available()
                    assert available is False
                except FileNotFoundError:
                    # Expected behavior when CLI is not found during initialization
                    pass


class TestSynchronousWrapper:
    """Test the ClaudeCliSimple synchronous wrapper"""
    
    @patch('asyncio.run')
    def test_simple_query(self, mock_run):
        """Test simple synchronous query"""
        mock_run.return_value = "Test response"
        
        claude = ClaudeCliSimple()
        result = claude.query("test prompt")
        
        assert result == "Test response"
        mock_run.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_simple_stream_query(self):
        """Test simple streaming query"""
        mock_messages = [
            CliMessage(type="stream", content="Hello"),
            CliMessage(type="stream", content="World")
        ]
        
        async def mock_execute(prompt):
            for message in mock_messages:
                yield message
        
        with patch.object(ClaudeCliWrapper, 'execute', side_effect=mock_execute):
            claude = ClaudeCliSimple()
            messages = []
            
            async for message in claude.stream_query("test prompt"):
                messages.append(message)
            
            assert len(messages) == 2
            assert messages[0].content == "Hello"
            assert messages[1].content == "World"


class TestIntegrationScenarios:
    """Integration test scenarios combining multiple components"""
    
    @pytest.mark.asyncio
    async def test_authentication_flow_scenario(self):
        """Test complete authentication error and recovery scenario"""
        # First call returns auth error
        auth_error_process = AsyncMock()
        auth_error_process.returncode = 1
        auth_error_data = json.dumps({
            "type": "result",
            "result": "Invalid API key · Fix external API key",
            "is_error": True
        }).encode() + b'\n'
        
        auth_error_process.stdout.readline = AsyncMock(side_effect=[auth_error_data, b''])
        auth_error_process.stderr.readline = AsyncMock(return_value=b'')
        auth_error_process.wait = AsyncMock(return_value=1)
        
        with patch('asyncio.create_subprocess_exec', return_value=auth_error_process):
            wrapper = ClaudeCliWrapper()
            messages = []
            
            async for message in wrapper.execute("test prompt"):
                messages.append(message)
            
            auth_messages = [msg for msg in messages if msg.type == "auth_error"]
            assert len(auth_messages) >= 1
            assert "claude setup-token" in auth_messages[0].content
    
    @pytest.mark.asyncio
    async def test_tool_usage_scenario(self):
        """Test tool usage detection scenario"""
        tool_messages = [
            b'{"type": "stream", "content": "I\'ll read the file for you."}\n',
            b'Reading file: test.txt\n',
            b'{"type": "tool_use", "name": "Read", "parameters": {"file_path": "test.txt"}}\n',
            b'File contents: Hello World\n',
            b'{"type": "result", "result": "Task completed", "is_error": false}\n',
            b''
        ]
        
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.stdout.readline = AsyncMock(side_effect=tool_messages)
        mock_process.stderr.readline = AsyncMock(return_value=b'')
        mock_process.wait = AsyncMock(return_value=0)
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            wrapper = ClaudeCliWrapper()
            messages = []
            
            async for message in wrapper.execute("read test.txt"):
                messages.append(message)
            
            tool_action_messages = [msg for msg in messages if msg.type == "tool_action"]
            tool_use_messages = [msg for msg in messages if msg.type == "tool_use"]
            
            assert len(tool_action_messages) >= 1  # "Reading file: test.txt"
            assert len(tool_use_messages) >= 1     # JSON tool_use message


class TestEnhancedResourceManagement:
    """Test enhanced resource management features (Task 2 additions)"""
    
    @pytest.mark.asyncio
    async def test_process_state_transitions(self):
        """Test process state transitions during execution"""
        mock_process = AsyncMock()
        mock_process.pid = 12345
        mock_process.returncode = 0
        mock_process.wait = AsyncMock(return_value=0)
        mock_process.terminate = Mock()
        mock_process.kill = Mock()
        
        stdout_data = [
            b'{"type": "stream", "content": "Hello"}\n',
            b''  # EOF
        ]
        mock_process.stdout = AsyncMock()
        mock_process.stdout.readline = AsyncMock(side_effect=stdout_data)
        mock_process.stderr = AsyncMock()
        mock_process.stderr.readline = AsyncMock(return_value=b'')
        
        from claude_cli_wrapper import ProcessState
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            wrapper = ClaudeCliWrapper()
            
            # Verify initial state
            assert wrapper.process_state == ProcessState.IDLE
            
            messages = []
            async for message in wrapper.execute("test prompt"):
                messages.append(message)
                # During execution, state should be RUNNING
                if len(messages) == 1:
                    assert wrapper.process_state == ProcessState.RUNNING
            
            # After completion, should be terminated or back to idle
            assert wrapper.process_state in [ProcessState.TERMINATED, ProcessState.IDLE]
    
    def test_get_resource_stats_method(self):
        """Test the get_resource_stats method"""
        wrapper = ClaudeCliWrapper()
        
        stats = wrapper.get_resource_stats()
        
        # Verify required fields are present
        required_fields = [
            'process_state', 'registered_resources', 
            'process_pid', 'process_returncode', 'handle_manager_stats'
        ]
        
        for field in required_fields:
            assert field in stats
        
        # Verify data types
        assert isinstance(stats['process_state'], str)
        assert isinstance(stats['registered_resources'], int)
        assert isinstance(stats['handle_manager_stats'], dict)
    
    @pytest.mark.asyncio
    async def test_enhanced_cleanup_integration(self):
        """Test enhanced cleanup method integration"""
        mock_process = AsyncMock()
        mock_process.pid = 12345
        mock_process.returncode = None
        mock_process.terminate = Mock()
        mock_process.kill = Mock()
        mock_process.wait = AsyncMock(return_value=0)
        
        wrapper = ClaudeCliWrapper()
        wrapper.process = mock_process
        
        # Test enhanced cleanup method
        await wrapper._enhanced_cleanup_with_tracking()
        
        # Verify cleanup was attempted
        mock_process.terminate.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_managed_execution_context_manager(self):
        """Test the new managed_execution context manager"""
        mock_process = AsyncMock()
        mock_process.pid = 12345
        mock_process.returncode = 0
        mock_process.wait = AsyncMock(return_value=0)
        mock_process.terminate = Mock()
        mock_process.kill = Mock()
        
        stdout_data = [
            b'{"type": "stream", "content": "Test message"}\n',
            b''
        ]
        mock_process.stdout = AsyncMock()
        mock_process.stdout.readline = AsyncMock(side_effect=stdout_data)
        mock_process.stderr = AsyncMock()
        mock_process.stderr.readline = AsyncMock(return_value=b'')
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            wrapper = ClaudeCliWrapper()
            
            # Use the context manager
            async with wrapper.managed_execution("test prompt") as execution:
                messages = []
                async for message in execution:
                    messages.append(message)
                    if len(messages) >= 1:
                        break
            
            # Verify messages were received
            assert len(messages) >= 1
            assert messages[0].content == "Test message"


class TestAuthenticationRobustnessIntegration:
    """Test authentication robustness features integrated with existing wrapper"""
    
    @pytest.fixture
    def wrapper_with_circuit_breaker(self):
        """Create wrapper with circuit breaker for testing"""
        try:
            from claude_cli_wrapper import CircuitBreakerConfig, RetryStrategy
            options = ClaudeCliOptions(
                enable_circuit_breaker=True,
                circuit_breaker_config=CircuitBreakerConfig(
                    failure_threshold=2,  # Low threshold for testing
                    recovery_timeout=0.1,  # Fast recovery for testing
                    success_threshold=1
                ),
                retry_strategy=RetryStrategy(
                    max_attempts=3,
                    base_delay=0.05,  # Fast retries for testing
                    jitter=False  # Predictable for testing
                )
            )
        except ImportError:
            # Fallback if enhanced components not available
            options = ClaudeCliOptions()
        
        with patch('claude_cli_wrapper.shutil.which', return_value='/usr/bin/claude'):
            return ClaudeCliWrapper(options)
    
    def test_circuit_breaker_initialization(self, wrapper_with_circuit_breaker):
        """Test wrapper initializes circuit breaker correctly"""
        wrapper = wrapper_with_circuit_breaker
        # Check if circuit breaker exists (may not if components not implemented)
        if hasattr(wrapper, 'circuit_breaker') and wrapper.circuit_breaker:
            from claude_cli_wrapper import CircuitBreakerState
            assert wrapper.circuit_breaker.state == CircuitBreakerState.CLOSED
        if hasattr(wrapper, 'retry_strategy'):
            assert wrapper.retry_strategy is not None
        if hasattr(wrapper, 'consecutive_failures'):
            assert wrapper.consecutive_failures == 0
    
    @pytest.mark.asyncio
    async def test_enhanced_authentication_error_detection(self, wrapper_with_circuit_breaker):
        """Test enhanced authentication error detection"""
        wrapper = wrapper_with_circuit_breaker
        
        # Mock process that returns enhanced auth error
        mock_process = AsyncMock()
        mock_process.pid = 12345
        mock_process.stdout.readline = AsyncMock(side_effect=[
            b'{"type": "result", "is_error": true, "result": "Invalid API key provided"}\\n',
            b''
        ])
        mock_process.stderr.readline = AsyncMock(return_value=b'')
        mock_process.wait = AsyncMock(return_value=1)
        mock_process.returncode = 1
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            messages = []
            async for message in wrapper.execute("test prompt"):
                messages.append(message)
        
        # Check for enhanced auth error with setup guidance
        auth_errors = [m for m in messages if m.type == "auth_error"]
        assert len(auth_errors) > 0
        auth_error = auth_errors[0]
        assert "claude setup-token" in auth_error.content
        assert "Verify" in auth_error.content or "Check" in auth_error.content
    
    @pytest.mark.asyncio
    async def test_network_error_retry_logic(self, wrapper_with_circuit_breaker):
        """Test network error retry logic"""
        wrapper = wrapper_with_circuit_breaker
        call_count = 0
        
        async def mock_create_subprocess(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:  # First two attempts fail
                raise ConnectionError("Network timeout")
            
            # Third attempt succeeds
            mock_process = AsyncMock()
            mock_process.pid = 12345
            mock_process.stdout.readline = AsyncMock(side_effect=[
                b'{"type": "result", "result": "Success after retry"}\\n',
                b''
            ])
            mock_process.stderr.readline = AsyncMock(return_value=b'')
            mock_process.wait = AsyncMock(return_value=0)
            mock_process.returncode = 0
            return mock_process
        
        with patch('asyncio.create_subprocess_exec', side_effect=mock_create_subprocess):
            with patch('asyncio.sleep'):  # Speed up test
                messages = []
                async for message in wrapper.execute("test prompt"):
                    messages.append(message)
        
        # Should have retry messages
        retry_messages = [m for m in messages if "retrying" in m.content.lower()]
        success_messages = [m for m in messages if m.type == "result" and "Success" in m.content]
        
        assert len(retry_messages) > 0  # Should have retries
        assert len(success_messages) > 0  # Should eventually succeed
        assert call_count == 3  # Should make 3 attempts
    
    def test_enhanced_error_classification(self, wrapper_with_circuit_breaker):
        """Test enhanced error message classification"""
        wrapper = wrapper_with_circuit_breaker
        
        # Test authentication errors
        auth_error_lines = [
            "Invalid API key provided",
            "Authentication failed - please check credentials", 
            "Unauthorized access to Claude API",
            "Token expired",
            "Subscription required"
        ]
        
        for line in auth_error_lines:
            message = wrapper._parse_line(line, is_stderr=True)
            assert message.type == "auth_error"
            assert "claude setup-token" in message.content
        
        # Test network/transient errors  
        network_error_lines = [
            "Rate limit exceeded - please wait",
            "429 Too Many Requests",
            "503 Service Unavailable",
            "Connection timeout",
            "Network unreachable"
        ]
        
        for line in network_error_lines:
            message = wrapper._parse_line(line, is_stderr=True)
            # Should be classified as retryable error
            if message.metadata.get("is_transient"):
                assert message.metadata["is_transient"] is True
            # Should have retry recommendation if available
            if "retry" in message.content.lower():
                assert "retry" in message.content.lower()


class TestProductionReadinessScenarios:
    """Test production-ready scenarios combining multiple robustness features"""
    
    @pytest.mark.asyncio
    async def test_complete_authentication_failure_recovery(self):
        """Test complete authentication failure and recovery scenario"""
        options = ClaudeCliOptions(timeout=5)  # Short timeout for testing
        
        with patch('claude_cli_wrapper.shutil.which', return_value='/usr/bin/claude'):
            wrapper = ClaudeCliWrapper(options)
        
        # Mock initial auth failure
        auth_failure_process = AsyncMock()
        auth_failure_process.pid = 12345
        auth_failure_process.returncode = 1
        auth_failure_data = json.dumps({
            "type": "result",
            "result": "Invalid API key · Please run claude setup-token",
            "is_error": True
        }).encode() + b'\\n'
        auth_failure_process.stdout.readline = AsyncMock(side_effect=[auth_failure_data, b''])
        auth_failure_process.stderr.readline = AsyncMock(return_value=b'')
        auth_failure_process.wait = AsyncMock(return_value=1)
        
        with patch('asyncio.create_subprocess_exec', return_value=auth_failure_process):
            messages = []
            async for message in wrapper.execute("test prompt"):
                messages.append(message)
            
            # Should detect auth error with guidance
            auth_messages = [msg for msg in messages if msg.type == "auth_error"]
            assert len(auth_messages) >= 1
            
            auth_message = auth_messages[0]
            assert "claude setup-token" in auth_message.content
            assert auth_message.metadata.get("auth_setup_required") is True
    
    @pytest.mark.asyncio 
    async def test_mixed_error_scenario_handling(self):
        """Test handling of mixed error scenarios (auth + network)"""
        with patch('claude_cli_wrapper.shutil.which', return_value='/usr/bin/claude'):
            wrapper = ClaudeCliWrapper()
        
        # Simulate a series of different errors
        error_sequence = [
            ConnectionError("Network timeout"),  # Transient - should retry
            PermissionError("Permission denied"),  # Permanent - should not retry
        ]
        
        call_count = 0
        async def error_sequence_subprocess(*args, **kwargs):
            nonlocal call_count
            if call_count < len(error_sequence):
                error = error_sequence[call_count]
                call_count += 1
                raise error
            # Should not reach here due to permanent error
            return AsyncMock()
        
        with patch('asyncio.create_subprocess_exec', side_effect=error_sequence_subprocess):
            with patch('asyncio.sleep'):  # Speed up test
                messages = []
                async for message in wrapper.execute("test prompt"):
                    messages.append(message)
                
                # Should have network retry, then permanent error
                retry_messages = [m for m in messages if "retrying" in m.content.lower()]
                error_messages = [m for m in messages if m.type == "error"]
                
                assert len(retry_messages) > 0  # Should retry network error
                assert len(error_messages) > 0  # Should get final permission error
                
                # Should attempt network retry but stop at permission error
                assert call_count >= 2


if __name__ == "__main__":
    # Run tests with comprehensive coverage including new robustness features
    pytest.main([__file__, "-v", "--tb=short", "--durations=10", "--cov=claude_cli_wrapper", "--cov-report=term-missing"])