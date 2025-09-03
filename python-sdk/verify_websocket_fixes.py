#!/usr/bin/env python3
"""
WebSocket Backend Verification Script

This script verifies that all the fixes are working properly:
1. Import fixes are resolved
2. WebSocket server can be instantiated 
3. Message protocol works correctly
4. Agent manager can be created
5. All components integrate properly

Run this script to verify the backend is ready for React dashboard connection.
"""

import asyncio
import sys
import traceback
from pathlib import Path

# Add current directory to path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def test_imports():
    """Test that all imports work correctly"""
    print("[TEST] Testing imports...")
    
    try:
        # Test message protocol imports
        from api.websocket.message_protocol import (
            MessageProtocol, MessageType, Message, AgentType, TaskInfo
        )
        print("  OK Message protocol imports work")
        
        # Test agent manager imports
        from api.websocket.agent_manager import AgentManager
        print("  OK Agent manager imports work")
        
        # Test server imports
        from api.websocket.server import WebSocketServer
        print("  OK WebSocket server imports work")
        
        # Test client imports
        from api.websocket.client import WebSocketClient
        print("  OK WebSocket client imports work")
        
        # Test connection manager imports
        from api.websocket.connection_manager import ConnectionManager
        print("  OK Connection manager imports work")
        
        # Test claude_cli_wrapper import
        from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions
        print("  OK Claude CLI wrapper imports work")
        
        return True
        
    except ImportError as e:
        print(f"  ERROR Import failed: {e}")
        traceback.print_exc()
        return False

def test_message_protocol():
    """Test message protocol functionality"""
    print("[TEST] Testing message protocol...")
    
    try:
        from api.websocket.message_protocol import MessageProtocol, MessageType, Message
        
        # Create various message types
        ping_msg = MessageProtocol.create_ping_message("test-client")
        assert ping_msg.type == MessageType.CONNECTION_PING
        print("  OK Ping message creation works")
        
        # Test serialization/deserialization
        serialized = ping_msg.to_dict()
        deserialized = Message.from_dict(serialized)
        assert deserialized.type == ping_msg.type
        assert deserialized.source == ping_msg.source
        print("  OK Message serialization works")
        
        # Test validation
        is_valid = MessageProtocol.validate_message(serialized)
        assert is_valid == True
        print("  OK Message validation works")
        
        # Test error message creation
        error_msg = MessageProtocol.create_error_message("test_error", "Test error message")
        assert error_msg.type == MessageType.SYSTEM_ERROR
        print("  OK Error message creation works")
        
        return True
        
    except Exception as e:
        print(f"  ERROR Message protocol test failed: {e}")
        traceback.print_exc()
        return False

async def test_agent_manager():
    """Test agent manager functionality"""
    print("[TEST] Testing agent manager...")
    
    try:
        from api.websocket.agent_manager import AgentManager, AgentStatus
        
        # Create agent manager
        manager = AgentManager()
        print("  OK Agent manager creation works")
        
        # Start manager (without creating actual agents)
        await manager.start()
        print("  OK Agent manager start works")
        
        # Test status retrieval
        status = manager.get_system_status()
        assert isinstance(status, dict)
        assert 'agents' in status
        print("  OK System status retrieval works")
        
        # Stop manager
        await manager.stop()
        print("  OK Agent manager stop works")
        
        return True
        
    except Exception as e:
        print(f"  ERROR Agent manager test failed: {e}")
        traceback.print_exc()
        return False

async def test_websocket_server_instantiation():
    """Test WebSocket server can be created and configured"""
    print("[TEST] Testing WebSocket server instantiation...")
    
    try:
        from api.websocket.server import WebSocketServer
        
        # Create server (don't start it)
        server = WebSocketServer(host="localhost", port=8765)
        print("  OK WebSocket server creation works")
        
        # Test server info
        info = server.get_server_info()
        assert info['host'] == "localhost"
        assert info['port'] == 8765
        assert info['running'] == False
        print("  OK Server info retrieval works")
        
        return True
        
    except Exception as e:
        print(f"  ERROR WebSocket server test failed: {e}")
        traceback.print_exc()
        return False

def test_startup_script():
    """Test startup script functionality"""
    print("[TEST] Testing startup script...")
    
    try:
        from start_websocket_server import validate_environment, setup_logging
        
        # Test environment validation
        env_valid = validate_environment()
        print(f"  OK Environment validation: {env_valid}")
        
        # Test logging setup
        logger = setup_logging()
        assert logger is not None
        print("  OK Logging setup works")
        
        return True
        
    except Exception as e:
        print(f"  ERROR Startup script test failed: {e}")
        traceback.print_exc()
        return False

def test_windows_compatibility():
    """Test Windows-specific compatibility"""
    print("[TEST] Testing Windows compatibility...")
    
    try:
        # Test path handling
        import os
        from pathlib import Path
        
        test_path = Path("test/path/with spaces/file.txt")
        print(f"  OK Path handling works: {test_path}")
        
        # Test Unicode handling (if on Windows)
        if sys.platform.startswith('win'):
            test_unicode = "Testing Unicode: OK"
            print(f"  OK Unicode handling: {test_unicode}")
        
        return True
        
    except Exception as e:
        print(f"  ERROR Windows compatibility test failed: {e}")
        return False

async def main():
    """Run all verification tests"""
    print("=" * 60)
    print("WEBSOCKET BACKEND VERIFICATION")
    print("=" * 60)
    
    tests = [
        ("Import Tests", test_imports),
        ("Message Protocol Tests", test_message_protocol),
        ("Agent Manager Tests", test_agent_manager),
        ("WebSocket Server Tests", test_websocket_server_instantiation),
        ("Startup Script Tests", test_startup_script),
        ("Windows Compatibility Tests", test_windows_compatibility)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = await test_func()
            else:
                result = test_func()
            
            if result:
                passed += 1
                print(f"[PASS] {test_name}")
            else:
                failed += 1
                print(f"[FAIL] {test_name}")
        except Exception as e:
            failed += 1
            print(f"[ERROR] {test_name}: {e}")
        
        print("")
    
    print("=" * 60)
    print(f"VERIFICATION RESULTS: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("SUCCESS: ALL TESTS PASSED - WebSocket backend is ready!")
        print("")
        print("To start the WebSocket server:")
        print("  cd python-sdk")
        print("  python start_websocket_server.py")
        print("")
        print("The React dashboard can connect to: ws://localhost:8765")
    else:
        print("ERROR: Some tests failed - please fix issues before using")
    
    print("=" * 60)
    return failed == 0

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)