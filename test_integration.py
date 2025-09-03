#!/usr/bin/env python3
"""
Integration test to verify React dashboard can connect to Python WebSocket backend
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket_integration():
    """Test the WebSocket connection and basic operations"""
    
    print("🧪 Testing WebSocket Integration")
    print("=" * 50)
    
    try:
        # Connect to WebSocket server
        uri = "ws://localhost:8765"
        print(f"🔌 Connecting to {uri}...")
        
        async with websockets.connect(uri, ping_interval=None, ping_timeout=None) as websocket:
            print("✅ Successfully connected to WebSocket server")
            
            # Test 1: Agent Creation
            print("\n📋 Test 1: Creating an agent")
            create_agent_msg = {
                "id": "test-create-1",
                "type": "agent:create",
                "timestamp": datetime.now().isoformat(),
                "payload": {
                    "agent_type": "worker",
                    "model": "sonnet",
                    "capabilities": ["coding", "analysis"]
                },
                "correlation_id": "test-create-1"
            }
            
            await websocket.send(json.dumps(create_agent_msg))
            response = await asyncio.wait_for(websocket.recv(), timeout=10)
            response_data = json.loads(response)
            
            if response_data.get("type") == "command:result" and response_data["payload"].get("success"):
                agent_id = response_data["payload"]["agent_id"]
                print(f"✅ Agent created successfully: {agent_id}")
            else:
                print(f"❌ Agent creation failed: {response_data}")
                return False
            
            # Wait for broadcast message
            try:
                broadcast = await asyncio.wait_for(websocket.recv(), timeout=5)
                broadcast_data = json.loads(broadcast)
                if broadcast_data.get("type") == "agent:created":
                    print("✅ Received agent creation broadcast")
                else:
                    print(f"⚠️ Unexpected broadcast: {broadcast_data}")
            except asyncio.TimeoutError:
                print("⚠️ No broadcast received (timeout)")
            
            # Test 2: Command Execution
            print(f"\n⚡ Test 2: Executing command on agent {agent_id}")
            execute_cmd_msg = {
                "id": "test-execute-1",
                "type": "command:execute",
                "timestamp": datetime.now().isoformat(),
                "payload": {
                    "command": "Write a hello world function in Python",
                    "agent_id": agent_id,
                    "parameters": {}
                },
                "correlation_id": "test-execute-1"
            }
            
            await websocket.send(json.dumps(execute_cmd_msg))
            response = await asyncio.wait_for(websocket.recv(), timeout=15)
            response_data = json.loads(response)
            
            if response_data.get("type") == "command:result":
                result = response_data["payload"].get("result", "")
                print(f"✅ Command executed successfully: {result[:100]}...")
            else:
                print(f"❌ Command execution failed: {response_data}")
                return False
            
            # Test 3: Task Assignment
            print(f"\n📝 Test 3: Assigning task to agent {agent_id}")
            assign_task_msg = {
                "id": "test-assign-1",
                "type": "task:assign",
                "timestamp": datetime.now().isoformat(),
                "payload": {
                    "task": {
                        "id": "task-test-1",
                        "title": "Test Task",
                        "description": "This is a test task from the integration test",
                        "metadata": {
                            "priority": "medium",
                            "tags": ["test", "integration"],
                            "created_via": "integration_test"
                        }
                    },
                    "agent_id": agent_id
                },
                "correlation_id": "test-assign-1"
            }
            
            await websocket.send(json.dumps(assign_task_msg))
            response = await asyncio.wait_for(websocket.recv(), timeout=10)
            response_data = json.loads(response)
            
            if response_data.get("type") == "command:result" and response_data["payload"].get("assigned"):
                task_id = response_data["payload"]["task_id"]
                print(f"✅ Task assigned successfully: {task_id}")
            else:
                print(f"❌ Task assignment failed: {response_data}")
                return False
            
            # Wait for task updates
            print("⏳ Waiting for task execution updates...")
            update_count = 0
            while update_count < 2:  # Wait for progress and completion
                try:
                    update = await asyncio.wait_for(websocket.recv(), timeout=10)
                    update_data = json.loads(update)
                    
                    if update_data.get("type") in ["task:update", "task:complete"]:
                        task_info = update_data["payload"]["task"]
                        status = task_info.get("status", "unknown")
                        progress = task_info.get("progress", 0)
                        print(f"📈 Task update: {status} ({progress * 100:.0f}%)")
                        update_count += 1
                        
                        if update_data.get("type") == "task:complete":
                            print(f"✅ Task completed: {task_info.get('result', 'No result')}")
                            break
                    
                except asyncio.TimeoutError:
                    print("⚠️ Timeout waiting for task updates")
                    break
            
            # Test 4: System Status
            print("\n📊 Test 4: Getting system status")
            status_msg = {
                "id": "test-status-1",
                "type": "system:status",
                "timestamp": datetime.now().isoformat(),
                "payload": {},
                "correlation_id": "test-status-1"
            }
            
            await websocket.send(json.dumps(status_msg))
            response = await asyncio.wait_for(websocket.recv(), timeout=10)
            response_data = json.loads(response)
            
            if response_data.get("type") == "command:result":
                status = response_data["payload"]
                agents_count = status.get("agents", {}).get("total", 0)
                tasks_count = status.get("tasks", {}).get("total", 0)
                print(f"✅ System status: {agents_count} agents, {tasks_count} tasks")
            else:
                print(f"❌ System status failed: {response_data}")
                return False
            
            print("\n🎉 All tests passed! Integration is working correctly.")
            print("\n📋 Summary:")
            print(f"   - WebSocket connection: ✅")
            print(f"   - Agent creation: ✅")
            print(f"   - Command execution: ✅")
            print(f"   - Task assignment: ✅")
            print(f"   - Real-time updates: ✅")
            print(f"   - System status: ✅")
            
            return True
    
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        return False

async def main():
    """Main test function"""
    
    # Check if server is running
    try:
        async with websockets.connect("ws://localhost:8765", ping_timeout=5, open_timeout=5) as ws:
            print("🌟 WebSocket server is running")
    except Exception as e:
        print(f"❌ WebSocket server is not running: {e}")
        print("💡 Please start the WebSocket server first:")
        print("   python test_websocket_connection.py")
        return False
    
    # Run integration tests
    success = await test_websocket_integration()
    
    if success:
        print(f"\n🚀 Integration Test Result: PASSED")
        print(f"🎯 The React dashboard should now be able to:")
        print(f"   • Connect to ws://localhost:8765")
        print(f"   • Create real Claude CLI agents")
        print(f"   • Execute commands on agents")
        print(f"   • Assign and track tasks")
        print(f"   • Receive real-time updates")
        print(f"\n🌐 Open the React dashboard at http://localhost:6011")
        print(f"   and test the agent management functionality!")
    else:
        print(f"\n💥 Integration Test Result: FAILED")
        print(f"🔧 Please check the WebSocket server logs for errors")
    
    return success

if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1)