I need deep research on \"Real-Time Data Pipeline Architecture for AI Agent Monitoring Systems\" focusing on WebSocket + REST hybrid architectures.

CONTEXT: I'm building a system where dual agents (Manager/Worker) generate real-time coordination data that flows through WebSockets to a React dashboard, with REST APIs for persistence and external integrations.

RESEARCH FOCUS AREAS:

1. **Event Streaming Architecture**
   
   - WebSocket vs Server-Sent Events vs Long Polling trade-offs
   - Message serialization patterns (JSON, MessagePack, Protocol Buffers)
   - Event ordering and delivery guarantees
   - Pub/Sub patterns with Redis, Apache Kafka, or in-memory solutions
   - Event sourcing patterns for audit trails

2. **Data Consistency & Reliability**
   
   - ACID properties in real-time systems
   - Eventual consistency patterns for distributed agent data
   - Conflict resolution when multiple agents update state
   - Data deduplication strategies
   - Idempotent API design for agent data

3. **Session Management Patterns**
   
   - Persistent vs in-memory session storage trade-offs
   - Session stickiness vs stateless design
   - WebSocket connection recovery and state restoration
   - Cross-tab synchronization for web dashboards
   - Mobile/offline synchronization patterns

4. **Backpressure & Flow Control**
   
   - When monitoring data arrives faster than storage can handle
   - Rate limiting patterns for agent data streams
   - Circuit breaker patterns for overwhelmed services
   - Buffering strategies (ring buffers, queues, dropping policies)
   - Adaptive batching based on system load

5. **Scalability Patterns**
   
   - Horizontal scaling of WebSocket servers
   - Database sharding strategies for agent data
   - CDN integration for static dashboard assets
   - Caching layers (Redis, Memcached, application-level)
   - Load balancer configuration for WebSocket traffic

6. **Integration Patterns**
   
   - Webhook delivery guarantees and retry logic
   - External API rate limiting and batching
   - ETL patterns for analytics databases
   - Real-time vs batch processing trade-offs
   - Stream processing with Apache Kafka or similar

OUTPUT FORMAT:

- Create a markdown document titled \"Real-Time-Data-Pipeline-Architecture.md\"
- Include architecture diagrams (ASCII or description for diagrams)
- Provide implementation examples in Node.js/TypeScript
- Add performance benchmarks and capacity planning
- Include monitoring and alerting strategies
- Add cost analysis for different approaches

SPECIFIC IMPLEMENTATION NEEDS:

- WebSocket connection pooling patterns
- PostgreSQL real-time features (NOTIFY/LISTEN)
- React state management for real-time data (Zustand patterns)
- Error handling for failed webhook deliveries
- Time-series data storage and querying patterns
- Cross-origin WebSocket security considerations
