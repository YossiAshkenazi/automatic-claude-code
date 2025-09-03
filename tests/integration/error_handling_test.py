#!/usr/bin/env python3
"""
Test error handling capabilities of the Claude CLI wrapper
"""

import sys
import os

# Add the directory containing the wrapper to path
current_dir = os.path.dirname(os.path.abspath(__file__))
python_sdk_dir = os.path.join(current_dir, 'python-sdk')
sys.path.insert(0, python_sdk_dir)

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

def test_error_scenarios():
    """Test various error handling scenarios"""
    
    print("=== Error Handling Analysis ===\n")
    
    # Test error detection patterns
    error_patterns = [
        # CLI-specific errors
        ("Invalid API key · Fix external API key", "error"),
        ("Permission denied: cannot access file", "error"),  
        ("Command not found: claude", "error"),
        ("Authentication failed", "error"),
        ("Connection timeout", "error"),
        
        # Tool-specific errors
        ("Read tool: File not found", "error"),
        ("Write tool: Permission denied", "error"),
        ("Bash tool: Command failed with exit code 1", "error"),
        ("Edit tool: Cannot modify read-only file", "error"),
        
        # Network/API errors
        ("API rate limit exceeded", "error"),
        ("Network connection failed", "error"),
        ("Server returned HTTP 500", "error"),
        
        # General error patterns
        ("Error: Something went wrong", "error"),
        ("Failed to execute command", "error"),
        ("Exception occurred: ValueError", "error"),
        
        # Non-error patterns that might be confused
        ("Processing request for error handling", "status"),
        ("Loading error recovery module", "status"),
        ("This failed test should pass", "stream"),
    ]
    
    wrapper = ClaudeCliWrapper()
    
    print("Testing error detection patterns:")
    print("-" * 70)
    print(f"{'Pattern':<40} | {'Expected':<8} | {'Actual':<8} | {'Match'}")
    print("-" * 70)
    
    correct = 0
    total = len(error_patterns)
    
    for pattern, expected in error_patterns:
        # Test both as regular output and stderr
        for is_stderr in [False, True]:
            message = wrapper._parse_line(pattern, is_stderr)
            actual = message.type
            
            # For stderr, everything should be error
            if is_stderr and expected != "error":
                expected_for_stderr = "error"
            else:
                expected_for_stderr = expected
            
            is_correct = actual == expected_for_stderr
            if is_correct:
                correct += 1
            
            source = "stderr" if is_stderr else "stdout"
            match_symbol = "OK" if is_correct else "FAIL"
            print(f"{pattern[:35]:<35} ({source}) | {expected_for_stderr:<8} | {actual:<8} | {match_symbol}")
    
    print("-" * 70)
    print(f"Error detection accuracy: {correct}/{total*2} ({100*correct/(total*2):.1f}%)")

def analyze_missing_patterns():
    """Analyze what tool patterns might be missing"""
    
    print("\n=== Missing Pattern Analysis ===\n")
    
    # Patterns that the current implementation might miss
    potentially_missed = [
        # Claude's actual XML-like tool format
        ("<function_calls>", "Should be tool_use start"),
        ("<invoke name=\"Read\">", "Should be tool_use"),
        ("<parameter name=\"file_path\">", "Should be tool_use parameter"),
        ("</invoke>", "Should be tool_use end"),
        ("</function_calls>", "Should be tool_use end"),
        
        # Tool invocation descriptions that might be missed
        ("Reading file: /path/to/file.txt", "Should be tool_use"),
        ("Writing to file: output.txt", "Should be tool_use"),
        ("Running command: ls -la", "Should be tool_use"),
        ("Editing file: config.json", "Should be tool_use"),
        
        # Tool result patterns
        ("File read successfully", "Could be tool_use result"),
        ("Command output: Hello World", "Could be tool_use result"),
        ("File modification completed", "Could be tool_use result"),
        
        # Real Claude output patterns (based on documentation)
        ("I'll use the Read tool to examine", "Could indicate tool_use coming"),
        ("Let me check the file contents", "Could indicate tool_use coming"),
        ("I'll run a command to", "Could indicate tool_use coming"),
        ("Using the Bash tool:", "Should be tool_use"),
    ]
    
    wrapper = ClaudeCliWrapper()
    
    print("Analyzing potentially missed tool patterns:")
    print("-" * 80)
    
    for pattern, note in potentially_missed:
        message = wrapper._parse_line(pattern)
        actual = message.type
        print(f"{pattern[:40]:<40} | {actual:<12} | {note}")

if __name__ == "__main__":
    test_error_scenarios()
    analyze_missing_patterns()
    
    print("\n" + "=" * 80)
    print("ERROR HANDLING ASSESSMENT SUMMARY")
    print("=" * 80)
    print("1. CURRENT ERROR DETECTION: Limited to basic patterns")
    print("2. STDERR HANDLING: Treats all stderr as errors (good)")
    print("3. TOOL FAILURE DETECTION: Basic keyword matching only")
    print("4. MISSING PATTERNS: Claude's XML-like tool format not detected")
    print("5. RECOMMENDATION: Need more comprehensive tool pattern matching")