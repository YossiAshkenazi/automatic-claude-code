#!/usr/bin/env python3
"""
Unit tests for HealthMonitor

Tests health monitoring, metrics collection, alerting, and recovery functionality.
"""

import asyncio
import pytest
import time
from unittest.mock import Mock, AsyncMock, patch, MagicMock

# Import classes under test
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from multi_agent_wrapper.health_monitor import (
    HealthMonitor, HealthMetric, MetricType, HealthStatus, HealthAlert,
    SystemHealth, RecoveryAction
)
from multi_agent_wrapper import MultiAgentCLIWrapper, AgentStatus


class TestHealthMonitor:
    """Test suite for HealthMonitor functionality"""
    
    @pytest.fixture
    def monitor_config(self):
        """Create test monitor configuration"""
        return {
            'monitoring_interval': 1.0,  # Fast for testing
            'metric_retention_hours': 1,
            'alert_retention_hours': 1,
            'enable_auto_recovery': True,
            'enable_predictive_analysis': False
        }
    
    @pytest.fixture
    async def health_monitor(self, monitor_config):
        """Create test health monitor"""
        mock_multi_agent = Mock(spec=MultiAgentCLIWrapper)
        monitor = HealthMonitor(mock_multi_agent, monitor_config)
        yield monitor
        await monitor.stop()
    
    @pytest.fixture
    def sample_metric(self):
        """Create sample health metric"""
        return HealthMetric(
            metric_id="test_cpu_usage",
            metric_type=MetricType.RESOURCE,
            agent_id="test_agent",
            value=75.0,
            unit="percent",
            threshold_warning=70.0,
            threshold_critical=90.0
        )
    
    @pytest.mark.asyncio
    async def test_monitor_initialization(self, monitor_config):
        """Test health monitor initialization"""
        mock_multi_agent = Mock()
        monitor = HealthMonitor(mock_multi_agent, monitor_config)
        
        assert monitor.multi_agent == mock_multi_agent
        assert monitor.config == monitor_config
        assert monitor.monitoring_interval == 1.0
        assert monitor.enable_auto_recovery is True
        assert len(monitor.recovery_actions) > 0  # Default actions
        
        await monitor.stop()
    
    @pytest.mark.asyncio
    async def test_monitor_start_stop(self, health_monitor):
        """Test monitor start and stop lifecycle"""
        # Start monitoring
        await health_monitor.start()
        
        # Verify background tasks started
        assert health_monitor.monitoring_task is not None
        assert health_monitor.alert_processor_task is not None
        assert health_monitor.recovery_task is not None  # Auto recovery enabled
        assert health_monitor.cleanup_task is not None
        
        # Stop monitoring
        await health_monitor.stop()
        
        # Verify tasks are cancelled/completed
        tasks = [
            health_monitor.monitoring_task,
            health_monitor.alert_processor_task,
            health_monitor.recovery_task,
            health_monitor.cleanup_task
        ]
        
        for task in tasks:
            if task:
                assert task.cancelled() or task.done()
    
    def test_metric_health_status(self, sample_metric):
        """Test metric health status calculation"""
        # Test healthy status (below warning threshold)
        sample_metric.value = 65.0
        assert sample_metric.get_status() == HealthStatus.HEALTHY
        
        # Test warning status
        sample_metric.value = 75.0
        assert sample_metric.get_status() == HealthStatus.WARNING
        
        # Test critical status
        sample_metric.value = 95.0
        assert sample_metric.get_status() == HealthStatus.CRITICAL
    
    @pytest.mark.asyncio
    async def test_system_metrics_collection(self, health_monitor):
        """Test system metrics collection"""
        # Mock psutil availability
        with patch('multi_agent_wrapper.health_monitor.HAS_PSUTIL', True):
            with patch('multi_agent_wrapper.health_monitor.psutil') as mock_psutil:
                # Setup psutil mocks
                mock_psutil.cpu_percent.return_value = 45.0
                
                mock_memory = Mock()
                mock_memory.percent = 60.0
                mock_memory.total = 8 * 1024**3  # 8GB
                mock_memory.available = 3 * 1024**3  # 3GB
                mock_psutil.virtual_memory.return_value = mock_memory
                
                mock_disk = Mock()
                mock_disk.used = 100 * 1024**3  # 100GB used
                mock_disk.total = 500 * 1024**3  # 500GB total
                mock_disk.free = 400 * 1024**3   # 400GB free
                mock_psutil.disk_usage.return_value = mock_disk
                
                # Collect system metrics
                await health_monitor._collect_system_metrics()
                
                # Verify metrics were collected
                recent_metrics = [m for m in health_monitor.metrics_history
                                if time.time() - m.timestamp <= 60]
                
                metric_ids = [m.metric_id for m in recent_metrics]
                assert "system_uptime" in metric_ids
                assert "system_cpu_percent" in metric_ids
                assert "system_memory_percent" in metric_ids
                assert "system_disk_percent" in metric_ids
    
    @pytest.mark.asyncio
    async def test_agent_metrics_collection(self, health_monitor):
        """Test agent metrics collection"""
        # Mock multi-agent wrapper
        mock_agent_info = Mock()
        mock_agent_info.config.agent_id = "test_agent"
        mock_agent_info.status = AgentStatus.IDLE
        mock_agent_info.task_count = 10
        mock_agent_info.error_count = 1
        mock_agent_info.get_uptime_seconds.return_value = 3600.0  # 1 hour
        mock_agent_info.resource_stats = None
        
        health_monitor.multi_agent.list_agents.return_value = [mock_agent_info]
        
        # Collect agent metrics
        await health_monitor._collect_agent_metrics()
        
        # Verify metrics were collected
        recent_metrics = [m for m in health_monitor.metrics_history
                         if time.time() - m.timestamp <= 60]
        
        agent_metrics = [m for m in recent_metrics if m.agent_id == "test_agent"]
        assert len(agent_metrics) >= 3  # availability, error_rate, uptime
        
        # Check specific metrics
        metric_ids = [m.metric_id for m in agent_metrics]
        assert any("agent_availability" in mid for mid in metric_ids)
        assert any("agent_error_rate" in mid for mid in metric_ids)
        assert any("agent_uptime" in mid for mid in metric_ids)
    
    @pytest.mark.asyncio
    async def test_custom_health_check(self, health_monitor):
        """Test custom health check registration and execution"""
        # Register custom health check
        check_calls = []
        
        def custom_check():
            check_calls.append(time.time())
            return HealthMetric(
                metric_id="custom_metric",
                metric_type=MetricType.PERFORMANCE,
                agent_id="custom_agent",
                value=42.0,
                unit="custom"
            )
        
        health_monitor.register_custom_health_check("test_check", custom_check)
        
        # Run custom health checks
        await health_monitor._run_custom_health_checks()
        
        # Verify check was called
        assert len(check_calls) == 1
        
        # Verify metric was added
        custom_metrics = [m for m in health_monitor.metrics_history 
                         if m.metric_id == "custom_metric"]
        assert len(custom_metrics) == 1
        assert custom_metrics[0].value == 42.0
        
        # Unregister check
        health_monitor.unregister_custom_health_check("test_check")
        assert "test_check" not in health_monitor.custom_health_checks
    
    @pytest.mark.asyncio
    async def test_async_custom_health_check(self, health_monitor):
        """Test async custom health check"""
        check_calls = []
        
        async def async_custom_check():
            await asyncio.sleep(0.01)  # Simulate async work
            check_calls.append(time.time())
            return [
                HealthMetric(
                    metric_id="async_metric1",
                    metric_type=MetricType.PERFORMANCE,
                    agent_id=None,
                    value=100.0
                ),
                HealthMetric(
                    metric_id="async_metric2", 
                    metric_type=MetricType.PERFORMANCE,
                    agent_id=None,
                    value=200.0
                )
            ]
        
        health_monitor.register_custom_health_check("async_check", async_custom_check)
        
        # Run custom health checks
        await health_monitor._run_custom_health_checks()
        
        # Verify async check was called
        assert len(check_calls) == 1
        
        # Verify both metrics were added
        async_metrics = [m for m in health_monitor.metrics_history 
                        if m.metric_id.startswith("async_metric")]
        assert len(async_metrics) == 2
    
    @pytest.mark.asyncio
    async def test_alert_generation(self, health_monitor):
        """Test alert generation from metrics"""
        # Add critical metric to trigger alert
        critical_metric = HealthMetric(
            metric_id="critical_test",
            metric_type=MetricType.RESOURCE,
            agent_id="test_agent",
            value=95.0,
            unit="percent",
            threshold_warning=70.0,
            threshold_critical=90.0
        )
        
        health_monitor.metrics_history.append(critical_metric)
        
        # Analyze metrics (should generate alert)
        await health_monitor._analyze_agent_health("test_agent", [critical_metric])
        
        # Verify alert was generated
        alerts = [a for a in health_monitor.health_alerts.values() 
                 if a.agent_id == "test_agent"]
        assert len(alerts) >= 1
        
        alert = alerts[0]
        assert alert.alert_level == HealthStatus.CRITICAL
        assert len(alert.metrics) == 1
        assert alert.metrics[0].metric_id == "critical_test"
    
    @pytest.mark.asyncio
    async def test_alert_callback_notification(self, health_monitor):
        """Test alert callback notification"""
        # Register alert callback
        callback_calls = []
        
        def alert_callback(alert):
            callback_calls.append(alert)
        
        health_monitor.register_alert_callback(alert_callback)
        
        # Create and notify alert
        test_alert = HealthAlert(
            alert_id="callback_test",
            agent_id="test_agent",
            alert_level=HealthStatus.WARNING,
            title="Test Alert",
            description="Test alert for callback"
        )
        
        await health_monitor._notify_alert(test_alert)
        
        # Verify callback was called
        assert len(callback_calls) == 1
        assert callback_calls[0].alert_id == "callback_test"
    
    @pytest.mark.asyncio
    async def test_alert_acknowledgment_resolution(self, health_monitor):
        """Test alert acknowledgment and resolution"""
        # Add test alert
        test_alert = HealthAlert(
            alert_id="test_alert",
            agent_id="test_agent", 
            alert_level=HealthStatus.WARNING,
            title="Test Alert",
            description="Test alert"
        )
        
        health_monitor.health_alerts["test_alert"] = test_alert
        
        # Acknowledge alert
        success = health_monitor.acknowledge_alert("test_alert")
        assert success is True
        assert test_alert.acknowledged is True
        
        # Resolve alert
        success = health_monitor.resolve_alert("test_alert")
        assert success is True
        assert test_alert.resolved is True
        
        # Test nonexistent alert
        assert health_monitor.acknowledge_alert("nonexistent") is False
        assert health_monitor.resolve_alert("nonexistent") is False
    
    @pytest.mark.asyncio
    async def test_recovery_action_registration(self, health_monitor):
        """Test recovery action registration and management"""
        # Create custom recovery action
        custom_action = RecoveryAction(
            action_id="custom_restart",
            trigger_condition="agent_status == FAILED",
            action_type="restart",
            agent_id="specific_agent",
            parameters={"wait_time": 10},
            cooldown_seconds=120.0,
            max_attempts=5
        )
        
        # Add recovery action
        health_monitor.add_recovery_action(custom_action)
        
        # Verify action was registered
        assert "custom_restart" in health_monitor.recovery_actions
        registered_action = health_monitor.recovery_actions["custom_restart"]
        assert registered_action.action_id == "custom_restart"
        assert registered_action.max_attempts == 5
    
    @pytest.mark.asyncio
    async def test_recovery_trigger_evaluation(self, health_monitor):
        """Test recovery action trigger evaluation"""
        # Mock multi-agent to have failed agents
        mock_failed_agent = Mock()
        mock_failed_agent.status = AgentStatus.FAILED
        health_monitor.multi_agent.list_agents.return_value = [mock_failed_agent]
        
        # Test agent failure trigger
        restart_action = health_monitor.recovery_actions["agent_restart"]
        should_trigger = await health_monitor._evaluate_recovery_trigger(restart_action)
        assert should_trigger is True
        
        # Test with healthy agents
        mock_healthy_agent = Mock()
        mock_healthy_agent.status = AgentStatus.IDLE
        health_monitor.multi_agent.list_agents.return_value = [mock_healthy_agent]
        
        should_trigger = await health_monitor._evaluate_recovery_trigger(restart_action)
        assert should_trigger is False
    
    @pytest.mark.asyncio
    async def test_system_health_snapshot(self, health_monitor):
        """Test system health snapshot generation"""
        # Mock multi-agent data
        mock_agents = []
        for i, status in enumerate([AgentStatus.IDLE, AgentStatus.BUSY, AgentStatus.FAILED]):
            agent = Mock()
            agent.config.agent_id = f"agent_{i}"
            agent.status = status
            agent.task_count = i * 5
            mock_agents.append(agent)
        
        health_monitor.multi_agent.list_agents.return_value = mock_agents
        
        # Add some metrics to history
        system_metrics = [
            HealthMetric(
                metric_id="system_cpu_percent",
                metric_type=MetricType.RESOURCE,
                agent_id=None,
                value=65.0,
                timestamp=time.time()
            ),
            HealthMetric(
                metric_id="system_memory_percent", 
                metric_type=MetricType.RESOURCE,
                agent_id=None,
                value=75.0,
                timestamp=time.time()
            )
        ]
        
        health_monitor.metrics_history.extend(system_metrics)
        
        # Add an unresolved alert
        test_alert = HealthAlert(
            alert_id="test_unresolved",
            agent_id="agent_0",
            alert_level=HealthStatus.WARNING,
            title="Test Alert",
            description="Unresolved alert"
        )
        health_monitor.health_alerts["test_unresolved"] = test_alert
        
        # Get system health snapshot
        system_health = await health_monitor.get_system_health()
        
        # Verify system health data
        assert isinstance(system_health, SystemHealth)
        assert system_health.agent_count == 3
        assert system_health.healthy_agents >= 0
        assert system_health.failed_agents >= 1
        assert system_health.active_alerts == 1
        assert system_health.system_cpu_percent == 65.0
        assert system_health.system_memory_percent == 75.0
        assert system_health.uptime_seconds > 0
    
    @pytest.mark.asyncio
    async def test_metrics_history_filtering(self, health_monitor):
        """Test metrics history filtering"""
        # Add test metrics
        test_metrics = [
            HealthMetric(
                metric_id="agent1_cpu",
                metric_type=MetricType.RESOURCE,
                agent_id="agent1",
                value=50.0,
                timestamp=time.time() - 1800  # 30 minutes ago
            ),
            HealthMetric(
                metric_id="agent1_memory",
                metric_type=MetricType.RESOURCE, 
                agent_id="agent1",
                value=60.0,
                timestamp=time.time() - 900   # 15 minutes ago
            ),
            HealthMetric(
                metric_id="agent2_cpu",
                metric_type=MetricType.RESOURCE,
                agent_id="agent2", 
                value=70.0,
                timestamp=time.time() - 300   # 5 minutes ago
            ),
            HealthMetric(
                metric_id="system_uptime",
                metric_type=MetricType.AVAILABILITY,
                agent_id=None,
                value=3600.0,
                timestamp=time.time() - 60    # 1 minute ago
            )
        ]
        
        health_monitor.metrics_history.extend(test_metrics)
        
        # Filter by agent
        agent1_metrics = health_monitor.get_metrics_history(agent_id="agent1", hours=1)
        assert len(agent1_metrics) == 2
        assert all(m.agent_id == "agent1" for m in agent1_metrics)
        
        # Filter by metric type
        resource_metrics = health_monitor.get_metrics_history(
            metric_type=MetricType.RESOURCE, 
            hours=1
        )
        assert len(resource_metrics) == 3
        assert all(m.metric_type == MetricType.RESOURCE for m in resource_metrics)
        
        # Filter by time (30 minutes)
        recent_metrics = health_monitor.get_metrics_history(hours=0.5)
        assert len(recent_metrics) == 2  # Only last 2 metrics within 30 minutes
    
    @pytest.mark.asyncio
    async def test_active_alerts_filtering(self, health_monitor):
        """Test active alerts filtering"""
        # Add test alerts
        alerts = [
            HealthAlert(
                alert_id="alert1",
                agent_id="agent1",
                alert_level=HealthStatus.WARNING,
                title="Agent1 Alert",
                description="Active alert for agent1"
            ),
            HealthAlert(
                alert_id="alert2", 
                agent_id="agent2",
                alert_level=HealthStatus.CRITICAL,
                title="Agent2 Alert", 
                description="Active alert for agent2"
            ),
            HealthAlert(
                alert_id="alert3",
                agent_id="agent1",
                alert_level=HealthStatus.WARNING,
                title="Resolved Alert",
                description="Resolved alert for agent1",
                resolved=True  # This one is resolved
            )
        ]
        
        for alert in alerts:
            health_monitor.health_alerts[alert.alert_id] = alert
        
        # Get all active alerts
        active_alerts = health_monitor.get_active_alerts()
        assert len(active_alerts) == 2  # Only unresolved alerts
        assert all(not alert.resolved for alert in active_alerts)
        
        # Filter by agent
        agent1_alerts = health_monitor.get_active_alerts(agent_id="agent1")
        assert len(agent1_alerts) == 1
        assert agent1_alerts[0].alert_id == "alert1"
    
    @pytest.mark.asyncio
    async def test_health_summary(self, health_monitor):
        """Test health summary generation"""
        # Start monitor to initialize tasks
        await health_monitor.start()
        
        # Add some test data
        health_monitor.metrics_history.append(
            HealthMetric("test_metric", MetricType.PERFORMANCE, "agent1", 100.0)
        )
        
        test_alert = HealthAlert(
            alert_id="summary_test",
            agent_id="agent1",
            alert_level=HealthStatus.WARNING,
            title="Test Alert",
            description="Test"
        )
        health_monitor.health_alerts["summary_test"] = test_alert
        
        # Get health summary
        summary = health_monitor.get_health_summary()
        
        # Verify summary structure
        assert 'monitoring_active' in summary
        assert 'last_health_check' in summary
        assert 'total_metrics_collected' in summary
        assert 'active_alerts' in summary
        assert 'recovery_actions_configured' in summary
        assert 'system_uptime_seconds' in summary
        
        # Verify values
        assert summary['monitoring_active'] is True
        assert summary['total_metrics_collected'] >= 1
        assert summary['active_alerts'] >= 1
        assert summary['recovery_actions_configured'] >= 3  # Default actions
        
        await health_monitor.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])