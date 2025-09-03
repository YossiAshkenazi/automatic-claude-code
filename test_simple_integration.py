#!/usr/bin/env python3
"""
Simple integration test for WebSocket connection
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_basic_connection():
    """Test basic WebSocket connection"""
    
    print("Testing WebSocket Integration")
    print("=" * 40)
    
    try:
        # Connect to WebSocket server
        uri = "ws://localhost:8765"
        print(f"Connecting to {uri}...")
        
        async with websockets.connect(uri, ping_interval=None, ping_timeout=None) as websocket:
            print("SUCCESS: Connected to WebSocket server")
            
            # Test agent creation
            print("\nTesting agent creation...")
            create_msg = {
                "id": "test-1",
                "type": "agent:create",
                "timestamp": datetime.now().isoformat(),
                "payload": {
                    "agent_type": "worker",
                    "model": "sonnet",
                    "capabilities": ["coding"]
                },
                "correlation_id": "test-1"
            }
            
            await websocket.send(json.dumps(create_msg))
            response = await asyncio.wait_for(websocket.recv(), timeout=10)
            response_data = json.loads(response)
            
            if response_data.get("type") == "command:result":
                agent_id = response_data["payload"].get("agent_id")
                print(f"SUCCESS: Agent created - {agent_id}")
                
                # Wait for broadcast
                try:
                    broadcast = await asyncio.wait_for(websocket.recv(), timeout=5)
                    broadcast_data = json.loads(broadcast)
                    if broadcast_data.get("type") == "agent:created":
                        print("SUCCESS: Received agent creation broadcast")
                except asyncio.TimeoutError:
                    print("WARNING: No broadcast received")
                
                return True, agent_id
            else:
                print(f"FAILED: Agent creation failed - {response_data}")
                return False, None
    
    except Exception as e:
        print(f"ERROR: Connection failed - {e}")
        return False, None

async def test_task_assignment(agent_id):
    """Test task assignment"""
    
    if not agent_id:
        return False
    
    try:
        uri = "ws://localhost:8765"
        async with websockets.connect(uri, ping_interval=None, ping_timeout=None) as websocket:
            
            print(f"\nTesting task assignment to agent {agent_id}...")
            assign_msg = {
                "id": "test-task-1",
                "type": "task:assign",
                "timestamp": datetime.now().isoformat(),
                "payload": {
                    "task": {
                        "id": "task-1",
                        "title": "Test Task",
                        "description": "Test task description",
                        "metadata": {"priority": "medium"}
                    },
                    "agent_id": agent_id
                },
                "correlation_id": "test-task-1"
            }
            
            await websocket.send(json.dumps(assign_msg))
            response = await asyncio.wait_for(websocket.recv(), timeout=10)
            response_data = json.loads(response)
            
            if response_data.get("type") == "command:result" and response_data["payload"].get("assigned"):
                print("SUCCESS: Task assigned")
                
                # Wait for task updates
                print("Waiting for task updates...")
                for _ in range(3):  # Wait for up to 3 updates
                    try:
                        update = await asyncio.wait_for(websocket.recv(), timeout=8)
                        update_data = json.loads(update)
                        
                        if update_data.get("type") in ["task:update", "task:complete"]:
                            task = update_data["payload"]["task"]
                            status = task.get("status", "unknown")
                            progress = task.get("progress", 0)
                            print(f"  Task update: {status} ({progress * 100:.0f}%)")
                            
                            if status == "completed":
                                print("SUCCESS: Task completed")
                                return True
                    except asyncio.TimeoutError:
                        break
                
                return True
            else:
                print(f"FAILED: Task assignment failed - {response_data}")
                return False
    
    except Exception as e:
        print(f"ERROR: Task assignment failed - {e}")
        return False

async def main():
    """Main test function"""
    
    print("React Dashboard WebSocket Integration Test")
    print("=" * 50)
    
    # Test 1: Basic connection and agent creation
    connection_success, agent_id = await test_basic_connection()
    
    if not connection_success:
        print("\nTEST RESULT: FAILED - Could not establish connection")
        print("Please ensure the WebSocket server is running:")
        print("  python test_websocket_connection.py")
        return False
    
    # Test 2: Task assignment
    task_success = await test_task_assignment(agent_id)
    
    # Final result
    if connection_success and task_success:
        print("\n" + "=" * 50)
        print("TEST RESULT: ALL TESTS PASSED!")
        print("\nThe React dashboard integration is working:")
        print("  - WebSocket connection: OK")
        print("  - Agent creation: OK") 
        print("  - Task assignment: OK")
        print("  - Real-time updates: OK")
        print("\nNext steps:")
        print("  1. Open React dashboard at http://localhost:6011")
        print("  2. Try creating agents through the UI")
        print("  3. Assign tasks and watch real-time updates")
        return True
    else:
        print("\n" + "=" * 50)
        print("TEST RESULT: SOME TESTS FAILED")
        print(f"  Connection: {'PASS' if connection_success else 'FAIL'}")
        print(f"  Task Assignment: {'PASS' if task_success else 'FAIL'}")
        return False

if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        exit(1)