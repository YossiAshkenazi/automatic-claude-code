import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions, CircuitBreakerConfig, RetryStrategy

@pytest.mark.asyncio
async def test_debug_with_exact_fixture():
    """Debug version with exact same fixture configuration"""
    # Exact same configuration as the fixture
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
        wrapper = ClaudeCliWrapper(options)
    
    call_count = 0
    
    async def mock_create_subprocess(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        print(f"[DEBUG] mock_create_subprocess called, attempt {call_count}")
        if call_count <= 2:  # First two attempts fail
            print(f"[DEBUG] Raising ConnectionError for attempt {call_count}")
            raise ConnectionError("Network timeout")
        
        # Third attempt succeeds
        print(f"[DEBUG] Creating success process for attempt {call_count}")
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
        with patch('asyncio.sleep'):  # Speed up test
            print("[DEBUG] Starting execution...")
            messages = []
            async for message in wrapper.execute("test prompt"):
                print(f"[DEBUG] Message: {message.type} -> '{message.content[:100]}'")
                messages.append(message)
    
    print(f"\n[DEBUG] === FINAL RESULTS ===")
    print(f"Call count: {call_count}")
    print(f"Total messages: {len(messages)}")
    
    # Same filtering as the test
    retry_messages = [m for m in messages if "retrying" in m.content.lower()]
    success_messages = [m for m in messages if m.type == "result" and "Success" in m.content]
    
    print(f"Retry messages: {len(retry_messages)}")
    print(f"Success messages: {len(success_messages)}")
    print(f"Success: {len(success_messages) > 0}")
    
    # Show all messages for debugging
    for i, msg in enumerate(messages):
        print(f"  {i}: {msg.type} -> {msg.content}")

if __name__ == "__main__":
    asyncio.run(test_debug_with_exact_fixture())
