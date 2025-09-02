# Migration Guide: v1.1.x → v1.2.0

## Overview

Version 1.2.0 introduces the revolutionary **PTY-based Claude Code control system**, completely transforming how ACC interacts with Claude Code. This major update eliminates API key dependencies for most users and provides seamless subscription authentication support.

## 🎉 Key Improvements

### ✅ Subscription Authentication Support
- **No more API key requirements** for Claude Pro/Team subscribers
- **Automatic OAuth token extraction** from system credentials
- **Cross-platform credential support** (Windows/macOS/Linux)

### ✅ Enhanced Dual-Agent Experience
- **Interactive PTY sessions** for both Manager and Worker agents
- **Real-time stream processing** with advanced JSON detection
- **Improved error recovery** and session management

### ✅ Backward Compatibility
- **Existing API key setups continue to work** as fallback
- **No breaking changes** to command syntax
- **Automatic migration** of existing configurations

## Migration Steps

### For Existing Users (Recommended Path)

#### 1. Update to v1.2.0
```bash
# Navigate to your ACC directory
cd automatic-claude-code

# Pull latest changes
git pull origin main

# Update dependencies
pnpm install

# Build new version
pnpm run build

# Re-link global command (if using npm link)
npm link
```

#### 2. Verify PTY Support
```bash
# Check version
acc --version  # Should show 1.2.0

# Test PTY mode (subscription users)
acc run "create a simple test file" --dual-agent -i 2 -v
# ACC will automatically detect and use your subscription credentials
```

#### 3. Validate OAuth Integration (Automatic)
ACC automatically extracts OAuth tokens from:
- **Windows**: Windows Credential Manager
- **macOS**: Keychain Access  
- **Linux**: Claude credential files (~/.claude/)

No manual configuration required!

### For API Key Users (Optional Migration)

If you currently use API keys, you have two options:

#### Option A: Continue with API Keys (No Change)
Your existing setup will continue working as a fallback:
```bash
# Your existing API key setup still works
export ANTHROPIC_API_KEY="sk-ant-..."
acc run "task" --no-pty -i 3  # Forces headless mode
```

#### Option B: Switch to Subscription (Recommended)
1. Ensure you have Claude Pro/Team subscription
2. Remove API key environment variable (optional)
3. Use PTY mode (now default):
```bash
unset ANTHROPIC_API_KEY  # Optional
acc run "task" --dual-agent -i 3  # Uses PTY with subscription
```

### For New Users

Simply follow the standard installation - PTY mode works out of the box:
```bash
git clone https://github.com/YossiAshkenazi/automatic-claude-code.git
cd automatic-claude-code
pnpm install
pnpm run build
npm link
acc run "hello world task" --dual-agent -v
```

## New Features and Options

### PTY-Specific CLI Options
```bash
# Force PTY mode (default for dual-agent)
acc run "task" --use-pty --dual-agent

# Force headless mode (requires API key)
acc run "task" --no-pty -i 3

# Configure PTY session limits
acc run "task" --max-pty-sessions 10 --dual-agent

# Set PTY timeout
acc run "task" --pty-timeout 600000 --dual-agent  # 10 minutes
```

### Enhanced Configuration Options

Update your `~/.automatic-claude-code/config.json` to leverage new PTY features:

```json
{
  "ptyMode": {
    "enabled": true,
    "maxSessions": 28,
    "sessionTimeout": 300000,
    "autoCleanup": true,
    "oauthTokenExtraction": true,
    "fallbackToHeadless": true,
    "streamProcessing": {
      "enableJsonDetection": true,
      "stripAnsiCodes": true,
      "parseToolUsage": true
    }
  },
  "dualAgentMode": {
    "usePTY": true,
    "enabled": true,
    "managerModel": "opus",
    "workerModel": "sonnet"
  }
}
```

### Monitoring Integration

The monitoring dashboard now supports PTY sessions:
```bash
# Start enhanced monitoring
cd dual-agent-monitor && pnpm run dev
# Open http://localhost:6011 to see PTY session activity

# Monitor PTY-specific metrics
acc agents --status      # Shows PTY session information
acc logs --pty-sessions  # PTY-specific logs
```

## What's Changed Under the Hood

### Technical Architecture Updates

#### New Core Services
- **`src/services/claudeExecutor.ts`**: Centralized execution with PTY support
- **`src/services/ptyController.ts`**: PTY session management and OAuth integration
- **Enhanced parsing**: Advanced stream processing with JSON detection

#### OAuth Integration
- **Windows**: Integrates with Windows Credential Manager
- **macOS**: Uses Security Framework for Keychain access
- **Linux**: Parses Claude credential files

#### Session Management
- **Enhanced persistence**: OAuth token storage and retrieval
- **Resource management**: Up to 28 concurrent PTY sessions
- **Automatic cleanup**: Prevents resource leaks

### Backward Compatibility

#### What Stays the Same
✅ All existing command syntax works unchanged  
✅ Configuration files are forward-compatible  
✅ Session files are automatically migrated  
✅ API key authentication continues as fallback  
✅ Docker usage patterns unchanged  
✅ Monitoring dashboard functionality preserved  

#### What's Enhanced
🚀 Default execution mode is now PTY (was headless)  
🚀 Subscription authentication takes priority over API keys  
🚀 Enhanced error handling and recovery  
🚀 Real-time stream processing with JSON detection  
🚀 Cross-platform OAuth token extraction  

## Troubleshooting Migration Issues

### Issue: "node-pty not found" Error
```bash
# Install node-pty dependency
pnpm add node-pty

# Or rebuild with Python/build tools available
pnpm run build
```

### Issue: OAuth Token Not Found
```bash
# Verify Claude CLI is working
claude --version
claude "test message"  # Should work without API key

# Check if tokens are accessible
acc run "simple task" --use-pty -v  # Check logs for token extraction
```

### Issue: PTY Session Failures
```bash
# Force headless mode as fallback
acc run "task" --no-pty -i 3

# Check system PTY support
node -e "console.log(require('os').platform())"  # Should show your platform

# Verify dependencies
pnpm list node-pty
```

### Issue: Performance Differences
```bash
# Adjust PTY session limits for better performance
acc run "task" --max-pty-sessions 5 --dual-agent

# Monitor resource usage
acc agents --performance --monitor
```

## Performance Considerations

### PTY Mode Benefits
- **Better context preservation** through interactive sessions
- **Enhanced error recovery** with real-time stream processing  
- **Improved agent coordination** through persistent sessions
- **No API rate limiting** (uses subscription quotas)

### Resource Usage
- **Memory**: ~50MB per PTY session (vs ~20MB headless)
- **CPU**: Slightly higher due to stream processing
- **Network**: Reduced API calls due to session persistence

### Optimization Tips
```bash
# For resource-constrained environments
acc run "task" --max-pty-sessions 5 --dual-agent

# For maximum performance  
acc run "task" --no-pty --dual-agent  # Uses headless with API key

# Hybrid approach
acc config set ptyMode.fallbackToHeadless true  # Auto-fallback if needed
```

## Testing Your Migration

### Validation Checklist

#### 1. Basic Functionality
```bash
# Test PTY mode
acc run "create hello.txt with 'Hello PTY World'" --use-pty -i 1 -v

# Test dual-agent PTY mode  
acc run "implement simple function with tests" --dual-agent -i 3 -v

# Verify OAuth extraction (check logs for token detection)
```

#### 2. Fallback Mechanisms
```bash
# Test API key fallback (if you have API key set)
acc run "simple task" --no-pty -i 2 -v

# Test automatic fallback (disable PTY temporarily)
# This should gracefully fall back to headless mode
```

#### 3. Session Management
```bash
# Test session persistence
acc run "start a task" --dual-agent -i 2
acc session --list  # Should show session with OAuth metadata
```

#### 4. Monitoring Integration
```bash
# Start monitoring and verify PTY session tracking
cd dual-agent-monitor && pnpm run dev &
acc run "test task" --dual-agent -v
# Check http://localhost:6011 for PTY session information
```

## Support and Resources

### Documentation Updates
- **README.md**: Comprehensive PTY mode documentation
- **docs/troubleshooting.md**: PTY-specific troubleshooting guidance
- **docs/getting-started.md**: Updated tutorials with PTY examples

### Getting Help
1. **Check troubleshooting guide**: `docs/troubleshooting.md`
2. **Review logs**: `acc logs --pty-sessions --tail`
3. **Monitor sessions**: `acc agents --status`
4. **Report issues**: GitHub repository with PTY-specific information

## Future Considerations

### Upcoming Enhancements
- **Enhanced PTY performance optimization**
- **Advanced session management features**
- **Extended OAuth provider support**
- **Improved monitoring and analytics**

### Long-term Migration Path
- PTY mode will become the exclusive default in future versions
- Headless mode will remain for specific use cases
- Enhanced subscription integration features planned

---

## Summary

🎉 **Congratulations!** You're now using the most advanced version of ACC with PTY-based Claude Code control. The migration to v1.2.0 provides:

✅ **Seamless subscription authentication** - No more API key hassles  
✅ **Enhanced dual-agent experience** - Better coordination and context  
✅ **Improved reliability** - Advanced error recovery and session management  
✅ **Cross-platform compatibility** - Works consistently across all platforms  
✅ **Backward compatibility** - Your existing setups continue working  

**Next Steps**: Try some dual-agent tasks with the new PTY system and experience the enhanced capabilities!

```bash
# Example: Complex task with new PTY system
acc run "implement complete user authentication system with password hashing, JWT tokens, input validation, and comprehensive tests" --dual-agent -i 8 -v
```

Enjoy the enhanced ACC experience with PTY-based control! 🚀

---

*This migration guide applies to Automatic Claude Code v1.2.0 released on September 1, 2025*