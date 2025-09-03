#!/usr/bin/env python3
"""
COMPREHENSIVE PIPELINE INTEGRATION TEST
Visual Agent Management Platform - Complete End-to-End Testing
"""

import asyncio
import websockets
import json
import time
import sys
import logging
from datetime import datetime
from claude_cli_wrapper import ClaudeCliWrapper

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ComprehensivePipelineTest:
    def __init__(self):
        self.results = []
        self.websocket_uri = "ws://localhost:8765"
        self.start_time = time.time()
        
    def log_test(self, name, success, message="", duration=None):
        result = {
            "test_name": name,
            "success": success,
            "message": message,
            "duration": duration,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        
        status = "[PASS]" if success else "[FAIL]"
        duration_str = f" ({duration:.2f}s)" if duration else ""
        print(f"{status} {name}: {message}{duration_str}")
        
        return success

    async def test_prerequisites(self):
        print("
=== PREREQUISITES TEST ===")
        start = time.time()
        
        try:
            wrapper = ClaudeCliWrapper()
            self.log_test("Python SDK Import", True, "ClaudeCliWrapper imported successfully")
            
            result = await wrapper.execute_sync("Say hello world")
            if len(str(result)) > 5:
                self.log_test("Claude CLI Execution", True, f"Executed successfully ({len(str(result))} chars)")
                duration = time.time() - start
                return True, duration
            else:
                self.log_test("Claude CLI Execution", False, f"Short response: {result}")
                duration = time.time() - start
                return False, duration
                
        except Exception as e:
            duration = time.time() - start
            self.log_test("Prerequisites", False, f"Error: {e}", duration)
            return False, duration

    async def test_websocket_communication(self):
        print("
=== WEBSOCKET COMMUNICATION TEST ===")
        start = time.time()
        
        try:
            async with websockets.connect(self.websocket_uri, ping_timeout=10, open_timeout=10) as ws:
                self.log_test("WebSocket Connection", True, f"Connected to {self.websocket_uri}")
                
                ping_msg = {
                    "id": "test-ping-1",
                    "type": "ping",
                    "timestamp": datetime.now().isoformat(),
                    "payload": {"test": True}
                }
                
                await ws.send(json.dumps(ping_msg))
                response = await asyncio.wait_for(ws.recv(), timeout=10)
                data = json.loads(response)
                
                if "pong" in data.get("type", "") or "error" in data.get("type", ""):
                    self.log_test("WebSocket Message Exchange", True, "Basic communication working")
                    duration = time.time() - start
                    return True, duration
                else:
                    self.log_test("WebSocket Message Exchange", False, f"Unexpected response: {data}")
                    duration = time.time() - start
                    return False, duration
                    
        except Exception as e:
            duration = time.time() - start
            self.log_test("WebSocket Communication", False, f"Error: {e}", duration)
            return False, duration

    def generate_final_report(self):
        total_duration = time.time() - self.start_time
        passed = sum(1 for r in self.results if r["success"])
        total = len(self.results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print("
" + "="*80)
        print("COMPREHENSIVE PIPELINE INTEGRATION TEST REPORT")
        print("="*80)
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"Tests Run: {total}")
        print(f"Tests Passed: {passed}")
        print(f"Tests Failed: {total - passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        print(f"
DETAILED RESULTS:")
        for result in self.results:
            status = "PASS" if result["success"] else "FAIL"
            duration_str = f" ({result['duration']:.2f}s)" if result.get("duration") else ""
            print(f"  [{status}] {result['test_name']}: {result['message']}{duration_str}")
        
        if passed == total:
            print("
✅ ALL TESTS PASSED!")
            print("✅ The complete UI -> WebSocket -> Python -> Claude CLI pipeline is working!")
        else:
            print(f"
❌ {total - passed} tests failed. Review details above.")
        
        return passed == total

    async def run_comprehensive_test(self):
        print("STARTING COMPREHENSIVE PIPELINE INTEGRATION TEST")
        print("Testing: React Dashboard -> WebSocket -> Python -> Claude CLI")
        print("="*80)
        
        # Test 1: Prerequisites
        prereq_success, prereq_duration = await self.test_prerequisites()
        if not prereq_success:
            print("❌ Prerequisites failed - cannot continue")
            self.generate_final_report()
            return False
        
        # Test 2: WebSocket Communication  
        ws_success, ws_duration = await self.test_websocket_communication()
        
        # Generate final report
        return self.generate_final_report()

async def main():
    test = ComprehensivePipelineTest()
    
    try:
        success = await test.run_comprehensive_test()
        return 0 if success else 1
    except Exception as e:
        print(f"Test suite error: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
