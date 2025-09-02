# Release Process - Claude Code Python SDK

This document outlines the complete release process for the Claude Code Python SDK, from development to production deployment.

## Overview

The Claude Code Python SDK follows semantic versioning and maintains strict quality gates for releases. Our process ensures stability, backwards compatibility, and clear communication with users.

## Release Types

### Stable Releases (1.0.0+)
- **Target Audience**: Production users
- **Stability**: API stable, backwards compatible
- **Testing**: Full test suite + integration tests
- **Documentation**: Complete and validated
- **Support**: Long-term support and bug fixes

### Beta Releases (0.x.x)
- **Target Audience**: Early adopters, testing environments
- **Stability**: Feature complete, API may change
- **Testing**: Core functionality tested
- **Documentation**: Complete for implemented features
- **Support**: Community support, rapid iteration

### Alpha Releases (0.0.x)
- **Target Audience**: Developers, contributors
- **Stability**: Development releases, expect breaking changes
- **Testing**: Basic functionality tested
- **Documentation**: In-progress
- **Support**: No guarantees, rapid development

## Pre-Release Checklist

### Code Quality
- [ ] All tests passing (`pytest`)
- [ ] Code coverage >= 80%
- [ ] Type checking passes (`mypy`)
- [ ] Linting passes (`flake8`, `black`, `isort`)
- [ ] No security vulnerabilities identified
- [ ] Performance benchmarks meet thresholds

### Documentation
- [ ] CHANGELOG.md updated with all changes
- [ ] API documentation generated and reviewed
- [ ] README.md updated if needed
- [ ] Migration guides prepared (for breaking changes)
- [ ] Usage examples validated
- [ ] Integration guides tested

### Integration Testing
- [ ] Claude CLI integration verified
- [ ] automatic-claude-code compatibility confirmed
- [ ] Cross-platform testing completed (Windows, macOS, Linux)
- [ ] Python version compatibility verified (3.8-3.12)
- [ ] Performance benchmarks executed
- [ ] Memory usage profiling completed

### Version Management
- [ ] Version numbers updated in all files
- [ ] Git tags prepared
- [ ] Release notes drafted
- [ ] Breaking changes documented
- [ ] Migration tools prepared (if needed)

## Release Steps

### 1. Preparation Phase

```bash
# Create release branch
git checkout -b release/v1.0.0
git push -u origin release/v1.0.0

# Run full test suite
pytest tests/ --cov=claude_code_sdk --cov-report=html

# Type checking
mypy claude_code_sdk/

# Code formatting
black claude_code_sdk/ tests/
isort claude_code_sdk/ tests/

# Linting
flake8 claude_code_sdk/ tests/
```

### 2. Version Bump

```bash
# For patch release (1.0.0 -> 1.0.1)
python scripts/bump_version.py patch

# For minor release (1.0.0 -> 1.1.0)
python scripts/bump_version.py minor

# For major release (1.0.0 -> 2.0.0)
python scripts/bump_version.py major

# For specific version
python scripts/bump_version.py --version 1.0.0

# Dry run to preview changes
python scripts/bump_version.py minor --dry-run
```

### 3. Quality Assurance

```bash
# Integration tests with different Python versions
tox

# Security scanning
pip install safety
safety check

# Dependency analysis
pip install pip-audit
pip-audit

# Performance benchmarking
python python-sdk/performance_test.py
```

### 4. Documentation Update

```bash
# Generate API documentation
pdoc claude_code_sdk/ --html --output-dir docs/api/

# Validate examples in documentation
python -m doctest README.md

# Test installation instructions
pip uninstall claude-code-sdk
pip install -e .
python -c "import claude_code_sdk; print(claude_code_sdk.__version__)"
```

### 5. Final Review

```bash
# Create pull request for release branch
gh pr create --title "Release v1.0.0" --body "Release v1.0.0 with..."

# Code review by maintainers
# Automated CI checks must pass
# Manual testing in staging environment
```

### 6. Release Deployment

```bash
# Merge release branch to main
git checkout main
git merge release/v1.0.0

# Tag the release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main
git push origin v1.0.0

# Build and publish to PyPI (if configured)
python setup.py sdist bdist_wheel
twine upload dist/*

# Create GitHub release
gh release create v1.0.0 --title "Release v1.0.0" --notes-file RELEASE_NOTES.md
```

### 7. Post-Release

```bash
# Update development branch
git checkout develop
git merge main
git push origin develop

# Clean up release branch
git branch -d release/v1.0.0
git push origin --delete release/v1.0.0

# Announce release
# - Update project documentation
# - Notify users through appropriate channels
# - Update integration guides in dependent projects
```

## Automated Release Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.8, 3.9, '3.10', 3.11, 3.12]
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v3
        with:
          python-version: ${{ matrix.python-version }}
      - name: Install dependencies
        run: |
          pip install -e .[test]
      - name: Run tests
        run: pytest

  build-and-publish:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build package
        run: |
          python setup.py sdist bdist_wheel
      - name: Publish to PyPI
        if: startsWith(github.ref, 'refs/tags/')
        uses: pypa/gh-action-pypi-publish@release/v1
        with:
          password: ${{ secrets.PYPI_API_TOKEN }}
```

## Quality Gates

### Mandatory Requirements
1. **All tests pass** - No exceptions for releases
2. **Code coverage >= 80%** - Maintain high test coverage
3. **Security scan passes** - No known vulnerabilities
4. **Documentation complete** - All public APIs documented
5. **Backwards compatibility** - No breaking changes in minor/patch releases

### Performance Thresholds
- **Response time**: < 100ms for basic queries
- **Memory usage**: < 50MB for typical workloads
- **Startup time**: < 2 seconds for SDK initialization
- **Throughput**: > 10 queries/second sustained

### Compatibility Requirements
- **Python versions**: 3.8, 3.9, 3.10, 3.11, 3.12
- **Operating systems**: Windows 10+, macOS 11+, Ubuntu 20.04+
- **Claude CLI versions**: v1.0+
- **automatic-claude-code versions**: v1.2.0+

## Hotfix Process

### Critical Bug Fix
```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/v1.0.1

# Fix the issue
# ... make changes ...

# Test the fix
pytest tests/

# Bump version (patch only for hotfixes)
python scripts/bump_version.py patch

# Merge to main and develop
git checkout main
git merge hotfix/v1.0.1
git checkout develop
git merge hotfix/v1.0.1

# Tag and release
git tag v1.0.1
git push origin main develop v1.0.1
```

## Rollback Procedure

### If Release Issues Found
1. **Immediate**: Revert PyPI package if possible
2. **Communication**: Notify users immediately
3. **Fix**: Create hotfix or revert to previous version
4. **Documentation**: Update with known issues and workarounds

### Git Rollback
```bash
# Revert to previous version
git revert v1.0.0
git tag v1.0.1
git push origin main v1.0.1
```

## Communication

### Release Announcements
- **GitHub Releases**: Detailed changelog and download links
- **Documentation**: Updated installation and upgrade guides
- **Integration Projects**: Notify automatic-claude-code maintainers
- **Community**: Appropriate development channels

### Breaking Changes
- **Advance Notice**: 30+ days for major breaking changes
- **Migration Period**: Parallel support for old and new APIs
- **Migration Tools**: Automated migration scripts where possible
- **Documentation**: Comprehensive migration guides

## Monitoring Post-Release

### Key Metrics
- **Download statistics** from PyPI
- **Integration success rates** with automatic-claude-code
- **Error rates** from SDK usage telemetry
- **Performance metrics** from benchmark runs
- **User feedback** from GitHub issues

### Success Criteria
- **No critical issues** reported within 48 hours
- **Integration tests passing** for dependent projects
- **Performance within thresholds**
- **Positive or neutral user feedback**

---

## Quick Reference

### Version Bump Commands
```bash
python scripts/bump_version.py patch     # Bug fixes
python scripts/bump_version.py minor     # New features
python scripts/bump_version.py major     # Breaking changes
```

### Quality Check Commands
```bash
pytest tests/ --cov=claude_code_sdk      # Run tests with coverage
mypy claude_code_sdk/                     # Type checking
black claude_code_sdk/ tests/             # Format code
flake8 claude_code_sdk/ tests/            # Lint code
safety check                              # Security scan
```

### Release Commands
```bash
git tag -a v1.0.0 -m "Release v1.0.0"    # Create tag
git push origin v1.0.0                   # Push tag
gh release create v1.0.0                 # Create GitHub release
```