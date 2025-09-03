#!/usr/bin/env python3
"""
WebSocket Server Starter for Agent Management Platform

This script starts the WebSocket server that bridges between the React dashboard
and the Python multi-agent system. It provides real-time communication for
agent creation, management, and task execution.

Usage:
    python start_websocket_server.py

Features:
- WebSocket server on port 4005 for React dashboard integration
- Real-time agent status updates
- Agent creation and management through WebSocket commands
- Task execution with progress streaming
- Health monitoring and system metrics
- Automatic reconnection and error recovery
"""

import asyncio
import logging
import signal
import sys
import os
from pathlib import Path

# Add the current directory to Python path for imports
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

try:
    from agent_websocket_bridge import AgentWebSocketBridge
except ImportError as e:
    print(f"❌ Failed to import AgentWebSocketBridge: {e}")
    print("Make sure agent_websocket_bridge.py and multi_agent_wrapper.py are in the same directory")
    sys.exit(1)


def setup_logging():
    """Configure logging for the WebSocket server"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('websocket_server.log')
        ]
    )
    
    # Reduce noise from websockets library
    logging.getLogger('websockets').setLevel(logging.WARNING)
    logging.getLogger('asyncio').setLevel(logging.WARNING)


async def main():
    """Main server startup function"""
    setup_logging()
    logger = logging.getLogger(__name__)
    
    logger.info("🚀 Starting Visual Agent Management Platform WebSocket Server")
    logger.info("=" * 60)
    
    # Configuration
    host = os.getenv('WEBSOCKET_HOST', 'localhost')
    port = int(os.getenv('WEBSOCKET_PORT', '4005'))
    
    logger.info(f"Host: {host}")
    logger.info(f"Port: {port}")
    logger.info(f"WebSocket URL: ws://{host}:{port}")
    logger.info("=" * 60)
    
    # Create and start WebSocket bridge
    bridge = AgentWebSocketBridge()
    
    try:
        await bridge.start_server(host=host, port=port)
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user (Ctrl+C)")
    except Exception as e:
        logger.error(f"❌ Server failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


def signal_handler(sig, frame):
    """Handle shutdown signals gracefully"""
    print(f"\n🛑 Received signal {sig}. Shutting down gracefully...")
    sys.exit(0)


if __name__ == "__main__":
    # Handle graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("Visual Agent Management Platform - WebSocket Server")
    print("==================================================")
    print("Press Ctrl+C to stop the server")
    print()
    
    # Run the server
    exit_code = asyncio.run(main())
    sys.exit(exit_code)