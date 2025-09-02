#!/usr/bin/env python3
"""
Quick SDK Validation Runner
Runs comprehensive validation without requiring live API access
"""

import sys
import subprocess
import time
from pathlib import Path

def main():
    """Run SDK validation and report results"""
    print("🔍 Claude Code SDK Validation")
    print("=" * 50)
    
    # Check if we're in the right directory
    sdk_path = Path(__file__).parent
    test_file = sdk_path / 'test_sdk_validation.py'
    
    if not test_file.exists():
        print("❌ Error: test_sdk_validation.py not found")
        return False
    
    print(f"📂 Running tests from: {sdk_path}")
    print(f"🧪 Test file: {test_file.name}")
    print()
    
    try:
        # Run the validation tests
        start_time = time.time()
        result = subprocess.run(
            [sys.executable, str(test_file)],
            cwd=sdk_path,
            capture_output=True,
            text=True
        )
        execution_time = time.time() - start_time
        
        print(f"⏱️  Execution time: {execution_time:.2f} seconds")
        print()
        
        if result.returncode == 0:
            print("✅ All validation tests passed!")
            print()
            print("📊 Test Coverage Summary:")
            print("   • Client initialization and CLI detection")
            print("   • Basic task execution flow")
            print("   • Authentication error handling")
            print("   • Timeout error handling")
            print("   • Real-time streaming simulation")
            print("   • Session management")
            print("   • Multi-turn conversations")
            print("   • Process management")
            print("   • Error condition handling")
            print("   • Performance scenarios")
            print()
            print("🎯 SDK is ready for development without live API calls")
            return True
        else:
            print("❌ Some validation tests failed")
            print("\nTest output:")
            print(result.stdout)
            if result.stderr:
                print("\nErrors:")
                print(result.stderr)
            return False
    
    except Exception as e:
        print(f"❌ Error running validation: {e}")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)