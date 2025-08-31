# Dual-Agent System Prompts

This directory contains comprehensive base prompts and coordination protocols for the dual-agent system used by the Automatic Claude Code orchestration engine.

## System Overview

The dual-agent system employs two specialized Claude AI agents working in coordination:

- **Manager Agent (Claude 4.1 Opus)**: Strategic planning, task orchestration, quality assurance
- **Worker Agent (Claude Sonnet)**: Implementation execution, code development, testing

## Prompt Files

### Core Agent Prompts

#### [`manager-agent-base.md`](./manager-agent-base.md)
Complete base prompt for the Manager Agent including:
- Role definition and core responsibilities
- Input/output format specifications
- Quality gate enforcement procedures
- Decision-making frameworks
- Communication protocols with Worker Agent

**Key Features:**
- Strategic task breakdown and planning
- Clean instruction generation (no conversational fluff)
- Progress evaluation and quality assessment
- Escalation decision-making
- Context preservation across iterations

#### [`worker-agent-base.md`](./worker-agent-base.md)
Complete base prompt for the Worker Agent including:
- Implementation specialist role definition
- Structured completion reporting format
- Quality standards and testing requirements
- Error handling and troubleshooting protocols
- Code quality and documentation standards

**Key Features:**
- Precise task execution capabilities
- Comprehensive reporting structure (STATUS, ACCOMPLISHED, FILES_MODIFIED, etc.)
- Built-in quality validation
- Self-assessment and issue identification
- Integration testing and validation

### Coordination Protocols

#### [`coordination-protocol.md`](./coordination-protocol.md)
Master coordination document defining:
- Agent communication flow and message formats
- Handoff mechanisms between agents
- Error escalation procedures
- Quality gates and checkpoints
- State synchronization approach
- Performance metrics and monitoring

#### [`handoff-mechanisms.md`](./handoff-mechanisms.md)
Detailed handoff procedures covering:
- Initialization handoff (User → Manager → Worker)
- Progress handoff (Worker → Manager → Worker)
- Error recovery handoff (Worker → Manager → Worker)
- Escalation handoff (Manager → Human)
- Context preservation strategies
- Handoff validation and failure recovery

#### [`error-escalation-procedures.md`](./error-escalation-procedures.md)
Comprehensive error handling including:
- Error classification and severity levels
- Escalation triggers (automatic and progressive)
- Documentation requirements for human intervention
- Resolution integration procedures
- Error prevention strategies
- Learning from escalations

#### [`quality-gates-completion-criteria.md`](./quality-gates-completion-criteria.md)
Quality assurance framework defining:
- Pre-implementation gates (instruction quality, scope validation)
- Implementation gates (pre-commit validation, completeness)
- Post-implementation gates (quality assessment, project integration)
- Completion criteria definitions
- Quality metrics and monitoring

#### [`state-synchronization.md`](./state-synchronization.md)
State management system covering:
- Multi-layer state architecture (global, session, iteration)
- Synchronization mechanisms and data transfer formats
- Conflict resolution strategies
- State recovery and rollback mechanisms
- Performance optimization and caching

## Usage Guidelines

### Integration with Orchestration Engine

These prompts are designed to be integrated into the Automatic Claude Code orchestration engine at specific points:

1. **System Initialization**: Load base agent prompts
2. **Task Processing**: Apply coordination protocols
3. **Error Handling**: Follow escalation procedures
4. **Quality Assurance**: Enforce quality gates
5. **State Management**: Maintain synchronization

### Customization and Extension

The prompt system is designed to be:
- **Modular**: Each document can be updated independently
- **Extensible**: New protocols can be added without breaking existing ones
- **Configurable**: Parameters and thresholds can be adjusted per project
- **Maintainable**: Clear documentation enables ongoing improvements

### Best Practices

#### For Manager Agent Implementation:
- Always validate instruction quality before handoff
- Maintain context continuity across iterations
- Make clear completion decisions (Complete/Continue/Escalate)
- Document architectural decisions for future reference

#### For Worker Agent Implementation:
- Follow structured reporting format exactly
- Include comprehensive testing and validation
- Report issues clearly with specific context
- Maintain code quality standards consistently

#### For Coordination Implementation:
- Validate state synchronization at each handoff
- Implement timeout and failure recovery mechanisms
- Log all decisions and outcomes for analysis
- Monitor performance metrics continuously

## Example Implementation

```javascript
// Orchestration engine integration example
class DualAgentOrchestrator {
  constructor() {
    this.managerAgent = new ManagerAgent(loadPrompt('manager-agent-base.md'));
    this.workerAgent = new WorkerAgent(loadPrompt('worker-agent-base.md'));
    this.coordinator = new CoordinationProtocol();
    this.stateManager = new StateSynchronizer();
  }

  async processTask(userRequest) {
    // Initialize with Manager Agent
    const instructions = await this.managerAgent.planTask(userRequest);
    
    // Coordinate handoff to Worker Agent
    const handoffPackage = await this.coordinator.prepareHandoff(instructions);
    const workerReport = await this.workerAgent.executeTask(handoffPackage);
    
    // Manager reviews and decides next steps
    const decision = await this.managerAgent.reviewCompletion(workerReport);
    
    // Handle decision (Complete/Continue/Escalate)
    return this.coordinator.processDecision(decision);
  }
}
```

## Continuous Improvement

This prompt system includes built-in mechanisms for continuous improvement:

- **Performance Metrics**: Track success rates, iteration counts, escalation frequency
- **Quality Metrics**: Monitor code quality, test coverage, bug introduction rates
- **Learning Integration**: Capture successful patterns and common failure modes
- **Threshold Optimization**: Adjust escalation triggers based on empirical performance

## Support and Maintenance

The prompt system is designed to be self-documenting and maintainable:

- Each document includes comprehensive examples
- Decision frameworks are clearly specified
- Failure modes and recovery procedures are documented
- Performance metrics enable data-driven improvements

For questions, issues, or contributions to the prompt system, refer to the project's main documentation and contribution guidelines.