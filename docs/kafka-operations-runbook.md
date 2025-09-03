# Kafka Operations Runbook - Daily Procedures and Incident Response

## Overview

This runbook provides operational procedures for managing Apache Kafka clusters in the dual-agent architecture, supporting a 15 FTE team across 4 organizational teams. Based on the comprehensive migration to event-driven architecture, this document enables operational excellence and smooth Sprint 1 execution.

## Daily Operational Procedures

### Morning Health Checks

#### 1. Cluster Health Assessment
**Frequency:** Daily at 08:00 UTC  
**Duration:** 15 minutes  
**Owner:** Operations Team

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== Kafka Cluster Health Check - $(date) ==="

# Check broker status
echo "Checking broker status..."
kafka-broker-api-versions --bootstrap-server kafka-broker-1:9092,kafka-broker-2:9092,kafka-broker-3:9092

# Check under-replicated partitions
echo "Checking under-replicated partitions..."
kafka-topics --bootstrap-server kafka-broker-1:9092 --describe --under-replicated-partitions

# Check consumer group lag
echo "Checking consumer group lag..."
for group in agent-coordinator analytics-processor quality-gates monitoring-events; do
  echo "Group: $group"
  kafka-consumer-groups --bootstrap-server kafka-broker-1:9092 --group $group --describe
done

# Check disk usage
echo "Checking disk usage..."
for broker in kafka-broker-{1..3}; do
  echo "Broker: $broker"
  ssh $broker "df -h /var/lib/kafka"
done

# Validate critical topics
echo "Validating critical topics..."
critical_topics=("agent.tasks.manager" "agent.tasks.worker" "session.events" "monitoring.events")
for topic in "${critical_topics[@]}"; do
  kafka-topics --bootstrap-server kafka-broker-1:9092 --describe --topic $topic
done

# Performance metrics snapshot
echo "Performance metrics snapshot..."
kafka-consumer-groups --bootstrap-server kafka-broker-1:9092 --all-groups --describe | \
  awk 'NR>1 && $5 != "-" {total_lag += $5} END {print "Total Consumer Lag:", total_lag}'

echo "=== Health Check Complete ==="
```

**Success Criteria:**
- All brokers responding within 5 seconds
- Under-replicated partitions = 0
- Consumer lag < 10,000 messages per group
- Disk usage < 80% on all brokers
- All critical topics available with correct replication factor

**Escalation:** If any criteria fail, follow [Incident Response](#incident-response-procedures)

#### 2. Performance Monitoring Review
**Frequency:** Daily at 09:00 UTC  
**Duration:** 10 minutes  
**Owner:** Operations Team

```bash
#!/bin/bash
# performance-monitoring-review.sh

echo "=== Performance Review - $(date) ==="

# Check throughput metrics (last 24 hours)
echo "Throughput analysis..."
prometheus_query='rate(kafka_server_brokertopicmetrics_messagesinpersec_total[24h])'
curl -s "http://prometheus:9090/api/v1/query?query=${prometheus_query}" | jq '.data.result[].value[1]'

# Check latency metrics
echo "Latency analysis (P95, P99)..."
grafana_api_call="curl -s -H 'Authorization: Bearer ${GRAFANA_TOKEN}' \
  'http://grafana:3000/api/datasources/proxy/1/api/v1/query_range?query=histogram_quantile(0.95,kafka_consumer_lag_sum)&start=$(date -d '24 hours ago' +%s)&end=$(date +%s)&step=3600'"
eval $grafana_api_call

# Check error rates
echo "Error rate analysis..."
kafka_error_rate="rate(kafka_server_brokertopicmetrics_failedfetchrequestspersec_total[24h])"
curl -s "http://prometheus:9090/api/v1/query?query=${kafka_error_rate}" | jq '.data.result[].value[1]'

# Resource utilization
echo "Resource utilization..."
for broker in kafka-broker-{1..3}; do
  echo "Broker: $broker"
  ssh $broker "top -bn1 | grep kafka | head -1"
  ssh $broker "free -h | grep Mem"
done

echo "=== Performance Review Complete ==="
```

**Performance Thresholds:**
- Throughput: > 50,000 messages/second aggregate
- P95 Latency: < 50ms
- P99 Latency: < 200ms
- Error Rate: < 0.1%
- CPU Utilization: < 70%
- Memory Usage: < 80%

#### 3. Security Status Review
**Frequency:** Daily at 10:00 UTC  
**Duration:** 20 minutes  
**Owner:** Security Operations

```bash
#!/bin/bash
# security-status-review.sh

echo "=== Security Status Review - $(date) ==="

# Check authentication failures
echo "Authentication failure analysis..."
grep "authentication" /var/log/kafka/server.log | grep $(date +%Y-%m-%d) | grep -i "failed\|error" | wc -l

# Check ACL violations
echo "ACL violation analysis..."
grep "DENIED" /var/log/kafka/server.log | grep $(date +%Y-%m-%d) | wc -l

# Certificate expiration check
echo "Certificate expiration check..."
for cert in /etc/kafka/ssl/*.pem; do
  echo "Certificate: $cert"
  openssl x509 -in "$cert" -noout -dates
done

# Unusual access patterns
echo "Unusual access pattern detection..."
python3 /opt/kafka-security/detect-anomalies.py --timerange 24h --threshold 2.5

# Failed connection attempts
echo "Failed connection analysis..."
netstat -an | grep :9093 | grep TIME_WAIT | wc -l

# Security configuration validation
echo "Security configuration validation..."
kafka-configs --bootstrap-server localhost:9093 --describe --entity-type brokers --entity-default | \
  grep -E "ssl\.|sasl\.|security\." | sort

echo "=== Security Review Complete ==="
```

### Capacity Management Procedures

#### 1. Storage Capacity Monitoring
**Frequency:** Daily at 14:00 UTC  
**Duration:** 15 minutes  
**Owner:** Operations Team

```typescript
interface CapacityMetrics {
  brokerId: string;
  diskUsage: {
    total: number;
    used: number;
    available: number;
    percentUsed: number;
  };
  partitionCount: number;
  logSize: number;
  retentionPolicy: {
    retention: string;
    segmentSize: string;
  };
  projectedFull: Date | null;
}

class CapacityMonitor {
  async checkStorageCapacity(): Promise<CapacityMetrics[]> {
    const brokers = ['kafka-broker-1', 'kafka-broker-2', 'kafka-broker-3'];
    const metrics: CapacityMetrics[] = [];

    for (const broker of brokers) {
      const diskStats = await this.getDiskStats(broker);
      const partitionStats = await this.getPartitionStats(broker);
      const retentionPolicies = await this.getRetentionPolicies(broker);

      const metric: CapacityMetrics = {
        brokerId: broker,
        diskUsage: diskStats,
        partitionCount: partitionStats.count,
        logSize: partitionStats.totalLogSize,
        retentionPolicy: retentionPolicies,
        projectedFull: this.calculateProjectedFull(diskStats)
      };

      metrics.push(metric);

      // Alert if capacity exceeds thresholds
      if (diskStats.percentUsed > 80) {
        await this.sendCapacityAlert(metric, 'WARNING');
      }
      if (diskStats.percentUsed > 90) {
        await this.sendCapacityAlert(metric, 'CRITICAL');
      }
    }

    return metrics;
  }

  private calculateProjectedFull(diskStats: any): Date | null {
    // Calculate based on growth trend over last 7 days
    const growthRate = this.calculateGrowthRate(diskStats);
    if (growthRate <= 0) return null;

    const remainingSpace = diskStats.total - diskStats.used;
    const daysToFull = remainingSpace / growthRate;
    
    if (daysToFull > 365) return null; // More than a year
    
    return new Date(Date.now() + (daysToFull * 24 * 60 * 60 * 1000));
  }

  async performCapacityActions(): Promise<void> {
    // Check if log compaction is needed
    await this.checkLogCompaction();
    
    // Evaluate partition rebalancing
    await this.evaluatePartitionRebalancing();
    
    // Review retention policies
    await this.reviewRetentionPolicies();
    
    // Check for cleanup opportunities
    await this.identifyCleanupOpportunities();
  }
}
```

**Capacity Thresholds:**
- Warning: > 80% disk usage
- Critical: > 90% disk usage
- Partition limit: < 1,000 partitions per broker
- Log segment size: < 1GB per segment

#### 2. Partition Rebalancing
**Frequency:** Weekly on Sundays at 02:00 UTC  
**Duration:** 2-4 hours  
**Owner:** Operations Team

```bash
#!/bin/bash
# partition-rebalancing.sh

echo "=== Partition Rebalancing - $(date) ==="

# Generate rebalancing plan
echo "Generating rebalancing plan..."
kafka-reassign-partitions --bootstrap-server kafka-broker-1:9092 --generate \
  --topics-to-move-json-file /opt/kafka/config/topics-to-rebalance.json \
  --broker-list "1,2,3" > /tmp/rebalance-plan.json

# Validate rebalancing plan
echo "Validating rebalancing plan..."
kafka-reassign-partitions --bootstrap-server kafka-broker-1:9092 --verify \
  --reassignment-json-file /tmp/rebalance-plan.json

# Execute rebalancing (during maintenance window)
read -p "Execute rebalancing plan? (y/N): " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Executing rebalancing..."
  kafka-reassign-partitions --bootstrap-server kafka-broker-1:9092 --execute \
    --reassignment-json-file /tmp/rebalance-plan.json
  
  # Monitor rebalancing progress
  while true; do
    status=$(kafka-reassign-partitions --bootstrap-server kafka-broker-1:9092 --verify \
      --reassignment-json-file /tmp/rebalance-plan.json | grep "in progress" | wc -l)
    
    if [ $status -eq 0 ]; then
      echo "Rebalancing completed successfully"
      break
    fi
    
    echo "Rebalancing in progress... $(date)"
    sleep 30
  done
fi

echo "=== Partition Rebalancing Complete ==="
```

### Performance Monitoring Procedures

#### 1. Real-time Performance Dashboard
**Access:** http://grafana:3000/dashboards/kafka-operations  
**Monitoring Frequency:** Continuous  
**Review Frequency:** Every 2 hours during business hours

**Key Metrics Dashboard:**

```yaml
dashboard_panels:
  throughput_metrics:
    - panel: "Messages/Second by Topic"
      query: "rate(kafka_server_brokertopicmetrics_messagesinpersec_total[5m])"
      alert_threshold: "< 1000"
    
    - panel: "Bytes/Second by Topic"
      query: "rate(kafka_server_brokertopicmetrics_bytesinpersec_total[5m])"
      alert_threshold: "< 10MB"

  latency_metrics:
    - panel: "Producer Request Latency (P95)"
      query: "histogram_quantile(0.95, kafka_network_requestmetrics_requestqueue_time_ms)"
      alert_threshold: "> 50ms"
    
    - panel: "Consumer Lag by Group"
      query: "kafka_consumer_lag_sum"
      alert_threshold: "> 10000"

  availability_metrics:
    - panel: "Broker Uptime"
      query: "up{job='kafka-broker'}"
      alert_threshold: "< 1"
    
    - panel: "Under-replicated Partitions"
      query: "kafka_server_replicamanager_underreplicatedpartitions"
      alert_threshold: "> 0"

  resource_metrics:
    - panel: "CPU Usage by Broker"
      query: "100 - (avg by(instance) (irate(node_cpu_seconds_total{mode='idle'}[5m])) * 100)"
      alert_threshold: "> 70%"
    
    - panel: "Memory Usage by Broker"
      query: "(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100"
      alert_threshold: "> 80%"
    
    - panel: "Disk Usage by Broker"
      query: "100 - ((node_filesystem_avail_bytes{mountpoint='/var/lib/kafka'} * 100) / node_filesystem_size_bytes{mountpoint='/var/lib/kafka'})"
      alert_threshold: "> 80%"
```

## Incident Response Procedures

### Severity Classification

| Severity | Response Time | Examples | Escalation |
|----------|---------------|----------|------------|
| **P0 - Critical** | Immediate (< 5 min) | Complete cluster outage, data corruption | CTO, Engineering Directors |
| **P1 - High** | < 15 minutes | Broker failure, high consumer lag | Engineering Manager, Senior Engineers |
| **P2 - Medium** | < 1 hour | Performance degradation, configuration issues | On-call Engineer |
| **P3 - Low** | < 4 hours | Minor alerts, maintenance tasks | Operations Team |

### P0 - Critical Incidents

#### Complete Cluster Outage Response

**Immediate Actions (0-5 minutes):**

```bash
#!/bin/bash
# cluster-outage-response.sh

echo "=== CRITICAL: Cluster Outage Response - $(date) ==="

# Step 1: Assess scope of outage
echo "Assessing outage scope..."
for broker in kafka-broker-{1..3}; do
  echo "Checking broker: $broker"
  if ! ping -c 1 $broker &> /dev/null; then
    echo "OFFLINE: $broker"
  else
    echo "ONLINE: $broker"
    # Check if Kafka process is running
    ssh $broker "pgrep -f kafka.Kafka" && echo "Kafka process running" || echo "Kafka process NOT running"
  fi
done

# Step 2: Check ZooKeeper status
echo "Checking ZooKeeper ensemble..."
for zk in zk-{1..3}; do
  echo "stat" | nc $zk 2181 && echo "$zk: OK" || echo "$zk: FAILED"
done

# Step 3: Check network connectivity
echo "Checking network connectivity..."
for broker in kafka-broker-{1..3}; do
  telnet $broker 9092 < /dev/null && echo "$broker:9092 reachable" || echo "$broker:9092 UNREACHABLE"
done

# Step 4: Immediate notifications
echo "Sending critical alerts..."
curl -X POST "https://api.pagerduty.com/incidents" \
  -H "Authorization: Token token=YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "incident": {
      "type": "incident",
      "title": "Kafka Cluster Complete Outage",
      "service": {
        "id": "KAFKA_SERVICE_ID",
        "type": "service_reference"
      },
      "urgency": "high",
      "incident_key": "kafka-outage-'$(date +%s)'"
    }
  }'

echo "=== Initial Assessment Complete - Escalating ==="
```

**Recovery Actions (5-30 minutes):**

```typescript
class ClusterRecoveryManager {
  async executeOutageRecovery(): Promise<RecoveryStatus> {
    const recovery: RecoveryStatus = {
      phase: 'ASSESSMENT',
      startTime: new Date(),
      expectedDuration: '30-60 minutes',
      currentStep: 'Analyzing failure',
      progress: 0
    };

    try {
      // Phase 1: Root cause analysis
      recovery.currentStep = 'Root cause analysis';
      const rootCause = await this.analyzeRootCause();
      recovery.progress = 20;

      // Phase 2: Recovery strategy selection
      recovery.currentStep = 'Selecting recovery strategy';
      const strategy = this.selectRecoveryStrategy(rootCause);
      recovery.progress = 30;

      // Phase 3: Execute recovery based on strategy
      recovery.currentStep = 'Executing recovery';
      switch (strategy.type) {
        case 'RESTART_SERVICES':
          await this.restartKafkaServices();
          break;
        case 'RESTORE_FROM_BACKUP':
          await this.restoreFromBackup();
          break;
        case 'REBUILD_CLUSTER':
          await this.rebuildCluster();
          break;
      }
      recovery.progress = 70;

      // Phase 4: Validate recovery
      recovery.currentStep = 'Validating recovery';
      const validation = await this.validateClusterHealth();
      if (!validation.healthy) {
        throw new Error(`Validation failed: ${validation.issues.join(', ')}`);
      }
      recovery.progress = 90;

      // Phase 5: Post-recovery steps
      recovery.currentStep = 'Post-recovery validation';
      await this.performPostRecoveryValidation();
      recovery.progress = 100;
      recovery.phase = 'COMPLETED';

    } catch (error) {
      recovery.phase = 'FAILED';
      recovery.error = error.message;
      await this.escalateRecoveryFailure(error);
    }

    return recovery;
  }

  private async restartKafkaServices(): Promise<void> {
    const brokers = ['kafka-broker-1', 'kafka-broker-2', 'kafka-broker-3'];
    
    // Start brokers sequentially to maintain quorum
    for (const broker of brokers) {
      await this.sshExecute(broker, 'systemctl start kafka');
      
      // Wait for broker to be ready
      let attempts = 0;
      while (attempts < 30) {
        try {
          await this.checkBrokerHealth(broker);
          break;
        } catch {
          await this.sleep(10000); // 10 seconds
          attempts++;
        }
      }
      
      if (attempts >= 30) {
        throw new Error(`Failed to start broker: ${broker}`);
      }
    }
  }

  private async validateClusterHealth(): Promise<ClusterHealthStatus> {
    const checks = [
      this.checkBrokerConnectivity(),
      this.checkZooKeeperConnectivity(),
      this.checkTopicAvailability(),
      this.checkReplicationStatus(),
      this.checkConsumerGroups()
    ];

    const results = await Promise.allSettled(checks);
    const issues = results
      .filter(result => result.status === 'rejected')
      .map(result => (result as PromiseRejectedResult).reason);

    return {
      healthy: issues.length === 0,
      issues: issues
    };
  }
}
```

### P1 - High Priority Incidents

#### High Consumer Lag Response

**Detection:** Consumer lag > 50,000 messages  
**Response Time:** < 15 minutes

```bash
#!/bin/bash
# high-consumer-lag-response.sh

LAG_THRESHOLD=50000
CONSUMER_GROUP=$1

echo "=== High Consumer Lag Response - Group: $CONSUMER_GROUP ==="

# Check current lag
echo "Current lag status..."
current_lag=$(kafka-consumer-groups --bootstrap-server kafka-broker-1:9092 \
  --group $CONSUMER_GROUP --describe | awk 'NR>1 {sum+=$5} END {print sum}')

if [ $current_lag -gt $LAG_THRESHOLD ]; then
  echo "ALERT: Consumer lag is $current_lag messages"
  
  # Immediate actions
  echo "Taking immediate actions..."
  
  # 1. Scale consumer instances
  echo "Scaling consumer instances..."
  docker-compose up -d --scale kafka-consumer=5
  
  # 2. Check producer rate
  echo "Checking producer rate..."
  producer_rate=$(kafka-console-consumer --bootstrap-server kafka-broker-1:9092 \
    --topic __metrics --timeout-ms 5000 | grep producer.messages.rate | tail -1)
  echo "Producer rate: $producer_rate"
  
  # 3. Analyze partition distribution
  echo "Analyzing partition distribution..."
  kafka-consumer-groups --bootstrap-server kafka-broker-1:9092 \
    --group $CONSUMER_GROUP --describe | \
    awk 'NR>1 {print $3, $5}' | sort -k2 -nr | head -10
  
  # 4. Check for consumer errors
  echo "Checking consumer error logs..."
  docker logs kafka-consumer | grep ERROR | tail -20
  
  # 5. Temporary partition reassignment if needed
  echo "Checking if partition reassignment is needed..."
  partitions_per_consumer=$(kafka-consumer-groups --bootstrap-server kafka-broker-1:9092 \
    --group $CONSUMER_GROUP --describe | awk 'NR>1' | wc -l)
  
  if [ $partitions_per_consumer -gt 10 ]; then
    echo "Consider partition reassignment - too many partitions per consumer"
  fi
  
else
  echo "Consumer lag is within normal range: $current_lag messages"
fi

echo "=== High Consumer Lag Response Complete ==="
```

#### Broker Failure Response

**Detection:** Broker unreachable or not responding  
**Response Time:** < 15 minutes

```typescript
class BrokerFailureManager {
  async handleBrokerFailure(brokerId: string): Promise<void> {
    const failureResponse = {
      brokerId,
      detectionTime: new Date(),
      actions: []
    };

    try {
      // Step 1: Confirm broker failure
      const isDown = await this.confirmBrokerFailure(brokerId);
      if (!isDown) {
        failureResponse.actions.push('False alarm - broker is healthy');
        return;
      }

      // Step 2: Check cluster quorum
      const quorumStatus = await this.checkClusterQuorum();
      if (!quorumStatus.hasQuorum) {
        await this.escalateQuorumLoss();
        return;
      }

      // Step 3: Assess impact
      const impact = await this.assessBrokerFailureImpact(brokerId);
      failureResponse.actions.push(`Impact assessment: ${impact.severity}`);

      // Step 4: Immediate mitigation
      if (impact.hasUnderReplicatedPartitions) {
        await this.handleUnderReplicatedPartitions(brokerId);
        failureResponse.actions.push('Handled under-replicated partitions');
      }

      // Step 5: Attempt broker recovery
      const recoveryAttempt = await this.attemptBrokerRecovery(brokerId);
      failureResponse.actions.push(`Recovery attempt: ${recoveryAttempt.status}`);

      if (recoveryAttempt.success) {
        // Validate recovery
        await this.validateBrokerRecovery(brokerId);
        failureResponse.actions.push('Broker recovery validated');
      } else {
        // Initiate broker replacement
        await this.initiateBrokerReplacement(brokerId);
        failureResponse.actions.push('Initiated broker replacement procedure');
      }

      // Step 6: Monitor cluster stabilization
      await this.monitorClusterStabilization();
      failureResponse.actions.push('Cluster stabilization monitored');

    } catch (error) {
      failureResponse.actions.push(`Error during recovery: ${error.message}`);
      await this.escalateBrokerFailure(brokerId, error);
    }

    // Log the response
    await this.logBrokerFailureResponse(failureResponse);
  }

  private async assessBrokerFailureImpact(brokerId: string): Promise<FailureImpact> {
    // Check which partitions were on the failed broker
    const affectedPartitions = await this.getPartitionsOnBroker(brokerId);
    
    // Check replication status
    const underReplicated = affectedPartitions.filter(p => 
      p.replicas.length < p.targetReplicationFactor
    );

    // Check if any partitions lost all replicas
    const noReplicas = affectedPartitions.filter(p => 
      p.availableReplicas.length === 0
    );

    return {
      affectedPartitions: affectedPartitions.length,
      hasUnderReplicatedPartitions: underReplicated.length > 0,
      hasUnavailablePartitions: noReplicas.length > 0,
      severity: noReplicas.length > 0 ? 'CRITICAL' : 
               underReplicated.length > 0 ? 'HIGH' : 'MEDIUM'
    };
  }

  private async attemptBrokerRecovery(brokerId: string): Promise<RecoveryResult> {
    const brokerHost = this.getBrokerHost(brokerId);
    const recoverySteps = [
      () => this.restartKafkaService(brokerHost),
      () => this.checkConfigurationFile(brokerHost),
      () => this.validateNetworkConnectivity(brokerHost),
      () => this.checkDiskSpace(brokerHost),
      () => this.validateZooKeeperConnectivity(brokerHost)
    ];

    for (const step of recoverySteps) {
      try {
        await step();
      } catch (error) {
        return {
          success: false,
          failedStep: step.name,
          error: error.message
        };
      }
    }

    // Verify broker is back in cluster
    const isHealthy = await this.checkBrokerHealth(brokerId);
    return {
      success: isHealthy,
      failedStep: isHealthy ? null : 'health_check',
      error: isHealthy ? null : 'Broker failed health check after recovery'
    };
  }
}
```

## Backup and Disaster Recovery Procedures

### Daily Backup Operations

#### 1. Configuration Backup
**Frequency:** Daily at 23:00 UTC  
**Retention:** 30 days

```bash
#!/bin/bash
# kafka-config-backup.sh

BACKUP_DATE=$(date +%Y%m%d)
BACKUP_DIR="/backup/kafka-config/$BACKUP_DATE"

mkdir -p "$BACKUP_DIR"

echo "=== Kafka Configuration Backup - $BACKUP_DATE ==="

# Backup broker configurations
echo "Backing up broker configurations..."
for broker in kafka-broker-{1..3}; do
  broker_dir="$BACKUP_DIR/$broker"
  mkdir -p "$broker_dir"
  
  # Server properties
  scp $broker:/etc/kafka/server.properties "$broker_dir/"
  
  # JVM settings
  scp $broker:/etc/kafka/kafka-server-start.sh "$broker_dir/"
  
  # Log4j configuration
  scp $broker:/etc/kafka/log4j.properties "$broker_dir/"
  
  # SSL certificates (metadata only)
  ssh $broker "find /etc/kafka/ssl -name '*.pem' -exec ls -la {} \;" > "$broker_dir/ssl-certificates.list"
done

# Backup topic configurations
echo "Backing up topic configurations..."
kafka-configs --bootstrap-server kafka-broker-1:9092 --describe --entity-type topics > "$BACKUP_DIR/topic-configs.txt"

# Backup ACL configurations
echo "Backing up ACL configurations..."
kafka-acls --bootstrap-server kafka-broker-1:9092 --list > "$BACKUP_DIR/acl-configs.txt"

# Backup consumer group offsets
echo "Backing up consumer group offsets..."
kafka-consumer-groups --bootstrap-server kafka-broker-1:9092 --all-groups --describe > "$BACKUP_DIR/consumer-group-offsets.txt"

# Create backup manifest
echo "Creating backup manifest..."
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "backup_date": "$BACKUP_DATE",
  "backup_type": "configuration",
  "components": [
    "broker_configurations",
    "topic_configurations", 
    "acl_configurations",
    "consumer_group_offsets"
  ],
  "retention_days": 30,
  "created_by": "$(whoami)",
  "created_at": "$(date -Iseconds)"
}
EOF

# Cleanup old backups
echo "Cleaning up old backups..."
find /backup/kafka-config -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;

echo "=== Configuration Backup Complete ==="
```

#### 2. Data Backup Strategy
**Frequency:** Continuous (via Kafka replication) + Weekly snapshots  
**RPO:** 15 minutes  
**RTO:** 2 hours

```yaml
backup_strategy:
  replication_based:
    description: "Primary backup through multi-region replication"
    configuration:
      - primary_cluster: "kafka-prod-us-east"
        replica_cluster: "kafka-prod-us-west"
        replication_factor: 3
        min_insync_replicas: 2
      
      - topics:
          - pattern: "agent.tasks.*"
            backup_enabled: true
            retention: "7 days"
          - pattern: "session.events"
            backup_enabled: true
            retention: "30 days"
          - pattern: "monitoring.events"
            backup_enabled: true
            retention: "90 days"

  snapshot_based:
    description: "Weekly data snapshots for long-term retention"
    frequency: "weekly"
    retention: "1 year"
    procedure: |
      # Create topic snapshots
      for topic in agent.tasks.manager agent.tasks.worker session.events; do
        kafka-console-consumer --bootstrap-server kafka-broker-1:9092 \
          --topic $topic --from-beginning --timeout-ms 300000 \
          --property print.key=true \
          --property key.separator=: > /backup/snapshots/weekly/$(date +%Y%m%d)/$topic.backup
      done
```

### Disaster Recovery Procedures

#### Complete Cluster Recovery

**Scenario:** Complete data center failure  
**RTO:** 4 hours  
**RPO:** 15 minutes

```typescript
class DisasterRecoveryManager {
  async executeDisasterRecovery(): Promise<RecoveryProgress> {
    const recovery: RecoveryProgress = {
      phase: 'INITIALIZATION',
      startTime: new Date(),
      estimatedCompletion: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      steps: []
    };

    try {
      // Phase 1: Infrastructure Provisioning (30 minutes)
      recovery.phase = 'INFRASTRUCTURE_PROVISIONING';
      recovery.steps.push({ name: 'Provision new cluster infrastructure', status: 'IN_PROGRESS' });
      
      await this.provisionInfrastructure();
      recovery.steps[recovery.steps.length - 1].status = 'COMPLETED';

      // Phase 2: Kafka Cluster Setup (45 minutes)
      recovery.phase = 'CLUSTER_SETUP';
      recovery.steps.push({ name: 'Install and configure Kafka cluster', status: 'IN_PROGRESS' });
      
      await this.setupKafkaCluster();
      recovery.steps[recovery.steps.length - 1].status = 'COMPLETED';

      // Phase 3: Data Recovery (2 hours)
      recovery.phase = 'DATA_RECOVERY';
      recovery.steps.push({ name: 'Restore data from backups', status: 'IN_PROGRESS' });
      
      await this.restoreData();
      recovery.steps[recovery.steps.length - 1].status = 'COMPLETED';

      // Phase 4: Configuration Restoration (30 minutes)
      recovery.phase = 'CONFIGURATION_RESTORATION';
      recovery.steps.push({ name: 'Restore configurations and ACLs', status: 'IN_PROGRESS' });
      
      await this.restoreConfigurations();
      recovery.steps[recovery.steps.length - 1].status = 'COMPLETED';

      // Phase 5: Validation and Testing (45 minutes)
      recovery.phase = 'VALIDATION';
      recovery.steps.push({ name: 'Validate cluster and perform tests', status: 'IN_PROGRESS' });
      
      await this.validateRecovery();
      recovery.steps[recovery.steps.length - 1].status = 'COMPLETED';

      // Phase 6: Service Restoration (30 minutes)
      recovery.phase = 'SERVICE_RESTORATION';
      recovery.steps.push({ name: 'Restore application services', status: 'IN_PROGRESS' });
      
      await this.restoreServices();
      recovery.steps[recovery.steps.length - 1].status = 'COMPLETED';

      recovery.phase = 'COMPLETED';

    } catch (error) {
      recovery.phase = 'FAILED';
      recovery.error = error.message;
      await this.escalateRecoveryFailure();
    }

    return recovery;
  }

  private async restoreData(): Promise<void> {
    // Restore from replica cluster if available
    if (await this.isReplicaClusterAvailable()) {
      await this.promoteReplicaCluster();
    } else {
      // Restore from snapshots
      await this.restoreFromSnapshots();
    }

    // Verify data integrity
    await this.verifyDataIntegrity();
  }

  private async validateRecovery(): Promise<void> {
    const validationChecks = [
      this.validateBrokerConnectivity(),
      this.validateTopicAvailability(),
      this.validateConsumerGroups(),
      this.validateACLs(),
      this.performEndToEndTest()
    ];

    const results = await Promise.allSettled(validationChecks);
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length > 0) {
      throw new Error(`Validation failed: ${failures.length} checks failed`);
    }
  }
}
```

## Troubleshooting Common Issues

### Performance Issues

#### High Latency Diagnosis

```bash
#!/bin/bash
# diagnose-high-latency.sh

echo "=== High Latency Diagnosis ==="

# Check producer request latency
echo "Producer request latency:"
kafka-console-consumer --bootstrap-server kafka-broker-1:9092 \
  --topic __metrics --timeout-ms 10000 | \
  grep "kafka.network.RequestMetrics" | \
  grep "request-time" | tail -5

# Check consumer lag
echo "Consumer lag analysis:"
kafka-consumer-groups --bootstrap-server kafka-broker-1:9092 \
  --all-groups --describe | \
  awk 'NR>1 && $5 != "-" {print $1, $3, $5}' | \
  sort -k3 -nr | head -10

# Check disk I/O
echo "Disk I/O analysis:"
for broker in kafka-broker-{1..3}; do
  echo "Broker: $broker"
  ssh $broker "iostat -x 1 3 | grep -E 'Device|sda|nvme'"
done

# Check network utilization
echo "Network utilization:"
for broker in kafka-broker-{1..3}; do
  echo "Broker: $broker"
  ssh $broker "iftop -t -s 10" 2>/dev/null | head -10
done

# Check JVM garbage collection
echo "JVM GC analysis:"
for broker in kafka-broker-{1..3}; do
  echo "Broker: $broker"
  ssh $broker "jstat -gc \$(pgrep -f kafka.Kafka) | tail -1"
done

echo "=== Diagnosis Complete ==="
```

#### Memory Issues Diagnosis

```typescript
class MemoryDiagnostics {
  async diagnoseMemoryIssues(): Promise<MemoryDiagnosisResult> {
    const diagnosis: MemoryDiagnosisResult = {
      brokers: [],
      recommendations: []
    };

    const brokers = ['kafka-broker-1', 'kafka-broker-2', 'kafka-broker-3'];

    for (const broker of brokers) {
      const memoryStats = await this.getBrokerMemoryStats(broker);
      const jvmStats = await this.getJVMStats(broker);
      
      const brokerDiagnosis: BrokerMemoryDiagnosis = {
        brokerId: broker,
        totalMemory: memoryStats.total,
        usedMemory: memoryStats.used,
        freeMemory: memoryStats.free,
        jvmHeapUsed: jvmStats.heapUsed,
        jvmHeapMax: jvmStats.heapMax,
        gcFrequency: jvmStats.gcFrequency,
        pageCache: memoryStats.pageCache,
        issues: []
      };

      // Analyze memory issues
      if (memoryStats.used / memoryStats.total > 0.9) {
        brokerDiagnosis.issues.push({
          type: 'HIGH_MEMORY_USAGE',
          severity: 'HIGH',
          description: 'Memory usage above 90%'
        });
      }

      if (jvmStats.heapUsed / jvmStats.heapMax > 0.85) {
        brokerDiagnosis.issues.push({
          type: 'HIGH_HEAP_USAGE',
          severity: 'MEDIUM',
          description: 'JVM heap usage above 85%'
        });
      }

      if (jvmStats.gcFrequency > 10) {
        brokerDiagnosis.issues.push({
          type: 'FREQUENT_GC',
          severity: 'MEDIUM',
          description: 'Frequent garbage collection detected'
        });
      }

      diagnosis.brokers.push(brokerDiagnosis);
    }

    // Generate recommendations
    diagnosis.recommendations = this.generateMemoryRecommendations(diagnosis.brokers);

    return diagnosis;
  }

  private generateMemoryRecommendations(brokers: BrokerMemoryDiagnosis[]): string[] {
    const recommendations: string[] = [];

    brokers.forEach(broker => {
      broker.issues.forEach(issue => {
        switch (issue.type) {
          case 'HIGH_MEMORY_USAGE':
            recommendations.push(`${broker.brokerId}: Consider increasing system memory or reducing JVM heap size`);
            break;
          case 'HIGH_HEAP_USAGE':
            recommendations.push(`${broker.brokerId}: Increase JVM heap size or optimize application memory usage`);
            break;
          case 'FREQUENT_GC':
            recommendations.push(`${broker.brokerId}: Tune GC settings or reduce heap pressure`);
            break;
        }
      });
    });

    return recommendations;
  }
}
```

## Alerting and Monitoring Rules

### Critical Alerts

```yaml
alert_rules:
  - alert: KafkaClusterDown
    expr: up{job="kafka"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Kafka cluster is down"
      description: "Kafka cluster has been down for more than 1 minute"

  - alert: KafkaHighConsumerLag
    expr: kafka_consumer_lag_sum > 50000
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High consumer lag detected"
      description: "Consumer lag is {{ $value }} messages"

  - alert: KafkaDiskUsageHigh
    expr: (node_filesystem_size_bytes{mountpoint="/var/lib/kafka"} - node_filesystem_free_bytes{mountpoint="/var/lib/kafka"}) / node_filesystem_size_bytes{mountpoint="/var/lib/kafka"} > 0.8
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "High disk usage on Kafka broker"
      description: "Disk usage is above 80% on {{ $labels.instance }}"

  - alert: KafkaUnderReplicatedPartitions
    expr: kafka_server_replicamanager_underreplicatedpartitions > 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Under-replicated partitions detected"
      description: "{{ $value }} partitions are under-replicated"

  - alert: KafkaOfflinePartitions
    expr: kafka_controller_kafkacontroller_offlinepartitionscount > 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Offline partitions detected"
      description: "{{ $value }} partitions are offline"
```

## Team Communication Procedures

### Incident Communication Flow

```mermaid
graph TD
    A[Alert Triggered] --> B[On-call Engineer Notified]
    B --> C{P0/P1 Incident?}
    C -->|Yes| D[Page Engineering Manager]
    C -->|No| E[Handle with Team]
    D --> F[Create War Room]
    F --> G[Notify Stakeholders]
    G --> H[Regular Updates Every 30min]
    E --> I[Update in Slack Channel]
    H --> J[Incident Resolution]
    I --> J
    J --> K[Post-Incident Review]
```

### Communication Channels

- **Critical Incidents (P0/P1):** Phone + PagerDuty + Slack #kafka-incidents
- **Standard Issues (P2/P3):** Slack #kafka-ops
- **Maintenance:** Slack #kafka-maintenance + Email notifications
- **Status Updates:** Slack #kafka-status

This comprehensive operations runbook provides the foundation for successful daily operations and incident response for the Kafka migration project, ensuring smooth execution during Sprint 1 and beyond.