I need comprehensive documentation on \"Production Debugging Playbooks for AI Agent Systems\" based on the real-world issues I'm encountering.

CONTEXT: I'm running a dual-agent monitoring system with Node.js, TypeScript, WebSockets, and PostgreSQL. Agents spawn Claude processes and communicate through REST APIs and WebSockets.

RESEARCH FOCUS AREAS:

1. **Process Spawn Debugging**
   
   - Windows/Linux compatibility issues and solutions
   - Shell detection and argument escaping patterns
   - PATH resolution problems and workarounds
   - Permission issues (EACCES) and security implications
   - Process cleanup and zombie process prevention

2. **Network Integration Issues**
   
   - Node.js HTTP module vs fetch API trade-offs
   - Timeout handling patterns and best practices
   - Connection pooling optimization
   - DNS resolution issues in containerized environments
   - SSL/TLS certificate problems

3. **Service Discovery & Recovery**
   
   - How agents reconnect when monitoring servers restart
   - Health check patterns for agent systems
   - Service mesh integration for agent communication
   - Load balancer configuration for agent traffic
   - Graceful shutdown procedures

4. **Log Correlation & Observability**
   
   - Tracing requests across Manager, Worker, and monitoring services
   - Structured logging patterns for agent systems
   - Correlation IDs for multi-agent workflows
   - Error aggregation and alerting strategies
   - Performance monitoring and profiling

5. **Database & State Management Issues**
   
   - PostgreSQL connection pool exhaustion
   - Transaction deadlock detection and recovery
   - Session state consistency across service restarts
   - Memory vs persistent storage trade-offs
   - Data migration strategies for agent systems

6. **Container & Orchestration Debugging**
   
   - Docker networking issues in agent systems
   - Kubernetes service discovery problems
   - Resource limits and OOM killer issues
   - Volume mounting problems for agent workspaces
   - Multi-architecture container compatibility

OUTPUT FORMAT:

- Create a markdown document titled \"Production-Debugging-Playbooks.md\"
- Organize by symptom → diagnosis → solution format
- Include specific error messages and their solutions
- Provide shell commands and code snippets for debugging
- Add monitoring and alerting recommendations
- Include escalation procedures and rollback strategies

SPECIFIC SCENARIOS TO COVER:

- \"EINVAL spawn error\" debugging steps
- \"fetch() is not defined\" Node.js version issues
- WebSocket connection drops and recovery
- PostgreSQL \"too many connections\" errors
- Agent process memory leaks and detection
- Cross-platform file path handling issues
