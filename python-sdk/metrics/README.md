# Claude Code Python SDK - Metrics Tracking

## Overview

Privacy-first metrics tracking system for the Claude Code Python SDK. This system provides comprehensive analytics while respecting user privacy and maintaining GDPR compliance.

## 🎯 Features

### 📊 Analytics & Metrics
- **PyPI Download Statistics**: Track package downloads, version distribution, and user demographics
- **GitHub Repository Insights**: Monitor stars, forks, issues, traffic, and contributor activity  
- **Usage Analytics**: Collect anonymized feature usage and performance metrics (opt-in)
- **Error Reporting**: Privacy-respecting error tracking with automatic PII sanitization (opt-in)

### 🔒 Privacy-First Design
- **Explicit Opt-in**: All data collection requires explicit user consent
- **Automatic PII Sanitization**: File paths, tokens, and personal data automatically removed
- **Data Minimization**: Only collect essential data for product improvement
- **Transparent Controls**: Users can view, export, or delete all collected data
- **GDPR Compliant**: Full compliance with European data protection regulations

### 📈 Real-time Dashboard
- **Live Metrics**: Real-time visualization of download and usage statistics
- **Interactive Charts**: Time series, pie charts, heatmaps, and geographic distribution
- **Custom Alerts**: Configurable thresholds for error rates and download anomalies
- **Export Capabilities**: Data export in JSON, CSV, and Parquet formats

## 🚀 Quick Start

### 1. Installation

```bash
# Core metrics (always available)
pip install claude-code-sdk

# Optional: Enhanced error reporting
pip install claude-code-sdk[error-reporting]
# or manually: pip install sentry-sdk[logging]
```

### 2. Environment Setup

```bash
# Optional: For error reporting
export SENTRY_DSN="https://your-dsn@sentry.io/project-id"
export DEPLOY_ENV="production"  # or development/staging

# Optional: For enhanced analytics
export CLAUDE_SDK_ANALYTICS_ENDPOINT="https://analytics.your-domain.com/events"
export ANALYTICS_API_KEY="your-api-key"
```

### 3. Basic Usage

```python
from claude_code_sdk.metrics import MetricsCollector, ConsentManager

# Initialize with user consent
consent_manager = ConsentManager()
if consent_manager.request_consent(['usage_analytics', 'error_reporting']):
    print("✅ Analytics enabled with privacy protection")
    
    # Initialize metrics collector
    metrics = MetricsCollector()
    
    # Your SDK usage here...
    # Metrics are automatically collected with user consent
else:
    print("❌ Analytics disabled per user preference")
```

## 📋 Configuration Files

### Analytics Configuration (`metrics/config/analytics.yml`)
```yaml
analytics:
  enabled: true
  opt_in_required: true
  data_retention_days: 90
  anonymization: true
  
  pypi_metrics:
    enabled: true
    collection_interval: "1h"
  
  github_metrics:
    enabled: true
    collection_interval: "6h"
  
  usage_analytics:
    enabled: true
    opt_in_required: true
    anonymous_id_generation: true
  
  error_reporting:
    enabled: true
    opt_in_required: true
    service: "sentry"
    sample_rate: 0.1
```

### Dashboard Configuration (`metrics/config/dashboard.json`)
```json
{
  "dashboard": {
    "title": "Claude Code Python SDK Metrics",
    "refresh_interval": 300,
    "panels": [
      {
        "id": "pypi_downloads",
        "title": "PyPI Download Statistics",
        "type": "time_series"
      },
      {
        "id": "github_metrics", 
        "title": "GitHub Repository Metrics",
        "type": "stat_panel"
      }
    ]
  }
}
```

## 🔧 Setup Scripts

### PyPI Tracking Setup
```bash
cd python-sdk/metrics/setup
python pypi_tracking.py
```
- Configures PyPI download statistics collection
- Creates monitoring scripts for automated data collection
- Sets up alerts for significant download changes

### GitHub Insights Setup
```bash
export GITHUB_TOKEN="your-github-token"
cd python-sdk/metrics/setup  
python github_insights.py
```
- Configures GitHub repository metrics collection
- Sets up traffic, issue, and contributor tracking
- Creates automated monitoring and reporting scripts

### Error Reporting Setup
```bash
cd python-sdk/metrics/setup
python error_reporting.py
```
- Configures privacy-first error reporting with Sentry
- Creates user consent management system
- Sets up automatic PII sanitization filters

## 📊 Metrics Dashboard

### Starting the Dashboard
```bash
# Install dashboard dependencies
pip install streamlit plotly

# Start the metrics dashboard
cd python-sdk/metrics
streamlit run dashboard.py
```

Access at: http://localhost:8501

### Dashboard Panels
1. **PyPI Downloads**: Daily/weekly/monthly download trends
2. **Version Distribution**: Usage breakdown by SDK version  
3. **GitHub Activity**: Stars, forks, issues, and PR metrics
4. **Usage Patterns**: Feature usage heatmaps and trends
5. **Error Rates**: Error frequency and type distribution
6. **Geographic Distribution**: User location analytics

## 🔒 Privacy & Compliance

### Data We Collect (with consent)
✅ **Usage Statistics**: Features used, success rates, performance metrics  
✅ **Error Reports**: Anonymized stack traces and error frequencies  
✅ **System Info**: Python version, OS type, SDK version  

### Data We DON'T Collect
❌ **Personal Information**: Names, emails, IP addresses  
❌ **File Contents**: Source code, file names, or directory structures  
❌ **Environment Variables**: Secrets, tokens, or configuration  
❌ **Network Data**: URLs, hostnames, or connection details  

### Automatic Data Sanitization
- **File Paths**: `/Users/john/project/` → `/Users/<user>/project/`
- **Tokens/Keys**: `abc123def456...` → `<token>`
- **Email Addresses**: `user@domain.com` → `<email>`
- **Environment Variables**: All sensitive env vars excluded
- **Stack Traces**: Personal paths and data removed

### User Rights (GDPR)
- **Right to Access**: View all collected data
- **Right to Rectification**: Correct inaccurate data
- **Right to Erasure**: Delete all personal data
- **Right to Portability**: Export data in standard formats
- **Right to Object**: Opt-out of data collection

### User Controls
```python
from claude_code_sdk.metrics import ConsentManager

consent = ConsentManager()

# View consent status
print(consent.get_consent_info())

# Export all data (GDPR)
data = consent.export_consent_data() 
print(json.dumps(data, indent=2))

# Withdraw consent
consent.withdraw_consent()
print("✅ All data collection stopped")

# Delete all data
success = consent.delete_all_data()
print(f"✅ Data deletion: {'successful' if success else 'failed'}")
```

## 📈 Advanced Analytics

### Custom Metrics Collection
```python
from claude_code_sdk.metrics import MetricsCollector

metrics = MetricsCollector()

# Track feature usage
metrics.collect_usage_metrics(
    action='dual_agent_coordination',
    features_used=['manager_agent', 'worker_agent', 'websocket'],
    duration_ms=1500,
    success=True,
    metadata={'agents': 2, 'tasks_completed': 5}
)

# Track performance
metrics.collect_performance_metrics(
    operation='claude_api_call',
    duration_ms=850,
    memory_usage_mb=45.2,
    cpu_usage_percent=12.5
)

# Send metrics (respects user consent)
await metrics.send_metrics(collected_metrics)
```

### Error Reporting Integration
```python
from claude_code_sdk.metrics import ErrorReporter

error_reporter = ErrorReporter(
    sample_rate=0.1,  # Report 10% of errors
    user_consent_required=True
)

# Setup with consent check
if error_reporter.setup_with_consent():
    try:
        # Your SDK code here
        pass
    except Exception as e:
        # Automatic error reporting with PII sanitization
        error_reporter.capture_exception(e, extra_data={
            'operation': 'dual_agent_run',
            'feature': 'coordination'
        })
```

## 🚨 Alerting & Monitoring

### Alert Configuration
```yaml
alerts:
  enabled: true
  channels:
    - type: "slack"
      webhook_url: "${SLACK_WEBHOOK_URL}"
      conditions:
        - metric: "error_rate"
          threshold: "> 5%"
          window: "1h"
        - metric: "download_drop" 
          threshold: "> 50%"
          window: "24h"
    - type: "email"
      recipients: ["sdk-team@example.com"]
      conditions:
        - metric: "critical_errors"
          threshold: "> 10"
          window: "1h"
```

### Custom Alert Setup
```python
from claude_code_sdk.metrics import AlertManager

alerts = AlertManager()

# Configure error rate alert
alerts.add_alert(
    name="High Error Rate",
    metric="error_rate", 
    threshold=5.0,
    comparison="greater_than",
    window="1h",
    channels=["slack", "email"]
)

# Configure download anomaly alert
alerts.add_alert(
    name="Download Anomaly",
    metric="daily_downloads",
    threshold=0.5,  # 50% drop
    comparison="percentage_decrease",
    window="24h", 
    channels=["slack"]
)
```

## 🧪 Testing Metrics

### Test Suite
```bash
# Run metrics tests
cd python-sdk
python -m pytest tests/metrics/ -v

# Test specific components
python -m pytest tests/metrics/test_analytics.py
python -m pytest tests/metrics/test_consent.py
python -m pytest tests/metrics/test_error_reporting.py
```

### Manual Testing
```python
# Test metrics collection
from claude_code_sdk.metrics import MetricsCollector

metrics = MetricsCollector()

# Generate test data
test_metrics = metrics.collect_usage_metrics(
    action='test_action',
    features_used=['feature1', 'feature2'], 
    duration_ms=1000,
    success=True,
    metadata={'test': True}
)

print("Test metrics:", json.dumps(test_metrics, indent=2))
```

## 📚 Documentation

- **[Analytics Configuration](config/analytics.yml)**: Complete analytics settings
- **[Dashboard Configuration](config/dashboard.json)**: Dashboard panel setup  
- **[Privacy Guide](docs/privacy_guide.md)**: GDPR compliance details
- **[API Reference](docs/api_reference.md)**: Complete API documentation
- **[Integration Examples](examples/)**: Code examples and tutorials

## 🤝 Contributing

We welcome contributions to improve the metrics system:

1. **Privacy First**: All changes must maintain privacy-first principles
2. **Opt-in Only**: New data collection requires explicit user consent  
3. **Test Coverage**: Maintain >80% test coverage for all metrics code
4. **Documentation**: Update docs for all user-facing changes

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yossiashkenazi/automatic-claude-code/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yossiashkenazi/automatic-claude-code/discussions)
- **Email**: sdk-support@example.com

---

**Privacy Notice**: This metrics system is designed to collect only anonymous, aggregated data to improve the Claude Code SDK. All data collection is opt-in, and users maintain full control over their data at all times.