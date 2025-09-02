Markdown

````
# TypeScript-Agent-System-Patterns.md

This document provides a comprehensive guide to design patterns for building AI Agent Systems using TypeScript. The focus is on leveraging TypeScript's powerful type system to create applications that are **type-safe**, **maintainable**, and have **robust error handling**. These patterns are particularly crucial in multi-agent systems where complex interactions and data flows are common.

---

## 1. Message Type Systems

Reliable agent communication is the backbone of any multi-agent system. A strongly-typed message system prevents a wide class of runtime errors, simplifies debugging, and serves as living documentation for inter-agent protocols.

### Strongly-Typed Protocols with Discriminated Unions

A **discriminated union** is the most effective pattern for modeling different message types. Each message object has a common literal property (e.g., `type`) that TypeScript can use to narrow down the object's shape within a `switch` statement or conditional block.

**Before: Unsafe string-based types**
```typescript
// Unsafe, easy to misspell payload properties, no type checking
function handleMessage(message: { type: string, payload: any }) {
    if (message.type === 'task_start') {
        console.log(message.payload.taskId); // any, no autocomplete
    }
}
````

**After: Type-Safe Discriminated Union**

TypeScript

```
// Define each specific message type
type StartTaskMessage = {
    type: 'TASK_START';
    payload: {
        taskId: string;
        prompt: string;
    };
};

type TaskProgressMessage = {
    type: 'TASK_PROGRESS';
    payload: {
        taskId: string;
        percentComplete: number;
    };
};

type TaskCompleteMessage = {
    type: 'TASK_COMPLETE';
    payload: {
        taskId: string;
        result: string;
    };
};

// Create the union of all possible messages
export type AgentMessage = StartTaskMessage | TaskProgressMessage | TaskCompleteMessage;

// The handler is now fully type-safe
function handleMessage(message: AgentMessage) {
    console.log(`Received message type: ${message.type}`);
    switch (message.type) {
        case 'TASK_START':
            // TypeScript knows message is StartTaskMessage here
            console.log(`Starting task ${message.payload.taskId}`);
            console.log(`Prompt: ${message.payload.prompt}`);
            break;

        case 'TASK_PROGRESS':
            // TypeScript knows message is TaskProgressMessage here
            console.log(`Task ${message.payload.taskId} is ${message.payload.percentComplete}% complete.`);
            break;

        case 'TASK_COMPLETE':
            // TypeScript knows message is TaskCompleteMessage here
            console.log(`Task ${message.payload.taskId} finished.`);
            console.log(`Result: ${message.payload.result}`);
            break;

        default:
            // Ensures we handle all message types
            const _exhaustiveCheck: never = message;
            return _exhaustiveCheck;
    }
}
```

### Generic Message Envelope Pattern

For system-level concerns like message routing, tracing, or metadata, a generic envelope can wrap the core message.

TypeScript

```
export type MessageEnvelope<T extends AgentMessage> = {
    messageId: string; // Unique ID for tracing
    senderId: string;  // ID of the sending agent
    receiverId: string; // ID of the receiving agent
    timestamp: number;
    traceId?: string; // For distributed tracing
    payload: T;
};

// Example of creating an enveloped message
const startTaskMessage: StartTaskMessage = {
    type: 'TASK_START',
    payload: { taskId: 'abc-123', prompt: 'Summarize the document.' },
};

const envelope: MessageEnvelope<StartTaskMessage> = {
    messageId: 'uuid-v4-string',
    senderId: 'AgentA',
    receiverId: 'AgentB',
    timestamp: Date.now(),
    payload: startTaskMessage,
};
```

### Serialization and Runtime Validation

TypeScript types are erased at runtime. When receiving data from an external source (like a WebSocket, API, or message queue), you must validate it to ensure it conforms to your types. Libraries like **Zod** are perfect for this.

TypeScript

```
import { z } from 'zod';

// Define Zod schemas that correspond to your types
const StartTaskMessageSchema = z.object({
    type: z.literal('TASK_START'),
    payload: z.object({
        taskId: z.string().uuid(),
        prompt: z.string().min(10),
    }),
});

const TaskProgressMessageSchema = z.object({
    type: z.literal('TASK_PROGRESS'),
    payload: z.object({
        taskId: z.string().uuid(),
        percentComplete: z.number().min(0).max(100),
    }),
});

// Create a discriminated union schema
const AgentMessageSchema = z.discriminatedUnion('type', [
    StartTaskMessageSchema,
    TaskProgressMessageSchema,
    // ... other message schemas
]);

// Infer the TypeScript type from the schema
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

// Function to safely parse an incoming message
function parseMessage(unknownData: unknown): AgentMessage | null {
    const result = AgentMessageSchema.safeParse(unknownData);
    if (!result.success) {
        console.error("Invalid message format:", result.error.flatten());
        return null;
    }
    return result.data;
}

// Usage with an incoming WebSocket message
// ws.on('message', (data: string) => {
//     const messageObject = JSON.parse(data);
//     const validatedMessage = parseMessage(messageObject);
//     if (validatedMessage) {
//         handleMessage(validatedMessage);
//     }
// });
```

### WebSocket Message Typing (`socket.io`)

Libraries like `socket.io` allow you to strongly type your client-server events.

TypeScript

```
import { Server, Socket } from 'socket.io';
import { AgentMessage } from './messageTypes'; // From previous example

// Define events from Server to Client
interface ServerToClientEvents {
    agentMessage: (message: AgentMessage) => void;
    systemNotification: (data: { message: string }) => void;
}

// Define events from Client to Server
interface ClientToServerEvents {
    agentMessage: (message: AgentMessage) => void;
}

// You can also type internal server events and socket data
interface InterServerEvents {}
interface SocketData {
    agentId: string;
    // other session data
}

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>();

io.on('connection', (socket) => {
    console.log(`Agent connected: ${socket.data.agentId}`);

    // Fully type-safe listener
    socket.on('agentMessage', (message) => {
        // Here, 'message' is guaranteed to be of type AgentMessage
        // (assuming the client sends valid data, which should be validated)
        console.log(`Received message from ${socket.data.agentId}:`, message);
        
        // Fully type-safe emitter
        socket.broadcast.emit('agentMessage', message);
    });
});
```

---

## 2. Error Handling Patterns

Robust error handling prevents agent failures from cascading and crashing the entire system. Explicit, type-safe error handling is superior to relying solely on `try/catch` blocks.

### `Result<T, E>` Pattern vs. Exceptions

Instead of throwing exceptions, functions can return a `Result` type, which explicitly forces the caller to handle both success and failure cases. This is common in languages like Rust.

TypeScript

```
// Generic Result and Error types
export type Result<T, E extends Error> = { ok: true; value: T } | { ok: false; error: E };

// Helper functions
export const ok = <T, E extends Error>(value: T): Result<T, E> => ({ ok: true, value });
export const err = <T, E extends Error>(error: E): Result<T, E> => ({ ok: false, error });

// Define specific error classes
class ApiError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.name = 'ApiError';
    }
}

class ValidationError extends Error {
    constructor(message: string, public readonly fields: string[]) {
        super(message);
        this.name = 'ValidationError';
    }
}

// Union of all possible errors for a specific operation
type ProcessingError = ApiError | ValidationError;

// A function that returns a Result instead of throwing
async function processData(data: unknown): Promise<Result<string, ProcessingError>> {
    if (typeof data !== 'string' || data.length < 1) {
        return err(new ValidationError('Input data cannot be empty', ['data']));
    }
    
    try {
        const response = await fetch('[https://api.example.com/process](https://api.example.com/process)', {
            method: 'POST',
            body: data,
        });
        if (!response.ok) {
            return err(new ApiError(`API failed with status ${response.status}`, response.status));
        }
        return ok(await response.text());
    } catch (e) {
        return err(new ApiError('Network request failed', 503));
    }
}

// The caller MUST handle both cases, enforced by the type system
async function handleProcessing() {
    const result = await processData("some data");
    if (result.ok) {
        console.log("Success:", result.value);
    } else {
        // TypeScript knows `result.error` is of type ProcessingError
        console.error("Failure:", result.error.message);
        if (result.error instanceof ValidationError) {
            console.error("Invalid fields:", result.error.fields);
        }
    }
}
```

### Error Boundary Pattern for Agent Failures

Inspired by React's error boundaries, you can create a higher-order function or a class that wraps an agent's core logic, catching and managing failures without crashing the agent process.

TypeScript

```
import { Result, err } from './result'; // From previous example

type AgentAction<T, E extends Error> = () => Promise<Result<T, E>>;

class AgentErrorBoundary<T, E extends Error> {
    constructor(private readonly action: AgentAction<T, E>) {}

    public async execute(): Promise<Result<T, E>> {
        try {
            return await this.action();
        } catch (e: unknown) {
            // Catch unexpected runtime errors (not handled by the Result pattern)
            const unexpectedError = (e instanceof Error ? e : new Error(String(e))) as E;
            console.error("Caught unexpected error in boundary:", unexpectedError);
            return err(unexpectedError);
        }
    }
}

// Example Agent action
async function myRiskyAgentTask(): Promise<Result<string, Error>> {
    // This function might throw an unexpected error
    if (Math.random() > 0.5) {
        throw new Error("Something went horribly wrong!");
    }
    return ok("Task completed successfully");
}

// Wrap the action in a boundary
const boundary = new AgentErrorBoundary(myRiskyAgentTask);
const result = await boundary.execute();

if (!result.ok) {
    // Gracefully handle the contained failure
    console.log("Agent action failed but was caught by the boundary:", result.error.message);
}
```

### Generic Retry Mechanisms with Type Safety

Combine error handling with a generic retry utility to make agents more resilient to transient failures.

TypeScript

```
import { Result, ok, err } from './result';

type RetryableFunction<T, E extends Error> = () => Promise<Result<T, E>>;

interface RetryOptions {
    retries: number;
    delayMs: number;
    // A predicate to decide if an error is worth retrying
    shouldRetry?: (error: Error) => boolean;
}

export async function withRetry<T, E extends Error>(
    fn: RetryableFunction<T, E>,
    options: RetryOptions
): Promise<Result<T, E>> {
    let lastError: E | undefined;
    for (let i = 0; i < options.retries; i++) {
        const result = await fn();
        if (result.ok) {
            return ok(result.value);
        }

        lastError = result.error;
        const shouldRetry = options.shouldRetry ? options.shouldRetry(lastError) : true;
        
        if (!shouldRetry) {
             console.log(`Error is not retryable: ${lastError.name}`);
             return err(lastError);
        }

        console.log(`Attempt ${i + 1} failed. Retrying in ${options.delayMs}ms...`);
        await new Promise(res => setTimeout(res, options.delayMs));
    }
    return err(lastError!);
}

// Usage
class ApiError extends Error { name = 'ApiError'; }
class NetworkError extends Error { name = 'NetworkError'; }

let attempt = 0;
const flakyApiCall = async (): Promise<Result<string, ApiError | NetworkError>> => {
    attempt++;
    console.log(`Calling API, attempt #${attempt}`);
    if (attempt < 3) {
        return err(new NetworkError("Connection timed out"));
    }
    return ok("Data received!");
};

// Only retry on NetworkError, not other ApiErrors
const result = await withRetry(flakyApiCall, {
    retries: 5,
    delayMs: 1000,
    shouldRetry: (e) => e instanceof NetworkError
});

if (result.ok) {
    console.log("Success after retries:", result.value);
} else {
    console.error("Failed after all retries:", result.error.message);
}
```

---

## 3. Generic Agent Interfaces

A well-defined set of interfaces and abstract classes allows for polymorphism, promotes code reuse, and makes the system extensible.

### Abstract Base Classes and Interface Segregation

Use an `abstract class` for shared implementation details and `interfaces` for capabilities (following the Interface Segregation Principle).

TypeScript

```
// Interface for the core agent lifecycle
export interface IAgent {
    readonly id: string;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): 'running' | 'stopped' | 'error';
}

// Interface for agents that can communicate
export interface ICommunicator<T> {
    sendMessage(message: T): Promise<void>;
    onMessage(handler: (message: T) => void): void;
}

// Abstract base class providing common functionality
export abstract class BaseAgent implements IAgent {
    public readonly id: string;
    protected status: 'running' | 'stopped' | 'error' = 'stopped';

    constructor(id: string) {
        this.id = id;
    }

    getStatus() {
        return this.status;
    }
    
    async start(): Promise<void> {
        console.log(`Agent ${this.id} starting...`);
        this.status = 'running';
        await this.onStart();
    }

    async stop(): Promise<void> {
        console.log(`Agent ${this.id} stopping...`);
        this.status = 'stopped';
        await this.onStop();
    }
    
    // Methods for subclasses to implement
    protected abstract onStart(): Promise<void>;
    protected abstract onStop(): Promise<void>;
}

// Concrete implementation of a processing agent
import { AgentMessage } from './messageTypes';

export class ProcessingAgent extends BaseAgent implements ICommunicator<AgentMessage> {
    constructor(id: string) {
        super(id);
    }

    sendMessage(message: AgentMessage): Promise<void> {
        // Implementation for sending a message
        console.log(`Agent ${this.id} is sending a message:`, message);
        return Promise.resolve();
    }

    onMessage(handler: (message: AgentMessage) => void): void {
        // Implementation for listening to messages
        console.log(`Agent ${this.id} is now listening for messages.`);
    }

    protected async onStart(): Promise<void> {
        console.log("ProcessingAgent specific start logic.");
    }

    protected async onStop(): Promise<void> {
        console.log("ProcessingAgent specific stop logic.");
    }
}
```

### Dependency Injection (DI) for Agent Services

Instead of agents creating their own dependencies (like loggers, database connections, or API clients), inject them. This improves testability and decouples the agent from concrete implementations.

TypeScript

```
// Define service interfaces
export interface ILogger {
    info(message: string): void;
    error(message: string, error?: Error): void;
}

export interface IApiClient {
    post<T>(url: string, body: any): Promise<T>;
}

// Agent class with constructor injection
export class SmartAgent extends BaseAgent {
    constructor(
        id: string,
        private readonly logger: ILogger, // Injected dependency
        private readonly apiClient: IApiClient, // Injected dependency
    ) {
        super(id);
    }
    
    protected async onStart(): Promise<void> {
        this.logger.info(`SmartAgent ${this.id} has started.`);
    }
    
    protected async onStop(): Promise<void> {
        this.logger.info(`SmartAgent ${this.id} has stopped.`);
    }
    
    public async doWork(prompt: string): Promise<void> {
        try {
            const result = await this.apiClient.post('/generate', { prompt });
            this.logger.info(`Received API result: ${JSON.stringify(result)}`);
        } catch (e) {
            this.logger.error("Failed to do work", e as Error);
        }
    }
}
```

### Factory Patterns for Agent Creation

A factory can encapsulate the complex logic of creating and configuring different agent types.

TypeScript

```
// Concrete services
class ConsoleLogger implements ILogger { /* ... */ }
class FetchApiClient implements IApiClient { /* ... */ }

type AgentType = 'processing' | 'smart';

export class AgentFactory {
    // A simple factory method
    public static createAgent(type: AgentType, id: string): IAgent {
        const logger = new ConsoleLogger();
        const apiClient = new FetchApiClient();
        
        switch (type) {
            case 'processing':
                return new ProcessingAgent(id);
            case 'smart':
                return new SmartAgent(id, logger, apiClient);
            default:
                throw new Error(`Unknown agent type: ${type}`);
        }
    }
}

// Usage
const agent1 = AgentFactory.createAgent('smart', 'alpha-agent');
agent1.start();
```

---

## 4. Configuration & Validation

Misconfiguration is a common source of bugs. Validating configuration at startup and providing strong types throughout the application is essential.

### Runtime Validation with Zod

Zod allows you to define a schema for your configuration, parse environment variables or config files, and get a fully typed object.

TypeScript

```
import { z } from 'zod';

// 1. Define the schema for your configuration
const AgentConfigSchema = z.object({
    AGENT_ID: z.string().min(1),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    API_ENDPOINT: z.string().url(),
    API_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    FEATURE_FLAG_BETA: z
        .string()
        .transform((val) => val === 'true')
        .default('false'),
});

// 2. Infer the TypeScript type from the schema
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// 3. Create a function to load and validate the config
export function loadConfig(env: NodeJS.ProcessEnv): AgentConfig {
    const result = AgentConfigSchema.safeParse(env);

    if (!result.success) {
        console.error("❌ Invalid application configuration:");
        // Provides detailed error messages for each invalid field
        console.error(result.error.flatten().fieldErrors);
        process.exit(1);
    }
    
    console.log("✅ Configuration loaded and validated successfully.");
    return result.data;
}

// 4. Usage (typically at the start of your application)
// import { loadConfig } from './config';
// const config = loadConfig(process.env);
//
// function main() {
//   // 'config' is now a fully typed object
//   console.log(`Agent ID: ${config.AGENT_ID}`);
//   console.log(`API Timeout: ${config.API_TIMEOUT_MS}`);
// }
```

---

## 5. State Management Patterns

Agents are inherently stateful. Managing this state in a predictable and type-safe manner is key to avoiding bugs.

### State Machines with XState

For agents with complex lifecycles or behaviors (e.g., `idle`, `processing`, `waiting_for_input`, `error`), a state machine is an excellent pattern. **XState** provides a type-safe way to define and execute state machines in TypeScript.

TypeScript

```
import { createMachine, interpret } from 'xstate';

// Define the machine's context (its extended state)
interface AgentContext {
    taskId?: string;
    errorMessage?: string;
}

// Define the events that can be sent to the machine
type AgentEvent =
    | { type: 'START_TASK'; taskId: string }
    | { type: 'TASK_SUCCEEDED' }
    | { type: 'TASK_FAILED'; reason: string }
    | { type: 'RESET' };

// Create the state machine with full type safety
const agentMachine = createMachine({
    // Typegen is an XState feature for generating precise types
    tsTypes: {} as import("./agent-machine.typegen").Typegen0,
    schema: {
        context: {} as AgentContext,
        events: {} as AgentEvent,
    },
    id: 'agent',
    initial: 'idle',
    context: {
        taskId: undefined,
        errorMessage: undefined,
    },
    states: {
        idle: {
            on: {
                START_TASK: {
                    target: 'processing',
                    actions: ['assignTask'],
                },
            },
        },
        processing: {
            // Invoke an async operation (like an API call)
            invoke: {
                id: 'processTask',
                src: 'processTaskService',
                onDone: 'idle',
                onError: {
                    target: 'error',
                    actions: ['assignError'],
                },
            },
        },
        error: {
            on: {
                RESET: 'idle',
            },
        },
    },
}, {
    actions: {
        assignTask: (context, event) => {
            context.taskId = event.taskId;
        },
        assignError: (context, event) => {
            // event.data is the error from the invoked service
            context.errorMessage = (event.data as Error).message;
        }
    },
    services: {
        processTaskService: (context, event) => {
            // This is where your agent's core logic goes
            console.log(`Processing task: ${context.taskId}`);
            return new Promise((resolve, reject) => {
                // Simulate async work
                setTimeout(() => {
                    if (Math.random() > 0.5) reject(new Error("API failed"));
                    else resolve("Success");
                }, 1000);
            });
        }
    }
});

// To use the machine:
// const agentService = interpret(agentMachine).onTransition((state) => {
//     console.log('Current state:', state.value);
// });
// agentService.start();
// agentService.send({ type: 'START_TASK', taskId: 'abc-123' });
```

### Immutable State with Immer

When an agent's state is a complex object, updating it immutably prevents side effects and makes state changes easier to reason about. **Immer** simplifies this process.

**Before: Manual, error-prone state updates**

TypeScript

```
interface AgentState {
    tasks: { [id: string]: { status: string; history: string[] } };
    active: boolean;
}

function updateTaskStatus(state: AgentState, taskId: string, newStatus: string): AgentState {
    return {
        ...state,
        tasks: {
            ...state.tasks,
            [taskId]: {
                ...state.tasks[taskId],
                status: newStatus,
                history: [...state.tasks[taskId].history, `Status changed to ${newStatus}`],
            },
        },
    };
}
```

**After: Simple, direct mutations with Immer**

TypeScript

```
import produce from 'immer';

const state: AgentState = { tasks: { 'abc': { status: 'running', history: [] } }, active: true };

const nextState = produce(state, draft => {
    // Write code that looks mutable, but Immer handles immutability
    draft.tasks['abc'].status = 'completed';
    draft.tasks['abc'].history.push('Status changed to completed');
});

// `state` remains unchanged, `nextState` is the new state
```

---

## 6. Testing & Mocking Patterns

TypeScript's static typing makes testing more robust by allowing you to create type-safe mocks and test fixtures.

### Mock Agent Interface Implementations

Using Dependency Injection, you can easily provide mock implementations of services for your tests.

TypeScript

```
import { ILogger, IApiClient } from './interfaces'; // From section 3
import { SmartAgent } from './agent';
import { vi, test, expect } from 'vitest'; // Using Vitest testing framework

// Create a mock implementation of the ILogger interface
const mockLogger: ILogger = {
    info: vi.fn(),
    error: vi.fn(),
};

// Create a mock API client
const mockApiClient: IApiClient = {
    post: vi.fn(),
};

test('SmartAgent should call logger and api client on doWork', async () => {
    // Reset mocks before each test
    vi.mocked(mockLogger.info).mockClear();
    vi.mocked(mockApiClient.post).mockClear();
    
    // Inject the mock dependencies
    const agent = new SmartAgent('test-agent', mockLogger, mockApiClient);

    // Set up mock return value for the API call
    vi.mocked(mockApiClient.post).mockResolvedValue({ success: true, data: "mocked result" });

    // Execute the method under test
    await agent.doWork("test prompt");

    // Assert that the mocks were called correctly
    expect(mockLogger.info).toHaveBeenCalledWith('Received API result: {"success":true,"data":"mocked result"}');
    expect(mockApiClient.post).toHaveBeenCalledWith('/generate', { prompt: 'test prompt' });
});
```

---

## 7. Performance & Memory Patterns

While TypeScript adds a compile-time overhead, its impact on runtime performance is negligible. However, certain patterns can help in performance-critical applications.

### Object Pooling with Type Safety

For systems that create and destroy many objects of the same type (like messages), an object pool can reduce pressure on the garbage collector.

TypeScript

```
class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;

    constructor(factory: () => T) {
        this.factory = factory;
    }

    get(): T {
        return this.pool.pop() || this.factory();
    }

    release(obj: T) {
        // You might want to reset the object's state here
        this.pool.push(obj);
    }
}

// Usage with message objects
import { TaskProgressMessage } from './messageTypes';

const messagePool = new ObjectPool<TaskProgressMessage>(() => ({
    type: 'TASK_PROGRESS',
    payload: { taskId: '', percentComplete: 0 }
}));

// Acquire a message from the pool
const msg = messagePool.get();
msg.payload.taskId = 'xyz-789';
msg.payload.percentComplete = 50;

// ... send the message ...

// Release it back to the pool when done
messagePool.release(msg);
```

**Performance Note:** Object pooling adds complexity. Profile your application first to ensure that object creation is actually a bottleneck before implementing this pattern. For most agent systems, the benefits are marginal compared to the added complexity.