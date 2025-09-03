# Technical Specification: Advanced Monitoring & Analytics Platform

## 1. Architecture Overview

### 1.1 System Architecture
```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Data Sources  │───▶│  Collection  │───▶│   Processing    │
│                 │    │   Gateway    │    │    Pipeline     │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                      │
┌─────────────────┐    ┌──────────────┐    ┌─────────▼─────────┐
│   Dashboard     │◀───│  Query API   │◀───│  TimescaleDB     │
│   Components    │    │   Service    │    │  (Time-Series)   │
└─────────────────┘    └──────────────┘    └───────────────────┘
```

### 1.2 Data Flow Pipeline
- **Ingestion**: Hook scripts → Collection Gateway (HTTP/WebSocket)
- **Processing**: Stream processing → Aggregation → Storage
- **Query**: Real-time queries → Dashboard rendering
- **Streaming**: WebSocket/SSE → Live updates

## 2. Data Collection Pipeline

### 2.1 Metrics Schema
```typescript
interface MetricEvent {
  id: string;
  timestamp: Date;
  source: 'claude-cli' | 'dual-agent' | 'system';
  type: 'performance' | 'error' | 'coordination' | 'quality';
  projectId: string;
  sessionId: string;
  agentType?: 'manager' | 'worker';
  payload: MetricPayload;
}

interface PerformanceMetric {
  operation: string;
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  success: boolean;
}
```

### 2.2 Collection Gateway
```typescript
class MetricsCollector {
  private wsServer: WebSocketServer;
  private httpServer: Express;
  private buffer: CircularBuffer<MetricEvent>;
  
  async collectMetric(event: MetricEvent): Promise<void> {
    await this.validate(event);
    await this.enrich(event);
    await this.buffer.push(event);
    await this.broadcastRealtime(event);
  }
}
```

## 3. TimescaleDB Schema Design

### 3.1 Hypertables Structure
```sql
-- Core metrics hypertable
CREATE TABLE metrics (
  time TIMESTAMPTZ NOT NULL,
  metric_id TEXT NOT NULL,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  project_id TEXT,
  session_id TEXT,
  agent_type TEXT,
  value JSONB,
  tags JSONB
);

SELECT create_hypertable('metrics', 'time', chunk_time_interval => INTERVAL '1 hour');

-- Performance-specific table
CREATE TABLE performance_metrics (
  time TIMESTAMPTZ NOT NULL,
  operation TEXT NOT NULL,
  duration_ms INTEGER,
  memory_mb FLOAT,
  cpu_percent FLOAT,
  success BOOLEAN,
  project_id TEXT
) INHERITS (metrics);

-- Agent coordination table
CREATE TABLE coordination_events (
  time TIMESTAMPTZ NOT NULL,
  manager_id TEXT,
  worker_id TEXT,
  phase TEXT,
  task_id TEXT,
  coordination_score FLOAT,
  latency_ms INTEGER
) INHERITS (metrics);
```

### 3.2 Continuous Aggregates
```sql
-- 5-minute aggregations
CREATE MATERIALIZED VIEW metrics_5min AS
SELECT 
  time_bucket('5 minutes', time) AS bucket,
  source, type, project_id,
  COUNT(*) as event_count,
  AVG((value->>'duration')::numeric) as avg_duration,
  MAX((value->>'duration')::numeric) as max_duration,
  AVG((value->>'memory')::numeric) as avg_memory
FROM metrics
GROUP BY bucket, source, type, project_id;

SELECT add_continuous_aggregate_policy('metrics_5min',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '1 minute');
```

## 4. Real-time Streaming Architecture

### 4.1 WebSocket Implementation
```typescript
class RealtimeStreamer {
  private connections: Map<string, WebSocket>;
  private subscriptions: Map<string, string[]>;
  
  subscribe(connectionId: string, filters: MetricFilter[]): void {
    this.subscriptions.set(connectionId, filters);
  }
  
  async broadcast(event: MetricEvent): Promise<void> {
    const matchingConnections = this.getMatchingSubscriptions(event);
    await Promise.all(
      matchingConnections.map(conn => 
        this.sendSafe(conn, event)
      )
    );
  }
}
```

### 4.2 Server-Sent Events (SSE)
```typescript
app.get('/api/metrics/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  const subscription = new MetricSubscription(req.query.filters);
  subscription.onEvent((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
});
```

## 5. Analytics Algorithms

### 5.1 Anomaly Detection
```typescript
class AnomalyDetector {
  private readonly ZSCORE_THRESHOLD = 3;
  private readonly WINDOW_SIZE = 100;
  
  detectAnomalies(metrics: TimeSeries): Anomaly[] {
    const baseline = this.calculateBaseline(metrics);
    return metrics
      .filter(point => Math.abs(this.zScore(point, baseline)) > this.ZSCORE_THRESHOLD)
      .map(point => ({
        timestamp: point.timestamp,
        value: point.value,
        severity: this.calculateSeverity(point, baseline),
        type: this.classifyAnomaly(point, baseline)
      }));
  }
}
```

### 5.2 Trend Analysis
```typescript
class TrendAnalyzer {
  calculateTrend(data: DataPoint[], window: number = 10): TrendResult {
    const regression = this.linearRegression(data.slice(-window));
    return {
      slope: regression.slope,
      direction: regression.slope > 0 ? 'increasing' : 'decreasing',
      confidence: regression.r2,
      forecast: this.forecast(regression, 5)
    };
  }
}
```

## 6. Dashboard Components (React)

### 6.1 Metric Visualization Components
```typescript
interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: TrendData;
  status: 'healthy' | 'warning' | 'critical';
  realtime?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, value, trend, status, realtime 
}) => {
  const [currentValue, setCurrentValue] = useState(value);
  
  useWebSocket('/api/metrics/stream', {
    filter: { type: 'performance', metric: title },
    onMessage: (event) => realtime && setCurrentValue(event.value)
  });
  
  return (
    <Card className={`metric-card ${status}`}>
      <CardHeader>{title}</CardHeader>
      <CardContent>
        <div className="value">{currentValue}</div>
        {trend && <TrendIndicator data={trend} />}
      </CardContent>
    </Card>
  );
};
```

### 6.2 Time Series Chart
```typescript
const TimeSeriesChart: React.FC<{
  data: TimeSeries[];
  aggregation: '1m' | '5m' | '1h' | '1d';
}> = ({ data, aggregation }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <XAxis dataKey="timestamp" />
        <YAxis />
        <Tooltip formatter={formatTooltip} />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#8884d8"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
```

## 7. Alert Engine

### 7.1 Rule Engine Architecture
```typescript
interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: NotificationChannel[];
  cooldown: number; // seconds
}

class AlertEngine {
  private rules: Map<string, AlertRule>;
  private ruleEvaluator: RuleEvaluator;
  
  async evaluateRules(metric: MetricEvent): Promise<Alert[]> {
    const applicableRules = this.getApplicableRules(metric);
    const alerts: Alert[] = [];
    
    for (const rule of applicableRules) {
      if (await this.ruleEvaluator.evaluate(rule, metric)) {
        alerts.push(await this.createAlert(rule, metric));
      }
    }
    
    return alerts;
  }
}
```

### 7.2 Notification Channels
```typescript
interface NotificationChannel {
  type: 'slack' | 'email' | 'webhook' | 'dashboard';
  config: ChannelConfig;
  enabled: boolean;
}

class NotificationManager {
  async sendAlert(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    await Promise.allSettled(
      channels
        .filter(channel => channel.enabled)
        .map(channel => this.sendToChannel(alert, channel))
    );
  }
}
```

## 8. Performance Metrics & SLIs/SLOs

### 8.1 Service Level Indicators
```typescript
const SLIs = {
  QUERY_LATENCY: {
    p50: 100, // ms
    p95: 500, // ms
    p99: 1000 // ms
  },
  AVAILABILITY: 99.9, // %
  ERROR_RATE: 0.1, // %
  DATA_FRESHNESS: 5 // seconds
};

const SLOs = {
  QUERY_PERFORMANCE: 'P95 latency < 500ms',
  SYSTEM_AVAILABILITY: '99.9% uptime',
  DATA_ACCURACY: '99.99% error-free ingestion',
  ALERT_RESPONSE: 'Alert delivery < 30 seconds'
};
```

## 9. Data Retention & Aggregation

### 9.1 Retention Policies
```sql
-- Raw data: 7 days
SELECT add_retention_policy('metrics', INTERVAL '7 days');

-- 5-minute aggregates: 30 days
SELECT add_retention_policy('metrics_5min', INTERVAL '30 days');

-- Hourly aggregates: 1 year
SELECT add_retention_policy('metrics_hourly', INTERVAL '365 days');

-- Daily aggregates: 5 years
SELECT add_retention_policy('metrics_daily', INTERVAL '5 years');
```

## 10. API Specifications

### 10.1 Metrics Query API
```typescript
// GET /api/metrics/query
interface MetricsQueryRequest {
  timeRange: { start: string; end: string };
  filters: MetricFilter[];
  aggregation: 'raw' | '1m' | '5m' | '1h' | '1d';
  limit?: number;
}

interface MetricsQueryResponse {
  data: DataPoint[];
  metadata: {
    totalPoints: number;
    aggregation: string;
    cacheHit: boolean;
    queryTime: number;
  };
}
```

## 11. Security & Privacy

### 11.1 Data Privacy
- **PII Filtering**: Automatic removal of sensitive data
- **Access Control**: Role-based metric access
- **Encryption**: TLS 1.3 for data in transit, AES-256 at rest
- **Audit Logging**: Complete access audit trail

### 11.2 Authentication & Authorization
```typescript
interface SecurityContext {
  userId: string;
  roles: string[];
  projectAccess: string[];
  rateLimits: RateLimit[];
}

class SecurityMiddleware {
  validateAccess(context: SecurityContext, resource: string): boolean {
    return this.hasProjectAccess(context, resource) &&
           this.checkRateLimit(context);
  }
}
```

## 12. Testing Strategy

### 12.1 Performance Testing
```typescript
describe('Metrics Collection Performance', () => {
  it('should handle 1000 events/second', async () => {
    const events = generateTestEvents(1000);
    const startTime = Date.now();
    
    await Promise.all(events.map(event => collector.collect(event)));
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // 1 second max
  });
});
```

### 12.2 Integration Testing
- **End-to-end pipeline testing**: Hook → Storage → Dashboard
- **Real-time streaming validation**: WebSocket message delivery
- **Alert engine testing**: Rule evaluation accuracy
- **Database performance testing**: Query response times

This specification provides the foundation for implementing a comprehensive monitoring and analytics platform that scales with the dual-agent system's growth and provides actionable insights for optimization.