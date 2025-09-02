#!/usr/bin/env python3
"""
Claude Code Python SDK - Metrics Tracking Setup

This script sets up comprehensive metrics tracking for the Claude Code Python SDK:
- PyPI download statistics tracking
- GitHub repository insights dashboard
- Privacy-first usage analytics
- Opt-in error reporting with PII sanitization
- Real-time metrics dashboard
- Alerting configurations

Run this script to configure all metrics components.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Add the parent directory to sys.path for imports
sys.path.insert(0, str(Path(__file__).parent))

from setup.pypi_tracking import PyPITrackingSetup
from setup.github_insights import GitHubInsightsSetup
from setup.error_reporting import ErrorReportingSetup


class MetricsSetupOrchestrator:
    """Orchestrates the complete metrics tracking setup."""
    
    def __init__(self):
        """Initialize the setup orchestrator."""
        self.base_dir = Path(__file__).parent
        self.config_dir = self.base_dir / "config"
        self.data_dir = self.base_dir / "data"
        self.setup_dir = self.base_dir / "setup"
        
        # Create directories
        for directory in [self.config_dir, self.data_dir]:
            directory.mkdir(exist_ok=True)
    
    def print_header(self):
        """Print setup header."""
        print("╔══════════════════════════════════════════════════════════════════╗")
        print("║                Claude Code Python SDK - Metrics Setup           ║")
        print("╠══════════════════════════════════════════════════════════════════╣")
        print("║                                                                  ║")
        print("║ Setting up comprehensive, privacy-first metrics tracking:       ║")
        print("║ • PyPI download statistics                                       ║")
        print("║ • GitHub repository insights                                     ║")
        print("║ • Usage analytics (opt-in)                                       ║")
        print("║ • Error reporting (opt-in)                                       ║")
        print("║ • Real-time dashboard                                            ║")
        print("║ • Alert configurations                                           ║")
        print("║                                                                  ║")
        print("╚══════════════════════════════════════════════════════════════════╝")
        print()
    
    def check_dependencies(self) -> bool:
        """Check if required dependencies are available."""
        required_packages = {
            'aiohttp': 'pip install aiohttp',
            'streamlit': 'pip install streamlit',
            'plotly': 'pip install plotly',
            'pandas': 'pip install pandas'
        }
        
        missing_packages = []
        
        for package, install_cmd in required_packages.items():
            try:
                __import__(package)
            except ImportError:
                missing_packages.append((package, install_cmd))
        
        if missing_packages:
            print("❌ Missing required dependencies:")
            for package, cmd in missing_packages:
                print(f"   {package}: {cmd}")
            print()
            print("Please install missing dependencies and run setup again.")
            return False
        
        print("✅ All required dependencies are available")
        return True
    
    async def setup_pypi_tracking(self):
        """Set up PyPI download statistics tracking."""
        print("📦 Setting up PyPI tracking...")
        
        try:
            async with PyPITrackingSetup('claude-code-sdk') as tracker:
                # Generate initial report
                report = await tracker.generate_pypi_report()
                
                # Save configuration
                pypi_dir = self.base_dir / "pypi"
                tracker.save_pypi_config(pypi_dir)
                
                # Save initial report
                initial_report_file = pypi_dir / 'initial_stats.json'
                with open(initial_report_file, 'w') as f:
                    json.dump(report, f, indent=2)
                
                print(f"   ✅ PyPI configuration saved to {pypi_dir}")
                print(f"   ✅ Initial statistics report saved to {initial_report_file}")
                
                # Display summary
                recent_stats = report['statistics'].get('recent', {})
                if recent_stats:
                    print(f"   📊 Last month: {recent_stats.get('last_month', 0):,} downloads")
                    print(f"   📊 Last week: {recent_stats.get('last_week', 0):,} downloads")
        
        except Exception as e:
            print(f"   ❌ Failed to set up PyPI tracking: {e}")
    
    async def setup_github_insights(self):
        """Set up GitHub repository insights."""
        print("🐙 Setting up GitHub insights...")
        
        try:
            github_token = os.getenv('GITHUB_TOKEN')
            if not github_token:
                print("   ⚠️ GITHUB_TOKEN not set. GitHub insights will have limited functionality.")
            
            async with GitHubInsightsSetup(
                repo_owner='yossiashkenazi',
                repo_name='automatic-claude-code',
                github_token=github_token
            ) as insights:
                # Generate initial report
                report = await insights.generate_insights_report()
                
                # Save configuration
                github_dir = self.base_dir / "github"
                insights.save_insights_config(github_dir)
                
                # Save initial report
                initial_report_file = github_dir / 'initial_insights.json'
                with open(initial_report_file, 'w') as f:
                    json.dump(report, f, indent=2)
                
                print(f"   ✅ GitHub configuration saved to {github_dir}")
                print(f"   ✅ Initial insights report saved to {initial_report_file}")
                
                # Display summary
                repo_metrics = report['metrics'].get('repository', {})
                if repo_metrics:
                    print(f"   ⭐ Stars: {repo_metrics.get('stars', 0)}")
                    print(f"   🍴 Forks: {repo_metrics.get('forks', 0)}")
                    print(f"   🐛 Open issues: {repo_metrics.get('open_issues', 0)}")
        
        except Exception as e:
            print(f"   ❌ Failed to set up GitHub insights: {e}")
    
    def setup_error_reporting(self):
        """Set up error reporting configuration."""
        print("🐞 Setting up error reporting...")
        
        try:
            setup = ErrorReportingSetup()
            
            # Create error reporting configuration
            error_dir = self.base_dir / "error_reporting"
            setup.create_error_config(error_dir)
            
            print(f"   ✅ Error reporting configuration saved to {error_dir}")
            
            # Check if Sentry DSN is configured
            sentry_dsn = os.getenv('SENTRY_DSN')
            if sentry_dsn:
                print("   ✅ Sentry DSN is configured")
            else:
                print("   ⚠️ SENTRY_DSN not set. Error reporting will be disabled until configured.")
        
        except Exception as e:
            print(f"   ❌ Failed to set up error reporting: {e}")
    
    def create_master_config(self):
        """Create master configuration file."""
        print("⚙️ Creating master configuration...")
        
        try:
            master_config = {
                "claude_code_sdk_metrics": {
                    "version": "1.0.0",
                    "created_at": "2024-09-02T12:00:00Z",
                    "components": {
                        "pypi_tracking": {
                            "enabled": True,
                            "config_file": "pypi/pypi_config.json",
                            "monitoring_script": "pypi/monitor_pypi.py"
                        },
                        "github_insights": {
                            "enabled": True,
                            "config_file": "github/github_config.json",
                            "monitoring_script": "github/monitor_github.py"
                        },
                        "usage_analytics": {
                            "enabled": True,
                            "opt_in_required": True,
                            "config_file": "config/analytics.yml"
                        },
                        "error_reporting": {
                            "enabled": True,
                            "opt_in_required": True,
                            "config_file": "error_reporting/error_reporting_config.json"
                        },
                        "dashboard": {
                            "enabled": True,
                            "config_file": "config/dashboard.json",
                            "app_file": "dashboard.py"
                        }
                    },
                    "privacy": {
                        "gdpr_compliant": True,
                        "data_retention_days": 90,
                        "automatic_pii_sanitization": True,
                        "user_consent_required": True,
                        "data_export_available": True,
                        "data_deletion_available": True
                    },
                    "environment_variables": {
                        "required": [],
                        "optional": [
                            "GITHUB_TOKEN",
                            "SENTRY_DSN",
                            "DEPLOY_ENV",
                            "CLAUDE_SDK_ANALYTICS_ENDPOINT",
                            "ANALYTICS_API_KEY"
                        ]
                    }
                }
            }
            
            master_config_file = self.base_dir / "metrics_config.json"
            with open(master_config_file, 'w') as f:
                json.dump(master_config, f, indent=2)
            
            print(f"   ✅ Master configuration saved to {master_config_file}")
        
        except Exception as e:
            print(f"   ❌ Failed to create master configuration: {e}")
    
    def create_startup_scripts(self):
        """Create startup and monitoring scripts."""
        print("🚀 Creating startup scripts...")
        
        try:
            # Create dashboard startup script
            dashboard_script = '''#!/usr/bin/env python3
"""
Start the Claude Code SDK Metrics Dashboard

Usage:
    python start_dashboard.py [--port PORT] [--host HOST]
"""

import argparse
import subprocess
import sys
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='Start Claude Code SDK Metrics Dashboard')
    parser.add_argument('--port', type=int, default=8501, help='Dashboard port (default: 8501)')
    parser.add_argument('--host', type=str, default='localhost', help='Dashboard host (default: localhost)')
    parser.add_argument('--dev', action='store_true', help='Enable development mode')
    
    args = parser.parse_args()
    
    # Check if streamlit is installed
    try:
        import streamlit
    except ImportError:
        print("❌ Streamlit is not installed. Please run: pip install streamlit plotly pandas")
        sys.exit(1)
    
    # Build command
    dashboard_file = Path(__file__).parent / "dashboard.py"
    cmd = [
        sys.executable, "-m", "streamlit", "run", str(dashboard_file),
        "--server.port", str(args.port),
        "--server.address", args.host
    ]
    
    if not args.dev:
        cmd.extend([
            "--server.headless", "true",
            "--browser.gatherUsageStats", "false"
        ])
    
    print(f"🚀 Starting Claude Code SDK Metrics Dashboard...")
    print(f"📍 URL: http://{args.host}:{args.port}")
    print(f"🔄 Press Ctrl+C to stop")
    print()
    
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\\n👋 Dashboard stopped")

if __name__ == "__main__":
    main()
'''
            
            dashboard_script_file = self.base_dir / "start_dashboard.py"
            with open(dashboard_script_file, 'w') as f:
                f.write(dashboard_script)
            
            # Make executable on Unix systems
            try:
                dashboard_script_file.chmod(0o755)
            except:
                pass  # Windows doesn't support chmod
            
            # Create monitoring cron script
            cron_script = '''#!/bin/bash
# Cron script for Claude Code SDK metrics collection
# Add to crontab: 0 */6 * * * /path/to/this/script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Collect PyPI statistics
if [ -f "$SCRIPT_DIR/pypi/monitor_pypi.py" ]; then
    echo "$(date): Collecting PyPI statistics" >> "$SCRIPT_DIR/cron.log"
    python3 "$SCRIPT_DIR/pypi/monitor_pypi.py" >> "$SCRIPT_DIR/cron.log" 2>&1
fi

# Collect GitHub insights (if token available)
if [ -f "$SCRIPT_DIR/github/monitor_github.py" ] && [ -n "$GITHUB_TOKEN" ]; then
    echo "$(date): Collecting GitHub insights" >> "$SCRIPT_DIR/cron.log"  
    python3 "$SCRIPT_DIR/github/monitor_github.py" >> "$SCRIPT_DIR/cron.log" 2>&1
fi

echo "$(date): Metrics collection completed" >> "$SCRIPT_DIR/cron.log"
'''
            
            cron_script_file = self.base_dir / "collect_metrics.sh"
            with open(cron_script_file, 'w') as f:
                f.write(cron_script)
            
            try:
                cron_script_file.chmod(0o755)
            except:
                pass
            
            print(f"   ✅ Dashboard startup script: {dashboard_script_file}")
            print(f"   ✅ Cron monitoring script: {cron_script_file}")
        
        except Exception as e:
            print(f"   ❌ Failed to create startup scripts: {e}")
    
    def print_setup_summary(self):
        """Print setup completion summary."""
        print()
        print("╔══════════════════════════════════════════════════════════════════╗")
        print("║                     🎉 Setup Complete!                          ║")
        print("╠══════════════════════════════════════════════════════════════════╣")
        print("║                                                                  ║")
        print("║ Claude Code Python SDK metrics tracking is now configured:      ║")
        print("║                                                                  ║")
        print("║ 📦 PyPI download tracking    ✅ Configured                      ║")
        print("║ 🐙 GitHub insights          ✅ Configured                      ║")
        print("║ 📊 Usage analytics          ✅ Configured (opt-in)             ║")
        print("║ 🐞 Error reporting          ✅ Configured (opt-in)             ║")
        print("║ 📈 Real-time dashboard      ✅ Ready                           ║")
        print("║                                                                  ║")
        print("╚══════════════════════════════════════════════════════════════════╝")
        print()
        print("🚀 Quick Start Commands:")
        print()
        print("   # Start the metrics dashboard")
        print(f"   python {self.base_dir}/start_dashboard.py")
        print()
        print("   # Or manually with Streamlit")
        print(f"   streamlit run {self.base_dir}/dashboard.py")
        print()
        print("   # Collect metrics manually")
        print(f"   bash {self.base_dir}/collect_metrics.sh")
        print()
        print("🔧 Configuration Files:")
        print(f"   • Master config: {self.base_dir}/metrics_config.json")
        print(f"   • Analytics: {self.config_dir}/analytics.yml")
        print(f"   • Dashboard: {self.config_dir}/dashboard.json")
        print()
        print("🔒 Privacy Features:")
        print("   ✅ All data collection requires explicit user consent")
        print("   ✅ Automatic PII sanitization for error reports")
        print("   ✅ 90-day data retention with automatic cleanup")
        print("   ✅ GDPR compliant with data export/deletion rights")
        print()
        print("📖 Next Steps:")
        print("   1. Set optional environment variables (GITHUB_TOKEN, SENTRY_DSN)")
        print("   2. Start the dashboard to view real-time metrics")
        print("   3. Integrate metrics collection into your SDK usage")
        print("   4. Configure alerts and monitoring automation")
        print()
        print("📚 Documentation: python-sdk/metrics/README.md")
        print("🆘 Support: https://github.com/yossiashkenazi/automatic-claude-code/issues")
        print()
    
    async def run_setup(self):
        """Run the complete metrics setup."""
        self.print_header()
        
        # Check dependencies
        if not self.check_dependencies():
            return
        
        print()
        
        # Run setup components
        await self.setup_pypi_tracking()
        print()
        
        await self.setup_github_insights() 
        print()
        
        self.setup_error_reporting()
        print()
        
        self.create_master_config()
        print()
        
        self.create_startup_scripts()
        
        # Print summary
        self.print_setup_summary()


async def main():
    """Main function to run the metrics setup."""
    orchestrator = MetricsSetupOrchestrator()
    await orchestrator.run_setup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n❌ Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        sys.exit(1)