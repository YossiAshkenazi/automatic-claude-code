"""
Connection manager for handling WebSocket client connections,
health monitoring, and message routing.
"""

import asyncio
import logging
import time
import weakref
from typing import Dict, Set, Optional, Any, Callable, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import websockets
from websockets.server import WebSocketServerProtocol
import json

from .message_protocol import Message, MessageType, MessageProtocol


logger = logging.getLogger(__name__)


@dataclass
class ClientConnection:
    """Information about a connected client"""
    client_id: str
    websocket: WebSocketServerProtocol
    connected_at: datetime
    last_ping: Optional[datetime] = None
    last_pong: Optional[datetime] = None
    client_type: str = "dashboard"  # dashboard, agent, monitor
    subscriptions: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_alive(self) -> bool:
        """Check if connection is still alive"""
        return not self.websocket.closed
    
    @property
    def ping_latency(self) -> Optional[float]:
        """Calculate ping latency in milliseconds"""
        if self.last_ping and self.last_pong and self.last_pong > self.last_ping:
            delta = self.last_pong - self.last_ping
            return delta.total_seconds() * 1000
        return None


class ConnectionManager:
    """
    Manages WebSocket client connections with health monitoring,
    message routing, and automatic cleanup.
    """
    
    def __init__(self, ping_interval: int = 30, ping_timeout: int = 10):
        self.clients: Dict[str, ClientConnection] = {}
        self.client_subscriptions: Dict[str, Set[str]] = {}
        self.message_handlers: Dict[MessageType, List[Callable]] = {}
        self.ping_interval = ping_interval
        self.ping_timeout = ping_timeout
        self.running = False
        self.health_check_task: Optional[asyncio.Task] = None
        
        # Statistics
        self.stats = {
            'total_connections': 0,
            'active_connections': 0,
            'messages_sent': 0,
            'messages_received': 0,
            'errors': 0
        }
    
    async def start(self):
        """Start the connection manager"""
        self.running = True
        self.health_check_task = asyncio.create_task(self._health_check_loop())
        logger.info("Connection manager started")
    
    async def stop(self):
        """Stop the connection manager and clean up"""
        self.running = False
        
        if self.health_check_task:
            self.health_check_task.cancel()
            try:
                await self.health_check_task
            except asyncio.CancelledError:
                pass
        
        # Close all connections
        for client in list(self.clients.values()):
            await self.disconnect_client(client.client_id, reason="Server shutdown")
        
        logger.info("Connection manager stopped")
    
    async def connect_client(
        self, 
        websocket: WebSocketServerProtocol, 
        client_id: str,
        client_type: str = "dashboard",
        metadata: Optional[Dict[str, Any]] = None
    ) -> ClientConnection:
        """Register a new client connection"""
        
        client = ClientConnection(
            client_id=client_id,
            websocket=websocket,
            connected_at=datetime.now(),
            client_type=client_type,
            metadata=metadata or {}
        )
        
        self.clients[client_id] = client
        self.client_subscriptions[client_id] = set()
        
        self.stats['total_connections'] += 1
        self.stats['active_connections'] = len(self.clients)
        
        # Send connection acknowledgment
        ack_message = MessageProtocol.create_connection_ack_message(client_id)
        await self.send_to_client(client_id, ack_message)
        
        logger.info(f"Client {client_id} connected as {client_type}")
        return client
    
    async def disconnect_client(self, client_id: str, reason: str = "Client disconnect"):
        """Disconnect and clean up a client"""
        if client_id not in self.clients:
            return
        
        client = self.clients[client_id]
        
        # Close WebSocket connection if still open
        if not client.websocket.closed:
            try:
                await client.websocket.close(code=1000, reason=reason)
            except Exception as e:
                logger.error(f"Error closing websocket for {client_id}: {e}")
        
        # Clean up
        del self.clients[client_id]
        self.client_subscriptions.pop(client_id, None)
        
        self.stats['active_connections'] = len(self.clients)
        
        logger.info(f"Client {client_id} disconnected: {reason}")
    
    async def send_to_client(self, client_id: str, message: Message) -> bool:
        """Send message to specific client"""
        if client_id not in self.clients:
            logger.warning(f"Attempted to send to unknown client: {client_id}")
            return False
        
        client = self.clients[client_id]
        
        if not client.is_alive:
            logger.warning(f"Attempted to send to disconnected client: {client_id}")
            await self.disconnect_client(client_id, "Connection lost")
            return False
        
        try:
            message_json = message.to_json()
            await client.websocket.send(message_json)
            self.stats['messages_sent'] += 1
            return True
        
        except websockets.exceptions.ConnectionClosed:
            logger.warning(f"Connection closed while sending to {client_id}")
            await self.disconnect_client(client_id, "Connection closed")
            return False
        
        except Exception as e:
            logger.error(f"Error sending message to {client_id}: {e}")
            self.stats['errors'] += 1
            return False
    
    async def broadcast(
        self, 
        message: Message, 
        client_type: Optional[str] = None,
        exclude_clients: Optional[Set[str]] = None
    ) -> int:
        """Broadcast message to all connected clients or filtered subset"""
        sent_count = 0
        exclude_clients = exclude_clients or set()
        
        for client_id, client in list(self.clients.items()):
            if client_id in exclude_clients:
                continue
            
            if client_type and client.client_type != client_type:
                continue
            
            if await self.send_to_client(client_id, message):
                sent_count += 1
        
        return sent_count
    
    async def send_to_subscribers(self, topic: str, message: Message) -> int:
        """Send message to all clients subscribed to a topic"""
        sent_count = 0
        
        for client_id, subscriptions in self.client_subscriptions.items():
            if topic in subscriptions:
                if await self.send_to_client(client_id, message):
                    sent_count += 1
        
        return sent_count
    
    def subscribe_client(self, client_id: str, topics: List[str]):
        """Subscribe client to topics"""
        if client_id not in self.client_subscriptions:
            return False
        
        for topic in topics:
            self.client_subscriptions[client_id].add(topic)
        
        logger.debug(f"Client {client_id} subscribed to: {topics}")
        return True
    
    def unsubscribe_client(self, client_id: str, topics: List[str]):
        """Unsubscribe client from topics"""
        if client_id not in self.client_subscriptions:
            return False
        
        for topic in topics:
            self.client_subscriptions[client_id].discard(topic)
        
        logger.debug(f"Client {client_id} unsubscribed from: {topics}")
        return True
    
    async def handle_message(self, client_id: str, message: Message):
        """Handle incoming message from client"""
        self.stats['messages_received'] += 1
        
        # Update client activity
        if client_id in self.clients:
            client = self.clients[client_id]
            
            # Handle ping/pong for health monitoring
            if message.type == MessageType.CONNECTION_PING:
                pong = MessageProtocol.create_pong_message(
                    client_id, 
                    message.payload.get('timestamp', '')
                )
                await self.send_to_client(client_id, pong)
                client.last_ping = datetime.now()
                return
            
            elif message.type == MessageType.CONNECTION_PONG:
                client.last_pong = datetime.now()
                return
        
        # Route message to registered handlers
        handlers = self.message_handlers.get(message.type, [])
        for handler in handlers:
            try:
                await handler(client_id, message)
            except Exception as e:
                logger.error(f"Error in message handler for {message.type}: {e}")
                self.stats['errors'] += 1
    
    def register_message_handler(
        self, 
        message_type: MessageType, 
        handler: Callable[[str, Message], Any]
    ):
        """Register message handler for specific message type"""
        if message_type not in self.message_handlers:
            self.message_handlers[message_type] = []
        
        self.message_handlers[message_type].append(handler)
        logger.debug(f"Registered handler for {message_type}")
    
    def get_client_info(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a client"""
        if client_id not in self.clients:
            return None
        
        client = self.clients[client_id]
        return {
            'client_id': client.client_id,
            'client_type': client.client_type,
            'connected_at': client.connected_at.isoformat(),
            'is_alive': client.is_alive,
            'ping_latency': client.ping_latency,
            'subscriptions': list(self.client_subscriptions.get(client_id, set())),
            'metadata': client.metadata
        }
    
    def get_all_clients(self) -> List[Dict[str, Any]]:
        """Get information about all connected clients"""
        return [
            self.get_client_info(client_id) 
            for client_id in self.clients.keys()
        ]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get connection manager statistics"""
        stats = self.stats.copy()
        
        # Add runtime stats
        stats.update({
            'clients_by_type': {},
            'average_latency': 0.0,
            'uptime': 0 if not hasattr(self, '_start_time') else 
                     (datetime.now() - self._start_time).total_seconds()
        })
        
        # Calculate clients by type
        for client in self.clients.values():
            client_type = client.client_type
            stats['clients_by_type'][client_type] = \
                stats['clients_by_type'].get(client_type, 0) + 1
        
        # Calculate average latency
        latencies = [
            client.ping_latency for client in self.clients.values() 
            if client.ping_latency is not None
        ]
        if latencies:
            stats['average_latency'] = sum(latencies) / len(latencies)
        
        return stats
    
    async def _health_check_loop(self):
        """Background health check loop"""
        self._start_time = datetime.now()
        
        while self.running:
            try:
                await self._perform_health_checks()
                await asyncio.sleep(self.ping_interval)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
                await asyncio.sleep(5)  # Brief pause on error
    
    async def _perform_health_checks(self):
        """Perform health checks on all connections"""
        current_time = datetime.now()
        timeout_threshold = current_time - timedelta(seconds=self.ping_timeout * 3)
        
        # Check for stale connections
        stale_clients = []
        for client_id, client in self.clients.items():
            # Skip if connection is already closed
            if not client.is_alive:
                stale_clients.append((client_id, "Connection closed"))
                continue
            
            # Check for ping timeout
            if (client.last_ping and 
                client.last_ping < timeout_threshold and 
                (not client.last_pong or client.last_pong < client.last_ping)):
                stale_clients.append((client_id, "Ping timeout"))
                continue
        
        # Clean up stale connections
        for client_id, reason in stale_clients:
            await self.disconnect_client(client_id, reason)
        
        # Send ping to remaining clients
        ping_tasks = []
        for client_id in list(self.clients.keys()):
            ping_message = MessageProtocol.create_ping_message(client_id)
            task = asyncio.create_task(self.send_to_client(client_id, ping_message))
            ping_tasks.append(task)
        
        if ping_tasks:
            await asyncio.gather(*ping_tasks, return_exceptions=True)