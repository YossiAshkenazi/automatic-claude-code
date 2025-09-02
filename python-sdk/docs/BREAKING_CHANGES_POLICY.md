# Breaking Changes Policy - Claude Code Python SDK

This document defines how breaking changes are handled in the Claude Code Python SDK, ensuring predictable upgrades and minimal disruption for users.

## Overview

The Claude Code Python SDK follows [Semantic Versioning 2.0.0](https://semver.org/) strictly, with clear policies for when and how breaking changes are introduced.

## Breaking Change Definition

A **breaking change** is any modification that requires existing user code to be updated to continue working. This includes:

### API Changes
- **Function signature changes**: Parameters added, removed, or reordered (without defaults)
- **Return type changes**: Different return structure or type
- **Exception changes**: New exceptions thrown or existing exceptions removed
- **Import path changes**: Moving classes or functions to different modules

### Behavioral Changes
- **Default behavior modification**: Changed default values that affect output
- **Performance characteristics**: Significant changes in memory usage or timing
- **Side effects**: Changes in what operations affect (files, network, etc.)

### Dependency Changes
- **Minimum Python version**: Dropping support for Python versions
- **Required dependencies**: Adding mandatory external dependencies
- **Removed integrations**: Dropping support for external tools

## Non-Breaking Changes

These changes are **NOT** considered breaking and can be introduced in minor/patch releases:

### Safe API Extensions
- **Optional parameters**: Adding parameters with sensible defaults
- **New methods/functions**: Adding new functionality without affecting existing
- **New exceptions**: Adding new exception types for better error handling
- **Deprecated warnings**: Marking features as deprecated (before removal)

### Internal Changes
- **Performance improvements**: That don't change behavior
- **Bug fixes**: Correcting incorrect behavior to match documented behavior
- **Internal refactoring**: That doesn't affect public API
- **Documentation updates**: Improvements and clarifications

### Compatible Enhancements
- **Return value extensions**: Adding new fields to returned objects (backwards compatible)
- **Error message improvements**: Better error descriptions
- **Type hint additions**: Adding or improving type annotations

## Breaking Change Process

### Timeline and Communication

#### 1. Planning Phase (3-6 months before)
- **Internal Assessment**: Evaluate necessity and impact of breaking changes
- **Alternative Solutions**: Explore backwards-compatible alternatives
- **Impact Analysis**: Identify affected users and use cases
- **Migration Complexity**: Estimate effort required for users to migrate

#### 2. Announcement Phase (90+ days before)
- **GitHub Issue**: Create tracking issue with detailed proposal
- **Documentation**: Publish breaking changes in next major version
- **Community Input**: Solicit feedback from users and maintainers
- **Migration Guide**: Begin drafting migration documentation

#### 3. Deprecation Phase (60+ days)
```python
# Example deprecation process
def old_function(param):
    import warnings
    warnings.warn(
        "old_function is deprecated and will be removed in v2.0.0. "
        "Use new_function instead. See MIGRATION.md for details.",
        DeprecationWarning,
        stacklevel=2
    )
    return new_function(param)
```

#### 4. Release Preparation (30 days)
- **Release Candidate**: Publish RC with breaking changes
- **Final Migration Guide**: Complete migration documentation
- **Migration Tools**: Provide automated migration scripts if possible
- **Community Support**: Enhanced support during transition period

#### 5. Release Execution
- **Major Version Release**: Implement breaking changes
- **Release Notes**: Detailed changelog with migration instructions
- **Community Announcement**: Notify through all channels
- **Monitoring**: Track adoption and issues closely

### Breaking Change Categories

#### Category 1: Critical Security/Correctness
**Criteria**: Security vulnerabilities, data corruption, or critical bugs
**Timeline**: Accelerated process (7-30 days)
**Communication**: Immediate notification with detailed explanation

```python
# Example: Security-critical breaking change
# Old (insecure)
def authenticate(password: str) -> bool:
    return password == "hardcoded_password"  # Security issue

# New (secure) 
def authenticate(password: str, salt: str) -> bool:
    return secure_compare(hash_password(password, salt), stored_hash)
```

#### Category 2: Major Architecture Changes
**Criteria**: Fundamental design improvements
**Timeline**: Standard process (90+ days)
**Communication**: Extensive community discussion

```python
# Example: Architecture change
# Old: Synchronous API
def query(prompt: str) -> str:
    return subprocess.run(["claude", prompt]).stdout

# New: Async API
async def query(prompt: str) -> str:
    async with ClaudeCodeClient() as client:
        return await client.query(prompt)
```

#### Category 3: Cleanup and Modernization
**Criteria**: Removing deprecated features, modernizing API
**Timeline**: Extended process (180+ days)
**Communication**: Gradual deprecation with clear migration path

#### Category 4: Dependency Updates
**Criteria**: Python version support, external dependencies
**Timeline**: Version-dependent (30-180 days)
**Communication**: Clear compatibility matrix provided

## Deprecation Policy

### Deprecation Lifecycle

```
Version N     → Mark as deprecated (warnings added)
Version N+1   → Stricter warnings, marked for removal
Version N+2   → Feature removed in major release
```

### Deprecation Implementation

#### Stage 1: Soft Deprecation
```python
import warnings
from typing import Optional

def deprecated_function(param: str) -> str:
    warnings.warn(
        "deprecated_function will be removed in v2.0.0. Use new_function instead.",
        DeprecationWarning,
        stacklevel=2
    )
    return new_function(param)

def new_function(param: str) -> str:
    """Replacement function with improved implementation."""
    return f"processed: {param}"
```

#### Stage 2: Strict Deprecation
```python
def deprecated_function(param: str) -> str:
    warnings.warn(
        "deprecated_function is deprecated and WILL BE REMOVED in the next major release. "
        "Update your code to use new_function. See migration guide at: "
        "https://github.com/project/migration#deprecated-function",
        FutureWarning,
        stacklevel=2
    )
    return new_function(param)
```

#### Stage 3: Removal
```python
# Function completely removed from codebase
# Migration guide provides exact replacement instructions
```

### Deprecation Documentation

All deprecations must include:
- **Reason**: Why the feature is being deprecated
- **Alternative**: What users should use instead
- **Timeline**: When the feature will be removed
- **Migration Guide**: Step-by-step replacement instructions
- **Code Examples**: Before and after code samples

## Version Support Matrix

### Active Support Levels

| Version Type | Duration | Support Type | Breaking Changes |
|-------------|----------|--------------|------------------|
| **Current Major** | Ongoing | Full support | Minor/Patch only |
| **Previous Major** | 12 months | Security + Critical bugs | None |
| **Older Majors** | Community | Community driven | None |

### Supported Python Versions

| SDK Version | Python 3.8 | Python 3.9 | Python 3.10 | Python 3.11 | Python 3.12+ |
|-------------|-------------|-------------|--------------|-------------|---------------|
| **0.x.x** (Beta) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **1.x.x** (Stable) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **2.x.x** (Future) | ❌ | ✅ | ✅ | ✅ | ✅ |

**Python Version Drop Policy**:
- Minimum 12 months notice before dropping Python version support
- Aligned with Python's official support lifecycle
- Only dropped in major version releases

## Migration Support

### Automated Migration Tools

#### Version 1.x to 2.x Migration Script
```bash
# Future migration tool
pip install claude-code-sdk[migration]

# Analyze current code
claude-migrate analyze ./my_project/

# Preview changes
claude-migrate preview --from=1.x --to=2.x ./my_project/

# Apply migrations
claude-migrate apply --from=1.x --to=2.x ./my_project/ --backup
```

#### Migration Script Features
- **Code analysis**: Detect deprecated API usage
- **Automated fixes**: Apply mechanical transformations
- **Manual guidance**: Flag complex changes requiring human review
- **Backup creation**: Automatic backup before applying changes
- **Verification**: Test suite run after migration

### Migration Guide Structure

Each breaking change includes:

#### 1. Change Description
```markdown
## Authentication API Changes

**What changed**: `authenticate()` function signature modified
**Why**: Enhanced security with proper salt handling  
**Impact**: All authentication code needs updates
```

#### 2. Before/After Examples
```python
# Before (0.1.x)
from claude_code_sdk import authenticate
is_valid = authenticate("password123")

# After (1.0.0)
from claude_code_sdk import authenticate
is_valid = authenticate("password123", salt=get_user_salt())
```

#### 3. Migration Steps
```markdown
1. Update import statements if needed
2. Add salt parameter to authenticate() calls
3. Implement salt generation/storage
4. Test authentication flow
5. Update error handling if needed
```

#### 4. Automated Migration
```bash
# Automated fix available
claude-migrate fix --rule=auth-salt-param ./src/
```

### Migration Timeline Support

#### During Deprecation Period
- **Legacy compatibility**: Old APIs continue working with warnings
- **Documentation**: Side-by-side docs for old and new approaches
- **Examples**: Migration examples for common use cases
- **Community support**: Enhanced support during transition

#### After Breaking Release
- **Migration period**: 30-60 day enhanced support window
- **Issue prioritization**: Migration-related issues get high priority
- **Community engagement**: Active monitoring of migration difficulties
- **Documentation updates**: Continuous improvement based on feedback

## Quality Assurance

### Pre-Release Testing

#### Compatibility Testing
```bash
# Test against previous version
pip install claude-code-sdk==0.9.0
python -m pytest tests/compatibility/

# Test migration path
pip install claude-code-sdk==1.0.0
python scripts/test_migration.py
```

#### Integration Testing
- **automatic-claude-code**: Verify integration compatibility
- **Claude CLI**: Test against supported CLI versions
- **Python versions**: Full matrix testing
- **Real-world projects**: Test with known user projects

### Post-Release Monitoring

#### Metrics to Track
- **Adoption rates**: How quickly users migrate to new versions
- **Support tickets**: Volume and types of migration issues
- **Community feedback**: Sentiment and difficulty reports
- **Error rates**: SDK usage error patterns

#### Response Procedures
- **Critical issues**: Hotfix within 24 hours
- **Migration blockers**: Priority support and potential interim releases
- **Documentation gaps**: Immediate documentation updates
- **Tool improvements**: Enhance migration tools based on feedback

## Exception Handling

### Emergency Breaking Changes

In rare cases, immediate breaking changes may be necessary:

#### Security Vulnerabilities
- **Immediate release**: Security fixes cannot wait for deprecation period
- **Clear communication**: Detailed security advisory with impact assessment
- **Migration support**: Enhanced support for emergency migrations
- **Coordinated disclosure**: Follow responsible disclosure practices

#### Critical Data Safety
- **Data corruption prevention**: Fixes that prevent data loss
- **Silent failures**: Fixes for silent failures that could cause problems
- **Compliance requirements**: Legal or regulatory compliance needs

### Rollback Procedures

#### If Breaking Changes Cause Major Issues
1. **Assessment**: Evaluate impact and reversibility
2. **Hotfix release**: Revert breaking changes in patch release
3. **Communication**: Immediate notification to all users
4. **Post-mortem**: Review process and improve for future releases

## Community Engagement

### Feedback Channels

#### Before Breaking Changes
- **GitHub Discussions**: Early feedback on proposed changes
- **RFC Process**: Request for Comments on major changes
- **Survey**: User impact assessment surveys
- **Beta testing**: Extended beta periods for major versions

#### During Migration
- **Migration support**: Dedicated support channels
- **Office hours**: Live Q&A sessions for migration help
- **Community examples**: User-contributed migration examples
- **Tool feedback**: Continuous improvement of migration tools

### Communication Channels

#### Primary Channels
- **GitHub Releases**: Detailed technical release notes
- **CHANGELOG.md**: Complete change documentation
- **Migration guides**: Step-by-step upgrade instructions
- **API documentation**: Updated with migration notes

#### Community Channels
- **GitHub Discussions**: Community Q&A and support
- **Issues**: Bug reports and migration problems
- **README updates**: High-level compatibility information
- **Blog posts**: Major version announcement and guides

---

## Quick Reference

### Breaking Change Checklist

#### Planning
- [ ] Evaluate necessity and alternatives
- [ ] Assess user impact
- [ ] Plan migration timeline
- [ ] Prepare deprecation strategy

#### Communication
- [ ] Create GitHub issue for discussion
- [ ] Update MIGRATION.md
- [ ] Add deprecation warnings
- [ ] Announce in community channels

#### Implementation
- [ ] Implement new API
- [ ] Add deprecation warnings to old API
- [ ] Create migration tools if needed
- [ ] Update documentation

#### Release
- [ ] Release candidate with breaking changes
- [ ] Final migration guide
- [ ] Major version release
- [ ] Enhanced support period

### Version Planning

- **Major releases**: Every 12-18 months maximum
- **Deprecation period**: Minimum 90 days
- **Support period**: 12 months for previous major
- **Emergency changes**: Security and data safety only

This policy ensures predictable, manageable breaking changes while maintaining the SDK's evolution and security.