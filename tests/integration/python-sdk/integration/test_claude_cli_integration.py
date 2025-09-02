"""
Integration tests for Claude CLI integration
"""

import os
import pytest
from claude_code_sdk import query, ClaudeCodeClient, ClaudeCodeOptions
from claude_code_sdk.exceptions import ClaudeNotFoundError, ClaudeAuthError


class TestClaudeCLIIntegration:
    """Integration tests for Claude CLI functionality."""

    @pytest.mark.integration
    @pytest.mark.requires_claude_cli
    @pytest.mark.asyncio
    async def test_claude_cli_detection(self):
        """Test Claude CLI detection."""
        from claude_code_sdk.utils import CLIDetector
        
        detector = CLIDetector()
        result = await detector.detect_claude_cli()
        
        # In test environment, CLI might not be available
        if os.getenv("CLAUDE_CLI_TEST_SKIP_AUTH") == "true":
            pytest.skip("Claude CLI not available in test environment")
        
        assert isinstance(result, dict)
        assert "available" in result

    @pytest.mark.integration
    @pytest.mark.requires_claude_cli
    @pytest.mark.asyncio
    async def test_simple_query_integration(self):
        """Test simple query integration with Claude CLI."""
        if os.getenv("CLAUDE_CLI_TEST_SKIP_AUTH") == "true":
            pytest.skip("Claude CLI authentication not available in test environment")
            
        try:
            messages = []
            async for message in query("Say hello in Python", timeout=30):
                messages.append(message)
                if len(messages) >= 1:  # Limit for test
                    break
            
            assert len(messages) > 0
            
        except (ClaudeNotFoundError, ClaudeAuthError):
            pytest.skip("Claude CLI not properly configured for integration tests")

    @pytest.mark.integration
    @pytest.mark.requires_claude_cli
    @pytest.mark.asyncio
    async def test_client_integration(self):
        """Test client integration with Claude CLI."""
        if os.getenv("CLAUDE_CLI_TEST_SKIP_AUTH") == "true":
            pytest.skip("Claude CLI authentication not available in test environment")
            
        options = ClaudeCodeOptions(
            model="sonnet",
            max_turns=1,
            timeout=30,
            verbose=False
        )
        
        try:
            async with ClaudeCodeClient(options) as client:
                messages = []
                async for message in client.query("Print 'Integration test successful'"):
                    messages.append(message)
                    if len(messages) >= 1:  # Limit for test
                        break
                
                assert len(messages) > 0
                
        except (ClaudeNotFoundError, ClaudeAuthError):
            pytest.skip("Claude CLI not properly configured for integration tests")

    @pytest.mark.integration
    @pytest.mark.slow
    @pytest.mark.requires_claude_cli
    @pytest.mark.asyncio
    async def test_file_operations_integration(self, temp_workspace):
        """Test file operations integration."""
        if os.getenv("CLAUDE_CLI_TEST_SKIP_AUTH") == "true":
            pytest.skip("Claude CLI authentication not available in test environment")
            
        options = ClaudeCodeOptions(
            allowed_tools=["Read", "Write"],
            max_turns=3,
            timeout=60
        )
        
        try:
            async with ClaudeCodeClient(options) as client:
                # Change to temp workspace
                original_cwd = os.getcwd()
                os.chdir(str(temp_workspace))
                
                try:
                    messages = []
                    async for message in client.query(
                        f"Read the file at {temp_workspace / 'test_file.py'} and summarize it"
                    ):
                        messages.append(message)
                        if len(messages) >= 2:  # Limit for test
                            break
                    
                    assert len(messages) > 0
                    
                finally:
                    os.chdir(original_cwd)
                    
        except (ClaudeNotFoundError, ClaudeAuthError):
            pytest.skip("Claude CLI not properly configured for integration tests")

    @pytest.mark.integration
    @pytest.mark.requires_claude_cli
    @pytest.mark.asyncio
    async def test_error_handling_integration(self):
        """Test error handling in integration scenarios."""
        if os.getenv("CLAUDE_CLI_TEST_SKIP_AUTH") == "true":
            pytest.skip("Claude CLI authentication not available in test environment")
            
        # Test with invalid model to trigger error
        options = ClaudeCodeOptions(
            model="invalid-model-name",
            timeout=10
        )
        
        try:
            async with ClaudeCodeClient(options) as client:
                with pytest.raises(Exception):  # Should raise some kind of error
                    async for _ in client.query("Test prompt"):
                        pass
                        
        except (ClaudeNotFoundError, ClaudeAuthError):
            pytest.skip("Claude CLI not properly configured for integration tests")

    @pytest.mark.integration
    @pytest.mark.requires_claude_cli
    @pytest.mark.asyncio
    async def test_streaming_integration(self):
        """Test streaming responses integration."""
        if os.getenv("CLAUDE_CLI_TEST_SKIP_AUTH") == "true":
            pytest.skip("Claude CLI authentication not available in test environment")
            
        try:
            message_count = 0
            async for message in query("Count from 1 to 3", timeout=30):
                message_count += 1
                if message_count >= 3:  # Limit for test
                    break
            
            assert message_count > 0
            
        except (ClaudeNotFoundError, ClaudeAuthError):
            pytest.skip("Claude CLI not properly configured for integration tests")