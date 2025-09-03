"""
WebSocket client for connecting to the Python agent orchestrator
from React dashboard or other clients.
"""

import asyncio
import logging
import json
import uuid
from typing import Optional, Callable, Any, Dict
from datetime import datetime
import websockets
from websockets.exceptions import WebSocketException, ConnectionClosed

from .message_protocol import Message, MessageType, MessageProtocol


logger = logging.getLogger(__name__)


class WebSocketClient:
    """
    WebSocket client for connecting to Python agent orchestrator.
    
    Features:
    - Automatic reconnection
    - Message correlation and response tracking
    - Event handlers for different message types
    - Health monitoring with ping/pong
    """
    
    def __init__(
        self,
        uri: str = "ws://localhost:8765",
        client_id: Optional[str] = None,
        auto_reconnect: bool = True,
        reconnect_interval: int = 5,
        max_reconnect_attempts: int = 10
    ):
        self.uri = uri
        self.client_id = client_id or str(uuid.uuid4())
        self.auto_reconnect = auto_reconnect
        self.reconnect_interval = reconnect_interval
        self.max_reconnect_attempts = max_reconnect_attempts
        
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.connected = False
        self.running = False
        self.reconnect_attempts = 0
        
        # Message handling
        self.message_handlers: Dict[MessageType, list] = {}
        self.response_handlers: Dict[str, Callable] = {}  # correlation_id -> handler
        self.pending_responses: Dict[str, asyncio.Future] = {}
        
        # Background tasks
        self.receive_task: Optional[asyncio.Task] = None
        self.ping_task: Optional[asyncio.Task] = None
        
        logger.info(f"WebSocket client created for {uri}")
    
    async def connect(self) -> bool:
        """Connect to WebSocket server"""
        try:
            self.websocket = await websockets.connect(
                self.uri,
                ping_interval=None,  # We handle our own ping/pong
                ping_timeout=None,
                max_size=10 * 1024 * 1024,  # 10MB max message size
                compression=None
            )
            
            self.connected = True
            self.reconnect_attempts = 0
            
            # Start background tasks
            self.receive_task = asyncio.create_task(self._receive_loop())
            self.ping_task = asyncio.create_task(self._ping_loop())
            
            logger.info(f"Connected to {self.uri}")
            
            # Send initial ping to establish connection
            await self._send_ping()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to {self.uri}: {e}")
            return False
    
    async def disconnect(self, reason: str = "Client disconnect"):
        """Disconnect from WebSocket server"""
        self.running = False
        self.connected = False
        
        # Cancel background tasks
        for task in [self.receive_task, self.ping_task]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # Close WebSocket
        if self.websocket:
            await self.websocket.close(code=1000, reason=reason)
        
        logger.info(f"Disconnected: {reason}")
    
    async def send_message(self, message: Message) -> bool:
        """Send message to server"""
        if not self.connected or not self.websocket:
            logger.warning("Cannot send message - not connected")
            return False
        
        try:
            message_json = message.to_json()
            await self.websocket.send(message_json)
            return True
            
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            await self._handle_connection_lost()
            return False
    
    async def send_and_wait_response(
        self, 
        message: Message, 
        timeout: float = 30.0
    ) -> Optional[Message]:
        """Send message and wait for correlated response"""
        if not message.correlation_id:
            message.correlation_id = str(uuid.uuid4())
        
        # Create future for response
        future = asyncio.Future()
        self.pending_responses[message.correlation_id] = future
        
        try:
            # Send message
            if not await self.send_message(message):
                return None
            
            # Wait for response
            response = await asyncio.wait_for(future, timeout=timeout)
            return response
            
        except asyncio.TimeoutError:
            logger.error(f"Timeout waiting for response to {message.type}")
            return None
        finally:
            # Clean up
            self.pending_responses.pop(message.correlation_id, None)
    
    def add_message_handler(
        self, 
        message_type: MessageType, 
        handler: Callable[[Message], Any]
    ):
        """Add message handler for specific message type"""
        if message_type not in self.message_handlers:
            self.message_handlers[message_type] = []
        
        self.message_handlers[message_type].append(handler)
    
    async def create_agent(
        self, 
        agent_type: str, 
        model: str = "sonnet",
        capabilities: list = None
    ) -> Optional[Dict[str, Any]]:
        """Create new agent on server"""
        message = Message.create(
            MessageType.AGENT_CREATE,
            {
                'agent_type': agent_type,
                'model': model,
                'capabilities': capabilities or []
            }
        )
        
        response = await self.send_and_wait_response(message)
        if response and response.type == MessageType.COMMAND_RESULT:
            return response.payload
        return None
    
    async def execute_command(
        self,
        agent_id: str,
        command: str,
        parameters: Dict[str, Any] = None
    ) -> Optional[Any]:
        """Execute command on agent"""
        message = MessageProtocol.create_command_execute_message(
            command, agent_id, parameters
        )
        
        response = await self.send_and_wait_response(message)
        if response and response.type == MessageType.COMMAND_RESULT:
            return response.payload.get('result')
        return None
    
    async def assign_task(
        self,
        task_data: Dict[str, Any],
        agent_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Assign task to agent"""
        message = Message.create(
            MessageType.TASK_ASSIGN,
            {
                'task': task_data,
                'agent_id': agent_id
            }
        )
        
        response = await self.send_and_wait_response(message)
        if response and response.type == MessageType.COMMAND_RESULT:
            return response.payload
        return None
    
    async def get_system_status(self) -> Optional[Dict[str, Any]]:
        """Get system status from server"""
        message = Message.create(MessageType.SYSTEM_STATUS, {})
        
        response = await self.send_and_wait_response(message)
        if response and response.type == MessageType.COMMAND_RESULT:
            return response.payload
        return None
    
    async def run_until_disconnected(self):
        """Run client until disconnected"""
        self.running = True
        
        while self.running:
            if not self.connected:
                if self.auto_reconnect:
                    await self._attempt_reconnect()
                else:
                    break
            
            await asyncio.sleep(1)
    
    async def _receive_loop(self):
        """Background loop to receive messages"""
        try:
            async for raw_message in self.websocket:
                try:
                    if isinstance(raw_message, bytes):
                        raw_message = raw_message.decode('utf-8')
                    
                    message_data = json.loads(raw_message)
                    message = Message.from_dict(message_data)
                    
                    await self._handle_received_message(message)
                    
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {e}")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
        
        except ConnectionClosed:
            logger.info("Connection closed by server")
            await self._handle_connection_lost()
        except WebSocketException as e:
            logger.error(f"WebSocket error: {e}")
            await self._handle_connection_lost()
        except Exception as e:
            logger.error(f"Unexpected error in receive loop: {e}")
            await self._handle_connection_lost()
    
    async def _handle_received_message(self, message: Message):
        """Handle received message"""
        # Check for correlated response
        if message.correlation_id and message.correlation_id in self.pending_responses:
            future = self.pending_responses[message.correlation_id]
            if not future.done():
                future.set_result(message)
            return
        
        # Handle ping/pong
        if message.type == MessageType.CONNECTION_PING:
            pong = MessageProtocol.create_pong_message(
                self.client_id,
                message.payload.get('timestamp', '')
            )
            await self.send_message(pong)
            return
        
        # Route to handlers
        handlers = self.message_handlers.get(message.type, [])
        for handler in handlers:
            try:
                await handler(message)
            except Exception as e:
                logger.error(f"Error in message handler for {message.type}: {e}")
    
    async def _ping_loop(self):
        """Background ping loop for health monitoring"""
        while self.connected:
            try:
                await asyncio.sleep(30)  # Ping every 30 seconds
                await self._send_ping()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in ping loop: {e}")
    
    async def _send_ping(self):
        """Send ping message"""
        ping = MessageProtocol.create_ping_message(self.client_id)
        await self.send_message(ping)
    
    async def _handle_connection_lost(self):
        """Handle connection lost"""
        self.connected = False
        
        if self.auto_reconnect and self.running:
            logger.info("Connection lost, will attempt to reconnect")
        else:
            self.running = False
    
    async def _attempt_reconnect(self):
        """Attempt to reconnect"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.error("Max reconnection attempts reached")
            self.running = False
            return
        
        self.reconnect_attempts += 1
        logger.info(f"Attempting to reconnect ({self.reconnect_attempts}/{self.max_reconnect_attempts})")
        
        await asyncio.sleep(self.reconnect_interval)
        
        if await self.connect():
            logger.info("Reconnected successfully")
        else:
            logger.error("Reconnection failed")


# Example usage and testing
async def test_client():
    """Test client functionality"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    client = WebSocketClient()
    
    # Add event handlers
    async def handle_agent_status(message: Message):
        print(f"Agent status: {message.payload}")
    
    async def handle_task_update(message: Message):
        print(f"Task update: {message.payload}")
    
    client.add_message_handler(MessageType.AGENT_STATUS, handle_agent_status)
    client.add_message_handler(MessageType.TASK_UPDATE, handle_task_update)
    
    try:
        # Connect
        if await client.connect():
            print("Connected to server")
            
            # Test creating agent
            result = await client.create_agent("worker", "sonnet", ["coding", "analysis"])
            if result:
                print(f"Created agent: {result}")
                
                agent_id = result.get('agent_id')
                if agent_id:
                    # Test command execution
                    command_result = await client.execute_command(
                        agent_id, 
                        "Write a simple Hello World function in Python"
                    )
                    print(f"Command result: {command_result}")
            
            # Test system status
            status = await client.get_system_status()
            print(f"System status: {status}")
            
            # Run for a while to receive updates
            await asyncio.sleep(10)
        
        else:
            print("Failed to connect")
            
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(test_client())