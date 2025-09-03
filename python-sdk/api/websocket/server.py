"""
WebSocket server for real-time bi-directional communication between
Python agent orchestrator and React dashboard.
"""

import asyncio
import logging
import json
import uuid
from typing import Optional, Dict, Any, Set
from datetime import datetime
import websockets
from websockets.server import WebSocketServerProtocol, serve
from websockets.exceptions import WebSocketException, ConnectionClosed

from .message_protocol import Message, MessageType, MessageProtocol, AgentType, TaskInfo
from .connection_manager import ConnectionManager
from .agent_manager import AgentManager


logger = logging.getLogger(__name__)


class WebSocketServer:
    """
    WebSocket server providing real-time bi-directional communication
    between Python agent orchestrator and React dashboard.
    
    Features:
    - Agent management (create, stop, monitor)
    - Task assignment and execution
    - Real-time status updates
    - Inter-agent communication
    - Command execution from UI
    - Error handling and recovery
    - Connection health monitoring
    """
    
    def __init__(
        self,
        host: str = "localhost", 
        port: int = 8765,
        ping_interval: int = 30,
        ping_timeout: int = 10
    ):
        self.host = host
        self.port = port
        self.server = None
        self.running = False
        
        # Core managers
        self.connection_manager = ConnectionManager(ping_interval, ping_timeout)
        self.agent_manager = AgentManager()
        
        # Setup message handlers
        self._setup_message_handlers()
        
        logger.info(f"WebSocket server configured for {host}:{port}")
    
    async def start(self):
        """Start the WebSocket server"""
        if self.running:
            return
        
        # Start managers
        await self.connection_manager.start()
        await self.agent_manager.start()
        
        # Start WebSocket server
        self.server = await serve(
            self._handle_client,
            self.host,
            self.port,
            ping_interval=None,  # We handle our own ping/pong
            ping_timeout=None,
            max_size=10 * 1024 * 1024,  # 10MB max message size
            compression=None  # Disable compression for lower latency
        )
        
        self.running = True
        logger.info(f"WebSocket server started on ws://{self.host}:{self.port}")
    
    async def stop(self):
        """Stop the WebSocket server"""
        if not self.running:
            return
        
        self.running = False
        
        # Stop WebSocket server
        if self.server:
            self.server.close()
            await self.server.wait_closed()
        
        # Stop managers
        await self.agent_manager.stop()
        await self.connection_manager.stop()
        
        logger.info("WebSocket server stopped")
    
    async def _handle_client(self, websocket: WebSocketServerProtocol, path: str):
        """Handle new client connection"""
        client_id = str(uuid.uuid4())
        client_type = "dashboard"  # Default type, can be overridden by client
        
        try:
            # Register client
            client = await self.connection_manager.connect_client(
                websocket, client_id, client_type
            )
            
            logger.info(f"Client {client_id} connected from {websocket.remote_address}")
            
            # Handle messages from this client
            async for raw_message in websocket:
                try:
                    # Parse message
                    if isinstance(raw_message, bytes):
                        raw_message = raw_message.decode('utf-8')
                    
                    message_data = json.loads(raw_message)
                    
                    if not MessageProtocol.validate_message(message_data):
                        error_msg = MessageProtocol.create_error_message(
                            "validation_error",
                            "Invalid message format",
                            correlation_id=message_data.get('id')
                        )
                        await self.connection_manager.send_to_client(client_id, error_msg)
                        continue
                    
                    message = Message.from_dict(message_data)
                    
                    # Handle message
                    await self.connection_manager.handle_message(client_id, message)
                    
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error from {client_id}: {e}")
                    error_msg = MessageProtocol.create_error_message(
                        "json_error",
                        f"Invalid JSON: {str(e)}"
                    )
                    await self.connection_manager.send_to_client(client_id, error_msg)
                
                except Exception as e:
                    logger.error(f"Error handling message from {client_id}: {e}")
                    error_msg = MessageProtocol.create_error_message(
                        "processing_error",
                        f"Message processing error: {str(e)}"
                    )
                    await self.connection_manager.send_to_client(client_id, error_msg)
        
        except ConnectionClosed:
            logger.info(f"Client {client_id} disconnected")
        
        except WebSocketException as e:
            logger.error(f"WebSocket error for client {client_id}: {e}")
        
        except Exception as e:
            logger.error(f"Unexpected error handling client {client_id}: {e}")
        
        finally:
            # Clean up client
            await self.connection_manager.disconnect_client(
                client_id, "Connection closed"
            )
    
    def _setup_message_handlers(self):
        """Setup message handlers for different message types"""
        
        # Agent management handlers
        self.connection_manager.register_message_handler(
            MessageType.AGENT_CREATE, self._handle_agent_create
        )
        
        # Command execution handlers
        self.connection_manager.register_message_handler(
            MessageType.COMMAND_EXECUTE, self._handle_command_execute
        )
        
        # Task management handlers
        self.connection_manager.register_message_handler(
            MessageType.TASK_ASSIGN, self._handle_task_assign
        )
        
        # System status handlers
        self.connection_manager.register_message_handler(
            MessageType.SYSTEM_STATUS, self._handle_system_status
        )
        
        # Agent manager handlers
        self.agent_manager.register_message_handler(
            MessageType.AGENT_STATUS, self._broadcast_agent_status
        )
        
        self.agent_manager.register_message_handler(
            MessageType.TASK_UPDATE, self._broadcast_task_update
        )
    
    async def _handle_agent_create(self, client_id: str, message: Message):
        """Handle agent creation request"""
        try:
            payload = message.payload
            agent_type_str = payload.get('agent_type', 'worker')
            model = payload.get('model', 'sonnet')
            capabilities = payload.get('capabilities', [])
            
            # Validate agent type
            try:
                agent_type = AgentType(agent_type_str)
            except ValueError:
                error_msg = MessageProtocol.create_error_message(
                    "validation_error",
                    f"Invalid agent type: {agent_type_str}",
                    correlation_id=message.correlation_id
                )
                await self.connection_manager.send_to_client(client_id, error_msg)
                return
            
            # Create agent
            agent_id = await self.agent_manager.create_agent(
                agent_type, model, capabilities
            )
            
            # Get agent info
            agent_info = self.agent_manager.get_agent_status(agent_id)
            
            # Send success response
            response = MessageProtocol.create_command_result_message(
                "create_agent",
                {
                    'agent_id': agent_id,
                    'agent_info': agent_info,
                    'success': True
                },
                "system",
                message.correlation_id
            )
            
            await self.connection_manager.send_to_client(client_id, response)
            
            # Broadcast agent creation to all clients
            broadcast_msg = Message.create(
                MessageType.AGENT_CREATED,
                {'agent': agent_info},
                source="system"
            )
            await self.connection_manager.broadcast(broadcast_msg, exclude_clients={client_id})
            
        except Exception as e:
            logger.error(f"Error creating agent: {e}")
            error_msg = MessageProtocol.create_error_message(
                "agent_error",
                f"Failed to create agent: {str(e)}",
                correlation_id=message.correlation_id
            )
            await self.connection_manager.send_to_client(client_id, error_msg)
    
    async def _handle_command_execute(self, client_id: str, message: Message):
        """Handle command execution request"""
        try:
            payload = message.payload
            command = payload.get('command')
            agent_id = payload.get('agent_id')
            parameters = payload.get('parameters', {})
            
            if not command or not agent_id:
                error_msg = MessageProtocol.create_error_message(
                    "validation_error",
                    "Command and agent_id are required",
                    correlation_id=message.correlation_id
                )
                await self.connection_manager.send_to_client(client_id, error_msg)
                return
            
            # Send progress update
            progress_msg = Message.create(
                MessageType.COMMAND_PROGRESS,
                {
                    'command': command,
                    'agent_id': agent_id,
                    'status': 'executing',
                    'progress': 0.0
                },
                correlation_id=message.correlation_id
            )
            await self.connection_manager.send_to_client(client_id, progress_msg)
            
            # Execute command
            start_time = datetime.now()
            result = await self.agent_manager.execute_command(
                agent_id, command, parameters, message.correlation_id
            )
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Send result
            result_msg = MessageProtocol.create_command_result_message(
                command, result, agent_id, message.correlation_id, execution_time
            )
            await self.connection_manager.send_to_client(client_id, result_msg)
            
        except Exception as e:
            logger.error(f"Error executing command: {e}")
            error_msg = MessageProtocol.create_error_message(
                "command_error",
                f"Command execution failed: {str(e)}",
                correlation_id=message.correlation_id
            )
            await self.connection_manager.send_to_client(client_id, error_msg)
    
    async def _handle_task_assign(self, client_id: str, message: Message):
        """Handle task assignment request"""
        try:
            payload = message.payload
            task_data = payload.get('task')
            agent_id = payload.get('agent_id')
            
            if not task_data:
                error_msg = MessageProtocol.create_error_message(
                    "validation_error",
                    "Task data is required",
                    correlation_id=message.correlation_id
                )
                await self.connection_manager.send_to_client(client_id, error_msg)
                return
            
            # Create task info
            task = TaskInfo(
                id=task_data.get('id', f"task-{int(datetime.now().timestamp())}"),
                title=task_data.get('title', 'Untitled Task'),
                description=task_data.get('description', ''),
                metadata=task_data.get('metadata', {})
            )
            
            # Assign task
            success = await self.agent_manager.assign_task(task, agent_id)
            
            # Send response
            result_msg = MessageProtocol.create_command_result_message(
                "assign_task",
                {
                    'task_id': task.id,
                    'assigned': success,
                    'agent_id': task.assigned_agent
                },
                "system",
                message.correlation_id
            )
            await self.connection_manager.send_to_client(client_id, result_msg)
            
        except Exception as e:
            logger.error(f"Error assigning task: {e}")
            error_msg = MessageProtocol.create_error_message(
                "task_error",
                f"Task assignment failed: {str(e)}",
                correlation_id=message.correlation_id
            )
            await self.connection_manager.send_to_client(client_id, error_msg)
    
    async def _handle_system_status(self, client_id: str, message: Message):
        """Handle system status request"""
        try:
            # Get system status
            system_status = self.agent_manager.get_system_status()
            connection_stats = self.connection_manager.get_stats()
            
            status_data = {
                'system': system_status,
                'connections': connection_stats,
                'timestamp': datetime.now().isoformat()
            }
            
            # Send response
            response = MessageProtocol.create_command_result_message(
                "get_system_status",
                status_data,
                "system",
                message.correlation_id
            )
            await self.connection_manager.send_to_client(client_id, response)
            
        except Exception as e:
            logger.error(f"Error getting system status: {e}")
            error_msg = MessageProtocol.create_error_message(
                "system_error",
                f"Failed to get system status: {str(e)}",
                correlation_id=message.correlation_id
            )
            await self.connection_manager.send_to_client(client_id, error_msg)
    
    async def _broadcast_agent_status(self, message: Message):
        """Broadcast agent status updates to all clients"""
        await self.connection_manager.broadcast(message)
    
    async def _broadcast_task_update(self, message: Message):
        """Broadcast task updates to all clients"""
        await self.connection_manager.broadcast(message)
    
    async def run_forever(self):
        """Run the server until stopped"""
        try:
            await self.start()
            logger.info("WebSocket server running... Press Ctrl+C to stop")
            
            # Keep the server running
            while self.running:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
        finally:
            await self.stop()
    
    def get_server_info(self) -> Dict[str, Any]:
        """Get server information"""
        return {
            'host': self.host,
            'port': self.port,
            'running': self.running,
            'url': f"ws://{self.host}:{self.port}",
            'connection_stats': self.connection_manager.get_stats(),
            'agent_stats': self.agent_manager.get_system_status()
        }


# Example usage and testing
async def main():
    """Example usage of WebSocket server"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    server = WebSocketServer(host="localhost", port=8765)
    
    try:
        await server.run_forever()
    except Exception as e:
        logger.error(f"Server error: {e}")
        await server.stop()


if __name__ == "__main__":
    asyncio.run(main())