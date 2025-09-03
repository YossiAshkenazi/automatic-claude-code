# 🧪 Wrapper Testing Guide

This guide shows you how to test the different wrappers we created yesterday.

## 📁 Files Created Yesterday

### Core Wrappers
- **`claude_cli_wrapper.py`** - Main Claude CLI wrapper (with bug fix)
- **`gemini_cli_wrapper.py`** - Gemini CLI wrapper 
- **`unified_cli_wrapper.py`** - Multi-model wrapper with factory pattern

### Test Files  
- **`test_wrapper_basic.py`** - Basic infrastructure tests (no auth required)
- **`test_unified_wrapper.py`** - Unified wrapper tests
- **`simple_wrapper_test.py`** - Quick testing examples
- **`test_real_claude.py`** - Real integration tests

## 🚀 Quick Testing Commands

### 1. Basic Infrastructure Test (No Auth Required)
```powershell
cd python-sdk
python test_wrapper_basic.py
```
**Expected Output:**
```
[OK] All wrapper infrastructure tests passed!
Success Rate: 100.0%
```

### 2. Real Integration Test (Requires Claude CLI Auth)
```powershell
python test_real_claude.py
```
**Expected Output:**
```
SUCCESS: ALL TESTS PASSED!
SUCCESS: Tool usage is functional
```

### 3. Simple Wrapper Features Test
```powershell
python simple_wrapper_test.py
```
**Expected Output:**
```
TESTING COMPLETE!
Key features verified:
- JSON parsing bug fix working
- Unified wrapper factory pattern
- Provider auto-detection
- Tool usage functionality
```

### 4. Unified Wrapper Test
```powershell
python test_unified_wrapper.py
```
**Expected Output:**
```
[SUCCESS] All unified wrapper tests passed!
Success Rate: 100.0%
```

## 🔧 Manual Testing Examples

### Test the Claude Wrapper Directly
```python
import asyncio
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def test():
    options = ClaudeCliOptions(model="sonnet", max_turns=1)
    wrapper = ClaudeCliWrapper(options)
    
    # Test the bug fix - this was failing before
    result = await wrapper.execute_sync("Create a file called hello.txt")
    print(f"SUCCESS: {len(result)} characters")
    
    await wrapper.cleanup()

asyncio.run(test())
```

### Test the Unified Wrapper
```python
import asyncio
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

async def test():
    # Auto-detect the best provider
    wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(model="auto"))
    
    info = wrapper.get_provider_info()
    print(f"Using: {info['provider']}")
    
    result = await wrapper.execute_sync("What is 5 + 5?")
    print(f"Result: {result}")
    
    await wrapper._get_underlying_wrapper().cleanup()

asyncio.run(test())
```

### Test Provider Detection
```python
from unified_cli_wrapper import UnifiedCliWrapper

providers = UnifiedCliWrapper.list_available_providers()
for name, info in providers.items():
    print(f"{name}: {'Available' if info['available'] else 'Not available'}")
```

## 🎯 What Each Test Validates

### ✅ **Critical Bug Fix** (JSON Parsing)
- **Before Fix**: `'list' object has no attribute 'get'` error
- **After Fix**: Tool usage works perfectly
- **Test Command**: `python simple_wrapper_test.py`

### ✅ **Unified Wrapper Factory**
- Multi-model support (Claude + Gemini)
- Auto-detection of available providers
- Consistent interface across providers
- **Test Command**: `python test_unified_wrapper.py`

### ✅ **Process Management** (Epic 3)
- Clean resource cleanup
- No hanging processes
- Automatic termination in <2 seconds
- **Validated in**: All test files

### ✅ **Error Handling**
- Graceful timeout handling
- Authentication error detection
- Invalid path handling
- **Test Command**: `python test_wrapper_basic.py`

## 🛠️ Troubleshooting

### Issue: Tests fail with "Claude CLI not found"
**Solution:**
```powershell
# Install Claude CLI
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Authenticate
claude setup-token
```

### Issue: "UnifiedCliWrapper has no attribute 'is_available'"
**Solution:** Use the factory pattern:
```python
# Wrong way
wrapper = UnifiedCliWrapper(options)

# Correct way  
wrapper = UnifiedCliWrapper.create(options)
```

### Issue: Unicode errors on Windows
**Solution:** Use the `simple_wrapper_test.py` which has no Unicode characters.

## 📊 Expected Results Summary

| Test File | Purpose | Expected Success Rate |
|-----------|---------|----------------------|
| `test_wrapper_basic.py` | Infrastructure | 100% (3/3) |
| `test_real_claude.py` | Integration | 100% (3/3) |
| `test_unified_wrapper.py` | Multi-model | 100% (4/4) |
| `simple_wrapper_test.py` | Quick validation | 100% (3/3) |

## 🎉 Success Criteria

Your wrappers are working correctly if you see:

1. ✅ **No JSON parsing errors** - The critical `'list' object has no attribute 'get'` bug is fixed
2. ✅ **Tool usage works** - File creation, reading, editing operations complete
3. ✅ **Clean process termination** - No hanging processes, Epic 3 working
4. ✅ **Provider detection** - Auto-detects Claude and Gemini availability
5. ✅ **Factory pattern** - Unified wrapper creates correct provider instances

## 💡 Next Steps After Testing

Once tests pass:
1. **Use in real projects** - The wrappers are production-ready
2. **Customize options** - Adjust timeouts, models, tools as needed  
3. **Add more providers** - Extend the unified wrapper pattern
4. **Integration** - Use with your existing Claude Code workflows

The wrappers we created yesterday are now fully functional with the critical JSON parsing bug resolved!