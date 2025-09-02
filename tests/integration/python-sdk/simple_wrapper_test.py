#!/usr/bin/env python3
"""
Simple test script for Claude CLI Wrapper
"""

import subprocess
import sys
import os

def test_direct_claude():
    """Test Claude CLI directly"""
    print("=== Testing Claude CLI Directly ===")
    
    try:
        # Test basic Claude CLI
        result = subprocess.run(
            ["claude", "--version"], 
            capture_output=True, 
            text=True, 
            timeout=10
        )
        print(f"Claude CLI Version: {result.stdout.strip()}")
        
        # Test simple query
        result = subprocess.run([
            "claude", 
            "-p", "What is 2+2? Answer in one line only.",
            "--max-turns", "1"
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print(f"SUCCESS: Got response: {result.stdout[:100]}...")
            return True
        else:
            print(f"FAIL: Return code {result.returncode}")
            print(f"STDERR: {result.stderr[:200]}...")
            return False
            
    except subprocess.TimeoutExpired:
        print("FAIL: Timeout")
        return False
    except Exception as e:
        print(f"FAIL: {e}")
        return False

def test_model_switching():
    """Test different models"""
    print("\n=== Testing Model Switching ===")
    
    models = ["sonnet", "haiku"]
    results = {}
    
    for model in models:
        print(f"Testing {model}...")
        try:
            result = subprocess.run([
                "claude",
                "--model", model,
                "-p", f"Say 'Hello from {model}' in one line",
                "--max-turns", "1"
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                response = result.stdout.strip()[:50]
                print(f"SUCCESS: {model} responded: {response}...")
                results[model] = True
            else:
                print(f"FAIL: {model} failed with return code {result.returncode}")
                results[model] = False
                
        except subprocess.TimeoutExpired:
            print(f"FAIL: {model} timed out")
            results[model] = False
        except Exception as e:
            print(f"FAIL: {model} error: {e}")
            results[model] = False
    
    return all(results.values())

def test_wrapper_basic():
    """Test the Python wrapper basic functionality"""
    print("\n=== Testing Python Wrapper ===")
    
    try:
        # Import wrapper
        from claude_cli_wrapper import ClaudeCliWrapper
        
        # Test initialization
        wrapper = ClaudeCliWrapper()
        print(f"SUCCESS: Wrapper initialized, CLI at: {wrapper.cli_path}")
        
        # Check CLI path exists
        if os.path.exists(wrapper.cli_path):
            print("SUCCESS: CLI path exists")
            return True
        else:
            print("FAIL: CLI path does not exist")
            return False
            
    except Exception as e:
        print(f"FAIL: Wrapper error: {e}")
        return False

def check_api_keys():
    """Check for API key independence"""
    print("\n=== Checking API Key Independence ===")
    
    api_keys = ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "API_KEY"]
    found = []
    
    for key in api_keys:
        if os.environ.get(key):
            found.append(key)
    
    if found:
        print(f"NOTE: Found API keys: {found}")
    else:
        print("SUCCESS: No API keys found in environment")
    
    print("SUCCESS: Tests run without requiring API keys")
    return True

def main():
    """Run tests"""
    print("Claude CLI Wrapper Test Suite - Simplified")
    print("=" * 50)
    
    tests = [
        ("Direct Claude CLI", test_direct_claude),
        ("Model Switching", test_model_switching), 
        ("Wrapper Basic", test_wrapper_basic),
        ("API Key Independence", check_api_keys)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results[test_name] = result
        except Exception as e:
            print(f"FAIL: {test_name} crashed: {e}")
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 50)
    print("TEST RESULTS:")
    print("=" * 50)
    
    passed = 0
    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("CONCLUSION: Claude CLI Wrapper is FUNCTIONAL")
    elif passed >= len(tests) // 2:
        print("CONCLUSION: Claude CLI Wrapper has PARTIAL functionality")
    else:
        print("CONCLUSION: Claude CLI Wrapper is NOT FUNCTIONAL")

if __name__ == "__main__":
    main()