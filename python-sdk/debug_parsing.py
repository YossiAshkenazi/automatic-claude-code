#!/usr/bin/env python3
"""
Debug script to test parsing logic
"""

from claude_cli_wrapper import ClaudeCliWrapper

def test_parsing():
    wrapper = ClaudeCliWrapper()
    
    test_cases = [
        "<function_calls>",
        "<invoke name='Read'>", 
        "</invoke>",
        "Some text with <function_calls> in middle",
        "[1/5] Processing files",
        "Progress: 75%"
    ]
    
    print("Testing parsing logic:")
    print("=" * 50)
    
    for line in test_cases:
        message = wrapper._parse_line(line)
        print(f"Input:  '{line}'")
        print(f"Type:   {message.type}")
        print(f"Meta:   {message.metadata}")
        print("-" * 30)

if __name__ == "__main__":
    test_parsing()