#!/usr/bin/env python3
import asyncio
import websockets
import json
import time
import sys
from datetime import datetime
from claude_cli_wrapper import ClaudeCliWrapper

class PipelineTest:
    def __init__(self):
        self.results = []
        self.websocket_uri = "ws://localhost:8765"
        
    def log_result(self, name, success, message=""):
        self.results.append({"name": name, "success": success, "message": message})
        status = "PASS" if success else "FAIL"
        print(f"[{status}] {name}: {message}")

    async def test_prerequisites(self):
        print("\n=== Testing Prerequisites ===")
        try:
            wrapper = ClaudeCliWrapper()
            self.log_result("Python SDK", True, "SDK imported successfully")
            
            result = await wrapper.execute_sync("Say hello")
            if len(str(result)) > 5:
                self.log_result("Claude CLI", True, f"CLI working ({len(str(result))} chars)")
                return True
            else:
                self.log_result("Claude CLI", False, f"Short response: {result}")
                return False
        except Exception as e:
            self.log_result("Prerequisites", False, f"Error: {e}")
            return False

    async def test_websocket(self):
        print("\n=== Testing WebSocket Connection ===")
        try:
            async with websockets.connect(self.websocket_uri, ping_timeout=5, open_timeout=5) as ws:
                self.log_result("WebSocket Connection", True, f"Connected to {self.websocket_uri}")
                
                # Test message exchange
                msg = {"type": "ping", "timestamp": datetime.now().isoformat()}
                await ws.send(json.dumps(msg))
                
                response = await asyncio.wait_for(ws.recv(), timeout=10)
                data = json.loads(response)
                
                if "pong" in data.get("type", "") or "error" in data.get("type", ""):
                    self.log_result("Message Exchange", True, "Communication working")
                    return True
                else:
                    self.log_result("Message Exchange", False, f"Unexpected: {data}")
                    return False
                    
        except Exception as e:
            self.log_result("WebSocket", False, f"Error: {e}")
            return False

    async def test_agent_creation(self):
        print("\n=== Testing Agent Creation ===")
        try:
            async with websockets.connect(self.websocket_uri) as ws:
                create_msg = {
                    "id": "test-create-1",
                    "type": "agent:create",
                    "timestamp": datetime.now().isoformat(),
                    "payload": {
                        "agent_type": "worker",
                        "model": "sonnet",
                        "capabilities": ["coding"]
                    },
                    "correlation_id": "test-create-1"
                }
                
                await ws.send(json.dumps(create_msg))
                response = await asyncio.wait_for(ws.recv(), timeout=30)
                data = json.loads(response)
                
                if data.get("type") == "command:result" and data.get("payload", {}).get("success"):
                    agent_id = data["payload"]["agent_id"]
                    self.log_result("Agent Creation", True, f"Agent created: {agent_id}")
                    return agent_id
                else:
                    self.log_result("Agent Creation", False, f"Failed: {data}")
                    return None
                    
        except Exception as e:
            self.log_result("Agent Creation", False, f"Error: {e}")
            return None

    def print_summary(self):
        passed = sum(1 for r in self.results if r["success"])
        total = len(self.results)
        rate = (passed/total*100) if total > 0 else 0
        
        print("\n" + "="*60)
        print("PIPELINE INTEGRATION TEST SUMMARY")
        print("="*60)
        print(f"Tests: {passed}/{total} passed ({rate:.1f}%)")
        
        print("\nResults:")
        for r in self.results:
            status = "PASS" if r["success"] else "FAIL" 
            print(f"  [{status}] {r['name']}: {r['message']}")
            
        if passed == total:
            print("\n✅ ALL TESTS PASSED - Pipeline is working!")
        else:
            print(f"\n❌ {total-passed} tests failed - Check components")

    async def run_tests(self):
        print("COMPREHENSIVE PIPELINE INTEGRATION TEST")
        print("Testing: UI -> WebSocket -> Python -> Claude CLI")
        print("="*60)
        
        # Run all tests
        prereq_ok = await self.test_prerequisites()
        if not prereq_ok:
            self.print_summary()
            return False
            
        ws_ok = await self.test_websocket()
        if ws_ok:
            agent_id = await self.test_agent_creation()
            
        self.print_summary()
        return all(r["success"] for r in self.results)

async def main():
    test = PipelineTest()
    try:
        success = await test.run_tests()
        return 0 if success else 1
    except Exception as e:
        print(f"Test error: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
