"""
Pytest configuration and shared fixtures for Claude Code Python SDK tests
"""

import asyncio
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, Mock
from typing import Generator, Dict, Any
import pytest


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_claude_cli():
    """Mock Claude CLI subprocess interactions."""
    mock = Mock()
    mock.returncode = 0
    mock.stdout = "Mock Claude CLI output"
    mock.stderr = ""
    return mock


@pytest.fixture
def temp_workspace() -> Generator[Path, None, None]:
    """Create a temporary workspace directory for testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        workspace = Path(temp_dir)
        # Create some test files
        (workspace / "test_file.py").write_text("# Test Python file")
        (workspace / "README.md").write_text("# Test Project")
        yield workspace


@pytest.fixture
def sample_claude_response():
    """Sample Claude response data for testing."""
    return {
        "type": "result",
        "content": "Test response from Claude",
        "model": "sonnet",
        "usage": {
            "input_tokens": 10,
            "output_tokens": 5
        }
    }


@pytest.fixture
def claude_code_options():
    """Sample ClaudeCodeOptions for testing."""
    from claude_code_sdk import ClaudeCodeOptions
    
    return ClaudeCodeOptions(
        model="sonnet",
        system_prompt="You are a test assistant",
        allowed_tools=["Read", "Write"],
        max_turns=5,
        timeout=30,
        verbose=False
    )


@pytest.fixture
def mock_session():
    """Mock session object for testing."""
    return {
        "id": "test-session-123",
        "created_at": "2024-01-01T00:00:00Z",
        "status": "active"
    }


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Setup test environment variables."""
    original_env = os.environ.copy()
    
    # Set test environment variables
    os.environ["CLAUDE_CLI_TEST_MODE"] = "true"
    os.environ["CLAUDE_CLI_TEST_SKIP_AUTH"] = "true"
    
    yield
    
    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def mock_websocket():
    """Mock WebSocket connection for monitoring tests."""
    mock_ws = AsyncMock()
    mock_ws.send = AsyncMock()
    mock_ws.recv = AsyncMock(return_value='{"status": "connected"}')
    mock_ws.close = AsyncMock()
    return mock_ws


# Markers for test categorization
pytest_plugins = []

def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "unit: mark test as a unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers", "requires_claude_cli: mark test as requiring Claude CLI"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers based on file location."""
    for item in items:
        # Add markers based on test file location
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        
        # Mark tests requiring Claude CLI
        if hasattr(item, 'function') and hasattr(item.function, '__code__'):
            source = item.function.__code__.co_filename
            with open(source, 'r') as f:
                if 'claude' in f.read().lower() and 'cli' in f.read().lower():
                    item.add_marker(pytest.mark.requires_claude_cli)


@pytest.fixture(scope="session")
def test_data_dir():
    """Get path to test data directory."""
    return Path(__file__).parent / "fixtures"