import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions, CircuitBreakerConfig, RetryStrategy

@pytest.mark.asyncio
async def test_debug_network_error_retry():
    """Debug version to see what's happening"""
    try:
        from claude_cli_wrapper import CircuitBreakerConfig, RetryStrategy
        options = ClaudeCliOptions(
            enable_circuit_breaker=True,
            circuit_breaker_config=CircuitBreakerConfig(
                failure_threshold=2,
                recovery_timeout=0.1,
                success_threshold=1
            ),
            retry_strategy=RetryStrategy(
                max_attempts=3,
                base_delay=0.05,
                jitter=False
            )
        )
    except ImportError:
        options = ClaudeCliOptions()
    
    with patch('claude_cli_wrapper.shutil.which', return_value='/usr/bin/claude'):
        wrapper = ClaudeCliWrapper(options)
    
    call_count = 0
    
    async def mock_create_subprocess(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        print(f"[DEBUG] mock_create_subprocess called, attempt {call_count}")
        if call_count <= 2:
            print(f"[DEBUG] Raising ConnectionError for attempt {call_count}")
            raise ConnectionError("Network timeout")
        
        print(f"[DEBUG] Returning success process for attempt {call_count}")
        mock_process = AsyncMock()
        mock_process.pid = 12345
        mock_process.stdout.readline = AsyncMock(side_effect=[
            b'{"type": "result", "result": "Success after retry"}\n',
            b''
        ])
        mock_process.stderr.readline = AsyncMock(return_value=b'')
        mock_process.wait = AsyncMock(return_value=0)
        mock_process.returncode = 0
        return mock_process
    
    with patch('asyncio.create_subprocess_exec', side_effect=mock_create_subprocess):
        with patch('asyncio.sleep'):
            messages = []
            async for message in wrapper.execute("test prompt"):
                print(f"[DEBUG] Message: {message.type} -> {message.content[:100]}")
                messages.append(message)
    
    print(f"[DEBUG] Total messages: {len(messages)}")
    print(f"[DEBUG] Call count: {call_count}")
    
    for i, msg in enumerate(messages):
        print(f"[DEBUG] Message {i}: {msg.type} -> {msg.content}")
    
    retry_messages = [m for m in messages if "retrying" in m.content.lower()]
    success_messages = [m for m in messages if m.type == "result" and "Success" in m.content]
    error_messages = [m for m in messages if m.type == "error"]
    
    print(f"[DEBUG] Retry messages: {len(retry_messages)}")
    print(f"[DEBUG] Success messages: {len(success_messages)}")
    print(f"[DEBUG] Error messages: {len(error_messages)}")

if __name__ == "__main__":
    asyncio.run(test_debug_network_error_retry())
