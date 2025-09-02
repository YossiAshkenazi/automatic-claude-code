#!/usr/bin/env python3
"""
Tool Usage Example - Demonstrate Claude using tools like Read, Write, Edit, Bash
Demonstrates: Tool integration, file operations, code execution, MCP tools
"""

import asyncio
import sys
from pathlib import Path
import tempfile
import os

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions


async def file_operations_example():
    """Demonstrate Claude using Read/Write/Edit tools"""
    
    print("📁 Tool Usage Example - File Operations")
    print("=" * 50)
    
    # Create temporary directory for testing
    temp_dir = Path(tempfile.mkdtemp())
    print(f"📂 Working in: {temp_dir}")
    
    options = ClaudeCliOptions(
        model="sonnet",
        max_turns=10,
        allowed_tools=["Read", "Write", "Edit", "Bash"],
        working_directory=temp_dir,
        verbose=True,
        timeout=180
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("❌ Claude CLI not available")
        return
    
    try:
        # Task 1: Create and modify files
        print("\n🎯 Task 1: Create a Python script with functions")
        prompt1 = f"""
        Create a Python file called 'calculator.py' in the directory {temp_dir} with the following:
        1. A function to add two numbers
        2. A function to multiply two numbers  
        3. A main section that demonstrates both functions
        
        After creating the file, show me its contents to verify it was created correctly.
        """
        
        print("\n🤖 Claude's response:")
        print("-" * 40)
        
        async for message in wrapper.execute(prompt1):
            if message.type == "content":
                print(message.content, end="", flush=True)
            elif message.type == "tool_use":
                print(f"\n🔧 [Using tool: {message.content}]")
        
        # Task 2: Modify the existing file
        print("\n\n🎯 Task 2: Add division and error handling")
        prompt2 = """
        Now modify the calculator.py file to:
        1. Add a divide function with error handling for division by zero
        2. Add docstrings to all functions
        3. Show me the updated file contents
        """
        
        print("\n🤖 Claude's response:")
        print("-" * 40)
        
        async for message in wrapper.execute(prompt2):
            if message.type == "content":
                print(message.content, end="", flush=True)
            elif message.type == "tool_use":
                print(f"\n🔧 [Using tool: {message.content}]")
        
        # Verify files were created
        calculator_file = temp_dir / "calculator.py"
        if calculator_file.exists():
            print(f"\n✅ File created successfully: {calculator_file}")
            print(f"📏 File size: {calculator_file.stat().st_size} bytes")
        else:
            print(f"\n⚠️  File not found: {calculator_file}")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    finally:
        await wrapper.cleanup()
        
        # Cleanup temp directory
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        print(f"\n🧹 Cleaned up temp directory: {temp_dir}")


async def bash_execution_example():
    """Demonstrate Claude using Bash tool for system operations"""
    
    print("\n💻 Tool Usage Example - Bash Commands")
    print("=" * 50)
    
    options = ClaudeCliOptions(
        model="sonnet",
        max_turns=8,
        allowed_tools=["Bash", "Read", "Write"],
        verbose=True,
        dangerously_skip_permissions=True  # For demo purposes
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("❌ Claude CLI not available")
        return
    
    try:
        print("\n🎯 Task: System information gathering")
        prompt = """
        Help me gather some basic system information. Please:
        1. Show the current directory
        2. List the contents of the current directory
        3. Show the current date and time
        4. Check if Python is installed and what version
        5. Create a simple text file with this system info and show its contents
        
        Use appropriate bash commands for each task.
        """
        
        print("\n🤖 Claude's response:")
        print("-" * 40)
        
        tool_count = 0
        
        async for message in wrapper.execute(prompt):
            if message.type == "content":
                print(message.content, end="", flush=True)
            elif message.type == "tool_use":
                tool_count += 1
                print(f"\n🔧 [Tool {tool_count}: {message.content}]")
        
        print(f"\n\n📊 Total tools used: {tool_count}")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    finally:
        await wrapper.cleanup()


async def code_analysis_example():
    """Demonstrate Claude analyzing and improving code"""
    
    print("\n🔍 Tool Usage Example - Code Analysis")
    print("=" * 50)
    
    # Create a sample Python file to analyze
    temp_dir = Path(tempfile.mkdtemp())
    sample_file = temp_dir / "sample_code.py"
    
    # Write sample code with some issues
    sample_code = '''
# Sample code with some issues
import os, sys, json

def calculate(x, y):
    result = x / y
    return result

def process_data(data):
    results = []
    for item in data:
        if item > 0:
            results.append(calculate(item, 2))
    return results

data = [1, 2, 0, 4, -1, 6]
print("Results:", process_data(data))
'''
    
    sample_file.write_text(sample_code)
    print(f"📝 Created sample file: {sample_file}")
    
    options = ClaudeCliOptions(
        model="sonnet",
        max_turns=10,
        allowed_tools=["Read", "Write", "Edit"],
        working_directory=temp_dir,
        verbose=True
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("❌ Claude CLI not available")
        return
    
    try:
        prompt = f"""
        Please analyze the Python file 'sample_code.py' in {temp_dir} and:
        1. Read the file and identify any issues or improvements
        2. Create an improved version that fixes potential problems
        3. Save the improved version as 'improved_code.py'
        4. Show me both the original issues and the improvements made
        """
        
        print("\n🤖 Claude's analysis and improvements:")
        print("-" * 50)
        
        async for message in wrapper.execute(prompt):
            if message.type == "content":
                print(message.content, end="", flush=True)
            elif message.type == "tool_use":
                print(f"\n🔧 [Using tool: {message.content}]")
        
        # Check if improved file was created
        improved_file = temp_dir / "improved_code.py"
        if improved_file.exists():
            print(f"\n✅ Improved file created: {improved_file}")
            print(f"📏 Original: {sample_file.stat().st_size} bytes")
            print(f"📏 Improved: {improved_file.stat().st_size} bytes")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    finally:
        await wrapper.cleanup()
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        print(f"\n🧹 Cleaned up: {temp_dir}")


async def mcp_tools_example():
    """Demonstrate MCP (Model Context Protocol) tools if available"""
    
    print("\n🔌 Tool Usage Example - MCP Tools")
    print("=" * 50)
    
    # Check if MCP config exists
    mcp_config_path = Path.home() / ".claude" / "claude_desktop_config.json"
    
    options = ClaudeCliOptions(
        model="sonnet",
        max_turns=5,
        allowed_tools=["Read", "Write", "Bash"],  # Standard tools
        mcp_config=str(mcp_config_path) if mcp_config_path.exists() else None,
        verbose=True
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("❌ Claude CLI not available")
        return
    
    print(f"🔍 MCP Config: {options.mcp_config or 'Not found'}")
    
    try:
        if options.mcp_config:
            prompt = """
            Check what MCP tools are available and demonstrate one of them.
            If you have access to tools like web browsing, database access, 
            or other external integrations, show me what's available.
            """
        else:
            prompt = """
            MCP tools are not configured. Please explain what MCP (Model Context Protocol) 
            tools are and how they can be set up to extend Claude's capabilities.
            """
        
        print("\n🤖 MCP Tools information:")
        print("-" * 40)
        
        async for message in wrapper.execute(prompt):
            if message.type == "content":
                print(message.content, end="", flush=True)
            elif message.type == "tool_use":
                print(f"\n🔧 [MCP Tool: {message.content}]")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    finally:
        await wrapper.cleanup()


if __name__ == "__main__":
    print("🛠️  Claude CLI Wrapper - Tool Usage Examples")
    
    # Run file operations example
    asyncio.run(file_operations_example())
    
    input("\n⏸️  Press Enter for Bash execution example...")
    asyncio.run(bash_execution_example())
    
    input("\n⏸️  Press Enter for code analysis example...")
    asyncio.run(code_analysis_example())
    
    input("\n⏸️  Press Enter for MCP tools example...")
    asyncio.run(mcp_tools_example())