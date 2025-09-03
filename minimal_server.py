#!/usr/bin/env python3

import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def echo(websocket, path):
    logger.info(f"Client connected: {websocket.remote_address}")
    
    try:
        async for message in websocket:
            logger.info(f"Received: {message}")
            
            try:
                data = json.loads(message)
                msg_type = data.get('type', 'unknown')
                
                if msg_type == 'agent:create':
                    # Send agent creation response
                    response = {
                        "id": data.get('correlation_id', 'test-id'),
                        "type": "command:result",
                        "timestamp": "2024-01-01T12:00:00Z",
                        "payload": {
                            "agent_id": "agent-123",
                            "agent_info": {
                                "id": "agent-123",
                                "type": "worker",
                                "status": "idle",
                                "created_at": "2024-01-01T12:00:00Z",
                                "last_activity": "2024-01-01T12:00:00Z",
                                "model": "sonnet",
                                "capabilities": ["coding"],
                                "metrics": {"tasks_completed": 0, "success_rate": 1.0}
                            },
                            "success": True
                        },
                        "correlation_id": data.get('correlation_id')
                    }
                    await websocket.send(json.dumps(response))
                    
                    # Send broadcast
                    broadcast = {
                        "type": "agent:created",
                        "payload": {"agent": response["payload"]["agent_info"]}
                    }
                    await websocket.send(json.dumps(broadcast))
                    
                elif msg_type == 'task:assign':
                    response = {
                        "id": data.get('correlation_id', 'task-id'),
                        "type": "command:result",
                        "payload": {
                            "task_id": "task-123", 
                            "assigned": True,
                            "agent_id": "agent-123"
                        },
                        "correlation_id": data.get('correlation_id')
                    }
                    await websocket.send(json.dumps(response))
                    
                else:
                    # Echo back for other messages
                    echo_response = {
                        "type": "echo",
                        "original": data,
                        "timestamp": "2024-01-01T12:00:00Z"
                    }
                    await websocket.send(json.dumps(echo_response))
                    
            except json.JSONDecodeError:
                await websocket.send('{"type":"error","message":"Invalid JSON"}')
                
    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected")

async def main():
    logger.info("Starting minimal WebSocket server on ws://localhost:8766")
    
    start_server = websockets.serve(echo, "localhost", 8766)
    await start_server
    
    logger.info("Server is running...")
    await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())