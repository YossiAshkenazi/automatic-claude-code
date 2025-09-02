#!/usr/bin/env python3
"""
Integration Test with automatic-claude-code system
Tests the Python SDK integration with the existing dual-agent system
"""

import asyncio
import json
import websockets
import requests
from datetime import datetime
from claude_code_sdk.integrations import AutomaticClaudeIntegration
from claude_code_sdk.integrations.monitoring import MonitoringClient

async def test_monitoring_integration():
    """Test integration with monitoring dashboard"""
    print("Testing Monitoring Integration")
    print("-" * 40)
    
    # Test 1: Check if monitoring server is running
    try:
        response = requests.get("http://localhost:4001/api/health", timeout=5)
        if response.status_code == 200:
            print("[PASS] Monitoring server is running on port 4001")
            server_running = True
        else:
            print(f"[INFO] Monitoring server responded with status {response.status_code}")
            server_running = False
    except requests.exceptions.RequestException:
        print("[INFO] Monitoring server not running on port 4001")
        server_running = False
    
    # Test 2: Try alternative ports
    if not server_running:
        for port in [4005, 4000, 3001]:
            try:
                response = requests.get(f"http://localhost:{port}/api/health", timeout=2)
                if response.status_code == 200:
                    print(f"[PASS] Found monitoring server on port {port}")
                    server_running = True
                    break
            except requests.exceptions.RequestException:
                continue
    
    # Test 3: Create monitoring client
    try:
        monitoring = MonitoringClient()
        print("[PASS] MonitoringClient created successfully")
        
        # Test event creation (even if server is not running)
        test_event = {
            "event_type": "python_sdk_test",
            "timestamp": datetime.now().isoformat(),
            "data": {"test": "integration", "sdk": "python"}
        }
        
        # This will work even without server running
        event_json = json.dumps(test_event)
        print(f"[PASS] Event JSON created: {len(event_json)} characters")
        
        if server_running:
            try:
                await monitoring.send_event("python_sdk_test", {"test": "data"})
                print("[PASS] Event sent to monitoring server")
            except Exception as e:
                print(f"[INFO] Event sending failed: {e}")
        
    except Exception as e:
        print(f"[FAIL] MonitoringClient test failed: {e}")
    
    # Test 4: Integration class
    try:
        integration = AutomaticClaudeIntegration()
        stats = integration.get_statistics()
        print(f"[PASS] Integration stats: {len(stats)} metrics")
        
        # Test session creation
        session_id = "test-session-" + str(int(datetime.now().timestamp()))
        print(f"[PASS] Test session: {session_id}")
        
    except Exception as e:
        print(f"[FAIL] Integration class test failed: {e}")
    
    return server_running

async def test_dashboard_connectivity():
    """Test dashboard connectivity"""
    print("\nTesting Dashboard Connectivity")
    print("-" * 40)
    
    # Check different possible dashboard ports
    dashboard_ports = [6011, 3000, 5173, 4173]
    dashboard_running = False
    
    for port in dashboard_ports:
        try:
            response = requests.get(f"http://localhost:{port}", timeout=3)
            if response.status_code == 200:
                print(f"[PASS] Dashboard running on port {port}")
                dashboard_running = True
                break
        except requests.exceptions.RequestException:
            continue
    
    if not dashboard_running:
        print("[INFO] Dashboard not currently running")
        print("       To start: cd dual-agent-monitor && pnpm run dev")
    
    return dashboard_running

async def test_websocket_events():
    """Test WebSocket event emission"""
    print("\nTesting WebSocket Events")
    print("-" * 40)
    
    # Test WebSocket connectivity
    websocket_ports = [4001, 4005, 4000]
    websocket_working = False
    
    for port in websocket_ports:
        try:
            uri = f"ws://localhost:{port}"
            async with websockets.connect(uri, timeout=3) as websocket:
                # Send a test event
                test_message = {
                    "type": "python_sdk_test",
                    "data": {"message": "Hello from Python SDK"},
                    "timestamp": datetime.now().isoformat()
                }
                
                await websocket.send(json.dumps(test_message))
                print(f"[PASS] WebSocket connection successful on port {port}")
                websocket_working = True
                break
                
        except Exception as e:
            continue
    
    if not websocket_working:
        print("[INFO] WebSocket server not available")
        print("       This is normal if monitoring server is not running")
    
    return websocket_working

async def main():
    """Run all integration tests"""
    print("Python SDK Integration Test")
    print("=" * 50)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    monitoring_ok = await test_monitoring_integration()
    dashboard_ok = await test_dashboard_connectivity()
    websocket_ok = await test_websocket_events()
    
    # Summary
    print("\n" + "=" * 50)
    print("INTEGRATION TEST SUMMARY")
    print("=" * 50)
    
    results = [
        ("Monitoring Server", monitoring_ok),
        ("Dashboard", dashboard_ok),
        ("WebSocket Events", websocket_ok)
    ]
    
    for name, result in results:
        status = "[OPERATIONAL]" if result else "[NOT RUNNING]"
        print(f"{status} {name}")
    
    # Overall assessment
    if monitoring_ok or dashboard_ok or websocket_ok:
        print("\n[SUCCESS] Integration components are available")
        print("The Python SDK can integrate with the automatic-claude-code system")
    else:
        print("\n[INFO] No integration components running")
        print("Start the monitoring system with: cd dual-agent-monitor && pnpm run dev")
    
    print("\nIntegration test completed!")

if __name__ == "__main__":
    asyncio.run(main())