#!/usr/bin/env python3
"""
Agent WebSocket Bridge

Provides WebSocket integration for the multi-agent system to communicate
with the React dashboard. This bridge handles real-time agent status updates,
task execution coordination, and system health monitoring.

Features:
- Real-time agent status broadcasting
- WebSocket command handling for agent management
- Task execution with progress updates
- Health monitoring integration
- System metrics streaming
- Error handling and recovery

This module is designed to integrate with the dual-agent-monitor WebSocket server.
"""

import asyncio
import json
import logging
import time
import websockets
from typing import Dict, List, Optional, Any, Callable, Set
from dataclasses import dataclass, asdict
from datetime import datetime

from multi_agent_wrapper import (
    MultiAgentCLIWrapper, AgentPool, CommunicationBridge, HealthMonitor,
    AgentConfig, AgentRole, AgentStatus, MultiAgentConfig, PoolConfig,
    create_dual_agent_system
)
from claude_cli_wrapper import ClaudeCliOptions

logger = logging.getLogger(__name__)


@dataclass
class WebSocketMessage:
    """Standard WebSocket message format"""
    type: str
    data: Dict[str, Any]
    timestamp: float = None
    message_id: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()
        if self.message_id is None:
            self.message_id = f"msg_{int(self.timestamp * 1000)}"
    
    def to_json(self) -> str:
        """Convert to JSON string for WebSocket transmission"""
        return json.dumps(asdict(self))


class AgentWebSocketBridge:
    """
    WebSocket bridge for multi-agent system integration.
    
    Handles real-time communication between the Python multi-agent system
    and the React dashboard through WebSocket connections.
    """
    
    def __init__(self, websocket_uri: str = "ws://localhost:4005", 
                 reconnect_interval: float = 5.0):
        self.websocket_uri = websocket_uri
        self.reconnect_interval = reconnect_interval
        
        # Core components
        self.multi_agent: Optional[MultiAgentCLIWrapper] = None
        self.agent_pool: Optional[AgentPool] = None
        self.communication_bridge: Optional[CommunicationBridge] = None
        
        # WebSocket connection state
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.connected_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.connection_active = False
        self.reconnect_task: Optional[asyncio.Task] = None
        
        # Background tasks
        self.status_broadcast_task: Optional[asyncio.Task] = None
        self.health_monitor_task: Optional[asyncio.Task] = None
        self.metrics_stream_task: Optional[asyncio.Task] = None
        
        # Command handlers
        self.command_handlers: Dict[str, Callable] = {
            "create_agent": self.handle_create_agent,
            "start_agent": self.handle_start_agent,
            "stop_agent": self.handle_stop_agent,
            "list_agents": self.handle_list_agents,
            "get_agent_status": self.handle_get_agent_status,
            "execute_task": self.handle_execute_task,
            "health_check": self.handle_health_check,
            "get_system_stats": self.handle_get_system_stats,
            "create_dual_system": self.handle_create_dual_system,
            "broadcast_task": self.handle_broadcast_task,
            "shutdown_system": self.handle_shutdown_system
        }
        
        # Task tracking
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.task_progress: Dict[str, Dict[str, Any]] = {}
        
        self.logger = logging.getLogger(f"{__name__}.AgentWebSocketBridge")
        self.logger.info(f"WebSocket bridge initialized (URI: {websocket_uri})")
    
    async def start_server(self, host: str = "localhost", port: int = 4005):
        """Start WebSocket server for agent communication"""
        self.logger.info(f"Starting WebSocket server on {host}:{port}")
        
        try:
            # Initialize multi-agent system
            await self.initialize_agent_system()
            
            # Start WebSocket server
            async def handle_client(websocket, path):
                await self.handle_websocket_client(websocket, path)
            
            server = await websockets.serve(handle_client, host, port)
            self.logger.info(f"✅ WebSocket server started on ws://{host}:{port}")
            
            # Start background tasks
            await self.start_background_tasks()
            
            # Keep server running
            await server.wait_closed()
            
        except Exception as e:
            self.logger.error(f"Failed to start WebSocket server: {e}")
            raise
        finally:
            await self.cleanup()
    
    async def handle_websocket_client(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle individual WebSocket client connection"""
        client_id = f"client_{id(websocket)}"
        self.logger.info(f"New WebSocket client connected: {client_id}")
        
        self.connected_clients.add(websocket)
        
        try:
            # Send initial system status
            await self.send_to_client(websocket, WebSocketMessage(
                type="connection_established",
                data={
                    "client_id": client_id,
                    "server_status": "active",
                    "agents_available": len(self.multi_agent.list_agents()) if self.multi_agent else 0
                }
            ))
            
            # Handle incoming messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_websocket_command(websocket, data)
                except json.JSONDecodeError as e:
                    await self.send_error(websocket, f"Invalid JSON: {e}")
                except Exception as e:
                    await self.send_error(websocket, f"Command processing error: {e}")
        
        except websockets.exceptions.ConnectionClosed:
            self.logger.info(f"WebSocket client disconnected: {client_id}")
        except Exception as e:
            self.logger.error(f"WebSocket client error: {e}")
        finally:
            self.connected_clients.discard(websocket)
    
    async def process_websocket_command(self, websocket: websockets.WebSocketServerProtocol, data: Dict[str, Any]):
        """Process incoming WebSocket command"""
        command = data.get("command")
        command_data = data.get("data", {})
        message_id = data.get("message_id")
        
        if command not in self.command_handlers:
            await self.send_error(websocket, f"Unknown command: {command}", message_id)
            return
        
        try:
            # Execute command handler
            result = await self.command_handlers[command](command_data)
            
            # Send success response
            response = WebSocketMessage(
                type="command_response",
                data={
                    "command": command,
                    "success": True,
                    "result": result,
                    "original_message_id": message_id
                }
            )
            await self.send_to_client(websocket, response)
            
        except Exception as e:
            self.logger.error(f"Command handler error for '{command}': {e}")
            await self.send_error(websocket, f"Command failed: {e}", message_id)
    
    async def send_to_client(self, websocket: websockets.WebSocketServerProtocol, message: WebSocketMessage):
        """Send message to specific WebSocket client"""
        try:
            await websocket.send(message.to_json())
        except websockets.exceptions.ConnectionClosed:
            self.connected_clients.discard(websocket)
        except Exception as e:
            self.logger.error(f"Failed to send message to client: {e}")
    
    async def broadcast_to_all_clients(self, message: WebSocketMessage):
        """Broadcast message to all connected clients"""
        if not self.connected_clients:
            return
        
        disconnected_clients = set()
        for client in self.connected_clients:
            try:
                await client.send(message.to_json())
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.add(client)
            except Exception as e:
                self.logger.warning(f"Failed to broadcast to client: {e}")
                disconnected_clients.add(client)
        
        # Remove disconnected clients
        self.connected_clients -= disconnected_clients
    
    async def send_error(self, websocket: websockets.WebSocketServerProtocol, error_message: str, 
                        original_message_id: str = None):
        """Send error response to client"""
        error_response = WebSocketMessage(
            type="error",
            data={
                "error": error_message,
                "original_message_id": original_message_id
            }
        )
        await self.send_to_client(websocket, error_response)
    
    # Command Handlers
    
    async def handle_create_agent(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle agent creation command"""
        agent_id = data.get("agent_id", f"agent_{int(time.time())}")
        role = AgentRole(data.get("role", "worker"))
        name = data.get("name", f"Agent {agent_id}")
        
        # Create agent configuration
        cli_options = ClaudeCliOptions(
            model=data.get("model", "sonnet"),
            max_turns=data.get("max_turns", 5),
            verbose=data.get("verbose", False)
        )
        
        config = AgentConfig(
            agent_id=agent_id,
            role=role,
            name=name,
            cli_options=cli_options
        )
        
        # Create agent
        if not self.multi_agent:
            await self.initialize_agent_system()
        
        created_agent_id = await self.multi_agent.create_agent(config)
        
        # Broadcast agent creation
        await self.broadcast_agent_update("agent_created", created_agent_id)
        
        return {
            "agent_id": created_agent_id,
            "status": "created",
            "config": {
                "role": role.value,
                "name": name,
                "model": cli_options.model
            }
        }
    
    async def handle_start_agent(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle agent start command"""
        agent_id = data["agent_id"]
        
        if not self.multi_agent:
            raise ValueError("Multi-agent system not initialized")
        
        success = await self.multi_agent.start_agent(agent_id)
        
        if success:
            await self.broadcast_agent_update("agent_started", agent_id)
        
        return {"agent_id": agent_id, "success": success, "status": "started" if success else "failed"}
    
    async def handle_stop_agent(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle agent stop command"""
        agent_id = data["agent_id"]
        force = data.get("force", False)
        
        if not self.multi_agent:
            raise ValueError("Multi-agent system not initialized")
        
        success = await self.multi_agent.stop_agent(agent_id, force=force)
        
        if success:
            await self.broadcast_agent_update("agent_stopped", agent_id)
        
        return {"agent_id": agent_id, "success": success, "status": "stopped" if success else "failed"}
    
    async def handle_list_agents(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Handle list agents command"""
        if not self.multi_agent:
            return []
        
        agents = self.multi_agent.list_agents()
        return [
            {
                "agent_id": a.config.agent_id,
                "name": a.config.name,
                "role": a.config.role.value,
                "status": a.status.value,
                "uptime_seconds": a.get_uptime_seconds(),
                "task_count": a.task_count,
                "error_count": a.error_count,
                "current_task_id": a.current_task_id
            }
            for a in agents
        ]
    
    async def handle_get_agent_status(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get agent status command"""
        agent_id = data["agent_id"]
        
        if not self.multi_agent:
            raise ValueError("Multi-agent system not initialized")
        
        agent_info = await self.multi_agent.get_agent_status(agent_id)
        if not agent_info:
            raise ValueError(f"Agent {agent_id} not found")
        
        return {
            "agent_id": agent_info.config.agent_id,
            "name": agent_info.config.name,
            "role": agent_info.config.role.value,
            "status": agent_info.status.value,
            "uptime_seconds": agent_info.get_uptime_seconds(),
            "idle_time_seconds": agent_info.get_idle_time_seconds(),
            "task_count": agent_info.task_count,
            "error_count": agent_info.error_count,
            "restart_count": agent_info.restart_count,
            "current_task_id": agent_info.current_task_id,
            "health_status": agent_info.health_status
        }
    
    async def handle_execute_task(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle task execution command"""
        agent_id = data["agent_id"]
        prompt = data["prompt"]
        task_id = data.get("task_id", f"task_{int(time.time() * 1000)}")
        
        if not self.multi_agent:
            raise ValueError("Multi-agent system not initialized")
        
        # Start task execution in background
        task = asyncio.create_task(self.execute_task_with_updates(agent_id, prompt, task_id))
        self.active_tasks[task_id] = task
        
        return {
            "task_id": task_id,
            "agent_id": agent_id,
            "status": "started",
            "prompt": prompt[:100] + "..." if len(prompt) > 100 else prompt
        }
    
    async def execute_task_with_updates(self, agent_id: str, prompt: str, task_id: str):
        """Execute task with real-time progress updates"""
        try:
            # Notify task started
            await self.broadcast_task_update(task_id, "started", agent_id)
            
            messages = []
            async for message in self.multi_agent.execute_task(agent_id, prompt, task_id):
                messages.append({
                    "type": message.type,
                    "content": message.content,
                    "timestamp": time.time(),
                    "metadata": message.metadata
                })
                
                # Broadcast message update
                await self.broadcast_task_update(task_id, "progress", agent_id, {
                    "message": message.content[:200] + "..." if len(message.content) > 200 else message.content,
                    "message_type": message.type,
                    "message_count": len(messages)
                })
            
            # Notify task completed
            await self.broadcast_task_update(task_id, "completed", agent_id, {
                "total_messages": len(messages),
                "final_message": messages[-1]["content"][:200] + "..." if messages else "No messages"
            })
            
        except Exception as e:
            self.logger.error(f"Task execution failed: {e}")
            await self.broadcast_task_update(task_id, "failed", agent_id, {
                "error": str(e)
            })
        finally:
            self.active_tasks.pop(task_id, None)
    
    async def handle_health_check(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle health check command"""
        agent_id = data["agent_id"]
        
        if not self.multi_agent:
            raise ValueError("Multi-agent system not initialized")
        
        health = await self.multi_agent.health_check(agent_id)
        
        return {
            "agent_id": health.agent_id,
            "is_healthy": health.is_healthy,
            "check_timestamp": health.check_timestamp,
            "response_time_ms": health.response_time_ms,
            "memory_usage_mb": health.memory_usage_mb,
            "cpu_usage_percent": health.cpu_usage_percent,
            "error_message": health.error_message,
            "last_activity_age_seconds": health.last_activity_age_seconds,
            "recommendations": health.recommendations
        }
    
    async def handle_get_system_stats(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get system stats command"""
        if not self.multi_agent:
            return {"error": "Multi-agent system not initialized"}
        
        return self.multi_agent.get_system_stats()
    
    async def handle_create_dual_system(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle create dual agent system command"""
        # Clean up existing system
        if self.multi_agent:
            await self.multi_agent.shutdown()
        
        # Create new dual-agent system
        self.multi_agent = await create_dual_agent_system()
        
        agents = self.multi_agent.list_agents()
        
        # Broadcast system creation
        await self.broadcast_to_all_clients(WebSocketMessage(
            type="dual_system_created",
            data={
                "agents": [
                    {
                        "agent_id": a.config.agent_id,
                        "role": a.config.role.value,
                        "status": a.status.value
                    }
                    for a in agents
                ]
            }
        ))
        
        return {
            "system_type": "dual_agent",
            "agents_created": len(agents),
            "manager_id": "manager",
            "worker_id": "worker"
        }
    
    async def handle_broadcast_task(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle broadcast task command"""
        prompt = data["prompt"]
        target_roles = [AgentRole(role) for role in data.get("target_roles", [])]
        max_agents = data.get("max_agents")
        
        if not self.multi_agent:
            raise ValueError("Multi-agent system not initialized")
        
        task_generators = await self.multi_agent.broadcast_task(prompt, target_roles, max_agents)
        
        # Start broadcast tasks in background
        broadcast_id = f"broadcast_{int(time.time() * 1000)}"
        for agent_id, task_generator in task_generators.items():
            task_id = f"{broadcast_id}_{agent_id}"
            task = asyncio.create_task(self.handle_broadcast_task_execution(agent_id, task_generator, task_id))
            self.active_tasks[task_id] = task
        
        return {
            "broadcast_id": broadcast_id,
            "agents_targeted": list(task_generators.keys()),
            "total_agents": len(task_generators),
            "prompt": prompt[:100] + "..." if len(prompt) > 100 else prompt
        }
    
    async def handle_broadcast_task_execution(self, agent_id: str, task_generator, task_id: str):
        """Handle individual broadcast task execution"""
        try:
            async for message in task_generator:
                await self.broadcast_to_all_clients(WebSocketMessage(
                    type="broadcast_task_message",
                    data={
                        "task_id": task_id,
                        "agent_id": agent_id,
                        "message_type": message.type,
                        "content": message.content[:200] + "..." if len(message.content) > 200 else message.content
                    }
                ))
        except Exception as e:
            self.logger.error(f"Broadcast task execution failed for {agent_id}: {e}")
        finally:
            self.active_tasks.pop(task_id, None)
    
    async def handle_shutdown_system(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle system shutdown command"""
        timeout = data.get("timeout", 10.0)
        
        if self.multi_agent:
            await self.multi_agent.shutdown(timeout=timeout)
            self.multi_agent = None
        
        await self.broadcast_to_all_clients(WebSocketMessage(
            type="system_shutdown",
            data={"status": "shutdown_complete"}
        ))
        
        return {"status": "shutdown_complete", "timeout": timeout}
    
    # Background Tasks
    
    async def start_background_tasks(self):
        """Start background monitoring and broadcasting tasks"""
        self.status_broadcast_task = asyncio.create_task(self.agent_status_broadcast_loop())
        self.health_monitor_task = asyncio.create_task(self.health_monitoring_loop())
        self.metrics_stream_task = asyncio.create_task(self.metrics_streaming_loop())
        
        self.logger.info("✅ Background tasks started")
    
    async def agent_status_broadcast_loop(self):
        """Background loop to broadcast agent status updates"""
        while True:
            try:
                if self.multi_agent and self.connected_clients:
                    agents = self.multi_agent.list_agents()
                    
                    status_update = WebSocketMessage(
                        type="agent_status_broadcast",
                        data={
                            "agents": [
                                {
                                    "agent_id": a.config.agent_id,
                                    "status": a.status.value,
                                    "current_task_id": a.current_task_id,
                                    "task_count": a.task_count
                                }
                                for a in agents
                            ],
                            "total_agents": len(agents),
                            "active_tasks": len(self.active_tasks)
                        }
                    )
                    
                    await self.broadcast_to_all_clients(status_update)
                
                await asyncio.sleep(5.0)  # Broadcast every 5 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Status broadcast error: {e}")
                await asyncio.sleep(10)
    
    async def health_monitoring_loop(self):
        """Background health monitoring loop"""
        while True:
            try:
                if self.multi_agent and self.connected_clients:
                    agents = self.multi_agent.list_agents()
                    health_results = {}
                    
                    for agent in agents:
                        health = await self.multi_agent.health_check(agent.config.agent_id)
                        health_results[agent.config.agent_id] = {
                            "is_healthy": health.is_healthy,
                            "response_time_ms": health.response_time_ms,
                            "recommendations": health.recommendations[:3],  # Limit for broadcast
                            "error_message": health.error_message
                        }
                    
                    health_update = WebSocketMessage(
                        type="health_monitoring_update",
                        data={
                            "health_results": health_results,
                            "overall_health": all(h["is_healthy"] for h in health_results.values()),
                            "check_timestamp": time.time()
                        }
                    )
                    
                    await self.broadcast_to_all_clients(health_update)
                
                await asyncio.sleep(30.0)  # Health check every 30 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Health monitoring error: {e}")
                await asyncio.sleep(30)
    
    async def metrics_streaming_loop(self):
        """Background metrics streaming loop"""
        while True:
            try:
                if self.multi_agent and self.connected_clients:
                    stats = self.multi_agent.get_system_stats()
                    
                    metrics_update = WebSocketMessage(
                        type="system_metrics_stream",
                        data={
                            "system_stats": stats,
                            "active_websocket_clients": len(self.connected_clients),
                            "active_background_tasks": len(self.active_tasks)
                        }
                    )
                    
                    await self.broadcast_to_all_clients(metrics_update)
                
                await asyncio.sleep(15.0)  # Metrics every 15 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Metrics streaming error: {e}")
                await asyncio.sleep(15)
    
    # Utility Methods
    
    async def broadcast_agent_update(self, event_type: str, agent_id: str, extra_data: Dict[str, Any] = None):
        """Broadcast agent-specific update"""
        data = {
            "event_type": event_type,
            "agent_id": agent_id,
            "timestamp": time.time()
        }
        if extra_data:
            data.update(extra_data)
        
        await self.broadcast_to_all_clients(WebSocketMessage(
            type="agent_update",
            data=data
        ))
    
    async def broadcast_task_update(self, task_id: str, status: str, agent_id: str, extra_data: Dict[str, Any] = None):
        """Broadcast task-specific update"""
        data = {
            "task_id": task_id,
            "status": status,
            "agent_id": agent_id,
            "timestamp": time.time()
        }
        if extra_data:
            data.update(extra_data)
        
        await self.broadcast_to_all_clients(WebSocketMessage(
            type="task_update",
            data=data
        ))
    
    async def initialize_agent_system(self):
        """Initialize the multi-agent system"""
        if not self.multi_agent:
            config = MultiAgentConfig(
                max_agents=5,
                enable_metrics=True,
                health_check_interval=30.0
            )
            self.multi_agent = MultiAgentCLIWrapper(config)
            self.logger.info("✅ Multi-agent system initialized")
    
    async def cleanup(self):
        """Clean up all resources"""
        self.logger.info("🧹 Cleaning up WebSocket bridge...")
        
        # Cancel background tasks
        for task in [self.status_broadcast_task, self.health_monitor_task, self.metrics_stream_task]:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # Cancel active tasks
        for task in list(self.active_tasks.values()):
            if not task.done():
                task.cancel()
        
        # Shutdown multi-agent system
        if self.multi_agent:
            await self.multi_agent.shutdown(timeout=5.0)
        
        # Close WebSocket connections
        for client in list(self.connected_clients):
            await client.close()
        
        self.logger.info("✅ WebSocket bridge cleanup complete")


async def main():
    """Main entry point for WebSocket bridge"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    bridge = AgentWebSocketBridge()
    
    try:
        await bridge.start_server(host="localhost", port=4005)
    except KeyboardInterrupt:
        print("\n🛑 WebSocket bridge stopped by user")
    except Exception as e:
        print(f"❌ WebSocket bridge failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())