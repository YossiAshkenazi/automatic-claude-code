# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-01-service-modularization/spec.md

> Created: 2025-09-01
> Status: Ready for Implementation

## Tasks

### Phase 1: Foundation Setup (Priority: High)

**Task 1.1: Create Service Architecture Foundation**
- [ ] Create `src/services/base/` directory structure
- [ ] Implement `BaseService` abstract class with common patterns
- [ ] Set up dependency injection container using inversify
- [ ] Create service registry and configuration management
- [ ] Add TypeScript interfaces for all service contracts
- **Estimated Time**: 6 hours
- **Dependencies**: None
- **Acceptance Criteria**: Dependency injection working, base service pattern established

**Task 1.2: Add Required Dependencies**
- [ ] Install inversify and reflect-metadata for dependency injection
- [ ] Add class-validator and class-transformer for validation
- [ ] Update TypeScript configuration for decorators
- [ ] Install testing utilities (sinon, supertest, nyc)
- [ ] Update package.json scripts for modular testing
- **Estimated Time**: 2 hours
- **Dependencies**: None
- **Acceptance Criteria**: All dependencies installed, TypeScript compiling with decorators

### Phase 2: WebSocket Server Modularization (Priority: High)

**Task 2.1: Extract Connection Management Service**
- [ ] Create `ConnectionManagerService` class
- [ ] Move WebSocket connection handling from websocket-server.ts
- [ ] Implement connection pooling and heartbeat management
- [ ] Add connection state tracking and cleanup
- [ ] Write unit tests for connection management
- **Estimated Time**: 8 hours
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**: Connection management isolated, existing functionality preserved

**Task 2.2: Create Agent Communication Service**
- [ ] Create `AgentCommunicationService` class
- [ ] Extract agent coordination logic from websocket-server.ts
- [ ] Implement Manager-Worker message routing
- [ ] Add quality gate validation logic
- [ ] Write comprehensive tests for agent interactions
- **Estimated Time**: 10 hours
- **Dependencies**: Task 2.1
- **Acceptance Criteria**: Agent communication isolated, dual-agent workflows working

**Task 2.3: Extract Monitoring Data Service**
- [ ] Create `MonitoringDataService` class
- [ ] Move real-time monitoring data processing
- [ ] Implement data validation and transformation
- [ ] Add performance metrics collection
- [ ] Write tests for monitoring data flows
- **Estimated Time**: 6 hours
- **Dependencies**: Task 2.1
- **Acceptance Criteria**: Monitoring data processing isolated, dashboard receiving data

**Task 2.4: Create Session Management Service**
- [ ] Create `SessionService` class
- [ ] Extract session lifecycle management
- [ ] Implement session persistence and retrieval
- [ ] Add session history and filtering
- [ ] Write tests for session operations
- **Estimated Time**: 8 hours
- **Dependencies**: Task 2.1
- **Acceptance Criteria**: Session management isolated, session history working

**Task 2.5: Extract Analytics Service**
- [ ] Create `AnalyticsService` class
- [ ] Move ML insights and performance analytics
- [ ] Implement anomaly detection logic
- [ ] Add predictive analytics calculations
- [ ] Write tests for analytics functionality
- **Estimated Time**: 10 hours
- **Dependencies**: Task 2.4
- **Acceptance Criteria**: Analytics isolated, ML insights generating

**Task 2.6: Create Webhook Service**
- [ ] Create `WebhookService` class
- [ ] Extract external integration logic (Slack, Discord, email)
- [ ] Implement webhook delivery and retry logic
- [ ] Add webhook configuration management
- [ ] Write tests for webhook integrations
- **Estimated Time**: 8 hours
- **Dependencies**: Task 2.1
- **Acceptance Criteria**: Webhooks isolated, external integrations working

**Task 2.7: Create Health Check Service**
- [ ] Create `HealthCheckService` class
- [ ] Extract system health monitoring
- [ ] Implement health check endpoints
- [ ] Add dependency health validation
- [ ] Write tests for health checking
- **Estimated Time**: 4 hours
- **Dependencies**: Task 2.1
- **Acceptance Criteria**: Health checks isolated, system status reporting

**Task 2.8: Create Event Router Service**
- [ ] Create `EventRouterService` class
- [ ] Extract event routing and distribution logic
- [ ] Implement event filtering and transformation
- [ ] Add event logging and tracking
- [ ] Write tests for event routing
- **Estimated Time**: 6 hours
- **Dependencies**: All Task 2.x services
- **Acceptance Criteria**: Event routing isolated, events properly distributed

### Phase 3: CLI Layer Restructuring (Priority: Medium)

**Task 3.1: Create Command Parser Module**
- [ ] Create `src/commands/` directory structure
- [ ] Extract CLI argument parsing from index.ts
- [ ] Implement command routing logic
- [ ] Add command validation and help system
- [ ] Write tests for command parsing
- **Estimated Time**: 6 hours
- **Dependencies**: Task 1.1
- **Acceptance Criteria**: Command parsing isolated, CLI interface unchanged

**Task 3.2: Create Run Command Handler**
- [ ] Create `RunCommandHandler` class
- [ ] Extract dual-agent workflow execution
- [ ] Implement task orchestration logic
- [ ] Add progress tracking and reporting
- [ ] Write tests for run command
- **Estimated Time**: 8 hours
- **Dependencies**: Task 3.1, Phase 2 completion
- **Acceptance Criteria**: Run command isolated, dual-agent workflows working

**Task 3.3: Create Monitor Command Handler**
- [ ] Create `MonitorCommandHandler` class
- [ ] Extract monitoring service management
- [ ] Implement start/stop/status operations
- [ ] Add monitoring configuration management
- [ ] Write tests for monitor commands
- **Estimated Time**: 4 hours
- **Dependencies**: Task 3.1
- **Acceptance Criteria**: Monitor commands isolated, monitoring service controllable

**Task 3.4: Create Config Command Handler**
- [ ] Create `ConfigCommandHandler` class
- [ ] Extract configuration management operations
- [ ] Implement config validation and updates
- [ ] Add configuration export/import
- [ ] Write tests for config operations
- **Estimated Time**: 4 hours
- **Dependencies**: Task 3.1
- **Acceptance Criteria**: Config commands isolated, configuration management working

**Task 3.5: Create Session Command Handler**
- [ ] Create `SessionCommandHandler` class
- [ ] Extract session history and management
- [ ] Implement session listing and filtering
- [ ] Add session export and cleanup
- [ ] Write tests for session commands
- **Estimated Time**: 4 hours
- **Dependencies**: Task 3.1, Task 2.4
- **Acceptance Criteria**: Session commands isolated, session history accessible

**Task 3.6: Extract Agent Coordinator Service**
- [ ] Create `AgentCoordinatorService` class
- [ ] Extract Manager-Worker orchestration from index.ts
- [ ] Implement agent lifecycle management
- [ ] Add coordination metrics and monitoring
- [ ] Write tests for agent coordination
- **Estimated Time**: 10 hours
- **Dependencies**: Task 3.1, Task 2.2
- **Acceptance Criteria**: Agent coordination isolated, dual-agent system working

**Task 3.7: Create Process Manager Service**
- [ ] Create `ProcessManagerService` class
- [ ] Extract Claude Code process spawning
- [ ] Implement process lifecycle management
- [ ] Add process monitoring and cleanup
- [ ] Write tests for process management
- **Estimated Time**: 6 hours
- **Dependencies**: Task 3.6
- **Acceptance Criteria**: Process management isolated, Claude Code spawning working

### Phase 4: API Route Modularization (Priority: Medium)

**Task 4.1: Create Modular Route Structure**
- [ ] Create `routes/` directory with domain-specific modules
- [ ] Extract routes from websocket-server.ts into modules
- [ ] Implement route-specific middleware
- [ ] Add route validation and error handling
- [ ] Write tests for each route module
- **Estimated Time**: 8 hours
- **Dependencies**: Phase 2 completion
- **Acceptance Criteria**: Routes modularized, API endpoints working

**Task 4.2: Create Controller Classes**
- [ ] Create controller classes for each domain
- [ ] Implement dependency injection in controllers
- [ ] Add input validation and error handling
- [ ] Create response formatting utilities
- [ ] Write tests for all controllers
- **Estimated Time**: 10 hours
- **Dependencies**: Task 4.1, Phase 2 completion
- **Acceptance Criteria**: Controllers created, API responses properly formatted

### Phase 5: Integration and Testing (Priority: High)

**Task 5.1: End-to-End Integration Testing**
- [ ] Create integration test suite
- [ ] Test dual-agent workflow with modular services
- [ ] Verify monitoring dashboard functionality
- [ ] Test WebSocket communication flows
- [ ] Validate API endpoint responses
- **Estimated Time**: 12 hours
- **Dependencies**: All previous phases
- **Acceptance Criteria**: Full system integration working, no regression

**Task 5.2: Performance Validation**
- [ ] Run performance benchmarks against modular system
- [ ] Compare response times with monolithic version
- [ ] Identify and resolve performance regressions
- [ ] Optimize service interactions and dependencies
- [ ] Document performance characteristics
- **Estimated Time**: 6 hours
- **Dependencies**: Task 5.1
- **Acceptance Criteria**: No performance regression, system performance documented

**Task 5.3: Backward Compatibility Validation**
- [ ] Test existing API contracts
- [ ] Verify CLI command compatibility
- [ ] Test monitoring dashboard with new backend
- [ ] Validate Docker deployment works
- [ ] Test production deployment scenarios
- **Estimated Time**: 8 hours
- **Dependencies**: Task 5.1
- **Acceptance Criteria**: Full backward compatibility, existing deployments work

### Phase 6: Documentation and Cleanup (Priority: Low)

**Task 6.1: Architecture Documentation**
- [ ] Create service architecture diagrams
- [ ] Document module interactions and dependencies
- [ ] Write API documentation for new endpoints
- [ ] Create troubleshooting guide for modular system
- [ ] Update deployment documentation
- **Estimated Time**: 6 hours
- **Dependencies**: Task 5.3
- **Acceptance Criteria**: Complete documentation available

**Task 6.2: Migration Guide Creation**
- [ ] Write step-by-step migration guide
- [ ] Document breaking changes (if any)
- [ ] Create rollback procedures
- [ ] Add monitoring and validation steps
- [ ] Test migration guide with fresh deployment
- **Estimated Time**: 4 hours
- **Dependencies**: Task 6.1
- **Acceptance Criteria**: Migration guide tested and validated

**Task 6.3: Legacy Code Cleanup**
- [ ] Remove old monolithic files (websocket-server.ts, parts of index.ts)
- [ ] Update import statements throughout codebase
- [ ] Clean up unused dependencies and imports
- [ ] Update build scripts and configuration
- [ ] Verify clean build and deployment
- **Estimated Time**: 4 hours
- **Dependencies**: Task 5.3
- **Acceptance Criteria**: Clean codebase, no legacy code remaining

## Summary
- **Total Estimated Time**: 148 hours
- **Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 5
- **Parallel Work Opportunities**: Phase 4 can run parallel with Phase 3
- **Key Milestones**: 
  - End of Phase 2: WebSocket server fully modularized
  - End of Phase 3: CLI layer restructured  
  - End of Phase 5: Full system integration validated