# Agent Coordination Patterns for AI Systems

This document provides a comprehensive overview of coordination patterns, communication protocols, and failure recovery strategies for building robust multi-agent AI systems, with a specific focus on the **Manager-Worker architecture**.

In this model, a **Manager Agent** handles high-level strategic planning, task decomposition, and result validation, while one or more **Worker Agents** execute the specific, well-defined tasks assigned to them. This separation of concerns is critical for building scalable and maintainable AI systems.

## 1. Coordination Patterns & Strategies

Choosing the right coordination pattern is fundamental to your system's efficiency and complexity. It dictates how the Manager and Worker agents interact and process tasks.

### Sequential vs. Parallel vs. Hybrid Coordination

This choice depends on task dependencies.

- **Sequential Coordination**: Tasks are executed one after another. This is simple and ideal for workflows where each step depends on the previous one (e.g., fetch data -> process data -> save data).

- **Parallel Coordination**: Multiple tasks are executed simultaneously by different workers. This is best for independent tasks, dramatically improving throughput (e.g., processing multiple images at once).

- **Hybrid Coordination**: A combination of both. A common pattern is a "fork-join" where the Manager spawns multiple parallel workers and then waits for all of them to complete before proceeding to the next sequential step.

#### Decision Tree for Coordination Models 🌳

```
graph TD
    A{Are tasks dependent?} -->|Yes| B(Use Sequential Coordination);
    A -->|No| C{Can tasks be broken down into smaller, independent units?};
    C -->|Yes| D(Use Parallel Coordination);
    C -->|No| E{Does the workflow have both dependent and independent stages?};
    E -->|Yes| F(Use Hybrid Coordination e.g., Fork-Join);
    E -->|No| B;
```

### Event-Driven vs. Polling-Based Communication

This choice affects system latency and resource usage.

- **Event-Driven**: The Manager pushes tasks to workers as they become available. Workers notify the Manager upon completion. This is highly efficient, low-latency, and resource-friendly. **This is the recommended approach.**

- **Polling-Based**: The Manager periodically checks a task queue, and workers periodically check for new tasks. This is simpler to implement but introduces latency and consumes more resources due to constant checking.

### State Machine Patterns

A finite state machine (FSM) is an excellent way to manage an agent's lifecycle or a complex task workflow. Each agent or task transitions through well-defined states (e.g., `PENDING`, `RUNNING`, `VALIDATING`, `COMPLETED`, `FAILED`). This makes the system's logic explicit and easier to debug.

**Example States for a Worker Task:**

- `TASK_RECEIVED`

- `EXECUTING_LOGIC`

- `AWAITING_VALIDATION`

- `TASK_SUCCESSFUL`

- `TASK_FAILED`

Libraries like **XState** in JavaScript can help formally define and manage these states.

```
// Conceptual example with XState
import { createMachine } from 'xstate';

const workerTaskMachine = createMachine({
  id: 'workerTask',
  initial: 'pending',
  states: {
    pending: { on: { START: 'running' } },
    running: { on: { VALIDATE: 'validating', FAIL: 'failed' } },
    validating: { on: { PASS: 'completed', FAIL: 'failed' } },
    completed: { type: 'final' },
    failed: { on: { RETRY: 'running' } }
  }
});
```

### Consensus Algorithms & Load Balancing

- **Consensus**: If you have multiple Manager agents to avoid a single point of failure, you might need a consensus algorithm (like a simplified **Raft** or **Paxos**) to agree on the state of tasks. For most Manager-Worker systems, this is overkill but good to know for hyper-scalable designs.

- **Load Balancing**: When you have multiple identical workers, the Manager must distribute tasks efficiently.
  
  - **Round Robin**: Simple and effective for tasks of similar complexity.
  
  - **Least Connections**: Assigns tasks to the worker with the fewest active jobs. Ideal for tasks with varying completion times.

## 2. Communication Protocols

The communication protocol is the nervous system of your agent architecture.

### Message Queuing

Using a message broker like **Redis** or **RabbitMQ** decouples the Manager from the Workers. The Manager publishes a "task" message to a queue, and available workers consume from it. This is highly scalable and resilient.

- **Pros**: Decoupling, scalability, persistence, load balancing.

- **Cons**: Adds an external dependency.

#### TypeScript Example with Redis Pub/Sub

```
// Manager.ts
import { createClient } from 'redis';
const publisher = createClient();
await publisher.connect();

function assignTask(workerId: string, task: any) {
  console.log(`Publishing task for worker: ${workerId}`);
  publisher.publish(`tasks:${workerId}`, JSON.stringify(task));
}

// Worker.ts
import { createClient } from 'redis';
const subscriber = createClient();
await subscriber.connect();
const workerId = 'worker-01';

subscriber.subscribe(`tasks:${workerId}`, (message) => {
  console.log(`Received task:`, JSON.parse(message));
  // ... execute task
});
```

### Other Key Communication Patterns

- **Command/Query Responsibility Segregation (CQRS)**: A natural fit for Manager-Worker.
  
  - **Commands**: Manager sends commands (`execute_code`, `analyze_data`) which change the system's state.
  
  - **Queries**: Manager sends queries (`get_status`, `fetch_results`) which read the state without changing it.

- **Event Sourcing**: Instead of storing the current state, store the sequence of events that led to it. This provides a full audit log of all agent interactions, which is invaluable for debugging and recovery.

- **Publish-Subscribe (Pub/Sub)**: The Manager can publish events (e.g., `NEW_PROJECT_GOAL`) to a topic, and multiple agents (workers, loggers, monitors) can subscribe to it.

- **Request-Response vs. Fire-and-Forget**:
  
  - **Request-Response**: The Manager sends a task and waits for a direct response. Simpler, but can block the Manager.
  
  - **Fire-and-Forget**: The Manager sends a task and immediately moves on, expecting a notification later (e.g., via Pub/Sub) when the task is done. More scalable and non-blocking.

## 3. Failure Mode Recovery

Robust systems anticipate and handle failures gracefully. 💥

### Timeout and Retry with Exponential Backoff

If a worker is unresponsive, don't retry immediately. Implement a retry strategy with an increasing delay to avoid overwhelming a struggling service.

```
async function attemptWithRetries<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoffFactor = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    console.warn(`Attempt failed. Retrying in ${delay}ms...`);
    await new Promise(res => setTimeout(res, delay));
    return attemptWithRetries(fn, retries - 1, delay * backoffFactor, backoffFactor);
  }
}
```

### Circuit Breaker Pattern

If a worker repeatedly fails, the Manager should temporarily stop sending it tasks. The "circuit is open." After a cool-down period, the Manager can try sending a single "probe" task. If it succeeds, the circuit closes, and normal operation resumes. This prevents a failing worker from bringing down the entire system. Libraries like `opossum` can implement this in Node.js.

### Other Recovery Patterns

- **Dead Letter Queues (DLQ)**: In a message queuing system, if a message (task) fails to be processed by a worker after several retries, it's moved to a DLQ. This allows you to inspect and manually handle failed tasks without blocking the main queue.

- **Graceful Degradation**: If a specific type of worker is unavailable (e.g., an image processing worker), the system can continue functioning by disabling that feature, rather than crashing entirely.

- **State Recovery**: Persist the state of the Manager and tasks (e.g., in Redis, a database, or a file). If the Manager process crashes, it can restart, load its previous state, and resume from where it left off, preventing data loss.

## 4. Quality Gate Templates

Quality gates are automated checkpoints to ensure a worker's output meets specific criteria before a task is marked as complete.

### Conceptual Quality Gate Workflow

1. **Manager**: Assigns task with acceptance criteria (e.g., "Code must pass linting and all unit tests").

2. **Worker**: Completes the primary task.

3. **Worker**: Runs the validation steps defined in the acceptance criteria.

4. **Worker**: Submits the output *and* the validation results to the Manager.

5. **Manager**: Verifies the validation results. If they pass, the task is complete. If not, it's rejected.

#### Example: AI Code Review Gate

- **Trigger**: A worker agent submits new code.

- **Process**:
  
  1. The Manager triggers a "Code Review Gate."
  
  2. It spawns another Claude instance (or uses a dedicated review agent) with a specific prompt: "You are a senior software engineer. Review the following code for bugs, style violations, and performance issues. Provide your feedback in JSON format."
  
  3. The Manager parses the JSON feedback. If critical issues are found, it sends the code back to the original worker with the feedback for revision.

#### Other Gate Examples

- **Test Validation**: Worker runs `npm test` and submits the test report. The gate fails if any tests fail.

- **Security Validation**: Worker runs a tool like `npm audit` or `snyk`. The gate fails if high-severity vulnerabilities are found.

- **Performance Benchmarking**: Worker runs a benchmark script and compares the results against a predefined threshold (e.g., "response time must be < 100ms").

## 5. Real-World Implementation Examples (Node.js/TypeScript)

Here's how to manage agent processes in a Node.js environment.

### Process Spawning and Management

The `child_process` module is your primary tool. Use `spawn` over `exec` for long-running processes, as it streams I/O and is more memory-efficient.

```
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const workerScript = path.join(__dirname, 'worker.js');
const worker = spawn('node', [workerScript]);

// Listen for output from the worker
worker.stdout.on('data', (data) => {
  console.log(`WORKER STDOUT: ${data}`);
});

worker.stderr.on('data', (data) => {
  console.error(`WORKER STDERR: ${data}`);
});

// Listen for the worker process to exit
worker.on('close', (code) => {
  console.log(`Worker process exited with code ${code}`);
});

// Send a task to the worker via stdin
worker.stdin.write(JSON.stringify({ task: 'process_data' }) + '\n');

// Clean up on exit
process.on('exit', () => {
    console.log('Manager shutting down. Terminating worker...');
    worker.kill(); // Ensure worker is killed when manager exits
});
```

### Inter-Process Communication (IPC)

While `stdio` (stdin/stdout) is simple, it can be limiting.

- **Built-in IPC**: When spawning a Node.js child, you can use the `ipc` option for a dedicated communication channel (`worker.send()`, `process.on('message')`).

- **WebSockets**: Excellent for real-time, bidirectional communication between decoupled processes, even across different machines.

- **HTTP/REST**: A standard, stateless way for agents to communicate, especially in a microservices-style architecture.

## 6. Specific Implementation Details

### Handling `spawn` Errors

When `spawn` fails, it emits an `error` event. You **must** listen for it to prevent unhandled exceptions.

```
const worker = spawn('non_existent_command', []);

worker.on('error', (err) => {
  // @ts-ignore
  switch (err.code) {
    case 'ENOENT':
      console.error('Error: Command not found. Is the worker path correct and executable?');
      break;
    case 'EACCES':
      console.error('Error: Permission denied. Check file permissions for the worker script.');
      break;
    case 'EINVAL':
      console.error('Error: Invalid argument. Check the arguments passed to spawn.');
      break;
    default:
      console.error('An unknown spawn error occurred:', err);
  }
});
```

### Windows vs. Linux Compatibility

- **Paths**: Always use `path.join()` instead of manually concatenating paths with `/` or `\`.

- **Shell Commands**: Avoid shell-specific commands (`ls`, `grep`). If you must, use a library like `shelljs` or check `process.platform` to execute different commands.

- **Shebangs**: On Linux/macOS, `#!/usr/bin/env node` at the top of your script makes it directly executable. This doesn't work on Windows, so always invoke scripts with `node your-script.js`.

### Memory Leak Prevention in Long-Running Agents

- **Event Listeners**: Be very careful with `emitter.on()`. If you add listeners but never remove them, you will create a memory leak. Use `emitter.once()` for one-time events or manually call `emitter.removeListener()` when done.

- **Streams**: Always handle stream errors and ensure they are properly closed/destroyed to release underlying resources.

- **Global Objects**: Avoid storing large amounts of data in global variables or long-lived objects.

- **Monitoring**: Use tools like `process.memoryUsage()` or external monitoring services to track memory consumption over time.

### WebSocket Connection Pooling

For frequent communication, creating a new WebSocket connection for every message is inefficient. A connection pool manages a set of pre-established connections.

**Conceptual Pool Logic:**

1. When a message needs to be sent, request a connection from the pool.

2. If an idle connection is available, use it.

3. If not, and the pool is not at its max size, create a new connection.

4. If the pool is full, wait for a connection to be released.

5. After sending the message, release the connection back to the pool instead of closing it.

```
// Simplified conceptual WebSocket pool
class WebSocketPool {
  private connections: WebSocket[] = [];
  private maxConnections = 10;
  // ... implementation for acquiring and releasing connections
}
```

## 7. Troubleshooting Common Issues

- **Zombie Processes**: If the Manager crashes without killing its children, worker processes can become "zombies." Ensure you have robust cleanup logic using `process.on('exit', ...)` or by running your agents under a process manager like `pm2`.

- **IPC Deadlocks**: A Manager waits for a Worker, which in turn waits for the Manager. This can happen with complex request-response cycles. Favor non-blocking, event-driven communication.

- **IPC Hangs**: Data sent over `stdio` or IPC can be buffered. Ensure you are properly flushing streams or using protocols that handle message framing (like newline-delimited JSON).

## 8. Conclusion

The Manager-Worker architecture is a powerful paradigm for building complex AI systems. By carefully selecting coordination patterns, communication protocols, and failure recovery strategies, you can create a system that is not only intelligent but also **scalable, resilient, and maintainable**.

The key is to start with simple patterns like sequential coordination and `stdio` communication, and then introduce more complex, decoupled patterns like message queues and parallel processing as your system's needs evolve. Always prioritize **explicitness** in your logic (via state machines) and **robustness** in your operations (via error handling and recovery patterns).

## 9. References

- **Academic Papers**:
  
  - [An Introduction to MultiAgent Systems](https://www.google.com/search?q=https://www.cs.ox.ac.uk/people/michael.wooldridge/pubs/mas-book-2nd-edition/mas-book-ch1.pdf "null") by Michael Wooldridge.
  
  - [A Survey of BDI-based Agent Programming Languages](https://www.google.com/search?q=https://link.springer.com/chapter/10.1007/978-3-642-11311-6_5 "null") (for understanding agent belief-desire-intention models).

- **Industry Implementations & Articles**:
  
  - [The Twelve-Factor App](https://12factor.net/ "null"): Principles for building robust software-as-a-service apps, highly relevant to agent-based systems.
  
  - [Martin Fowler's articles on Microservices](https://martinfowler.com/articles/microservices.html "null"): Many patterns from microservices (like CQRS, Event Sourcing, Circuit Breaker) are directly applicable to multi-agent systems.

- **Node.js Libraries**:
  
  - [XState](https://xstate.js.org/ "null"): For state machine management.
  
  - [PM2](https://pm2.keymetrics.io/ "null"): A production process manager for Node.js applications.
  
  - [Opossum](https://github.com/nodeshift/opossum "null"): Circuit breaker implementation for Node.js.
  
  - [Redis](https://redis.io/ "null"): In-memory data store, often used as a message broker.
