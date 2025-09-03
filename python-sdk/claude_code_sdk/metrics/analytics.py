"""
Analytics and metrics collection module for Claude Code SDK.

This module provides privacy-first analytics collection with explicit user consent.
All data collection is opt-in and anonymized by default.
"""

import hashlib
import json
import logging
import os
import platform
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import aiohttp

logger = logging.getLogger(__name__)


class AnalyticsConfig:
    """Configuration for analytics and metrics collection."""
    
    def __init__(self, config_path: Optional[Path] = None):
        """Initialize analytics configuration.
        
        Args:
            config_path: Path to analytics configuration file
        """
        self.config_path = config_path or Path.home() / '.claude-code-sdk' / 'analytics.json'
        self._config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file or create default."""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to load analytics config: {e}")
        
        # Default configuration
        return {
            'enabled': False,  # Opt-in by default
            'anonymous_id': str(uuid.uuid4()),
            'consent_given': False,
            'data_sharing': {
                'usage_stats': False,
                'error_reporting': False,
                'performance_metrics': False
            },
            'privacy_settings': {
                'anonymize_paths': True,
                'exclude_env_vars': True,
                'hash_machine_id': True
            }
        }
    
    def save_config(self) -> None:
        """Save current configuration to file."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.config_path, 'w') as f:
                json.dump(self._config, f, indent=2)
        except IOError as e:
            logger.error(f"Failed to save analytics config: {e}")
    
    @property
    def enabled(self) -> bool:
        """Check if analytics is enabled."""
        return self._config.get('enabled', False)
    
    @property
    def consent_given(self) -> bool:
        """Check if user consent has been given."""
        return self._config.get('consent_given', False)
    
    @property
    def anonymous_id(self) -> str:
        """Get anonymous user ID."""
        return self._config.get('anonymous_id', '')


class MetricsCollector:
    """Privacy-first metrics collector for Claude Code SDK."""
    
    def __init__(self, config: Optional[AnalyticsConfig] = None):
        """Initialize metrics collector.
        
        Args:
            config: Analytics configuration instance
        """
        self.config = config or AnalyticsConfig()
        self._session: Optional[aiohttp.ClientSession] = None
        self._machine_id = self._generate_machine_id()
        
    def _generate_machine_id(self) -> str:
        """Generate anonymized machine identifier."""
        # Create hash from machine-specific but non-PII data
        machine_data = f"{platform.node()}-{platform.machine()}-{platform.processor()}"
        return hashlib.sha256(machine_data.encode()).hexdigest()[:16]
    
    def _get_system_info(self) -> Dict[str, Any]:
        """Collect anonymized system information."""
        return {
            'python_version': f"{sys.version_info.major}.{sys.version_info.minor}",
            'platform': platform.system(),
            'platform_version': platform.release(),
            'architecture': platform.machine(),
            'sdk_version': '0.1.0'  # Should be imported from package
        }
    
    def collect_usage_metrics(self, 
                            action: str, 
                            features_used: List[str],
                            duration_ms: Optional[int] = None,
                            success: bool = True,
                            metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Collect usage metrics.
        
        Args:
            action: The action performed (e.g., 'dual_agent_run')
            features_used: List of features utilized
            duration_ms: Execution duration in milliseconds
            success: Whether the action succeeded
            metadata: Additional anonymized metadata
            
        Returns:
            Collected metrics data
        """
        if not self.config.enabled or not self.config.consent_given:
            return {}
            
        metrics = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'event_type': 'usage',
            'anonymous_id': self.config.anonymous_id,
            'machine_id': self._machine_id,
            'action': action,
            'features_used': features_used,
            'success': success,
            'system_info': self._get_system_info()
        }
        
        if duration_ms is not None:
            metrics['duration_ms'] = duration_ms
            
        if metadata:
            # Sanitize metadata to ensure no PII
            sanitized_metadata = self._sanitize_metadata(metadata)
            metrics['metadata'] = sanitized_metadata
            
        return metrics
    
    def collect_error_metrics(self,
                            error_type: str,
                            error_message: str,
                            stack_trace: Optional[str] = None,
                            context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Collect error metrics.
        
        Args:
            error_type: Type of error (e.g., 'ConnectionError')
            error_message: Error message (will be sanitized)
            stack_trace: Stack trace (will be sanitized)
            context: Error context (will be sanitized)
            
        Returns:
            Collected error metrics
        """
        if not self.config.enabled or not self.config.consent_given:
            return {}
            
        metrics = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'event_type': 'error',
            'anonymous_id': self.config.anonymous_id,
            'machine_id': self._machine_id,
            'error_type': error_type,
            'error_message': self._sanitize_error_message(error_message),
            'system_info': self._get_system_info()
        }
        
        if stack_trace:
            metrics['stack_trace'] = self._sanitize_stack_trace(stack_trace)
            
        if context:
            metrics['context'] = self._sanitize_metadata(context)
            
        return metrics
    
    def collect_performance_metrics(self,
                                  operation: str,
                                  duration_ms: int,
                                  memory_usage_mb: Optional[float] = None,
                                  cpu_usage_percent: Optional[float] = None) -> Dict[str, Any]:
        """Collect performance metrics.
        
        Args:
            operation: Operation name
            duration_ms: Duration in milliseconds
            memory_usage_mb: Memory usage in MB
            cpu_usage_percent: CPU usage percentage
            
        Returns:
            Collected performance metrics
        """
        if not self.config.enabled or not self.config.consent_given:
            return {}
            
        metrics = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'event_type': 'performance',
            'anonymous_id': self.config.anonymous_id,
            'machine_id': self._machine_id,
            'operation': operation,
            'duration_ms': duration_ms,
            'system_info': self._get_system_info()
        }
        
        if memory_usage_mb is not None:
            metrics['memory_usage_mb'] = memory_usage_mb
            
        if cpu_usage_percent is not None:
            metrics['cpu_usage_percent'] = cpu_usage_percent
            
        return metrics
    
    def _sanitize_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize metadata to remove PII."""
        sanitized = {}
        for key, value in metadata.items():
            # Skip potentially sensitive keys
            if any(sensitive in key.lower() for sensitive in 
                   ['path', 'file', 'user', 'home', 'token', 'key', 'password']):
                continue
                
            # Sanitize string values
            if isinstance(value, str):
                sanitized[key] = self._sanitize_string(value)
            elif isinstance(value, (int, float, bool)):
                sanitized[key] = value
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_metadata(value)
                
        return sanitized
    
    def _sanitize_string(self, text: str) -> str:
        """Sanitize string to remove potential PII."""
        # Remove file paths
        if '/' in text or '\\' in text:
            return '<path_removed>'
        
        # Remove potential tokens/keys (long alphanumeric strings)
        if len(text) > 20 and text.isalnum():
            return '<token_removed>'
            
        return text
    
    def _sanitize_error_message(self, message: str) -> str:
        """Sanitize error message to remove PII."""
        # Remove file paths from error messages
        import re
        
        # Windows and Unix paths
        message = re.sub(r'[A-Za-z]:\\[^\\]+(?:\\[^\\]+)*', '<path>', message)
        message = re.sub(r'/[^/\s]+(?:/[^/\s]+)*', '<path>', message)
        
        # Remove potential usernames
        message = re.sub(r'user[s]?[/\\][^/\\s]+', 'user/<name>', message, flags=re.IGNORECASE)
        
        return message
    
    def _sanitize_stack_trace(self, stack_trace: str) -> str:
        """Sanitize stack trace to remove PII."""
        lines = stack_trace.split('\n')
        sanitized_lines = []
        
        for line in lines:
            # Keep the structure but remove file paths
            if 'File "' in line:
                sanitized_line = re.sub(r'File "[^"]*"', 'File "<path>"', line)
                sanitized_lines.append(sanitized_line)
            else:
                sanitized_lines.append(line)
                
        return '\n'.join(sanitized_lines)
    
    async def send_metrics(self, metrics: Dict[str, Any]) -> bool:
        """Send metrics to analytics endpoint.
        
        Args:
            metrics: Metrics data to send
            
        Returns:
            True if metrics were sent successfully
        """
        if not metrics or not self.config.enabled:
            return False
            
        analytics_endpoint = os.getenv('CLAUDE_SDK_ANALYTICS_ENDPOINT', 
                                     'https://analytics.claude-code-sdk.com/events')
        
        try:
            if not self._session:
                self._session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=10)
                )
            
            async with self._session.post(
                analytics_endpoint,
                json=metrics,
                headers={'Content-Type': 'application/json'}
            ) as response:
                return response.status == 200
                
        except Exception as e:
            logger.debug(f"Failed to send metrics: {e}")
            return False
    
    async def close(self) -> None:
        """Close the metrics collector and cleanup resources."""
        if self._session:
            await self._session.close()
            self._session = None