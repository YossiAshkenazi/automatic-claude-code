I need comprehensive research on \"Security Patterns and Best Practices for AI Agent Systems\" covering sandboxing, credential management, and audit logging.

CONTEXT: AI agents that execute code, access external APIs, spawn processes, and handle sensitive data need robust security patterns.

RESEARCH FOCUS AREAS:

1. **Sandboxing & Isolation**
   
   - Container-based sandboxing for agent execution
   - Process isolation and privilege dropping
   - Filesystem access restrictions and chroot jails
   - Network segmentation for agent communication
   - Resource limits to prevent abuse

2. **Credential Management**
   
   - Secure storage and rotation of API keys for agents
   - Short-lived tokens vs long-lived credentials
   - Secret injection patterns (environment variables, secret stores)
   - Credential auditing and access logging
   - Multi-tenant credential isolation

3. **Authentication & Authorization**
   
   - Agent-to-agent authentication patterns
   - Role-based access control (RBAC) for agent capabilities
   - OAuth2/OIDC integration for agent systems
   - API key management and rotation
   - Session management for agent interactions

4. **Audit Logging & Compliance**
   
   - Comprehensive tracking of agent actions
   - Tamper-proof logging strategies
   - Compliance with data protection regulations (GDPR, CCPA)
   - Audit trail visualization and analysis
   - Log retention and archival strategies

5. **Input Validation & Sanitization**
   
   - Preventing injection attacks in agent inputs
   - Output sanitization for agent responses
   - Command injection prevention in process spawning
   - File path traversal prevention
   - SQL injection prevention in agent data storage

6. **Network Security**
   
   - TLS/SSL configuration for agent communication
   - Certificate management and rotation
   - Network firewall rules for agent traffic
   - VPN/private network integration
   - DDoS protection for agent endpoints

7. **Monitoring & Incident Response**
   
   - Security event detection and alerting
   - Anomaly detection for agent behavior
   - Incident response playbooks for security breaches
   - Forensic analysis capabilities
   - Security metrics and reporting

OUTPUT FORMAT:

- Create a markdown document titled \"Security-Patterns-AI-Agent-Systems.md\"
- Include security checklists and compliance frameworks
- Provide implementation examples with security libraries
- Add threat modeling examples specific to agent systems
- Include security testing strategies and tools
- Add incident response procedures

SPECIFIC SECURITY CONCERNS:

- Preventing agents from accessing unauthorized files
- Securing WebSocket connections between agents
- Protecting Claude API keys in multi-tenant environments
- Audit logging for agent code execution
- Rate limiting to prevent agent abuse
- Container escape prevention in agent sandboxes
