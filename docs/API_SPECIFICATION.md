# API Specification - Visual Agent Management Platform

## 🎯 **Overview**

This document provides comprehensive API specifications for the Visual Agent Management Platform, including REST endpoints, WebSocket protocols, and integration patterns for managing parallel Claude Code CLI agents.

**Base URLs:**
- **API**: `http://localhost:4005/api`
- **WebSocket**: `ws://localhost:4005/ws`
- **Health Check**: `http://localhost:4005/api/health`

---

## 🔗 **REST API Endpoints**

### **System Endpoints**

#### **GET /api/health**
Health check endpoint for system status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-09-03T10:30:00.000Z",
  "version": "2.1.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "cli_wrapper": "healthy"
  },
  "metrics": {
    "active_agents": 3,
    "pending_tasks": 5,
    "uptime_seconds": 3600,
    "memory_usage_mb": 256,
    "cpu_usage_percent": 15.5
  }
}
```

#### **GET /api/system/status**
Detailed system status and configuration.

**Response:**
```json
{
  "system_info": {
    "platform": "windows",
    "python_version": "3.11.0",
    "claude_cli_version": "1.2.3",
    "max_agents": 10,
    "agent_timeout_seconds": 300
  },
  "resource_limits": {
    "max_memory_mb": 2048,
    "max_cpu_percent": 80,
    "max_concurrent_tasks": 20
  },
  "feature_flags": {
    "multi_agent_enabled": true,
    "websocket_enabled": true,
    "persistence_enabled": true
  }
}
```

---

### **Agent Management Endpoints**

#### **POST /api/agents**
Create a new agent.

**Request Body:**
```json
{
  "role": "manager",
  "model": "sonnet",
  "name": "Primary Manager",
  "description": "Main coordination agent",
  "config": {
    "personality": "conservative",
    "specializations": ["task_breakdown", "coordination"],
    "resource_limits": {
      "memory_mb": 512,
      "timeout_seconds": 300,
      "max_concurrent_tasks": 5
    }
  }
}
```

**Response:**
```json
{
  "id": "agent-uuid-12345",
  "role": "manager",
  "model": "sonnet",
  "name": "Primary Manager",
  "status": "starting",
  "process_id": 12345,
  "created_at": "2024-09-03T10:30:00.000Z",
  "config": {
    "personality": "conservative",
    "specializations": ["task_breakdown", "coordination"],
    "resource_limits": {
      "memory_mb": 512,
      "timeout_seconds": 300,
      "max_concurrent_tasks": 5
    }
  }
}
```

**Status Codes:**
- `201 Created` - Agent created successfully
- `400 Bad Request` - Invalid configuration
- `409 Conflict` - Maximum agents reached
- `500 Internal Server Error` - Agent creation failed

#### **GET /api/agents**
List all agents with optional filtering.

**Query Parameters:**
- `role` (optional): Filter by agent role (`manager`, `worker`, `custom`)
- `status` (optional): Filter by status (`idle`, `busy`, `error`, `terminated`)
- `model` (optional): Filter by model (`sonnet`, `opus`, `haiku`)

**Response:**
```json
{
  "agents": [
    {
      "id": "agent-uuid-12345",
      "role": "manager",
      "model": "sonnet",
      "name": "Primary Manager",
      "status": "idle",
      "process_id": 12345,
      "created_at": "2024-09-03T10:30:00.000Z",
      "last_activity": "2024-09-03T10:35:00.000Z",
      "current_task": null,
      "performance_metrics": {
        "tasks_completed": 15,
        "average_response_time_ms": 1250,
        "success_rate": 0.95
      }
    }
  ],
  "total_count": 3,
  "active_count": 2,
  "idle_count": 1
}
```

#### **GET /api/agents/{agent_id}**
Get detailed information about a specific agent.

**Response:**
```json
{
  "id": "agent-uuid-12345",
  "role": "manager",
  "model": "sonnet",
  "name": "Primary Manager",
  "status": "idle",
  "process_id": 12345,
  "created_at": "2024-09-03T10:30:00.000Z",
  "last_activity": "2024-09-03T10:35:00.000Z",
  "current_task": null,
  "config": {
    "personality": "conservative",
    "specializations": ["task_breakdown", "coordination"],
    "resource_limits": {
      "memory_mb": 512,
      "timeout_seconds": 300,
      "max_concurrent_tasks": 5
    }
  },
  "performance_metrics": {
    "tasks_completed": 15,
    "tasks_failed": 1,
    "average_response_time_ms": 1250,
    "success_rate": 0.95,
    "memory_usage_mb": 128,
    "cpu_usage_percent": 5.2
  },
  "recent_tasks": [
    {
      "task_id": "task-001",
      "description": "Analyze user requirements",
      "status": "completed",
      "duration_ms": 2500,
      "completed_at": "2024-09-03T10:35:00.000Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Agent found
- `404 Not Found` - Agent not found

#### **PUT /api/agents/{agent_id}**
Update agent configuration.

**Request Body:**
```json
{
  "name": "Updated Manager Name",
  "config": {
    "personality": "aggressive",
    "resource_limits": {
      "memory_mb": 1024,
      "timeout_seconds": 600
    }
  }
}
```

**Response:**
```json
{
  "id": "agent-uuid-12345",
  "name": "Updated Manager Name",
  "config": {
    "personality": "aggressive",
    "resource_limits": {
      "memory_mb": 1024,
      "timeout_seconds": 600
    }
  },
  "updated_at": "2024-09-03T10:40:00.000Z"
}
```

#### **POST /api/agents/{agent_id}/pause**
Pause agent execution.

**Response:**
```json
{
  "id": "agent-uuid-12345",
  "status": "paused",
  "message": "Agent paused successfully",
  "paused_at": "2024-09-03T10:45:00.000Z"
}
```

#### **POST /api/agents/{agent_id}/resume**
Resume paused agent execution.

**Response:**
```json
{
  "id": "agent-uuid-12345",
  "status": "idle",
  "message": "Agent resumed successfully", 
  "resumed_at": "2024-09-03T10:47:00.000Z"
}
```

#### **DELETE /api/agents/{agent_id}**
Terminate and remove agent.

**Query Parameters:**
- `force` (optional): Force termination without graceful shutdown

**Response:**
```json
{
  "id": "agent-uuid-12345",
  "status": "terminated",
  "message": "Agent terminated successfully",
  "terminated_at": "2024-09-03T10:50:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Agent terminated successfully
- `404 Not Found` - Agent not found
- `409 Conflict` - Agent has active tasks (unless force=true)

---

### **Task Management Endpoints**

#### **POST /api/tasks**
Create a new task.

**Request Body:**
```json
{
  "title": "Implement User Authentication",
  "description": "Create a secure user authentication system with JWT tokens",
  "priority": 1,
  "assigned_agent_id": "agent-uuid-12345",
  "parent_task_id": null,
  "dependencies": [],
  "config": {
    "timeout_seconds": 1800,
    "retry_count": 3,
    "requires_human_approval": false
  },
  "metadata": {
    "project": "my-app",
    "tags": ["authentication", "security"],
    "estimated_duration_minutes": 30
  }
}
```

**Response:**
```json
{
  "id": "task-uuid-67890",
  "title": "Implement User Authentication",
  "description": "Create a secure user authentication system with JWT tokens",
  "status": "pending",
  "priority": 1,
  "assigned_agent_id": "agent-uuid-12345",
  "created_at": "2024-09-03T11:00:00.000Z",
  "estimated_completion": "2024-09-03T11:30:00.000Z",
  "config": {
    "timeout_seconds": 1800,
    "retry_count": 3,
    "requires_human_approval": false
  }
}
```

#### **GET /api/tasks**
List tasks with filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `in_progress`, `completed`, `failed`)
- `agent_id` (optional): Filter by assigned agent
- `priority` (optional): Filter by priority level
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-uuid-67890",
      "title": "Implement User Authentication",
      "status": "in_progress",
      "priority": 1,
      "assigned_agent_id": "agent-uuid-12345",
      "progress": 0.65,
      "created_at": "2024-09-03T11:00:00.000Z",
      "started_at": "2024-09-03T11:01:00.000Z",
      "estimated_completion": "2024-09-03T11:30:00.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 3,
    "total_items": 125,
    "items_per_page": 50
  },
  "summary": {
    "pending": 45,
    "in_progress": 12,
    "completed": 63,
    "failed": 5
  }
}
```

#### **GET /api/tasks/{task_id}**
Get detailed task information.

**Response:**
```json
{
  "id": "task-uuid-67890",
  "title": "Implement User Authentication",
  "description": "Create a secure user authentication system with JWT tokens",
  "status": "in_progress",
  "priority": 1,
  "assigned_agent_id": "agent-uuid-12345",
  "progress": 0.65,
  "created_at": "2024-09-03T11:00:00.000Z",
  "started_at": "2024-09-03T11:01:00.000Z",
  "estimated_completion": "2024-09-03T11:30:00.000Z",
  "config": {
    "timeout_seconds": 1800,
    "retry_count": 3,
    "requires_human_approval": false
  },
  "execution_log": [
    {
      "timestamp": "2024-09-03T11:01:00.000Z",
      "event": "task_started",
      "details": "Task execution began"
    },
    {
      "timestamp": "2024-09-03T11:05:30.000Z",
      "event": "progress_update",
      "details": "Authentication endpoints created",
      "progress": 0.35
    },
    {
      "timestamp": "2024-09-03T11:12:15.000Z",
      "event": "progress_update",
      "details": "JWT token generation implemented",
      "progress": 0.65
    }
  ],
  "result": null,
  "subtasks": [
    {
      "id": "subtask-001",
      "title": "Create login endpoint",
      "status": "completed"
    },
    {
      "id": "subtask-002", 
      "title": "Implement JWT middleware",
      "status": "in_progress"
    }
  ]
}
```

#### **PUT /api/tasks/{task_id}/assign**
Assign or reassign task to an agent.

**Request Body:**
```json
{
  "agent_id": "agent-uuid-54321",
  "reason": "Reassigning to worker agent with authentication specialization"
}
```

**Response:**
```json
{
  "id": "task-uuid-67890",
  "assigned_agent_id": "agent-uuid-54321",
  "previous_agent_id": "agent-uuid-12345",
  "reassigned_at": "2024-09-03T11:15:00.000Z",
  "reason": "Reassigning to worker agent with authentication specialization"
}
```

#### **POST /api/tasks/{task_id}/cancel**
Cancel task execution.

**Request Body:**
```json
{
  "reason": "Requirements changed - no longer needed"
}
```

**Response:**
```json
{
  "id": "task-uuid-67890",
  "status": "cancelled",
  "cancelled_at": "2024-09-03T11:20:00.000Z",
  "reason": "Requirements changed - no longer needed"
}
```

---

### **Workflow Management Endpoints**

#### **POST /api/workflows**
Create a new workflow with multiple coordinated tasks.

**Request Body:**
```json
{
  "name": "User Management System",
  "description": "Complete user management with authentication and profiles",
  "manager_agent_id": "agent-uuid-12345",
  "tasks": [
    {
      "title": "Implement Authentication",
      "description": "JWT-based authentication system",
      "priority": 1,
      "dependencies": []
    },
    {
      "title": "Create User Profiles",
      "description": "User profile management endpoints",
      "priority": 2,
      "dependencies": ["task-1"]
    }
  ],
  "config": {
    "auto_assign_workers": true,
    "max_concurrent_tasks": 3,
    "failure_handling": "retry_with_different_agent"
  }
}
```

**Response:**
```json
{
  "id": "workflow-uuid-abcdef",
  "name": "User Management System",
  "status": "created",
  "manager_agent_id": "agent-uuid-12345",
  "created_at": "2024-09-03T12:00:00.000Z",
  "estimated_duration_minutes": 90,
  "tasks": [
    {
      "id": "task-001",
      "title": "Implement Authentication",
      "status": "pending",
      "assigned_agent_id": null
    },
    {
      "id": "task-002",
      "title": "Create User Profiles", 
      "status": "blocked",
      "dependencies": ["task-001"]
    }
  ]
}
```

#### **POST /api/workflows/{workflow_id}/start**
Start workflow execution.

**Response:**
```json
{
  "id": "workflow-uuid-abcdef",
  "status": "running",
  "started_at": "2024-09-03T12:01:00.000Z",
  "message": "Workflow execution started with Manager agent"
}
```

#### **GET /api/workflows/{workflow_id}/status**
Get real-time workflow status.

**Response:**
```json
{
  "id": "workflow-uuid-abcdef",
  "name": "User Management System",
  "status": "running",
  "progress": 0.45,
  "started_at": "2024-09-03T12:01:00.000Z",
  "estimated_completion": "2024-09-03T13:31:00.000Z",
  "current_phase": "execution",
  "active_tasks": [
    {
      "id": "task-001",
      "title": "Implement Authentication",
      "status": "in_progress",
      "assigned_agent_id": "agent-uuid-54321",
      "progress": 0.8
    }
  ],
  "completed_tasks": [],
  "blocked_tasks": [
    {
      "id": "task-002",
      "title": "Create User Profiles",
      "status": "blocked",
      "reason": "Waiting for task-001 completion"
    }
  ],
  "metrics": {
    "total_tasks": 2,
    "completed_tasks": 0,
    "failed_tasks": 0,
    "active_agents": 2
  }
}
```

---

## 🔌 **WebSocket Protocol**

### **Connection Management**

#### **Connection Establishment**
```javascript
const socket = new WebSocket('ws://localhost:4005/ws');

socket.onopen = function(event) {
    console.log('Connected to Visual Agent Management Platform');
    
    // Send authentication if required
    socket.send(JSON.stringify({
        type: 'authenticate',
        token: 'jwt-token-here'
    }));
};
```

#### **Connection Authentication** (Optional)
```json
{
  "type": "authenticate",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "client_info": {
    "client_type": "react_frontend",
    "version": "2.1.0",
    "user_agent": "Mozilla/5.0..."
  }
}
```

**Response:**
```json
{
  "type": "authentication_result",
  "success": true,
  "session_id": "session-uuid-123456",
  "permissions": ["agent_management", "task_creation", "workflow_control"]
}
```

---

### **Real-Time Event Types**

#### **Agent Status Events**

**Agent Created:**
```json
{
  "type": "agent_created",
  "timestamp": "2024-09-03T10:30:00.000Z",
  "data": {
    "id": "agent-uuid-12345",
    "role": "manager",
    "model": "sonnet",
    "name": "Primary Manager",
    "status": "starting",
    "process_id": 12345
  }
}
```

**Agent Status Update:**
```json
{
  "type": "agent_status_update",
  "timestamp": "2024-09-03T10:32:00.000Z",
  "agent_id": "agent-uuid-12345",
  "previous_status": "starting",
  "current_status": "idle",
  "additional_data": {
    "memory_usage_mb": 128,
    "cpu_usage_percent": 2.1,
    "last_heartbeat": "2024-09-03T10:32:00.000Z"
  }
}
```

**Agent Error:**
```json
{
  "type": "agent_error",
  "timestamp": "2024-09-03T10:45:00.000Z", 
  "agent_id": "agent-uuid-12345",
  "error_type": "process_crash",
  "error_message": "Agent process terminated unexpectedly",
  "severity": "high",
  "recovery_action": "attempting_restart"
}
```

#### **Task Events**

**Task Created:**
```json
{
  "type": "task_created",
  "timestamp": "2024-09-03T11:00:00.000Z",
  "data": {
    "id": "task-uuid-67890",
    "title": "Implement User Authentication",
    "status": "pending",
    "assigned_agent_id": "agent-uuid-12345",
    "priority": 1
  }
}
```

**Task Progress Update:**
```json
{
  "type": "task_progress",
  "timestamp": "2024-09-03T11:10:00.000Z",
  "task_id": "task-uuid-67890",
  "agent_id": "agent-uuid-12345",
  "previous_progress": 0.35,
  "current_progress": 0.65,
  "progress_details": "JWT token generation implemented",
  "estimated_completion": "2024-09-03T11:25:00.000Z"
}
```

**Task Completed:**
```json
{
  "type": "task_completed",
  "timestamp": "2024-09-03T11:28:00.000Z",
  "task_id": "task-uuid-67890",
  "agent_id": "agent-uuid-12345",
  "duration_ms": 1680000,
  "result": {
    "success": true,
    "files_created": ["auth.py", "middleware.py", "models.py"],
    "output_summary": "Authentication system implemented with JWT tokens",
    "metrics": {
      "lines_of_code": 245,
      "files_modified": 3,
      "tests_created": 8
    }
  }
}
```

**Task Failed:**
```json
{
  "type": "task_failed",
  "timestamp": "2024-09-03T11:15:00.000Z",
  "task_id": "task-uuid-67890",
  "agent_id": "agent-uuid-12345",
  "error_message": "Unable to create authentication endpoints",
  "error_details": {
    "error_type": "dependency_missing",
    "failed_operation": "import_jwt_library",
    "suggestion": "Install python-jwt library"
  },
  "retry_count": 2,
  "will_retry": true,
  "next_retry_at": "2024-09-03T11:20:00.000Z"
}
```

#### **Agent Communication Events**

**Inter-Agent Message:**
```json
{
  "type": "agent_communication",
  "timestamp": "2024-09-03T11:05:00.000Z",
  "from_agent": "agent-uuid-12345",
  "to_agent": "agent-uuid-54321",
  "communication_type": "task_delegation",
  "message": {
    "type": "delegate_task",
    "task_summary": "Implement JWT authentication middleware",
    "context": "Part of larger authentication system",
    "requirements": ["python", "jwt", "flask"],
    "deadline": "2024-09-03T11:30:00.000Z"
  }
}
```

**Agent Coordination:**
```json
{
  "type": "agent_coordination",
  "timestamp": "2024-09-03T11:10:00.000Z",
  "coordination_type": "handoff",
  "participants": ["agent-uuid-12345", "agent-uuid-54321"],
  "context": {
    "task_id": "task-uuid-67890",
    "handoff_reason": "specialized_task",
    "transferred_data": {
      "progress_so_far": 0.35,
      "completed_steps": ["requirements_analysis", "design_spec"],
      "next_steps": ["implementation", "testing"]
    }
  }
}
```

#### **System Events**

**System Status Update:**
```json
{
  "type": "system_status",
  "timestamp": "2024-09-03T11:00:00.000Z",
  "status": "healthy",
  "metrics": {
    "active_agents": 3,
    "idle_agents": 1,
    "busy_agents": 2,
    "pending_tasks": 5,
    "running_tasks": 3,
    "completed_tasks_today": 47,
    "system_load": {
      "cpu_percent": 15.2,
      "memory_percent": 32.1,
      "disk_usage_percent": 45.0
    }
  },
  "alerts": []
}
```

**System Alert:**
```json
{
  "type": "system_alert",
  "timestamp": "2024-09-03T11:15:00.000Z",
  "alert_level": "warning",
  "alert_type": "high_memory_usage",
  "message": "System memory usage is above 80%",
  "metrics": {
    "current_memory_percent": 82.5,
    "threshold_percent": 80.0,
    "affected_agents": ["agent-uuid-12345", "agent-uuid-54321"]
  },
  "recommended_actions": ["terminate_idle_agents", "reduce_concurrent_tasks"],
  "auto_resolution_attempted": false
}
```

---

### **Client Commands**

#### **Agent Management Commands**

**Create Agent:**
```json
{
  "type": "create_agent",
  "request_id": "req-12345",
  "config": {
    "role": "worker",
    "model": "sonnet",
    "name": "Authentication Specialist",
    "specializations": ["authentication", "security"],
    "resource_limits": {
      "memory_mb": 256,
      "timeout_seconds": 600
    }
  }
}
```

**Terminate Agent:**
```json
{
  "type": "terminate_agent",
  "request_id": "req-12346",
  "agent_id": "agent-uuid-12345",
  "force": false,
  "reason": "No longer needed"
}
```

#### **Task Management Commands**

**Assign Task:**
```json
{
  "type": "assign_task",
  "request_id": "req-12347",
  "agent_id": "agent-uuid-12345",
  "task": {
    "title": "Create Database Schema",
    "description": "Design and implement user database schema",
    "priority": 2,
    "config": {
      "timeout_seconds": 900,
      "requires_approval": false
    }
  }
}
```

**Human Intervention:**
```json
{
  "type": "human_intervention",
  "request_id": "req-12348",
  "agent_id": "agent-uuid-12345",
  "task_id": "task-uuid-67890",
  "intervention_type": "guidance",
  "message": "Use PostgreSQL instead of MySQL for the database",
  "allow_continuation": true
}
```

#### **System Commands**

**Request System Status:**
```json
{
  "type": "get_system_status",
  "request_id": "req-12349"
}
```

**Emergency Stop:**
```json
{
  "type": "emergency_stop",
  "request_id": "req-12350",
  "reason": "Critical system issue detected",
  "stop_all_agents": true,
  "cancel_all_tasks": true
}
```

---

## 🔐 **Authentication & Security**

### **JWT Token Authentication**

#### **Token Format:**
```json
{
  "sub": "user-uuid-12345",
  "iat": 1693737600,
  "exp": 1693824000,
  "permissions": [
    "agent:create",
    "agent:read", 
    "agent:update",
    "agent:delete",
    "task:create",
    "task:assign",
    "workflow:manage"
  ],
  "session_id": "session-uuid-67890"
}
```

#### **Permission System:**
```typescript
interface Permission {
  resource: 'agent' | 'task' | 'workflow' | 'system';
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage';
  scope?: string; // Optional resource-specific scope
}

// Example permission checks
const permissions = [
  'agent:create',    // Can create agents
  'agent:read',      // Can view agent information
  'agent:delete',    // Can terminate agents
  'task:create',     // Can create tasks
  'task:assign',     // Can assign tasks to agents
  'workflow:manage', // Full workflow management
  'system:admin'     // System administration
];
```

#### **Authorization Headers:**
```http
# HTTP Requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# WebSocket Authentication
{
  "type": "authenticate",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### **Security Best Practices**

#### **Input Validation:**
All API endpoints validate input according to these schemas:

```python
# Agent creation validation
agent_create_schema = {
    "role": {"type": "string", "enum": ["manager", "worker", "custom"]},
    "model": {"type": "string", "enum": ["sonnet", "opus", "haiku"]},
    "name": {"type": "string", "minlength": 1, "maxlength": 100},
    "config": {
        "type": "object",
        "properties": {
            "resource_limits": {
                "type": "object",
                "properties": {
                    "memory_mb": {"type": "integer", "minimum": 64, "maximum": 2048},
                    "timeout_seconds": {"type": "integer", "minimum": 30, "maximum": 3600}
                }
            }
        }
    }
}

# Task creation validation  
task_create_schema = {
    "title": {"type": "string", "minlength": 1, "maxlength": 255},
    "description": {"type": "string", "maxlength": 10000},
    "priority": {"type": "integer", "minimum": 0, "maximum": 10},
    "assigned_agent_id": {"type": "string", "format": "uuid"},
    "config": {
        "type": "object",
        "properties": {
            "timeout_seconds": {"type": "integer", "minimum": 60, "maximum": 7200},
            "retry_count": {"type": "integer", "minimum": 0, "maximum": 5}
        }
    }
}
```

#### **Rate Limiting:**
```python
# Rate limiting configuration
RATE_LIMITS = {
    'agent_creation': '10/hour',     # Max 10 agents per hour
    'task_creation': '100/hour',     # Max 100 tasks per hour
    'api_requests': '1000/hour',     # Max 1000 API requests per hour
    'websocket_messages': '500/minute'  # Max 500 WS messages per minute
}

# Headers included in responses
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 1693741200
```

---

## 📊 **Response Codes & Error Handling**

### **Standard HTTP Status Codes**

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful operation |
| 201 | Created | Resource created successfully |
| 202 | Accepted | Request accepted, processing async |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., max agents reached) |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Upstream service error |
| 503 | Service Unavailable | System overloaded |

### **Error Response Format**

```json
{
  "error": {
    "code": "AGENT_CREATION_FAILED",
    "message": "Unable to create agent due to resource constraints",
    "details": {
      "reason": "maximum_agents_reached",
      "current_count": 10,
      "maximum_allowed": 10,
      "suggestion": "Terminate an existing agent before creating a new one"
    },
    "request_id": "req-12345",
    "timestamp": "2024-09-03T11:30:00.000Z"
  }
}
```

### **WebSocket Error Format**

```json
{
  "type": "error",
  "error_code": "TASK_ASSIGNMENT_FAILED",
  "message": "Cannot assign task to agent in error state",
  "details": {
    "agent_id": "agent-uuid-12345",
    "agent_status": "error",
    "task_id": "task-uuid-67890",
    "suggestion": "Wait for agent recovery or assign to different agent"
  },
  "request_id": "req-12347",
  "timestamp": "2024-09-03T11:35:00.000Z"
}
```

### **Common Error Codes**

#### **Agent Management Errors**
- `AGENT_CREATION_FAILED` - Unable to create agent
- `AGENT_NOT_FOUND` - Specified agent does not exist
- `AGENT_TERMINATION_FAILED` - Unable to terminate agent
- `MAXIMUM_AGENTS_REACHED` - Agent limit exceeded
- `AGENT_CONFIGURATION_INVALID` - Invalid agent configuration

#### **Task Management Errors**
- `TASK_CREATION_FAILED` - Unable to create task
- `TASK_NOT_FOUND` - Specified task does not exist
- `TASK_ASSIGNMENT_FAILED` - Unable to assign task to agent
- `TASK_EXECUTION_TIMEOUT` - Task exceeded time limit
- `TASK_DEPENDENCY_UNRESOLVED` - Task dependencies not met

#### **System Errors**
- `SYSTEM_OVERLOAD` - System resource constraints
- `CLI_WRAPPER_ERROR` - Claude CLI integration error  
- `DATABASE_CONNECTION_FAILED` - Database connectivity issue
- `WEBSOCKET_CONNECTION_LOST` - Real-time communication error
- `AUTHENTICATION_FAILED` - Invalid or expired credentials

---

## 🧪 **API Testing & Examples**

### **Complete Workflow Example**

```bash
# 1. Check system health
curl -X GET http://localhost:4005/api/health

# 2. Create Manager agent
curl -X POST http://localhost:4005/api/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "role": "manager",
    "model": "sonnet", 
    "name": "Project Manager",
    "config": {
      "personality": "analytical",
      "resource_limits": {
        "memory_mb": 512,
        "timeout_seconds": 300
      }
    }
  }'

# Response: {"id": "agent-manager-123", "status": "starting", ...}

# 3. Create Worker agent  
curl -X POST http://localhost:4005/api/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "role": "worker",
    "model": "sonnet",
    "name": "Authentication Worker",
    "config": {
      "specializations": ["authentication", "security"],
      "resource_limits": {
        "memory_mb": 256,
        "timeout_seconds": 600
      }
    }
  }'

# Response: {"id": "agent-worker-456", "status": "starting", ...}

# 4. Create workflow task
curl -X POST http://localhost:4005/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Implement JWT Authentication",
    "description": "Create secure JWT-based authentication system",
    "priority": 1,
    "assigned_agent_id": "agent-manager-123",
    "config": {
      "timeout_seconds": 1800,
      "retry_count": 2
    }
  }'

# Response: {"id": "task-auth-789", "status": "pending", ...}

# 5. Monitor task progress
curl -X GET http://localhost:4005/api/tasks/task-auth-789 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 6. Get all agents status
curl -X GET http://localhost:4005/api/agents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 7. Terminate agents when done
curl -X DELETE http://localhost:4005/api/agents/agent-manager-123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

curl -X DELETE http://localhost:4005/api/agents/agent-worker-456 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **WebSocket Integration Example**

```javascript
// Complete WebSocket integration example
const socket = new WebSocket('ws://localhost:4005/ws');

// Connection handling
socket.onopen = function(event) {
    console.log('Connected to Visual Agent Management Platform');
    
    // Authenticate
    socket.send(JSON.dumps({
        type: 'authenticate',
        token: localStorage.getItem('jwt_token')
    }));
};

// Message handling
socket.onmessage = function(event) {
    const message = JSON.parse(event.data);
    
    switch(message.type) {
        case 'agent_status_update':
            updateAgentUI(message.agent_id, message.current_status);
            break;
            
        case 'task_progress':
            updateTaskProgress(message.task_id, message.current_progress);
            break;
            
        case 'agent_communication':
            displayAgentMessage(message.from_agent, message.to_agent, message.content);
            break;
            
        case 'system_alert':
            showSystemAlert(message.alert_level, message.message);
            break;
            
        case 'error':
            handleError(message.error_code, message.message);
            break;
    }
};

// Send commands to backend
function createAgent(config) {
    socket.send(JSON.stringify({
        type: 'create_agent',
        request_id: generateRequestId(),
        config: config
    }));
}

function assignTask(agentId, task) {
    socket.send(JSON.stringify({
        type: 'assign_task',
        request_id: generateRequestId(),
        agent_id: agentId,
        task: task
    }));
}
```

---

## 📋 **API Client Libraries**

### **Python Client Library**

```python
# example_client.py
import asyncio
import aiohttp
import websockets
import json
from typing import Dict, Any, Optional, List

class VisualAgentPlatformClient:
    def __init__(self, base_url: str = "http://localhost:4005", 
                 websocket_url: str = "ws://localhost:4005/ws"):
        self.base_url = base_url
        self.websocket_url = websocket_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.auth_token: Optional[str] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
        if self.websocket:
            await self.websocket.close()
    
    def set_auth_token(self, token: str):
        self.auth_token = token
    
    async def create_agent(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new agent"""
        headers = {"Authorization": f"Bearer {self.auth_token}"} if self.auth_token else {}
        
        async with self.session.post(
            f"{self.base_url}/api/agents",
            json=config,
            headers=headers
        ) as response:
            return await response.json()
    
    async def get_agents(self, **filters) -> List[Dict[str, Any]]:
        """Get all agents with optional filtering"""
        headers = {"Authorization": f"Bearer {self.auth_token}"} if self.auth_token else {}
        params = {k: v for k, v in filters.items() if v is not None}
        
        async with self.session.get(
            f"{self.base_url}/api/agents",
            params=params,
            headers=headers
        ) as response:
            data = await response.json()
            return data.get("agents", [])
    
    async def create_task(self, task_config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new task"""
        headers = {"Authorization": f"Bearer {self.auth_token}"} if self.auth_token else {}
        
        async with self.session.post(
            f"{self.base_url}/api/tasks",
            json=task_config,
            headers=headers
        ) as response:
            return await response.json()
    
    async def connect_websocket(self, message_handler=None):
        """Connect to WebSocket for real-time updates"""
        self.websocket = await websockets.connect(self.websocket_url)
        
        # Authenticate if token available
        if self.auth_token:
            await self.websocket.send(json.dumps({
                "type": "authenticate",
                "token": self.auth_token
            }))
        
        if message_handler:
            async for message in self.websocket:
                data = json.loads(message)
                await message_handler(data)

# Usage example
async def main():
    async with VisualAgentPlatformClient() as client:
        # Create agents
        manager = await client.create_agent({
            "role": "manager",
            "model": "sonnet",
            "name": "Task Coordinator"
        })
        
        worker = await client.create_agent({
            "role": "worker", 
            "model": "sonnet",
            "name": "Implementation Specialist"
        })
        
        # Create task
        task = await client.create_task({
            "title": "Build API Endpoint",
            "description": "Create REST API for user management",
            "assigned_agent_id": manager["id"],
            "priority": 1
        })
        
        # Monitor via WebSocket
        async def handle_message(data):
            print(f"Received: {data['type']} - {data}")
        
        await client.connect_websocket(handle_message)

if __name__ == "__main__":
    asyncio.run(main())
```

### **JavaScript/TypeScript Client**

```typescript
// visual-agent-client.ts
export interface AgentConfig {
  role: 'manager' | 'worker' | 'custom';
  model: 'sonnet' | 'opus' | 'haiku';
  name: string;
  config?: {
    personality?: string;
    specializations?: string[];
    resource_limits?: {
      memory_mb?: number;
      timeout_seconds?: number;
    };
  };
}

export interface TaskConfig {
  title: string;
  description: string;
  priority?: number;
  assigned_agent_id?: string;
  config?: {
    timeout_seconds?: number;
    retry_count?: number;
    requires_human_approval?: boolean;
  };
}

export class VisualAgentPlatformClient {
  private baseUrl: string;
  private websocketUrl: string;
  private authToken?: string;
  private socket?: WebSocket;
  
  constructor(baseUrl = 'http://localhost:4005', websocketUrl = 'ws://localhost:4005/ws') {
    this.baseUrl = baseUrl;
    this.websocketUrl = websocketUrl;
  }
  
  setAuthToken(token: string) {
    this.authToken = token;
  }
  
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }
  
  async createAgent(config: AgentConfig): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/agents`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`Agent creation failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getAgents(filters?: Record<string, any>): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const url = `${this.baseUrl}/api/agents${params.toString() ? `?${params}` : ''}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.agents || [];
  }
  
  async createTask(taskConfig: TaskConfig): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(taskConfig),
    });
    
    if (!response.ok) {
      throw new Error(`Task creation failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async terminateAgent(agentId: string, force = false): Promise<any> {
    const url = `${this.baseUrl}/api/agents/${agentId}${force ? '?force=true' : ''}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Agent termination failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  connectWebSocket(messageHandler: (data: any) => void): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.websocketUrl);
      
      this.socket.onopen = () => {
        // Authenticate if token available
        if (this.authToken) {
          this.socket!.send(JSON.stringify({
            type: 'authenticate',
            token: this.authToken
          }));
        }
        resolve(this.socket!);
      };
      
      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        messageHandler(data);
      };
      
      this.socket.onerror = (error) => {
        reject(error);
      };
    });
  }
  
  sendWebSocketMessage(message: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not connected');
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }
  }
}

// Usage example
const client = new VisualAgentPlatformClient();

async function example() {
  try {
    // Create manager agent
    const manager = await client.createAgent({
      role: 'manager',
      model: 'sonnet',
      name: 'Project Manager',
      config: {
        personality: 'analytical',
        resource_limits: {
          memory_mb: 512,
          timeout_seconds: 300
        }
      }
    });
    
    console.log('Manager created:', manager);
    
    // Connect WebSocket for real-time updates
    await client.connectWebSocket((data) => {
      console.log('WebSocket message:', data);
    });
    
    // Create task
    const task = await client.createTask({
      title: 'Implement Authentication',
      description: 'Create JWT-based authentication system',
      assigned_agent_id: manager.id,
      priority: 1
    });
    
    console.log('Task created:', task);
    
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

**This comprehensive API specification provides all the necessary endpoints, protocols, and examples for integrating with the Visual Agent Management Platform. Use this document as the definitive reference for building applications that interact with the platform's agent management, task coordination, and real-time communication capabilities.**