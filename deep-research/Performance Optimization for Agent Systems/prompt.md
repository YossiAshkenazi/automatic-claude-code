I need deep research on \"Performance Optimization Strategies for AI Agent Systems\" focusing on resource management, connection pooling, and scaling patterns.

CONTEXT: Multi-agent system with process spawning, WebSocket connections, database operations, and real-time monitoring that needs to scale efficiently.

RESEARCH FOCUS AREAS:

1. **Process Pool Management**
   
   - Reusing Claude processes vs spawning new ones
   - Process warm-up strategies and connection pre-warming
   - Process lifecycle management and cleanup
   - Resource limits and quotas per agent
   - Cross-platform process optimization

2. **Memory Management**
   
   - Memory leak detection in long-running agent processes
   - Garbage collection tuning for Node.js agent systems
   - Memory pooling patterns for frequent allocations
   - Memory profiling and monitoring strategies
   - Out-of-memory prevention and recovery

3. **Connection Optimization**
   
   - WebSocket connection pooling and reuse
   - HTTP connection pooling for REST APIs
   - Database connection pool sizing and tuning
   - Keep-alive strategies for external services
   - Connection health monitoring and recovery

4. **Caching Strategies**
   
   - When to cache agent responses and for how long
   - Cache invalidation patterns for agent data
   - Distributed caching with Redis or similar
   - Application-level caching vs database caching
   - Cache warming strategies

5. **Database Performance**
   
   - Query optimization for agent interaction data
   - Indexing strategies for time-series agent data
   - Connection pooling and transaction management
   - Read replicas for agent analytics
   - Partitioning strategies for large datasets

6. **Monitoring & Profiling**
   
   - Performance metrics collection for agent systems
   - Application Performance Monitoring (APM) integration
   - Custom metrics for agent coordination efficiency
   - Alerting on performance degradation
   - Capacity planning based on metrics

7. **Scaling Patterns**
   
   - Horizontal vs vertical scaling considerations
   - Load balancing strategies for agent traffic
   - Auto-scaling based on agent workload
   - Container orchestration optimization
   - Cost optimization strategies

OUTPUT FORMAT:

- Create a markdown document titled \"Performance-Optimization-Agent-Systems.md\"
- Include specific optimization techniques with code examples
- Provide benchmark comparisons and measurement strategies
- Add monitoring and alerting recommendations
- Include cost-benefit analysis of different optimizations
- Add troubleshooting guides for performance issues

SPECIFIC OPTIMIZATIONS TO RESEARCH:

- Node.js cluster mode for agent systems
- PostgreSQL performance tuning for agent data
- WebSocket compression and message optimization
- Process spawn optimization patterns
- Memory-efficient JSON parsing for large agent responses
- CDN strategies for agent dashboard assets
