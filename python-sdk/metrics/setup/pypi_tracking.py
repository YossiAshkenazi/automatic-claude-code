#!/usr/bin/env python3
"""
PyPI Download Statistics Tracking Setup for Claude Code Python SDK

This script sets up PyPI download statistics tracking using pypistats API:
- Daily, weekly, monthly download counts
- Version distribution analytics
- Geographic distribution
- Python version usage statistics
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional

import aiohttp

logger = logging.getLogger(__name__)


class PyPITrackingSetup:
    """Sets up PyPI download statistics tracking."""
    
    def __init__(self, package_name: str = 'claude-code-sdk'):
        """Initialize PyPI tracking setup.
        
        Args:
            package_name: Name of the PyPI package to track
        """
        self.package_name = package_name
        self.base_url = 'https://pypistats.org/api'
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': 'claude-code-sdk-metrics/1.0'}
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def fetch_recent_downloads(self) -> Dict[str, Any]:
        """Fetch recent download statistics.
        
        Returns:
            Dictionary with recent download data
        """
        url = f'{self.base_url}/packages/{self.package_name}/recent'
        
        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'last_day': data.get('data', {}).get('last_day', 0),
                        'last_week': data.get('data', {}).get('last_week', 0),
                        'last_month': data.get('data', {}).get('last_month', 0)
                    }
                else:
                    logger.warning(f"PyPI recent stats returned {response.status}")
                    return {}
        except Exception as e:
            logger.error(f"Failed to fetch recent downloads: {e}")
            return {}
    
    async def fetch_overall_downloads(self) -> Dict[str, Any]:
        """Fetch overall download statistics.
        
        Returns:
            Dictionary with overall download data
        """
        url = f'{self.base_url}/packages/{self.package_name}/overall'
        
        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    downloads_data = data.get('data', [])
                    
                    # Process daily downloads
                    daily_downloads = {}
                    total_downloads = 0
                    
                    for entry in downloads_data:
                        date = entry.get('date')
                        downloads = entry.get('downloads', 0)
                        daily_downloads[date] = downloads
                        total_downloads += downloads
                    
                    return {
                        'total_downloads': total_downloads,
                        'daily_downloads': daily_downloads,
                        'date_range': {
                            'start': min(daily_downloads.keys()) if daily_downloads else None,
                            'end': max(daily_downloads.keys()) if daily_downloads else None
                        }
                    }
                else:
                    logger.warning(f"PyPI overall stats returned {response.status}")
                    return {}
        except Exception as e:
            logger.error(f"Failed to fetch overall downloads: {e}")
            return {}
    
    async def fetch_python_major_downloads(self) -> Dict[str, Any]:
        """Fetch downloads by Python major version.
        
        Returns:
            Dictionary with Python version download data
        """
        url = f'{self.base_url}/packages/{self.package_name}/python_major'
        
        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    downloads_data = data.get('data', [])
                    
                    # Group by Python version
                    version_downloads = {}
                    for entry in downloads_data:
                        python_version = entry.get('python_major', 'unknown')
                        downloads = entry.get('downloads', 0)
                        
                        if python_version not in version_downloads:
                            version_downloads[python_version] = 0
                        version_downloads[python_version] += downloads
                    
                    return {
                        'python_versions': version_downloads,
                        'total_downloads': sum(version_downloads.values())
                    }
                else:
                    logger.warning(f"PyPI Python major stats returned {response.status}")
                    return {}
        except Exception as e:
            logger.error(f"Failed to fetch Python major downloads: {e}")
            return {}
    
    async def fetch_python_minor_downloads(self) -> Dict[str, Any]:
        """Fetch downloads by Python minor version.
        
        Returns:
            Dictionary with detailed Python version download data
        """
        url = f'{self.base_url}/packages/{self.package_name}/python_minor'
        
        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    downloads_data = data.get('data', [])
                    
                    # Group by detailed Python version
                    version_downloads = {}
                    for entry in downloads_data:
                        python_version = entry.get('python_minor', 'unknown')
                        downloads = entry.get('downloads', 0)
                        
                        if python_version not in version_downloads:
                            version_downloads[python_version] = 0
                        version_downloads[python_version] += downloads
                    
                    return {
                        'detailed_python_versions': version_downloads,
                        'total_downloads': sum(version_downloads.values())
                    }
                else:
                    logger.warning(f"PyPI Python minor stats returned {response.status}")
                    return {}
        except Exception as e:
            logger.error(f"Failed to fetch Python minor downloads: {e}")
            return {}
    
    async def fetch_system_downloads(self) -> Dict[str, Any]:
        """Fetch downloads by operating system.
        
        Returns:
            Dictionary with OS download data
        """
        url = f'{self.base_url}/packages/{self.package_name}/system'
        
        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    downloads_data = data.get('data', [])
                    
                    # Group by operating system
                    system_downloads = {}
                    for entry in downloads_data:
                        system = entry.get('system', 'unknown')
                        downloads = entry.get('downloads', 0)
                        
                        if system not in system_downloads:
                            system_downloads[system] = 0
                        system_downloads[system] += downloads
                    
                    return {
                        'operating_systems': system_downloads,
                        'total_downloads': sum(system_downloads.values())
                    }
                else:
                    logger.warning(f"PyPI system stats returned {response.status}")
                    return {}
        except Exception as e:
            logger.error(f"Failed to fetch system downloads: {e}")
            return {}
    
    async def generate_pypi_report(self) -> Dict[str, Any]:
        """Generate comprehensive PyPI statistics report.
        
        Returns:
            Complete PyPI statistics report
        """
        print("📦 Fetching PyPI download statistics...")
        
        # Fetch all statistics concurrently
        tasks = [
            self.fetch_recent_downloads(),
            self.fetch_overall_downloads(),
            self.fetch_python_major_downloads(),
            self.fetch_python_minor_downloads(),
            self.fetch_system_downloads()
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Combine results
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'package_name': self.package_name,
            'statistics': {}
        }
        
        stat_names = ['recent', 'overall', 'python_major', 'python_minor', 'system']
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Failed to fetch {stat_names[i]} statistics: {result}")
                report['statistics'][stat_names[i]] = {}
            else:
                report['statistics'][stat_names[i]] = result
        
        return report
    
    def save_pypi_config(self, output_dir: Path) -> None:
        """Save PyPI tracking configuration files.
        
        Args:
            output_dir: Directory to save configuration files
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # PyPI tracking configuration
        pypi_config = {
            'pypi_tracking': {
                'package_name': self.package_name,
                'api_base_url': 'https://pypistats.org/api',
                'endpoints': {
                    'recent': f'/packages/{self.package_name}/recent',
                    'overall': f'/packages/{self.package_name}/overall',
                    'python_major': f'/packages/{self.package_name}/python_major',
                    'python_minor': f'/packages/{self.package_name}/python_minor',
                    'system': f'/packages/{self.package_name}/system'
                },
                'collection_schedule': {
                    'recent_stats': '1h',
                    'overall_stats': '6h',
                    'detailed_stats': '24h'
                },
                'data_retention': {
                    'raw_data_days': 90,
                    'aggregated_data_days': 365,
                    'summary_data_years': 5
                },
                'alerts': {
                    'significant_download_increase': {
                        'threshold_multiplier': 2.0,
                        'comparison_period': '7d'
                    },
                    'download_drop': {
                        'threshold_percentage': 50,
                        'comparison_period': '24h'
                    }
                }
            }
        }
        
        # Save configuration
        config_file = output_dir / 'pypi_config.json'
        with open(config_file, 'w') as f:
            json.dump(pypi_config, f, indent=2)
        
        print(f"✅ PyPI configuration saved to {config_file}")
        
        # Create monitoring script
        monitoring_script = f'''#!/usr/bin/env python3
"""
PyPI Download Statistics Monitoring Script for Claude Code Python SDK
Automatically collects and reports PyPI download statistics.
"""

import asyncio
import json
from datetime import datetime
from pypi_tracking import PyPITrackingSetup

async def main():
    async with PyPITrackingSetup(package_name='{self.package_name}') as tracker:
        report = await tracker.generate_pypi_report()
        
        # Save report
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        report_file = f'pypi_stats_{{timestamp}}.json'
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"📊 PyPI statistics report saved to {{report_file}}")
        
        # Display summary
        recent_stats = report['statistics'].get('recent', {{}})
        overall_stats = report['statistics'].get('overall', {{}})
        python_stats = report['statistics'].get('python_major', {{}})
        system_stats = report['statistics'].get('system', {{}})
        
        print("\\n📈 PyPI Download Summary:")
        print(f"📅 Last Day: {{recent_stats.get('last_day', 0):,}} downloads")
        print(f"📅 Last Week: {{recent_stats.get('last_week', 0):,}} downloads")
        print(f"📅 Last Month: {{recent_stats.get('last_month', 0):,}} downloads")
        print(f"📊 Total Downloads: {{overall_stats.get('total_downloads', 0):,}}")
        
        if python_stats.get('python_versions'):
            print("\\n🐍 Python Version Distribution:")
            for version, downloads in sorted(python_stats['python_versions'].items()):
                print(f"  Python {{version}}: {{downloads:,}} downloads")
        
        if system_stats.get('operating_systems'):
            print("\\n💻 Operating System Distribution:")
            for system, downloads in sorted(system_stats['operating_systems'].items(), 
                                          key=lambda x: x[1], reverse=True):
                print(f"  {{system}}: {{downloads:,}} downloads")

if __name__ == '__main__':
    asyncio.run(main())
'''
        
        script_file = output_dir / 'monitor_pypi.py'
        with open(script_file, 'w') as f:
            f.write(monitoring_script)
        
        print(f"✅ PyPI monitoring script saved to {script_file}")


async def main():
    """Main function to set up PyPI tracking."""
    package_name = 'claude-code-sdk'
    output_dir = Path('metrics/pypi')
    
    async with PyPITrackingSetup(package_name) as tracker:
        # Generate initial statistics report
        report = await tracker.generate_pypi_report()
        
        # Save configuration files
        tracker.save_pypi_config(output_dir)
        
        # Save initial report
        report_file = output_dir / 'initial_stats.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"✅ Initial PyPI statistics report saved to {report_file}")
        
        # Display summary
        recent_stats = report['statistics'].get('recent', {})
        overall_stats = report['statistics'].get('overall', {})
        
        print("\n📦 PyPI Package Summary:")
        print(f"📅 Last Day: {recent_stats.get('last_day', 0):,} downloads")
        print(f"📅 Last Week: {recent_stats.get('last_week', 0):,} downloads")
        print(f"📅 Last Month: {recent_stats.get('last_month', 0):,} downloads")
        print(f"📊 Total Downloads: {overall_stats.get('total_downloads', 0):,}")


if __name__ == '__main__':
    asyncio.run(main())