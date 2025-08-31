# DUAL-AGENT COORDINATION PROTOCOL

## OVERVIEW
This document defines the communication protocols, handoff mechanisms, error escalation procedures, and quality gates for coordinating between the Manager Agent (Claude 4.1 Opus) and Worker Agent (Claude Sonnet) in the automatic Claude Code system.

## AGENT COMMUNICATION FLOW

### Primary Flow Diagram
```
User Request
     ↓
Manager Agent (Analysis & Planning)
     ↓
[Clean Instructions]
     ↓
Worker Agent (Implementation)
     ↓
[Structured Report]
     ↓
Manager Agent (Review & Decision)
     ↓
[Complete|Continue|Escalate]
```

### Message Format Standards

#### Manager → Worker Messages
```
FORMAT: Plain text instructions only
STRUCTURE: Direct, actionable commands
FORBIDDEN: Prefixes, pleasantries, meta-commentary
REQUIRED: Specific technical details, success criteria
```

**Valid Example:**
```
Create JWT authentication middleware that validates Bearer tokens, extracts user ID from payload, adds user object to request context, and returns 401 for invalid tokens. Include unit tests for valid tokens, expired tokens, malformed tokens, and missing Authorization header.
```

**Invalid Example:**
```
Please create authentication middleware. Let me know when you're done and if you have any questions!
```

#### Worker → Manager Messages
```
FORMAT: Structured completion report using defined template
REQUIRED SECTIONS: STATUS, ACCOMPLISHED, FILES_MODIFIED, TESTS, ISSUES_ENCOUNTERED, VALIDATION
CONDITIONAL SECTION: NEXT_STEPS_NEEDED (only for PARTIAL/FAILED status)
```

## HANDOFF MECHANISMS

### 1. Initialization Handoff
**Trigger:** User submits initial request to system
**Process:**
1. System routes request to Manager Agent
2. Manager analyzes request and project context
3. Manager creates initial implementation instructions
4. System passes instructions to Worker Agent

**Manager Decision Points:**
- Task complexity assessment (simple/complex)
- Resource requirement evaluation
- Risk identification and mitigation planning
- Success criteria definition

### 2. Iteration Handoff
**Trigger:** Worker completes task and submits report
**Process:**
1. Manager receives Worker's structured report
2. Manager evaluates completion against requirements
3. Manager makes continuation decision (Complete/Continue/Escalate)
4. If Continue: Manager generates refined instructions for Worker
5. If Complete: Manager finalizes task and reports to user
6. If Escalate: Manager documents issue for human intervention

**Manager Evaluation Criteria:**
- Requirements fulfillment completeness
- Code quality and standards compliance
- Test coverage and validation adequacy
- Integration and compatibility maintenance

### 3. Error Recovery Handoff
**Trigger:** Worker reports issues or failures
**Process:**
1. Manager analyzes error context and Worker's attempted solutions
2. Manager determines error category (technical/configuration/architectural)
3. Manager provides specific debugging instructions or escalates
4. Worker attempts resolution with Manager's guidance
5. Maximum 3 error recovery iterations before escalation

## ERROR ESCALATION PROCEDURES

### Escalation Triggers

#### Automatic Escalation (Immediate)
- **Security Issues**: Authentication bypass, data exposure risks
- **System Corruption**: Critical file damage, database corruption
- **Resource Exhaustion**: Disk space full, memory limits exceeded
- **Dependency Failures**: Core services unavailable, API limits exceeded

#### Progressive Escalation (After Retry Attempts)
- **Implementation Blockers**: Missing credentials, environment issues
- **Design Conflicts**: Architectural inconsistencies discovered
- **Performance Issues**: Unresolvable performance degradation
- **Integration Failures**: Third-party service compatibility problems

#### Iteration-Based Escalation
- **Simple Tasks**: Escalate after 3 failed iterations
- **Complex Features**: Escalate after 7 failed iterations
- **Bug Fixes**: Escalate after 2 failed iterations
- **Refactoring**: Escalate after 5 failed iterations

### Escalation Process

#### Step 1: Manager Assessment
```
ESCALATION_REQUIRED: [true/false]
CATEGORY: [technical|configuration|architectural|resource|security]
SEVERITY: [low|medium|high|critical]
BLOCKER_TYPE: [skill|access|design|environment|dependency]
```

#### Step 2: Documentation Preparation
```
ESCALATION_REPORT:
Issue: [Clear description of the problem]
Context: [What was attempted, by whom, how many iterations]
Impact: [Project delay, functionality affected, risk level]
Recommendation: [Specific human action needed]
Workaround: [Temporary solution if available]
Urgency: [Timeline for resolution needed]
```

#### Step 3: Handoff to Human
- System pauses automated processing
- Human receives detailed escalation report
- Human resolves issue or provides guidance
- System resumes with updated context or constraints

## QUALITY GATES

### Pre-Implementation Gates (Manager Agent)

#### Gate 1: Instruction Clarity
- [ ] Instructions are specific and actionable
- [ ] Success criteria clearly defined
- [ ] All necessary context provided
- [ ] Technical constraints specified
- [ ] Expected deliverables outlined

#### Gate 2: Scope Validation
- [ ] Task scope appropriate for single iteration
- [ ] Dependencies identified and available
- [ ] Complexity matches Worker Agent capabilities
- [ ] Time estimates reasonable (< 30 minutes implementation)
- [ ] Risk level acceptable for automated execution

### Implementation Gates (Worker Agent)

#### Gate 3: Pre-Commit Validation
- [ ] All requirements addressed
- [ ] Code follows project conventions
- [ ] Error handling implemented
- [ ] Input validation included
- [ ] No obvious security vulnerabilities

#### Gate 4: Testing Completeness
- [ ] Unit tests written for new functionality
- [ ] Existing tests still pass
- [ ] Integration points validated
- [ ] Error scenarios tested
- [ ] Coverage meets project standards (>80%)

### Post-Implementation Gates (Manager Agent)

#### Gate 5: Quality Assessment
- [ ] Requirements fully satisfied
- [ ] Code quality meets standards
- [ ] Architecture consistency maintained
- [ ] Performance implications acceptable
- [ ] Documentation adequate

#### Gate 6: Integration Verification
- [ ] No regressions in existing functionality
- [ ] Dependencies properly managed
- [ ] Configuration changes documented
- [ ] Build process successful
- [ ] Deployment readiness confirmed

## STATE SYNCHRONIZATION

### Project State Management

#### Persistent State Elements
```json
{
  "project_context": {
    "architecture": "current architectural decisions",
    "conventions": "coding standards and patterns",
    "dependencies": "installed packages and versions",
    "configuration": "environment and build settings"
  },
  "task_history": [
    {
      "iteration": 1,
      "manager_instructions": "task instructions",
      "worker_report": "completion report",
      "outcome": "complete|continue|escalate",
      "timestamp": "2024-01-01T12:00:00Z",
      "files_modified": ["list", "of", "files"]
    }
  ],
  "current_objectives": {
    "primary": "main task being worked on",
    "secondary": "supporting tasks identified",
    "blocked": "tasks waiting for dependencies"
  }
}
```

#### State Synchronization Points
1. **Before Each Iteration**: Manager reviews current state and history
2. **After Worker Completion**: State updated with new modifications and outcomes  
3. **At Escalation Events**: State preserved for human context
4. **At Task Completion**: Final state snapshot for future reference

### Context Preservation Strategies

#### Short-term Context (Within Task)
- Manager maintains conversation thread with previous iterations
- Worker references recent file modifications and decisions
- Error recovery builds on previous troubleshooting attempts
- Progress tracking continues across iterations

#### Long-term Context (Across Tasks)
- Architectural decisions influence future task planning
- Code patterns established in previous tasks guide implementations
- Quality standards learned from corrections improve future work
- Dependency choices affect subsequent integration decisions

## COMPLETION CRITERIA

### Task-Level Completion
- **Functional Requirements**: All specified functionality implemented
- **Quality Standards**: Code quality gates passed
- **Testing Requirements**: Adequate test coverage with passing tests
- **Documentation**: Essential documentation created or updated
- **Integration**: Changes integrated without breaking existing functionality

### Iteration-Level Completion
- **Progress Made**: Measurable advancement toward task goals
- **Blockers Resolved**: Known issues addressed or escalated
- **Quality Maintained**: No degradation of existing code quality
- **Communication**: Clear status and next steps communicated

### Project-Level Completion
- **User Satisfaction**: Original request fully addressed
- **System Integrity**: All systems functioning correctly post-implementation
- **Maintainability**: Code is maintainable and follows project standards
- **Documentation**: Sufficient documentation for future maintenance
- **Performance**: Acceptable performance characteristics maintained

## MONITORING AND METRICS

### Efficiency Metrics
- **Time per Task**: Average completion time by task complexity
- **Iteration Count**: Average iterations needed for completion
- **Escalation Rate**: Percentage of tasks requiring human intervention
- **First-Pass Success**: Percentage of tasks completed in single iteration

### Quality Metrics
- **Defect Rate**: Bugs introduced per completed task
- **Test Coverage**: Percentage of code covered by tests
- **Code Quality**: Linting scores and complexity metrics
- **Architecture Compliance**: Adherence to established patterns

### Communication Metrics
- **Instruction Clarity**: Frequency of clarification requests
- **Report Completeness**: Coverage of required report sections
- **Error Handling**: Time to resolve reported issues
- **Context Preservation**: Consistency across iteration handoffs

This coordination protocol ensures efficient, high-quality collaboration between the dual agents while maintaining clear escalation paths and quality standards.