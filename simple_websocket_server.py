#!/usr/bin/env python3
"""
Robust WebSocket server for testing React dashboard integration
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SimpleAgentServer:
    def __init__(self):
        self.clients = set()
        self.agents = {}
        self.tasks = {}
        self.client_counter = 0
    
    async def register_client(self, websocket):
        """Register a new client"""
        self.clients.add(websocket)
        self.client_counter += 1
        client_id = f"client-{self.client_counter}"
        websocket.client_id = client_id
        logger.info(f"Client {client_id} connected from {websocket.remote_address}")
        return client_id
    
    async def unregister_client(self, websocket):
        """Unregister a client"""
        self.clients.discard(websocket)
        client_id = getattr(websocket, 'client_id', 'unknown')
        logger.info(f"Client {client_id} disconnected")
    
    async def broadcast_message(self, message_dict, exclude_client=None):
        """Broadcast message to all clients except the excluded one"""
        if not self.clients:
            return
        
        message_json = json.dumps(message_dict)
        clients_to_send = [
            client for client in self.clients 
            if client != exclude_client and not client.closed
        ]
        
        if clients_to_send:
            results = await asyncio.gather(
                *[self.send_to_client(client, message_json) for client in clients_to_send],
                return_exceptions=True
            )
            
            # Log any failures
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.warning(f"Failed to send to client: {result}")
    
    async def send_to_client(self, websocket, message):
        """Send message to a specific client"""
        try:
            await websocket.send(message)
            return True
        except websockets.exceptions.ConnectionClosed:
            logger.warning("Tried to send to closed connection")
            self.clients.discard(websocket)
            return False
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return False
    
    async def handle_message(self, websocket, raw_message):
        """Handle incoming message from client"""
        try:
            # Parse message
            if isinstance(raw_message, bytes):
                raw_message = raw_message.decode('utf-8')
            
            try:
                data = json.loads(raw_message)
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                await self.send_error_response(websocket, "invalid_json", f"JSON decode error: {e}")
                return
            
            # Extract message details
            msg_type = data.get('type', 'unknown')
            msg_id = data.get('id', f"msg-{datetime.now().timestamp()}")
            correlation_id = data.get('correlation_id', msg_id)
            payload = data.get('payload', {})
            
            logger.info(f"Handling message type: {msg_type}")
            
            # Handle different message types
            if msg_type == 'ping':
                await self.handle_ping(websocket, data)
            
            elif msg_type == 'agent:create':
                await self.handle_agent_create(websocket, data)
            
            elif msg_type == 'command:execute':
                await self.handle_command_execute(websocket, data)
            
            elif msg_type == 'task:assign':
                await self.handle_task_assign(websocket, data)
            
            elif msg_type == 'system:status':
                await self.handle_system_status(websocket, data)
            
            elif msg_type == 'connection:ping':
                await self.handle_connection_ping(websocket, data)
            
            else:
                logger.warning(f"Unknown message type: {msg_type}")
                await self.send_error_response(
                    websocket, "unknown_message_type", f"Unknown message type: {msg_type}", correlation_id
                )
        
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            await self.send_error_response(websocket, "processing_error", str(e))
    
    async def handle_ping(self, websocket, data):
        """Handle ping message"""
        pong = {
            'id': f"pong-{datetime.now().timestamp()}",
            'type': 'pong',
            'timestamp': datetime.now().isoformat(),
            'payload': {'timestamp': data.get('timestamp', datetime.now().isoformat())}
        }
        await self.send_to_client(websocket, json.dumps(pong))
    
    async def handle_agent_create(self, websocket, data):
        """Handle agent creation"""
        try:
            payload = data.get('payload', {})
            agent_type = payload.get('agent_type', 'worker')
            model = payload.get('model', 'sonnet')
            capabilities = payload.get('capabilities', [])
            
            # Create agent
            agent_id = f"agent-{len(self.agents) + 1}-{int(datetime.now().timestamp())}"
            agent_info = {
                'id': agent_id,
                'type': agent_type,
                'status': 'idle',
                'created_at': datetime.now().isoformat(),
                'last_activity': datetime.now().isoformat(),
                'model': model,
                'capabilities': capabilities,
                'metrics': {
                    'tasks_completed': 0,
                    'avg_response_time': 1.2,
                    'success_rate': 1.0,
                    'tokens_used': 0
                }
            }
            
            self.agents[agent_id] = agent_info
            
            # Send success response
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
            
            await self.send_to_client(websocket, json.dumps(response))
            
            # Broadcast agent creation
            broadcast = {
                'id': f"broadcast-{datetime.now().timestamp()}",
                'type': 'agent:created',
                'timestamp': datetime.now().isoformat(),
                'payload': {'agent': agent_info}
            }
            await self.broadcast_message(broadcast, exclude_client=websocket)
            
        except Exception as e:
            logger.error(f"Error creating agent: {e}")
            await self.send_error_response(websocket, "agent_create_error", str(e), data.get('correlation_id'))
    
    async def handle_command_execute(self, websocket, data):
        """Handle command execution"""
        try:
            payload = data.get('payload', {})
            command = payload.get('command')
            agent_id = payload.get('agent_id')
            parameters = payload.get('parameters', {})
            
            if not command or not agent_id:
                await self.send_error_response(websocket, "missing_parameters", "Command and agent_id required", data.get('correlation_id'))
                return
            
            # Simulate command execution
            await asyncio.sleep(1)  # Simulate processing time
            
            result = f"Successfully executed command: '{command}' on agent {agent_id}"
            
            response = {
                'id': data.get('correlation_id', data.get('id')),
                'type': 'command:result',
                'timestamp': datetime.now().isoformat(),
                'payload': {
                    'result': result,
                    'command': command,
                    'agent_id': agent_id,
                    'execution_time': 1.0
                },
                'correlation_id': data.get('correlation_id')
            }
            
            await self.send_to_client(websocket, json.dumps(response))
            
        except Exception as e:
            logger.error(f"Error executing command: {e}")
            await self.send_error_response(websocket, "command_execute_error", str(e), data.get('correlation_id'))
    
    async def handle_task_assign(self, websocket, data):
        """Handle task assignment"""
        try:
            payload = data.get('payload', {})
            task_data = payload.get('task', {})
            agent_id = payload.get('agent_id')
            
            # Create task
            task_id = task_data.get('id', f"task-{len(self.tasks) + 1}")
            task_info = {
                'id': task_id,
                'title': task_data.get('title', 'Untitled Task'),
                'description': task_data.get('description', ''),
                'assigned_agent': agent_id,
                'status': 'pending',
                'created_at': datetime.now().isoformat(),
                'progress': 0.0,
                'metadata': task_data.get('metadata', {})
            }
            
            self.tasks[task_id] = task_info
            
            # Send assignment response
            response = {
                'id': data.get('correlation_id', data.get('id')),
                'type': 'command:result',
                'timestamp': datetime.now().isoformat(),
                'payload': {
                    'task_id': task_id,
                    'assigned': True,
                    'agent_id': agent_id
                },
                'correlation_id': data.get('correlation_id')
            }
            
            await self.send_to_client(websocket, json.dumps(response))
            
            # Start task execution simulation
            asyncio.create_task(self.simulate_task_execution(task_info))
            
        except Exception as e:
            logger.error(f"Error assigning task: {e}")
            await self.send_error_response(websocket, "task_assign_error", str(e), data.get('correlation_id'))
    
    async def handle_system_status(self, websocket, data):
        """Handle system status request"""
        try:
            status = {
                'agents': {
                    'total': len(self.agents),
                    'by_status': {'idle': len([a for a in self.agents.values() if a['status'] == 'idle'])},
                    'by_type': {'worker': len(self.agents)}
                },
                'tasks': {
                    'total': len(self.tasks),
                    'queued': 0,
                    'by_status': {
                        'completed': len([t for t in self.tasks.values() if t['status'] == 'completed']),
                        'pending': len([t for t in self.tasks.values() if t['status'] == 'pending'])
                    }
                },
                'statistics': {
                    'uptime': 3600,
                    'agents_created': len(self.agents),
                    'tasks_completed': len([t for t in self.tasks.values() if t['status'] == 'completed'])
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
            
            await self.send_to_client(websocket, json.dumps(response))
            
        except Exception as e:
            logger.error(f"Error getting system status: {e}")
            await self.send_error_response(websocket, "system_status_error", str(e), data.get('correlation_id'))
    
    async def handle_connection_ping(self, websocket, data):
        """Handle connection ping"""
        pong = {
            'id': f"pong-{datetime.now().timestamp()}",
            'type': 'connection:pong',
            'timestamp': datetime.now().isoformat(),
            'payload': {
                'original_timestamp': data.get('payload', {}).get('timestamp'),
                'response_timestamp': datetime.now().isoformat()
            }
        }
        await self.send_to_client(websocket, json.dumps(pong))
    
    async def simulate_task_execution(self, task_info):
        """Simulate task execution with updates"""
        try:
            task_id = task_info['id']
            
            # Start task
            await asyncio.sleep(2)
            task_info['status'] = 'in_progress'
            task_info['started_at'] = datetime.now().isoformat()
            task_info['progress'] = 0.3
            
            update_msg = {
                'id': f"task-update-{datetime.now().timestamp()}",
                'type': 'task:update',
                'timestamp': datetime.now().isoformat(),
                'payload': {'task': task_info}
            }
            await self.broadcast_message(update_msg)
            
            # Progress update
            await asyncio.sleep(2)
            task_info['progress'] = 0.7
            
            update_msg = {
                'id': f"task-progress-{datetime.now().timestamp()}",
                'type': 'task:update', 
                'timestamp': datetime.now().isoformat(),
                'payload': {'task': task_info}
            }
            await self.broadcast_message(update_msg)
            
            # Complete task
            await asyncio.sleep(2)
            task_info['status'] = 'completed'
            task_info['completed_at'] = datetime.now().isoformat()
            task_info['progress'] = 1.0
            task_info['result'] = f"Task '{task_info['title']}' completed successfully!"
            
            complete_msg = {
                'id': f"task-complete-{datetime.now().timestamp()}",
                'type': 'task:complete',
                'timestamp': datetime.now().isoformat(),
                'payload': {'task': task_info}
            }
            await self.broadcast_message(complete_msg)
            
        except Exception as e:
            logger.error(f"Error simulating task execution: {e}")
    
    async def send_error_response(self, websocket, error_code, error_message, correlation_id=None):
        """Send error response to client"""
        error_response = {
            'id': f"error-{datetime.now().timestamp()}",
            'type': 'connection:error',
            'timestamp': datetime.now().isoformat(),
            'payload': {
                'error_code': error_code,
                'error_message': error_message
            },
            'correlation_id': correlation_id
        }
        await self.send_to_client(websocket, json.dumps(error_response))
    
    async def handler(self, websocket, path):
        """Main WebSocket handler"""
        client_id = await self.register_client(websocket)
        
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client {client_id} connection closed normally")
        except Exception as e:
            logger.error(f"Error in handler for client {client_id}: {e}")
        finally:
            await self.unregister_client(websocket)

async def main():
    """Start the WebSocket server"""
    server_instance = SimpleAgentServer()
    
    logger.info("Starting WebSocket server...")
    logger.info("Server URL: ws://localhost:8765")
    logger.info("Press Ctrl+C to stop")
    
    try:
        # Start the server
        async with websockets.serve(
            server_instance.handler,
            "localhost",
            8765,
            ping_interval=None,  # Disable automatic ping/pong
            ping_timeout=None,
            max_size=10 * 1024 * 1024,  # 10MB max message size
            compression=None
        ):
            logger.info("WebSocket server started successfully!")
            await asyncio.Future()  # Run forever
            
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())