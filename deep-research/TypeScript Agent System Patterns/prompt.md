I need comprehensive research on \"TypeScript Design Patterns for AI Agent Systems\" with focus on type safety, maintainability, and robust error handling.

CONTEXT: Building a dual-agent system where type safety is crucial for complex agent interactions, message passing, and configuration management.

RESEARCH FOCUS AREAS:

1. **Message Type Systems**
   
   - Strongly-typed agent communication protocols
   - Discriminated unions for different message types
   - Generic message envelope patterns
   - Serialization/deserialization with runtime validation
   - Protocol buffer integration with TypeScript

2. **Error Handling Patterns**
   
   - Comprehensive error union types
   - Result<T, E> patterns vs throwing exceptions
   - Error boundary patterns for agent failures
   - Nested error context preservation
   - Error recovery and retry type definitions

3. **Generic Agent Interfaces**
   
   - Abstract base classes for different agent types
   - Interface segregation for agent capabilities
   - Dependency injection patterns for agent services
   - Plugin architecture with type safety
   - Factory patterns for agent creation

4. **Configuration & Validation**
   
   - Runtime config validation with Zod or similar
   - Environment variable typing and validation
   - Configuration schema evolution patterns
   - Type-safe feature flags for agent behavior
   - Secrets management with type safety

5. **State Management Patterns**
   
   - State machines with TypeScript (XState integration)
   - Immutable state patterns with Immer
   - Event sourcing with strong typing
   - CQRS patterns for agent commands/queries
   - Reactive patterns with RxJS typing

6. **Testing & Mocking Patterns**
   
   - Mock agent interface implementations
   - Type-safe test fixtures and factories
   - Property-based testing for agent interactions
   - Contract testing between agents
   - Dependency injection for testability

7. **Performance & Memory Patterns**
   
   - Memory-efficient type definitions
   - Lazy loading patterns with proper typing
   - Object pooling with type safety
   - Garbage collection considerations
   - Bundle size optimization for agent code

OUTPUT FORMAT:

- Create a markdown document titled \"TypeScript-Agent-System-Patterns.md\"
- Include extensive code examples with proper typing
- Provide before/after examples showing improvements
- Add performance benchmarks where relevant
- Include integration with popular libraries (Express, Socket.io, etc.)
- Add migration guides from JavaScript patterns

SPECIFIC PATTERNS TO RESEARCH:

- Agent message protocol with discriminated unions
- Configuration validation with detailed error messages
- Generic retry mechanisms with type safety
- WebSocket message typing patterns
- Database entity typing with agent-specific fields
- Error boundary implementation for agent failures
