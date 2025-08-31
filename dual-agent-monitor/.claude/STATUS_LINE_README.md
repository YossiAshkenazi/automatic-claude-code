# Claude Code Status Line - Countywide Homes Multi-PC Configuration

## Overview
Enhanced status line system for the Countywide Homes migration project that provides real-time project status information in the Claude Code interface. This documentation covers the dual-PC setup with Hebrew language considerations and all implemented solutions.

## PC Configurations

### PC 1: Main Development Machine (Current - Better Performance)
- **OS**: Windows 11 (Hebrew language)
- **Username**: "Dev" (English)
- **Status**: Fully functional with enhanced features
- **Script Used**: `countywide-statusline.ps1` (PowerShell enhanced version)
- **Features**: Full Claude context integration, model info, context window usage

### PC 2: Secondary Machine (Hebrew Username Issues)
- **OS**: Windows 11 (Hebrew language)  
- **Username**: Hebrew characters (causes path encoding issues)
- **Status**: Limited functionality due to encoding issues
- **Script Used**: `status-simple.ps1` via `status.bat` (CMD wrapper for compatibility)
- **Limitations**: PowerShell path issues with Hebrew usernames require CMD wrapper

## Current Implementation (2025-08-22)

### Active Files
```
.claude/
├── countywide-statusline.ps1    # Main enhanced version (PC 1)
├── status-simple.ps1             # Compatibility version (PC 2)
├── status.bat                    # CMD wrapper for Hebrew username compatibility
├── settings.json                 # Claude Code configuration
└── STATUS_LINE_README.md         # This documentation
```

### Features Implemented Today

#### 1. CPU Usage Fix (Previously showing 0%)
**Problem**: CPU utilization always displayed as 0%
**Solution**: Implemented multiple detection methods with fallbacks:
- CIM instance sampling with delay for accuracy
- Process-based CPU estimation
- WMI LoadPercentage fallback
- Shows "N/A" if monitoring unavailable

#### 2. Node Version Removal
**Problem**: Node version was unnecessary clutter
**Solution**: Completely removed Node.js version display from status line

#### 3. Model & Context Window Display
**Problem**: Claude model and context usage not showing
**Solution**: Added comprehensive Claude context parsing:
- Model name display: `<AI:3.5 Sonnet>` or `<AI:Opus 4.1>`
- Context usage with color coding: `ctx:45.2k/200k(22.6%)`
  - Cyan: <75% usage
  - Yellow: 75-90% usage  
  - Red: >90% usage
- Last prompt preview (truncated to 30 chars)
**Fix (v3.1)**: Corrected stdin reading to properly enumerate `$input` variable for pipeline data

#### 4. Enhanced CPU Monitoring
**Solution**: Three-method approach for reliable CPU detection:
```powershell
# Method 1: CIM with sampling
# Method 2: Process-based estimation
# Method 3: WMI LoadPercentage
# Fallback: "N/A" display
```

## Status Line Components

### Full Status Line Format (Enhanced Version)
```
[HH:mm] [CH-Migration] dir git:branch[status] [D]docker:X/Y[containers] [*services] [Node][Docker][Env] >DB:status [Migration:100%] cpu:X% mem:Y% ctx:Xk/Yk(Z%) <AI:model> [Last: prompt]
```

### Component Breakdown
- `[HH:mm]`: Current time
- `[CH-Migration]`: Project identifier
- `dir`: Current directory (shortened if >50 chars)
- `git:branch[status]`: Git branch with change indicators
  - `+N`: Staged files
  - `!N`: Modified files
  - `?N`: Untracked files
  - `^N`: Commits ahead
  - `vN`: Commits behind
- `[D]docker:X/Y`: Docker containers running/total
- `[*services]`: Active service indicators
  - `*web`: Frontend (port 5173)
  - `*api`: PostgREST (port 3000)
  - `*be`: Backend (port 3001)
  - `*db`: PostgreSQL (port 5432)
  - `*auth`: Auth service (port 9999)
  - `*stor`: Storage (port 5000)
- `cpu:X%`: CPU utilization (fixed from always showing 0%)
- `mem:Y%`: Memory usage percentage
- `ctx:Xk/Yk(Z%)`: Claude context window usage (NEW)
- `<AI:model>`: Active Claude model (NEW)
- `[Last: prompt]`: Last command/prompt preview (NEW)

## Hebrew Language Considerations

### Issue: Hebrew Username Path Encoding
**Problem**: PowerShell fails to parse scripts when username contains Hebrew characters
**Error**: "The Unicode character U+05E9 is not a valid character for a PowerShell identifier"

### Solution: CMD Wrapper Approach
1. **status.bat** acts as entry point
2. Sets UTF-8 code page: `chcp 65001`
3. Launches PowerShell with bypass policy
4. Avoids direct Hebrew path interpretation

### Why Two Versions Exist
- **countywide-statusline.ps1**: Full-featured for English username systems
- **status-simple.ps1**: Simplified ASCII-only version for compatibility
- Both maintained for different PC configurations

## Testing & Verification

### Test Enhanced Features
```bash
# Test without Claude context
powershell -ExecutionPolicy Bypass -File ".claude/countywide-statusline.ps1"

# Test with simulated Claude context
echo '{"model":{"display_name":"Claude 3.5 Sonnet"},"context_window":{"used":45200,"total":200000}}' | powershell -ExecutionPolicy Bypass -File ".claude/countywide-statusline.ps1"
```

### Test Compatibility Mode
```bash
# Via CMD wrapper (for Hebrew username systems)
.claude\status.bat

# Direct PowerShell (may fail with Hebrew usernames)
powershell -ExecutionPolicy Bypass -File ".claude\status-simple.ps1"
```

## Files to Delete (Unused/Legacy)

The following files are no longer needed and can be removed:
- `countywide-status.ps1` - Old version
- `countywide-status-simple.ps1` - Duplicate of status-simple.ps1
- `countywide-statusline-debug.ps1` - Debug version no longer needed
- `debug-statusline.ps1` - Test file
- `test-debug.ps1` - Test file
- `test-statusline.ps1` - Test file
- `test-statusline-echo.ps1` - Test file
- `test-stdin.ps1` - Test file

## Known Limitations & Workarounds

### Hebrew System Issues
- **Path Encoding**: Hebrew usernames cause PowerShell parsing errors
- **Workaround**: Use CMD wrapper (status.bat)
- **Alternative**: Create English username account for development

### CPU Monitoring
- **Windows Variability**: Different Windows builds report CPU differently
- **Solution**: Multiple detection methods with "N/A" fallback
- **Note**: Some systems may always show "N/A" due to permissions

### Claude Context
- **Availability**: Only shows when Claude passes context via stdin
- **Testing**: Use echo piping to simulate context for testing
- **Production**: Automatically displays when running in Claude Code

## Performance Considerations
- **Execution Time**: 1-3 seconds typical
- **CPU Sampling**: 100ms delay for accuracy
- **Cache Strategy**: Removed Node version caching (no longer needed)
- **Docker Checks**: May be slow if many containers running

## Troubleshooting Guide

### Status Line Not Appearing
1. Check Claude Code settings.json points to correct script
2. Verify PowerShell execution policy
3. Test manually with provided commands

### CPU Shows 0% or N/A
1. Normal on some systems due to WMI restrictions
2. Try running PowerShell as Administrator for testing
3. "N/A" is better than misleading 0%

### Model/Context Not Showing
1. Only appears when Claude provides context
2. Test with simulated JSON input
3. Check stdin parsing in script

### Hebrew Username Issues
1. Use status.bat wrapper instead of direct PowerShell
2. Consider creating English username for development
3. Ensure UTF-8 encoding throughout

## Version History
- **v1.0**: Basic status with project, git, docker
- **v2.0**: Added multiple service monitoring
- **v2.1**: Fixed Unicode issues for Hebrew systems
- **v3.0** (2025-08-22): Added Claude context integration, fixed CPU monitoring, removed Node version
- **v3.1** (2025-08-25): Fixed stdin reading for AI model display - now properly shows `<AI:model>` when Claude passes context

## Support & Maintenance
For issues with the status line:
1. Identify which PC configuration you're using
2. Use appropriate script version for your system
3. Check Hebrew language considerations if applicable
4. Test with provided verification commands

## Contributing
When modifying the status line:
1. Maintain both versions for compatibility
2. Test on both English and Hebrew username systems
3. Avoid Unicode characters in core functionality
4. Document any PC-specific considerations
5. Keep execution time under 5 seconds

---
*Last Updated: 2025-08-22*
*Maintained for: Countywide Homes Migration Project*
*Dual-PC Configuration: Hebrew Windows 11 Systems*