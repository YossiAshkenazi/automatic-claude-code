#!/usr/bin/env python3
"""
Comprehensive test suite for CLI wrappers
Tests Claude, Gemini, and Unified CLI wrappers with mocking and integration scenarios
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from pathlib import Path
from typing import AsyncGenerator, List

# Import the wrappers to test
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions, CliMessage
from gemini_cli_wrapper import GeminiCliWrapper, GeminiCliOptions  
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions


@pytest.mark.unit
class TestClaudeCliOptions:
    """Test Claude CLI options configuration"""
    
    def test_default_options(self):
        """Test default option values"""
        options = ClaudeCliOptions()
        assert options.model == "sonnet"
        assert options.max_turns == 10
        assert options.timeout == 300
        assert "Read" in options.allowed_tools
        
    def test_custom_options(self):
        """Test custom option configuration"""
        options = ClaudeCliOptions(
            model="opus",
            max_turns=5,
            verbose=True,
            timeout=600
        )
        assert options.model == "opus"
        assert options.max_turns == 5
        assert options.verbose is True
        assert options.timeout == 600
        
    def test_to_cli_args(self):
        """Test CLI argument generation"""
        options = ClaudeCliOptions(
            model="opus",
            max_turns=5,
            verbose=True,
            allowed_tools=["Read", "Write"]
        )
        args = options.to_cli_args()
        
        assert "--model" in args
        assert "opus" in args
        assert "--max-turns" in args
        assert "5" in args
        assert "--verbose" in args


@pytest.mark.unit  
class TestGeminiCliOptions:
    """Test Gemini CLI options configuration"""
    
    def test_default_options(self):
        """Test default option values"""
        options = GeminiCliOptions()
        assert options.model == "gemini-2.5-pro"
        assert options.yolo is True
        assert options.sandbox is True
        
    def test_to_cli_args(self):
        """Test CLI argument generation"""
        options = GeminiCliOptions(
            model="gemini-exp-1206",
            yolo=True,
            sandbox=False,
            verbose=True
        )
        args = options.to_cli_args()
        
        assert "--yolo" in args
        assert "-m" in args
        assert "gemini-exp-1206" in args
        assert "--verbose" in args


@pytest.mark.unit
class TestClaudeCliWrapper:
    """Test Claude CLI wrapper functionality"""
    
    @pytest.fixture
    def mock_subprocess(self):
        """Mock subprocess for testing CLI interactions"""
        with patch('claude_cli_wrapper.subprocess') as mock_sub:
            # Configure mock process
            mock_process = Mock()
            mock_process.returncode = 0
            mock_process.stdout = Mock()
            mock_process.stderr = Mock()
            mock_process.communicate = AsyncMock(return_value=(b"Mock output", b""))
            mock_process.wait = AsyncMock(return_value=0)
            
            mock_sub.Popen.return_value = mock_process
            yield mock_sub
            
    @pytest.fixture
    def wrapper(self, temp_workspace):
        """Create Claude CLI wrapper for testing"""
        options = ClaudeCliOptions(
            working_directory=temp_workspace,
            timeout=30
        )
        return ClaudeCliWrapper(options)
        
    def test_initialization(self, wrapper):
        """Test wrapper initialization"""
        assert isinstance(wrapper.options, ClaudeCliOptions)
        assert wrapper.options.model == "sonnet"
        
    def test_is_available_with_cli(self, wrapper):
        """Test CLI availability check when CLI exists"""
        with patch('shutil.which', return_value='/usr/local/bin/claude'):
            assert wrapper.is_available() is True
            
    def test_is_available_without_cli(self, wrapper):
        """Test CLI availability check when CLI missing"""
        with patch('shutil.which', return_value=None):
            assert wrapper.is_available() is False
            
    @pytest.mark.asyncio
    async def test_execute_sync_success(self, wrapper, mock_subprocess):
        """Test synchronous execution success"""
        mock_subprocess.run.return_value = Mock(
            returncode=0,
            stdout="Success response",
            stderr=""
        )
        
        result = await wrapper.execute_sync("Test prompt")
        assert result == "Success response"
        
    @pytest.mark.asyncio
    async def test_execute_sync_failure(self, wrapper, mock_subprocess):
        """Test synchronous execution failure"""
        mock_subprocess.run.return_value = Mock(
            returncode=1,
            stdout="",
            stderr="Error occurred"
        )
        
        with pytest.raises(Exception) as exc_info:
            await wrapper.execute_sync("Test prompt")
        assert "Error occurred" in str(exc_info.value)
        
    @pytest.mark.asyncio
    async def test_execute_streaming(self, wrapper, mock_subprocess):
        """Test streaming execution"""
        # Mock async process with streaming output
        mock_process = AsyncMock()
        mock_process.stdout = AsyncMock()
        mock_process.stdout.readline = AsyncMock(side_effect=[
            b'{"type": "result", "content": "First chunk"}\n',
            b'{"type": "result", "content": "Second chunk"}\n', 
            b''  # EOF
        ])
        mock_process.wait = AsyncMock(return_value=0)
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            messages = []
            async for message in wrapper.execute("Test prompt"):
                messages.append(message)
                
            assert len(messages) == 2
            assert messages[0].content == "First chunk"
            assert messages[1].content == "Second chunk"


@pytest.mark.unit
class TestGeminiCliWrapper:
    """Test Gemini CLI wrapper functionality"""
    
    @pytest.fixture
    def wrapper(self, temp_workspace):
        """Create Gemini CLI wrapper for testing"""
        options = GeminiCliOptions(
            working_directory=temp_workspace,
            timeout=30
        )
        return GeminiCliWrapper(options)
        
    def test_initialization(self, wrapper):
        """Test wrapper initialization"""
        assert isinstance(wrapper.options, GeminiCliOptions)
        assert wrapper.options.model == "gemini-2.5-pro"
        
    def test_is_available_with_cli(self, wrapper):
        """Test CLI availability when gemini CLI exists"""
        with patch('shutil.which', return_value='/usr/local/bin/gemini'):
            assert wrapper.is_available() is True
            
    @pytest.mark.asyncio
    async def test_execute_sync_gemini(self, wrapper):
        """Test Gemini synchronous execution"""
        with patch('gemini_cli_wrapper.subprocess') as mock_sub:
            mock_sub.run.return_value = Mock(
                returncode=0,
                stdout="Gemini response",
                stderr=""
            )
            
            result = await wrapper.execute_sync("Test prompt")
            assert result == "Gemini response"


@pytest.mark.unit
class TestUnifiedCliWrapper:
    """Test unified CLI wrapper functionality"""
    
    @pytest.fixture
    def wrapper(self, temp_workspace):
        """Create unified CLI wrapper for testing"""
        options = UnifiedCliOptions(
            working_directory=temp_workspace,
            model="auto"
        )
        return UnifiedCliWrapper(options)
        
    def test_auto_detection_claude(self, wrapper):
        """Test auto-detection selects Claude when available"""
        with patch('shutil.which') as mock_which:
            mock_which.side_effect = lambda cmd: '/usr/local/bin/claude' if cmd == 'claude' else None
            
            detected_wrapper = wrapper._detect_available_model()
            assert isinstance(detected_wrapper, ClaudeCliWrapper)
            
    def test_auto_detection_gemini(self, wrapper):
        """Test auto-detection selects Gemini when Claude unavailable"""
        with patch('shutil.which') as mock_which:
            mock_which.side_effect = lambda cmd: '/usr/local/bin/gemini' if cmd == 'gemini' else None
            
            detected_wrapper = wrapper._detect_available_model()
            assert isinstance(detected_wrapper, GeminiCliWrapper)
            
    def test_explicit_model_selection(self, temp_workspace):
        """Test explicit model selection"""
        # Test Claude selection
        claude_options = UnifiedCliOptions(
            model="claude:sonnet",
            working_directory=temp_workspace
        )
        claude_wrapper = UnifiedCliWrapper(claude_options)
        underlying = claude_wrapper._get_underlying_wrapper()
        assert isinstance(underlying, ClaudeCliWrapper)
        
        # Test Gemini selection  
        gemini_options = UnifiedCliOptions(
            model="gemini:gemini-2.5-pro",
            working_directory=temp_workspace
        )
        gemini_wrapper = UnifiedCliWrapper(gemini_options)
        underlying = gemini_wrapper._get_underlying_wrapper()
        assert isinstance(underlying, GeminiCliWrapper)
        
    @pytest.mark.asyncio
    async def test_unified_execute_sync(self, wrapper):
        """Test unified synchronous execution"""
        with patch.object(wrapper, '_get_underlying_wrapper') as mock_get_wrapper:
            mock_claude = Mock()
            mock_claude.execute_sync = AsyncMock(return_value="Unified response")
            mock_get_wrapper.return_value = mock_claude
            
            result = await wrapper.execute_sync("Test prompt")
            assert result == "Unified response"
            
    @pytest.mark.asyncio
    async def test_unified_execute_streaming(self, wrapper):
        """Test unified streaming execution"""
        async def mock_stream():
            yield CliMessage(type="result", content="Stream 1")
            yield CliMessage(type="result", content="Stream 2")
            
        with patch.object(wrapper, '_get_underlying_wrapper') as mock_get_wrapper:
            mock_claude = Mock()
            mock_claude.execute = Mock(return_value=mock_stream())
            mock_get_wrapper.return_value = mock_claude
            
            messages = []
            async for message in wrapper.execute("Test prompt"):
                messages.append(message)
                
            assert len(messages) == 2
            assert messages[0].content == "Stream 1"


@pytest.mark.integration
class TestCliWrappersIntegration:
    """Integration tests for CLI wrappers"""
    
    @pytest.mark.slow
    @pytest.mark.requires_claude_cli
    async def test_real_claude_integration(self, temp_workspace):
        """Test real Claude CLI integration (requires CLI installed)"""
        options = ClaudeCliOptions(
            working_directory=temp_workspace,
            max_turns=1,
            timeout=60
        )
        wrapper = ClaudeCliWrapper(options)
        
        if not wrapper.is_available():
            pytest.skip("Claude CLI not available")
            
        result = await wrapper.execute_sync("Say hello")
        assert isinstance(result, str)
        assert len(result) > 0
        
    def test_error_handling(self):
        """Test error handling for various scenarios"""
        # Test with invalid working directory
        with pytest.raises(Exception):
            options = ClaudeCliOptions(
                working_directory=Path("/nonexistent/path")
            )
            ClaudeCliWrapper(options)
            
    def test_timeout_handling(self):
        """Test timeout configuration"""
        options = ClaudeCliOptions(timeout=1)  # Very short timeout
        wrapper = ClaudeCliWrapper(options)
        
        # Timeout should be properly configured
        assert wrapper.options.timeout == 1


@pytest.mark.unit
class TestPerformanceBenchmarks:
    """Performance benchmarks for CLI wrappers"""
    
    @pytest.mark.asyncio
    async def test_concurrent_execution(self, temp_workspace):
        """Test concurrent execution performance"""
        options = ClaudeCliOptions(
            working_directory=temp_workspace,
            timeout=10
        )
        wrapper = ClaudeCliWrapper(options)
        
        with patch('claude_cli_wrapper.subprocess') as mock_sub:
            mock_sub.run.return_value = Mock(
                returncode=0,
                stdout="Mock response",
                stderr=""
            )
            
            # Execute multiple requests concurrently
            tasks = [
                wrapper.execute_sync(f"Test prompt {i}")
                for i in range(5)
            ]
            
            import time
            start_time = time.time()
            results = await asyncio.gather(*tasks)
            end_time = time.time()
            
            # All tasks should complete
            assert len(results) == 5
            assert all(r == "Mock response" for r in results)
            
            # Should complete in reasonable time (mocked, so should be fast)
            assert end_time - start_time < 5.0


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and error scenarios"""
    
    def test_invalid_model_selection(self):
        """Test handling of invalid model names"""
        with pytest.raises(ValueError):
            UnifiedCliOptions(model="invalid:model:name")
            
    def test_empty_prompt_handling(self, temp_workspace):
        """Test handling of empty prompts"""
        options = ClaudeCliOptions(working_directory=temp_workspace)
        wrapper = ClaudeCliWrapper(options)
        
        with patch('claude_cli_wrapper.subprocess') as mock_sub:
            mock_sub.run.return_value = Mock(
                returncode=1,
                stdout="",
                stderr="Empty prompt error"
            )
            
            # Should handle empty prompt gracefully
            with pytest.raises(Exception) as exc_info:
                asyncio.run(wrapper.execute_sync(""))
            assert "Empty prompt error" in str(exc_info.value)
            
    def test_large_response_handling(self, temp_workspace):
        """Test handling of large responses"""
        options = ClaudeCliOptions(working_directory=temp_workspace)
        wrapper = ClaudeCliWrapper(options)
        
        large_response = "x" * 10000  # 10KB response
        
        with patch('claude_cli_wrapper.subprocess') as mock_sub:
            mock_sub.run.return_value = Mock(
                returncode=0,
                stdout=large_response,
                stderr=""
            )
            
            result = asyncio.run(wrapper.execute_sync("Large prompt"))
            assert len(result) == 10000
            assert result == large_response
            
    @pytest.mark.asyncio
    async def test_streaming_interruption(self, temp_workspace):
        """Test streaming interruption handling"""
        options = ClaudeCliOptions(working_directory=temp_workspace)
        wrapper = ClaudeCliWrapper(options)
        
        mock_process = AsyncMock()
        mock_process.stdout = AsyncMock()
        mock_process.stdout.readline = AsyncMock(side_effect=[
            b'{"type": "result", "content": "First"}\n',
            asyncio.CancelledError()  # Simulate interruption
        ])
        mock_process.terminate = AsyncMock()
        mock_process.wait = AsyncMock(return_value=1)
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            with pytest.raises(asyncio.CancelledError):
                messages = []
                async for message in wrapper.execute("Test prompt"):
                    messages.append(message)
                    if len(messages) == 1:
                        # Simulate interruption after first message
                        raise asyncio.CancelledError()


if __name__ == "__main__":
    # Run tests with coverage
    pytest.main([
        __file__,
        "--verbose",
        "--cov=claude_cli_wrapper",
        "--cov=gemini_cli_wrapper", 
        "--cov=unified_cli_wrapper",
        "--cov-report=term-missing",
        "--cov-report=html"
    ])