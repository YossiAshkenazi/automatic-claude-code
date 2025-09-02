#!/usr/bin/env python3
"""
Simple Query Example - Basic usage of the Claude CLI wrapper
Demonstrates: Simple prompt execution with error handling
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions


async def simple_query_example():
    """Basic query example with simple prompt"""
    
    # Configure wrapper options
    options = ClaudeCliOptions(
        model="sonnet",  # Use Claude 3.5 Sonnet
        max_turns=5,
        verbose=True,
        timeout=60  # 1 minute timeout
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    # Check if Claude CLI is available
    if not wrapper.is_available():
        print("[FAIL] Claude CLI not found. Please install with: npm install -g @anthropic-ai/claude-code")
        return
    
    print("[CLAUDE] Simple Claude Query Example")
    print("=" * 50)
    
    # Simple query
    prompt = "Explain what Python list comprehensions are in simple terms with one example"
    
    try:
        print(f"[NOTE] Query: {prompt}")
        print("\n[RETRY] Response:")
        print("-" * 30)
        
        # Get synchronous response
        response = await wrapper.execute_sync(prompt)
        print(response)
        
        print("\n[OK] Query completed successfully!")
        
    except Exception as e:
        print(f"[FAIL] Error executing query: {e}")
        return
    
    finally:
        # Always cleanup
        await wrapper.cleanup()


async def interactive_query_example():
    """Interactive example letting user input queries"""
    
    options = ClaudeCliOptions(
        model="sonnet",
        max_turns=3,
        verbose=False
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("[FAIL] Claude CLI not available")
        return
    
    print("\n[RESULT] Interactive Query Mode")
    print("Type 'quit' to exit")
    print("=" * 40)
    
    try:
        while True:
            # Get user input
            user_input = input("\n[Q] Your question: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                break
            
            if not user_input:
                continue
            
            print("[CLAUDE]:")
            try:
                response = await wrapper.execute_sync(user_input)
                print(response)
            except Exception as e:
                print(f"[FAIL] Error: {e}")
                
    except KeyboardInterrupt:
        print("\n[BYE] Goodbye!")
    finally:
        await wrapper.cleanup()


if __name__ == "__main__":
    print("[START] Claude CLI Wrapper - Simple Query Examples")
    
    # Run simple query
    asyncio.run(simple_query_example())
    
    # Ask if user wants interactive mode
    try:
        choice = input("\n[INPUT] Try interactive mode? (y/N): ").strip().lower()
        if choice in ['y', 'yes']:
            asyncio.run(interactive_query_example())
    except KeyboardInterrupt:
        print("\n👋 Exiting...")