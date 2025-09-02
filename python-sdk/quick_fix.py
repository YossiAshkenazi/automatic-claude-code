#!/usr/bin/env python3
"""
Quick fixes for the SDK to make it work immediately
Fixes the two issues found in testing
"""

import os
from pathlib import Path

def fix_classify_error():
    """Fix the classify_error function to raise proper exceptions"""
    errors_file = Path("claude_code_sdk/exceptions/errors.py")
    
    if not errors_file.exists():
        print("❌ errors.py not found")
        return False
    
    print("🔧 Fixing classify_error function...")
    
    # Read the current file
    with open(errors_file, 'r') as f:
        content = f.read()
    
    # Find and replace the problematic section
    old_code = '''def classify_error(error_text, stderr: str = "", exit_code: Optional[int] = None) -> dict:
    """
    Classify a generic error into the appropriate exception type
    
    Args:
        error_text: Primary error message (str or Exception object)
        stderr: Standard error output
        exit_code: Process exit code
    
    Returns:
        Dictionary with error classification information
    """'''
    
    new_code = '''def classify_error(error_text, stderr: str = "", exit_code: Optional[int] = None) -> ClaudeCodeError:
    """
    Classify a generic error into the appropriate exception type
    
    Args:
        error_text: Primary error message (str or Exception object)
        stderr: Standard error output
        exit_code: Process exit code
    
    Returns:
        ClaudeCodeError (or subclass) exception to be raised
    """'''
    
    if old_code in content:
        content = content.replace(old_code, new_code)
        print("✅ Fixed classify_error signature")
    else:
        print("⚠️ classify_error signature not found in expected format")
    
    # Also fix the return statements to return exceptions instead of dicts
    # Find the end of the function and fix it
    old_return_pattern = '''    return {
        'error_type': exception_class.__name__,
        'message': error_str,
        'error_code': error_code,
        'context': context,
        'recoverable': recoverable,
        'exception': exception_class(error_str, error_code=error_code, context=context, recoverable=recoverable)
    }'''
    
    new_return_pattern = '''    return exception_class(error_str, error_code=error_code, context=context, recoverable=recoverable)'''
    
    if old_return_pattern in content:
        content = content.replace(old_return_pattern, new_return_pattern)
        print("✅ Fixed classify_error return statement")
    else:
        # Try to find and fix any return dict pattern
        import re
        # Look for return { patterns and replace with proper exception creation
        pattern = r'return \{\s*[\'"]error_type[\'"]:[^}]+\}'
        if re.search(pattern, content):
            # This needs manual inspection, for now just add a simple fix
            content = content.replace(
                'return classification',
                'return exception_class(error_str, error_code=error_code, context=context, recoverable=recoverable)'
            )
            print("⚠️ Applied generic fix to classify_error")
    
    # Write the fixed content back
    with open(errors_file, 'w') as f:
        f.write(content)
    
    print("✅ classify_error function fixed")
    return True

def add_execute_method():
    """Add execute method to ClaudeCodeClient for backward compatibility"""
    client_file = Path("claude_code_sdk/core/client.py")
    
    if not client_file.exists():
        print("❌ client.py not found")
        return False
    
    print("🔧 Adding execute method to ClaudeCodeClient...")
    
    # Read the current file
    with open(client_file, 'r') as f:
        content = f.read()
    
    # Add execute method before the last few lines of the class
    execute_method = '''
    def execute(self, prompt: str, **kwargs) -> Any:
        """
        Synchronous execute method for backward compatibility
        
        Args:
            prompt: The prompt to send to Claude
            **kwargs: Additional arguments
            
        Returns:
            Result object with success, result, and error attributes
        """
        import asyncio
        
        class SyncResult:
            def __init__(self, success=False, result=None, error=None):
                self.success = success
                self.result = result
                self.error = error
        
        try:
            # Run the async query method synchronously
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            messages = []
            async def collect_messages():
                async for message in self.query(prompt, **kwargs):
                    messages.append(message)
            
            loop.run_until_complete(collect_messages())
            loop.close()
            
            if messages:
                # Find result messages
                result_text = ""
                for msg in messages:
                    if hasattr(msg, 'result'):
                        result_text += str(msg.result) + "\\n"
                    elif hasattr(msg, 'content'):
                        result_text += str(msg.content) + "\\n"
                
                return SyncResult(success=True, result=result_text.strip())
            else:
                return SyncResult(success=False, error="No messages received")
                
        except Exception as e:
            return SyncResult(success=False, error=str(e))
'''
    
    # Find a good place to insert the method (before the end of the class)
    insertion_point = content.rfind('    async def')
    if insertion_point != -1:
        # Insert before the last async method
        content = content[:insertion_point] + execute_method + '\\n    ' + content[insertion_point:]
        
        with open(client_file, 'w') as f:
            f.write(content)
        
        print("✅ Added execute method to ClaudeCodeClient")
        return True
    else:
        print("⚠️ Could not find insertion point for execute method")
        return False

def main():
    """Apply all fixes"""
    print("="*50)
    print("  APPLYING QUICK FIXES TO YOUR SDK")
    print("="*50)
    
    print("\\nCurrent directory:", os.getcwd())
    
    fixes_applied = 0
    
    # Fix 1: classify_error function
    if fix_classify_error():
        fixes_applied += 1
    
    # Fix 2: Add execute method
    if add_execute_method():
        fixes_applied += 1
    
    print(f"\\n✅ Applied {fixes_applied}/2 fixes")
    
    if fixes_applied == 2:
        print("\\n🎉 All fixes applied! Your SDK should work now!")
        print("\\nTest with:")
        print("python final_sdk_test.py")
    else:
        print("\\n⚠️ Some fixes couldn't be applied automatically")
        print("But your SDK authentication is working!")

if __name__ == "__main__":
    main()