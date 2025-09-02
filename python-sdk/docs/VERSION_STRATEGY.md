# Version Strategy - Claude Code Python SDK

This document outlines the versioning strategy, git tagging conventions, and release management practices for the Claude Code Python SDK.

## Semantic Versioning

### Version Format: MAJOR.MINOR.PATCH

The Claude Code Python SDK follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRE_RELEASE][+BUILD_METADATA]
```

### Version Components

#### MAJOR (X.0.0)
**When to increment**: Breaking changes that require code updates

Examples:
- API interface changes that break existing code
- Removal of deprecated features
- Changes to core behavior that affect compatibility
- Minimum Python version requirements increase

```python
# Example: 1.0.0 -> 2.0.0
# Breaking: Query interface changed
# Old (1.x)
result = await query(prompt, model="claude-3")
# New (2.x) 
result = await query(prompt, options={"model": "claude-3"})
```

#### MINOR (0.X.0)
**When to increment**: New features, backwards compatible

Examples:
- New functions, methods, or classes
- Optional parameters added to existing functions
- New integrations or capabilities
- Performance improvements without API changes

```python
# Example: 1.1.0 -> 1.2.0
# New feature: Batch processing capability
from claude_code_sdk import batch_query  # New in 1.2.0

# Existing code continues to work unchanged
result = await query("hello world")  # Still works
```

#### PATCH (0.0.X)
**When to increment**: Bug fixes, backwards compatible

Examples:
- Bug fixes that don't change API
- Documentation improvements
- Internal refactoring without external impact
- Performance improvements without behavior changes

```python
# Example: 1.1.1 -> 1.1.2
# Fixed: Memory leak in streaming mode
# No API changes, existing code works identically
```

## Pre-Release Versions

### Development Phase Versions

#### Alpha Versions (0.0.X-alpha.Y)
- **Purpose**: Early development, experimental features
- **Stability**: Expect breaking changes between alphas
- **Audience**: Developers and contributors only

```
0.1.0-alpha.1  # First alpha of 0.1.0
0.1.0-alpha.2  # Second alpha with more features
```

#### Beta Versions (X.Y.Z-beta.N)
- **Purpose**: Feature complete, API stabilizing
- **Stability**: Minor changes possible, major features locked
- **Audience**: Early adopters, testing environments

```
0.1.0-beta.1   # First beta, feature complete
0.1.0-beta.2   # Bug fixes and minor refinements
```

#### Release Candidates (X.Y.Z-rc.N)
- **Purpose**: Final testing before stable release
- **Stability**: Only critical bug fixes
- **Audience**: Production-like testing

```
1.0.0-rc.1     # First release candidate
1.0.0-rc.2     # Critical bug fixes only
```

### Pre-Release Lifecycle

```
Development → Alpha → Beta → Release Candidate → Stable
     ↓          ↓       ↓            ↓              ↓
Breaking    Features  API       Bug Fixes    Production
Changes     Added     Stable    Only         Ready
```

## Git Tagging Strategy

### Tag Naming Convention

#### Release Tags
```bash
v1.0.0          # Stable release
v1.0.0-beta.1   # Pre-release
v1.0.0-rc.1     # Release candidate
```

#### Development Tags
```bash
v0.1.0-alpha.1  # Alpha release
dev-20240115    # Development snapshot (YYYYMMDD)
```

### Tagging Process

#### Automated Tagging (Recommended)
```bash
# Using bump_version.py script
python scripts/bump_version.py minor    # Creates and pushes tag automatically
```

#### Manual Tagging
```bash
# Create annotated tag with message
git tag -a v1.0.0 -m "Release v1.0.0 - First stable release"

# Push tag to origin
git push origin v1.0.0

# Push all tags
git push --tags
```

### Tag Protection Rules

#### Protected Tags
- `v*.*.*` - All release versions
- `v*.*.*-rc.*` - All release candidates

#### Tag Policies
- **Immutable**: Tags cannot be moved once pushed
- **Signed**: All release tags must be GPG signed
- **Automated**: Created through CI/CD pipeline only

## Release Branching Strategy

### Branch Types

#### Main Branches
```
main        # Stable releases, production-ready
develop     # Integration branch for next release
```

#### Supporting Branches
```
feature/*   # New features for next minor release
release/*   # Preparation for specific release
hotfix/*    # Emergency fixes for production
```

### Release Branch Workflow

#### For Minor/Major Releases
```bash
# Create release branch from develop
git checkout develop
git checkout -b release/1.1.0

# Final testing and bug fixes
# Version bump and changelog updates
python scripts/bump_version.py minor

# Merge to main and tag
git checkout main
git merge release/1.1.0
git tag v1.1.0

# Merge back to develop
git checkout develop
git merge release/1.1.0
```

#### For Hotfixes
```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/1.0.1

# Fix critical issue
# Version bump (patch only)
python scripts/bump_version.py patch

# Merge to main and develop
git checkout main
git merge hotfix/1.0.1
git tag v1.0.1
git checkout develop
git merge hotfix/1.0.1
```

## Version Lifecycle Management

### Support Lifecycle

```
Version    Status      Support Type           Duration
-------    ------      ------------           --------
2.0.x      Active      Full support           Current
1.x.x      Maintenance Security + Critical    12 months
0.x.x      EOL         Community only         Ended
```

#### Support Levels
- **Full Support**: New features, bug fixes, security updates
- **Maintenance**: Critical bugs and security updates only
- **End of Life**: No official support, community maintained

### Deprecation Policy

#### Deprecation Timeline
```
Version N     # Feature marked as deprecated (warnings added)
Version N+1   # Deprecation warnings become errors in dev mode
Version N+2   # Feature removed completely
```

#### Deprecation Process
1. **Announcement**: 6 months before removal
2. **Warning Phase**: Deprecation warnings in code
3. **Migration Guide**: Detailed migration instructions
4. **Removal**: Clean removal in major version

```python
# Example deprecation process
# Version 1.1.0 - Deprecation warning
import warnings

def old_function():
    warnings.warn(
        "old_function is deprecated, use new_function instead",
        DeprecationWarning,
        stacklevel=2
    )
    # ... existing implementation

# Version 1.2.0 - Stricter warnings
def old_function():
    warnings.warn(
        "old_function will be removed in version 2.0.0",
        PendingDeprecationWarning,
        stacklevel=2
    )

# Version 2.0.0 - Removed completely
# old_function no longer exists
```

## Version Compatibility Matrix

### Python Version Support

| SDK Version | Python 3.8 | Python 3.9 | Python 3.10 | Python 3.11 | Python 3.12+ |
|-------------|-------------|-------------|--------------|-------------|---------------|
| 0.1.x       | ✅          | ✅          | ✅           | ✅          | ✅            |
| 1.0.x       | ✅          | ✅          | ✅           | ✅          | ✅            |
| 1.1.x       | ✅          | ✅          | ✅           | ✅          | ✅            |
| 2.0.x       | ❌          | ✅          | ✅           | ✅          | ✅            |

### Integration Compatibility

| SDK Version | Claude CLI | automatic-claude-code | Status |
|-------------|------------|----------------------|--------|
| 0.1.0       | v1.0+      | v1.2.0+              | Beta   |
| 1.0.0       | v1.0+      | v2.0.0+              | Stable |
| 1.1.0       | v1.1+      | v2.0.0+              | Stable |
| 2.0.0       | v2.0+      | v3.0.0+              | Future |

## Automated Version Management

### CI/CD Integration

#### GitHub Actions Workflow
```yaml
name: Release Management
on:
  push:
    branches: [main, develop]
    tags: ['v*']

jobs:
  version-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check version consistency
        run: python scripts/check_version_consistency.py
      
  auto-tag:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Create release tag
        run: python scripts/create_release_tag.py
```

#### Version Consistency Checks
```python
# scripts/check_version_consistency.py
def check_version_consistency():
    """Ensure version is consistent across all files"""
    files_to_check = [
        "claude_code_sdk/__init__.py",
        "setup.py",
        "docs/conf.py"
    ]
    
    versions = []
    for file_path in files_to_check:
        version = extract_version(file_path)
        versions.append((file_path, version))
    
    if len(set(v[1] for v in versions)) > 1:
        raise ValueError("Version inconsistency found")
```

### Automated Release Notes

#### Template Generation
```bash
# Generate release notes from commits
git log v1.0.0..v1.1.0 --oneline --grep="feat:" --grep="fix:" --grep="BREAKING:"
```

#### Changelog Automation
```python
# Auto-update CHANGELOG.md from git history
def update_changelog(version, git_log):
    """Update changelog with structured commit messages"""
    features = parse_commits(git_log, "feat:")
    fixes = parse_commits(git_log, "fix:")
    breaking = parse_commits(git_log, "BREAKING:")
    
    return format_changelog_section(version, features, fixes, breaking)
```

## Quality Gates by Version Type

### Pre-Release Quality Gates

#### Alpha Releases
- [ ] Basic functionality works
- [ ] Core APIs defined
- [ ] Development environment setup

#### Beta Releases
- [ ] Feature complete
- [ ] API stability achieved
- [ ] Integration tests passing
- [ ] Documentation complete

#### Release Candidates
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Migration guides prepared

### Stable Release Quality Gates

#### Patch Releases
- [ ] Bug fix validated
- [ ] No new features
- [ ] Backwards compatibility maintained
- [ ] Regression tests passing

#### Minor Releases
- [ ] New features tested
- [ ] Backwards compatibility maintained
- [ ] Documentation updated
- [ ] Migration path documented

#### Major Releases
- [ ] Breaking changes documented
- [ ] Migration tools provided
- [ ] Extensive testing completed
- [ ] User notification sent

## Version Monitoring and Metrics

### Key Metrics

#### Adoption Metrics
- Download statistics by version
- Version distribution in production
- Migration completion rates

#### Quality Metrics
- Bug report rates by version
- Performance regression detection
- Compatibility issue frequency

#### Support Metrics
- Support ticket volume by version
- Time to fix critical issues
- Community contribution rates

### Monitoring Tools

```python
# Version telemetry (opt-in)
def collect_version_metrics():
    return {
        "sdk_version": __version__,
        "python_version": sys.version_info,
        "claude_cli_version": get_claude_cli_version(),
        "usage_patterns": get_usage_statistics()
    }
```

## Emergency Procedures

### Critical Bug Response

#### Severity Levels
- **P0 - Critical**: Security vulnerabilities, data loss
- **P1 - High**: Core functionality broken
- **P2 - Medium**: Feature issues, performance problems
- **P3 - Low**: Minor issues, documentation

#### Response Times
- **P0**: Hotfix within 24 hours
- **P1**: Hotfix within 1 week
- **P2**: Fix in next minor release
- **P3**: Fix in next convenient release

### Security Vulnerability Response

```bash
# Emergency security release process
git checkout main
git checkout -b security/CVE-YYYY-NNNNN

# Apply security fix
# Bump patch version
python scripts/bump_version.py patch --security

# Immediate release
git tag v1.0.1-security
git push origin main v1.0.1-security

# Notify users immediately
```

---

## Quick Reference

### Common Version Commands
```bash
# Check current version
python -c "import claude_code_sdk; print(claude_code_sdk.__version__)"

# Bump version (automated)
python scripts/bump_version.py [major|minor|patch]

# Check version consistency
python scripts/check_version_consistency.py

# Generate changelog
python scripts/generate_changelog.py v1.0.0..HEAD
```

### Version Planning
- **Patch**: Bug fixes every 2-4 weeks
- **Minor**: New features every 2-3 months  
- **Major**: Breaking changes every 12-18 months

This strategy ensures stable, predictable releases while maintaining backwards compatibility and clear upgrade paths for users.