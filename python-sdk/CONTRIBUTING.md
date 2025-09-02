# Contributing to claude-code-sdk

Thank you for your interest in contributing to the Claude Code Python SDK! We welcome contributions from the community.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/automatic-claude-code.git
   cd automatic-claude-code/python-sdk
   ```
3. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
4. Install development dependencies:
   ```bash
   pip install -e ".[dev]"
   ```

## Development Workflow

### 1. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes
- Write clean, documented code
- Follow the existing code style
- Add type hints to all functions
- Update documentation as needed

### 3. Test Your Changes
```bash
# Run unit tests
pytest tests/

# Run with coverage
pytest --cov=claude_code_sdk tests/

# Run linting
flake8 src/
mypy src/
```

### 4. Commit Your Changes
```bash
git add .
git commit -m "feat: add new feature"
```

Follow conventional commit format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions or changes
- `chore:` Maintenance tasks
- `refactor:` Code refactoring

### 5. Push and Create a Pull Request
```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Code Style Guidelines

### Python Style
- Follow PEP 8
- Use Black for formatting (line length: 100)
- Use type hints for all functions
- Document all public APIs

### Documentation
- Use Google-style docstrings
- Include examples in docstrings
- Update README.md for new features
- Add entries to CHANGELOG.md

### Testing
- Write tests for all new functionality
- Maintain or improve code coverage
- Test both async and sync versions
- Include edge cases and error conditions

## Project Structure

```
python-sdk/
├── src/claude_code_sdk/    # Main package
│   ├── client.py           # Main client implementation
│   ├── models.py          # Data models
│   └── utils.py           # Utility functions
├── tests/                  # Test suite
├── docs/                   # Documentation
└── examples/              # Example scripts
```

## Testing Guidelines

### Unit Tests
- Test individual functions and methods
- Mock external dependencies
- Use pytest fixtures for setup

### Integration Tests
- Test full workflows
- Verify Claude CLI integration
- Test error handling

### Example Test
```python
import pytest
from claude_code_sdk import ClaudeSDKClient

@pytest.mark.asyncio
async def test_client_initialization():
    client = ClaudeSDKClient()
    assert client.model == "sonnet"
    result = await client.run("test task")
    assert result.success
```

## Documentation

### API Documentation
- Document all public functions
- Include parameter descriptions
- Provide usage examples
- Document return types

### Example Documentation
```python
async def run(self, prompt: str, **kwargs) -> QueryResult:
    """Execute a query with Claude Code.
    
    Args:
        prompt: The task or question for Claude
        **kwargs: Additional options
        
    Returns:
        QueryResult with the execution results
        
    Example:
        >>> client = ClaudeSDKClient()
        >>> result = await client.run("implement login")
        >>> print(result.result)
    """
```

## Pull Request Process

1. **Update Documentation**: Ensure all docs are current
2. **Add Tests**: Include tests for new functionality
3. **Pass CI**: All GitHub Actions must pass
4. **Code Review**: Address reviewer feedback
5. **Squash Commits**: Keep history clean

## Reporting Issues

### Bug Reports
Include:
- Python version
- Package version
- Minimal reproduction code
- Error messages
- Expected vs actual behavior

### Feature Requests
Include:
- Use case description
- Proposed API
- Example usage
- Alternative solutions considered

## Community

- **GitHub Issues**: Bug reports and features
- **GitHub Discussions**: Questions and ideas
- **Email**: sdk-support@example.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation

Thank you for contributing to claude-code-sdk!