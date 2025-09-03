#!/usr/bin/env python3
"""
Test script to verify the JSON parsing fix in claude_cli_wrapper.py
"""
import json
from claude_cli_wrapper import ClaudeCliWrapper

def test_parsing_scenarios():
    """Test various JSON parsing scenarios that could cause the 'list' object error."""
    
    # Create a wrapper instance for testing
    wrapper = ClaudeCliWrapper()
    
    print("Testing JSON parsing fix...")
    print("=" * 50)
    
    # Test cases that previously would fail
    test_cases = [
        # Case 1: Empty list
        ("[]", "Empty JSON array"),
        
        # Case 2: List with single dictionary
        ('[{"type": "result", "content": "Hello"}]', "Single dict in array"),
        
        # Case 3: List with multiple items
        ('[{"type": "stream"}, {"type": "result"}]', "Multiple dicts in array"),
        
        # Case 4: List with non-dict items
        ('["hello", "world"]', "Array of strings"),
        
        # Case 5: JSON primitive (string)
        ('"Simple string"', "JSON string primitive"),
        
        # Case 6: JSON primitive (number)
        ('42', "JSON number primitive"),
        
        # Case 7: Normal dictionary (should work as before)
        ('{"type": "result", "content": "Normal dict"}', "Normal dictionary"),
        
        # Case 8: Complex nested dictionary
        ('{"type": "tool_use", "metadata": {"nested": true}, "content": "Complex"}', "Complex dictionary"),
    ]
    
    success_count = 0
    
    for json_line, description in test_cases:
        try:
            print(f"\n{description}:")
            print(f"Input: {json_line}")
            
            # Test the _parse_line method
            result = wrapper._parse_line(json_line, is_stderr=False)
            
            print(f"[SUCCESS] Type: {result.type}, Content: {result.content[:50]}...")
            print(f"   Metadata keys: {list(result.metadata.keys())}")
            success_count += 1
            
        except Exception as e:
            print(f"[FAILED] Error: {e}")
    
    print("\n" + "=" * 50)
    print(f"Results: {success_count}/{len(test_cases)} test cases passed")
    
    if success_count == len(test_cases):
        print("All tests passed! The 'list' object error should be fixed.")
        return True
    else:
        print(f"Warning: {len(test_cases) - success_count} test cases failed.")
        return False

if __name__ == "__main__":
    test_parsing_scenarios()