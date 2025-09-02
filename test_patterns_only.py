#!/usr/bin/env python3
"""
Test script to analyze Claude CLI wrapper's tool detection patterns only
"""

import sys
import os

# Add the directory containing the wrapper to path
current_dir = os.path.dirname(os.path.abspath(__file__))
python_sdk_dir = os.path.join(current_dir, 'python-sdk')
sys.path.insert(0, python_sdk_dir)

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

def test_tool_detection_patterns():
    """Test the _parse_line method for tool detection patterns"""
    
    print("=== Claude CLI Wrapper Tool Detection Analysis ===\n")
    
    wrapper = ClaudeCliWrapper()
    
    # Test various line patterns that Claude might output
    test_patterns = [
        # Current patterns that should be detected
        ("Using tool: Read", "tool_use"),
        ("Executing: bash command", "tool_use"),
        ("USING TOOL: Write", "tool_use"),
        ("executing: edit command", "tool_use"),
        
        # Patterns that might be missed (potential improvements needed)
        ("Tool invocation: Read file.txt", "stream"),  # Should be tool_use?
        ("Starting Read tool with parameters...", "stream"),  # Should be tool_use?
        ("Claude is using the Bash tool", "stream"),  # Should be tool_use?
        ("Invoking Write tool", "stream"),  # Should be tool_use?
        ("<function_calls>", "stream"),  # Claude's actual tool format
        ("<invoke name=\"Read\">", "stream"),  # Claude's actual tool invocation
        ("</invoke>", "stream"),  # Claude's actual tool end
        
        # Error patterns
        ("Error: File not found", "error"),
        ("ERROR: Permission denied", "error"),
        ("failed: Could not execute", "error"),
        
        # Status patterns
        ("Processing request...", "status"),
        ("Waiting for response...", "status"),
        ("Loading model...", "status"),
        
        # Regular output
        ("Regular output line", "stream"),
        ("This is normal Claude response text", "stream"),
        
        # JSON patterns
        ('{"type": "tool_use", "content": "JSON tool message"}', "tool_use"),
        ('{"type": "stream", "content": "JSON stream message"}', "stream"),
        ('{"type": "error", "content": "JSON error message"}', "error"),
        
        # Actual Claude CLI output patterns (based on real usage)
        ("Reading file: /path/to/file.txt", "stream"),  # Should this be tool_use?
        ("Writing to file: output.txt", "stream"),  # Should this be tool_use?
        ("Running command: ls -la", "stream"),  # Should this be tool_use?
        ("File written successfully", "stream"),
        ("Command completed with exit code 0", "stream"),
    ]
    
    print("Testing tool detection patterns:")
    print("-" * 80)
    print(f"{'Input Pattern':<40} | {'Expected':<10} | {'Actual':<10} | {'Match':<5}")
    print("-" * 80)
    
    correct_detections = 0
    total_tests = len(test_patterns)
    missed_tools = []
    false_positives = []
    
    for input_line, expected_type in test_patterns:
        message = wrapper._parse_line(input_line)
        actual_type = message.type
        is_correct = actual_type == expected_type
        
        if is_correct:
            correct_detections += 1
        else:
            if expected_type == "tool_use" and actual_type != "tool_use":
                missed_tools.append(input_line)
            elif expected_type != "tool_use" and actual_type == "tool_use":
                false_positives.append(input_line)
        
        match_symbol = "OK" if is_correct else "FAIL"
        print(f"{input_line[:38]:<38} | {expected_type:<10} | {actual_type:<10} | {match_symbol:<5}")
    
    print("-" * 80)
    print(f"\nSUMMARY:")
    print(f"Correct detections: {correct_detections}/{total_tests} ({100*correct_detections/total_tests:.1f}%)")
    
    if missed_tools:
        print(f"\nMISSED TOOL PATTERNS ({len(missed_tools)}):")
        for pattern in missed_tools:
            print(f"  • '{pattern}'")
    
    if false_positives:
        print(f"\nFALSE POSITIVES ({len(false_positives)}):")
        for pattern in false_positives:
            print(f"  • '{pattern}'")
    
    return correct_detections, total_tests, missed_tools, false_positives

def analyze_current_patterns():
    """Analyze the current tool detection patterns in the wrapper"""
    
    print("\n" + "=" * 80)
    print("CURRENT TOOL DETECTION PATTERNS ANALYSIS")
    print("=" * 80)
    
    print("\n1. TOOL DETECTION PATTERNS (case-insensitive):")
    print("   • 'using tool:' in line")
    print("   • 'executing:' in line")
    
    print("\n2. ERROR DETECTION PATTERNS:")
    print("   • is_stderr = True")
    print("   • 'error:' in line (case-insensitive)")
    print("   • 'failed:' in line (case-insensitive)")
    
    print("\n3. STATUS DETECTION PATTERNS:")
    print("   • 'waiting' in line (case-insensitive)")
    print("   • 'processing' in line (case-insensitive)")
    print("   • 'loading' in line (case-insensitive)")
    
    print("\n4. JSON PARSING:")
    print("   • Attempts JSON parsing first")
    print("   • Uses 'type' field from JSON if present")
    
    print("\n5. POTENTIAL IMPROVEMENTS NEEDED:")
    print("   • Claude's actual tool format: <invoke>, </invoke>")
    print("   • Common tool action phrases: 'Reading file:', 'Writing to:', 'Running command:'")
    print("   • Tool completion messages: 'File written successfully', 'Command completed'")
    print("   • More comprehensive tool name detection")

def generate_recommendations():
    """Generate recommendations for improving tool detection"""
    
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS FOR IMPROVEMENT")
    print("=" * 80)
    
    recommendations = [
        "1. ADD CLAUDE'S ACTUAL TOOL PATTERNS:",
        "   • '<invoke' for tool start",
        "   • '</invoke>' for tool end",
        "   • '<parameter' for tool parameters",
        "",
        "2. ENHANCE TOOL ACTION DETECTION:",
        "   • 'Reading file:', 'Writing to file:', 'Running command:'",
        "   • 'Creating file:', 'Editing file:', 'Deleting file:'",
        "   • Tool-specific patterns for Read, Write, Edit, Bash tools",
        "",
        "3. ADD TOOL COMPLETION PATTERNS:",
        "   • 'File written successfully', 'Command completed'",
        "   • 'Operation completed', 'Task finished'",
        "   • Exit code patterns for Bash tool",
        "",
        "4. IMPROVE ERROR DETECTION:",
        "   • Tool-specific error patterns",
        "   • Permission denied messages",
        "   • File not found errors",
        "",
        "5. ADD CONFIGURABLE PATTERNS:",
        "   • Allow custom tool detection patterns",
        "   • Support for different Claude CLI versions",
        "   • Regex-based pattern matching option"
    ]
    
    for recommendation in recommendations:
        print(recommendation)

if __name__ == "__main__":
    # Run the pattern analysis
    correct, total, missed, false_pos = test_tool_detection_patterns()
    
    # Show current pattern analysis
    analyze_current_patterns()
    
    # Generate recommendations
    generate_recommendations()
    
    print(f"\n" + "=" * 80)
    print("FINAL ASSESSMENT")
    print("=" * 80)
    print(f"Overall accuracy: {100*correct/total:.1f}%")
    print(f"Tool detection capability: {'GOOD' if correct/total > 0.7 else 'NEEDS IMPROVEMENT'}")
    print(f"Major gaps: {len(missed)} missed tool patterns")
    print(f"False positives: {len(false_pos)} incorrect tool detections")