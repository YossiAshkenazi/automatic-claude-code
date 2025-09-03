#!/usr/bin/env python3
"""
Simple verification script for the startup system
"""

import sys
import subprocess
from pathlib import Path

def main():
    print("=== Visual Agent Management Platform - Startup Verification ===")
    print()
    
    # Check Python
    print(f"Python: {sys.version}")
    
    # Check pnpm
    try:
        result = subprocess.run(['pnpm', '--version'], capture_output=True, text=True)
        print(f"pnpm: {result.stdout.strip()}")
    except:
        print("pnpm: Not found")
    
    # Check Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        print(f"Node.js: {result.stdout.strip()}")
    except:
        print("Node.js: Not found")
    
    # Check project structure
    project_root = Path(__file__).parent
    key_files = [
        "start_platform.py",
        "start_platform.bat", 
        "platform_health_check.py",
        "python-sdk/start_websocket_server.py"
    ]
    
    print()
    print("Key files:")
    all_good = True
    for file in key_files:
        exists = (project_root / file).exists()
        status = "OK" if exists else "MISSING"
        print(f"  {file}: {status}")
        if not exists:
            all_good = False
    
    print()
    if all_good:
        print("Startup system is ready!")
        print()
        print("To start the platform:")
        print("  Windows: start_platform.bat")
        print("  All OS:  python start_platform.py")
        print()
        print("To check health: python platform_health_check.py")
    else:
        print("Some files are missing. Please check the installation.")
    
    return 0 if all_good else 1

if __name__ == "__main__":
    sys.exit(main())