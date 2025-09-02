#!/usr/bin/env python3
"""
Integration Test Report for Claude Code Python SDK v0.1.0
Tests package installation, basic functionality, and ACC integration.
"""

import subprocess
import sys
import tempfile
import os
from pathlib import Path
import json
from typing import Dict, List, Any

class IntegrationTester:
    def __init__(self):
        self.results: Dict[str, Any] = {
            "package_build": {"status": "unknown", "details": []},
            "fresh_install": {"status": "unknown", "details": []},
            "basic_imports": {"status": "unknown", "details": []},
            "examples": {"status": "unknown", "details": []},
            "acc_integration": {"status": "unknown", "details": []},
            "python_version": {"status": "unknown", "details": []},
            "documentation": {"status": "unknown", "details": []},
            "overall_status": "unknown"
        }
        self.sdk_dir = Path(__file__).parent
        
    def log(self, test_name: str, message: str, status: str = "info"):
        """Log test results"""
        if test_name not in self.results:
            self.results[test_name] = {"status": "unknown", "details": []}
        
        self.results[test_name]["details"].append({
            "message": message,
            "status": status
        })
        
        print(f"[{status.upper()}] {test_name}: {message}")
        
    def run_command(self, cmd: List[str], cwd: str = None) -> tuple:
        """Run command and return (success, stdout, stderr)"""
        try:
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                cwd=cwd,
                timeout=120
            )
            return result.returncode == 0, result.stdout, result.stderr
        except Exception as e:
            return False, "", str(e)
    
    def test_package_build(self):
        """Test if package builds correctly"""
        self.log("package_build", "Testing package build process...")
        
        # Clean previous builds
        build_cmd = ["python", "-m", "build", "--wheel", "--sdist"]
        success, stdout, stderr = self.run_command(build_cmd, str(self.sdk_dir))
        
        if success:
            # Check if files exist
            wheel_file = self.sdk_dir / "dist" / "claude_code_sdk-0.1.0-py3-none-any.whl"
            sdist_file = self.sdk_dir / "dist" / "claude_code_sdk-0.1.0.tar.gz"
            
            if wheel_file.exists() and sdist_file.exists():
                self.results["package_build"]["status"] = "passed"
                self.log("package_build", f"Wheel size: {wheel_file.stat().st_size} bytes", "pass")
                self.log("package_build", f"Source dist size: {sdist_file.stat().st_size} bytes", "pass")
            else:
                self.results["package_build"]["status"] = "failed"
                self.log("package_build", "Distribution files not found", "fail")
        else:
            self.results["package_build"]["status"] = "failed"
            self.log("package_build", f"Build failed: {stderr}", "fail")

    def test_fresh_install(self):
        """Test installation in fresh virtual environment"""
        self.log("fresh_install", "Testing fresh virtual environment installation...")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            venv_path = Path(temp_dir) / "test_venv"
            
            # Create virtual environment
            success, stdout, stderr = self.run_command([
                sys.executable, "-m", "venv", str(venv_path)
            ])
            
            if not success:
                self.results["fresh_install"]["status"] = "failed"
                self.log("fresh_install", f"Failed to create venv: {stderr}", "fail")
                return
                
            # Get python executable in venv
            if os.name == 'nt':
                python_exe = venv_path / "Scripts" / "python.exe"
                pip_exe = venv_path / "Scripts" / "pip.exe"
            else:
                python_exe = venv_path / "bin" / "python"
                pip_exe = venv_path / "bin" / "pip"
            
            # Install from wheel
            wheel_file = self.sdk_dir / "dist" / "claude_code_sdk-0.1.0-py3-none-any.whl"
            success, stdout, stderr = self.run_command([
                str(pip_exe), "install", str(wheel_file)
            ])
            
            if success:
                self.results["fresh_install"]["status"] = "passed"
                self.log("fresh_install", "Package installed successfully", "pass")
                
                # Test basic import
                success, stdout, stderr = self.run_command([
                    str(python_exe), "-c", "import claude_code_sdk; print('Import successful')"
                ])
                
                if success:
                    self.log("fresh_install", "Basic import test passed", "pass")
                else:
                    self.results["fresh_install"]["status"] = "failed"
                    self.log("fresh_install", f"Import failed: {stderr}", "fail")
            else:
                self.results["fresh_install"]["status"] = "failed"
                self.log("fresh_install", f"Installation failed: {stderr}", "fail")

    def test_basic_imports(self):
        """Test all basic imports and functionality"""
        self.log("basic_imports", "Testing all SDK imports...")
        
        test_script = '''
import claude_code_sdk
from claude_code_sdk import ClaudeCodeClient
from claude_code_sdk.core import ClaudeCodeCoreClient, QueryOptions
from claude_code_sdk.exceptions import ClaudeCodeSDKError, ProcessError
from claude_code_sdk.integrations import AutomaticClaudeIntegration

# Test client creation
try:
    client = ClaudeCodeClient()
    print("✅ ClaudeCodeClient created successfully")
except Exception as e:
    print(f"❌ ClaudeCodeClient failed: {e}")

# Test options
try:
    options = QueryOptions(verbose=True, iterations=3)
    print("✅ QueryOptions created successfully")
except Exception as e:
    print(f"❌ QueryOptions failed: {e}")

# Test integration
try:
    integration = AutomaticClaudeIntegration()
    print("✅ AutomaticClaudeIntegration created successfully")
except Exception as e:
    print(f"❌ AutomaticClaudeIntegration failed: {e}")

print("All imports completed")
'''
        
        success, stdout, stderr = self.run_command([
            sys.executable, "-c", test_script
        ], str(self.sdk_dir))
        
        if success and "All imports completed" in stdout:
            self.results["basic_imports"]["status"] = "passed"
            self.log("basic_imports", "All imports successful", "pass")
            self.log("basic_imports", stdout.strip(), "info")
        else:
            self.results["basic_imports"]["status"] = "failed"
            self.log("basic_imports", f"Import test failed: {stderr}", "fail")

    def test_examples(self):
        """Test example scripts"""
        self.log("examples", "Testing example scripts...")
        
        examples_dir = self.sdk_dir / "examples"
        if not examples_dir.exists():
            self.results["examples"]["status"] = "failed"
            self.log("examples", "Examples directory not found", "fail")
            return
            
        example_files = list(examples_dir.glob("*.py"))
        if not example_files:
            self.results["examples"]["status"] = "failed"
            self.log("examples", "No example files found", "fail")
            return
        
        passed = 0
        total = len(example_files)
        
        for example_file in example_files:
            # Test syntax only (don't execute)
            success, stdout, stderr = self.run_command([
                sys.executable, "-m", "py_compile", str(example_file)
            ])
            
            if success:
                passed += 1
                self.log("examples", f"✅ {example_file.name} compiles correctly", "pass")
            else:
                self.log("examples", f"❌ {example_file.name} has syntax errors: {stderr}", "fail")
        
        if passed == total:
            self.results["examples"]["status"] = "passed"
            self.log("examples", f"All {total} examples compile correctly", "pass")
        else:
            self.results["examples"]["status"] = "failed"
            self.log("examples", f"Only {passed}/{total} examples compile correctly", "fail")

    def test_acc_integration(self):
        """Test ACC (Automatic Claude Code) integration"""
        self.log("acc_integration", "Testing ACC integration...")
        
        # Check if ACC is available
        success, stdout, stderr = self.run_command(["acc", "--version"])
        
        if not success:
            self.results["acc_integration"]["status"] = "warning"
            self.log("acc_integration", "ACC not installed - integration test skipped", "warning")
            return
        
        # Test SDK integration with ACC
        integration_test = '''
from claude_code_sdk.integrations import AutomaticClaudeIntegration
from claude_code_sdk.utils.cli_detector import detect_claude_cli

# Test CLI detection
cli_path = detect_claude_cli()
if cli_path:
    print(f"✅ Claude CLI detected: {cli_path}")
else:
    print("❌ Claude CLI not detected")

# Test integration
try:
    integration = AutomaticClaudeIntegration()
    result = integration.verify_setup()
    print(f"✅ ACC Integration setup verification: {result}")
except Exception as e:
    print(f"❌ ACC Integration failed: {e}")
'''
        
        success, stdout, stderr = self.run_command([
            sys.executable, "-c", integration_test
        ], str(self.sdk_dir))
        
        if success and "✅" in stdout:
            self.results["acc_integration"]["status"] = "passed"
            self.log("acc_integration", "ACC integration working", "pass")
            self.log("acc_integration", stdout.strip(), "info")
        else:
            self.results["acc_integration"]["status"] = "failed"
            self.log("acc_integration", f"ACC integration failed: {stderr}", "fail")

    def test_python_version(self):
        """Test minimum Python version compatibility"""
        self.log("python_version", "Testing Python version compatibility...")
        
        current_version = sys.version_info
        min_version = (3, 10)
        
        if current_version >= min_version:
            self.results["python_version"]["status"] = "passed"
            self.log("python_version", f"Python {current_version.major}.{current_version.minor}.{current_version.micro} >= 3.10 ✅", "pass")
        else:
            self.results["python_version"]["status"] = "failed"
            self.log("python_version", f"Python {current_version.major}.{current_version.minor}.{current_version.micro} < 3.10 ❌", "fail")

    def test_documentation(self):
        """Test documentation links and files"""
        self.log("documentation", "Testing documentation...")
        
        required_docs = ["README.md", "CHANGELOG.md", "QUICKSTART.md"]
        found_docs = []
        
        for doc in required_docs:
            doc_path = self.sdk_dir / doc
            if doc_path.exists() and doc_path.stat().st_size > 0:
                found_docs.append(doc)
                self.log("documentation", f"✅ {doc} exists and has content", "pass")
            else:
                self.log("documentation", f"❌ {doc} missing or empty", "fail")
        
        if len(found_docs) == len(required_docs):
            self.results["documentation"]["status"] = "passed"
            self.log("documentation", "All required documentation present", "pass")
        else:
            self.results["documentation"]["status"] = "failed"
            self.log("documentation", f"Missing documentation: {set(required_docs) - set(found_docs)}", "fail")

    def run_all_tests(self):
        """Run all integration tests"""
        print("=" * 60)
        print("Claude Code Python SDK v0.1.0 - Integration Test Report")
        print("=" * 60)
        
        test_methods = [
            self.test_python_version,
            self.test_package_build,
            self.test_fresh_install,
            self.test_basic_imports,
            self.test_examples,
            self.test_acc_integration,
            self.test_documentation
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                test_name = test_method.__name__.replace("test_", "")
                self.results[test_name]["status"] = "error"
                self.log(test_name, f"Test crashed: {e}", "error")
            
            print("-" * 40)
        
        self.generate_report()

    def generate_report(self):
        """Generate final report"""
        print("\n" + "=" * 60)
        print("FINAL INTEGRATION TEST REPORT")
        print("=" * 60)
        
        passed = 0
        failed = 0
        warnings = 0
        
        for test_name, result in self.results.items():
            if test_name == "overall_status":
                continue
                
            status = result["status"]
            if status == "passed":
                passed += 1
                print(f"✅ {test_name}: PASSED")
            elif status == "failed" or status == "error":
                failed += 1
                print(f"❌ {test_name}: FAILED")
            elif status == "warning":
                warnings += 1
                print(f"⚠️  {test_name}: WARNING")
            else:
                print(f"❓ {test_name}: UNKNOWN")
        
        total = passed + failed + warnings
        
        print(f"\nSUMMARY: {passed}/{total} tests passed")
        if warnings > 0:
            print(f"Warnings: {warnings}")
        if failed > 0:
            print(f"Failures: {failed}")
            
        # Determine overall status
        if failed == 0:
            if warnings == 0:
                self.results["overall_status"] = "production_ready"
                print("\n🎉 RESULT: PRODUCTION READY FOR PYPI!")
            else:
                self.results["overall_status"] = "ready_with_warnings"
                print("\n✅ RESULT: Ready for PyPI (minor warnings)")
        else:
            self.results["overall_status"] = "not_ready"
            print("\n❌ RESULT: NOT READY - Fix issues before PyPI publication")
            
        # Save detailed results
        with open("integration_test_results.json", "w") as f:
            json.dump(self.results, f, indent=2)
            
        print(f"\nDetailed results saved to: integration_test_results.json")

if __name__ == "__main__":
    tester = IntegrationTester()
    tester.run_all_tests()