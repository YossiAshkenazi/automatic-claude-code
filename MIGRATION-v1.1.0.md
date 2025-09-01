# Migration Guide: v1.0.0 → v1.1.0

## Overview

Version 1.1.0 introduces important clarifications about authentication requirements and improves the global command installation process. While no breaking changes were introduced, users need to be aware of authentication limitations.

## Key Changes

### 1. Version Management Fixed
- The CLI now correctly reports version 1.1.0
- Fixed mismatch between package.json and CLI output

### 2. Global Command Installation
The recommended installation method is now:
```bash
# After cloning and building
npm link  # Makes 'acc' command available globally
```

### 3. Authentication Requirements Clarified

**⚠️ Important Discovery**: ACC requires API credits to function. Subscription authentication is not supported for automated operation.

#### What This Means
- You need an API key from [console.anthropic.com](https://console.anthropic.com)
- Subscription tokens (from `claude setup-token`) won't work with ACC
- This is a fundamental limitation of Claude Code's headless mode

## Migration Steps

### For Existing Users

1. **Update to v1.1.0**:
   ```bash
   git pull
   pnpm install
   pnpm run build
   npm link  # Re-link for global command
   ```

2. **Set Up API Authentication**:
   ```bash
   # Get API key from console.anthropic.com
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   
   # Or on Windows:
   $env:ANTHROPIC_API_KEY = "sk-ant-your-key-here"
   ```

3. **Verify Installation**:
   ```bash
   acc --version  # Should show 1.1.0
   acc examples   # Should display example commands
   ```

### For New Users

Follow the standard installation in README.md, ensuring you have API credits configured.

## Known Issues

### Authentication Limitation
- **Issue**: ACC cannot use Claude subscription authentication
- **Impact**: Requires API credits purchase
- **Workaround**: None currently available
- **Future**: See `CLAUDE_DESKTOP_RESEARCH_PROMPT.md` for investigation into alternatives

### Terminal Compatibility
- PowerShell may have issues with `claude setup-token`
- Use Command Prompt or Git Bash as alternatives

## Compatibility

### No Breaking Changes
- All existing configurations remain compatible
- Session files are forward-compatible
- No changes to command syntax

### System Requirements
- No changes to system requirements
- Node.js 18+ still required
- Cross-platform support maintained

## Documentation Updates

New and updated documentation:
- `CHANGELOG.md` - Now tracking all changes
- `docs/troubleshooting.md` - Added authentication troubleshooting
- `README.md` - Added authentication requirements section
- `CLAUDE_DESKTOP_RESEARCH_PROMPT.md` - Research into subscription support

## Support

If you encounter issues:
1. Check the updated troubleshooting guide
2. Ensure you have API credits configured
3. Report issues at GitHub repository

## Future Considerations

We are actively researching ways to support subscription authentication. See `CLAUDE_DESKTOP_RESEARCH_PROMPT.md` for technical investigation into potential solutions.

---

*This migration guide applies to Automatic Claude Code v1.1.0 released on 2025-01-09*