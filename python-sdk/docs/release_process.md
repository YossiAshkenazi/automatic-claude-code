# Release Process Documentation

This document outlines the process for releasing the Claude Code Python SDK to PyPI.

## Prerequisites

### 1. Environment Setup

```bash
# Install build tools
pip install --upgrade pip setuptools wheel twine

# Install development dependencies
pip install -e .[dev]

# Verify tools
python -m twine --version
python -m build --version
```

### 2. Authentication

```bash
# Configure PyPI credentials (one time)
python -m twine configure

# Or use API tokens (recommended)
export TWINE_USERNAME=__token__
export TWINE_PASSWORD=pypi-<your-api-token>
```

### 3. Testing Environment

```bash
# Set up test environment
python -m venv release_env
source release_env/bin/activate  # Linux/Mac
release_env\Scripts\activate     # Windows

# Install and test
pip install -e .
python -c "from claude_code_sdk import __version__; print(__version__)"
```

## Release Checklist

### 1. Pre-Release Testing

- [ ] Run all tests: `python -m pytest`
- [ ] Type checking: `mypy claude_code_sdk/`
- [ ] Linting: `flake8 claude_code_sdk/`
- [ ] Security scan: `bandit -r claude_code_sdk/`
- [ ] Documentation build: `cd docs && make html`
- [ ] Cross-platform testing (Windows, macOS, Linux)

### 2. Version Management

- [ ] Update version in `setup.py`
- [ ] Update version in `claude_code_sdk/__init__.py`
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Update `README.md` if needed

### 3. Documentation Updates

- [ ] Update API documentation
- [ ] Update examples and quickstart
- [ ] Review troubleshooting guide
- [ ] Update architecture documentation

### 4. Build Verification

- [ ] Clean build environment: `rm -rf dist/ build/ *.egg-info/`
- [ ] Build source and wheel: `python -m build`
- [ ] Verify package contents: `tar -tzf dist/*.tar.gz`
- [ ] Test installation: `pip install dist/*.whl`

## Release Process

### Step 1: Prepare Release

```bash
# 1. Update version numbers
vim setup.py  # Update version
vim claude_code_sdk/__init__.py  # Update __version__

# 2. Update documentation
vim CHANGELOG.md  # Add release notes
vim README.md     # Update examples if needed

# 3. Commit changes
git add -A
git commit -m "Prepare release v0.1.0"
git push origin main
```

### Step 2: Create Release Tag

```bash
# Create and push tag
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0

# Verify tag
git tag -l
```

### Step 3: Build Package

```bash
# Clean previous builds
rm -rf dist/ build/ *.egg-info/

# Build source distribution and wheel
python -m build

# Verify build outputs
ls -la dist/
# Should show:
# claude-code-sdk-0.1.0.tar.gz
# claude_code_sdk-0.1.0-py3-none-any.whl
```

### Step 4: Test Package

```bash
# Test in fresh environment
python -m venv test_env
source test_env/bin/activate

# Install from built package
pip install dist/claude_code_sdk-0.1.0-py3-none-any.whl

# Test basic functionality
python -c "
from claude_code_sdk import ClaudeSDKClient, query, __version__
print(f'SDK v{__version__} installed successfully')
print('Available classes:', ClaudeSDKClient.__name__)
"

deactivate
rm -rf test_env
```

### Step 5: Upload to PyPI

```bash
# Upload to Test PyPI first
python -m twine upload --repository testpypi dist/*

# Test installation from Test PyPI
pip install --index-url https://test.pypi.org/simple/ claude-code-sdk

# If successful, upload to production PyPI
python -m twine upload dist/*
```

### Step 6: Post-Release

```bash
# Verify release on PyPI
pip install claude-code-sdk
python -c "from claude_code_sdk import __version__; print(__version__)"

# Create GitHub release
# - Go to GitHub releases page
# - Create release from tag v0.1.0
# - Upload dist/ files as assets
# - Add release notes from CHANGELOG.md

# Update documentation sites if needed
```

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH` (e.g., 1.2.3)
- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Pre-release Versions

- `1.0.0-alpha.1`: Alpha release
- `1.0.0-beta.1`: Beta release  
- `1.0.0-rc.1`: Release candidate

## Automated Release (GitHub Actions)

### Workflow File: `.github/workflows/release.yml`

```yaml
name: Release to PyPI

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install build twine
    
    - name: Build package
      run: python -m build
    
    - name: Test package
      run: |
        pip install dist/*.whl
        python -c "from claude_code_sdk import __version__; print(__version__)"
    
    - name: Upload to PyPI
      env:
        TWINE_USERNAME: __token__
        TWINE_PASSWORD: ${{ secrets.PYPI_API_TOKEN }}
      run: python -m twine upload dist/*
    
    - name: Create GitHub Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        draft: false
        prerelease: false
```

## Rollback Process

If a release needs to be rolled back:

### 1. PyPI Rollback

```bash
# PyPI doesn't support deleting releases
# Instead, release a new patch version with fixes
# Example: if v1.0.0 is broken, release v1.0.1

# Increment patch version
vim setup.py  # 1.0.0 -> 1.0.1
vim claude_code_sdk/__init__.py

# Follow normal release process
```

### 2. Git Rollback

```bash
# If tag was pushed incorrectly
git tag -d v1.0.0           # Delete local tag
git push --delete origin v1.0.0  # Delete remote tag

# Reset to previous commit if needed
git reset --hard HEAD~1
git push --force origin main  # Use with caution
```

## Release Communication

### 1. Changelog Format

```markdown
# Changelog

## [1.0.0] - 2024-01-15

### Added
- New ClaudeSDKClient with official SDK patterns
- Comprehensive error handling and classification
- Real-time streaming support

### Changed
- Improved async/await patterns
- Enhanced type hints

### Fixed
- Memory leak in process management
- Authentication token handling

### Deprecated
- Old ClaudeClient alias (use ClaudeSDKClient)

### Removed
- Legacy sync methods

### Security
- Enhanced input sanitization
```

### 2. Release Notes Template

```markdown
## 🚀 Claude Code SDK v1.0.0

### What's New
- **Official SDK Patterns**: ClaudeSDKClient follows official SDK conventions
- **Enhanced Streaming**: Real-time message processing with async generators
- **Dual-Agent Support**: Full integration with automatic-claude-code system

### Breaking Changes
- Deprecated sync methods removed
- Configuration parameter names updated

### Migration Guide
```python
# Old way
from claude_code_sdk import ClaudeClient
client = ClaudeClient()

# New way  
from claude_code_sdk import ClaudeSDKClient
async with ClaudeSDKClient() as client:
    pass
```

### Installation
```bash
pip install --upgrade claude-code-sdk
```
```

## Quality Gates

Before each release, ensure:

1. **Code Quality**: All linters pass
2. **Type Safety**: MyPy validation complete
3. **Test Coverage**: >90% code coverage
4. **Documentation**: All APIs documented
5. **Examples**: Working examples provided
6. **Security**: Vulnerability scan clean
7. **Performance**: No performance regressions

## Support Policy

- **Latest Major Version**: Full support
- **Previous Major Version**: Security fixes only
- **Older Versions**: End of life

## Contact

For release process questions:
- Create GitHub issue with `release` label
- Contact maintainers directly
- Check documentation for updates