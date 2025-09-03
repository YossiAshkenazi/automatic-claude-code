#!/usr/bin/env python3
"""
Simple Integration Test
Tests basic Python SDK integration capabilities
"""

import requests
import json
from datetime import datetime
from claude_code_sdk.integrations import AutomaticClaudeIntegration

def test_monitoring_server():
    """Check if monitoring server is running"""
    print("Testing Monitoring Server Connection")
    print("-" * 40)
    
    # Try different ports where monitoring might be running
    ports = [4001, 4005, 4000, 3001]
    
    for port in ports:
        try:
            response = requests.get(f"http://localhost:{port}/api/health", timeout=3)
            if response.status_code == 200:
                print(f"[FOUND] Monitoring server running on port {port}")
                try:
                    data = response.json()
                    print(f"[INFO] Server response: {data}")
                except:
                    print("[INFO] Server responded with non-JSON data")
                return True, port
        except requests.exceptions.RequestException as e:
            print(f"[SKIP] Port {port}: {type(e).__name__}")
    
    print("[INFO] No monitoring server found on standard ports")
    return False, None

def test_dashboard():
    """Check if dashboard is running"""
    print("\nTesting Dashboard Connection")
    print("-" * 40)
    
    # Try different ports where dashboard might be running
    ports = [6011, 3000, 5173, 4173]
    
    for port in ports:
        try:
            response = requests.get(f"http://localhost:{port}", timeout=3)
            if response.status_code == 200:
                print(f"[FOUND] Dashboard running on port {port}")
                return True, port
        except requests.exceptions.RequestException as e:
            print(f"[SKIP] Port {port}: {type(e).__name__}")
    
    print("[INFO] No dashboard found on standard ports")
    return False, None

def test_integration_class():
    """Test the AutomaticClaudeIntegration class"""
    print("\nTesting Integration Class")
    print("-" * 40)
    
    try:
        # Create integration instance
        integration = AutomaticClaudeIntegration()
        print("[PASS] AutomaticClaudeIntegration created")
        
        # Test basic properties
        print(f"[INFO] Dashboard URL: {integration.dashboard_url}")
        print(f"[INFO] API URL: {integration.api_url}")
        
        # Test statistics
        stats = integration.get_statistics()
        print(f"[PASS] Statistics retrieved: {len(stats)} metrics")
        
        # Show some stats
        for key, value in stats.items():
            print(f"[STAT] {key}: {value}")
        
        return True
        
    except Exception as e:
        print(f"[FAIL] Integration class test failed: {e}")
        return False

def main():
    """Run all integration tests"""
    print("Python SDK Integration Test")
    print("=" * 50)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run tests
    server_running, server_port = test_monitoring_server()
    dashboard_running, dashboard_port = test_dashboard()
    integration_working = test_integration_class()
    
    # Summary
    print("\n" + "=" * 50)
    print("INTEGRATION TEST SUMMARY")
    print("=" * 50)
    
    if server_running:
        print(f"[OPERATIONAL] Monitoring Server (port {server_port})")
    else:
        print("[NOT RUNNING] Monitoring Server")
    
    if dashboard_running:
        print(f"[OPERATIONAL] Dashboard (port {dashboard_port})")
    else:
        print("[NOT RUNNING] Dashboard")
    
    if integration_working:
        print("[WORKING] Python SDK Integration")
    else:
        print("[FAILED] Python SDK Integration")
    
    # Recommendations
    print("\n" + "=" * 50)
    print("RECOMMENDATIONS")
    print("=" * 50)
    
    if not server_running and not dashboard_running:
        print("To start the monitoring system:")
        print("  cd dual-agent-monitor")
        print("  pnpm install")
        print("  pnpm run dev")
        print()
    
    if integration_working:
        print("The Python SDK is ready to integrate with automatic-claude-code!")
        print("Features available:")
        print("- Session tracking")
        print("- Statistics collection") 
        print("- Event monitoring")
        if server_running:
            print("- Real-time WebSocket communication")
    
    print("\nIntegration test completed!")

if __name__ == "__main__":
    main()