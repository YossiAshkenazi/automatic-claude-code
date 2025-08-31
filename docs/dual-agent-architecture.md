# Dual-Agent Architecture Guide

## Overview

The Automatic Claude Code dual-agent system represents a revolutionary approach to AI-assisted development. By employing specialized Manager and Worker agents, complex development tasks are handled with unprecedented sophistication and reliability.

## Agent Roles & Responsibilities

### Manager Agent (Strategic Coordinator)

**Primary Role**: Strategic planning, oversight, and quality assurance

**Key Responsibilities**:
- **Task Decomposition**: Breaks complex user requests into manageable work items
- **Strategic Planning**: Creates high-level execution plans with clear milestones
- **Resource Management**: Identifies required tools, files, and dependencies
- **Quality Gates**: Validates Worker outputs against acceptance criteria
- **Error Recovery**: Handles failures and provides corrective guidance
- **Progress Monitoring**: Tracks overall project progress and adjusts strategy
- **Integration Oversight**: Ensures all work items integrate properly

**Typical Model**: Claude Opus (for superior reasoning and planning capabilities)

**Example Activities**:
```
[Manager] Analyzing request: "Implement user authentication system"
[Manager] Task breakdown:
  1. Database schema design for users table
  2. Password hashing implementation
  3. JWT token generation/validation
  4. Login/logout API endpoints
  5. Authentication middleware
  6. Unit tests for auth functions
  7. Integration tests for API endpoints
[Manager] Assigning Task 1 to Worker: "Create users table schema with email, password_hash, created_at fields"
```

### Worker Agent (Task Executor)

**Primary Role**: Focused implementation of assigned tasks

**Key Responsibilities**:
- **Code Implementation**: Writes actual code, configurations, and documentation
- **Tool Execution**: Uses Claude Code tools (Read, Write, Edit, Bash, etc.)
- **Progress Reporting**: Regular updates to Manager on task completion
- **Blocker Communication**: Reports obstacles and requests guidance
- **Detail-Oriented Work**: Focuses on implementation specifics
- **Testing Execution**: Runs tests and validates implementations

**Typical Model**: Claude Sonnet (for speed and efficiency in implementation)

**Example Activities**:
```
[Worker] Received task: Create users table schema
[Worker] Reading existing database files...
[Worker] Creating migration: 001_create_users_table.sql
[Worker] Implementing schema with email unique constraint
[Worker] Adding created_at and updated_at timestamps
[Worker] Task completed. Files modified: migrations/001_create_users_table.sql
[Worker] Reporting completion to Manager with validation request
```

## Communication Protocol

### Message Types

```typescript
interface AgentMessage {
  id: string;
  from: 'manager' | 'worker';
  to: 'manager' | 'worker';
  type: MessageType;
  payload: MessagePayload;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

type MessageType = 
  | 'task_assignment'     // Manager → Worker
  | 'progress_update'     // Worker → Manager
  | 'completion_report'   // Worker → Manager
  | 'quality_check'       // Manager → Worker
  | 'error_report'        // Either agent
  | 'guidance_request'    // Worker → Manager
  | 'strategy_update'     // Manager → Worker
  | 'approval_request'    // Worker → Manager
  | 'approval_response';  // Manager → Worker
```

### Communication Flow

1. **Task Assignment**
   ```
   Manager → Worker: {
     type: 'task_assignment',
     payload: {
       taskId: 'auth-001',
       description: 'Implement password hashing function',
       acceptanceCriteria: ['Uses bcrypt', 'Handles salt rounds', 'Error handling'],
       priority: 'high',
       estimatedComplexity: 3,
       dependencies: []
     }
   }
   ```

2. **Progress Updates**
   ```
   Worker → Manager: {
     type: 'progress_update',
     payload: {
       taskId: 'auth-001',
       status: 'in_progress',
       completedSteps: ['Installed bcrypt dependency', 'Created hash function'],
       remainingSteps: ['Add error handling', 'Write tests'],
       blockers: [],
       estimatedCompletion: '2 minutes'
     }
   }
   ```

3. **Completion Reports**
   ```
   Worker → Manager: {
     type: 'completion_report',
     payload: {
       taskId: 'auth-001',
       status: 'completed',
       deliverables: ['src/auth/password.ts', 'tests/auth/password.test.ts'],
       validationRequired: true,
       notes: 'Implemented with 12 salt rounds as security best practice'
     }
   }
   ```

## Workflow Phases

### Phase 1: Strategic Planning
1. **Initial Analysis**: Manager analyzes user request
2. **Task Decomposition**: Break down into work items
3. **Dependency Mapping**: Identify task dependencies
4. **Resource Planning**: Determine required tools and files
5. **Success Criteria**: Define completion requirements

### Phase 2: Coordinated Execution
1. **Work Assignment**: Manager assigns tasks to Worker
2. **Implementation**: Worker executes assigned tasks
3. **Progress Monitoring**: Regular check-ins between agents
4. **Quality Validation**: Manager reviews deliverables
5. **Iterative Refinement**: Adjust approach based on results

### Phase 3: Integration & Completion
1. **Integration Review**: Ensure all pieces work together
2. **Final Testing**: Comprehensive validation
3. **Documentation**: Update relevant documentation
4. **Project Summary**: Detailed report of accomplishments

## Quality Gates

### Automatic Quality Checks
- **Code Quality**: Syntax, style, and best practices
- **Test Coverage**: Adequate test coverage for new code
- **Integration**: Compatibility with existing codebase
- **Documentation**: Code comments and API documentation
- **Security**: Security best practices and vulnerability checks

### Manager Validation Criteria
- **Acceptance Criteria**: Task meets defined requirements
- **Quality Standards**: Code quality meets project standards
- **Integration**: Works properly with other components
- **Maintainability**: Code is readable and maintainable
- **Performance**: Meets performance requirements

### Quality Gate Process
```
[Worker] Completes task implementation
[Worker] Runs self-validation checks
[Worker] Submits completion report to Manager
[Manager] Reviews deliverables against criteria
[Manager] Runs integration tests
[Manager] Either approves or requests revisions
[Manager] Updates project status and assigns next task
```

## Error Handling & Recovery

### Error Detection
- **Worker Self-Monitoring**: Worker detects implementation issues
- **Manager Oversight**: Manager identifies integration problems
- **Quality Gate Failures**: Automatic quality checks fail
- **Tool Execution Errors**: Claude Code tool failures

### Recovery Strategies
1. **Immediate Retry**: For transient failures
2. **Alternative Approach**: Try different implementation method
3. **Task Decomposition**: Break failed task into smaller pieces
4. **Context Adjustment**: Provide additional context or examples
5. **Escalation**: Switch to different models or tools

### Recovery Communication
```
[Worker] Error report: "Failed to compile TypeScript - missing type definitions"
[Manager] Analysis: "Need to install @types packages"
[Manager] New task assignment: "Install required TypeScript type definitions"
[Worker] Executes: npm install @types/node @types/express
[Worker] Retry: Original task now succeeds
```

## Configuration & Customization

### Agent Configuration
```json
{
  "dualAgentMode": {
    "enabled": true,
    "managerModel": "opus",
    "workerModel": "sonnet",
    "coordinationInterval": 3,
    "qualityGateThreshold": 0.8,
    "maxConcurrentTasks": 2,
    "enableCrossValidation": true,
    "communicationTimeout": 30000,
    "retryAttempts": 3
  }
}
```

### Workflow Customization
- **Coordination Interval**: How often Manager checks on Worker
- **Quality Threshold**: Minimum quality score for approval
- **Concurrent Tasks**: Number of parallel work items
- **Cross Validation**: Enable peer review between agents
- **Timeout Settings**: Communication timeout limits

## Best Practices

### For Users
1. **Clear Requirements**: Provide specific, detailed task descriptions
2. **Start Simple**: Begin with smaller tasks to understand agent behavior
3. **Monitor Progress**: Use `acc agents --status` to track coordination
4. **Review Quality Gates**: Ensure validation criteria align with needs
5. **Iterative Refinement**: Allow agents to improve through feedback

### For Complex Projects
1. **Modular Approach**: Break large projects into logical modules
2. **Clear Dependencies**: Specify task dependencies explicitly
3. **Quality Standards**: Define quality criteria upfront
4. **Regular Checkpoints**: Schedule periodic progress reviews
5. **Documentation**: Keep comprehensive project documentation

### Performance Optimization
1. **Model Selection**: Use Opus for planning, Sonnet for implementation
2. **Batch Similar Tasks**: Group related work items
3. **Parallel Execution**: Enable concurrent tasks for independent work
4. **Cache Strategies**: Reuse analyses and patterns
5. **Monitoring**: Track agent performance metrics

## Monitoring & Debugging

### Real-time Monitoring
```bash
# View agent status
acc agents --status

# Monitor coordination
acc agents --logs

# Performance metrics
acc agents --performance
```

### Debug Information
- **Agent Communication Logs**: Full message exchange history
- **Task Timeline**: Chronological view of task assignments and completions
- **Quality Gate Results**: Detailed validation outcomes
- **Performance Metrics**: Response times, success rates, coordination efficiency

### Troubleshooting Common Issues
1. **Agent Communication Timeouts**: Check network and system resources
2. **Quality Gate Failures**: Review validation criteria and thresholds
3. **Task Assignment Loops**: Verify task dependencies and success criteria
4. **Performance Issues**: Monitor model response times and coordination overhead

## Migration from Single-Agent

### Gradual Adoption
1. **Start with Complex Tasks**: Use dual-agent for challenging projects
2. **Compare Results**: Run similar tasks in both modes
3. **Adjust Configuration**: Fine-tune based on experience
4. **Team Training**: Educate team on dual-agent concepts

### Configuration Migration
```bash
# Enable dual-agent mode
acc config set dualAgentMode.enabled true

# Set preferred models
acc config set dualAgentMode.managerModel opus
acc config set dualAgentMode.workerModel sonnet

# Adjust coordination settings
acc config set dualAgentMode.coordinationInterval 3
```

## Future Enhancements

### Planned Features
- **Multi-Worker Support**: Manager coordinating multiple Worker agents
- **Specialized Workers**: Domain-specific agents (frontend, backend, testing)
- **Learning & Adaptation**: Agents learning from past successes
- **Advanced Quality Gates**: ML-based quality assessment
- **Integration Plugins**: Enhanced tool integrations

### Research Areas
- **Agent Personality**: Different agent behavioral patterns
- **Dynamic Role Assignment**: Agents switching roles based on context
- **Collaborative Planning**: Joint strategic planning between agents
- **Predictive Coordination**: Anticipating coordination needs