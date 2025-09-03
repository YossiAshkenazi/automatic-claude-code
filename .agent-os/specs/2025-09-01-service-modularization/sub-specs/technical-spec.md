# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-service-modularization/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Technical Requirements

### Service Modularization Architecture

#### 1. WebSocket Server Refactoring (`websocket-server.ts` → Modules)
- **Connection Manager Service**: Handle WebSocket connections, heartbeat, reconnection logic
- **Agent Communication Service**: Process dual-agent coordination messages  
- **Monitoring Data Service**: Handle real-time monitoring data processing
- **Session Management Service**: Manage session lifecycle, persistence, and retrieval
- **Analytics Service**: Process performance metrics and ML insights
- **Webhook Service**: Handle external integrations (Slack, Discord, email)
- **Health Check Service**: System health monitoring and reporting
- **Event Router Service**: Route and distribute events to appropriate handlers

#### 2. CLI Refactoring (`index.ts` → Command Modules)
- **Command Parser Module**: Parse CLI arguments and route to handlers
- **Run Command Handler**: Execute dual-agent workflows
- **Monitor Command Handler**: Start/manage monitoring services
- **Config Command Handler**: Configuration management operations
- **Session Command Handler**: Session history and management
- **Agent Coordinator Service**: Orchestrate Manager-Worker agent interactions
- **Process Manager Service**: Spawn and manage Claude Code processes

### Approach

#### Phase 1: Service Layer Foundation
1. **Create Base Service Architecture**
   - Abstract base service class with common patterns
   - Dependency injection container setup
   - Service registry for loose coupling
   - Configuration service for centralized settings

2. **Extract Core Services**
   - Start with least coupled functionality first
   - Maintain existing API contracts during transition
   - Implement service interfaces before concrete classes
   - Create comprehensive unit tests for each service

#### Phase 2: WebSocket Server Modularization
1. **Connection Management**
   ```typescript
   interface IConnectionManager {
     handleConnection(socket: WebSocket): void;
     broadcastToAll(message: any): void;
     getConnectionCount(): number;
     cleanup(): void;
   }
   ```

2. **Event Processing Services**
   ```typescript
   interface IAgentCommunicationService {
     processAgentMessage(message: AgentMessage): Promise<void>;
     coordinateAgents(sessionId: string): Promise<void>;
     validateQualityGates(workItem: WorkItem): Promise<boolean>;
   }
   ```

3. **Data Management Services**
   ```typescript
   interface ISessionService {
     createSession(data: SessionData): Promise<Session>;
     updateSession(id: string, updates: Partial<Session>): Promise<Session>;
     getSessionHistory(filters?: SessionFilters): Promise<Session[]>;
   }
   ```

#### Phase 3: CLI Layer Restructuring  
1. **Command Handler Pattern**
   ```typescript
   interface ICommandHandler {
     handle(args: CommandArgs): Promise<CommandResult>;
     validate(args: CommandArgs): ValidationResult;
     getHelp(): string;
   }
   ```

2. **Service Orchestration**
   ```typescript
   class ServiceContainer {
     register<T>(token: string, factory: () => T): void;
     resolve<T>(token: string): T;
     singleton<T>(token: string, factory: () => T): void;
   }
   ```

#### Phase 4: Integration and Testing
1. **Module Integration Testing**
   - Service interaction testing
   - End-to-end workflow validation
   - Performance regression testing
   - Memory leak detection

2. **Backward Compatibility**
   - Maintain existing API endpoints
   - Preserve CLI command interface
   - Ensure monitoring dashboard compatibility

## External Dependencies

### New Dependencies
- **inversify**: Dependency injection framework for TypeScript
- **reflect-metadata**: Required for inversify decorators
- **class-validator**: Input validation for service methods
- **class-transformer**: Object transformation utilities

### Existing Dependencies (Enhanced Usage)
- **ws**: WebSocket library (enhanced with connection pooling)
- **express**: HTTP server (enhanced with modular routing)
- **winston**: Logging (enhanced with service-specific loggers)
- **pg**: PostgreSQL client (enhanced with repository pattern)

### Development Dependencies
- **@types/inversify**: TypeScript definitions for dependency injection
- **supertest**: API testing framework for modular routes
- **sinon**: Mocking framework for service testing
- **nyc**: Code coverage for service modules