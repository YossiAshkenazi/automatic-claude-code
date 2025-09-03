#!/usr/bin/env python3
"""
Platform Health Check Utility
==============================

Simple utility to check the health status of all Visual Agent Management Platform components.
Can be used independently or as part of the startup system.

Usage:
    python platform_health_check.py
    python platform_health_check.py --component python_backend
    python platform_health_check.py --json
"""

import json
import requests
import socket
import sys
import time
from datetime import datetime
from typing import Dict, Optional, Tuple
import argparse

class HealthChecker:
    """Health checker for platform components"""
    
    COMPONENTS = {
        'python_backend': {
            'name': 'Python Backend/WebSocket Server',
            'port': 8765,
            'health_url': None,  # WebSocket, not HTTP
            'description': 'Agent orchestration and WebSocket communication'
        },
        'react_dashboard': {
            'name': 'React Dashboard',
            'port': 6011,
            'health_url': 'http://localhost:6011',
            'description': 'Visual interface for agent management'
        },
        'api_server': {
            'name': 'API Server',
            'port': 4005,
            'health_url': 'http://localhost:4005/health',
            'description': 'REST API for dashboard backend'
        },
        'hooks_server': {
            'name': 'Hooks Monitoring Server',
            'port': 4000,
            'health_url': 'http://localhost:4000/health',
            'description': 'Event monitoring and observability'
        }
    }
    
    @staticmethod
    def check_port(port: int, timeout: float = 3.0) -> bool:
        """Check if a port is being listened on"""
        try:
            with socket.create_connection(('localhost', port), timeout):
                return True
        except (socket.timeout, ConnectionRefusedError, OSError):
            return False
    
    @staticmethod
    def check_http_health(url: str, timeout: float = 5.0) -> Tuple[bool, Optional[str]]:
        """Check HTTP health endpoint"""
        try:
            response = requests.get(url, timeout=timeout)
            if response.status_code == 200:
                return True, "OK"
            else:
                return False, f"HTTP {response.status_code}"
        except requests.exceptions.Timeout:
            return False, "Timeout"
        except requests.exceptions.ConnectionError:
            return False, "Connection refused"
        except Exception as e:
            return False, str(e)
    
    def check_component(self, component_id: str) -> Dict:
        """Check health of a single component"""
        if component_id not in self.COMPONENTS:
            return {
                'component': component_id,
                'status': 'unknown',
                'error': 'Unknown component'
            }
        
        config = self.COMPONENTS[component_id]
        result = {
            'component': component_id,
            'name': config['name'],
            'port': config['port'],
            'description': config['description'],
            'timestamp': datetime.now().isoformat(),
            'status': 'unknown',
            'details': {}
        }
        
        # Check port first
        port_open = self.check_port(config['port'])
        result['details']['port_open'] = port_open
        
        if not port_open:
            result['status'] = 'down'
            result['details']['error'] = f"Port {config['port']} not responding"
            return result
        
        # Check HTTP health if available
        if config['health_url']:
            http_healthy, http_message = self.check_http_health(config['health_url'])
            result['details']['http_health'] = http_healthy
            result['details']['http_message'] = http_message
            
            if http_healthy:
                result['status'] = 'healthy'
            else:
                result['status'] = 'unhealthy'
                result['details']['error'] = f"HTTP health check failed: {http_message}"
        else:
            # For WebSocket or other non-HTTP services, port check is sufficient
            result['status'] = 'healthy'
            result['details']['note'] = 'Non-HTTP service, port check only'
        
        return result
    
    def check_all_components(self) -> Dict:
        """Check health of all components"""
        results = {
            'timestamp': datetime.now().isoformat(),
            'overall_status': 'healthy',
            'components': {},
            'summary': {
                'total': len(self.COMPONENTS),
                'healthy': 0,
                'unhealthy': 0,
                'down': 0
            }
        }
        
        for component_id in self.COMPONENTS:
            component_result = self.check_component(component_id)
            results['components'][component_id] = component_result
            
            # Update summary
            status = component_result['status']
            if status == 'healthy':
                results['summary']['healthy'] += 1
            elif status == 'unhealthy':
                results['summary']['unhealthy'] += 1
            elif status == 'down':
                results['summary']['down'] += 1
        
        # Determine overall status
        if results['summary']['down'] > 0:
            results['overall_status'] = 'degraded'
        elif results['summary']['unhealthy'] > 0:
            results['overall_status'] = 'unhealthy'
        elif results['summary']['healthy'] == 0:
            results['overall_status'] = 'down'
        
        return results
    
    def print_component_status(self, result: Dict, verbose: bool = False):
        """Print human-readable component status"""
        status = result['status']
        name = result['name']
        port = result['port']
        
        # Status emoji and color
        if status == 'healthy':
            emoji = "✅"
        elif status == 'unhealthy':
            emoji = "⚠️ "
        elif status == 'down':
            emoji = "❌"
        else:
            emoji = "❓"
        
        print(f"{emoji} {name:<30} Port {port:<5} [{status.upper()}]")
        
        if verbose or status != 'healthy':
            details = result.get('details', {})
            if 'error' in details:
                print(f"   └─ Error: {details['error']}")
            elif 'http_message' in details:
                print(f"   └─ HTTP: {details['http_message']}")
            elif 'note' in details:
                print(f"   └─ Note: {details['note']}")
        
        if verbose:
            print(f"   └─ Description: {result['description']}")
    
    def print_health_report(self, results: Dict, verbose: bool = False):
        """Print human-readable health report"""
        print("=" * 70)
        print("🏥 Visual Agent Management Platform - Health Check")
        print("=" * 70)
        print(f"📅 Timestamp: {results['timestamp']}")
        print(f"🎯 Overall Status: {results['overall_status'].upper()}")
        print()
        
        # Summary
        summary = results['summary']
        print("📊 Summary:")
        print(f"   Total Components: {summary['total']}")
        print(f"   Healthy:         {summary['healthy']}")
        print(f"   Unhealthy:       {summary['unhealthy']}")
        print(f"   Down:            {summary['down']}")
        print()
        
        # Component details
        print("🔍 Component Status:")
        for component_id, component_result in results['components'].items():
            self.print_component_status(component_result, verbose)
        
        print()
        print("=" * 70)
        
        # Recommendations
        unhealthy_components = [
            comp for comp in results['components'].values()
            if comp['status'] in ['unhealthy', 'down']
        ]
        
        if unhealthy_components:
            print("💡 Recommendations:")
            for comp in unhealthy_components:
                if comp['status'] == 'down':
                    print(f"   • Start {comp['name']} on port {comp['port']}")
                else:
                    print(f"   • Check {comp['name']} configuration and logs")
            print()

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Health check utility for Visual Agent Management Platform"
    )
    parser.add_argument(
        '--component', '-c',
        help="Check specific component only",
        choices=list(HealthChecker.COMPONENTS.keys())
    )
    parser.add_argument(
        '--json', '-j',
        action='store_true',
        help="Output results as JSON"
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help="Show detailed information"
    )
    parser.add_argument(
        '--continuous', '-w',
        type=int,
        metavar='SECONDS',
        help="Continuous monitoring with specified interval"
    )
    
    args = parser.parse_args()
    
    checker = HealthChecker()
    
    def run_check():
        if args.component:
            # Single component check
            result = checker.check_component(args.component)
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                checker.print_component_status(result, args.verbose)
            return result['status'] != 'down'
        else:
            # All components check
            results = checker.check_all_components()
            if args.json:
                print(json.dumps(results, indent=2))
            else:
                checker.print_health_report(results, args.verbose)
            return results['overall_status'] not in ['down', 'degraded']
    
    if args.continuous:
        print(f"🔄 Continuous monitoring every {args.continuous} seconds (Ctrl+C to stop)")
        print()
        try:
            while True:
                if not args.json:
                    print(f"\r🕐 {datetime.now().strftime('%H:%M:%S')} - ", end="")
                
                healthy = run_check()
                
                if not args.json:
                    print("=" * 50)
                
                time.sleep(args.continuous)
        except KeyboardInterrupt:
            print("\n👋 Monitoring stopped")
            return 0
    else:
        healthy = run_check()
        return 0 if healthy else 1

if __name__ == "__main__":
    try:
        # Install requests if not available
        import requests
    except ImportError:
        print("Installing requests library...")
        import subprocess
        import sys
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'requests'])
        import requests
    
    sys.exit(main())