#!/usr/bin/env python3
"""
Startup script for the Python Agent WebSocket Server.

This script starts the WebSocket server that provides bi-directional
communication between the Python agent orchestrator and React dashboard.
"""

import asyncio
import signal
import sys
import logging
from pathlib import Path

# Add the parent directory to the path to import our modules
sys.path.insert(0, str(Path(__file__).parent))

from api.websocket.server import WebSocketServer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('websocket_server.log')
    ]
)

logger = logging.getLogger(__name__)


async def main():
    """Main function to start the WebSocket server"""
    
    # Configuration
    HOST = "localhost"
    PORT = 8765
    
    logger.info("Starting Python Agent WebSocket Server...")
    logger.info(f"Configuration: {HOST}:{PORT}")
    
    # Create and start server
    server = WebSocketServer(host=HOST, port=PORT)
    
    # Handle shutdown gracefully
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, shutting down...")
        asyncio.create_task(server.stop())
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start the server
        await server.start()
        
        logger.info(f"🚀 WebSocket server started successfully!")
        logger.info(f"📡 WebSocket URL: ws://{HOST}:{PORT}")
        logger.info(f"🎯 Dashboard can now connect to this server")
        logger.info(f"📊 Server info: {server.get_server_info()}")
        logger.info("Press Ctrl+C to stop the server")
        
        # Keep running
        while server.running:
            await asyncio.sleep(1)
            
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise
    
    finally:
        logger.info("Server shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server failed to start: {e}")
        sys.exit(1)