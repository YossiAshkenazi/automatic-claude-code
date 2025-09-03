# Architecture Diagrams - Automatic Claude Code

Comprehensive Mermaid diagrams documenting the WebSocket pooling, monitoring, and dual-agent system architecture.

## 1. Overall System Architecture

High-level view of all system components and their interactions.

```mermaid
graph TB
    subgraph "Client Layer"
        CLI[ACC CLI]
        WEB[Dashboard UI<br/>React Frontend]
    end
    
    subgraph "Core Engine"
        SDK[SDK Autopilot Engine]
        COORD[Dual-Agent Coordinator]
        POOL[WebSocket Pool Manager]
        SESS[Session Manager]
    end
    
    subgraph "Agent Layer"
        MGR[Manager Agent<br/>Opus Model]
        WKR[Worker Agent<br/>Sonnet Model]
        COMP[Task Completion<br/>Analyzer]
    end
    
    subgraph "Communication Layer"
        WS[WebSocket Server]
        REST[REST API<br/>:4005]
        HOOKS[Hook Scripts<br/>PowerShell/Bash]
    end
    
    subgraph "Data Layer"
        REDIS[(Redis<br/>Connection State)]
        FS[(File System<br/>Sessions & Logs)]
        MEM[(Memory Graph<br/>Context Storage)]
    end
    
    subgraph "External Services"
        CLAUDE[Claude API<br/>Anthropic SDK]
        GITHUB[GitHub API<br/>Repository Ops)]
        ARCHON[Archon MCP<br/>Knowledge Base)]
    end
    
    CLI --> SDK
    WEB --> WS
    SDK --> COORD
    COORD --> MGR
    COORD --> WKR
    SDK --> COMP
    SDK --> POOL
    POOL --> WS
    WS --> REST
    HOOKS --> REST
    SDK --> SESS
    SESS --> FS
    POOL --> REDIS
    MGR --> CLAUDE
    WKR --> CLAUDE
    CLI --> GITHUB
    SDK --> ARCHON
    WKR --> MEM
    MGR --> MEM
```

## 2. WebSocket Pool Connection Lifecycle

State machine showing connection management and pooling strategy.

```mermaid
stateDiagram-v2
    [*] --> Initializing: createConnection()
    
    Initializing --> Connecting: authenticate()
    Connecting --> Ready: onOpen()
    Connecting --> Failed: onError()
    
    Ready --> Active: acquire()
    Active --> Ready: release()
    Active --> Busy: highLoad()
    Busy --> Active: loadDecrease()
    
    Ready --> Idle: inactivityTimeout()
    Idle --> Ready: newRequest()
    Idle --> Recycling: TTLExpired()
    
    Active --> Unhealthy: healthCheckFail()
    Busy --> Unhealthy: connectionError()
    Unhealthy --> Recovering: attemptRecover()
    Recovering --> Ready: recoverSuccess()
    Recovering --> Recycling: recoverFail()
    
    Recycling --> [*]: destroy()
    Failed --> [*]: cleanup()
    
    note right of Ready
        Pool maintains 2-100
        connections in Ready state
    end note
    
    note right of Active
        Connection serving
        agent requests
    end note
    
    note right of Unhealthy
        Circuit breaker pattern
        prevents cascade failures
    end note
```

## 3. Monitoring Data Flow

Real-time data flow from agents to dashboard with metrics collection.

```mermaid
flowchart LR
    subgraph "Agent Sources"
        A1[Manager Agent]
        A2[Worker Agent] 
        A3[Task Analyzer]
        A4[Hook Scripts]
    end
    
    subgraph "Collection Layer"
        HOOKS[Hook Event Bus]
        METRIC[Metrics Collector]
        LOG[Log Aggregator]
    end
    
    subgraph "Processing Pipeline"
        STREAM[Stream Processor]
        FILTER[Event Filter]
        ENRICH[Data Enricher]
    end
    
    subgraph "Storage Layer"
        TS[(TimescaleDB<br/>Time Series)]
        REDIS[(Redis<br/>Real-time)]
        FILES[(Log Files)]
    end
    
    subgraph "Analytics Engine"
        DETECT[Anomaly Detection]
        PREDICT[Predictive Analytics]
        ALERT[Alert Engine]
    end
    
    subgraph "Output Layer"
        DASH[Real-time Dashboard]
        API[REST API]
        NOTIF[Notifications]
    end
    
    A1 --> HOOKS
    A2 --> HOOKS
    A3 --> METRIC
    A4 --> HOOKS
    
    HOOKS --> STREAM
    METRIC --> STREAM
    LOG --> STREAM
    
    STREAM --> FILTER
    FILTER --> ENRICH
    
    ENRICH --> TS
    ENRICH --> REDIS
    ENRICH --> FILES
    
    TS --> DETECT
    TS --> PREDICT
    REDIS --> DASH
    
    DETECT --> ALERT
    PREDICT --> ALERT
    ALERT --> NOTIF
    
    REDIS --> API
    TS --> API
    API --> DASH
```

## 4. Kubernetes Deployment Topology

Multi-tier Kubernetes deployment with high availability and scaling.

```mermaid
graph TB
    subgraph "Ingress Layer"
        NGINX[NGINX Ingress<br/>Load Balancer]
        CERT[Cert Manager<br/>TLS Termination]
    end
    
    subgraph "Application Tier"
        subgraph "WebSocket Pool"
            WS1[WS Pod 1]
            WS2[WS Pod 2]
            WS3[WS Pod N]
        end
        
        subgraph "API Services"
            API1[API Pod 1]
            API2[API Pod 2]
        end
        
        subgraph "Dashboard Frontend"
            UI1[UI Pod 1]
            UI2[UI Pod 2]
        end
    end
    
    subgraph "Data Tier"
        subgraph "Redis Cluster"
            REDIS1[(Redis Master)]
            REDIS2[(Redis Replica 1)]
            REDIS3[(Redis Replica 2)]
        end
        
        subgraph "Database"
            POSTGRES[(PostgreSQL<br/>Primary)]
            PGREAD[(PostgreSQL<br/>Read Replica)]
        end
        
        subgraph "Storage"
            PVC[Persistent Volumes]
        end
    end
    
    subgraph "Monitoring Stack"
        PROM[Prometheus]
        GRAF[Grafana]
        JAEGER[Jaeger Tracing]
    end
    
    NGINX --> WS1
    NGINX --> WS2
    NGINX --> API1
    NGINX --> UI1
    
    WS1 --> REDIS1
    WS2 --> REDIS1
    API1 --> POSTGRES
    API2 --> PGREAD
    
    WS1 --> PVC
    API1 --> PVC
    
    WS1 --> PROM
    API1 --> PROM
    PROM --> GRAF
    
    REDIS1 --> REDIS2
    REDIS1 --> REDIS3
    POSTGRES --> PGREAD
```

## 5. BMAD Agent Orchestration Flow

BMAD (Brownfield Multi-Agent Development) orchestration with Archon integration.

```mermaid
sequenceDiagram
    participant USER as User
    participant CLI as ACC CLI
    participant ARCH as Archon MCP
    participant BMAD as BMAD Orchestrator
    participant MGR as Manager Agent
    participant WKR as Worker Agent
    participant GITHUB as GitHub
    
    USER->>CLI: acc run "task" --dual-agent
    CLI->>ARCH: list_tasks(status="todo")
    ARCH-->>CLI: [pending_tasks]
    
    CLI->>ARCH: update_task(status="doing")
    CLI->>BMAD: initiate(task, dual-agent=true)
    
    BMAD->>ARCH: perform_rag_query(task_context)
    ARCH-->>BMAD: [relevant_docs, examples]
    
    BMAD->>MGR: planTask(task, context)
    MGR->>ARCH: search_code_examples(implementation_needs)
    MGR-->>BMAD: execution_plan
    
    BMAD->>WKR: executeTask(plan, context)
    WKR->>GITHUB: create_branch()
    WKR->>GITHUB: implement_changes()
    WKR-->>BMAD: implementation_result
    
    BMAD->>MGR: reviewImplementation(result)
    MGR-->>BMAD: quality_assessment
    
    alt Quality Check Passed
        BMAD->>ARCH: update_task(status="review")
        BMAD->>GITHUB: create_pull_request()
        BMAD-->>CLI: success(pr_url)
    else Quality Issues Found
        BMAD->>WKR: refineImplementation(feedback)
        WKR-->>BMAD: refined_result
    end
    
    CLI-->>USER: task_completed
```

## 6. AI Code Review Pipeline

Automated code review pipeline with quality gates and feedback loops.

```mermaid
flowchart TD
    START([Code Changed]) --> DETECT[Change Detection]
    DETECT --> STATIC[Static Analysis<br/>ESLint, TypeScript]
    
    STATIC --> SECURITY[Security Scan<br/>Snyk, CodeQL]
    SECURITY --> TESTS[Automated Tests<br/>Jest, Integration]
    
    TESTS --> QUALITY{Quality Gate<br/>Score > 0.7?}
    
    QUALITY -->|Pass| AIREV[AI Code Review<br/>Claude Analysis]
    QUALITY -->|Fail| FEEDBACK[Generate Feedback]
    
    AIREV --> PATTERNS[Pattern Analysis<br/>Best Practices]
    PATTERNS --> SUGGEST[Improvement Suggestions]
    
    SUGGEST --> HUMAN{Human Review<br/>Required?}
    
    HUMAN -->|No| APPROVE[Auto-Approve<br/>Merge to Main]
    HUMAN -->|Yes| REVIEWER[Assign Reviewer]
    
    REVIEWER --> MANUAL[Manual Review]
    MANUAL --> DECISION{Review Decision}
    
    DECISION -->|Approve| APPROVE
    DECISION -->|Request Changes| FEEDBACK
    
    FEEDBACK --> NOTIFY[Notify Developer]
    NOTIFY --> REWORK[Developer Rework]
    REWORK --> START
    
    APPROVE --> DEPLOY[Deploy Pipeline]
    DEPLOY --> MONITOR[Post-Deploy Monitoring]
    MONITOR --> END([Complete])
    
    style QUALITY fill:#ff9999
    style HUMAN fill:#ffcc99
    style APPROVE fill:#99ff99
```

## 7. Database Schema Relationships

Entity relationships for session management, monitoring, and agent coordination.

```mermaid
erDiagram
    Projects ||--o{ Sessions : has
    Sessions ||--o{ Tasks : contains
    Tasks ||--o{ TaskResults : produces
    Sessions ||--o{ AgentCoordination : tracks
    
    Projects {
        uuid id PK
        string name
        string description
        string github_repo
        timestamp created_at
        timestamp updated_at
    }
    
    Sessions {
        uuid id PK
        uuid project_id FK
        string user_prompt
        string session_type
        timestamp started_at
        timestamp completed_at
        json configuration
        float quality_score
    }
    
    Tasks {
        uuid id PK
        uuid session_id FK
        string task_description
        string agent_type
        string status
        timestamp created_at
        timestamp completed_at
        json metadata
    }
    
    TaskResults {
        uuid id PK
        uuid task_id FK
        text result_content
        string result_type
        float confidence_score
        json performance_metrics
        timestamp generated_at
    }
    
    AgentCoordination {
        uuid id PK
        uuid session_id FK
        string coordination_phase
        string agent_from
        string agent_to
        text message_content
        timestamp occurred_at
        json context_data
    }
    
    ConnectionPool {
        uuid id PK
        string connection_id
        string status
        timestamp created_at
        timestamp last_used
        integer usage_count
        json health_metrics
    }
    
    Metrics {
        uuid id PK
        timestamp recorded_at
        string metric_type
        string metric_name
        float value
        json labels
        uuid session_id FK
    }
    
    Sessions ||--o{ Metrics : generates
    ConnectionPool ||--o{ Metrics : monitors
```

## 8. Network Architecture with Load Balancing

Network topology showing load balancing, CDN, and service mesh architecture.

```mermaid
graph TB
    subgraph "Edge Layer"
        CDN[CloudFlare CDN<br/>Global Edge Locations]
        LB[Load Balancer<br/>Geographic Routing]
    end
    
    subgraph "Region US-East"
        subgraph "AZ-1a"
            WS1[WebSocket Pool 1]
            API1[API Service 1]
            UI1[Dashboard 1]
        end
        
        subgraph "AZ-1b"
            WS2[WebSocket Pool 2]
            API2[API Service 2]
            UI2[Dashboard 2]
        end
        
        subgraph "Data Layer US-East"
            REDIS1[(Redis Cluster)]
            PG1[(PostgreSQL)]
        end
    end
    
    subgraph "Region EU-West"
        subgraph "AZ-2a"
            WS3[WebSocket Pool 3]
            API3[API Service 3]
        end
        
        subgraph "Data Layer EU-West"
            REDIS2[(Redis Cluster)]
            PG2[(PostgreSQL Read)]
        end
    end
    
    subgraph "Service Mesh"
        ISTIO[Istio Control Plane]
        ENVOY[Envoy Proxies]
    end
    
    CLIENT[Client Applications] --> CDN
    CDN --> LB
    
    LB -->|US Users| WS1
    LB -->|US Users| API1
    LB -->|EU Users| WS3
    LB -->|EU Users| API3
    
    WS1 <--> WS2
    WS1 --> REDIS1
    WS2 --> REDIS1
    API1 --> PG1
    API2 --> PG1
    
    WS3 --> REDIS2
    API3 --> PG2
    
    REDIS1 -.->|Replication| REDIS2
    PG1 -.->|Streaming| PG2
    
    ISTIO --> ENVOY
    ENVOY --> WS1
    ENVOY --> API1
    ENVOY --> WS3
    
    style CDN fill:#e1f5fe
    style REDIS1 fill:#f3e5f5
    style ISTIO fill:#e8f5e8
```

## 9. Security Layers and Boundaries

Security architecture with multiple defense layers and access controls.

```mermaid
graph TB
    subgraph "External Perimeter"
        WAF[Web Application Firewall<br/>DDoS Protection]
        CERT[Certificate Authority<br/>TLS 1.3 Encryption]
    end
    
    subgraph "Network Security"
        VPC[Virtual Private Cloud<br/>Isolated Network]
        SG[Security Groups<br/>Firewall Rules]
        NACL[Network ACLs<br/>Subnet Controls]
    end
    
    subgraph "Identity & Access"
        IAM[Identity Access Management<br/>Role-Based Access]
        JWT[JWT Token Validation<br/>Session Management]
        OAUTH[OAuth2 Provider<br/>Anthropic Auth]
    end
    
    subgraph "Application Security"
        RBAC[Role-Based Access Control<br/>Permission Matrix]
        INPUT[Input Validation<br/>XSS/SQL Injection Prevention]
        RATE[Rate Limiting<br/>Abuse Prevention]
    end
    
    subgraph "Data Protection"
        ENCRYPT[Data Encryption<br/>AES-256 at Rest]
        AUDIT[Audit Logging<br/>All Access Tracked]
        BACKUP[Encrypted Backups<br/>Point-in-Time Recovery]
    end
    
    subgraph "Runtime Security"
        SCAN[Container Scanning<br/>Vulnerability Assessment]
        SECRETS[Secret Management<br/>Vault Integration]
        MONITOR[Runtime Monitoring<br/>Anomaly Detection]
    end
    
    CLIENT[Client Request] --> WAF
    WAF --> CERT
    CERT --> VPC
    
    VPC --> SG
    SG --> NACL
    NACL --> IAM
    
    IAM --> JWT
    JWT --> OAUTH
    OAUTH --> RBAC
    
    RBAC --> INPUT
    INPUT --> RATE
    RATE --> APP[Application Layer]
    
    APP --> ENCRYPT
    ENCRYPT --> AUDIT
    AUDIT --> BACKUP
    
    APP --> SCAN
    SCAN --> SECRETS
    SECRETS --> MONITOR
    
    style WAF fill:#ffcdd2
    style ENCRYPT fill:#c8e6c9
    style MONITOR fill:#fff3e0
```

## 10. CI/CD Pipeline Flow

Continuous integration and deployment pipeline with quality gates and automated testing.

```mermaid
flowchart TD
    DEV[Developer Push] --> GIT[Git Repository<br/>GitHub]
    GIT --> TRIGGER[Webhook Trigger<br/>GitHub Actions]
    
    TRIGGER --> BUILD[Build Stage<br/>pnpm build]
    BUILD --> LINT[Code Quality<br/>ESLint + Prettier]
    LINT --> TEST[Unit Tests<br/>Jest Coverage]
    
    TEST --> SECURITY[Security Scan<br/>Snyk + CodeQL]
    SECURITY --> INTEGRATION[Integration Tests<br/>End-to-End]
    
    INTEGRATION --> QUALITY{Quality Gate<br/>All Checks Pass?}
    
    QUALITY -->|Fail| NOTIFY[Notify Developer<br/>Failure Details]
    QUALITY -->|Pass| STAGING[Deploy to Staging<br/>Docker Build]
    
    STAGING --> SMOKE[Smoke Tests<br/>Basic Functionality]
    SMOKE --> PERF[Performance Tests<br/>Load & Stress]
    
    PERF --> APPROVAL{Manual Approval<br/>Production Deploy?}
    
    APPROVAL -->|Reject| ROLLBACK[Rollback Staging<br/>Cleanup Resources]
    APPROVAL -->|Approve| PROD[Production Deploy<br/>Blue-Green Strategy]
    
    PROD --> HEALTH[Health Checks<br/>Service Verification]
    HEALTH --> MONITOR[Post-Deploy Monitor<br/>24h Observation]
    
    MONITOR --> SUCCESS{Deploy Success?}
    SUCCESS -->|Yes| COMPLETE[Deployment Complete<br/>Update Documentation]
    SUCCESS -->|No| HOTFIX[Emergency Rollback<br/>Incident Response]
    
    NOTIFY --> FIX[Developer Fix<br/>Code Changes]
    FIX --> GIT
    
    ROLLBACK --> INVESTIGATE[Investigate Issues<br/>Root Cause Analysis]
    HOTFIX --> INVESTIGATE
    
    style QUALITY fill:#ffcdd2
    style APPROVAL fill:#fff3e0
    style SUCCESS fill:#c8e6c9
    style COMPLETE fill:#a5d6a7
```

---

Each diagram provides detailed visualization of the system's architecture components, showing clear relationships between services, data flow patterns, and operational procedures. These diagrams support the comprehensive understanding needed for system maintenance, scaling, and future development.