# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-01-docker-monitoring-setup/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Endpoints

### GET /api/docker/containers

**Purpose:** Retrieve list of all Docker containers with their current status
**Parameters:** 
- `all` (boolean, optional): Include stopped containers (default: false)
- `filters` (string, optional): JSON filters for container selection
**Response:** 
```json
{
  "containers": [
    {
      "id": "container_id",
      "name": "container_name",
      "image": "image:tag",
      "status": "running|stopped|restarting",
      "state": "healthy|unhealthy|starting",
      "uptime": 3600,
      "restartCount": 0,
      "created": "2025-09-01T10:00:00Z"
    }
  ]
}
```
**Errors:** 
- 500: Docker daemon connection failed
- 503: Docker service unavailable

### GET /api/docker/containers/:id/stats

**Purpose:** Get real-time resource usage statistics for a specific container
**Parameters:**
- `id` (string): Container ID or name
- `stream` (boolean, optional): Stream stats via WebSocket (default: false)
**Response:**
```json
{
  "cpu": {
    "usage_percent": 45.2,
    "system_cpu_usage": 1000000,
    "online_cpus": 4
  },
  "memory": {
    "usage": 524288000,
    "limit": 2147483648,
    "usage_percent": 24.4
  },
  "network": {
    "rx_bytes": 1024000,
    "tx_bytes": 2048000
  },
  "disk": {
    "read_bytes": 1024000,
    "write_bytes": 2048000
  },
  "timestamp": "2025-09-01T10:00:00Z"
}
```
**Errors:**
- 404: Container not found
- 500: Failed to retrieve stats

### GET /api/docker/containers/:id/logs

**Purpose:** Retrieve logs from a specific container
**Parameters:**
- `id` (string): Container ID or name
- `since` (string, optional): Show logs since timestamp (RFC3339)
- `until` (string, optional): Show logs until timestamp (RFC3339)
- `tail` (number, optional): Number of lines from end (default: 100)
- `follow` (boolean, optional): Stream logs via WebSocket
- `timestamps` (boolean, optional): Include timestamps (default: true)
**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-09-01T10:00:00Z",
      "stream": "stdout|stderr",
      "message": "Log message content",
      "container_id": "container_id"
    }
  ],
  "total_lines": 100
}
```
**Errors:**
- 404: Container not found
- 400: Invalid time range parameters

### POST /api/docker/containers/:id/actions

**Purpose:** Perform actions on a container (start, stop, restart)
**Parameters:**
- `id` (string): Container ID or name
- Body: `{ "action": "start|stop|restart" }`
**Response:**
```json
{
  "success": true,
  "message": "Container restarted successfully",
  "container_id": "container_id",
  "new_status": "running"
}
```
**Errors:**
- 404: Container not found
- 400: Invalid action
- 403: Action not permitted
- 409: Container state conflict

### GET /api/docker/events

**Purpose:** Stream Docker events via WebSocket for real-time updates
**Parameters:**
- `since` (string, optional): Show events since timestamp
- `filters` (string, optional): JSON filters for event types
**Response:** WebSocket stream of events
```json
{
  "type": "container",
  "action": "start|stop|die|restart",
  "actor": {
    "id": "container_id",
    "attributes": {
      "name": "container_name",
      "image": "image:tag"
    }
  },
  "timestamp": "2025-09-01T10:00:00Z"
}
```
**Errors:**
- 500: Failed to establish event stream

### GET /api/docker/metrics/history

**Purpose:** Retrieve historical metrics for trend analysis
**Parameters:**
- `container_id` (string, optional): Specific container or all
- `metric_type` (string): cpu|memory|network|disk
- `from` (string): Start timestamp (RFC3339)
- `to` (string): End timestamp (RFC3339)
- `resolution` (string, optional): 5s|1m|5m|1h (default: auto based on range)
**Response:**
```json
{
  "metrics": [
    {
      "timestamp": "2025-09-01T10:00:00Z",
      "container_id": "container_id",
      "value": 45.2,
      "metric_type": "cpu"
    }
  ],
  "resolution": "1m",
  "total_points": 1440
}
```
**Errors:**
- 400: Invalid time range or resolution
- 404: No data found for specified range

## Controllers

### DockerContainerController
- **Purpose**: Manages all container-related operations
- **Methods**:
  - `listContainers()`: Returns paginated container list
  - `getContainerStats(id)`: Retrieves real-time metrics
  - `getContainerLogs(id, options)`: Fetches container logs
  - `performContainerAction(id, action)`: Executes container actions
- **Dependencies**: Docker API client, metrics service
- **Error Handling**: Standardized error responses with logging

### DockerEventsController
- **Purpose**: Manages Docker event streaming
- **Methods**:
  - `streamEvents()`: WebSocket event streaming
  - `getEventHistory(filters)`: Historical event retrieval
- **Dependencies**: Docker events API, WebSocket manager
- **Error Handling**: Graceful connection handling and reconnection

### MetricsController
- **Purpose**: Handles historical metrics and analytics
- **Methods**:
  - `getMetricHistory(params)`: Time-series data retrieval
  - `getAggregatedMetrics(timeframe)`: Statistical summaries
- **Dependencies**: Time-series database, aggregation service
- **Error Handling**: Validation and data availability checks

## WebSocket Events

### Container Status Updates
```json
{
  "event": "container.status",
  "data": {
    "id": "container_id",
    "status": "running",
    "health": "healthy"
  }
}
```

### Metric Updates
```json
{
  "event": "metrics.update",
  "data": {
    "container_id": "container_id",
    "metrics": { /* current stats */ }
  }
}
```

### Alert Notifications
```json
{
  "event": "alert",
  "data": {
    "severity": "warning|error",
    "container_id": "container_id",
    "message": "CPU usage exceeded 80%",
    "threshold": 80,
    "current_value": 85.5
  }
}
```