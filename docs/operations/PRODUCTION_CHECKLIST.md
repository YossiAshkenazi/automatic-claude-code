# Production Deployment Checklist

## Pre-Deployment Verification ✅

### System Requirements
- [ ] Node.js 18+ installed
- [ ] pnpm or npm package manager available
- [ ] Claude Code CLI installed globally (`npm install -g @anthropic-ai/claude-code`)
- [ ] Git installed for version control
- [ ] Sufficient disk space (minimum 500MB)

### Build Verification
- [x] `pnpm run build` completes without errors
- [x] TypeScript compilation successful
- [x] No high or critical security vulnerabilities
- [x] All dependencies resolved
- [x] Distribution size optimized (1.7MB)

### Core Functionality Tests
- [x] SDK integration verified (`acc run --verify-claude-cli "test"`)
- [x] Session history displays correctly (`acc history`)
- [x] Monitoring dashboard accessible (http://localhost:6011)
- [x] API health check passing (http://localhost:4005/api/health)
- [x] Error handling tested with various failure scenarios

## Deployment Steps

### 1. Environment Setup
```bash
# Clone repository
git clone https://github.com/yossiashkenazi/automatic-claude-code
cd automatic-claude-code

# Install dependencies
pnpm install

# Build project
pnpm run build

# Link globally
npm link
```

### 2. Configuration
```bash
# Verify configuration directory
mkdir -p ~/.automatic-claude-code

# Check default configuration
cat ~/.automatic-claude-code/config.json

# Customize if needed
```

### 3. Monitoring Setup (Optional)
```bash
# Start monitoring server
cd dual-agent-monitor
pnpm install
pnpm run dev

# Or use PM2 for production
pnpm run monitor:pm2
```

### 4. Docker Deployment (Alternative)
```bash
# Using pre-built image
docker pull ghcr.io/yossiashkenazi/automatic-claude-code:latest

# Run with volumes
docker run -it --rm \
  -v "$(pwd):/workspace:ro" \
  -v "$HOME/.claude:/home/nodejs/.claude:ro" \
  ghcr.io/yossiashkenazi/automatic-claude-code:latest \
  run "your task" --dual-agent -i 5
```

## Post-Deployment Verification

### Health Checks
- [ ] Run `acc --version` to verify installation
- [ ] Execute `acc examples` to see usage patterns
- [ ] Test basic task: `acc run "test task" -i 1`
- [ ] Verify SDK: `acc run --verify-claude-cli "test"`
- [ ] Check monitoring: `curl http://localhost:4005/api/health`

### Performance Metrics
- [ ] Startup time < 1 second
- [ ] Memory usage < 200MB for basic tasks
- [ ] SDK initialization < 5 seconds
- [ ] Response time for CLI commands < 500ms

### Integration Tests
- [ ] Dual-agent mode: `acc run "complex task" --dual-agent -i 5`
- [ ] Session persistence verified
- [ ] Hook scripts executing (if configured)
- [ ] Error recovery working

## Rollback Plan

### If Issues Occur
1. Stop monitoring services: `pnpm run monitor:stop`
2. Unlink global command: `npm unlink`
3. Restore previous version: `git checkout [previous-version]`
4. Rebuild: `pnpm run build`
5. Re-link: `npm link`

### Data Preservation
- Session data preserved in `~/.automatic-claude-code/sessions/`
- Configuration backed up before changes
- Logs retained for debugging

## Security Considerations

### API Keys
- [ ] Claude API key properly configured (if using API mode)
- [ ] No hardcoded credentials in code
- [ ] Environment variables used for sensitive data
- [ ] `.env` file excluded from version control

### Network Security
- [ ] Monitoring ports (4005, 6011) properly firewalled
- [ ] HTTPS configured for production monitoring (if exposed)
- [ ] Rate limiting configured for API endpoints
- [ ] CORS properly configured for dashboard

## Monitoring & Maintenance

### Log Management
- [ ] Log rotation configured
- [ ] Log level appropriate for production
- [ ] Error tracking system integrated (optional)
- [ ] Performance metrics collection enabled

### Backup Strategy
- [ ] Session data backed up regularly
- [ ] Configuration files version controlled
- [ ] Database backups scheduled (if using PostgreSQL)
- [ ] Recovery procedures documented

## Documentation

### User Documentation
- [x] README.md updated with v2.0.0 information
- [x] Migration guide created for existing users
- [x] API documentation current
- [x] Troubleshooting guide updated

### Team Documentation
- [x] Architecture diagrams updated
- [x] Deployment procedures documented
- [x] Emergency contacts listed
- [x] Known issues documented

## Sign-off

### Stakeholder Approval
- [ ] Development team review complete
- [ ] QA testing passed
- [ ] Security review completed
- [ ] Operations team prepared
- [ ] Business stakeholder approval

### Final Checks
- [ ] All checklist items completed
- [ ] No blocking issues identified
- [ ] Rollback plan tested
- [ ] Team trained on new features

---

**Deployment Status**: READY FOR PRODUCTION ✅
**Version**: 2.0.0 (SDK-Only Architecture)
**Date**: 2025-09-02