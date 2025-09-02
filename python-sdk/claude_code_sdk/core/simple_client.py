"""
Simple working client that bypasses complex error handling
"""

import subprocess
import shutil
import asyncio
from typing import Any

class SimpleClaudeClient:
    """Simple working Claude client"""
    
    def __init__(self):
        self.claude_path = shutil.which('claude')
        if not self.claude_path:
            raise Exception("Claude CLI not found")
    
    def execute(self, prompt: str) -> Any:
        """Simple execute method that works"""
        try:
            result = subprocess.run(
                [self.claude_path, '--output-format', 'text', prompt],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            class SimpleResult:
                def __init__(self, success, result, error):
                    self.success = success
                    self.result = result
                    self.error = error
            
            if result.returncode == 0:
                return SimpleResult(True, result.stdout.strip(), None)
            else:
                return SimpleResult(False, None, result.stderr.strip())
                
        except Exception as e:
            class SimpleResult:
                def __init__(self, success, result, error):
                    self.success = success
                    self.result = result
                    self.error = error
            return SimpleResult(False, None, str(e))
    
    async def query(self, prompt: str):
        """Simple async query"""
        result = self.execute(prompt)
        
        class SimpleMessage:
            def __init__(self, content, msg_type="result"):
                self.content = content
                self.result = content  # For compatibility
                self.type = msg_type
        
        if result.success:
            yield SimpleMessage(result.result)
        else:
            yield SimpleMessage(f"Error: {result.error}", "error")

# Simple query function
async def simple_query(prompt: str):
    """Simple query function that works"""
    client = SimpleClaudeClient()
    async for message in client.query(prompt):
        yield message