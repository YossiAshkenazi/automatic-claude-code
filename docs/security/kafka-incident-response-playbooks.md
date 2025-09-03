# Kafka Security Incident Response Playbooks

## Overview

This document provides comprehensive incident response playbooks specifically designed for Apache Kafka security incidents within the dual-agent system. Each playbook includes detailed step-by-step procedures, escalation criteria, and recovery strategies.

## Incident Classification Framework

### Severity Levels

| Level | Description | Response Time | Escalation | Examples |
|-------|-------------|---------------|------------|----------|
| **P1 - Critical** | System compromised, data breach, service unavailable | Immediate | CISO, CEO | Data exfiltration, ransomware, complete service outage |
| **P2 - High** | Authentication bypass, privilege escalation | 30 minutes | Security Team Lead | Unauthorized admin access, ACL bypass |
| **P3 - Medium** | Policy violations, suspicious activities | 2 hours | Security Analyst | Failed login spikes, unusual access patterns |
| **P4 - Low** | Information gathering, minor policy violations | 24 hours | System Administrator | Port scans, configuration warnings |

### Incident Categories

```yaml
incident_categories:
  authentication:
    - brute_force_attacks
    - credential_compromise
    - certificate_validation_failures
    
  authorization:
    - acl_violations
    - privilege_escalation
    - unauthorized_topic_access
    
  data_security:
    - data_exfiltration
    - message_tampering
    - encryption_failures
    
  infrastructure:
    - service_disruption
    - resource_exhaustion
    - configuration_tampering
    
  compliance:
    - data_retention_violations
    - audit_trail_tampering
    - regulatory_breach
```

## P1 - Critical Incidents

### 1. Data Breach Response Playbook

#### Incident: Unauthorized Data Exfiltration

**Trigger Conditions:**
- Large volumes of sensitive data accessed by unauthorized user
- Data download from restricted topics detected
- Anomalous bulk consumption patterns
- External threat intelligence indicating data compromise

**Immediate Response (0-15 minutes):**

```yaml
immediate_actions:
  containment:
    - action: "Isolate affected Kafka brokers"
      command: "sudo iptables -I INPUT -p tcp --dport 9093 -j DROP"
      validation: "netstat -an | grep :9093"
    
    - action: "Revoke compromised client certificates"
      command: "kafka-configs --bootstrap-server localhost:9093 --alter --delete-config 'ssl.client.auth=required' --entity-type users --entity-name compromised-client"
      validation: "kafka-configs --bootstrap-server localhost:9093 --describe --entity-type users"
    
    - action: "Disable affected user accounts"
      command: "kafka-configs --bootstrap-server localhost:9093 --alter --delete-config 'SCRAM-SHA-512' --entity-type users --entity-name compromised-user"
      validation: "kafka-configs --bootstrap-server localhost:9093 --describe --entity-type users --entity-name compromised-user"
    
    - action: "Block source IP addresses"
      command: "sudo iptables -I INPUT -s <attacker-ip> -j DROP"
      validation: "sudo iptables -L INPUT -n"

  notification:
    - action: "Alert incident response team"
      method: "PagerDuty high priority alert"
      recipients: ["security-team", "incident-commander", "ciso"]
    
    - action: "Notify legal counsel"
      method: "Emergency contact procedure"
      timeline: "within 15 minutes"
    
    - action: "Prepare regulatory notification"
      method: "Draft breach notification template"
      timeline: "within 30 minutes"

  evidence_preservation:
    - action: "Capture network traffic"
      command: "tcpdump -i any -w /var/log/incident-$(date +%Y%m%d-%H%M%S).pcap host <attacker-ip>"
      duration: "continuous until contained"
    
    - action: "Preserve Kafka logs"
      command: "cp -r /var/log/kafka /var/incident-response/kafka-logs-$(date +%Y%m%d-%H%M%S)"
      retention: "minimum 1 year"
    
    - action: "Create memory dumps"
      command: "gcore $(pgrep -f kafka.Kafka)"
      storage: "/var/incident-response/memory-dumps/"
```

**Assessment Phase (15-60 minutes):**

```typescript
interface DataBreachAssessment {
  scope: {
    affectedTopics: string[];
    compromisedAccounts: string[];
    dataTypes: string[];
    recordCount: number;
    timeRange: { start: Date; end: Date };
  };
  impact: {
    personalDataInvolved: boolean;
    financialDataInvolved: boolean;
    healthDataInvolved: boolean;
    intellectualPropertyInvolved: boolean;
    estimatedAffectedIndividuals: number;
  };
  attackVector: {
    initialAccess: string;
    persistenceMechanism: string;
    exfiltrationMethod: string;
    toolsUsed: string[];
  };
  containmentStatus: {
    threatEliminated: boolean;
    systemsSecured: boolean;
    dataFlowStopped: boolean;
    evidencePreserved: boolean;
  };
}

class DataBreachAssessmentManager {
  async conductRapidAssessment(incidentId: string): Promise<DataBreachAssessment> {
    const assessment: DataBreachAssessment = {
      scope: await this.assessBreachScope(incidentId),
      impact: await this.assessDataImpact(incidentId),
      attackVector: await this.analyzeAttackVector(incidentId),
      containmentStatus: await this.verifyContainment(incidentId)
    };

    // Generate preliminary breach notification if required
    if (this.requiresRegulatoryNotification(assessment)) {
      await this.prepareBreach Notification(assessment);
    }

    return assessment;
  }

  private async assessBreachScope(incidentId: string): Promise<any> {
    // Query audit logs for access patterns
    const auditLogs = await this.queryAuditLogs({
      timeRange: this.getIncidentTimeRange(incidentId),
      eventTypes: ['DATA_ACCESS', 'BULK_READ', 'TOPIC_CONSUMPTION']
    });

    // Identify affected topics
    const affectedTopics = auditLogs
      .filter(log => log.messageCount > this.getBulkThreshold())
      .map(log => log.topic);

    // Count affected records
    const recordCount = await this.countAffectedRecords(affectedTopics);

    return {
      affectedTopics,
      compromisedAccounts: this.extractCompromisedAccounts(auditLogs),
      dataTypes: await this.classifyDataTypes(affectedTopics),
      recordCount,
      timeRange: this.getIncidentTimeRange(incidentId)
    };
  }
}
```

**Recovery Phase (1-24 hours):**

```yaml
recovery_procedures:
  system_hardening:
    - task: "Rotate all certificates"
      priority: "immediate"
      procedure: |
        # Generate new CA certificate
        openssl genrsa -out ca-private-key.pem 4096
        openssl req -new -x509 -key ca-private-key.pem -out ca-certificate.pem -days 365
        
        # Generate new server certificates
        for broker in broker1 broker2 broker3; do
          openssl genrsa -out ${broker}-private-key.pem 2048
          openssl req -new -key ${broker}-private-key.pem -out ${broker}.csr
          openssl x509 -req -in ${broker}.csr -CA ca-certificate.pem -CAkey ca-private-key.pem -out ${broker}-certificate.pem -days 365
        done
        
        # Update Kafka configuration
        kafka-configs --bootstrap-server localhost:9093 --alter --add-config 'ssl.truststore.location=/new/path/truststore.jks'
    
    - task: "Reset all SASL credentials"
      priority: "immediate"
      procedure: |
        # Delete existing SASL users
        for user in $(kafka-configs --bootstrap-server localhost:9093 --describe --entity-type users | grep "SCRAM-SHA-512" | cut -d' ' -f1); do
          kafka-configs --bootstrap-server localhost:9093 --alter --delete-config 'SCRAM-SHA-512' --entity-type users --entity-name $user
        done
        
        # Recreate users with new passwords
        kafka-configs --bootstrap-server localhost:9093 --alter --add-config 'SCRAM-SHA-512=[password=new-secure-password]' --entity-type users --entity-name dual-agent-manager
    
    - task: "Update ACL configurations"
      priority: "high"
      procedure: |
        # Remove all existing ACLs
        kafka-acls --bootstrap-server localhost:9093 --remove --allow-principal User:* --operation All --topic '*'
        
        # Implement least-privilege ACLs
        source ./scripts/configure-minimal-acls.sh

  data_verification:
    - task: "Verify data integrity"
      priority: "high"
      procedure: |
        # Check message integrity for affected topics
        for topic in $AFFECTED_TOPICS; do
          kafka-console-consumer --bootstrap-server localhost:9093 \
            --topic $topic --from-beginning \
            --property print.key=true \
            --property key.separator=: | \
            python3 scripts/verify-message-integrity.py
        done
    
    - task: "Restore from clean backup"
      priority: "medium"
      procedure: |
        # Stop Kafka services
        systemctl stop kafka
        
        # Restore from pre-incident backup
        rsync -av /backup/kafka-clean-$(date -d "1 day ago" +%Y%m%d)/ /var/lib/kafka/
        
        # Restart with new security configuration
        systemctl start kafka

  monitoring_enhancement:
    - task: "Deploy enhanced monitoring"
      priority: "high"
      procedure: |
        # Deploy additional security monitors
        docker run -d --name kafka-security-monitor \
          -v /var/log/kafka:/logs:ro \
          security-monitoring:latest \
          --config enhanced-monitoring.yml
        
        # Configure real-time alerts
        alertmanager-config --add-rule incident-response-enhanced.yml
```

### 2. Ransomware Attack Response Playbook

#### Incident: Kafka Infrastructure Targeted by Ransomware

**Trigger Conditions:**
- Encrypted files detected in Kafka directories
- Ransom note found on Kafka servers
- Kafka services unable to start due to encrypted logs
- File system showing signs of encryption activity

**Immediate Response (0-10 minutes):**

```yaml
immediate_containment:
  network_isolation:
    - action: "Disconnect affected brokers from network"
      command: "sudo ip link set eth0 down"
      validation: "ip link show eth0"
    
    - action: "Block all traffic to Kafka ports"
      command: "sudo iptables -I INPUT -p tcp --dport 9092 -j DROP && sudo iptables -I INPUT -p tcp --dport 9093 -j DROP"
      validation: "sudo iptables -L INPUT -n | grep 909"
    
    - action: "Isolate ZooKeeper ensemble"
      command: "sudo systemctl stop zookeeper && sudo ip route del default"
      validation: "sudo systemctl status zookeeper && ip route show"

  system_preservation:
    - action: "Stop all Kafka processes"
      command: "sudo pkill -f kafka.Kafka"
      validation: "ps aux | grep kafka"
    
    - action: "Mount filesystems read-only"
      command: "sudo mount -o remount,ro /var/lib/kafka"
      validation: "mount | grep kafka"
    
    - action: "Create disk images for forensics"
      command: "sudo dd if=/dev/sda of=/forensics/kafka-server-$(hostname)-$(date +%Y%m%d).img bs=1M"
      validation: "ls -la /forensics/"

  immediate_notifications:
    - action: "Activate cyber incident response"
      recipients: ["incident-commander", "ciso", "legal", "insurance"]
      method: "Emergency conference bridge"
      timeline: "within 5 minutes"
    
    - action: "Notify law enforcement"
      recipients: ["fbi-cyber-division", "local-cyber-crimes"]
      method: "Cyber incident reporting"
      timeline: "within 30 minutes"
```

**Assessment and Recovery (10 minutes - 72 hours):**

```typescript
class RansomwareRecoveryManager {
  async executeRecoveryPlan(incidentId: string): Promise<RecoveryStatus> {
    const recovery: RecoveryStatus = {
      phase: 'ASSESSMENT',
      progress: 0,
      estimatedCompletion: null,
      blockers: []
    };

    try {
      // Phase 1: Damage Assessment
      recovery.phase = 'DAMAGE_ASSESSMENT';
      const damageReport = await this.assessDamage();
      
      if (damageReport.severity === 'TOTAL_LOSS') {
        recovery = await this.executeCompleteRecovery();
      } else {
        recovery = await this.executePartialRecovery(damageReport);
      }

      // Phase 2: System Rebuilding
      recovery.phase = 'SYSTEM_REBUILD';
      await this.rebuildKafkaInfrastructure();
      
      // Phase 3: Data Recovery
      recovery.phase = 'DATA_RECOVERY';
      await this.restoreFromBackups();
      
      // Phase 4: Security Hardening
      recovery.phase = 'SECURITY_HARDENING';
      await this.implementEnhancedSecurity();
      
      // Phase 5: Validation
      recovery.phase = 'VALIDATION';
      await this.validateRecovery();
      
      recovery.phase = 'COMPLETED';
      recovery.progress = 100;

    } catch (error) {
      recovery.blockers.push(error.message);
      await this.escalateRecoveryIssue(error);
    }

    return recovery;
  }

  private async executeCompleteRecovery(): Promise<RecoveryStatus> {
    // Complete infrastructure rebuild from clean images
    const steps = [
      { name: 'Deploy new infrastructure', duration: 2 * 60 * 60 }, // 2 hours
      { name: 'Restore from backups', duration: 6 * 60 * 60 }, // 6 hours
      { name: 'Validate data integrity', duration: 2 * 60 * 60 }, // 2 hours
      { name: 'Security hardening', duration: 1 * 60 * 60 }, // 1 hour
      { name: 'Service validation', duration: 1 * 60 * 60 } // 1 hour
    ];

    return {
      phase: 'COMPLETE_REBUILD',
      progress: 0,
      estimatedCompletion: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
      steps: steps,
      blockers: []
    };
  }
}
```

### 3. Insider Threat Response Playbook

#### Incident: Malicious Insider Data Theft

**Trigger Conditions:**
- Employee accessing data beyond normal scope
- After-hours access to sensitive topics
- Large data downloads by privileged user
- User attempting to access restricted administrative functions

**Immediate Response (0-30 minutes):**

```yaml
insider_threat_response:
  account_controls:
    - action: "Suspend user account immediately"
      command: "kafka-configs --bootstrap-server localhost:9093 --alter --delete-config 'SCRAM-SHA-512' --entity-type users --entity-name suspicious-user"
      validation: "kafka-configs --bootstrap-server localhost:9093 --describe --entity-type users --entity-name suspicious-user"
    
    - action: "Terminate active sessions"
      command: "kafka-broker-api-versions --bootstrap-server localhost:9093 --command-config admin.properties | grep suspicious-user | awk '{print $1}' | xargs -I {} kafka-console-consumer --bootstrap-server localhost:9093 --topic __consumer_offsets --formatter kafka.coordinator.group.GroupMetadataManager\\$OffsetsMessageFormatter | grep {}"
      validation: "Active sessions terminated"
    
    - action: "Revoke API keys and certificates"
      command: |
        # Revoke certificates
        openssl ca -revoke /certificates/suspicious-user.pem -keyfile ca-private-key.pem -cert ca-certificate.pem
        
        # Update CRL
        openssl ca -gencrl -out /certificates/ca-certificate-crl.pem -keyfile ca-private-key.pem -cert ca-certificate.pem

  access_investigation:
    - action: "Audit all user access"
      procedure: |
        # Extract all access logs for user
        grep "suspicious-user" /var/log/kafka/server.log > /investigation/user-access-$(date +%Y%m%d).log
        
        # Analyze topic access patterns
        python3 scripts/analyze-user-access.py --user suspicious-user --days 30 --output /investigation/access-analysis.json
    
    - action: "Identify accessed data"
      procedure: |
        # List all topics accessed by user
        kafka-console-consumer --bootstrap-server localhost:9093 --topic audit-logs --from-beginning | grep suspicious-user | jq '.topic' | sort -u > /investigation/accessed-topics.txt
        
        # Estimate data volume
        for topic in $(cat /investigation/accessed-topics.txt); do
          kafka-log-dirs --bootstrap-server localhost:9093 --topic-list $topic --describe | grep size
        done

  evidence_collection:
    - action: "Preserve audit trails"
      procedure: |
        # Export complete audit trail
        kafka-console-consumer --bootstrap-server localhost:9093 --topic audit-logs --from-beginning --timeout-ms 30000 > /investigation/complete-audit-trail.json
        
        # Create hash of evidence
        sha256sum /investigation/* > /investigation/evidence-hashes.txt
    
    - action: "Collect HR and system access data"
      procedure: |
        # HR data collection (coordinate with HR)
        # - Employment status
        # - Recent performance reviews
        # - Access requests/changes
        # - Termination planning (if applicable)
        
        # System access audit
        # - All system accounts
        # - VPN access logs
        # - Badge access logs
        # - Other system access patterns

  legal_and_hr_coordination:
    - action: "Notify legal counsel"
      timeline: "within 15 minutes"
      considerations:
        - "Preserve privilege"
        - "Document chain of custody"
        - "Consider law enforcement notification"
    
    - action: "Coordinate with HR"
      timeline: "within 30 minutes"
      considerations:
        - "Employee rights"
        - "Employment actions"
        - "Communication restrictions"
```

## P2 - High Priority Incidents

### 4. Authentication Bypass Response Playbook

#### Incident: Unauthorized Access Despite Authentication Controls

**Trigger Conditions:**
- Authentication logged as successful for invalid credentials
- Access granted without proper certificate validation
- SASL authentication bypassed
- Service accounts used outside normal patterns

**Response Procedures:**

```yaml
auth_bypass_response:
  immediate_containment:
    - action: "Enable additional authentication logging"
      command: "kafka-configs --bootstrap-server localhost:9093 --alter --add-config 'log4j.logger.kafka.security=DEBUG' --entity-type brokers --entity-default"
      validation: "grep DEBUG /var/log/kafka/server.log"
    
    - action: "Implement additional authentication factors"
      command: |
        # Require client certificates for all connections
        echo "ssl.client.auth=required" >> /etc/kafka/server.properties
        
        # Enable IP-based restrictions
        echo "connections.max.idle.ms=30000" >> /etc/kafka/server.properties
      validation: "systemctl restart kafka && sleep 10 && systemctl status kafka"
    
    - action: "Force re-authentication for all clients"
      command: |
        # Restart Kafka to force client reconnection
        systemctl restart kafka
        
        # Monitor connection attempts
        tail -f /var/log/kafka/server.log | grep -i "connection\|authentication"

  investigation_procedures:
    - action: "Analyze authentication logs"
      procedure: |
        # Extract authentication events
        grep -i "authentication\|login\|sasl" /var/log/kafka/server.log | grep $(date +%Y-%m-%d) > /investigation/auth-events-$(date +%Y%m%d).log
        
        # Identify bypass attempts
        python3 scripts/detect-auth-bypass.py --logfile /investigation/auth-events-$(date +%Y%m%d).log --output /investigation/bypass-analysis.json
    
    - action: "Validate SSL/TLS configuration"
      procedure: |
        # Check SSL configuration
        openssl s_client -connect kafka-broker:9093 -verify_return_error -CAfile ca-certificate.pem
        
        # Verify certificate chain
        openssl verify -CAfile ca-certificate.pem client-certificate.pem
        
        # Test certificate revocation
        openssl verify -CAfile ca-certificate.pem -CRLfile ca-certificate-crl.pem client-certificate.pem

  remediation_actions:
    - action: "Update authentication configuration"
      procedure: |
        # Strengthen SASL configuration
        cat >> /etc/kafka/server.properties << EOF
        sasl.enabled.mechanisms=SCRAM-SHA-512
        sasl.mechanism.inter.broker.protocol=SCRAM-SHA-512
        security.inter.broker.protocol=SASL_SSL
        EOF
        
        # Update client authentication requirements
        kafka-configs --bootstrap-server localhost:9093 --alter --add-config 'sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required;' --entity-type brokers --entity-default
    
    - action: "Implement network-based authentication"
      procedure: |
        # Configure IP-based access control
        cat >> /etc/kafka/server.properties << EOF
        listener.security.protocol.map=CLIENT:SASL_SSL,REPLICATION:SASL_SSL
        listeners=CLIENT://0.0.0.0:9093,REPLICATION://0.0.0.0:9094
        advertised.listeners=CLIENT://kafka-broker:9093,REPLICATION://kafka-broker:9094
        EOF
        
        # Update firewall rules for specific IP ranges
        sudo iptables -I INPUT -p tcp --dport 9093 -s 10.0.1.0/24 -j ACCEPT
        sudo iptables -A INPUT -p tcp --dport 9093 -j DROP
```

### 5. Privilege Escalation Response Playbook

#### Incident: User Gaining Unauthorized Administrative Access

**Trigger Conditions:**
- User performing administrative operations without proper permissions
- ACL modifications by non-admin users
- Topic creation/deletion by unauthorized users
- Configuration changes by standard users

**Response Procedures:**

```typescript
class PrivilegeEscalationResponse {
  async handlePrivilegeEscalation(incident: SecurityIncident): Promise<ResponseResult> {
    const response: ResponseResult = {
      incidentId: incident.id,
      actions: [],
      status: 'IN_PROGRESS'
    };

    // Step 1: Immediate privilege revocation
    await this.revokeAllPrivileges(incident.details.userId);
    response.actions.push('Revoked all elevated privileges');

    // Step 2: Audit current permissions
    const permissionAudit = await this.auditUserPermissions(incident.details.userId);
    response.actions.push('Completed permission audit');

    // Step 3: Review recent administrative actions
    const adminActions = await this.reviewAdminActions(incident.details.userId);
    if (adminActions.length > 0) {
      await this.validateAdminActions(adminActions);
      response.actions.push(`Reviewed ${adminActions.length} administrative actions`);
    }

    // Step 4: Check for persistence mechanisms
    const persistenceCheck = await this.checkPersistenceMechanisms(incident.details.userId);
    if (persistenceCheck.found) {
      await this.removePersistenceMechanisms(persistenceCheck.mechanisms);
      response.actions.push('Removed persistence mechanisms');
    }

    // Step 5: Validate system integrity
    const integrityCheck = await this.validateSystemIntegrity();
    if (!integrityCheck.passed) {
      await this.initiateSystemHardening();
      response.actions.push('Initiated system hardening procedures');
    }

    response.status = 'COMPLETED';
    return response;
  }

  private async revokeAllPrivileges(userId: string): Promise<void> {
    // Remove from all admin groups
    await this.removeFromAdminGroups(userId);
    
    // Reset ACL permissions to minimum required
    await this.resetACLPermissions(userId);
    
    // Invalidate all sessions
    await this.invalidateUserSessions(userId);
    
    // Audit log the privilege revocation
    await this.auditLogger.logPrivilegeRevocation(userId);
  }

  private async validateAdminActions(actions: AdminAction[]): Promise<void> {
    for (const action of actions) {
      // Check if action was authorized
      const authorized = await this.validateActionAuthorization(action);
      
      if (!authorized) {
        // Reverse unauthorized action if possible
        await this.reverseAdminAction(action);
        
        // Log security violation
        await this.auditLogger.logUnauthorizedAdminAction(action);
      }
    }
  }
}
```

## P3 - Medium Priority Incidents

### 6. Unusual Access Patterns Response Playbook

#### Incident: Suspicious User Behavior Detected

**Trigger Conditions:**
- Off-hours access to sensitive topics
- Unusual data consumption patterns
- Access from unexpected geographic locations
- Deviation from normal user behavior baseline

**Response Procedures:**

```yaml
unusual_access_response:
  monitoring_enhancement:
    - action: "Increase user monitoring"
      procedure: |
        # Enable detailed access logging for user
        kafka-configs --bootstrap-server localhost:9093 --alter --add-config 'log4j.logger.kafka.security.auth=DEBUG' --entity-type users --entity-name suspicious-user
        
        # Track real-time access patterns
        tail -f /var/log/kafka/server.log | grep suspicious-user | tee /investigation/realtime-access.log
    
    - action: "Implement behavior analysis"
      procedure: |
        # Run behavioral analysis on user patterns
        python3 scripts/behavioral-analysis.py --user suspicious-user --baseline-days 30 --output /investigation/behavior-analysis.json
        
        # Set up automated alerts for deviations
        ./monitoring/setup-behavioral-alerts.sh suspicious-user

  investigation_steps:
    - action: "Interview user"
      timeline: "within 4 hours"
      procedure: |
        # Security team conducts user interview
        # - Verify recent access needs
        # - Confirm identity
        # - Understand business justification
        # - Document interview results
    
    - action: "Validate business justification"
      procedure: |
        # Contact user's manager
        # Verify project requirements
        # Check approval workflows
        # Document business need validation

  risk_mitigation:
    - action: "Implement additional access controls"
      procedure: |
        # Require manager approval for sensitive topic access
        cat >> /etc/kafka/access-policies.yml << EOF
        sensitive_topics:
          - topic_pattern: "sensitive.*"
            additional_approval_required: true
            approver_role: "manager"
            max_access_duration: "4_hours"
        EOF
    
    - action: "Enhanced monitoring"
      procedure: |
        # Set up real-time alerts for user
        ./monitoring/setup-user-monitoring.sh suspicious-user --alert-threshold low
        
        # Enable DLP monitoring
        ./dlp/enable-user-dlp.sh suspicious-user
```

## P4 - Low Priority Incidents

### 7. Configuration Drift Response Playbook

#### Incident: Unauthorized Configuration Changes

**Trigger Conditions:**
- Security configuration modified without approval
- Baseline configuration drift detected
- Unauthorized changes to ACL rules
- SSL/TLS configuration weakened

**Response Procedures:**

```yaml
config_drift_response:
  change_validation:
    - action: "Compare with baseline"
      procedure: |
        # Generate current configuration
        kafka-configs --bootstrap-server localhost:9093 --describe --entity-type brokers --entity-default > /tmp/current-config.txt
        
        # Compare with baseline
        diff /baseline/kafka-broker-config.txt /tmp/current-config.txt > /investigation/config-changes.diff
    
    - action: "Identify unauthorized changes"
      procedure: |
        # Check change management records
        python3 scripts/validate-changes.py --config-diff /investigation/config-changes.diff --change-db /var/db/change-requests.db
    
    - action: "Assess security impact"
      procedure: |
        # Analyze security implications
        python3 scripts/security-impact-analysis.py --changes /investigation/config-changes.diff --output /investigation/security-impact.json

  remediation:
    - action: "Revert unauthorized changes"
      procedure: |
        # Restore baseline configuration
        cp /baseline/kafka-broker-config.txt /tmp/restore-config.txt
        
        # Apply baseline configuration
        while IFS= read -r config_line; do
          kafka-configs --bootstrap-server localhost:9093 --alter --add-config "$config_line" --entity-type brokers --entity-default
        done < /tmp/restore-config.txt
    
    - action: "Strengthen change controls"
      procedure: |
        # Implement configuration monitoring
        ./monitoring/setup-config-monitoring.sh
        
        # Enable change approval workflow
        ./change-management/enable-approval-workflow.sh
```

## Escalation Procedures

### Executive Escalation Matrix

```yaml
escalation_matrix:
  p1_critical:
    immediate_notification:
      - role: "Incident Commander"
        contact: "primary_oncall"
        method: "phone_call"
        timeout: 5_minutes
      
      - role: "CISO"
        contact: "ciso_emergency"
        method: "phone_call"
        timeout: 10_minutes
      
      - role: "CTO"
        contact: "cto_emergency"
        method: "phone_call"
        timeout: 15_minutes
    
    escalation_triggers:
      - condition: "No response in 15 minutes"
        action: "Escalate to CEO"
      
      - condition: "Data breach confirmed"
        action: "Notify legal counsel and board"
      
      - condition: "Regulatory notification required"
        action: "Activate external counsel and PR team"

  p2_high:
    immediate_notification:
      - role: "Security Team Lead"
        contact: "security_team_lead"
        method: "slack_and_email"
        timeout: 15_minutes
      
      - role: "On-call Engineer"
        contact: "primary_oncall"
        method: "pagerduty"
        timeout: 30_minutes
    
    escalation_triggers:
      - condition: "No containment in 2 hours"
        action: "Escalate to CISO"
      
      - condition: "Business impact confirmed"
        action: "Notify business stakeholders"

  external_support:
    incident_response_firm:
      name: "CyberSecurity Partners Inc"
      contact: "emergency@cybersecpartners.com"
      phone: "+1-800-CYBER-911"
      activation_criteria: "P1 incidents with potential data breach"
    
    legal_counsel:
      name: "Privacy & Security Law Firm"
      contact: "emergency@privacylaw.com"
      phone: "+1-800-PRIVACY"
      activation_criteria: "Regulatory notification required"
    
    law_enforcement:
      fbi_cyber:
        contact: "ic3.gov"
        phone: "1-855-292-3937"
        activation_criteria: "Criminal activity suspected"
```

### Communication Templates

#### P1 Incident Communication Template

```markdown
# CRITICAL SECURITY INCIDENT NOTIFICATION

**Incident ID:** {{incident_id}}
**Detection Time:** {{detection_time}}
**Current Status:** {{status}}
**Incident Commander:** {{incident_commander}}

## Executive Summary
{{executive_summary}}

## Impact Assessment
- **Systems Affected:** {{affected_systems}}
- **Data Involved:** {{data_types}}
- **Business Impact:** {{business_impact}}
- **Estimated Recovery Time:** {{recovery_estimate}}

## Current Actions
{{current_actions}}

## Next Steps
{{next_steps}}

## Communication Schedule
{{communication_schedule}}

**Confidential - For Internal Use Only**
```

#### Regulatory Notification Template

```markdown
# DATA BREACH NOTIFICATION

**To:** {{regulatory_body}}
**From:** {{company_legal}}
**Date:** {{notification_date}}
**Incident Reference:** {{incident_id}}

## Breach Summary
We are writing to notify you of a personal data breach that occurred on {{breach_date}}.

## Nature of the Breach
{{breach_description}}

## Categories and Number of Data Subjects
{{affected_individuals_count}} individuals may be affected.

## Categories and Number of Personal Data Records
{{record_types_and_counts}}

## Likely Consequences
{{consequence_assessment}}

## Measures Taken or Proposed
{{remedial_measures}}

## Contact Information
{{contact_details}}

**This notification is being made within 72 hours of becoming aware of the breach in accordance with regulatory requirements.**
```

## Post-Incident Activities

### Lessons Learned Process

```typescript
interface LessonsLearnedSession {
  incidentId: string;
  sessionDate: Date;
  participants: Participant[];
  timeline: IncidentTimeline;
  whatWorkedWell: string[];
  improvementAreas: string[];
  actionItems: ActionItem[];
  processChanges: ProcessChange[];
}

class PostIncidentAnalysis {
  async conductLessonsLearned(incidentId: string): Promise<LessonsLearnedSession> {
    const session: LessonsLearnedSession = {
      incidentId,
      sessionDate: new Date(),
      participants: await this.gatherParticipants(incidentId),
      timeline: await this.reconstructTimeline(incidentId),
      whatWorkedWell: [],
      improvementAreas: [],
      actionItems: [],
      processChanges: []
    };

    // Conduct structured interview process
    for (const participant of session.participants) {
      const feedback = await this.interviewParticipant(participant, incidentId);
      
      session.whatWorkedWell.push(...feedback.positives);
      session.improvementAreas.push(...feedback.improvements);
    }

    // Generate action items
    session.actionItems = await this.generateActionItems(session.improvementAreas);

    // Identify process changes needed
    session.processChanges = await this.identifyProcessChanges(session);

    // Schedule follow-up reviews
    await this.scheduleFollowUpReviews(session.actionItems);

    return session;
  }

  private async generateActionItems(improvements: string[]): Promise<ActionItem[]> {
    const actionItems: ActionItem[] = [];

    for (const improvement of improvements) {
      const actionItem: ActionItem = {
        id: uuidv4(),
        description: improvement,
        assignee: await this.determineAssignee(improvement),
        priority: await this.assessPriority(improvement),
        dueDate: await this.calculateDueDate(improvement),
        status: 'OPEN',
        dependencies: []
      };

      actionItems.push(actionItem);
    }

    return actionItems;
  }
}
```

### Metrics and KPIs

```yaml
incident_response_metrics:
  response_times:
    - metric: "Time to Detection"
      target: "< 15 minutes"
      measurement: "From first indicator to alert"
    
    - metric: "Time to Containment"
      target: 
        p1: "< 1 hour"
        p2: "< 4 hours"
        p3: "< 24 hours"
      measurement: "From detection to threat contained"
    
    - metric: "Time to Recovery"
      target:
        p1: "< 24 hours"
        p2: "< 72 hours"
        p3: "< 1 week"
      measurement: "From detection to full service restoration"

  effectiveness_metrics:
    - metric: "False Positive Rate"
      target: "< 10%"
      measurement: "Percentage of alerts that were not actual incidents"
    
    - metric: "Escalation Rate"
      target: "< 20%"
      measurement: "Percentage of incidents requiring executive escalation"
    
    - metric: "Recurrence Rate"
      target: "< 5%"
      measurement: "Percentage of incidents that recur within 30 days"

  compliance_metrics:
    - metric: "Regulatory Notification Timeliness"
      target: "100% within required timeframes"
      measurement: "GDPR: 72 hours, SOX: immediate, etc."
    
    - metric: "Evidence Preservation Rate"
      target: "100%"
      measurement: "Percentage of incidents with complete evidence chain"
```

This comprehensive incident response framework provides detailed procedures for handling various security incidents specific to Kafka environments, ensuring rapid containment, thorough investigation, and effective recovery while maintaining compliance with regulatory requirements.