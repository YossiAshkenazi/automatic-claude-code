I need you to research and create comprehensive documentation on \"Agent Coordination Patterns for AI Systems\" with a focus on Manager-Worker architectures like the one described below.

CONTEXT: I'm building a dual-agent system where a Manager Agent does strategic planning and a Worker Agent executes tasks. They communicate through spawned Claude processes and need robust coordination patterns.

RESEARCH FOCUS AREAS:

1. **Coordination Patterns & Strategies**
   
   - Sequential vs Parallel vs Hybrid coordination models
   - Event-driven vs polling-based communication
   - State machine patterns for agent workflows
   - Consensus algorithms for multi-agent decisions
   - Load balancing between multiple worker agents

2. **Communication Protocols**
   
   - Message queuing patterns (Redis, RabbitMQ, in-memory)
   - Event sourcing for agent interactions
   - Command/Query Responsibility Segregation (CQRS) for agents
   - Publish-subscribe patterns for agent notifications
   - Request-response vs fire-and-forget messaging

3. **Failure Mode Recovery**
   
   - Circuit breaker patterns for agent communication
   - Timeout and retry strategies with exponential backoff
   - Dead letter queues for failed agent messages
   - Graceful degradation when agents are unavailable
   - State recovery after process crashes

4. **Quality Gate Templates**
   
   - Automated validation criteria for different task types
   - Code review patterns using AI agents
   - Test validation gates before task completion
   - Security validation patterns
   - Performance benchmarking gates

5. **Real-World Implementation Examples**
   
   - Node.js/TypeScript implementation patterns
   - Process spawning and management (child_process, spawn)
   - Inter-process communication (IPC, WebSockets, HTTP)
   - Resource cleanup and process lifecycle management

OUTPUT FORMAT:

- Create a markdown document titled \"Agent-Coordination-Patterns.md\"
- Include code examples in TypeScript/JavaScript
- Provide decision trees for choosing patterns
- Include troubleshooting sections for common issues
- Add performance considerations and benchmarks
- Include references to academic papers and industry implementations

SPECIFIC IMPLEMENTATION DETAILS I NEED:

- How to handle EINVAL, ENOENT, EACCES errors in process spawning
- Patterns for Windows vs Linux compatibility in agent systems
- Memory leak prevention in long-running agent processes
- Connection pooling for WebSocket-based agent communication
