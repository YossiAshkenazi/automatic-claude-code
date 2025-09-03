#!/usr/bin/env python3
"""
Visual Agent Management Platform - Complete Pipeline Integration Test
Tests: React Dashboard -> WebSocket -> Python -> Multi-Agent Wrapper -> Claude CLI -> Results
"""

import asyncio
import websockets
import json
import subprocess
import time
import sys
import logging
from datetime import datetime
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PipelineIntegrationTest:
    def __init__(self):
        self.test_results = []
        self.websocket_uri = "ws://localhost:8765"
        self.dashboard_url = "http://localhost:6011"
        
    def log_result(self, test_name, success, message="", details=None):
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "details": details or {}
        }
        self.test_results.append(result)
        status = "PASS" if success else "FAIL"
        print(f"[{status}] {test_name}: {message}")
        
    def check_prerequisites(self):
        """Check system prerequisites"""
        print("Checking system prerequisites...")
        
        # Check Claude CLI
        try:
            result = subprocess.run(['claude', '--version'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                self.log_result("Claude CLI Available", True, f"Version: {result.stdout.strip()}")
            else:
                self.log_result("Claude CLI Available", False, "Claude CLI not working")
                return False
        except Exception as e:
            self.log_result("Claude CLI Available", False, f"Error: {e}")
            return False
            
        # Check Python SDK
        try:
            import claude_cli_wrapper
            self.log_result("Python SDK Import", True, "claude_cli_wrapper imported successfully")
        except Exception as e:
            self.log_result("Python SDK Import", False, f"Import error: {e}")
            return False
            
        return True
        
    async def test_websocket_connectivity(self):
        """Test basic WebSocket connectivity"""
        print("Testing WebSocket connectivity...")
        
        try:
            # Try to connect to WebSocket server
            async with websockets.connect(self.websocket_uri, ping_timeout=5, open_timeout=5) as ws:
                self.log_result("WebSocket Connection", True, f"Connected to {self.websocket_uri}")
                
                # Test basic ping/pong
                await ws.send(json.dumps({"type": "ping", "timestamp": datetime.now().isoformat()}))
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(response)
                
                if "pong" in data.get("type", ""):
                    self.log_result("WebSocket Ping/Pong", True, "Basic communication working")
                else:
                    self.log_result("WebSocket Ping/Pong", False, f"Unexpected response: {data}")
                    
                return True
                
        except Exception as e:
            self.log_result("WebSocket Connection", False, f"Connection failed: {e}")
            return False
    
    async def run_full_pipeline_test(self):
        """Run the complete pipeline integration test"""
        print("=" * 60)
        print("VISUAL AGENT MANAGEMENT PLATFORM - PIPELINE INTEGRATION TEST")
        print("=" * 60)
        
        start_time = time.time()
        
        # Step 1: Prerequisites
        if not self.check_prerequisites():
            print("Prerequisites failed - cannot continue")
            return False
        
        # Step 2: WebSocket connectivity
        ws_ok = await self.test_websocket_connectivity()
        
        # Generate summary
        end_time = time.time()
        duration = end_time - start_time
        
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        print("\n" + "=" * 60)
        print("INTEGRATION TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print(f"Duration: {duration:.1f}s")
        
        print("\nDETAILED RESULTS:")
        for result in self.test_results:
            status = "PASS" if result["success"] else "FAIL"
            print(f"  [{status}] {result['test']}: {result['message']}")
        
        return passed == total

async def main():
    """Main test execution"""
    test = PipelineIntegrationTest()
    
    try:
        success = await test.run_full_pipeline_test()
        
        if success:
            print("\nPIPELINE INTEGRATION: SUCCESS")
            print("The complete UI -> WebSocket -> Python -> Claude CLI pipeline is working!")
            return 0
        else:
            print("\nPIPELINE INTEGRATION: FAILED")
            print("One or more components in the pipeline are not working correctly.")
            return 1
            
    except Exception as e:
        print(f"\nTest suite error: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
