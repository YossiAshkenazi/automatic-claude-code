Production Debugging Playbooks for AI Agent SystemsThis document provides a comprehensive set of playbooks for diagnosing and resolving common issues in a dual-agent AI monitoring system. The context is a Node.js/TypeScript environment where agents spawn Claude processes, communicating via REST APIs and WebSockets, with PostgreSQL for data persistence.The playbooks are structured in a Symptom → Diagnosis → Solution format.1. Process Spawn Debugging1.1 Symptom: spawn EINVAL Error on StartupError Message: Error: spawn EINVAL, spawn UNKNOWNContext: This error typically occurs when the arguments passed to child_process.spawn() are invalid, especially on Windows.DiagnosisInspect Spawn Arguments: The most common cause is an invalid command or arguments. Log the exact command, arguments array, and options object being passed to spawn.Shell-Specific Syntax: Are you trying to use shell syntax (e.g., pipes |, redirects >) without shell: true? The EINVAL error can result from passing a single command string that needs shell parsing.Cross-Platform Paths: Check if you are using hardcoded Unix-style paths (e.g., /usr/bin/node) that don't exist on Windows.Executable Permissions: On Linux/macOS, the target executable might not have the execute (+x) permission.SolutionCode Snippet (Argument Logging):import { spawn } from 'child_process';

const command = 'node';
const args = ['-e', 'console.log("Hello")'];
const options = { cwd: process.cwd() };

// Log everything before spawning
console.log('Spawning process with:', { command, args, options });

const claudeProcess = spawn(command, args, options);

claudeProcess.on('error', (err) => {
  console.error('Failed to start subprocess.', err);
});
Cross-Platform Compatibility:Shell Detection: Use process.platform to differentiate logic. For Windows, often cmd.exe with /c is needed. The cross-spawn library abstracts this away.npm install cross-spawn
import spawn from 'cross-spawn';

// This now works reliably on both Windows and Linux
const claudeProcess = spawn('node', ['child_script.js']);
Argument Escaping: When using shell: true, ensure arguments are properly escaped to prevent command injection. Libraries like shell-quote can help.import { spawn } from 'child_process';
import { quote } from 'shell-quote';

const unsafeArg = 'some user input with spaces';
const command = `my_script.sh ${quote([unsafeArg])}`;

spawn(command, { shell: true });
Fixing PATH and Permission Issues:PATH Resolution: If an executable isn't found, the PATH environment variable might be different for your Node.js process. Log process.env.PATH to verify. You can provide a fully-qualified path to the executable as a workaround.Permissions (EACCES): On Linux, if you get an EACCES error, ensure the script or binary has execute permissions.# Check permissions
ls -l /path/to/your/script

# Add execute permission

chmod +x /path/to/your/script
Zombie Process Prevention:Always listen to the exit and error events on the child process handle.Ensure the parent process handles SIGTERM and SIGINT signals to gracefully terminate its children before exiting.function cleanup() {
  console.log('Shutting down...');
  if (claudeProcess && !claudeProcess.killed) {
    claudeProcess.kill('SIGTERM');
  }
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
2. Network Integration Issues2.1 Symptom: ReferenceError: fetch is not definedContext: Occurs in Node.js versions prior to v18, where fetch is not a global function. Your agent might be running with an older Node version than your development environment.DiagnosisCheck Node.js Version: Run node -v in the production environment where the agent is executing.Review package.json: Check the engines field in your package.json to ensure it specifies Node.js >= 18.SolutionUpgrade Node.js: The best solution is to upgrade the Node.js runtime in your production/container environment to a version that supports fetch (v18+).Use a Polyfill: If upgrading is not possible, use a library like node-fetch.npm install node-fetch@2 # Use v2 for CommonJS require
// Pre-Node 18
import fetch from 'node-fetch';

async function makeRequest() {
  const response = await fetch('http://monitoring-server/api/status');
  const data = await response.json();
  console.log(data);
}
Node HTTP vs. fetch:http module: Lower-level, more control, but more verbose. Better for fine-grained stream and header control. No external dependencies.fetch: Higher-level, promise-based API familiar to frontend developers. Simpler for common GET/POST requests. The standard moving forward.Recommendation: Use fetch (native or polyfilled) for simplicity unless you need low-level stream manipulation.2.2 Symptom: API Requests Timing Out or Failing IntermittentlyError Messages: ETIMEDOUT, ECONNRESET, ENOTFOUND (DNS issue)DiagnosisTimeout Configuration: Are you setting a timeout on your requests? The default might be too long or non-existent.Connection Pooling: Are you creating a new TCP connection for every single request? This is inefficient and can lead to port exhaustion.DNS in Containers: Containerized environments often have their own DNS resolvers. ENOTFOUND suggests the agent's container cannot resolve the monitoring server's hostname.SSL/TLS: Certificate validation errors (UNABLE_TO_VERIFY_LEAF_SIGNATURE) occur if the server uses a self-signed certificate or the agent's trust store is misconfigured.SolutionTimeout Handling:With fetch, use AbortController to implement timeouts.async function fetchWithTimeout(url: string, timeoutMs: number = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
Connection Pooling:Native fetch in Node.js uses an agent that handles connection pooling automatically.If using a library like axios, ensure you are using a single instance so it can manage a connection pool.// good_practice.ts
import axios from 'axios';
export const apiClient = axios.create({
  baseURL: 'http://monitoring-server/api',
  timeout: 10000,
  httpAgent: new http.Agent({ keepAlive: true }), // Explicitly enable keep-alive
});
DNS Resolution:Debug Command: From inside the running container, test DNS resolution.# exec into the agent's container
docker exec -it <agent_container_id> /bin/sh

# test DNS

nslookup monitoring-server
Solution: Ensure containers are on the same Docker network. Use the service name (monitoring-server) as the hostname. In Kubernetes, use the internal service DNS name (e.g., monitoring-server.default.svc.cluster.local).SSL/TLS Issues:For self-signed certs in development, you can set NODE_TLS_REJECT_UNAUTHORIZED=0. NEVER do this in production.In production, provide the Certificate Authority (CA) certificate to Node.js via the NODE_EXTRA_CA_CERTS environment variable.3. Service Discovery & Recovery3.1 Symptom: Agent Doesn't Reconnect After Monitoring Server RestartsContext: The WebSocket connection is dropped, and the agent doesn't attempt to re-establish it, becoming a "ghost" agent.DiagnosisWebSocket close and error Events: Is the agent listening for these events? A server restart will trigger one of them.Reconnection Logic: Is there a reconnection strategy? Does it implement an exponential backoff to avoid hammering the server?SolutionImplement a Robust Reconnection Strategy:import WebSocket from 'ws';

let ws: WebSocket;
let reconnectInterval = 1000; // Start with 1 second

function connect() {
  ws = new WebSocket('ws://monitoring-server/ws');

  ws.on('open', () => {
    console.log('Connected to monitoring server.');
    reconnectInterval = 1000; // Reset backoff on successful connection
    // Send health check/registration payload
  });

  ws.on('close', (code, reason) => {
    console.warn(`WebSocket closed. Code: ${code}, Reason: ${reason}. Reconnecting...`);
    setTimeout(connect, reconnectInterval);
    reconnectInterval = Math.min(reconnectInterval * 2, 30000); // Exponential backoff up to 30s
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    // The 'close' event will be fired next, triggering reconnection.
  });
}

connect();
Health Checks: The monitoring server should have a simple HTTP endpoint (e.g., /healthz) that returns 200 OK. Agents can periodically ping this endpoint to verify server availability, especially if the WebSocket is silent.Graceful Shutdown: The server should have a graceful shutdown procedure where it notifies connected agents before closing connections.// On the server
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Notifying clients and shutting down.');
  wss.clients.forEach(client => {
    client.send(JSON.stringify({ type: 'server_shutdown', message: 'Server is restarting.' }));
    client.close();
  });
  // Close server, db connections, etc.
});
4. Log Correlation & Observability4.1 Symptom: Can't Trace a Request from Manager to Agent and BackContext: A user action triggers a workflow, but it's impossible to piece together the logs from different services to understand the entire lifecycle.DiagnosisLogging Format: Are logs unstructured strings? This makes them hard to parse and query.Correlation IDs: Is a unique ID generated at the start of the workflow and passed through every service call (REST, WebSocket message)?SolutionStructured Logging: Use a library like pino or winston to output JSON-formatted logs.// logger.ts
import pino from 'pino';
export const logger = pino({ level: 'info' });

// usage.ts
logger.info({ userId: 'user-123', action: 'spawn_agent' }, 'Spawning new agent');
Implement Correlation IDs:When a request first hits the Manager, generate a unique ID (e.g., a UUID).REST APIs: Pass it in a header (e.g., X-Request-ID).WebSocket Messages: Include it in the JSON payload of every message.Child Processes: Pass it as an environment variable or command-line argument.Logging: Include this correlationId in every single log entry related to that workflow.// Manager creating a workflow
import { v4 as uuidv4 } from 'uuid';
const correlationId = uuidv4();
logger.info({ correlationId, msg: 'Starting workflow' });

// Pass to worker agent via API call
apiClient.post('/execute', { data }, { headers: { 'X-Request-ID': correlationId } });

// Agent receives it and logs with it
const receivedId = req.headers['x-request-id'];
logger.info({ correlationId: receivedId, msg: 'Agent received task' });
Monitoring & Alerting:Use a log aggregation tool (Datadog, Grafana Loki, ELK Stack).Create dashboards to visualize agent activity, error rates, and performance.Set up alerts for high error rates, or for when a specific error message (e.g., deadlock detected) appears in the logs.5. Database & State Management Issues5.1 Symptom: PostgreSQL error: too many connections for roleContext: The application scales up, and the database rejects new connections because the connection pool limit has been reached.DiagnosisConnection Leaks: Is your code failing to release connections back to the pool after a query? This is common with unhandled exceptions in async/await blocks.Pool Size Misconfiguration: Is the max pool size in your client configuration (e.g., node-postgres, pg) too small for the number of concurrent agent processes? Or is it too large for what the PostgreSQL server allows?Long-Running Transactions: Are there transactions that are held open for too long, tying up a connection?SolutionCheck PostgreSQL Limits:SHOW max_connections;
Configure node-postgres (pg) Pool Correctly:import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Ensure clients are always released
async function queryDatabase(queryText: string, values: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query(queryText, values);
    return res.rows;
  } finally {
    // This is crucial. Always release the client.
    client.release();
  }
}
Detect Transaction Deadlocks (deadlock_detected):PostgreSQL will automatically abort one of the transactions involved in a deadlock.Your application code must be prepared to catch this specific error and retry the transaction.// Pseudocode for retrying a transaction
let retries = 3;
while (retries > 0) {
  try {
    await performTransaction();
    break; // Success
  } catch (err) {
    if (err.code === '40P01') { // PostgreSQL deadlock error code
      retries--;
      await new Promise(res => setTimeout(res, 100)); // Wait before retry
    } else {
      throw err; // Rethrow other errors
    }
  }
}
6. Container & Orchestration Debugging6.1 Symptom: Agent Process Killed Unexpectedly (OOMKilled)Context: In Kubernetes or Docker, the agent container stops with an exit code of 137.DiagnosisCheck Container Status:Kubernetes: kubectl describe pod <agent-pod-name>. Look for Reason: OOMKilled in the status.Docker: docker inspect <container_id>. Check the State section.Memory Leak: The agent process might have a memory leak, causing its usage to grow until it exceeds the container's memory limit.SolutionDetect Memory Leaks:Use Node.js's built-in heapdump library or the --inspect flag to take heap snapshots and analyze them with Chrome DevTools.# Start node with inspect flag
node --inspect your_agent_script.js

# Connect Chrome DevTools and use the Memory tab to take heap snapshots

# Compare snapshots over time to find detached objects that are not being garbage collected.

Increase Resources: As a temporary fix, you can increase the memory limit for the container in your Docker Compose or Kubernetes deployment YAML. This is not a substitute for fixing the leak.# kubernetes-deployment.yaml
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "512Mi" # Increase this limit
Cross-Platform File Path Handling:Symptom: Code that works on Linux fails on Windows (or vice versa) because of file path separators (/ vs \).Solution: Always use the path module to construct file paths. It automatically uses the correct separator for the host OS.import * as path from 'path';

// Bad: Hardcoded separator
const badPath = 'temp/workspaces/agent1';

// Good: Uses the correct separator for the OS
const goodPath = path.join('temp', 'workspaces', 'agent1');
console.log(goodPath); // 'temp/workspaces/agent1' on Linux, 'temp\workspaces\agent1' on Windows
Escalation & Rollback ProceduresEscalationLevel 1 (On-Call Engineer): Follow these playbooks to diagnose the issue. Check monitoring dashboards for anomalies (CPU, memory, DB connections).Level 2 (System Lead): If the issue is not resolved within 30 minutes or affects multiple clients, escalate. The lead can authorize more drastic measures like a full service restart or a database failover.Level 3 (Engineering Team): For persistent issues (e.g., suspected memory leaks, deadlocks), create a high-priority ticket with all collected logs, correlation IDs, and diagnostic information.RollbackIdentify the Deploy: Determine if the issue started after a recent deployment.Execute Rollback: Use your CI/CD system to redeploy the previous stable version of the affected service (Manager, Agent, etc.).Verify: Monitor the system to confirm that the rollback has resolved the issue.Post-Mortem: Analyze the faulty deployment to understand the root cause before attempting a new release.
