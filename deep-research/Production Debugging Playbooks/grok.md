# Production-Debugging-Playbooks.md

### Key Points

- **Research suggests** that cross-platform compatibility in process spawning, such as Windows vs. Linux differences in Node.js, often leads to errors like EINVAL due to shell and PATH issues, but can be mitigated with proper argument escaping and environment checks.
- **It seems likely that** network timeouts and DNS resolution problems in containerized Node.js apps stem from misconfigurations, with best practices emphasizing explicit timeout handling and connection pooling to avoid exhaustion.
- **Evidence leans toward** using exponential backoff for WebSocket reconnections in agent systems, acknowledging the complexity of server restarts and the need for health checks to ensure service recovery without overwhelming resources.
- **Studies indicate** that PostgreSQL connection pool exhaustion in Node.js often results from unclosed connections, with monitoring tools and proper pool sizing helping prevent "too many connections" errors.
- **There is debate around** memory leak detection in Node.js child processes, with tools like heap snapshots and clinic.js recommended, balancing in-memory speed against persistent storage for state consistency.
- **Cross-platform file path handling** in Node.js can cause issues in multi-architecture containers, but using the path module ensures compatibility, highlighting the trade-offs in Docker networking and volume mounts.

### Process Spawn Debugging

Common symptoms include EINVAL errors from invalid arguments or paths. Diagnose with `strace` on Linux or Process Monitor on Windows. Solutions involve using `cross-spawn` for compatibility. Monitor with Prometheus for spawn failures; escalate if persistent across nodes.

### Network Integration Issues

Fetch errors like "not defined" arise in older Node versions; upgrade or use polyfills. DNS issues in Docker need `--dns` flags. Optimize pooling with `pg` module limits.

### Service Discovery & Recovery

WebSocket drops require ping-pong mechanisms for reconnection. Health checks via `/health` endpoints; use Istio for meshes.

### Log Correlation & Observability

Use correlation IDs propagated via headers. Structured logging with Pino; alert via ELK stack.

### Database & State Management Issues

"Too many connections" fixed by pool sizing and transaction timeouts. Use Redis for session consistency across restarts.

### Container & Orchestration Debugging

OOM kills prevented by setting resource limits. Volume mounts need proper permissions; multi-arch with Buildx.

For more, see [Node.js child_process docs](https://nodejs.org/api/child_process.html) and [Kubernetes docs](https://kubernetes.io/docs/tasks/debug/).

---

### Comprehensive Survey on Production Debugging Playbooks for AI Agent Systems

This survey provides an in-depth exploration of debugging strategies tailored to AI agent systems using Node.js, TypeScript, WebSockets, and PostgreSQL. It builds on the key points above, incorporating real-world scenarios where agents spawn processes (e.g., for Claude AI tasks) and communicate via APIs/WebSockets. The structure follows symptom → diagnosis → solution, with integrations for monitoring, alerting, escalation, and rollback. Emphasis is on dual-agent monitoring systems, where downtime or errors can cascade across agents.

#### 1. Process Spawn Debugging

In AI agent systems, spawning child processes (e.g., for external AI tools like Claude) is prone to platform-specific issues, leading to failures in task execution.

**Symptom: EINVAL spawn error**  
This often manifests as "Error: spawn EINVAL" in logs, indicating invalid arguments or shell mismatches, especially on Windows vs. Linux. Agents may fail to start subprocesses, causing workflow halts.

**Diagnosis:**  

- Check error stacks for specifics: `node:internal/child_process:421:11` points to spawn failures.
- Use shell commands: On Linux, `strace -e spawn node app.js` traces system calls; on Windows, use Process Monitor to inspect PATH and permissions.
- Verify Windows/Linux compatibility: Windows ignores shebangs; Linux may have PATH resolution issues.
- Test for EACCES: Run `ls -l /path/to/executable` to check permissions.
- Identify zombie processes: `ps aux | grep defunct` shows orphans from unclean exits.

**Solution:**  

- Use `cross-spawn` for compatibility:  
  
  ```typescript
  import { spawn } from 'cross-spawn';
  spawn('claude-process', args, { shell: true, stdio: 'inherit' });
  ```
- Escape arguments: Use `upath` for paths.
- Clean up: Listen for `'exit'` and kill child processes.
- Prevent zombies: Use `process.on('exit', () => child.kill());`.

**Monitoring and Alerting:**  
Integrate Prometheus: Metric `spawn_failures_total`. Alert if >5/min via Alertmanager.

**Escalation and Rollback:**  
Escalate to ops if cross-platform; rollback by switching to single-platform testing. Use blue-green deployments.

| Issue   | Symptom           | Diagnosis Tool         | Solution Snippet              |
| ------- | ----------------- | ---------------------- | ----------------------------- |
| EINVAL  | Spawn fails       | strace/Process Monitor | `spawn(..., { shell: true })` |
| EACCES  | Permission denied | `ls -l`                | `chmod +x executable`         |
| Zombies | Defunct processes | `ps aux`               | `child.on('exit', cleanup)`   |

#### 2. Network Integration Issues

Network problems in agent communications via REST/WebSockets can lead to dropped requests or timeouts.

**Symptom: fetch() is not defined**  
Error in older Node.js: "ReferenceError: fetch is not defined". Agents fail API calls.

**Diagnosis:**  

- Check Node version: `node -v` (needs v18+).
- For timeouts: Use `curl -v url` to test connectivity.
- DNS in containers: `docker exec cat /etc/resolv.conf` shows invalid servers.
- SSL issues: `openssl s_client -connect host:port` verifies certs.

**Solution:**  

- Polyfill fetch: `npm i node-fetch`; import and use.
- Timeout handling:  
  
  ```typescript
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5000);
  fetch(url, { signal: controller.signal });
  ```
- Pooling: Use `pg.Pool` with `max: 10`.
- DNS fix: Add `--dns 8.8.8.8` to docker run.

**Monitoring and Alerting:**  
Track `http_requests_total` in Prometheus; alert on timeouts >10%.

**Escalation and Rollback:**  
Escalate if cert chain issues; rollback to HTTP for testing.

| Trade-off     | HTTP Module          | Fetch API              |
| ------------- | -------------------- | ---------------------- |
| Compatibility | Built-in, older Node | v18+, polyfills needed |
| Promises      | Manual               | Native async/await     |

#### 3. Service Discovery & Recovery

Agent reconnections after server restarts are critical for monitoring systems.

**Symptom: WebSocket connection drops and recovery**  
"WebSocket disconnected" logs; agents lose real-time updates.

**Diagnosis:**  

- Check browser tab focus: Throttling causes timeouts.
- Health checks: `kubectl get services` for discovery issues.

**Solution:**  

- Reconnect with backoff:  
  
  ```typescript
  let retry = 0;
  function reconnect() {
    if (retry++ > 5) return;
    setTimeout(() => ws.connect(), Math.min(1000 * retry, 10000));
  }
  ```
- Health patterns: Implement `/health` returning 200 if connected.
- Graceful shutdown: `server.close(() => process.exit(0));`.

**Monitoring and Alerting:**  
Use Grafana for reconnection metrics; alert on drops >20/min.

**Escalation and Rollback:**  
Escalate to infra if mesh integration fails; rollback by disabling auto-restart.

#### 4. Log Correlation & Observability

Tracing across manager, worker, and monitoring services is essential for multi-agent workflows.

**Symptom: Uncorrelated logs**  
Difficult to trace errors across services.

**Diagnosis:**  

- Check for IDs: Grep logs for missing correlation headers.
- Performance: Use `clinic.js` for profiling.

**Solution:**  

- Correlation IDs: Middleware to propagate `req.headers['x-correlation-id']`.
- Structured logging: Use Pino: `pino.info({ id: corrId, msg: 'Event' });`.
- Tracing: OpenTelemetry for spans.

**Monitoring and Alerting:**  
Aggregate errors with ELK; alert on high error rates.

**Escalation and Rollback:**  
Escalate if tracing fails; rollback to console logging.

| Pattern     | Use Case        | Example            |
| ----------- | --------------- | ------------------ |
| Structured  | Searchable logs | JSON with IDs      |
| Correlation | Multi-service   | Header propagation |

#### 5. Database & State Management Issues

PostgreSQL issues can disrupt agent state persistence.

**Symptom: PostgreSQL "too many connections" errors**  
Pool exhaustion from leaks or high load.

**Diagnosis:**  

- Query: `SELECT * FROM pg_stat_activity;` shows connections.
- Deadlocks: `SELECT * FROM pg_locks;` detects.

**Solution:**  

- Pool config: `new Pool({ max: 20, idleTimeoutMillis: 30000 });`.
- Deadlock recovery: Use `REPEATABLE READ` isolation.
- Session consistency: Redis for shared state.
- Migration: Use Flyway for strategies.

**Monitoring and Alerting:**  
pgHero for pool metrics; alert on connections >80%.

**Escalation and Rollback:**  
Escalate if deadlocks persist; rollback migrations via backups.

| Trade-off  | Memory          | Persistent |
| ---------- | --------------- | ---------- |
| Speed      | Fast access     | Slower I/O |
| Durability | Lost on restart | Survives   |

#### 6. Container & Orchestration Debugging

Container issues affect agent deployment.

**Symptom: Agent process memory leaks and detection**  
High memory, OOM kills.

**Diagnosis:**  

- Heap snapshots: `--heapsnapshot-signal=SIGUSR2`.
- Networking: `docker network inspect` for issues.
- Volumes: `docker inspect container` shows mounts.

**Solution:**  

- Leak detection: Use `clinic bubbleprof`.
- Resource limits: YAML `resources: limits: memory: 512Mi`.
- Multi-arch: `docker buildx build --platform linux/amd64,linux/arm64`.

**Monitoring and Alerting:**  
Kubelet metrics for OOM; alert via Prometheus.

**Escalation and Rollback:**  
Escalate for cluster-wide issues; rollback images.

| Problem | Symptom      | Fix               |
| ------- | ------------ | ----------------- |
| OOM     | Pod restarts | Set limits        |
| Volumes | Empty mounts | Check permissions |

This survey mimics professional DevOps articles, providing a complete reference for debugging AI agent systems.

### Key Citations

- [Node.js child_process spawn EINVAL error debugging steps](https://stackoverflow.com/questions/78947325/how-to-solve-error-spawn-einval-in-nodejs)
- [Command run failed with error : spawn EINVAL #52554](https://github.com/nodejs/node/issues/52554)
- [nsd-check script not working on windows 11](https://forum.linuxfoundation.org/discussion/866481/nsd-check-script-not-working-on-windows-11)
- [ReferenceError: fetch is not defined](https://stackoverflow.com/questions/48433783/referenceerror-fetch-is-not-defined)
- [The Fetch API is finally stable in Node.js](https://blog.logrocket.com/fetch-api-node-js/)
- [node.js - NodeJs websocket getting disconnected](https://stackoverflow.com/questions/65278242/nodejs-websocket-getting-disconnected)
- [Troubleshooting connection issues | Socket.IO](https://socket.io/docs/v4/troubleshooting-connection-issues/)
- [Error: sorry, too many clients already](https://stackoverflow.com/questions/50947066/error-sorry-too-many-clients-already)
- [Node.js Memory Leak Detection: How to Debug & Avoid Them](https://sematext.com/blog/nodejs-memory-leaks/)
- [How to find production memory leaks in Node.js applications?](https://medium.com/%40amirilovic/how-to-find-production-memory-leaks-in-node-js-applications-a1b363b4884f)
- [Resolving Compatibility Issues with Node.js child_process.spawn ...](https://medium.com/%40python-javascript-php-html-css/resolving-compatibility-issues-with-node-js-child-process-spawn-and-grep-across-platforms-b33be96f9438)
- [cross-spawn - NPM](https://www.npmjs.com/package/cross-spawn)
- [A Complete Guide to Timeouts in Node.js](https://betterstack.com/community/guides/scaling-nodejs/nodejs-timeouts/)
- [Node.js app in docker container encountered weird dns.lookup latency](https://forums.docker.com/t/node-js-app-in-docker-container-encountered-weird-dns-lookup-latency/2413)
- [NodeJS: Debugging and fixing HTTPS/SSL issues](https://emcorrales.com/blog/nodejs-debugging-and-fixing-https-ssl-issues-caused-by-changing-the-self-signed-certificate)
- [Reconnection of Client when server reboots in WebSocket](https://stackoverflow.com/questions/3780511/reconnection-of-client-when-server-reboots-in-websocket)
- [design patterns - Websocket client reconnection best practices](https://softwareengineering.stackexchange.com/questions/434117/websocket-client-reconnection-best-practices)
- [Health Checks and Graceful Degradation in Distributed Systems](https://copyconstruct.medium.com/health-checks-in-distributed-systems-aa8a0e8c1672)
- [Distributed tracing for your Node.js services](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/distributed-tracing-nodejs-agent/)
- [Correlation IDs - Engineering Fundamentals Playbook](https://microsoft.github.io/code-with-engineering-playbook/observability/correlation-id/)
- [Monitoring Distributed Systems - sre golden signals](https://sre.google/sre-book/monitoring-distributed-systems/)
- [What happens when Postgresql Connection Pool is exhausted?](https://stackoverflow.com/questions/70763648/what-happens-when-postgresql-connection-pool-is-exhausted)
- [Connection pooling in Node.js](https://medium.com/%40amr258144/connection-pooling-in-node-js-ea4421c72dc)
- [PostgreSQL: Understanding deadlocks](https://www.cybertec-postgresql.com/en/postgresql-understanding-deadlocks/)
- [Session state consistency across restarts in Node.js](https://stackoverflow.com/questions/33055504/how-to-maintain-persistent-session-in-node-js-when-server-restarts)
- [Node.js Profiling Guide](https://nodejs.org/en/learn/getting-started/profiling)
- [Docker Volume not mounting any files [closed]](https://stackoverflow.com/questions/34504156/docker-volume-not-mounting-any-files)
- [Multi-platform builds - Docker Docs](https://docs.docker.com/build/building/multi-platform/)
- [Kubernetes OOMKilled | Troubleshooting Out-of-Memory Issues](https://www.groundcover.com/kubernetes-troubleshooting/oomkilled)
- [Debug Services | Kubernetes](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/)
