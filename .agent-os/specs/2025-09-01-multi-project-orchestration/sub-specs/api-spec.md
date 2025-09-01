# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-01-multi-project-orchestration/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Endpoints

### Project Management

**POST /api/projects**
Create a new project instance
```json
Request:
{
  "name": "project-name",
  "workingDirectory": "/path/to/project",
  "configuration": {
    "dualAgentMode": true,
    "maxIterations": 10,
    "resourceLimits": {
      "maxMemory": "1GB",
      "maxAgents": 2
    }
  },
  "priority": "high"
}

Response:
{
  "projectId": "uuid",
  "status": "created",
  "configuration": { /* resolved config */ }
}
```

**GET /api/projects**
List all projects with status and metrics
```json
Response:
{
  "projects": [
    {
      "projectId": "uuid",
      "name": "project-name",
      "status": "active",
      "metrics": {
        "activeAgents": 2,
        "tasksCompleted": 15,
        "resourceUsage": {
          "memory": "512MB",
          "cpu": "45%"
        }
      },
      "created": "2025-09-01T10:00:00Z",
      "lastActivity": "2025-09-01T12:30:00Z"
    }
  ]
}
```

**GET /api/projects/{projectId}**
Get detailed project information
```json
Response:
{
  "projectId": "uuid",
  "name": "project-name",
  "status": "active",
  "configuration": { /* project config */ },
  "agents": [
    {
      "agentId": "agent-uuid",
      "type": "manager",
      "status": "busy",
      "currentTask": "Planning authentication system"
    }
  ],
  "dependencies": ["project-uuid-2"],
  "metrics": { /* detailed metrics */ }
}
```

**PUT /api/projects/{projectId}/status**
Update project status (start, pause, stop)
```json
Request:
{
  "action": "pause",
  "reason": "Resource reallocation"
}

Response:
{
  "projectId": "uuid",
  "previousStatus": "active",
  "currentStatus": "paused",
  "timestamp": "2025-09-01T12:45:00Z"
}
```

**DELETE /api/projects/{projectId}**
Remove project and cleanup resources
```json
Response:
{
  "projectId": "uuid",
  "status": "deleted",
  "cleanupResults": {
    "agentsTerminated": 2,
    "resourcesFreed": true,
    "dataArchived": true
  }
}
```

### Task Management

**POST /api/projects/{projectId}/tasks**
Submit a new task to project
```json
Request:
{
  "description": "Implement user authentication",
  "priority": "high",
  "estimatedComplexity": 8,
  "dependencies": ["task-uuid-1"],
  "tags": ["authentication", "security"]
}

Response:
{
  "taskId": "task-uuid",
  "projectId": "project-uuid",
  "status": "queued",
  "assignedAgents": [],
  "estimatedDuration": "2 hours"
}
```

**GET /api/projects/{projectId}/tasks**
List project tasks with filtering
```json
Query Parameters:
?status=active&priority=high&limit=20&offset=0

Response:
{
  "tasks": [
    {
      "taskId": "task-uuid",
      "description": "Implement user authentication",
      "status": "in_progress",
      "assignedAgents": ["agent-uuid"],
      "progress": 0.65,
      "created": "2025-09-01T10:30:00Z",
      "updated": "2025-09-01T12:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

### Resource Management

**GET /api/orchestration/resources**
Get system-wide resource allocation
```json
Response:
{
  "totalResources": {
    "agents": {
      "total": 10,
      "available": 3,
      "busy": 7
    },
    "memory": {
      "total": "16GB",
      "used": "12GB",
      "available": "4GB"
    },
    "cpu": {
      "cores": 8,
      "utilization": "75%"
    }
  },
  "projectAllocations": [
    {
      "projectId": "uuid",
      "agents": 2,
      "memory": "2GB",
      "cpuShare": "25%"
    }
  ]
}
```

**POST /api/orchestration/rebalance**
Trigger resource rebalancing
```json
Request:
{
  "strategy": "priority_based",
  "forceReallocation": false
}

Response:
{
  "rebalanceId": "rebalance-uuid",
  "status": "initiated",
  "estimatedDuration": "30 seconds",
  "affectedProjects": ["uuid1", "uuid2"]
}
```

### Monitoring and Analytics

**GET /api/projects/{projectId}/metrics**
Get project-specific metrics
```json
Query Parameters:
?timeRange=last_24h&granularity=hourly

Response:
{
  "projectId": "uuid",
  "timeRange": {
    "start": "2025-08-31T12:30:00Z",
    "end": "2025-09-01T12:30:00Z"
  },
  "metrics": {
    "tasksCompleted": 25,
    "averageTaskDuration": "45 minutes",
    "agentEfficiency": 0.85,
    "errorRate": 0.02,
    "resourceUtilization": {
      "memory": [/* time series data */],
      "cpu": [/* time series data */]
    }
  }
}
```

**GET /api/orchestration/analytics**
Get cross-project analytics
```json
Response:
{
  "overview": {
    "totalProjects": 5,
    "activeProjects": 3,
    "completedTasks": 150,
    "systemEfficiency": 0.82
  },
  "trends": {
    "taskCompletionRate": [/* time series */],
    "resourceUtilization": [/* time series */],
    "projectCreationRate": [/* time series */]
  },
  "insights": [
    {
      "type": "optimization_opportunity",
      "message": "Project B could benefit from additional agent allocation",
      "confidence": 0.87
    }
  ]
}
```

## Controllers

### ProjectController
- **Purpose**: Manage project lifecycle and configuration
- **Responsibilities**: CRUD operations for projects, status management, configuration validation
- **Key Methods**: `createProject()`, `updateProjectStatus()`, `deleteProject()`, `validateConfiguration()`

### TaskController
- **Purpose**: Handle task submission and tracking within projects
- **Responsibilities**: Task queueing, assignment to agents, progress tracking, completion handling
- **Key Methods**: `submitTask()`, `assignToAgent()`, `updateProgress()`, `completeTask()`

### OrchestrationController
- **Purpose**: Coordinate resources across multiple projects
- **Responsibilities**: Resource allocation, load balancing, priority management, system optimization
- **Key Methods**: `allocateResources()`, `rebalanceLoad()`, `optimizeAllocation()`, `handleResourceContention()`

### MonitoringController
- **Purpose**: Provide metrics and analytics across projects
- **Responsibilities**: Data aggregation, metric calculation, insight generation, anomaly detection
- **Key Methods**: `collectMetrics()`, `generateAnalytics()`, `detectAnomalies()`, `createInsights()`

### DependencyController
- **Purpose**: Manage cross-project dependencies and coordination
- **Responsibilities**: Dependency resolution, conflict detection, synchronization coordination
- **Key Methods**: `resolveDependencies()`, `detectConflicts()`, `coordinateProjects()`, `validateDependencyGraph()`