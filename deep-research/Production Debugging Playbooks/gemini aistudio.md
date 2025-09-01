# Production-Debugging-Playbooks.md

## Introduction

This document provides a series of "playbooks" for diagnosing and resolving common production issues encountered in AI Agent Systems, specifically those built with Node.js, TypeScript, WebSockets, and PostgreSQL. The focus is on a dual-agent monitoring system where agents spawn Claude processes and communicate via REST APIs and WebSockets.

Each playbook is structured in a `Symptom → Diagnosis → Solution` format to allow for rapid identification and resolution of problems under pressure.

---

## 1. Process Spawn Debugging

Debugging issues related to spawning external processes (like a Claude AI model) is critical for agent stability.

### Symptom: `Error: spawn EINVAL`

This error indicates that the arguments provided to the `child_process.spawn()` function are invalid. It's a common and often frustrating issue in cross-platform Node.js development.

**Diagnosis:**

* **Check Command and Arguments:** The most common cause is how the command and its arguments are passed. `spawn` expects the command as the first argument and an array of strings for the subsequent arguments.
* **Windows-Specific Issues:** On Windows, if you are trying to execute a script with an interpreter (e.g., `node my-script.js`), you should spawn `node` as the command and `['my-script.js']` as the arguments. If you are running a `.cmd` or `.bat` file, you might need to use the `{ shell: true }` option.
* **File Paths with Spaces:** If your executable path or arguments contain spaces, ensure they are correctly quoted or handled. While `spawn` often handles this better than `exec`, it can still be a source of problems.

**Solution:**

1. **Isolate the Command:** Try running the exact same command directly in your terminal (both on your development machine and the production server) to ensure it's valid and the executable is in the system's PATH.

2. **Use `{ shell: true }` on Windows (with caution):** If you are running shell-specific commands or batch files, enable the shell option.
   
   ```typescript
   import { spawn } from 'child_process';
   
   const options = process.platform === 'win32' ? { shell: true } : {};
   const child = spawn('my-command.cmd', ['arg1', 'arg2'], options);
   ```

3. **Cross-Platform Path Handling:** Use Node's built-in `path` module to construct file paths to ensure they work on both Windows and Linux.
   
   ```typescript
   import * as path from 'path';
   
   const scriptPath = path.join(__dirname, 'scripts', 'my-agent-script.js');
   const child = spawn('node', [scriptPath]);
   ```

### Symptom: `EACCES` Permission Errors when Spawning

The `EACCES` error means the user running the Node.js process does not have execute permissions for the file you are trying to spawn.

**Diagnosis:**

* **File Permissions:** Check the permissions of the target executable. On Linux/macOS, it needs the execute (`+x`) bit set.
* **User Context:** Verify which user the Node.js agent is running as. In containerized environments like Docker, it might be a non-root user with restricted permissions.

**Solution:**

1. **Check Permissions:**
   
   ```bash
   # On Linux/macOS
   ls -l /path/to/your/executable
   ```
2. **Grant Execute Permissions:**
   
   ```bash
   # On Linux/macOS
   chmod +x /path/to/your/executable
   ```
3. **Docker/Container Configuration:** In your `Dockerfile`, ensure you are setting the correct permissions on your script files, especially after copying them.
   
   ```dockerfile
   COPY ./my-script.sh /app/my-script.sh
   RUN chmod +x /app/my-script.sh
   ```

### Symptom: Zombie Processes Accumulating

Zombie processes are terminated child processes that haven't been properly cleaned up by the parent process. They consume process ID (PID) slots and can eventually prevent new processes from being created.

**Diagnosis:**

* **Listing Processes:** Use `ps aux | grep 'Z'` on Linux to list zombie processes.
* **Parent Process Behavior:** This usually happens when the parent Node.js process is not correctly handling the `exit` or `close` events of the child processes it spawns.

**Solution:**

1. **Proper Event Handling:** Always listen for the `exit` event on the child process to know when it has terminated.

2. **Graceful Shutdown Hooks:** Implement handlers for signals like `SIGINT` and `SIGTERM` in your main agent process to ensure it properly terminates its children before exiting.
   
   ```typescript
   const child = spawn('claude-process');
   
   child.on('exit', (code, signal) => {
     console.log(`Child process terminated with code ${code} and signal ${signal}`);
   });
   
   const cleanup = () => {
     console.log('Cleaning up child processes...');
     child.kill('SIGTERM');
     // Give the child a moment to exit gracefully before force killing
     setTimeout(() => {
       if (!child.killed) {
         child.kill('SIGKILL');
       }
       process.exit();
     }, 2000);
   };
   
   process.on('SIGINT', cleanup);
   process.on('SIGTERM', cleanup);
   ```

3. **Use a Process Manager:** Tools like `pm2` can help manage process lifecycles and automatically handle restarts and cleanup, which can mitigate zombie processes.

---

## 2. Network Integration Issues

Reliable network communication is vital for coordination between the Manager, Worker, and monitoring services.

### Symptom: `ReferenceError: fetch is not defined`

This error occurs when you try to use the `fetch` API in a Node.js environment where it is not natively available.

**Diagnosis:**

* **Node.js Version:** The `fetch` API was added as a stable, global feature in Node.js v18. If you are running an older version, `fetch` will not be defined.
* **Docker Base Image:** Your Docker container might be using an older base image (e.g., `node:16-alpine`), which doesn't include a new enough version of Node.js.

**Solution:**

1. **Upgrade Node.js:** The best solution is to upgrade your Node.js environment (and your Docker base image) to version 18 or newer.
   
   ```dockerfile
   # Use a modern Node.js version
   FROM node:20-alpine
   ```

2. **Use a Polyfill (for older versions):** If upgrading is not an option, you can use a library like `node-fetch`.
   
   ```bash
   npm install node-fetch
   ```
   
   ```typescript
   // For CommonJS
   const fetch = require('node-fetch');
   
   // For ES Modules (in newer versions of node-fetch)
   import fetch from 'node-fetch';
   ```

### Symptom: WebSocket Connections Randomly Drop

WebSockets are long-lived connections, making them susceptible to network interruptions, server restarts, and timeouts.

**Diagnosis:**

* **Check Server Logs:** Look for any errors or restart events on your WebSocket server at the time of the disconnect.
* **Network Instability:** Use tools like `ping` or `mtr` to check for packet loss or high latency between the agent and the server.
* **Idle Timeouts:** Proxies, load balancers, or even the server itself might be configured to close connections that are idle for too long.

**Solution:**

1. **Implement a Reconnection Strategy:** The client-side agent should automatically attempt to reconnect when a connection is lost, preferably with an exponential backoff strategy to avoid overwhelming the server.
   
   ```typescript
   // Simplified reconnect logic
   let ws;
   let reconnectInterval = 1000; // Start with 1 second
   
   function connect() {
     ws = new WebSocket('wss://your-monitoring-server.com');
   
     ws.onclose = () => {
       console.log('WebSocket disconnected. Attempting to reconnect...');
       setTimeout(connect, reconnectInterval);
       reconnectInterval = Math.min(reconnectInterval * 2, 30000); // Exponential backoff up to 30s
     };
   
     ws.onopen = () => {
       console.log('WebSocket connected!');
       reconnectInterval = 1000; // Reset interval on successful connection
     };
   }
   
   connect();
   ```

2. **Implement a Heartbeat (Ping/Pong):** To prevent idle timeouts, send a small "ping" message from the client to the server periodically. The server should respond with a "pong." If the client doesn't receive a pong within a certain time, it can assume the connection is dead and initiate a reconnect.

3. **Secure WebSockets (WSS):** Always use `wss://` for encrypted communication to prevent man-in-the-middle attacks.

---

## 3. Service Discovery & Recovery

Agents must be resilient to monitoring server restarts and other service interruptions.

### Symptom: Agents Do Not Reconnect After Monitoring Server Restarts

If the monitoring server goes down for a deployment or a crash, agents need to be able to re-establish their connection once it's back online.

**Diagnosis:**

* **Lack of Reconnect Logic:** The agent's WebSocket client lacks the logic to handle the `onclose` event and attempt to reconnect.
* **DNS Caching:** In containerized environments, stale DNS entries might point to an old, non-existent IP address for the server.

**Solution:**

1. **Robust Reconnect Logic:** Implement the exponential backoff reconnection strategy described in the "WebSocket Connection Drops" section.
2. **Health Checks:** The Manager Agent can have a simple health check endpoint (e.g., `/health`). The agent can periodically poll this endpoint via a standard HTTP request to quickly determine if the server is back online before attempting a full WebSocket reconnection.
3. **Kubernetes/Docker DNS:** Ensure your container orchestration is set up correctly. Services should be accessed via their service names (e.g., `http://monitoring-service:8080`), not static IP addresses. Kubernetes and Docker Compose handle the DNS resolution automatically.

### Symptom: Unclean Shutdowns Leading to State Inconsistency

When an agent process is abruptly killed (e.g., with `SIGKILL`), it doesn't have a chance to clean up resources, leading to orphaned processes or inconsistent state in the database.

**Diagnosis:**

* **Signal Handling:** The application is not listening for termination signals (`SIGINT` for Ctrl+C, `SIGTERM` from orchestrators like Docker and Kubernetes).
* **Orchestrator Configuration:** Your container orchestrator might not be waiting long enough for a graceful shutdown before sending `SIGKILL`.

**Solution:**

1. **Implement Graceful Shutdown Listeners:**
   
   ```typescript
   async function gracefulShutdown(signal: string) {
     console.log(`Received ${signal}. Shutting down gracefully.`);
   
     // 1. Stop accepting new work
     // 2. Close server connections (HTTP, WebSocket)
     // 3. Disconnect from the database
     await postgresPool.end();
   
     // 4. Terminate child processes
     // ...
   
     console.log('Cleanup complete. Exiting.');
     process.exit(0);
   }
   
   process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
   process.on('SIGINT', () => gracefulShutdown('SIGINT'));
   ```

2. **Configure `terminationGracePeriodSeconds` (Kubernetes):** In your Kubernetes deployment YAML, give your pods enough time to shut down cleanly.
   
   ```yaml
   spec:
     terminationGracePeriodSeconds: 60 # Default is 30
   ```

---

## 4. Log Correlation & Observability

Understanding the flow of a task across multiple agents and services is impossible without good observability.

### Symptom: Difficulty Tracing a Task Across Manager and Worker Agents

When an error occurs, it's hard to piece together the logs from different agents and processes to understand the full context of the operation.

**Diagnosis:**

* **Unstructured Logs:** Logs are simple strings without consistent formatting.
* **No Correlation ID:** There is no unique identifier that links all log entries related to a single task or request.

**Solution:**

1. **Implement Structured Logging:** Use a library like `pino` or `winston` to output logs in JSON format. This allows for easy parsing, filtering, and searching in a log aggregation tool.

2. **Generate and Propagate a Correlation ID:**
   
   * When the Manager Agent starts a new task, generate a unique ID (e.g., a UUID).
   * Include this `correlationId` in every log message related to that task.
   * Pass the `correlationId` to the Worker Agent along with the task payload.
   * The Worker Agent then uses this ID in its own logs.
     
     ```typescript
     // Manager Agent
     import { v4 as uuidv4 } from 'uuid';
     ```
   
   function startNewTask() {
     const correlationId = uuidv4();
     logger.info({ correlationId, task: '...'}, 'Starting new task');
     spawnWorker({ taskPayload: '...', correlationId });
   }
   
   // Worker Agent (receives correlationId in its input)
   logger.info({ correlationId, task: '...'}, 'Worker processing task');
   ```

3. **Use a Log Aggregation Platform:** Tools like Datadog, Splunk, or the ELK Stack can ingest these structured logs, allowing you to filter and view all logs for a specific `correlationId` in one place.

### Symptom: Agent Process Memory Leaks

The memory usage of a long-running agent process continually increases over time until it crashes or is terminated by the orchestrator (OOM Killer).

**Diagnosis:**

* **Monitoring:** Use a monitoring tool to graph the memory usage of your agent processes. A saw-tooth pattern is normal (memory goes up, then garbage collection drops it down). A steadily increasing floor is a sign of a leak.
* **Heap Snapshots:** Use Node.js's built-in inspector to take heap snapshots of the running process at different times and compare them to see which objects are not being garbage collected.

**Solution:**

1. **Enable the Inspector:** Run your Node.js process with the `--inspect` flag.
   
   ```bash
   node --inspect your-agent.js
   ```
2. **Connect Chrome DevTools:** Open Chrome and navigate to `chrome://inspect`. Your Node.js process should appear as a target.
3. **Take and Compare Heap Snapshots:**
   * Go to the "Memory" tab.
   * Take a heap snapshot.
   * Let the agent run for a while (and process some tasks).
   * Take another heap snapshot.
   * Use the "Comparison" view to see which objects have been allocated between the snapshots and are still in memory. Look for objects with a large positive "Size Delta". This often points to the source of the leak (e.g., unclosed connections, event listeners that are never removed).

---

## 5. Database & State Management Issues

State management, especially with a database like PostgreSQL, is a common source of production problems.

### Symptom: PostgreSQL "too many connections" Error

The application fails to connect to the database with an error like `FATAL: sorry, too many clients already` or `remaining connection slots are reserved for non-replication superuser connections`.

**Diagnosis:**

* **Connection Pool Exhaustion:** Your application's connection pool is smaller than the number of concurrent requests it's trying to handle, or connections are not being released back to the pool correctly.
* **Leaked Connections:** A code path exists where a client is acquired from the pool but is never released in case of an error.
* **Insufficient `max_connections`:** The `max_connections` setting in your PostgreSQL server is set too low for your workload.

**Solution:**

1. **Ensure Connections Are Always Released:** Use a `try...finally` block to guarantee that `client.release()` is called, even if an error occurs.
   
   ```typescript
   import { Pool } from 'pg';
   const pool = new Pool();
   
   async function queryDatabase() {
     const client = await pool.connect();
     try {
       const res = await client.query('SELECT NOW()');
       // ... do something with res
     } finally {
       // This will always be executed, whether the query succeeds or fails.
       client.release();
     }
   }
   ```

2. **Tune the Connection Pool Size:** The optimal pool size depends on your workload and database server capacity. A common starting point is around 10-20. Monitor your application to see if requests are frequently waiting for a connection.

3. **Use a Connection Pooler like PgBouncer:** For very high-concurrency applications, an external connection pooler like PgBouncer can manage a large number of client connections while maintaining a smaller, more efficient number of actual connections to the PostgreSQL server.

---

## 6. Container & Orchestration Debugging

Running agents in Docker and Kubernetes introduces its own layer of potential issues.

### Symptom: Agent Container is Repeatedly Killed and Restarted (OOMKilled)

In Kubernetes, you see a pod's status as `OOMKilled`. In Docker, the container might just exit with code 137. This means the process was killed by the operating system because it consumed more memory than was allocated.

**Diagnosis:**

* **Check Container Events:**
  
  ```bash
  # In Kubernetes
  kubectl describe pod <your-agent-pod-name>
  ```
  
  Look for the "Reason" field, which will state `OOMKilled`.
* **Memory Leak:** This is often a symptom of the memory leak issue described in section 4.
* **Insufficient Memory Limits:** The memory limit set for the container is simply too low for the agent's normal operation.

**Solution:**

1. **Debug for Memory Leaks:** Follow the playbook for "Agent Process Memory Leaks" using heap snapshots.
2. **Profile Memory Usage:** Run the agent under a realistic load in a staging environment and monitor its memory consumption to determine a reasonable memory limit.
3. **Increase Container Memory Limits:** In your Kubernetes deployment YAML or Docker Compose file, increase the memory limit.
   
   ```yaml
   # Kubernetes Deployment
   resources:
     limits:
       memory: "512Mi" # Increased from 256Mi
     requests:
       memory: "256Mi"
   ```
4. **Set Node.js Memory Limit:** Use the `--max-old-space-size` flag to control the V8 garbage collector's heap size. This can sometimes provide more predictable memory behavior.
   
   ```dockerfile
   # In your Dockerfile
   CMD [ "node", "--max-old-space-size=460", "your-agent.js" ]
   ```
   
   (The value should be slightly less than your container's memory limit).
