# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-01-service-modularization/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Endpoints

### Modular Route Structure

#### Agent Communication Routes (`/api/agents`)
```typescript
// agents/routes.ts
GET    /api/agents/sessions          // List active agent sessions
POST   /api/agents/coordinate        // Trigger agent coordination
GET    /api/agents/status/:sessionId // Get agent status
POST   /api/agents/quality-gate     // Submit quality gate validation
DELETE /api/agents/session/:id      // Terminate agent session
```

#### Monitoring Routes (`/api/monitoring`)
```typescript
// monitoring/routes.ts  
POST   /api/monitoring              // Receive monitoring data (existing)
GET    /api/monitoring/health       // System health status
GET    /api/monitoring/metrics      // Performance metrics
GET    /api/monitoring/events       // Event stream endpoint
POST   /api/monitoring/alerts       // Configure alert rules
```

#### Session Management Routes (`/api/sessions`)
```typescript
// sessions/routes.ts
GET    /api/sessions                // List all sessions with pagination
POST   /api/sessions                // Create new session
GET    /api/sessions/:id            // Get session details
PUT    /api/sessions/:id            // Update session
DELETE /api/sessions/:id            // Delete session
GET    /api/sessions/:id/replay     // Get session replay data
POST   /api/sessions/:id/export     // Export session data
```

#### Webhook Management Routes (`/api/webhooks`)
```typescript
// webhooks/routes.ts
GET    /api/webhooks/config         // Get webhook configuration
PUT    /api/webhooks/config         // Update webhook settings
POST   /api/webhooks/test           // Test webhook connectivity
GET    /api/webhooks/logs           // Webhook delivery logs
POST   /api/webhooks/slack          // Slack integration endpoint
POST   /api/webhooks/discord        // Discord integration endpoint
```

#### Analytics Routes (`/api/analytics`)
```typescript
// analytics/routes.ts
GET    /api/analytics/performance   // Performance analytics data
GET    /api/analytics/usage         // Usage statistics
POST   /api/analytics/query         // Custom analytics query
GET    /api/analytics/insights      // ML-generated insights
GET    /api/analytics/anomalies     // Detected anomalies
```

### WebSocket Event Structure

#### Modular WebSocket Handlers
```typescript
// websocket/handlers/
connectionHandler.ts     // Connection management
agentHandler.ts         // Agent communication events  
monitoringHandler.ts    // Monitoring data events
sessionHandler.ts       // Session lifecycle events
analyticsHandler.ts     // Analytics and metrics events
```

#### WebSocket Event Types
```typescript
// Agent Communication Events
'agent:connected'         // Agent joined session
'agent:message'          // Inter-agent communication
'agent:coordination'     // Coordination workflow event
'agent:quality_gate'     // Quality validation result
'agent:error'           // Agent error occurred

// Monitoring Events  
'monitoring:data'        // Real-time monitoring data
'monitoring:alert'       // System alert triggered
'monitoring:health'      // Health check result
'monitoring:metrics'     // Performance metrics update

// Session Events
'session:created'        // New session started
'session:updated'        // Session state changed
'session:completed'      // Session finished
'session:error'         // Session error occurred
```

## Controllers

### Modular Controller Architecture

#### Base Controller Class
```typescript
// controllers/BaseController.ts
abstract class BaseController {
  protected service: any;
  protected logger: winston.Logger;
  
  constructor(service: any, logger: winston.Logger) {
    this.service = service;
    this.logger = logger;
  }
  
  protected handleError(error: Error, res: Response): void;
  protected validateRequest(req: Request, schema: any): ValidationResult;
  protected formatResponse<T>(data: T, message?: string): ApiResponse<T>;
}
```

#### Agent Controller
```typescript
// controllers/AgentController.ts
class AgentController extends BaseController {
  constructor(
    @inject('AgentCommunicationService') agentService: IAgentCommunicationService,
    @inject('SessionService') sessionService: ISessionService
  ) {
    super(agentService, winston.child({ module: 'AgentController' }));
  }
  
  async listSessions(req: Request, res: Response): Promise<void>;
  async coordinateAgents(req: Request, res: Response): Promise<void>;
  async getSessionStatus(req: Request, res: Response): Promise<void>;
  async validateQualityGate(req: Request, res: Response): Promise<void>;
  async terminateSession(req: Request, res: Response): Promise<void>;
}
```

#### Monitoring Controller
```typescript
// controllers/MonitoringController.ts  
class MonitoringController extends BaseController {
  constructor(
    @inject('MonitoringService') monitoringService: IMonitoringService,
    @inject('AnalyticsService') analyticsService: IAnalyticsService
  ) {
    super(monitoringService, winston.child({ module: 'MonitoringController' }));
  }
  
  async receiveMonitoringData(req: Request, res: Response): Promise<void>; // Existing endpoint
  async getHealthStatus(req: Request, res: Response): Promise<void>;
  async getMetrics(req: Request, res: Response): Promise<void>;
  async streamEvents(req: Request, res: Response): Promise<void>;
  async configureAlerts(req: Request, res: Response): Promise<void>;
}
```

#### Session Controller
```typescript
// controllers/SessionController.ts
class SessionController extends BaseController {
  constructor(
    @inject('SessionService') sessionService: ISessionService,
    @inject('AnalyticsService') analyticsService: IAnalyticsService
  ) {
    super(sessionService, winston.child({ module: 'SessionController' }));
  }
  
  async listSessions(req: Request, res: Response): Promise<void>;
  async createSession(req: Request, res: Response): Promise<void>;
  async getSession(req: Request, res: Response): Promise<void>;
  async updateSession(req: Request, res: Response): Promise<void>;
  async deleteSession(req: Request, res: Response): Promise<void>;
  async getSessionReplay(req: Request, res: Response): Promise<void>;
  async exportSession(req: Request, res: Response): Promise<void>;
}
```

### Route Module Structure
```typescript
// routes/index.ts - Main router
app.use('/api/agents', agentRoutes);
app.use('/api/monitoring', monitoringRoutes);  
app.use('/api/sessions', sessionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/analytics', analyticsRoutes);

// Individual route modules
// routes/agents.ts
const router = express.Router();
const agentController = container.resolve<AgentController>('AgentController');

router.get('/sessions', agentController.listSessions.bind(agentController));
router.post('/coordinate', agentController.coordinateAgents.bind(agentController));
// ... other agent routes

export { router as agentRoutes };
```

### Service Interface Definitions
```typescript
// services/interfaces/
IAgentCommunicationService.ts
IMonitoringService.ts
ISessionService.ts
IAnalyticsService.ts
IWebhookService.ts
IHealthCheckService.ts
```