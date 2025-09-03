#!/usr/bin/env python3
"""
Health Monitor - Advanced health monitoring and recovery system

Provides comprehensive health monitoring, diagnostics, and automatic recovery
for the multi-agent system. Integrates with system metrics, process monitoring,
and Epic 3 resource management.
"""

import asyncio
import time
import logging
import json
from typing import Dict, List, Optional, Set, Tuple, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import deque, defaultdict
from pathlib import Path

# Try to import psutil for advanced system monitoring
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """Overall health status levels"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    FAILED = "failed"
    UNKNOWN = "unknown"


class MetricType(Enum):
    """Types of metrics collected"""
    PERFORMANCE = "performance"
    RESOURCE = "resource"
    ERROR_RATE = "error_rate"
    AVAILABILITY = "availability"
    RESPONSE_TIME = "response_time"
    THROUGHPUT = "throughput"


@dataclass
class HealthMetric:
    """Individual health metric data point"""
    metric_id: str
    metric_type: MetricType
    agent_id: Optional[str]
    value: float
    timestamp: float = field(default_factory=time.time)
    unit: str = ""
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def get_status(self) -> HealthStatus:
        """Determine health status based on thresholds"""
        if self.threshold_critical and self.value >= self.threshold_critical:
            return HealthStatus.CRITICAL
        elif self.threshold_warning and self.value >= self.threshold_warning:
            return HealthStatus.WARNING
        else:
            return HealthStatus.HEALTHY


@dataclass
class HealthAlert:
    """Health alert/notification"""
    alert_id: str
    agent_id: Optional[str]
    alert_level: HealthStatus
    title: str
    description: str
    timestamp: float = field(default_factory=time.time)
    metrics: List[HealthMetric] = field(default_factory=list)
    acknowledged: bool = False
    resolved: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RecoveryAction:
    """Automated recovery action"""
    action_id: str
    trigger_condition: str
    action_type: str  # restart, scale_up, alert, custom
    agent_id: Optional[str]
    parameters: Dict[str, Any] = field(default_factory=dict)
    cooldown_seconds: float = 300.0  # 5 minutes
    max_attempts: int = 3
    last_executed: Optional[float] = None
    execution_count: int = 0
    success_count: int = 0


@dataclass
class SystemHealth:
    """Overall system health snapshot"""
    timestamp: float = field(default_factory=time.time)
    overall_status: HealthStatus = HealthStatus.HEALTHY
    agent_count: int = 0
    healthy_agents: int = 0
    warning_agents: int = 0
    critical_agents: int = 0
    failed_agents: int = 0
    active_alerts: int = 0
    system_cpu_percent: Optional[float] = None
    system_memory_percent: Optional[float] = None
    system_disk_percent: Optional[float] = None
    uptime_seconds: float = 0
    total_tasks_completed: int = 0
    error_rate_percent: float = 0
    average_response_time_ms: float = 0
    recommendations: List[str] = field(default_factory=list)


class HealthMonitor:
    """
    Comprehensive health monitoring system for multi-agent environment.
    
    Features:
    - Real-time system and agent metrics collection
    - Configurable health thresholds and alerts
    - Automated recovery actions
    - Health history and trending analysis
    - Integration with Epic 3 resource management
    - Predictive health analysis
    - Custom health checks and metrics
    """
    
    def __init__(self, multi_agent_wrapper=None, config: Optional[Dict] = None):
        self.multi_agent = multi_agent_wrapper
        self.config = config or {}
        self.logger = logging.getLogger(f"{__name__}.HealthMonitor")
        
        # Health monitoring configuration
        self.monitoring_interval = self.config.get('monitoring_interval', 30.0)
        self.metric_retention_hours = self.config.get('metric_retention_hours', 24)
        self.alert_retention_hours = self.config.get('alert_retention_hours', 72)
        self.enable_auto_recovery = self.config.get('enable_auto_recovery', True)
        self.enable_predictive_analysis = self.config.get('enable_predictive_analysis', False)
        
        # Data storage
        self.metrics_history: deque = deque()
        self.health_alerts: Dict[str, HealthAlert] = {}
        self.recovery_actions: Dict[str, RecoveryAction] = {}
        self.custom_health_checks: Dict[str, Callable] = {}
        
        # System state tracking
        self.system_start_time = time.time()
        self.last_health_check = 0.0
        self.agent_health_cache: Dict[str, Tuple[HealthStatus, float]] = {}
        
        # Background tasks
        self.monitoring_task: Optional[asyncio.Task] = None
        self.alert_processor_task: Optional[asyncio.Task] = None
        self.recovery_task: Optional[asyncio.Task] = None
        self.cleanup_task: Optional[asyncio.Task] = None
        
        # Alert notification callbacks
        self.alert_callbacks: List[Callable[[HealthAlert], None]] = []
        
        # Initialize default recovery actions
        self._initialize_default_recovery_actions()
        
        self.logger.info("HealthMonitor initialized")
    
    def _initialize_default_recovery_actions(self):
        """Initialize default automated recovery actions"""
        # Agent restart on failure
        self.recovery_actions["agent_restart"] = RecoveryAction(
            action_id="agent_restart",
            trigger_condition="agent_status == FAILED",
            action_type="restart",
            agent_id=None,  # Will be set per agent
            parameters={"force": False, "delay_seconds": 5.0},
            cooldown_seconds=300.0,
            max_attempts=3
        )
        
        # System resource alert
        self.recovery_actions["high_memory_alert"] = RecoveryAction(
            action_id="high_memory_alert",
            trigger_condition="system_memory_percent > 85",
            action_type="alert",
            agent_id=None,
            parameters={"severity": "warning"},
            cooldown_seconds=600.0,  # 10 minutes
            max_attempts=999  # Always alert
        )
        
        # Scale up on high load
        self.recovery_actions["scale_up_on_load"] = RecoveryAction(
            action_id="scale_up_on_load",
            trigger_condition="busy_agent_ratio > 0.8 AND queue_length > 5",
            action_type="scale_up",
            agent_id=None,
            parameters={"target_agents": 1},
            cooldown_seconds=180.0,  # 3 minutes
            max_attempts=5
        )
    
    async def start(self):
        """Start health monitoring system"""
        self.logger.info("Starting health monitoring system")
        
        # Start background monitoring tasks
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        self.alert_processor_task = asyncio.create_task(self._alert_processor_loop())
        
        if self.enable_auto_recovery:
            self.recovery_task = asyncio.create_task(self._recovery_loop())
        
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        self.logger.info("Health monitoring system started")
    
    async def stop(self, timeout: float = 10.0):
        """Stop health monitoring system"""
        self.logger.info("Stopping health monitoring system")
        
        # Cancel background tasks
        tasks_to_cancel = []
        for task in [self.monitoring_task, self.alert_processor_task, 
                    self.recovery_task, self.cleanup_task]:
            if task:
                tasks_to_cancel.append(task)
        
        for task in tasks_to_cancel:
            task.cancel()
        
        if tasks_to_cancel:
            await asyncio.wait_for(
                asyncio.gather(*tasks_to_cancel, return_exceptions=True),
                timeout=timeout
            )
        
        self.logger.info("Health monitoring system stopped")
    
    async def _monitoring_loop(self):
        """Main health monitoring loop"""
        self.logger.info("Starting health monitoring loop")
        
        while True:
            try:
                # Collect system metrics
                await self._collect_system_metrics()
                
                # Collect agent metrics
                if self.multi_agent:
                    await self._collect_agent_metrics()
                
                # Run custom health checks
                await self._run_custom_health_checks()
                
                # Analyze metrics and generate alerts
                await self._analyze_health_metrics()
                
                # Update last check time
                self.last_health_check = time.time()
                
                # Wait for next monitoring cycle
                await asyncio.sleep(self.monitoring_interval)
                
            except asyncio.CancelledError:
                self.logger.info("Health monitoring loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in health monitoring loop: {e}")
                await asyncio.sleep(self.monitoring_interval)
        
        self.logger.info("Health monitoring loop stopped")
    
    async def _collect_system_metrics(self):
        """Collect system-wide health metrics"""
        current_time = time.time()
        
        # System uptime
        uptime_metric = HealthMetric(
            metric_id="system_uptime",
            metric_type=MetricType.AVAILABILITY,
            agent_id=None,
            value=current_time - self.system_start_time,
            unit="seconds"
        )
        self.metrics_history.append(uptime_metric)
        
        # System resource metrics (if psutil available)
        if HAS_PSUTIL:
            try:
                # CPU usage
                cpu_percent = psutil.cpu_percent(interval=1.0)
                cpu_metric = HealthMetric(
                    metric_id="system_cpu_percent",
                    metric_type=MetricType.RESOURCE,
                    agent_id=None,
                    value=cpu_percent,
                    unit="percent",
                    threshold_warning=70.0,
                    threshold_critical=90.0
                )
                self.metrics_history.append(cpu_metric)
                
                # Memory usage
                memory = psutil.virtual_memory()
                memory_metric = HealthMetric(
                    metric_id="system_memory_percent",
                    metric_type=MetricType.RESOURCE,
                    agent_id=None,
                    value=memory.percent,
                    unit="percent",
                    threshold_warning=80.0,
                    threshold_critical=90.0,
                    metadata={
                        'total_gb': memory.total / (1024**3),
                        'available_gb': memory.available / (1024**3)
                    }
                )
                self.metrics_history.append(memory_metric)
                
                # Disk usage
                disk = psutil.disk_usage('/')
                disk_metric = HealthMetric(
                    metric_id="system_disk_percent",
                    metric_type=MetricType.RESOURCE,
                    agent_id=None,
                    value=(disk.used / disk.total) * 100,
                    unit="percent",
                    threshold_warning=80.0,
                    threshold_critical=95.0,
                    metadata={
                        'total_gb': disk.total / (1024**3),
                        'free_gb': disk.free / (1024**3)
                    }
                )
                self.metrics_history.append(disk_metric)
                
            except Exception as e:
                self.logger.error(f"Error collecting system metrics: {e}")
    
    async def _collect_agent_metrics(self):
        """Collect agent-specific health metrics"""
        if not self.multi_agent:
            return
        
        try:
            agents = self.multi_agent.list_agents()
            current_time = time.time()
            
            for agent_info in agents:
                agent_id = agent_info.config.agent_id
                
                # Agent availability metric
                availability_value = 1.0 if agent_info.status.value in ['idle', 'busy'] else 0.0
                availability_metric = HealthMetric(
                    metric_id=f"agent_availability_{agent_id}",
                    metric_type=MetricType.AVAILABILITY,
                    agent_id=agent_id,
                    value=availability_value,
                    unit="binary",
                    threshold_critical=0.5,  # Critical if agent unavailable
                    metadata={'status': agent_info.status.value}
                )
                self.metrics_history.append(availability_metric)
                
                # Agent task metrics
                if agent_info.task_count > 0:
                    # Error rate
                    error_rate = (agent_info.error_count / agent_info.task_count) * 100
                    error_rate_metric = HealthMetric(
                        metric_id=f"agent_error_rate_{agent_id}",
                        metric_type=MetricType.ERROR_RATE,
                        agent_id=agent_id,
                        value=error_rate,
                        unit="percent",
                        threshold_warning=10.0,
                        threshold_critical=25.0,
                        metadata={
                            'total_tasks': agent_info.task_count,
                            'errors': agent_info.error_count
                        }
                    )
                    self.metrics_history.append(error_rate_metric)
                
                # Agent uptime
                uptime = agent_info.get_uptime_seconds() or 0
                uptime_metric = HealthMetric(
                    metric_id=f"agent_uptime_{agent_id}",
                    metric_type=MetricType.AVAILABILITY,
                    agent_id=agent_id,
                    value=uptime,
                    unit="seconds"
                )
                self.metrics_history.append(uptime_metric)
                
                # Resource usage (if available)
                if agent_info.resource_stats and HAS_PSUTIL:
                    pid = agent_info.resource_stats.get('process_pid')
                    if pid:
                        try:
                            process = psutil.Process(pid)
                            
                            # Memory usage
                            memory_info = process.memory_info()
                            memory_mb = memory_info.rss / (1024 * 1024)
                            memory_metric = HealthMetric(
                                metric_id=f"agent_memory_{agent_id}",
                                metric_type=MetricType.RESOURCE,
                                agent_id=agent_id,
                                value=memory_mb,
                                unit="MB",
                                threshold_warning=agent_info.config.max_memory_mb * 0.8,
                                threshold_critical=agent_info.config.max_memory_mb,
                                metadata={'limit_mb': agent_info.config.max_memory_mb}
                            )
                            self.metrics_history.append(memory_metric)
                            
                            # CPU usage
                            cpu_percent = process.cpu_percent()
                            cpu_metric = HealthMetric(
                                metric_id=f"agent_cpu_{agent_id}",
                                metric_type=MetricType.RESOURCE,
                                agent_id=agent_id,
                                value=cpu_percent,
                                unit="percent",
                                threshold_warning=agent_info.config.max_cpu_percent * 0.8,
                                threshold_critical=agent_info.config.max_cpu_percent,
                                metadata={'limit_percent': agent_info.config.max_cpu_percent}
                            )
                            self.metrics_history.append(cpu_metric)
                            
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            # Process not accessible
                            pass
                
        except Exception as e:
            self.logger.error(f"Error collecting agent metrics: {e}")
    
    async def _run_custom_health_checks(self):
        """Run registered custom health checks"""
        for check_name, check_func in self.custom_health_checks.items():
            try:
                # Run health check
                if asyncio.iscoroutinefunction(check_func):
                    result = await check_func()
                else:
                    result = check_func()
                
                # Process result if it returns metrics
                if isinstance(result, list):
                    for metric in result:
                        if isinstance(metric, HealthMetric):
                            self.metrics_history.append(metric)
                elif isinstance(result, HealthMetric):
                    self.metrics_history.append(result)
                
            except Exception as e:
                self.logger.error(f"Error in custom health check '{check_name}': {e}")
    
    async def _analyze_health_metrics(self):
        """Analyze collected metrics and generate alerts if needed"""
        current_time = time.time()
        recent_metrics = [m for m in self.metrics_history 
                         if current_time - m.timestamp <= 300]  # Last 5 minutes
        
        # Group metrics by agent and type
        agent_metrics = defaultdict(list)
        system_metrics = []
        
        for metric in recent_metrics:
            if metric.agent_id:
                agent_metrics[metric.agent_id].append(metric)
            else:
                system_metrics.append(metric)
        
        # Analyze system metrics
        await self._analyze_system_health(system_metrics)
        
        # Analyze agent metrics
        for agent_id, metrics in agent_metrics.items():
            await self._analyze_agent_health(agent_id, metrics)
    
    async def _analyze_system_health(self, metrics: List[HealthMetric]):
        """Analyze system-level health metrics"""
        for metric in metrics:
            status = metric.get_status()
            
            if status in [HealthStatus.WARNING, HealthStatus.CRITICAL]:
                # Generate alert if threshold exceeded
                alert_id = f"system_{metric.metric_id}_{int(metric.timestamp)}"
                
                if alert_id not in self.health_alerts:
                    alert = HealthAlert(
                        alert_id=alert_id,
                        agent_id=None,
                        alert_level=status,
                        title=f"System {metric.metric_type.value} Alert",
                        description=f"{metric.metric_id} is {metric.value:.1f}{metric.unit} "
                                  f"(threshold: {metric.threshold_warning or metric.threshold_critical:.1f})",
                        metrics=[metric]
                    )
                    
                    self.health_alerts[alert_id] = alert
                    await self._notify_alert(alert)
    
    async def _analyze_agent_health(self, agent_id: str, metrics: List[HealthMetric]):
        """Analyze agent-specific health metrics"""
        # Determine overall agent health status
        agent_status = HealthStatus.HEALTHY
        critical_metrics = []
        warning_metrics = []
        
        for metric in metrics:
            status = metric.get_status()
            if status == HealthStatus.CRITICAL:
                critical_metrics.append(metric)
                agent_status = HealthStatus.CRITICAL
            elif status == HealthStatus.WARNING and agent_status != HealthStatus.CRITICAL:
                warning_metrics.append(metric)
                agent_status = HealthStatus.WARNING
        
        # Update agent health cache
        self.agent_health_cache[agent_id] = (agent_status, time.time())
        
        # Generate alerts for problematic metrics
        problematic_metrics = critical_metrics + warning_metrics
        if problematic_metrics:
            alert_id = f"agent_{agent_id}_{int(time.time())}"
            
            # Don't create duplicate alerts for same agent within 5 minutes
            recent_agent_alerts = [a for a in self.health_alerts.values()
                                 if a.agent_id == agent_id and 
                                 time.time() - a.timestamp <= 300 and
                                 not a.resolved]
            
            if not recent_agent_alerts:
                alert = HealthAlert(
                    alert_id=alert_id,
                    agent_id=agent_id,
                    alert_level=agent_status,
                    title=f"Agent Health Alert: {agent_id}",
                    description=f"Agent {agent_id} has {len(problematic_metrics)} health issues",
                    metrics=problematic_metrics
                )
                
                self.health_alerts[alert_id] = alert
                await self._notify_alert(alert)
    
    async def _notify_alert(self, alert: HealthAlert):
        """Notify about new health alert"""
        self.logger.warning(f"Health alert: {alert.title} - {alert.description}")
        
        # Call registered alert callbacks
        for callback in self.alert_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(alert)
                else:
                    callback(alert)
            except Exception as e:
                self.logger.error(f"Error in alert callback: {e}")
    
    async def _alert_processor_loop(self):
        """Background alert processing loop"""
        self.logger.info("Starting alert processor loop")
        
        while True:
            try:
                # Process active alerts for auto-resolution
                await self._process_alert_resolution()
                
                await asyncio.sleep(60)  # Check every minute
                
            except asyncio.CancelledError:
                self.logger.info("Alert processor loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in alert processor loop: {e}")
                await asyncio.sleep(60)
        
        self.logger.info("Alert processor loop stopped")
    
    async def _process_alert_resolution(self):
        """Process alerts for potential auto-resolution"""
        current_time = time.time()
        
        for alert in list(self.health_alerts.values()):
            if alert.resolved or alert.acknowledged:
                continue
            
            # Check if alert conditions are still present
            should_resolve = True
            for metric in alert.metrics:
                # Get recent metrics of same type for same agent
                recent_metrics = [m for m in self.metrics_history
                                if m.metric_id == metric.metric_id and
                                m.agent_id == metric.agent_id and
                                current_time - m.timestamp <= 60]  # Last minute
                
                if recent_metrics:
                    latest_metric = max(recent_metrics, key=lambda m: m.timestamp)
                    if latest_metric.get_status() in [HealthStatus.WARNING, HealthStatus.CRITICAL]:
                        should_resolve = False
                        break
            
            if should_resolve:
                alert.resolved = True
                self.logger.info(f"Auto-resolved alert: {alert.alert_id}")
    
    async def _recovery_loop(self):
        """Background recovery action loop"""
        self.logger.info("Starting recovery loop")
        
        while True:
            try:
                await self._execute_recovery_actions()
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except asyncio.CancelledError:
                self.logger.info("Recovery loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in recovery loop: {e}")
                await asyncio.sleep(60)
        
        self.logger.info("Recovery loop stopped")
    
    async def _execute_recovery_actions(self):
        """Execute applicable recovery actions"""
        current_time = time.time()
        
        for action in self.recovery_actions.values():
            # Check cooldown
            if (action.last_executed and 
                current_time - action.last_executed < action.cooldown_seconds):
                continue
            
            # Check max attempts
            if action.execution_count >= action.max_attempts:
                continue
            
            # Check trigger condition
            if await self._evaluate_recovery_trigger(action):
                await self._execute_recovery_action(action)
    
    async def _evaluate_recovery_trigger(self, action: RecoveryAction) -> bool:
        """Evaluate if recovery action trigger condition is met"""
        # This is a simplified evaluation - a real implementation would
        # parse and evaluate the trigger condition string
        
        condition = action.trigger_condition.lower()
        
        if "agent_status == failed" in condition:
            if self.multi_agent:
                failed_agents = self.multi_agent.list_agents(
                    status_filter=self.multi_agent.AgentStatus.FAILED
                )
                return len(failed_agents) > 0
        
        elif "system_memory_percent >" in condition:
            # Get latest system memory metric
            recent_metrics = [m for m in self.metrics_history
                            if m.metric_id == "system_memory_percent" and
                            time.time() - m.timestamp <= 120]  # Last 2 minutes
            
            if recent_metrics:
                latest_metric = max(recent_metrics, key=lambda m: m.timestamp)
                threshold = float(condition.split(">")[1].strip())
                return latest_metric.value > threshold
        
        return False
    
    async def _execute_recovery_action(self, action: RecoveryAction):
        """Execute a specific recovery action"""
        action.execution_count += 1
        action.last_executed = time.time()
        
        try:
            if action.action_type == "restart":
                # Restart failed agents
                if self.multi_agent:
                    failed_agents = self.multi_agent.list_agents(
                        status_filter=self.multi_agent.AgentStatus.FAILED
                    )
                    
                    for agent_info in failed_agents:
                        agent_id = agent_info.config.agent_id
                        self.logger.info(f"Executing recovery restart for agent {agent_id}")
                        
                        success = await self.multi_agent.start_agent(agent_id)
                        if success:
                            action.success_count += 1
            
            elif action.action_type == "alert":
                # Generate recovery alert
                alert = HealthAlert(
                    alert_id=f"recovery_{action.action_id}_{int(time.time())}",
                    agent_id=action.agent_id,
                    alert_level=HealthStatus.WARNING,
                    title=f"Recovery Action: {action.action_id}",
                    description=f"Automated recovery action triggered: {action.trigger_condition}",
                    metadata={'recovery_action': action.action_id}
                )
                
                self.health_alerts[alert.alert_id] = alert
                await self._notify_alert(alert)
                action.success_count += 1
            
            # Other action types would be implemented here
            
        except Exception as e:
            self.logger.error(f"Error executing recovery action {action.action_id}: {e}")
    
    async def _cleanup_loop(self):
        """Background cleanup loop"""
        self.logger.info("Starting health monitor cleanup loop")
        
        while True:
            try:
                current_time = time.time()
                
                # Clean up old metrics
                retention_seconds = self.metric_retention_hours * 3600
                cutoff_time = current_time - retention_seconds
                
                # Remove old metrics
                self.metrics_history = deque([
                    m for m in self.metrics_history if m.timestamp > cutoff_time
                ])
                
                # Clean up old alerts
                alert_retention_seconds = self.alert_retention_hours * 3600
                alert_cutoff_time = current_time - alert_retention_seconds
                
                old_alerts = [
                    alert_id for alert_id, alert in self.health_alerts.items()
                    if alert.timestamp < alert_cutoff_time and alert.resolved
                ]
                
                for alert_id in old_alerts:
                    del self.health_alerts[alert_id]
                
                if old_alerts:
                    self.logger.info(f"Cleaned up {len(old_alerts)} old alerts")
                
                await asyncio.sleep(3600)  # Cleanup every hour
                
            except asyncio.CancelledError:
                self.logger.info("Health monitor cleanup loop cancelled")
                break
            except Exception as e:
                self.logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(3600)
        
        self.logger.info("Health monitor cleanup loop stopped")
    
    # Public API methods
    
    def register_custom_health_check(self, name: str, check_func: Callable) -> str:
        """Register a custom health check function"""
        self.custom_health_checks[name] = check_func
        self.logger.info(f"Registered custom health check: {name}")
        return name
    
    def unregister_custom_health_check(self, name: str):
        """Remove a custom health check"""
        if name in self.custom_health_checks:
            del self.custom_health_checks[name]
            self.logger.info(f"Unregistered custom health check: {name}")
    
    def register_alert_callback(self, callback: Callable[[HealthAlert], None]):
        """Register callback to be notified of new alerts"""
        self.alert_callbacks.append(callback)
    
    def add_recovery_action(self, action: RecoveryAction):
        """Add a custom recovery action"""
        self.recovery_actions[action.action_id] = action
        self.logger.info(f"Added recovery action: {action.action_id}")
    
    def acknowledge_alert(self, alert_id: str) -> bool:
        """Acknowledge an alert"""
        if alert_id in self.health_alerts:
            self.health_alerts[alert_id].acknowledged = True
            self.logger.info(f"Alert acknowledged: {alert_id}")
            return True
        return False
    
    def resolve_alert(self, alert_id: str) -> bool:
        """Manually resolve an alert"""
        if alert_id in self.health_alerts:
            self.health_alerts[alert_id].resolved = True
            self.logger.info(f"Alert resolved: {alert_id}")
            return True
        return False
    
    async def get_system_health(self) -> SystemHealth:
        """Get current system health snapshot"""
        current_time = time.time()
        
        # Get latest system metrics
        recent_metrics = [m for m in self.metrics_history 
                         if current_time - m.timestamp <= 300]  # Last 5 minutes
        
        system_cpu = None
        system_memory = None
        system_disk = None
        
        for metric in recent_metrics:
            if metric.metric_id == "system_cpu_percent":
                system_cpu = metric.value
            elif metric.metric_id == "system_memory_percent":
                system_memory = metric.value
            elif metric.metric_id == "system_disk_percent":
                system_disk = metric.value
        
        # Count agents by health status
        agent_counts = defaultdict(int)
        if self.multi_agent:
            agents = self.multi_agent.list_agents()
            total_agents = len(agents)
            
            for agent_info in agents:
                agent_id = agent_info.config.agent_id
                if agent_id in self.agent_health_cache:
                    status, _ = self.agent_health_cache[agent_id]
                    agent_counts[status.value] += 1
                else:
                    # Default to healthy if no health data
                    agent_counts[HealthStatus.HEALTHY.value] += 1
        else:
            total_agents = 0
        
        # Determine overall system health
        active_alerts = len([a for a in self.health_alerts.values() if not a.resolved])
        
        if agent_counts.get(HealthStatus.CRITICAL.value, 0) > 0:
            overall_status = HealthStatus.CRITICAL
        elif agent_counts.get(HealthStatus.FAILED.value, 0) > 0:
            overall_status = HealthStatus.FAILED
        elif agent_counts.get(HealthStatus.WARNING.value, 0) > 0 or active_alerts > 0:
            overall_status = HealthStatus.WARNING
        else:
            overall_status = HealthStatus.HEALTHY
        
        # Generate recommendations
        recommendations = []
        if system_memory and system_memory > 85:
            recommendations.append("System memory usage is high - consider reducing agent memory limits")
        if system_cpu and system_cpu > 80:
            recommendations.append("System CPU usage is high - consider reducing concurrent agents")
        if active_alerts > 5:
            recommendations.append(f"{active_alerts} active alerts - review and resolve issues")
        
        return SystemHealth(
            timestamp=current_time,
            overall_status=overall_status,
            agent_count=total_agents,
            healthy_agents=agent_counts.get(HealthStatus.HEALTHY.value, 0),
            warning_agents=agent_counts.get(HealthStatus.WARNING.value, 0),
            critical_agents=agent_counts.get(HealthStatus.CRITICAL.value, 0),
            failed_agents=agent_counts.get(HealthStatus.FAILED.value, 0),
            active_alerts=active_alerts,
            system_cpu_percent=system_cpu,
            system_memory_percent=system_memory,
            system_disk_percent=system_disk,
            uptime_seconds=current_time - self.system_start_time,
            recommendations=recommendations
        )
    
    def get_metrics_history(self, agent_id: Optional[str] = None,
                          metric_type: Optional[MetricType] = None,
                          hours: int = 1) -> List[HealthMetric]:
        """Get metrics history with filtering"""
        cutoff_time = time.time() - (hours * 3600)
        
        metrics = [m for m in self.metrics_history if m.timestamp > cutoff_time]
        
        if agent_id:
            metrics = [m for m in metrics if m.agent_id == agent_id]
        
        if metric_type:
            metrics = [m for m in metrics if m.metric_type == metric_type]
        
        return sorted(metrics, key=lambda m: m.timestamp)
    
    def get_active_alerts(self, agent_id: Optional[str] = None) -> List[HealthAlert]:
        """Get active (unresolved) alerts"""
        alerts = [a for a in self.health_alerts.values() if not a.resolved]
        
        if agent_id:
            alerts = [a for a in alerts if a.agent_id == agent_id]
        
        return sorted(alerts, key=lambda a: a.timestamp, reverse=True)
    
    def get_health_summary(self) -> Dict[str, Any]:
        """Get comprehensive health summary"""
        current_time = time.time()
        
        return {
            'monitoring_active': self.monitoring_task and not self.monitoring_task.done(),
            'last_health_check': self.last_health_check,
            'health_check_age_seconds': current_time - self.last_health_check,
            'total_metrics_collected': len(self.metrics_history),
            'active_alerts': len(self.get_active_alerts()),
            'total_alerts': len(self.health_alerts),
            'recovery_actions_configured': len(self.recovery_actions),
            'custom_health_checks': len(self.custom_health_checks),
            'system_uptime_seconds': current_time - self.system_start_time,
            'monitoring_interval_seconds': self.monitoring_interval,
            'auto_recovery_enabled': self.enable_auto_recovery
        }