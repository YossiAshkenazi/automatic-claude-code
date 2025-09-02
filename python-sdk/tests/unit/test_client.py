"""
Unit tests for ClaudeCodeClient
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, Mock, patch
from claude_code_sdk import ClaudeCodeClient, ClaudeCodeOptions
from claude_code_sdk.exceptions import ClaudeCodeError, ClaudeTimeoutError


class TestClaudeCodeClient:
    """Test suite for ClaudeCodeClient."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_client_initialization(self, claude_code_options):
        """Test client initialization with options."""
        client = ClaudeCodeClient(claude_code_options)
        assert client.options.model == "sonnet"
        assert client.options.max_turns == 5
        assert not client.options.verbose

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_context_manager(self, claude_code_options):
        """Test client as context manager."""
        async with ClaudeCodeClient(claude_code_options) as client:
            assert client is not None
            assert client.options.model == "sonnet"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_query_success(self, claude_code_options, sample_claude_response):
        """Test successful query execution."""
        with patch('claude_code_sdk.client.subprocess') as mock_subprocess:
            mock_process = Mock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(
                return_value=(str(sample_claude_response).encode(), b"")
            )
            mock_subprocess.create_subprocess_exec = AsyncMock(return_value=mock_process)

            client = ClaudeCodeClient(claude_code_options)
            messages = []
            
            async for message in client.query("Test prompt"):
                messages.append(message)
            
            assert len(messages) > 0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_query_timeout(self, claude_code_options):
        """Test query timeout handling."""
        with patch('claude_code_sdk.client.subprocess') as mock_subprocess:
            # Simulate a long-running process
            mock_process = Mock()
            mock_process.communicate = AsyncMock(
                side_effect=asyncio.TimeoutError("Process timed out")
            )
            mock_subprocess.create_subprocess_exec = AsyncMock(return_value=mock_process)

            client = ClaudeCodeClient(claude_code_options)
            
            with pytest.raises(ClaudeTimeoutError):
                async for _ in client.query("Test prompt"):
                    pass

    @pytest.mark.unit
    def test_invalid_options(self):
        """Test client creation with invalid options."""
        with pytest.raises((ValueError, TypeError)):
            ClaudeCodeClient(None)

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_multiple_queries(self, claude_code_options, sample_claude_response):
        """Test multiple sequential queries."""
        with patch('claude_code_sdk.client.subprocess') as mock_subprocess:
            mock_process = Mock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(
                return_value=(str(sample_claude_response).encode(), b"")
            )
            mock_subprocess.create_subprocess_exec = AsyncMock(return_value=mock_process)

            async with ClaudeCodeClient(claude_code_options) as client:
                # First query
                messages1 = []
                async for message in client.query("First prompt"):
                    messages1.append(message)
                
                # Second query
                messages2 = []
                async for message in client.query("Second prompt"):
                    messages2.append(message)
                
                assert len(messages1) > 0
                assert len(messages2) > 0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_error_handling(self, claude_code_options):
        """Test error handling in client operations."""
        with patch('claude_code_sdk.client.subprocess') as mock_subprocess:
            mock_process = Mock()
            mock_process.returncode = 1
            mock_process.communicate = AsyncMock(
                return_value=(b"", b"Error: Authentication failed")
            )
            mock_subprocess.create_subprocess_exec = AsyncMock(return_value=mock_process)

            client = ClaudeCodeClient(claude_code_options)
            
            with pytest.raises(ClaudeCodeError):
                async for _ in client.query("Test prompt"):
                    pass

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_cleanup_on_exception(self, claude_code_options):
        """Test proper cleanup when exceptions occur."""
        with patch('claude_code_sdk.client.subprocess') as mock_subprocess:
            mock_subprocess.create_subprocess_exec = AsyncMock(
                side_effect=Exception("Subprocess creation failed")
            )

            client = ClaudeCodeClient(claude_code_options)
            
            with pytest.raises(Exception):
                async for _ in client.query("Test prompt"):
                    pass