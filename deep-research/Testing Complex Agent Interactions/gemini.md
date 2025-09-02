# Testing-Complex-Agent-Interactions.md

Testing distributed AI agent systems presents a unique set of challenges. Unlike monolithic applications, agent systems involve asynchronous communication, concurrency, process management, and complex state coordination. A robust testing strategy must cover everything from individual agent logic in isolation to the emergent behavior of the entire system under stress and failure conditions.

This guide provides a comprehensive overview of testing strategies tailored for a Manager-Worker AI agent architecture, where agents communicate via WebSockets, spawn subprocesses (like Claude), and manage tasks involving database and file system interactions.

---

## Mock Agent Patterns

Unit and component testing are crucial for verifying the internal logic of an agent without the overhead and flakiness of its dependencies. Mocking is the primary technique to achieve this isolation.

### Key Concepts

- **Dependency Injection (DI)**: Design your agents to receive their dependencies (like a WebSocket client, a process spawner, or an API client) as constructor arguments. This makes it trivial to replace real implementations with mocks during tests.
    
- **Stubs & Mocks**:
    
    - A **Stub** provides canned responses to calls made during the test. For example, a stubbed API client always returns a successful response.
        
    - A **Mock** is a more sophisticated object that you can set expectations on. You can verify _how_ it was called (e.g., `expect(mockProcessSpawner).toHaveBeenCalledWith(...)`).
        
- **Simulating Responses**: Mocks can be configured to simulate various scenarios: successful responses, error states, slow responses (using `setTimeout`), or unexpected data formats to test the agent's resilience.
    

### Example: Testing a Manager Agent (Vitest)

Let's test a `Manager` agent whose job is to assign a task to a `Worker`. We'll mock the Worker client and the process spawner to test the Manager's logic in isolation.

**System Under Test: `Manager.js`**

JavaScript

```
// A simplified Manager agent
export class Manager {
  constructor(workerClient, processSpawner) {
    this.workerClient = workerClient;
    this.processSpawner = processSpawner;
  }

  async assignTask(task) {
    if (!this.workerClient.isConnected()) {
      throw new Error("Worker is not connected.");
    }
    
    // The manager might spawn a local helper process
    const helperProcess = this.processSpawner.spawn('node', ['helper.js']);
    if (!helperProcess) {
        throw new Error("Failed to spawn helper process.");
    }

    // Send task to the worker via WebSocket
    this.workerClient.send({ type: 'ASSIGN_TASK', payload: task });
    
    return { status: 'ASSIGNED', taskId: task.id };
  }
}
```

**Test File: `Manager.test.js`**

JavaScript

```
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Manager } from './Manager';

// Mock the dependencies
const mockWorkerClient = {
  isConnected: vi.fn(),
  send: vi.fn(),
};

const mockProcessSpawner = {
  spawn: vi.fn(),
};

describe('Manager Agent', () => {
  let manager;

  beforeEach(() => {
    // Reset mocks before each test
    vi.restoreAllMocks();
    // Create a new manager instance with injected mocks
    manager = new Manager(mockWorkerClient, mockProcessSpawner);
  });

  it('should assign a task to a connected worker', async () => {
    // Arrange: Configure the mocks
    const task = { id: 'task-123', description: 'Analyze data' };
    mockWorkerClient.isConnected.mockReturnValue(true);
    mockProcessSpawner.spawn.mockReturnValue({ pid: 456 }); // Simulate a successful spawn

    // Act: Call the method being tested
    const result = await manager.assignTask(task);

    // Assert: Verify the outcome and interactions
    expect(result.status).toBe('ASSIGNED');
    expect(mockProcessSpawner.spawn).toHaveBeenCalledWith('node', ['helper.js']);
    expect(mockWorkerClient.send).toHaveBeenCalledWith({
      type: 'ASSIGN_TASK',
      payload: task,
    });
  });

  it('should throw an error if the worker is not connected', async () => {
    // Arrange
    const task = { id: 'task-123', description: 'Analyze data' };
    mockWorkerClient.isConnected.mockReturnValue(false);

    // Act & Assert
    await expect(manager.assignTask(task)).rejects.toThrow("Worker is not connected.");
    expect(mockWorkerClient.send).not.toHaveBeenCalled();
  });
  
  it('should throw an error if the helper process fails to spawn', async () => {
    // Arrange
    const task = { id: 'task-123', description: 'Analyze data' };
    mockWorkerClient.isConnected.mockReturnValue(true);
    mockProcessSpawner.spawn.mockReturnValue(null); // Simulate a failed spawn

    // Act & Assert
    await expect(manager.assignTask(task)).rejects.toThrow("Failed to spawn helper process.");
  });
});
```

---

## Integration Testing Strategies

Integration tests verify that different parts of the system work together correctly. For our agent system, this means testing the full workflow: Manager, Worker, WebSockets, PostgreSQL database, and the file system. 🧪

### Key Concepts

- **Test Environment Orchestration**: Use tools like **Docker Compose** to create an isolated, reproducible environment containing all the necessary services (your application, a database, etc.). This ensures tests run consistently everywhere.
    
- **Real Dependencies**: Unlike unit tests, integration tests should use real services (e.g., a real PostgreSQL database, not an in-memory substitute) to catch issues related to specific database versions or configurations.
    
- **Test Lifecycle**: Tests should be self-contained. Each test should:
    
    1. **Setup**: Seed the database and create necessary files.
        
    2. **Execute**: Run the test scenario.
        
    3. **Assert**: Check the final state (in the DB, file system, etc.).
        
    4. **Teardown**: Clean up the database and file system to avoid affecting other tests.
        

### Example: End-to-End Task Workflow (Jest + Docker)

This test will verify that a Manager can assign a task, a Worker can pick it up, perform a file operation, update a database record, and report completion.

**1. Docker Compose for Testing: `docker-compose.test.yml`**

YAML

```
version: '3.8'
services:
  postgres_test:
    image: postgres:15
    environment:
      - POSTGRES_USER=testuser
      - POSTGRES_PASSWORD=testpass
      - POSTGRES_DB=testdb
    ports:
      - "5433:5432" # Use a different host port to avoid conflicts
    volumes:
      - ./init-test-db.sql:/docker-entrypoint-initdb.d/init.sql

  manager_app_test:
    build: .
    command: npm run start:manager -- --env=test
    depends_on:
      - postgres_test
    environment:
      - DATABASE_URL=postgresql://testuser:testpass@postgres_test:5432/testdb
      - WEBSOCKET_PORT=8080
    ports:
      - "8080:8080"
    volumes:
      - ./agent_workspace_test:/app/workspace # Mount a test workspace

  worker_app_test:
    build: .
    command: npm run start:worker -- --env=test
    depends_on:
      - manager_app_test
    environment:
      - MANAGER_URL=ws://manager_app_test:8080
    volumes:
      - ./agent_workspace_test:/app/workspace
```

**2. Integration Test File: `full_workflow.e2e.test.js`**

JavaScript

```
import { WebSocket } from 'ws';
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

// Test configuration
const MANAGER_URL = 'ws://localhost:8080';
const DB_CONFIG = {
  connectionString: 'postgresql://testuser:testpass@localhost:5433/testdb',
};
const WORKSPACE_DIR = path.join(__dirname, 'agent_workspace_test');

describe('Full Manager-Worker Workflow', () => {
  let dbPool;
  let wsClient;

  // Setup connection before all tests
  beforeAll(async () => {
    dbPool = new Pool(DB_CONFIG);
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  });

  // Teardown connections and cleanup after all tests
  afterAll(async () => {
    await dbPool.end();
    await fs.rm(WORKSPACE_DIR, { recursive: true, force: true });
  });

  // Clean the database before each test
  beforeEach(async () => {
    await dbPool.query('TRUNCATE TABLE tasks RESTART IDENTITY;');
  });

  it('should process a task from assignment to completion', async () => {
    // Arrange: Insert a task record to be processed
    const taskDescription = 'Create a report file.';
    const insertedTask = await dbPool.query(
      "INSERT INTO tasks (description, status) VALUES ($1, 'PENDING') RETURNING id;",
      [taskDescription]
    );
    const taskId = insertedTask.rows[0].id;
    const expectedFilePath = path.join(WORKSPACE_DIR, `report_${taskId}.txt`);

    // Act: Use a WebSocket client to mimic an external trigger telling the Manager to start
    wsClient = new WebSocket(MANAGER_URL);

    // Promise to resolve when the worker reports completion
    const completionPromise = new Promise((resolve) => {
      wsClient.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'TASK_COMPLETED' && message.payload.taskId === taskId) {
          resolve(message);
        }
      });
    });

    await new Promise(resolve => wsClient.on('open', resolve));
    
    // Trigger the Manager to assign the task
    wsClient.send(JSON.stringify({ type: 'PROCESS_TASK', payload: { taskId } }));

    // Wait for the completion message or timeout
    await completionPromise;

    // Assert: Verify the final state
    // 1. Check the database
    const dbResult = await dbPool.query("SELECT status FROM tasks WHERE id = $1;", [taskId]);
    expect(dbResult.rows[0].status).toBe('COMPLETED');

    // 2. Check the file system
    const fileContent = await fs.readFile(expectedFilePath, 'utf-8');
    expect(fileContent).toContain('Report for task');
    
    wsClient.close();
  }, 20000); // Increase timeout for E2E tests
});
```

---

## Race Condition Testing

Race conditions and deadlocks are common in concurrent systems. These tests aim to expose timing-related bugs by putting the system under concurrent load or by controlling the execution order of operations.

### Key Concepts

- **Stress Testing**: Initiate many actions simultaneously to increase the likelihood of concurrent operations overlapping in problematic ways.
    
- **Property-Based Testing**: Instead of testing with fixed inputs, you define properties that should always hold true (e.g., "a task ID is never assigned to two workers at once"). A library like `fast-check` then generates hundreds of random scenarios to try and violate that property.
    
- **Deadlock Detection**: Occurs when two or more agents are waiting for each other to release a resource. Testing for this often involves analyzing system states after a stress test fails to complete or times out.
    
- **Message Ordering**: For workflows that depend on a specific sequence of messages, tests should verify that messages are processed in the correct order, even when multiple agents are communicating at once.
    

### Example: Testing Concurrent Task Assignments

This test simulates multiple clients requesting the Manager to process tasks at the exact same time. We want to ensure that each task is assigned only once and that the final state is consistent.

JavaScript

```
import { Pool } from 'pg';

// ... (re-use db config from previous example)

describe('Manager Concurrent Operations', () => {
  let dbPool;

  beforeAll(() => { dbPool = new Pool(DB_CONFIG); });
  afterAll(() => { dbPool.end(); });
  beforeEach(async () => {
    await dbPool.query('TRUNCATE TABLE tasks RESTART IDENTITY;');
    await dbPool.query('TRUNCATE TABLE worker_assignments RESTART IDENTITY;');
  });

  it('should handle concurrent task assignments without duplication', async () => {
    // Arrange: Create 10 pending tasks in the database
    const numTasks = 10;
    const taskIds = [];
    for (let i = 0; i < numTasks; i++) {
      const res = await dbPool.query(
        "INSERT INTO tasks (description, status) VALUES ($1, 'PENDING') RETURNING id;",
        [`Task ${i}`]
      );
      taskIds.push(res.rows[0].id);
    }

    // Act: Simulate 10 clients concurrently asking the Manager to assign these tasks.
    // In a real test, this would involve 10 WebSocket clients.
    // Here, we simulate the Manager's internal assignment logic being called concurrently.
    const assignmentPromises = taskIds.map(id => yourApp.manager.assignAvailableTask(id));

    await Promise.all(assignmentPromises);

    // Assert: Verify data consistency
    // 1. Check that each task is assigned
    const assignments = await dbPool.query('SELECT task_id FROM worker_assignments;');
    expect(assignments.rows.length).toBe(numTasks);

    // 2. Check that no task is assigned more than once
    const uniqueAssignedTaskIds = new Set(assignments.rows.map(r => r.task_id));
    expect(uniqueAssignedTaskIds.size).toBe(numTasks);

    // 3. Check that all tasks are now in 'ASSIGNED' status
    const taskStatuses = await dbPool.query("SELECT COUNT(*) FROM tasks WHERE status = 'ASSIGNED';");
    expect(parseInt(taskStatuses.rows[0].count, 10)).toBe(numTasks);
  }, 30000);
});
```

---

## Chaos Engineering for Agents

Chaos engineering is the practice of intentionally injecting failures into a system to test its resilience and recovery capabilities. For an agent system, this is critical for building a truly robust, self-healing architecture. 💥

### Key Concepts

- **Failure Injection**: Deliberately and automatically trigger failures like:
    
    - Killing an agent's process.
        
    - Dropping WebSocket connections.
        
    - Simulating network latency or partitions (using tools like `toxiproxy`).
        
    - Making the database or an external API unavailable.
        
    - Inducing high memory or CPU usage.
        
- **Steady-State Hypothesis**: Define what it means for your system to be "healthy" (e.g., "tasks are eventually processed within 5 minutes"). Your chaos experiment should verify that the system returns to this steady state after a failure.
    
- **Blast Radius**: Start with small, controlled experiments (e.g., affecting a single test worker) and gradually expand the scope as you gain confidence.
    

### Example Scenario: Worker Process Crash Recovery

This test verifies that if a Worker agent crashes mid-task, the Manager detects the failure (e.g., via WebSocket disconnection or a timeout) and correctly re-assigns the task to another available Worker.

**Conceptual Test Flow (to be implemented with custom scripting):**

1. **Setup**:
    
    - Start the Manager and two Worker agents (Worker A and Worker B) in a test environment.
        
    - Create a task in the database with status `PENDING`.
        
2. **Execute & Inject Chaos**:
    
    - Trigger the Manager to assign the task. It gets assigned to Worker A.
        
    - Verify the task status is updated to `ASSIGNED` to Worker A.
        
    - **Chaos Injection**: Identify the process ID (PID) of Worker A and forcefully kill it (`kill -9 <PID>`).
        
3. **Observe & Verify**:
    
    - Monitor the Manager's logs or state. The Manager should detect the disconnection of Worker A.
        
    - The Manager's recovery logic should trigger. It should change the crashed task's status back to `PENDING` or directly re-assign it.
        
    - Eventually, the Manager should assign the task to the still-running Worker B.
        
    - Wait for Worker B to complete the task.
        
4. **Assert**:
    
    - Verify the final task status in the database is `COMPLETED`.
        
    - Check the assignment history to confirm the task was assigned first to A, then to B.
        
    - Ensure the system has returned to a stable state.
        

---

## Performance & Load Testing

Performance testing ensures your agent system can handle the expected workload efficiently. Load testing pushes the system beyond its expected limits to identify bottlenecks and determine its maximum capacity. 📈

### Key Concepts

- **Metrics**: Identify Key Performance Indicators (KPIs), such as:
    
    - **Task Throughput**: Number of tasks completed per minute.
        
    - **Agent Response Time**: Time from task assignment to completion.
        
    - **Resource Utilization**: CPU, memory, and network I/O of each agent process.
        
- **Tooling**: Use specialized tools like **k6**, **Artillery**, or **JMeter** to simulate hundreds or thousands of concurrent clients/agents.
    
- **Bottleneck Analysis**: Monitor all components (agents, database, network) during a load test to see what maxes out first. This is your primary bottleneck.
    
- **Regression Testing**: Automate performance tests in your CI pipeline to catch performance degradations early.
    

### Example: k6 Load Test Script

This script simulates a workload of clients connecting to the Manager via WebSockets and requesting tasks.

**`load-test.js`**

JavaScript

```
import ws from 'k6/ws';
import { check } from 'k6';

// k6 options
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 virtual users over 30s
    { duration: '1m', target: 50 },  // Stay at 50 users for 1 minute
    { duration: '10s', target: 0 },   // Ramp down
  ],
  thresholds: {
    // We want 95% of task processing to complete within 2 seconds.
    'task_processing_duration': ['p(95)<2000'],
  },
};

export default function () {
  const url = 'ws://localhost:8080/test-endpoint'; // Your manager's WebSocket URL
  const params = { tags: { my_ws_tag: 'k6-test' } };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      // Create a new task ID for each virtual user
      const taskId = __VU; 
      
      // Send a message to the manager to start a task
      socket.setInterval(function timeout() {
        socket.send(JSON.stringify({ type: 'PROCESS_TASK', payload: { taskId } }));
      }, 5000); // Each user asks for a task every 5 seconds
    });
    
    // You could listen for completion messages here to measure duration
    socket.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'TASK_COMPLETED') {
            // k6 doesn't have a direct way to record custom metrics from async events
            // but you can log it or use external outputs.
            console.log(`Task ${message.payload.taskId} completed.`);
        }
    });

    socket.on('close', () => {
      // console.log('disconnected');
    });

    socket.setTimeout(function () {
      socket.close();
    }, 60000); // Keep the connection open for 60 seconds
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
```

---

## Test Data Management

Good tests require good data. Managing the state, configuration, and data required for your agent tests is critical for creating reliable and meaningful test suites.

### Key Concepts

- **Factories**: Use factory functions or libraries (like `faker-js`) to programmatically generate realistic test data (e.g., complex task objects, user profiles). This makes tests more readable and easier to maintain than using static fixtures.
    
- **Database Seeding**: Before a test run, populate your test database with a known set of data. This can be done with custom scripts or migration tools (e.g., `knex seed`, Prisma seeds).
    
- **Fixture Management**: For tests involving the file system, have a clear strategy for creating and cleaning up test files and directories. Use a dedicated temporary directory for each test run.
    
- **Configuration Management**: Use environment variables (`.env` files) or configuration files to manage settings for different test environments (e.g., database connection strings, API keys).
    

### Example: Task Factory and Database Seeder

**`task.factory.js`**

JavaScript

```
import { faker } from '@faker-js/faker';

export function createTaskData(overrides = {}) {
  return {
    description: faker.lorem.sentence(),
    priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH']),
    status: 'PENDING',
    payload: {
        sourceUrl: faker.internet.url(),
    },
    ...overrides,
  };
}
```

**Using the factory in a test:**

JavaScript

```
import { createTaskData } from './task.factory';

it('should process a high priority task first', () => {
    const lowPriorityTask = createTaskData({ priority: 'LOW' });
    const highPriorityTask = createTaskData({ priority: 'HIGH' });

    // ... test logic to insert and process these tasks
});
```

**Database Seeding Script (using `knex`):**

JavaScript

```
// seeds/01_initial_tasks.js
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('tasks').del();
  
  // Inserts seed entries
  await knex('tasks').insert([
    { description: 'A pre-seeded low priority task', status: 'PENDING', priority: 'LOW' },
    { description: 'A pre-seeded high priority task', status: 'PENDING', priority: 'HIGH' },
  ]);
};
```

---

## Continuous Integration Patterns

Continuous Integration (CI) automates the process of building, testing, and integrating code changes. A solid CI pipeline is the backbone of a reliable testing strategy. 🚀

### Key Concepts

- **Pipeline as Code**: Define your CI pipeline in a configuration file (e.g., `.github/workflows/ci.yml`) that is versioned with your source code.
    
- **Multi-Stage Pipeline**: Structure your pipeline into logical stages:
    
    1. **Lint & Static Analysis**: Catch code style issues fast.
        
    2. **Unit Tests**: Run quick, isolated tests.
        
    3. **Integration Tests**: Spin up services (like a database) and run end-to-end tests.
        
    4. **Build & Deploy**: (If all tests pass).
        
- **Parallel Execution**: Run tests in parallel to speed up the pipeline. CI platforms support this through matrix strategies or parallel job configurations.
    
- **Flaky Test Mitigation**: Flaky tests (that pass and fail intermittently) can destroy trust in your pipeline. Actively monitor for them and either fix, quarantine, or remove them.
    
- **Reporting**: Configure your CI job to publish test results and code coverage reports.
    

### Example: GitHub Actions Workflow

This workflow runs on every push to `main` or any pull request. It runs linting, unit tests, and integration tests (using Docker Compose) in separate jobs.

**`.github/workflows/ci.yml`**

YAML

```
name: CI for Agent System

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  lint-and-unit-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run linter
        run: npm run lint
      - name: Run unit tests
        run: npm run test:unit

  integration-test:
    runs-on: ubuntu-latest
    needs: lint-and-unit-test # This job runs only if the previous one succeeds
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Use Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Start services (Postgres & App)
        run: docker-compose -f docker-compose.test.yml up -d
      - name: Wait for services to be healthy
        run: |
          # A simple wait script. For production, use a tool like docker-compose-wait.
          echo "Waiting for PostgreSQL..."
          while ! docker exec $(docker-compose -f docker-compose.test.yml ps -q postgres_test) pg_isready -U testuser -d testdb; do
            sleep 1
          done
          echo "PostgreSQL is ready."
          sleep 5 # Give the app a moment to start
      - name: Run integration tests
        run: npm run test:e2e
      - name: Stop services
        if: always() # Always run this step, even if tests fail
        run: docker-compose -f docker-compose.test.yml down
```

---

## Appendix

### Debugging Strategies for Failed Tests

- **Verbose Logging**: Add detailed, contextual logs with unique request/task IDs. In a failed CI run, these logs are your primary source of information.
    
- **Node.js Inspector**: Run tests locally with the `--inspect-brk` flag (`node --inspect-brk ./node_modules/.bin/vitest`) to attach a debugger like the one in Chrome DevTools.
    
- **Capture Artifacts**: In CI, if a test fails, configure the pipeline to save artifacts like log files, screenshots (for UI tests), or database dumps for later analysis.
    
- **Isolate and Replicate**: Try to run the single failing test file locally (`vitest path/to/failing.test.js`). If it only fails in CI, it's likely an environmental difference (timing, resource constraints, etc.).
    

### Test Maintenance and Refactoring

- **DRY Principle (Don't Repeat Yourself)**: Create shared utility functions for common test operations (e.g., `setupTestDatabase()`, `createTestWebSocketClient()`).
    
- **Descriptive Naming**: A test named `it('should reassign task if worker disconnects unexpectedly')` is far more useful than `it('handles errors')`.
    
- **Group by Feature**: Organize your tests in a directory structure that mirrors your application's feature structure.
    
- **Refactor Tests with Code**: When you refactor application code, refactor the corresponding tests at the same time. Tests are first-class citizens of your codebase.