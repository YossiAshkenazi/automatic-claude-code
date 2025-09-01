I need research on \"Testing Strategies for Complex AI Agent Interactions\" covering everything from unit tests to chaos engineering.

CONTEXT: Testing a Manager-Worker agent system where agents spawn processes, communicate through WebSockets, and coordinate complex multi-step tasks.

RESEARCH FOCUS AREAS:

1. **Mock Agent Patterns**
   
   - How to test coordination without spawning real Claude processes
   - Stubbing external API calls and process execution
   - Mock message passing between agents
   - Simulating different agent response patterns
   - Dependency injection for testable agent systems

2. **Integration Testing Strategies**
   
   - End-to-end testing of Manager-Worker workflows
   - Testing WebSocket communication patterns
   - Database integration testing with real PostgreSQL
   - File system testing for agent workspace operations
   - Docker-based integration test environments

3. **Race Condition Testing**
   
   - Detecting timing issues in agent communication
   - Property-based testing for concurrent operations
   - Stress testing with multiple simultaneous agents
   - Deadlock detection in agent coordination
   - Message ordering verification

4. **Chaos Engineering for Agents**
   
   - Deliberately failing agents to test recovery
   - Network partition simulation
   - Process kill and restart scenarios
   - Database connection failure simulation
   - Memory pressure testing

5. **Performance & Load Testing**
   
   - Agent coordination under high load
   - Memory leak detection in long-running tests
   - Response time regression testing
   - Capacity planning through load testing
   - Resource utilization monitoring during tests

6. **Test Data Management**
   
   - Creating realistic agent interaction scenarios
   - Test data factories for complex agent states
   - Database seeding for integration tests
   - File system fixture management
   - Configuration management for test environments

7. **Continuous Integration Patterns**
   
   - Running agent tests in CI/CD pipelines
   - Parallel test execution strategies
   - Test result reporting and metrics
   - Flaky test detection and mitigation
   - Cross-platform testing (Windows, Linux, macOS)

OUTPUT FORMAT:

- Create a markdown document titled \"Testing-Complex-Agent-Interactions.md\"
- Include complete test examples with Jest, Vitest, or similar
- Provide CI/CD configuration examples (GitHub Actions)
- Add debugging strategies for failed tests
- Include performance benchmarking approaches
- Add test maintenance and refactoring guides

SPECIFIC TESTING SCENARIOS:

- Testing Manager task assignment to Worker
- Verifying Worker progress reporting accuracy
- Testing agent recovery from process crashes
- Validating WebSocket reconnection behavior
- Testing concurrent agent operations
- Verifying data consistency across agent interactions
