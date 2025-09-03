#!/usr/bin/env python3
"""
GitHub Insights Dashboard Setup for Claude Code Python SDK

This script sets up GitHub repository insights tracking including:
- Stars, forks, issues, PRs
- Traffic analytics (views, clones)
- Release metrics
- Contributor statistics
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List

import aiohttp

logger = logging.getLogger(__name__)


class GitHubInsightsSetup:
    """Sets up GitHub repository insights tracking."""
    
    def __init__(self, repo_owner: str, repo_name: str, github_token: str = None):
        """Initialize GitHub insights setup.
        
        Args:
            repo_owner: Repository owner (e.g., 'yossiashkenazi')
            repo_name: Repository name (e.g., 'automatic-claude-code')
            github_token: GitHub API token (optional, from env if not provided)
        """
        self.repo_owner = repo_owner
        self.repo_name = repo_name
        self.github_token = github_token or os.getenv('GITHUB_TOKEN')
        self.base_url = 'https://api.github.com'
        self.session: aiohttp.ClientSession = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        headers = {'Accept': 'application/vnd.github.v3+json'}
        if self.github_token:
            headers['Authorization'] = f'token {self.github_token}'
            
        self.session = aiohttp.ClientSession(
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def fetch_repository_metrics(self) -> Dict[str, Any]:
        """Fetch basic repository metrics.
        
        Returns:
            Dictionary with repository metrics
        """
        url = f'{self.base_url}/repos/{self.repo_owner}/{self.repo_name}'
        
        async with self.session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    'stars': data.get('stargazers_count', 0),
                    'forks': data.get('forks_count', 0),
                    'watchers': data.get('watchers_count', 0),
                    'open_issues': data.get('open_issues_count', 0),
                    'size': data.get('size', 0),
                    'created_at': data.get('created_at'),
                    'updated_at': data.get('updated_at'),
                    'pushed_at': data.get('pushed_at'),
                    'language': data.get('language'),
                    'has_wiki': data.get('has_wiki'),
                    'has_pages': data.get('has_pages'),
                    'has_downloads': data.get('has_downloads')
                }
            else:
                logger.error(f"Failed to fetch repository metrics: {response.status}")
                return {}
    
    async def fetch_traffic_metrics(self) -> Dict[str, Any]:
        """Fetch repository traffic metrics.
        
        Returns:
            Dictionary with traffic metrics
        """
        metrics = {}
        
        # Fetch views
        views_url = f'{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/traffic/views'
        async with self.session.get(views_url) as response:
            if response.status == 200:
                views_data = await response.json()
                metrics['views'] = {
                    'count': views_data.get('count', 0),
                    'uniques': views_data.get('uniques', 0),
                    'daily_views': views_data.get('views', [])
                }
        
        # Fetch clones
        clones_url = f'{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/traffic/clones'
        async with self.session.get(clones_url) as response:
            if response.status == 200:
                clones_data = await response.json()
                metrics['clones'] = {
                    'count': clones_data.get('count', 0),
                    'uniques': clones_data.get('uniques', 0),
                    'daily_clones': clones_data.get('clones', [])
                }
        
        # Fetch referrers
        referrers_url = f'{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/traffic/popular/referrers'
        async with self.session.get(referrers_url) as response:
            if response.status == 200:
                metrics['referrers'] = await response.json()
        
        # Fetch popular paths
        paths_url = f'{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/traffic/popular/paths'
        async with self.session.get(paths_url) as response:
            if response.status == 200:
                metrics['popular_paths'] = await response.json()
        
        return metrics
    
    async def fetch_issues_and_prs(self) -> Dict[str, Any]:
        """Fetch issues and pull requests metrics.
        
        Returns:
            Dictionary with issues and PR metrics
        """
        metrics = {}
        
        # Fetch open issues
        issues_url = f'{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/issues'
        params = {'state': 'open', 'per_page': 100}
        
        async with self.session.get(issues_url, params=params) as response:
            if response.status == 200:
                issues = await response.json()
                
                # Separate issues from PRs
                actual_issues = [issue for issue in issues if 'pull_request' not in issue]
                pull_requests = [issue for issue in issues if 'pull_request' in issue]
                
                metrics['issues'] = {
                    'open_count': len(actual_issues),
                    'recent_issues': actual_issues[:10]  # Last 10 issues
                }
                
                metrics['pull_requests'] = {
                    'open_count': len(pull_requests),
                    'recent_prs': pull_requests[:10]  # Last 10 PRs
                }
        
        return metrics
    
    async def fetch_releases(self) -> Dict[str, Any]:
        """Fetch repository releases.
        
        Returns:
            Dictionary with release metrics
        """
        url = f'{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/releases'
        
        async with self.session.get(url) as response:
            if response.status == 200:
                releases = await response.json()
                
                return {
                    'total_releases': len(releases),
                    'latest_release': releases[0] if releases else None,
                    'recent_releases': releases[:5]  # Last 5 releases
                }
            else:
                return {'total_releases': 0}
    
    async def fetch_contributors(self) -> Dict[str, Any]:
        """Fetch repository contributors.
        
        Returns:
            Dictionary with contributor metrics
        """
        url = f'{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/contributors'
        
        async with self.session.get(url) as response:
            if response.status == 200:
                contributors = await response.json()
                
                return {
                    'total_contributors': len(contributors),
                    'top_contributors': contributors[:10]  # Top 10 contributors
                }
            else:
                return {'total_contributors': 0}
    
    async def generate_insights_report(self) -> Dict[str, Any]:
        """Generate comprehensive GitHub insights report.
        
        Returns:
            Complete insights report
        """
        print("🔍 Fetching GitHub repository insights...")
        
        # Fetch all metrics concurrently
        tasks = [
            self.fetch_repository_metrics(),
            self.fetch_traffic_metrics(),
            self.fetch_issues_and_prs(),
            self.fetch_releases(),
            self.fetch_contributors()
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Combine results
        insights_report = {
            'timestamp': datetime.utcnow().isoformat(),
            'repository': f'{self.repo_owner}/{self.repo_name}',
            'metrics': {}
        }
        
        metric_names = ['repository', 'traffic', 'issues_prs', 'releases', 'contributors']
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Failed to fetch {metric_names[i]} metrics: {result}")
                insights_report['metrics'][metric_names[i]] = {}
            else:
                insights_report['metrics'][metric_names[i]] = result
        
        return insights_report
    
    def save_insights_config(self, output_dir: Path) -> None:
        """Save GitHub insights configuration files.
        
        Args:
            output_dir: Directory to save configuration files
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # GitHub API configuration
        github_config = {
            'github_api': {
                'base_url': 'https://api.github.com',
                'repository': f'{self.repo_owner}/{self.repo_name}',
                'endpoints': {
                    'repository': f'/repos/{self.repo_owner}/{self.repo_name}',
                    'traffic_views': f'/repos/{self.repo_owner}/{self.repo_name}/traffic/views',
                    'traffic_clones': f'/repos/{self.repo_owner}/{self.repo_name}/traffic/clones',
                    'traffic_referrers': f'/repos/{self.repo_owner}/{self.repo_name}/traffic/popular/referrers',
                    'traffic_paths': f'/repos/{self.repo_owner}/{self.repo_name}/traffic/popular/paths',
                    'issues': f'/repos/{self.repo_owner}/{self.repo_name}/issues',
                    'releases': f'/repos/{self.repo_owner}/{self.repo_name}/releases',
                    'contributors': f'/repos/{self.repo_owner}/{self.repo_name}/contributors'
                },
                'authentication': {
                    'type': 'token',
                    'token_env_var': 'GITHUB_TOKEN'
                },
                'rate_limits': {
                    'requests_per_hour': 5000,
                    'core_limit': 5000,
                    'search_limit': 30,
                    'graphql_limit': 5000
                },
                'collection_schedule': {
                    'basic_metrics': '1h',
                    'traffic_metrics': '6h',
                    'extended_metrics': '24h'
                }
            }
        }
        
        # Save configuration
        config_file = output_dir / 'github_config.json'
        with open(config_file, 'w') as f:
            json.dump(github_config, f, indent=2)
        
        print(f"✅ GitHub configuration saved to {config_file}")
        
        # Create monitoring script
        monitoring_script = f'''#!/usr/bin/env python3
"""
GitHub Insights Monitoring Script for Claude Code Python SDK
Automatically collects and reports GitHub repository metrics.
"""

import asyncio
import json
import os
from datetime import datetime
from github_insights import GitHubInsightsSetup

async def main():
    github_token = os.getenv('GITHUB_TOKEN')
    if not github_token:
        print("❌ GITHUB_TOKEN environment variable is required")
        return
    
    async with GitHubInsightsSetup(
        repo_owner='{self.repo_owner}',
        repo_name='{self.repo_name}',
        github_token=github_token
    ) as insights:
        report = await insights.generate_insights_report()
        
        # Save report
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        report_file = f'github_insights_{{timestamp}}.json'
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"📊 GitHub insights report saved to {{report_file}}")
        
        # Display summary
        repo_metrics = report['metrics'].get('repository', {{}})
        traffic_metrics = report['metrics'].get('traffic', {{}})
        
        print("\\n📈 Summary:")
        print(f"⭐ Stars: {{repo_metrics.get('stars', 0)}}")
        print(f"🍴 Forks: {{repo_metrics.get('forks', 0)}}")
        print(f"👁️ Views (14 days): {{traffic_metrics.get('views', {{}}).get('count', 0)}}")
        print(f"📥 Clones (14 days): {{traffic_metrics.get('clones', {{}}).get('count', 0)}}")

if __name__ == '__main__':
    asyncio.run(main())
'''
        
        script_file = output_dir / 'monitor_github.py'
        with open(script_file, 'w') as f:
            f.write(monitoring_script)
        
        print(f"✅ Monitoring script saved to {script_file}")


async def main():
    """Main function to set up GitHub insights."""
    repo_owner = 'yossiashkenazi'
    repo_name = 'automatic-claude-code'
    output_dir = Path('metrics/github')
    
    async with GitHubInsightsSetup(repo_owner, repo_name) as insights:
        # Generate initial insights report
        report = await insights.generate_insights_report()
        
        # Save configuration files
        insights.save_insights_config(output_dir)
        
        # Save initial report
        report_file = output_dir / 'initial_insights.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"✅ Initial GitHub insights report saved to {report_file}")
        
        # Display summary
        repo_metrics = report['metrics'].get('repository', {})
        traffic_metrics = report['metrics'].get('traffic', {})
        
        print("\n📊 GitHub Repository Summary:")
        print(f"⭐ Stars: {repo_metrics.get('stars', 0)}")
        print(f"🍴 Forks: {repo_metrics.get('forks', 0)}")
        print(f"👀 Watchers: {repo_metrics.get('watchers', 0)}")
        print(f"🐛 Open Issues: {repo_metrics.get('open_issues', 0)}")
        print(f"👁️ Views (14 days): {traffic_metrics.get('views', {}).get('count', 0)}")
        print(f"📥 Clones (14 days): {traffic_metrics.get('clones', {}).get('count', 0)}")


if __name__ == '__main__':
    asyncio.run(main())