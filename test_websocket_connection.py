#!/usr/bin/env python3
"""
Simple WebSocket server to test React dashboard connection
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleAgentServer:
    def __init__(self):
        self.clients = set()
        self.agents = {}
        self.tasks = {}
    
    async def register(self, websocket):
        self.clients.add(websocket)
        logger.info(f"Client connected: {websocket.remote_address}")
    
    async def unregister(self, websocket):
        self.clients.discard(websocket)
        logger.info(f"Client disconnected: {websocket.remote_address}")
    
    async def broadcast(self, message):
        if self.clients:
            await asyncio.gather(
                *[client.send(message) for client in self.clients],
                return_exceptions=True
            )
    
    async def handle_message(self, websocket, message):
        try:
            data = json.loads(message)
            msg_type = data.get('type')
            
            logger.info(f"Received message: {msg_type}")
            
            if msg_type == 'agent:create':
                # Mock agent creation
                agent_id = f"agent-{len(self.agents) + 1}"
                agent_info = {
                    'id': agent_id,
                    'type': data['payload'].get('agent_type', 'worker'),
                    'status': 'idle',
                    'created_at': datetime.now().isoformat(),
                    'last_activity': datetime.now().isoformat(),
                    'model': data['payload'].get('model', 'sonnet'),
                    'capabilities': data['payload'].get('capabilities', []),
                    'metrics': {
                        'tasks_completed': 0,
                        'avg_response_time': 0,
                        'success_rate': 1.0,
                        'tokens_used': 0
                    }
                }
                
                self.agents[agent_id] = agent_info
                
                # Send response
                response = {
                    'id': data.get('correlation_id', data.get('id')),
                    'type': 'command:result',
                    'timestamp': datetime.now().isoformat(),
                    'payload': {
                        'agent_id': agent_id,
                        'agent_info': agent_info,
                        'success': True
                    },
                    'correlation_id': data.get('correlation_id')
                }
                
                await websocket.send(json.dumps(response))
                
                # Broadcast agent created
                broadcast_msg = {
                    'id': f"broadcast-{datetime.now().timestamp()}",
                    'type': 'agent:created',
                    'timestamp': datetime.now().isoformat(),
                    'payload': {'agent': agent_info}
                }
                await self.broadcast(json.dumps(broadcast_msg))
            
            elif msg_type == 'command:execute':
                # Mock command execution
                payload = data.get('payload', {})
                agent_id = payload.get('agent_id')
                command = payload.get('command')
                
                # Simulate execution time
                await asyncio.sleep(1)
                
                result = f"Executed command '{command}' on agent {agent_id} successfully!"
                
                response = {
                    'id': data.get('correlation_id', data.get('id')),
                    'type': 'command:result',
                    'timestamp': datetime.now().isoformat(),
                    'payload': {
                        'result': result,
                        'command': command,
                        'agent_id': agent_id
                    },
                    'correlation_id': data.get('correlation_id')
                }
                
                await websocket.send(json.dumps(response))
            
            elif msg_type == 'task:assign':
                # Mock task assignment
                payload = data.get('payload', {})
                task_data = payload.get('task', {})
                agent_id = payload.get('agent_id')
                
                task_info = {
                    'id': task_data.get('id', f"task-{len(self.tasks) + 1}"),
                    'title': task_data.get('title', 'Untitled Task'),
                    'description': task_data.get('description', ''),
                    'assigned_agent': agent_id,
                    'status': 'pending',
                    'created_at': datetime.now().isoformat(),
                    'progress': 0.0,
                    'metadata': task_data.get('metadata', {})
                }
                
                self.tasks[task_info['id']] = task_info
                
                response = {
                    'id': data.get('correlation_id', data.get('id')),
                    'type': 'command:result',
                    'timestamp': datetime.now().isoformat(),
                    'payload': {
                        'task_id': task_info['id'],
                        'assigned': True,
                        'agent_id': agent_id
                    },
                    'correlation_id': data.get('correlation_id')
                }
                
                await websocket.send(json.dumps(response))
                
                # Start mock task execution
                asyncio.create_task(self.execute_mock_task(task_info))
            
            elif msg_type == 'system:status':
                # Mock system status
                status = {
                    'agents': {
                        'total': len(self.agents),
                        'by_status': {'idle': len(self.agents)},
                        'by_type': {'worker': len(self.agents)}
                    },
                    'tasks': {
                        'total': len(self.tasks),
                        'queued': 0,
                        'by_status': {'completed': len(self.tasks)}
                    },
                    'statistics': {
                        'uptime': 3600,
                        'agents_created': len(self.agents),
                        'tasks_completed': len(self.tasks)
                    },
                    'running': True
                }
                
                response = {
                    'id': data.get('correlation_id', data.get('id')),
                    'type': 'command:result',
                    'timestamp': datetime.now().isoformat(),
                    'payload': status,
                    'correlation_id': data.get('correlation_id')
                }
                
                await websocket.send(json.dumps(response))
            
            elif msg_type == 'connection:ping':
                # Send pong
                pong = {
                    'id': f"pong-{datetime.now().timestamp()}",
                    'type': 'connection:pong',
                    'timestamp': datetime.now().isoformat(),
                    'payload': {
                        'original_timestamp': data['payload'].get('timestamp'),
                        'response_timestamp': datetime.now().isoformat()
                    }
                }
                
                await websocket.send(json.dumps(pong))
        
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            error_response = {
                'type': 'connection:error',
                'timestamp': datetime.now().isoformat(),
                'payload': {'error_message': str(e)},
                'correlation_id': data.get('correlation_id') if 'data' in locals() else None
            }
            await websocket.send(json.dumps(error_response))
    
    async def execute_mock_task(self, task_info):
        """Simulate task execution"""
        await asyncio.sleep(2)  # Simulate work
        
        # Update task status
        task_info['status'] = 'in_progress'
        task_info['started_at'] = datetime.now().isoformat()
        task_info['progress'] = 0.5
        
        # Broadcast task update
        update_msg = {
            'id': f"task-update-{datetime.now().timestamp()}",
            'type': 'task:update',
            'timestamp': datetime.now().isoformat(),
            'payload': {'task': task_info}
        }
        await self.broadcast(json.dumps(update_msg))
        
        # Finish task
        await asyncio.sleep(3)
        task_info['status'] = 'completed'
        task_info['completed_at'] = datetime.now().isoformat()
        task_info['progress'] = 1.0
        task_info['result'] = f"Task '{task_info['title']}' completed successfully!"
        
        # Broadcast task completion
        complete_msg = {
            'id': f"task-complete-{datetime.now().timestamp()}",
            'type': 'task:complete',
            'timestamp': datetime.now().isoformat(),
            'payload': {'task': task_info}
        }
        await self.broadcast(json.dumps(complete_msg))
    
    async def handler(self, websocket, path):
        await self.register(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister(websocket)

async def main():
    server = SimpleAgentServer()
    
    logger.info("🚀 Starting test WebSocket server...")
    logger.info("📡 WebSocket URL: ws://localhost:8765")
    logger.info("🎯 Dashboard can now connect to this server")
    logger.info("Press Ctrl+C to stop the server")
    
    start_server = websockets.serve(server.handler, "localhost", 8765)
    
    try:
        await start_server
        await asyncio.Future()  # Run forever
    except KeyboardInterrupt:
        logger.info("Server stopped by user")

if __name__ == "__main__":
    asyncio.run(main())