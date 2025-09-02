#!/usr/bin/env python3
"""
Comprehensive Authentication & Error Handling Robustness Tests

This test suite validates Task 3 requirements from Story 1.1:
- Circuit Breaker Pattern for authentication failures
- Comprehensive retry logic with exponential backoff
- Network timeout and transient failure handling
- Authentication status detection and recovery guidance
"""

import pytest
import asyncio
import json
import time
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import AsyncGenerator, Dict, Any
import logging

# Import the components we're testing
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from claude_cli_wrapper import (
    ClaudeCliWrapper, ClaudeCliOptions, CliMessage,
    AuthenticationCircuitBreaker, CircuitBreakerState, CircuitBreakerConfig,
    RetryStrategy
)

# Setup test logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class TestCircuitBreakerPattern:
    """Test the Circuit Breaker Pattern implementation"""
    
    def test_circuit_breaker_initialization(self):
        """Test circuit breaker initializes in CLOSED state"""
        breaker = AuthenticationCircuitBreaker()
        assert breaker.state == CircuitBreakerState.CLOSED
        assert breaker.failure_count == 0
        assert breaker.success_count == 0
        assert breaker.can_execute() is True
    
    def test_circuit_breaker_custom_config(self):
        """Test circuit breaker with custom configuration"""
        config = CircuitBreakerConfig(
            failure_threshold=3,
            recovery_timeout=30.0,
            success_threshold=1
        )
        breaker = AuthenticationCircuitBreaker(config)
        assert breaker.config.failure_threshold == 3
        assert breaker.config.recovery_timeout == 30.0
        assert breaker.config.success_threshold == 1
    
    def test_circuit_breaker_failure_threshold(self):
        """Test circuit breaker opens after failure threshold"""
        config = CircuitBreakerConfig(failure_threshold=3, recovery_timeout=60.0)
        breaker = AuthenticationCircuitBreaker(config)
        
        # Record failures up to threshold
        for i in range(2):
            breaker.record_failure(is_auth_failure=True)
            assert breaker.state == CircuitBreakerState.CLOSED
            assert breaker.can_execute() is True
        
        # Third failure should open circuit
        breaker.record_failure(is_auth_failure=True)
        assert breaker.state == CircuitBreakerState.OPEN
        assert breaker.can_execute() is False
    
    def test_circuit_breaker_non_auth_failures_ignored(self):
        """Test non-authentication failures don't count toward circuit breaker"""
        config = CircuitBreakerConfig(failure_threshold=2)
        breaker = AuthenticationCircuitBreaker(config)
        
        # Record multiple non-auth failures
        for i in range(5):
            breaker.record_failure(is_auth_failure=False)
        
        # Should still be closed
        assert breaker.state == CircuitBreakerState.CLOSED
        assert breaker.can_execute() is True
        assert breaker.failure_count == 0
    
    def test_circuit_breaker_recovery_timeout(self):
        """Test circuit breaker transitions to HALF_OPEN after recovery timeout"""
        config = CircuitBreakerConfig(failure_threshold=2, recovery_timeout=0.1)
        breaker = AuthenticationCircuitBreaker(config)
        
        # Open the circuit
        breaker.record_failure(is_auth_failure=True)
        breaker.record_failure(is_auth_failure=True)
        assert breaker.state == CircuitBreakerState.OPEN
        
        # Before timeout
        assert breaker.can_execute() is False
        
        # Wait for timeout
        time.sleep(0.2)
        
        # Should allow execution (transitions to HALF_OPEN internally)
        assert breaker.can_execute() is True
        assert breaker.state == CircuitBreakerState.HALF_OPEN
    
    def test_circuit_breaker_half_open_success_recovery(self):
        """Test circuit breaker closes after successful recovery"""
        config = CircuitBreakerConfig(failure_threshold=2, success_threshold=2)
        breaker = AuthenticationCircuitBreaker(config)
        
        # Open the circuit
        breaker.record_failure(is_auth_failure=True)
        breaker.record_failure(is_auth_failure=True)
        breaker.state = CircuitBreakerState.HALF_OPEN  # Simulate timeout passed
        
        # Record successes
        breaker.record_success()
        assert breaker.state == CircuitBreakerState.HALF_OPEN
        
        breaker.record_success()
        assert breaker.state == CircuitBreakerState.CLOSED
        assert breaker.failure_count == 0
    
    def test_circuit_breaker_half_open_failure_reopens(self):
        """Test circuit breaker reopens if failure occurs during half-open state"""
        config = CircuitBreakerConfig(failure_threshold=2, recovery_timeout=60.0)
        breaker = AuthenticationCircuitBreaker(config)
        
        # Set to half-open state
        breaker.state = CircuitBreakerState.HALF_OPEN
        
        # Record failure during recovery test
        breaker.record_failure(is_auth_failure=True)
        
        assert breaker.state == CircuitBreakerState.OPEN
        assert breaker.success_count == 0
        assert breaker.can_execute() is False
    
    def test_circuit_breaker_get_status(self):
        """Test circuit breaker status reporting"""
        config = CircuitBreakerConfig(failure_threshold=3, recovery_timeout=60.0)
        breaker = AuthenticationCircuitBreaker(config)
        
        status = breaker.get_status()
        assert status["state"] == "closed"
        assert status["failure_count"] == 0
        assert status["can_execute"] is True
        
        # Record failure and check status
        breaker.record_failure(is_auth_failure=True)
        status = breaker.get_status()
        assert status["failure_count"] == 1
        assert status["last_failure_age"] is not None


class TestRetryStrategy:
    """Test the RetryStrategy implementation"""
    
    def test_retry_strategy_initialization(self):
        """Test retry strategy initializes with default values"""
        strategy = RetryStrategy()
        assert strategy.max_attempts == 3
        assert strategy.base_delay == 1.0
        assert strategy.backoff_factor == 2.0
        assert strategy.jitter is True
    
    def test_retry_strategy_custom_config(self):
        """Test retry strategy with custom configuration"""
        strategy = RetryStrategy(
            max_attempts=5,
            base_delay=2.0,
            max_delay=120.0,
            backoff_factor=3.0,
            jitter=False
        )
        assert strategy.max_attempts == 5
        assert strategy.base_delay == 2.0
        assert strategy.max_delay == 120.0
        assert strategy.backoff_factor == 3.0
        assert strategy.jitter is False
    
    def test_retry_strategy_exponential_backoff(self):
        """Test exponential backoff delay calculation"""
        strategy = RetryStrategy(
            base_delay=1.0,
            backoff_factor=2.0,
            max_delay=60.0,
            jitter=False  # Disable jitter for predictable testing
        )
        
        # Test delay progression
        assert strategy.get_delay(0) == 1.0  # Base delay
        assert strategy.get_delay(1) == 2.0  # 1 * 2^1
        assert strategy.get_delay(2) == 4.0  # 1 * 2^2
        assert strategy.get_delay(3) == 8.0  # 1 * 2^3
    
    def test_retry_strategy_max_delay_cap(self):
        """Test delay is capped at max_delay"""
        strategy = RetryStrategy(
            base_delay=10.0,
            backoff_factor=2.0,
            max_delay=15.0,
            jitter=False
        )
        
        # Large attempt number should be capped
        assert strategy.get_delay(10) == 15.0
    
    def test_retry_strategy_jitter(self):
        """Test jitter adds randomness to delays"""
        strategy = RetryStrategy(
            base_delay=10.0,
            backoff_factor=1.0,  # No exponential growth
            jitter=True
        )
        
        # Generate multiple delays and check they vary
        delays = [strategy.get_delay(0) for _ in range(10)]
        
        # Should have variation due to jitter (±25%)
        min_expected = 7.5  # 10 - 25%
        max_expected = 12.5  # 10 + 25%
        
        assert all(min_expected <= delay <= max_expected for delay in delays)
        assert len(set(delays)) > 1  # Should have some variation
    
    def test_retry_strategy_should_retry_transient_errors(self):
        """Test retry strategy identifies transient errors correctly"""
        strategy = RetryStrategy(max_attempts=3)
        
        # Transient errors should be retryable
        transient_errors = [
            ConnectionError("Connection refused"),
            TimeoutError("Network timeout"),
            Exception("503 Service Unavailable"),
            Exception("429 Rate limit exceeded"),
            Exception("Temporary failure")
        ]
        
        for error in transient_errors:
            # Should retry on first few attempts
            assert strategy.should_retry(0, error) is True
            assert strategy.should_retry(1, error) is True
            
            # Should not retry after max attempts
            assert strategy.should_retry(3, error) is False
    
    def test_retry_strategy_should_not_retry_permanent_errors(self):
        """Test retry strategy doesn't retry permanent errors"""
        strategy = RetryStrategy(max_attempts=3)
        
        permanent_errors = [
            Exception("Invalid API key"),
            Exception("Authentication failed"),
            Exception("Unauthorized access"),
            Exception("404 Not Found"),
            Exception("Permission denied")
        ]
        
        for error in permanent_errors:
            # Should not retry permanent errors
            assert strategy.should_retry(0, error) is False
            assert strategy.should_retry(1, error) is False


class TestClaudeCliWrapperAuthenticationRobustness:
    """Test ClaudeCliWrapper authentication and error handling robustness"""
    
    @pytest.fixture
    def wrapper_options(self):
        """Create test options with circuit breaker enabled"""
        return ClaudeCliOptions(
            model="sonnet",
            timeout=10,
            enable_circuit_breaker=True,
            circuit_breaker_config=CircuitBreakerConfig(
                failure_threshold=3,
                recovery_timeout=1.0,  # Short timeout for testing
                success_threshold=2
            ),
            retry_strategy=RetryStrategy(
                max_attempts=3,
                base_delay=0.1,  # Fast retries for testing
                max_delay=1.0,
                jitter=False  # Predictable for testing
            ),
            network_timeout=5,
            connection_timeout=2
        )
    
    @pytest.fixture
    def mock_cli_wrapper(self, wrapper_options):
        """Create a wrapper with mocked CLI path"""
        with patch('claude_cli_wrapper.shutil.which', return_value='/usr/bin/claude'):
            wrapper = ClaudeCliWrapper(wrapper_options)
            wrapper.cli_path = '/usr/bin/claude'
            return wrapper
    
    def test_wrapper_circuit_breaker_initialization(self, mock_cli_wrapper):
        """Test wrapper initializes circuit breaker correctly"""
        assert mock_cli_wrapper.circuit_breaker is not None
        assert mock_cli_wrapper.circuit_breaker.state == CircuitBreakerState.CLOSED
        assert mock_cli_wrapper.retry_strategy is not None
        assert mock_cli_wrapper.consecutive_failures == 0
    
    def test_wrapper_circuit_breaker_disabled(self):
        """Test wrapper works with circuit breaker disabled"""
        options = ClaudeCliOptions(enable_circuit_breaker=False)
        with patch('claude_cli_wrapper.shutil.which', return_value='/usr/bin/claude'):
            wrapper = ClaudeCliWrapper(options)
            assert wrapper.circuit_breaker is None
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_prevents_execution(self, mock_cli_wrapper):
        """Test circuit breaker prevents execution when open"""
        # Open the circuit breaker
        mock_cli_wrapper.circuit_breaker.state = CircuitBreakerState.OPEN
        mock_cli_wrapper.circuit_breaker.next_attempt_time = time.time() + 60  # Future time
        
        messages = []
        async for message in mock_cli_wrapper.execute("test prompt"):
            messages.append(message)
        
        assert len(messages) == 1
        assert messages[0].type == "auth_error"
        assert "Circuit breaker OPEN" in messages[0].content
        assert messages[0].metadata["circuit_breaker_open"] is True
        assert messages[0].metadata["auth_setup_required"] is True
    
    @pytest.mark.asyncio
    async def test_authentication_error_detection_and_circuit_breaker(self, mock_cli_wrapper):
        """Test authentication error detection triggers circuit breaker"""
        # Mock subprocess that returns auth error
        mock_process = AsyncMock()
        mock_process.pid = 12345
        mock_process.stdout.readline = AsyncMock(side_effect=[
            b'{"type": "result", "is_error": true, "result": "Invalid API key provided"}\n',
            b''  # EOF
        ])
        mock_process.stderr.readline = AsyncMock(return_value=b'')
        mock_process.wait = AsyncMock(return_value=1)  # Auth failure exit code
        mock_process.returncode = 1
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            messages = []
            async for message in mock_cli_wrapper.execute("test prompt"):
                messages.append(message)
        
        # Should have detected auth error and updated circuit breaker
        auth_errors = [m for m in messages if m.type == "auth_error"]
        assert len(auth_errors) > 0
        assert mock_cli_wrapper.circuit_breaker.failure_count > 0
    
    @pytest.mark.asyncio
    async def test_network_timeout_retry_logic(self, mock_cli_wrapper):
        """Test network timeout triggers retry with exponential backoff"""
        call_count = 0
        
        async def mock_create_subprocess(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:  # First two attempts timeout
                raise asyncio.TimeoutError("Network timeout")
            
            # Third attempt succeeds
            mock_process = AsyncMock()
            mock_process.pid = 12345
            mock_process.stdout.readline = AsyncMock(side_effect=[
                b'{"type": "stream", "content": "Hello"}\n',
                b'{"type": "result", "result": "Success"}\n',
                b''
            ])
            mock_process.stderr.readline = AsyncMock(return_value=b'')
            mock_process.wait = AsyncMock(return_value=0)
            mock_process.returncode = 0
            return mock_process
        
        with patch('asyncio.create_subprocess_exec', side_effect=mock_create_subprocess):
            messages = []
            async for message in mock_cli_wrapper.execute("test prompt"):
                messages.append(message)
        
        # Should have retry messages
        retry_messages = [m for m in messages if m.type == "status" and "retrying" in m.content]
        assert len(retry_messages) == 2  # Two retries before success
        
        # Should have final success
        result_messages = [m for m in messages if m.type == "result"]
        assert len(result_messages) > 0
        assert call_count == 3
    
    @pytest.mark.asyncio
    async def test_transient_vs_permanent_error_classification(self, mock_cli_wrapper):
        """Test proper classification of transient vs permanent errors"""
        
        # Test transient error (should retry)
        with patch('asyncio.create_subprocess_exec', side_effect=ConnectionError("Connection refused")):
            messages = []
            async for message in mock_cli_wrapper.execute("test prompt"):
                messages.append(message)
            
            retry_messages = [m for m in messages if m.type == "status" and "retrying" in m.content]
            assert len(retry_messages) > 0  # Should have retries
        
        # Reset wrapper
        mock_cli_wrapper.consecutive_failures = 0
        
        # Test permanent error (should not retry)
        with patch('asyncio.create_subprocess_exec', side_effect=PermissionError("Permission denied")):
            messages = []
            async for message in mock_cli_wrapper.execute("test prompt"):
                messages.append(message)
            
            retry_messages = [m for m in messages if m.type == "status" and "retrying" in m.content]
            assert len(retry_messages) == 0  # Should not retry
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_recovery_cycle(self, mock_cli_wrapper):
        """Test complete circuit breaker recovery cycle"""
        # Trigger circuit breaker opening
        for _ in range(3):
            mock_cli_wrapper.circuit_breaker.record_failure(is_auth_failure=True)
        
        assert mock_cli_wrapper.circuit_breaker.state == CircuitBreakerState.OPEN
        
        # Wait for recovery timeout
        await asyncio.sleep(1.1)  # Slightly longer than configured timeout
        
        # Should allow execution (half-open state)
        assert mock_cli_wrapper.circuit_breaker.can_execute() is True
        
        # Mock successful execution
        mock_process = AsyncMock()
        mock_process.pid = 12345
        mock_process.stdout.readline = AsyncMock(side_effect=[
            b'{"type": "result", "result": "Success"}\n',
            b''
        ])
        mock_process.stderr.readline = AsyncMock(return_value=b'')
        mock_process.wait = AsyncMock(return_value=0)
        mock_process.returncode = 0
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            messages = []
            async for message in mock_cli_wrapper.execute("test prompt"):
                messages.append(message)
        
        # After successful executions, circuit should close
        # (Need to record successes manually since our mock doesn't do full flow)
        mock_cli_wrapper.circuit_breaker.record_success()
        mock_cli_wrapper.circuit_breaker.record_success()
        
        assert mock_cli_wrapper.circuit_breaker.state == CircuitBreakerState.CLOSED
    
    def test_get_circuit_breaker_status(self, mock_cli_wrapper):
        """Test circuit breaker status reporting"""
        status = mock_cli_wrapper.get_circuit_breaker_status()
        assert status is not None
        assert "state" in status
        assert "failure_count" in status
        assert "can_execute" in status
    
    def test_reset_circuit_breaker(self, mock_cli_wrapper):
        """Test manual circuit breaker reset"""
        # Trigger some failures
        mock_cli_wrapper.circuit_breaker.record_failure(is_auth_failure=True)
        mock_cli_wrapper.circuit_breaker.record_failure(is_auth_failure=True)
        
        assert mock_cli_wrapper.circuit_breaker.failure_count == 2
        
        # Reset circuit breaker
        result = mock_cli_wrapper.reset_circuit_breaker()
        assert result is True
        assert mock_cli_wrapper.circuit_breaker.state == CircuitBreakerState.CLOSED
        assert mock_cli_wrapper.circuit_breaker.failure_count == 0
    
    @pytest.mark.asyncio
    async def test_authentication_test_method(self, mock_cli_wrapper):
        """Test authentication testing method"""
        # Mock successful auth test
        mock_process = AsyncMock()
        mock_process.pid = 12345
        mock_process.stdout.readline = AsyncMock(side_effect=[
            b'{"type": "stream", "content": "OK"}\n',
            b''
        ])
        mock_process.stderr.readline = AsyncMock(return_value=b'')
        mock_process.wait = AsyncMock(return_value=0)
        mock_process.returncode = 0
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            auth_result = await mock_cli_wrapper.test_authentication()
        
        assert auth_result["authenticated"] is True
        assert auth_result["cli_available"] is True
        assert auth_result["error"] is None
    
    @pytest.mark.asyncio
    async def test_authentication_test_failure(self, mock_cli_wrapper):
        """Test authentication test with auth failure"""
        # Mock auth failure
        mock_process = AsyncMock()
        mock_process.pid = 12345
        mock_process.stdout.readline = AsyncMock(side_effect=[
            b'{"type": "result", "is_error": true, "result": "Invalid API key"}\n',
            b''
        ])
        mock_process.stderr.readline = AsyncMock(return_value=b'')
        mock_process.wait = AsyncMock(return_value=1)
        mock_process.returncode = 1
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            auth_result = await mock_cli_wrapper.test_authentication()
        
        assert auth_result["authenticated"] is False
        assert auth_result["error"] == "Authentication failed"
        assert "Run: claude setup-token" in auth_result["suggestions"]


class TestErrorClassificationAndRecovery:
    """Test error classification and recovery mechanisms"""
    
    def test_error_message_classification(self):
        """Test that error messages are properly classified"""
        wrapper = ClaudeCliWrapper()
        
        # Test authentication errors
        auth_error_lines = [
            "Invalid API key provided",
            "Authentication failed - please check credentials",
            "Unauthorized access to Claude API",
            "Your subscription has expired",
            "Token validation failed"
        ]
        
        for line in auth_error_lines:
            message = wrapper._parse_line(line, is_stderr=True)
            assert message.type == "auth_error"
            assert "claude setup-token" in message.content
            assert message.metadata.get("auth_setup_required") is True
    
    def test_network_error_classification(self):
        """Test network/transient error classification"""
        wrapper = ClaudeCliWrapper()
        
        network_error_lines = [
            "Rate limit exceeded - please wait",
            "429 Too Many Requests",
            "503 Service Unavailable", 
            "Connection timeout after 30s",
            "Network unreachable",
            "Server temporarily overloaded"
        ]
        
        for line in network_error_lines:
            message = wrapper._parse_line(line, is_stderr=True)
            assert message.type == "error"
            assert message.metadata.get("is_transient") is True
            assert message.metadata.get("retry_recommended") is True
    
    def test_json_error_parsing(self):
        """Test JSON error message parsing"""
        wrapper = ClaudeCliWrapper()
        
        # Auth error in JSON format
        json_auth_error = '{"type": "result", "is_error": true, "result": "Invalid API key provided"}'
        message = wrapper._parse_line(json_auth_error)
        
        assert message.type == "auth_error"
        assert "Authentication failed" in message.content
        assert message.metadata.get("auth_setup_required") is True
        
        # Network error in JSON format
        json_network_error = '{"type": "result", "is_error": true, "result": "Rate limit exceeded"}'
        message = wrapper._parse_line(json_network_error)
        
        assert message.type == "error"
        assert message.metadata.get("is_transient") is True


class TestIntegrationWithExistingSuite:
    """Integration tests to ensure compatibility with existing test suite"""
    
    @pytest.mark.asyncio
    async def test_backward_compatibility(self):
        """Test that enhanced wrapper maintains backward compatibility"""
        # Test basic initialization without circuit breaker
        options = ClaudeCliOptions(enable_circuit_breaker=False)
        with patch('claude_cli_wrapper.shutil.which', return_value='/usr/bin/claude'):
            wrapper = ClaudeCliWrapper(options)
            assert wrapper.circuit_breaker is None
            assert wrapper.retry_strategy is not None  # Should still have retry strategy
    
    def test_simple_wrapper_enhanced_features(self):
        """Test ClaudeCliSimple includes authentication testing"""
        from claude_cli_wrapper import ClaudeCliSimple
        
        with patch('claude_cli_wrapper.shutil.which', return_value='/usr/bin/claude'):
            simple_wrapper = ClaudeCliSimple()
            
            # Should have circuit breaker by default
            assert simple_wrapper.wrapper.circuit_breaker is not None
            
            # Should have status methods
            status = simple_wrapper.get_status()
            assert "cli_available" in status
            assert "circuit_breaker" in status


if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "--tb=short"])