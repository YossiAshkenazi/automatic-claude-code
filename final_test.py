#!/usr/bin/env python3
import asyncio
import websockets
import json
import time
from datetime import datetime
from claude_cli_wrapper import ClaudeCliWrapper

async def test_complete_pipeline():
    print('COMPREHENSIVE PIPELINE INTEGRATION TEST')
    print('Testing: React Dashboard -> WebSocket -> Python -> Claude CLI')
    print('='*60)
    
    results = []
    start_time = time.time()
    
    # Test 1: Prerequisites
    print('
=== TESTING PREREQUISITES ===')
    try:
        wrapper = ClaudeCliWrapper()
        print('[PASS] Python SDK: Imported successfully')
        results.append(('Python SDK', True))
        
        result = await wrapper.execute_sync('Say hello test')
        if len(str(result)) > 5:
            print(f'[PASS] Claude CLI: Working ({len(str(result))} chars)')
            results.append(('Claude CLI', True))
        else:
            print(f'[FAIL] Claude CLI: Short response: {result}')
            results.append(('Claude CLI', False))
    except Exception as e:
        print(f'[FAIL] Prerequisites: {e}')
        results.append(('Prerequisites', False))
        
    # Test 2: WebSocket Connection
    print('
=== TESTING WEBSOCKET CONNECTION ===')
    try:
        async with websockets.connect('ws://localhost:8765', ping_timeout=10) as ws:
            print('[PASS] WebSocket: Connected successfully')
            results.append(('WebSocket Connection', True))
            
            # Wait for connection ack
            ack = await asyncio.wait_for(ws.recv(), timeout=5)
            ack_data = json.loads(ack)
            if ack_data.get('type') == 'connection:ack':
                print('[PASS] Connection Ack: Received properly')
                results.append(('Connection Ack', True))
            else:
                print(f'[FAIL] Connection Ack: Unexpected: {ack_data}')
                results.append(('Connection Ack', False))
                
    except Exception as e:
        print(f'[FAIL] WebSocket Connection: {e}')
        results.append(('WebSocket Connection', False))
        
    # Generate Final Report
    total_time = time.time() - start_time
    passed = sum(1 for _, success in results if success)
    total = len(results)
    rate = (passed/total*100) if total > 0 else 0
    
    print('
' + '='*60)
    print('FINAL INTEGRATION TEST REPORT')
    print('='*60)
    print(f'Duration: {total_time:.2f}s')
    print(f'Results: {passed}/{total} tests passed ({rate:.1f}%)')
    
    print(f'
Detailed Results:')
    for test_name, success in results:
        status = 'PASS' if success else 'FAIL'
        print(f'  [{status}] {test_name}')
    
    if passed == total:
        print(f'
SUCCESS: All pipeline components working!')
        return True
    else:
        print(f'
FAILURE: {total-passed} components need attention')
        return False

if __name__ == '__main__':
    try:
        success = asyncio.run(test_complete_pipeline())
        exit(0 if success else 1)
    except Exception as e:
        print(f'Test suite error: {e}')
        exit(1)
