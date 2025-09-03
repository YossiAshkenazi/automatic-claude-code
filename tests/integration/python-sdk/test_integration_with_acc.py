#!/usr/bin/env python3
"""
Test Integration with automatic-claude-code System
This tests the Python SDK integration with the existing browser-based authentication
"""

import asyncio
import subprocess
import requests
import json
from pathlib import Path

def test_acc_system():
    """Test if automatic-claude-code system is available"""
    print("Testing automatic-claude-code System")
    print("-" * 50)
    
    # Check if acc command is available
    try:
        result = subprocess.run(["acc", "--version"], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print("[PASS] ACC command available")
            print(f"[INFO] Version: {result.stdout.strip()}")
            return True
        else:
            print("[FAIL] ACC command not working")
            return False
    except (subprocess.TimeoutExpired, FileNotFoundError):
        print("[FAIL] ACC command not found")
        print("[INFO] Make sure automatic-claude-code is installed")
        return False

def test_monitoring_integration():
    """Test monitoring system that handles sessions"""
    print("\nTesting Monitoring System")
    print("-" * 50)
    
    # Check monitoring server
    try:
        response = requests.get("http://localhost:4001/api/health", timeout=3)
        if response.status_code == 200:
            data = response.json()
            print(f"[PASS] Monitoring server running")
            print(f"[INFO] Status: {data.get('status', 'unknown')}")
            
            # Check for active agents
            agents = data.get('agents', {})
            if agents.get('running'):
                print("[INFO] Active agents detected")
            else:
                print("[INFO] No active agents")
            
            return True
    except requests.exceptions.RequestException:
        print("[FAIL] Monitoring server not accessible")
        return False
    
    return False

def test_browser_session():
    """Check if browser session might be active"""
    print("\nTesting Browser Session Availability")
    print("-" * 50)
    
    # Check for browser session indicators
    browser_session_files = [
        Path.home() / '.claude' / 'session.json',
        Path.home() / '.automatic-claude-code' / 'sessions',
        Path.home() / 'AppData' / 'Local' / 'Claude' / 'User Data'
    ]
    
    session_found = False
    for path in browser_session_files:
        if path.exists():
            print(f"[INFO] Found session indicator: {path}")
            session_found = True
            break
    
    if not session_found:
        print("[INFO] No browser session indicators found")
        print("[INFO] Browser authentication happens through ACC system")
    
    return True  # This is informational only

async def test_python_sdk_with_acc():
    """Test how Python SDK should integrate with ACC"""
    print("\nTesting Python SDK Integration Approach")
    print("-" * 50)
    
    print("[INFO] The Python SDK should integrate with ACC in two ways:")
    print()
    print("1. DIRECT EXECUTION MODE (Current):")
    print("   - Python SDK -> Claude CLI directly")
    print("   - Requires standalone authentication")
    print("   - Used for independent Python scripts")
    print()
    print("2. INTEGRATED MODE (Recommended):")
    print("   - Python SDK -> ACC system -> Browser session")
    print("   - Uses existing subscription authentication")
    print("   - Leverages monitoring and session management")
    print()
    
    # Test which mode we're in
    is_nested = (
        os.environ.get('CLAUDECODE') == '1' or
        os.environ.get('CLAUDE_CODE_ENTRYPOINT') == 'cli'
    )
    
    if is_nested:
        print("[INFO] Running in NESTED mode - will use parent session")
    else:
        print("[INFO] Running in STANDALONE mode - needs authentication")
    
    return True

async def test_recommended_usage():
    """Show the recommended usage pattern"""
    print("\nRecommended Usage Pattern")
    print("-" * 50)
    
    print("For INTEGRATED usage with your subscription:")
    print()
    print("1. Start the ACC system:")
    print("   acc run 'your task' --dual-agent")
    print()
    print("2. The ACC system will:")
    print("   - Handle browser authentication")
    print("   - Manage sessions")
    print("   - Coordinate dual agents")
    print("   - Track monitoring")
    print()
    print("3. Python SDK can then be used within ACC context:")
    print("   - As a tool called by ACC")
    print("   - With inherited authentication")
    print("   - Full monitoring integration")
    
    return True

import os

async def main():
    """Run all integration tests"""
    print("Python SDK + automatic-claude-code Integration Test")
    print("=" * 60)
    
    # Test 1: ACC System
    acc_available = test_acc_system()
    
    # Test 2: Monitoring
    monitoring_running = test_monitoring_integration()
    
    # Test 3: Browser Session
    test_browser_session()
    
    # Test 4: Integration Approach
    await test_python_sdk_with_acc()
    
    # Test 5: Recommended Usage
    await test_recommended_usage()
    
    # Summary
    print("\n" + "=" * 60)
    print("INTEGRATION SUMMARY")
    print("=" * 60)
    
    if acc_available and monitoring_running:
        print("[READY] Full ACC integration available")
        print("You can use Python SDK through ACC system with subscription auth")
    elif monitoring_running:
        print("[PARTIAL] Monitoring available but ACC not accessible")
        print("Python SDK can track sessions but needs auth setup")
    else:
        print("[STANDALONE] Python SDK in standalone mode")
        print("Will need separate authentication or ACC integration")
    
    print("\n" + "=" * 60)
    print("AUTHENTICATION CLARIFICATION")
    print("=" * 60)
    print()
    print("You're RIGHT - the system should use your SUBSCRIPTION!")
    print()
    print("The proper flow is:")
    print("1. ACC system authenticates via browser with your subscription")
    print("2. Python SDK integrates with ACC (not standalone CLI)")
    print("3. Authentication is inherited from ACC's browser session")
    print()
    print("The timeout you're seeing is because the Python SDK is trying")
    print("to authenticate independently instead of using ACC's session.")
    print()
    print("SOLUTION: Run Python SDK through ACC system:")
    print('  acc run "python my_script.py" --dual-agent')
    print("  This way it uses your subscription authentication!")

if __name__ == "__main__":
    asyncio.run(main())