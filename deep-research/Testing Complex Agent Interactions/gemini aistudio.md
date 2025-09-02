# Testing-Complex-Agent-Interactions.md

## Introduction

Testing AI agent systems, especially complex Manager-Worker architectures, presents unique challenges beyond traditional software testing. The asynchronous nature of agent communication, the non-determinism of AI model responses, and the tight coupling with external systems (processes, APIs, databases) require a multi-layered and robust testing strategy.

This document outlines a comprehensive approach to testing these systems, from isolated unit tests using mocks to full-scale chaos engineering designed to validate resilience. The goal is to build confidence in the system's coordination logic, reliability, and performance.

We will use a "testing pyramid" approach, adapted for agent systems:

*   **Unit Tests (Fast & Focused):** Test the internal logic of a single agent in isolation.
*   **Integration Tests (Realistic & Thorough):** Test how multiple agents and services (database, WebSocket server) collaborate.
*   **End-to-End (E2E) & Chaos Tests (Resilience-Focused):** Test the entire system under realistic and failure conditions.

---

## 1. Mock Agent Patterns (Unit & Component Testing)

The foundation of the pyramid is testing individual agents in complete isolation. This is the fastest and most efficient way to validate core business logic. The key enabler for this is **Dependency Injection (DI)**.

**Core Principle:** An agent should not create its own dependencies (like API clients or process spawners). Instead, they should be provided (injected) during its construction.

```typescript
// Un-testable design
class ManagerAgent {
  private wsClient: WebSocketClient;
  constructor() {
    this.wsClient = new WebSocketClient("ws://worker-service");
  }
}

// Testable design using Dependency Injection
class ManagerAgent {
  private wsClient: IWebSocketClient; // IWebSocketClient is an interface
  constructor(wsClient: IWebSocketClient) {
    this.wsClient = wsClient;
  }
}
```

### Mocking Process Spawning (`child_process`)

To test an agent's ability to manage spawned processes (like a Claude instance) without actually spawning one, we can mock the `child_process` module.

**Scenario:** Testing a Worker agent that spawns a script and reports its output.

```typescript
// worker.agent.ts
import { spawn } from 'child_process';

export class WorkerAgent {
  runTask(scriptPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('node', [scriptPath]);
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }
}
```

**Test with Vitest/Jest:**

```typescript
// worker.agent.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { WorkerAgent } from './worker.agent';

// Mock the entire 'child_process' module
vi.mock('child_process');

describe('WorkerAgent', () => {
  const mockSpawn = vi.mocked(spawn);
  const mockProcess = new EventEmitter() as any;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure our mock is returned on every call to spawn
    mockSpawn.mockReturnValue(mockProcess);
  });

  it('should resolve with stdout data on successful process completion', async () => {
    const worker = new WorkerAgent();
    const taskPromise = worker.runTask('test.js');

    // Simulate the spawned process emitting data and closing successfully
    mockProcess.stdout.emit('data', 'Success');
    mockProcess.emit('close', 0);

    await expect(taskPromise).resolves.toBe('Success');
    expect(mockSpawn).toHaveBeenCalledWith('node', ['test.js']);
  });

  it('should reject if the process exits with a non-zero code', async () => {
    const worker = new WorkerAgent();
    const taskPromise = worker.runTask('test.js');

    // Simulate the process closing with an error code
    mockProcess.emit('close', 1);

    await expect(taskPromise).rejects.toThrow('Process exited with code 1');
  });
});
```

### Stubbing External API Calls

Use a library like **`nock`** to intercept HTTP requests and return canned responses. This is essential for testing interactions with services like the Claude API without making real network calls.

```typescript
import nock from 'nock';

it('Manager should correctly handle API responses from Claude', async () => {
  // Intercept any POST request to the Claude API
  nock('https://api.anthropic.com')
    .post('/v1/messages')
    .reply(200, {
      id: 'msg_123',
      content: [{ type: 'text', text: 'Task breakdown complete.' }],
    });
    
  const manager = new ManagerAgent(new ClaudeApiClient());
  const response = await manager.getTaskPlan("Build a web app");
  
  expect(response).toBe('Task breakdown complete.');
});
```

---

## 2. Integration Testing Strategies

Integration tests verify that different parts of the system work together correctly. The best way to manage the required services (database, message broker) is with **Docker Compose**.

**`docker-compose.test.yml`:**

```yaml
version: '3.8'
services:
  postgres_test:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=test
      - POSTGRES_PASSWORD=test
      - POSTGRES_DB=test
    ports:
      - '5433:5432' # Use a different port to avoid conflicts with local dev DB
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d test"]
      interval: 5s
      timeout: 5s
      retries: 5

  manager_agent_test:
    build: ./manager-agent
    depends_on:
      postgres_test:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgres://test:test@postgres_test:5432/test
      # ... other env vars
```

**Workflow for Integration Tests:**
1.  **Start Services:** Before running tests, launch the environment with `docker-compose -f docker-compose.test.yml up -d`.
2.  **Run Migrations:** Use a tool like `node-pg-migrate` to apply the latest database schema.
3.  **Run Tests:** Execute the integration test suite against the running services.
4.  **Teardown:** After tests complete, stop and remove the containers with `docker-compose -f docker-compose.test.yml down`.

### Testing a Full Manager-Worker Workflow

**Scenario:** Manager assigns a task via a WebSocket message, the Worker picks it up, executes it, and the Manager verifies the result in the database.

```typescript
// manager-worker.integration.test.ts
import { ManagerAgent } from '../manager/agent';
import { WorkerAgent } from '../worker/agent';
import { WebSocketServer } from 'ws';
import { Client } from 'pg';

describe('Manager-Worker Integration', () => {
  let dbClient: Client;
  let wss: WebSocketServer;

  beforeAll(async () => {
    // Start WebSocket server and connect to test DB
    wss = new WebSocketServer({ port: 8081 });
    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();
  });

  beforeEach(async () => {
    // Clean database before each test to ensure isolation
    await dbClient.query('TRUNCATE TABLE tasks CASCADE');
  });
  
  afterAll(async () => {
    wss.close();
    await dbClient.end();
  });

  it('should complete a task from assignment to database confirmation', async () => {
    const manager = new ManagerAgent({ dbClient, wsUrl: 'ws://localhost:8081' });
    
    // The worker connects to the central WebSocket server
    const worker = new WorkerAgent({ wsUrl: 'ws://localhost:8081' });
    await worker.connect();
    
    const taskId = await manager.assignTask({ type: 'file_write', content: 'hello' });
    
    // Wait for the workflow to complete
    await new Promise(resolve => setTimeout(resolve, 500)); 

    const { rows } = await dbClient.query('SELECT status FROM tasks WHERE id = $1', [taskId]);
    expect(rows[0].status).toBe('COMPLETED');
  });
});
```

---

## 3. Race Condition & Concurrency Testing

These bugs are notoriously hard to find because they depend on timing.

*   **Stress Testing:** The simplest approach is to trigger many actions concurrently and check for an inconsistent final state.
    ```typescript
    it('should handle 20 concurrent task assignments without data corruption', async () => {
      const assignmentPromises = [];
      for (let i = 0; i < 20; i++) {
        assignmentPromises.push(manager.assignTask({ type: 'increment_counter' }));
      }
      
      await Promise.all(assignmentPromises);

      // Wait for all workers to finish
      await new Promise(resolve => setTimeout(resolve, 2000)); 

      const { rows } = await dbClient.query('SELECT value FROM counters WHERE id = 1');
      // If the final value is not 20, there's a race condition in the update logic
      expect(rows[0].value).toBe(20);
    });
    ```
*   **Property-Based Testing:** Use libraries like **`fast-check`** to test properties that should always hold true, regardless of the input or timing. For example: "A task, once completed, can never revert to a 'pending' state."

---

## 4. Chaos Engineering for Agents

Chaos engineering proactively tests system resilience by injecting real-world failures.

**Key Tool: `ToxiProxy`**
`ToxiProxy` is a proxy that simulates network failures. You can run it in your Docker Compose setup and route traffic through it.

**`docker-compose.test.yml` (with ToxiProxy):**
```yaml
services:
  postgres_test: ...
  toxiproxy:
    image: ghcr.io/shopify/toxiproxy:2.5.0
    ports:
      - '8474:8474' # API port for controlling toxics
  manager_agent_test:
    environment:
      # Agent connects to the proxy, not the DB directly
      - DATABASE_URL=postgres://test:test@toxiproxy:21222/test
    ...
```

**Scenario:** Test agent recovery from a database connection failure.

```typescript
import Toxiproxy, { Toxic } from 'toxiproxy-node-client';

const toxiproxy = new Toxiproxy('http://localhost:8474');

it('Manager agent should recover and reconnect after a database outage', async () => {
  const proxy = await toxiproxy.createProxy('postgres_proxy', 'postgres_test:5432', '21222');
  
  // 1. Verify normal operation
  expect(await manager.getHealthStatus()).toBe('HEALTHY');

  // 2. Inject failure: make the database completely unavailable
  await proxy.addToxic('db_down', 'latency', '', 1, { latency: 100000, jitter: 0 });

  // 3. Assert that the agent enters a degraded state
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(await manager.getHealthStatus()).toBe('DEGRADED_DB_UNAVAILABLE');

  // 4. Remove the failure
  await proxy.removeToxic('db_down');

  // 5. Assert that the agent recovers
  await new Promise(resolve => setTimeout(resolve, 5000)); // Give time for reconnect logic
  expect(await manager.getHealthStatus()).toBe('HEALTHY');

  await proxy.delete();
});
```

**Other Chaos Scenarios:**
*   **Process Kill:** Use `docker kill <worker-container-id>` and verify the Manager re-assigns the task.
*   **Network Partition:** Use ToxiProxy to cut the connection between the agent and the WebSocket server, then test reconnection logic.

---

## 5. Performance & Load Testing

*   **Tools:** Use `k6`, `Artillery`, or `autocannon` for load testing.
*   **Memory Leak Detection:**
    1.  Run your agent with the `--inspect` flag.
    2.  Run a sustained load test for 30-60 minutes.
    3.  Use Chrome DevTools (`chrome://inspect`) to connect to the Node.js process.
    4.  Take heap snapshots at the beginning, middle, and end of the test.
    5.  Compare the snapshots. If the memory usage consistently grows and never comes down after garbage collection, you have a leak.

---

## 6. Continuous Integration Patterns (GitHub Actions)

Automate your testing pipeline to run on every commit.

**`.github/workflows/ci.yml`:**
```yaml
name: CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit # Runs tests that don't need external services

  integration-tests:
    runs-on: ubuntu-latest
    # Define services needed for this job
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        options: >-
          --health-cmd "pg_isready -U test -d test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      - run: npm ci
      - name: Run Migrations
        # The postgres service is available on localhost inside the runner
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test
        run: npm run migrate
      - name: Run Integration Tests
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test
        run: npm run test:integration
```