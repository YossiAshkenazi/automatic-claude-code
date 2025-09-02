#!/usr/bin/env python3
"""
Streamlit Dashboard for Claude Code Python SDK Metrics

A comprehensive, real-time dashboard for monitoring:
- PyPI download statistics
- GitHub repository insights
- Usage analytics (with user consent)
- Error reporting trends
- Performance metrics

Run with: streamlit run dashboard.py
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Page configuration
st.set_page_config(
    page_title="Claude Code SDK Metrics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main > div {
        padding-top: 2rem;
    }
    .metric-card {
        background-color: #f8f9fa;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid #007bff;
        margin-bottom: 1rem;
    }
    .success-metric {
        border-left-color: #28a745;
    }
    .warning-metric {
        border-left-color: #ffc107;
    }
    .danger-metric {
        border-left-color: #dc3545;
    }
</style>
""", unsafe_allow_html=True)


class MetricsDashboard:
    """Main dashboard class for Claude Code SDK metrics."""
    
    def __init__(self):
        """Initialize the metrics dashboard."""
        self.data_dir = Path("data")
        self.data_dir.mkdir(exist_ok=True)
        self.cache_timeout = 300  # 5 minutes
        
    @st.cache_data(ttl=300)
    def load_pypi_data(self) -> Dict[str, Any]:
        """Load PyPI download statistics."""
        try:
            # In a real implementation, this would call PyPI API
            # For demo purposes, return sample data
            return {
                'recent': {
                    'last_day': 1247,
                    'last_week': 8832,
                    'last_month': 34567
                },
                'daily_downloads': self._generate_sample_daily_downloads(),
                'version_distribution': {
                    '0.1.0': 85.4,
                    '0.0.9': 12.3,
                    '0.0.8': 2.1,
                    '0.0.7': 0.2
                },
                'python_versions': {
                    '3.12': 45.2,
                    '3.11': 32.1,
                    '3.10': 18.7,
                    '3.9': 3.8,
                    '3.8': 0.2
                },
                'operating_systems': {
                    'Linux': 52.3,
                    'Windows': 31.2,
                    'macOS': 16.5
                }
            }
        except Exception as e:
            logger.error(f"Failed to load PyPI data: {e}")
            return {}
    
    @st.cache_data(ttl=1800)  # 30 minutes cache for GitHub data
    def load_github_data(self) -> Dict[str, Any]:
        """Load GitHub repository statistics."""
        try:
            # In a real implementation, this would call GitHub API
            # For demo purposes, return sample data
            return {
                'repository': {
                    'stars': 2847,
                    'forks': 312,
                    'watchers': 156,
                    'open_issues': 23,
                    'language': 'TypeScript'
                },
                'traffic': {
                    'views': {
                        'count': 15432,
                        'uniques': 3421
                    },
                    'clones': {
                        'count': 892,
                        'uniques': 234
                    }
                },
                'releases': {
                    'total_releases': 12,
                    'latest_release': {
                        'tag_name': 'v0.1.0',
                        'published_at': '2024-09-01T10:00:00Z'
                    }
                },
                'contributors': {
                    'total_contributors': 8
                }
            }
        except Exception as e:
            logger.error(f"Failed to load GitHub data: {e}")
            return {}
    
    @st.cache_data(ttl=600)  # 10 minutes cache for usage data
    def load_usage_data(self) -> Dict[str, Any]:
        """Load usage analytics data (anonymized)."""
        try:
            return {
                'feature_usage': {
                    'dual_agent_mode': 67.3,
                    'single_agent_mode': 28.7,
                    'monitoring_dashboard': 45.2,
                    'error_reporting': 23.1,
                    'performance_metrics': 18.9
                },
                'performance_metrics': {
                    'avg_response_time': 1247,
                    'memory_usage': 78.3,
                    'cpu_usage': 12.1,
                    'success_rate': 97.8
                },
                'error_trends': self._generate_sample_error_data(),
                'geographic_distribution': {
                    'United States': 35.2,
                    'Germany': 12.8,
                    'United Kingdom': 9.4,
                    'Canada': 8.7,
                    'France': 7.3,
                    'Others': 26.6
                }
            }
        except Exception as e:
            logger.error(f"Failed to load usage data: {e}")
            return {}
    
    def _generate_sample_daily_downloads(self) -> Dict[str, int]:
        """Generate sample daily download data."""
        downloads = {}
        for i in range(30):
            date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            # Simulate download pattern with some randomness
            base = 1000 + (i * 50)  # Growing trend
            variation = int(base * 0.3 * (0.5 - abs(hash(date) % 1000 - 500) / 1000))
            downloads[date] = max(0, base + variation)
        return downloads
    
    def _generate_sample_error_data(self) -> List[Dict[str, Any]]:
        """Generate sample error trend data."""
        errors = []
        for i in range(7):
            date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            errors.append({
                'date': date,
                'error_count': max(0, 50 - i * 5 + (hash(date) % 20 - 10)),
                'error_rate': max(0.1, 5.0 - i * 0.5 + (hash(date) % 100 - 50) / 100)
            })
        return sorted(errors, key=lambda x: x['date'])
    
    def render_sidebar(self):
        """Render the sidebar with controls and information."""
        st.sidebar.markdown("# 📊 Claude Code SDK")
        st.sidebar.markdown("## Metrics Dashboard")
        
        # Refresh button
        if st.sidebar.button("🔄 Refresh Data", use_container_width=True):
            st.cache_data.clear()
            st.rerun()
        
        # Time range selector
        time_range = st.sidebar.selectbox(
            "📅 Time Range",
            ["Last 7 days", "Last 30 days", "Last 90 days"],
            index=1
        )
        
        # Metrics toggle
        st.sidebar.markdown("### 📈 Visible Metrics")
        show_pypi = st.sidebar.checkbox("PyPI Downloads", True)
        show_github = st.sidebar.checkbox("GitHub Stats", True)
        show_usage = st.sidebar.checkbox("Usage Analytics", True)
        show_errors = st.sidebar.checkbox("Error Reports", True)
        
        # Privacy notice
        st.sidebar.markdown("---")
        st.sidebar.markdown("### 🔒 Privacy Notice")
        st.sidebar.info(
            "All usage analytics are collected with explicit user consent and "
            "automatically anonymized. No personal information is stored or transmitted."
        )
        
        # Data retention info
        st.sidebar.markdown("### 📋 Data Retention")
        st.sidebar.markdown(
            "- **Raw metrics**: 90 days\n"
            "- **Aggregated data**: 1 year\n"
            "- **Summary data**: 5 years"
        )
        
        return {
            'time_range': time_range,
            'show_pypi': show_pypi,
            'show_github': show_github,
            'show_usage': show_usage,
            'show_errors': show_errors
        }
    
    def render_overview_metrics(self, pypi_data: Dict, github_data: Dict, usage_data: Dict):
        """Render the overview metrics cards."""
        st.markdown("## 📊 Overview")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            recent = pypi_data.get('recent', {})
            st.metric(
                label="📦 Monthly Downloads",
                value=f"{recent.get('last_month', 0):,}",
                delta=f"+{recent.get('last_week', 0):,} this week"
            )
        
        with col2:
            repo = github_data.get('repository', {})
            st.metric(
                label="⭐ GitHub Stars", 
                value=f"{repo.get('stars', 0):,}",
                delta=f"+{repo.get('watchers', 0)} watchers"
            )
        
        with col3:
            performance = usage_data.get('performance_metrics', {})
            success_rate = performance.get('success_rate', 0)
            st.metric(
                label="✅ Success Rate",
                value=f"{success_rate:.1f}%",
                delta=f"{success_rate - 95:.1f}% vs baseline",
                delta_color="normal" if success_rate >= 95 else "inverse"
            )
        
        with col4:
            avg_response = performance.get('avg_response_time', 0)
            st.metric(
                label="⚡ Avg Response Time",
                value=f"{avg_response:,}ms",
                delta=f"{avg_response - 1000:+,}ms vs target",
                delta_color="inverse" if avg_response > 1500 else "normal"
            )
    
    def render_pypi_section(self, pypi_data: Dict):
        """Render PyPI download statistics section."""
        if not pypi_data:
            st.error("Failed to load PyPI data")
            return
            
        st.markdown("## 📦 PyPI Download Statistics")
        
        # Recent downloads
        col1, col2 = st.columns(2)
        
        with col1:
            # Daily downloads trend
            daily_data = pypi_data.get('daily_downloads', {})
            if daily_data:
                df = pd.DataFrame([
                    {'Date': date, 'Downloads': downloads} 
                    for date, downloads in daily_data.items()
                ])
                df['Date'] = pd.to_datetime(df['Date'])
                df = df.sort_values('Date')
                
                fig = px.line(
                    df, 
                    x='Date', 
                    y='Downloads',
                    title='Daily Downloads Trend',
                    color_discrete_sequence=['#007bff']
                )
                fig.update_layout(
                    xaxis_title="Date",
                    yaxis_title="Downloads",
                    showlegend=False
                )
                st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Version distribution
            version_data = pypi_data.get('version_distribution', {})
            if version_data:
                fig = px.pie(
                    values=list(version_data.values()),
                    names=list(version_data.keys()),
                    title='Version Distribution',
                    color_discrete_sequence=px.colors.qualitative.Set3
                )
                st.plotly_chart(fig, use_container_width=True)
        
        # Platform distribution
        col3, col4 = st.columns(2)
        
        with col3:
            # Python versions
            python_data = pypi_data.get('python_versions', {})
            if python_data:
                fig = go.Figure([go.Bar(
                    x=list(python_data.keys()),
                    y=list(python_data.values()),
                    marker_color='#28a745'
                )])
                fig.update_layout(
                    title='Python Version Usage',
                    xaxis_title='Python Version',
                    yaxis_title='Usage (%)'
                )
                st.plotly_chart(fig, use_container_width=True)
        
        with col4:
            # Operating systems
            os_data = pypi_data.get('operating_systems', {})
            if os_data:
                fig = px.bar(
                    x=list(os_data.keys()),
                    y=list(os_data.values()),
                    title='Operating System Distribution',
                    color_discrete_sequence=['#17a2b8']
                )
                fig.update_layout(
                    xaxis_title='Operating System',
                    yaxis_title='Usage (%)'
                )
                st.plotly_chart(fig, use_container_width=True)
    
    def render_github_section(self, github_data: Dict):
        """Render GitHub repository statistics section."""
        if not github_data:
            st.error("Failed to load GitHub data")
            return
            
        st.markdown("## 🐙 GitHub Repository Statistics")
        
        # Repository metrics
        repo = github_data.get('repository', {})
        traffic = github_data.get('traffic', {})
        releases = github_data.get('releases', {})
        contributors = github_data.get('contributors', {})
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.markdown(f"""
            <div class="metric-card success-metric">
                <h3>⭐ {repo.get('stars', 0):,}</h3>
                <p>Stars</p>
            </div>
            """, unsafe_allow_html=True)
        
        with col2:
            st.markdown(f"""
            <div class="metric-card">
                <h3>🍴 {repo.get('forks', 0):,}</h3>
                <p>Forks</p>
            </div>
            """, unsafe_allow_html=True)
        
        with col3:
            issues_color = 'danger-metric' if repo.get('open_issues', 0) > 50 else 'warning-metric'
            st.markdown(f"""
            <div class="metric-card {issues_color}">
                <h3>🐛 {repo.get('open_issues', 0)}</h3>
                <p>Open Issues</p>
            </div>
            """, unsafe_allow_html=True)
        
        with col4:
            st.markdown(f"""
            <div class="metric-card">
                <h3>👥 {contributors.get('total_contributors', 0)}</h3>
                <p>Contributors</p>
            </div>
            """, unsafe_allow_html=True)
        
        # Traffic metrics
        col5, col6 = st.columns(2)
        
        with col5:
            views = traffic.get('views', {})
            st.metric(
                "👁️ Repository Views (14 days)",
                value=f"{views.get('count', 0):,}",
                delta=f"{views.get('uniques', 0):,} unique visitors"
            )
        
        with col6:
            clones = traffic.get('clones', {})
            st.metric(
                "📥 Repository Clones (14 days)",
                value=f"{clones.get('count', 0):,}",
                delta=f"{clones.get('uniques', 0):,} unique cloners"
            )
        
        # Latest release info
        if releases.get('latest_release'):
            latest = releases['latest_release']
            st.info(f"🚀 **Latest Release**: {latest.get('tag_name', 'N/A')} "
                   f"(Published: {latest.get('published_at', 'N/A')[:10]})")
    
    def render_usage_section(self, usage_data: Dict):
        """Render usage analytics section."""
        if not usage_data:
            st.error("Failed to load usage data")
            return
            
        st.markdown("## 📈 Usage Analytics")
        st.info("🔒 All usage data is collected with explicit user consent and automatically anonymized.")
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Feature usage
            feature_data = usage_data.get('feature_usage', {})
            if feature_data:
                fig = px.bar(
                    x=list(feature_data.values()),
                    y=list(feature_data.keys()),
                    orientation='h',
                    title='Feature Usage Distribution',
                    color_discrete_sequence=['#6f42c1']
                )
                fig.update_layout(
                    xaxis_title='Usage (%)',
                    yaxis_title='Features'
                )
                st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Geographic distribution
            geo_data = usage_data.get('geographic_distribution', {})
            if geo_data:
                fig = px.pie(
                    values=list(geo_data.values()),
                    names=list(geo_data.keys()),
                    title='Geographic Distribution',
                    color_discrete_sequence=px.colors.qualitative.Pastel
                )
                st.plotly_chart(fig, use_container_width=True)
        
        # Performance metrics
        performance = usage_data.get('performance_metrics', {})
        if performance:
            col3, col4, col5 = st.columns(3)
            
            with col3:
                memory_usage = performance.get('memory_usage', 0)
                color = 'normal' if memory_usage < 100 else 'inverse'
                st.metric(
                    "💾 Memory Usage",
                    f"{memory_usage:.1f} MB",
                    delta=f"{memory_usage - 50:.1f} MB vs baseline",
                    delta_color=color
                )
            
            with col4:
                cpu_usage = performance.get('cpu_usage', 0)
                color = 'normal' if cpu_usage < 20 else 'inverse'
                st.metric(
                    "🖥️ CPU Usage",
                    f"{cpu_usage:.1f}%",
                    delta=f"{cpu_usage - 10:.1f}% vs baseline",
                    delta_color=color
                )
            
            with col5:
                response_time = performance.get('avg_response_time', 0)
                color = 'normal' if response_time < 1500 else 'inverse'
                st.metric(
                    "⚡ Response Time",
                    f"{response_time:,}ms",
                    delta=f"{response_time - 1000:+,}ms vs target",
                    delta_color=color
                )
    
    def render_error_section(self, usage_data: Dict):
        """Render error reporting section."""
        error_data = usage_data.get('error_trends', [])
        if not error_data:
            st.error("Failed to load error data")
            return
            
        st.markdown("## 🐞 Error Reporting")
        st.info("🔒 Error reports are collected with user consent and all PII is automatically sanitized.")
        
        # Error trends
        if error_data:
            df = pd.DataFrame(error_data)
            df['date'] = pd.to_datetime(df['date'])
            
            col1, col2 = st.columns(2)
            
            with col1:
                fig = px.line(
                    df,
                    x='date',
                    y='error_count',
                    title='Error Count Trend (7 days)',
                    color_discrete_sequence=['#dc3545']
                )
                fig.update_layout(
                    xaxis_title='Date',
                    yaxis_title='Error Count'
                )
                st.plotly_chart(fig, use_container_width=True)
            
            with col2:
                fig = px.line(
                    df,
                    x='date',
                    y='error_rate',
                    title='Error Rate Trend (7 days)',
                    color_discrete_sequence=['#fd7e14']
                )
                fig.update_layout(
                    xaxis_title='Date',
                    yaxis_title='Error Rate (%)'
                )
                st.plotly_chart(fig, use_container_width=True)
            
            # Current error metrics
            latest_data = df.iloc[-1] if not df.empty else {}
            col3, col4 = st.columns(2)
            
            with col3:
                current_count = latest_data.get('error_count', 0)
                color = 'normal' if current_count < 10 else 'inverse'
                st.metric(
                    "🚨 Today's Errors",
                    value=int(current_count),
                    delta=f"{int(current_count - 15):+d} vs yesterday",
                    delta_color=color
                )
            
            with col4:
                current_rate = latest_data.get('error_rate', 0)
                color = 'normal' if current_rate < 2.0 else 'inverse'
                st.metric(
                    "📊 Current Error Rate",
                    value=f"{current_rate:.1f}%",
                    delta=f"{current_rate - 2.0:+.1f}% vs target",
                    delta_color=color
                )
    
    def render_footer(self):
        """Render dashboard footer."""
        st.markdown("---")
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.markdown("### 📚 Resources")
            st.markdown("""
            - [SDK Documentation](https://github.com/yossiashkenazi/automatic-claude-code)
            - [Privacy Policy](https://github.com/yossiashkenazi/automatic-claude-code/blob/main/PRIVACY.md)
            - [Data Export](javascript:alert('Feature coming soon!'))
            """)
        
        with col2:
            st.markdown("### 🔧 Configuration")
            st.markdown("""
            - [Analytics Settings](javascript:alert('Feature coming soon!'))
            - [Alert Configuration](javascript:alert('Feature coming soon!'))
            - [Data Retention](javascript:alert('Feature coming soon!'))
            """)
        
        with col3:
            st.markdown("### 📞 Support")
            st.markdown("""
            - [GitHub Issues](https://github.com/yossiashkenazi/automatic-claude-code/issues)
            - [Discussions](https://github.com/yossiashkenazi/automatic-claude-code/discussions)
            - [Email Support](mailto:sdk-support@example.com)
            """)
        
        st.markdown(f"""
        <div style="text-align: center; color: #6c757d; margin-top: 2rem;">
            Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')} | 
            Dashboard v1.0.0 | 
            Data retention: 90 days
        </div>
        """, unsafe_allow_html=True)
    
    def run(self):
        """Run the Streamlit dashboard."""
        # Header
        st.title("📊 Claude Code Python SDK")
        st.markdown("### Real-time Metrics Dashboard")
        st.markdown("Privacy-first analytics for the Claude Code Python SDK")
        
        # Sidebar
        settings = self.render_sidebar()
        
        # Load data
        with st.spinner("Loading metrics data..."):
            pypi_data = self.load_pypi_data() if settings['show_pypi'] else {}
            github_data = self.load_github_data() if settings['show_github'] else {}
            usage_data = self.load_usage_data() if settings['show_usage'] else {}
        
        # Overview metrics
        self.render_overview_metrics(pypi_data, github_data, usage_data)
        
        # Main sections
        if settings['show_pypi'] and pypi_data:
            self.render_pypi_section(pypi_data)
            
        if settings['show_github'] and github_data:
            self.render_github_section(github_data)
            
        if settings['show_usage'] and usage_data:
            self.render_usage_section(usage_data)
            
        if settings['show_errors'] and usage_data:
            self.render_error_section(usage_data)
        
        # Footer
        self.render_footer()


def main():
    """Main function to run the dashboard."""
    dashboard = MetricsDashboard()
    dashboard.run()


if __name__ == "__main__":
    main()