# Production Debugging Playbooks for AI Agent Systems

## Executive Summary

This comprehensive guide provides production-ready debugging playbooks for AI agent systems using Node.js, TypeScript, WebSockets, and PostgreSQL. The documentation follows a symptom → diagnosis → solution format, offering immediate, actionable solutions for common production issues encountered in dual-agent monitoring systems that spawn Claude processes.

---

## Process Spawn and System-Level Issues

### EINVAL Spawn Error on Windows

**Symptom:**
```
Error: spawn EINVAL
at ChildProcess.spawn (node:internal/child_process:421:11)
errno: -4071, code: 'EINVAL', syscall: 'spawn'
```

**Diagnosis:**
Breaking change in Node.js 20.12.2+ (CVE-2024-27980). Node.js now errors when spawning `.bat` or `.cmd` files without the `shell` option.

**Solution:**
```typescript
// Cross-platform spawn wrapper
function spawnCrossPlatform(command: string, args: string[], options: any = {}) {
  const isWindows = process.platform === 'win32';
  const isBatCmd = command.endsWith('.bat') || command.endsWith('.cmd');
  
  if (isWindows && isBatCmd) {
    return spawn(command, args, { ...options, shell: true });
  }
  
  return spawn(command, args, options);
}

// Alternative: Use cross-spawn package
const spawn = require('cross-spawn');
spawn('npm', ['--version']); // Handles platform differences automatically
```

**Monitoring:**
```bash
# Check Node.js version
node --version

# Verify spawn command format
node -e "console.log(process.platform)"
```

### ENOENT: Command Not Found

**Symptom:**
```
Error: spawn python ENOENT
```

**Diagnosis:**
Command not in PATH or incorrect platform-specific executable name.

**Solution:**
```typescript
// Comprehensive ENOENT debugging
function debugSpawnENOENT(command: string, args: string[]) {
  const { execSync } = require('child_process');
  
  // Check PATH
  console.log('PATH:', process.env.PATH);
  
  // Find command location
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const location = execSync(`${which} ${command}`, { encoding: 'utf8' });
    console.log(`Command found at: ${location.trim()}`);
  } catch {
    console.error(`Command not found: ${command}`);
    
    // Suggest fixes
    if (process.platform === 'win32' && !command.endsWith('.exe')) {
      console.log(`Try: ${command}.exe or ${command}.cmd`);
    }
  }
}
```

### Zombie Process Prevention

**Symptom:**
Orphaned processes consuming resources after parent crash.

**Diagnosis:**
```bash
# Linux: Check for zombie processes
ps aux | grep '<defunct>'

# Windows: Check orphaned processes
wmic process where "ParentProcessId=0" get ProcessId,Name
```

**Solution:**
```typescript
class ProcessManager {
  private children = new Set<ChildProcess>();
  
  constructor() {
    // Clean up on exit
    process.on('exit', () => this.killAllChildren());
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
    
    // Handle crashes
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.killAllChildren();
      process.exit(1);
    });
  }
  
  spawn(command: string, args: string[], options: any = {}): ChildProcess {
    const child = spawn(command, args, {
      ...options,
      detached: false  // Keep attached to parent
    });
    
    this.children.add(child);
    
    child.on('exit', () => {
      this.children.delete(child);
    });
    
    return child;
  }
  
  private gracefulShutdown() {
    console.log('Gracefully shutting down...');
    
    for (const child of this.children) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }
    
    setTimeout(() => {
      this.killAllChildren();
      process.exit(0);
    }, 5000);
  }
  
  private killAllChildren() {
    for (const child of this.children) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
  }
}
```

---

## Network Integration Issues

### fetch() is not defined

**Symptom:**
```
ReferenceError: fetch is not defined
```

**Diagnosis:**
Node.js versions < 18 don't have native fetch support.

**Solution:**
```javascript
// Option 1: Use node-fetch
const fetch = require('node-fetch');

// Option 2: Use axios with retry logic
const axios = require('axios');

async function robustFetch(url, options = {}) {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        url,
        ...options,
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function isRetryableError(error) {
  return error.code === 'ECONNRESET' ||
         error.code === 'ETIMEDOUT' ||
         (error.response && error.response.status >= 500);
}
```

### WebSocket Connection Drops

**Symptom:**
WebSocket disconnects randomly, agents lose communication.

**Diagnosis:**
Network interruptions, idle timeouts, or missing heartbeats.

**Solution:**
```javascript
class RobustWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.maxReconnectAttempts = options.maxAttempts || 5;
    this.reconnectInterval = options.interval || 1000;
    this.pingInterval = options.pingInterval || 30000;
    this.reconnectAttempts = 0;
    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
      this.startHeartbeat();
    } catch (error) {
      this.handleReconnect();
    }
  }

  setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.stopHeartbeat();
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, this.pingInterval);
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
  }
}
```

### DNS Resolution Issues in Containers

**Symptom:**
```
getaddrinfo EAI_AGAIN api.example.com
```

**Diagnosis:**
DNS cache missing, CoreDNS overload, or ndots configuration issue.

**Solution:**
```javascript
// Implement DNS caching
class DNSCache {
  constructor(ttl = 300000) { // 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  async lookup(hostname) {
    const cached = this.cache.get(hostname);
    if (cached && Date.now() < cached.expiry) {
      return cached.address;
    }

    try {
      const dns = require('dns').promises;
      const result = await dns.lookup(hostname);
      this.cache.set(hostname, {
        address: result.address,
        expiry: Date.now() + this.ttl
      });
      return result.address;
    } catch (error) {
      console.error(`DNS lookup failed for ${hostname}:`, error);
      throw error;
    }
  }
}

// Set UV_THREADPOOL_SIZE for DNS operations
process.env.UV_THREADPOOL_SIZE = require('os').cpus().length;
```

**Monitoring:**
```bash
# Check DNS resolution
kubectl run dns-test --image=busybox --rm -it -- nslookup api.example.com

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns
```

---

## Database and State Management

### PostgreSQL "Too Many Connections"

**Symptom:**
```
FATAL: sorry, too many clients already
pg: too many connections for database "database_name"
```

**Diagnosis:**
```sql
-- Check current connections
SELECT count(*) AS current_connections,
       (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections
FROM pg_stat_activity;

-- Find idle connections
SELECT pid, state, usename, now() - backend_start AS connection_age
FROM pg_stat_activity 
WHERE state = 'idle' 
ORDER BY connection_age DESC;
```

**Solution:**
```javascript
import { Pool } from 'pg';

const pool = new Pool({
  max: 20,                        // Maximum connections
  min: 2,                         // Minimum connections
  idleTimeoutMillis: 30000,       // Close idle after 30s
  connectionTimeoutMillis: 5000,  // Connection timeout
  maxUses: 7500,                  // Close after N uses
});

// Proper connection usage
async function executeQuery(query, params) {
  const client = await pool.connect();
  try {
    return await client.query(query, params);
  } finally {
    client.release(); // Always release
  }
}

// Monitor pool health
setInterval(() => {
  console.log('Pool stats:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 10000);
```

**Recovery:**
```sql
-- Terminate idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
  AND now() - query_start > interval '10 minutes';
```

### Transaction Deadlocks

**Symptom:**
```
ERROR: deadlock detected
DETAIL: Process 12345 waits for ShareLock on transaction 67890
```

**Diagnosis:**
```sql
-- Find current lock waits
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_locks blocked_locks
JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**Solution:**
```javascript
async function executeWithDeadlockRetry(operation, maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      if (error.code === '40P01' && attempt < maxRetries - 1) {
        // Deadlock detected - exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        continue;
      }
      throw error;
    }
  }
}

// Prevent deadlocks with consistent lock ordering
async function transferFunds(fromId, toId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Always lock in consistent order (lower ID first)
    const [id1, id2] = fromId < toId ? [fromId, toId] : [toId, fromId];
    
    await client.query('SELECT * FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE', [id1, id2]);
    await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## Container and Orchestration Issues

### Docker Networking Issues

**Symptom:**
Agents can't communicate within Docker network.

**Diagnosis:**
```bash
# Inspect network
docker network inspect agent-network

# Test connectivity
docker exec -it agent1 ping agent2

# Debug with netshoot
docker run -it --net container:agent1 nicolaka/netshoot
```

**Solution:**
```bash
# Create custom bridge network
docker network create --driver bridge \
  --subnet=172.20.0.0/16 \
  --gateway=172.20.0.1 \
  agent-network

# Run agents on same network
docker run -d --network=agent-network \
  --name=agent-coordinator \
  my-agent:latest
```

### Kubernetes OOM Kills

**Symptom:**
Pod restarts with OOMKilled status.

**Diagnosis:**
```bash
# Check OOM events
kubectl get events --field-selector reason=OOMKilling

# Monitor resource usage
kubectl top pods --containers

# Check limits
kubectl describe pod <pod-name> | grep -A 10 "Limits\|Requests"
```

**Solution:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: memory-intensive-agent
spec:
  template:
    spec:
      containers:
      - name: agent
        image: ai-agent:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"  # Equal to request for guaranteed QoS
        env:
        - name: NODE_OPTIONS
          value: "--max-old-space-size=1800"
```

**Monitoring:**
```promql
# Memory approaching limits (Prometheus)
(container_memory_working_set_bytes{pod=~".*agent.*"} / 
 container_spec_memory_limit_bytes{pod=~".*agent.*"}) > 0.8
```

### Volume Mount Failures

**Symptom:**
Pod stuck in ContainerCreating state.

**Diagnosis:**
```bash
# Check events
kubectl describe pod <pod-name> | tail -20

# Verify PVC status
kubectl get pvc

# Check storage class
kubectl get storageclass
```

**Solution:**
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: stateful-agents
spec:
  serviceName: agents
  template:
    spec:
      containers:
      - name: agent
        volumeMounts:
        - name: workspace
          mountPath: /agent/workspace
  volumeClaimTemplates:
  - metadata:
      name: workspace
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
      storageClassName: fast-ssd
```

---

## Observability and Log Correlation

### Implementing Correlation IDs

**Solution:**
```javascript
// Express middleware for correlation IDs
const { v4: uuidv4 } = require('uuid');
const cls = require('cls-rtracer');

app.use(cls.expressMiddleware({
  requestIdFactory: () => uuidv4()
}));

app.use((req, res, next) => {
  const correlationId = cls.id();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Logger with correlation ID
const pino = require('pino');

const logger = pino({
  formatters: {
    log: (object) => {
      const correlationId = cls.id();
      if (correlationId) {
        object.correlationId = correlationId;
      }
      return object;
    }
  }
});

// Propagate to downstream services
const axios = require('axios');

axios.interceptors.request.use(config => {
  const correlationId = cls.id();
  if (correlationId) {
    config.headers['X-Correlation-ID'] = correlationId;
  }
  return config;
});
```

### Memory Leak Detection

**Symptom:**
Gradual memory increase leading to crashes.

**Diagnosis:**
```javascript
// Memory monitoring
class MemoryMonitor {
  constructor() {
    this.baseline = process.memoryUsage();
    this.samples = [];
    
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      
      this.samples.push({
        timestamp: Date.now(),
        heapUsedMB,
        external: usage.external / 1024 / 1024,
        rss: usage.rss / 1024 / 1024
      });
      
      // Keep last hour of samples
      const oneHourAgo = Date.now() - 3600000;
      this.samples = this.samples.filter(s => s.timestamp > oneHourAgo);
      
      // Check for leak patterns
      if (this.samples.length > 60) {
        const trend = this.calculateTrend();
        if (trend > 0.5) { // 0.5 MB/minute growth
          console.error('Potential memory leak detected:', {
            trend: `${trend.toFixed(2)} MB/minute`,
            current: `${heapUsedMB.toFixed(2)} MB`
          });
          this.takeHeapSnapshot();
        }
      }
    }, 60000); // Check every minute
  }
  
  calculateTrend() {
    if (this.samples.length < 2) return 0;
    
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const durationMinutes = (last.timestamp - first.timestamp) / 60000;
    
    return (last.heapUsedMB - first.heapUsedMB) / durationMinutes;
  }
  
  takeHeapSnapshot() {
    const v8 = require('v8');
    const fs = require('fs');
    
    const filename = `heap-${Date.now()}.heapsnapshot`;
    const stream = fs.createWriteStream(filename);
    
    v8.writeHeapSnapshot(stream);
    console.log(`Heap snapshot written to ${filename}`);
  }
}
```

**Profiling Commands:**
```bash
# CPU profiling
node --inspect app.js
# Open chrome://inspect in Chrome

# Heap snapshot via signal
kill -USR2 <pid>

# Memory profiling with clinic.js
npx clinic doctor -- node app.js
npx clinic heap -- node app.js
```

---

## Production Monitoring and Alerting

### Prometheus Metrics

```javascript
const promClient = require('prom-client');

// Custom metrics for agent systems
const agentTaskDuration = new promClient.Histogram({
  name: 'agent_task_duration_seconds',
  help: 'Duration of agent task execution',
  labelNames: ['agent_type', 'task_type', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const activeAgents = new promClient.Gauge({
  name: 'agents_active_total',
  help: 'Number of active agents',
  labelNames: ['type']
});

const errorRate = new promClient.Counter({
  name: 'agent_errors_total',
  help: 'Total number of agent errors',
  labelNames: ['agent_type', 'error_type']
});

// Track metrics
async function executeAgentTask(agentType, taskType, operation) {
  const timer = agentTaskDuration.startTimer({
    agent_type: agentType,
    task_type: taskType
  });
  
  try {
    activeAgents.inc({ type: agentType });
    const result = await operation();
    timer({ status: 'success' });
    return result;
  } catch (error) {
    timer({ status: 'error' });
    errorRate.inc({
      agent_type: agentType,
      error_type: error.name
    });
    throw error;
  } finally {
    activeAgents.dec({ type: agentType });
  }
}

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(promClient.register.metrics());
});
```

### Alert Rules

```yaml
# prometheus-alerts.yml
groups:
- name: agent-critical
  rules:
  - alert: HighErrorRate
    expr: rate(agent_errors_total[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors/sec"
      
  - alert: MemoryLeak
    expr: rate(process_resident_memory_bytes[1h]) > 1048576
    for: 30m
    labels:
      severity: warning
    annotations:
      summary: "Potential memory leak"
      description: "Memory growing at {{ $value }} bytes/hour"
      
  - alert: DatabaseConnectionExhaustion
    expr: pg_connections_active / pg_connections_max > 0.9
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Database connection pool nearly exhausted"
```

---

## Emergency Response Procedures

### Quick Diagnostic Script

```bash
#!/bin/bash
echo "=== Agent System Diagnostic ==="

# Check process health
echo "Node processes:"
ps aux | grep node | head -5

# Memory usage
echo -e "\nMemory usage:"
free -h

# Database connections
echo -e "\nDatabase connections:"
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Network connections
echo -e "\nNetwork connections:"
netstat -an | grep ESTABLISHED | wc -l

# Docker/K8s status
if command -v docker &> /dev/null; then
  echo -e "\nDocker containers:"
  docker ps --format "table {{.Names}}\t{{.Status}}"
fi

if command -v kubectl &> /dev/null; then
  echo -e "\nKubernetes pods:"
  kubectl get pods | grep agent
fi

# Recent errors
echo -e "\nRecent errors:"
journalctl -u agent-service --since "5 minutes ago" | grep ERROR | tail -5
```

### Recovery Runbook

```bash
#!/bin/bash
# Emergency recovery procedure

echo "Starting emergency recovery..."

# 1. Stop problematic services
systemctl stop agent-worker

# 2. Clear connection pools
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"

# 3. Clear temporary files
rm -rf /tmp/agent-*

# 4. Increase resources temporarily
export NODE_OPTIONS="--max-old-space-size=4096"

# 5. Restart with minimal configuration
NODE_ENV=recovery npm start

# 6. Monitor recovery
watch -n 5 'ps aux | grep node; free -h'
```

---

## Best Practices Summary

### Preventive Measures
1. **Always use connection pooling** with proper timeout configuration
2. **Implement graceful shutdown** handlers for all processes
3. **Use correlation IDs** for distributed tracing
4. **Set resource limits** explicitly in container environments
5. **Monitor memory trends** proactively, not just absolute values

### Quick Reference
- **Process Issues**: Check Node.js version, PATH, and platform differences
- **Network Issues**: Verify DNS, implement retry logic, use heartbeats
- **Database Issues**: Monitor connection pools, handle deadlocks with retry
- **Container Issues**: Set proper resource limits, use health checks
- **Memory Issues**: Take heap snapshots, monitor trends, profile regularly

### Escalation Path
1. **Level 1**: Automated recovery (restarts, connection cleanup)
2. **Level 2**: Manual intervention (configuration changes, resource scaling)
3. **Level 3**: Code changes (memory leak fixes, architectural changes)
4. **Level 4**: Infrastructure changes (database scaling, cluster expansion)

This playbook provides comprehensive debugging strategies for production AI agent systems, enabling rapid diagnosis and resolution of common issues while maintaining system reliability and performance.