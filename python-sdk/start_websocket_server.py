#!/usr/bin/env python3
"""
WebSocket Server Startup Script
Simple script to start the WebSocket backend server for the React dashboard.

This script:
- Configures logging for both console and file output
- Starts the WebSocket server on localhost:8765
- Handles graceful shutdown on Ctrl+C
- Validates Claude CLI availability
- Works cross-platform (Windows, Mac, Linux)
"""

import asyncio
import logging
import signal
import sys
import os
from pathlib import Path

# Fix Windows Unicode encoding issues
if sys.platform.startswith('win'):
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)

# Add current directory to Python path for imports
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

try:
    from api.websocket.server import WebSocketServer
except ImportError as e:
    print(f"[ERROR] Failed to import WebSocket server: {e}")
    print("Make sure you're running this from the python-sdk directory")
    sys.exit(1)

# Setup logging
def setup_logging():
    """Configure logging for both console and file output"""
    # Create logs directory if it doesn't exist
    log_dir = current_dir / "logs"
    log_dir.mkdir(exist_ok=True)
    
    # Configure logging format
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Create handlers
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter(log_format))
    
    file_handler = logging.FileHandler(log_dir / "websocket_server.log")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(log_format))
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    
    # Reduce websockets library verbosity
    logging.getLogger('websockets').setLevel(logging.WARNING)
    
    return root_logger

def validate_environment():
    """Validate that the environment is ready for the WebSocket server"""
    logger = logging.getLogger(__name__)
    
    # Check if claude_cli_wrapper.py exists
    wrapper_path = current_dir / "claude_cli_wrapper.py"
    if not wrapper_path.exists():
        logger.error("[ERROR] claude_cli_wrapper.py not found in python-sdk directory")
        return False
    
    # Check if websockets is available
    try:
        import websockets
        logger.info(f"[OK] websockets library available (version: {websockets.__version__})")
    except ImportError:
        logger.error("[ERROR] websockets library not found. Run: pip install websockets")
        return False
    
    # Check if Claude CLI is available (optional - will be validated by agents)
    try:
        import subprocess
        result = subprocess.run(
            ["claude", "--version"], 
            capture_output=True, 
            text=True, 
            timeout=10
        )
        if result.returncode == 0:
            logger.info("[OK] Claude CLI available")
        else:
            logger.warning("[WARNING] Claude CLI might not be available - agents will validate at runtime")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        logger.warning("[WARNING] Could not verify Claude CLI - will be validated by agents at runtime")
    except Exception as e:
        logger.warning(f"[WARNING] Claude CLI check failed: {e}")
    
    return True

def setup_signal_handlers(server):
    """Setup signal handlers for graceful shutdown"""
    def signal_handler(signum, frame):
        logger = logging.getLogger(__name__)
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        asyncio.create_task(server.stop())
    
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)
    if hasattr(signal, 'SIGINT'):
        signal.signal(signal.SIGINT, signal_handler)

async def main():
    """Main entry point"""
    logger = setup_logging()
    logger.info("[STARTUP] Starting WebSocket Server for Visual Agent Platform")
    
    # Validate environment
    if not validate_environment():
        logger.error("[ERROR] Environment validation failed")
        return 1
    
    # Configuration
    host = os.getenv("WEBSOCKET_HOST", "localhost")
    port = int(os.getenv("WEBSOCKET_PORT", "8765"))
    
    # Create server
    server = WebSocketServer(host=host, port=port)
    
    # Setup signal handlers for graceful shutdown
    setup_signal_handlers(server)
    
    try:
        logger.info(f"[SERVER] Starting WebSocket server on ws://{host}:{port}")
        logger.info("[INFO] Dashboard should connect to this WebSocket endpoint")
        logger.info("[INFO] Agent management and task coordination ready")
        logger.info("[INFO] Press Ctrl+C to stop the server")
        logger.info("-" * 60)
        
        # Start server and run forever
        await server.run_forever()
        
    except KeyboardInterrupt:
        logger.info("[SHUTDOWN] Received interrupt signal")
    except Exception as e:
        logger.error(f"[ERROR] Server error: {e}")
        return 1
    finally:
        logger.info("[SHUTDOWN] Performing cleanup...")
        try:
            await server.stop()
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
        logger.info("[SHUTDOWN] Server stopped successfully")
    
    return 0

if __name__ == "__main__":
    # Ensure we're running in the correct directory
    os.chdir(current_dir)
    
    # Run the server
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except Exception as e:
        print(f"[ERROR] Failed to start server: {e}")
        sys.exit(1)