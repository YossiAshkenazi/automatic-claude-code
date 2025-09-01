# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-01-plugin-system/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Endpoints

### Plugin Management API

#### GET /api/plugins
List all installed plugins with status and metadata.

**Response:**
```typescript
{
  plugins: Array<{
    id: string;
    name: string;
    version: string;
    status: 'active' | 'inactive' | 'error' | 'loading';
    description: string;
    author: string;
    permissions: PluginPermissions;
    resourceUsage: ResourceUsage;
    lastActivated: Date;
  }>;
  total: number;
}
```

#### POST /api/plugins/:id/activate
Activate a specific plugin.

**Request Body:**
```typescript
{
  config?: Record<string, any>;
  permissions?: PluginPermissions;
}
```

**Response:**
```typescript
{
  success: boolean;
  status: 'active' | 'error';
  message?: string;
  activatedAt: Date;
}
```

#### POST /api/plugins/:id/deactivate
Deactivate a specific plugin gracefully.

**Response:**
```typescript
{
  success: boolean;
  status: 'inactive';
  deactivatedAt: Date;
}
```

#### POST /api/plugins/install
Install a plugin from marketplace or local path.

**Request Body:**
```typescript
{
  source: 'marketplace' | 'local' | 'git';
  identifier: string;  // Plugin ID, path, or git URL
  version?: string;
  autoActivate?: boolean;
  permissions?: PluginPermissions;
}
```

**Response:**
```typescript
{
  success: boolean;
  pluginId: string;
  version: string;
  installedAt: Date;
  warnings?: string[];
}
```

#### DELETE /api/plugins/:id
Uninstall a plugin completely.

**Response:**
```typescript
{
  success: boolean;
  uninstalledAt: Date;
}
```

### Plugin SDK API

#### GET /api/sdk/system
Get system information available to plugins.

**Response:**
```typescript
{
  version: string;
  capabilities: string[];
  limits: ResourceLimits;
  permissions: PluginPermissions;
  environment: 'development' | 'production';
}
```

#### POST /api/sdk/events
Emit a system event from a plugin.

**Request Body:**
```typescript
{
  event: string;
  data: any;
  targetPlugins?: string[];
  broadcast?: boolean;
}
```

#### GET /api/sdk/events/subscribe
WebSocket endpoint for plugin event subscription.

**WebSocket Messages:**
```typescript
// Incoming message
{
  type: 'subscribe' | 'unsubscribe';
  events: string[];
}

// Outgoing message
{
  type: 'event';
  event: string;
  data: any;
  source: string;
  timestamp: Date;
}
```

### Marketplace API

#### GET /api/marketplace/search
Search for plugins in the marketplace.

**Query Parameters:**
- `q`: Search query string
- `category`: Plugin category filter
- `sort`: Sort order (downloads, rating, updated)
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20)

**Response:**
```typescript
{
  results: Array<{
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    downloads: number;
    rating: number;
    tags: string[];
    verified: boolean;
    lastUpdated: Date;
  }>;
  total: number;
  page: number;
  totalPages: number;
}
```

#### GET /api/marketplace/plugins/:id
Get detailed information about a marketplace plugin.

**Response:**
```typescript
{
  id: string;
  name: string;
  description: string;
  longDescription: string;
  author: {
    name: string;
    email: string;
    avatar?: string;
    verified: boolean;
  };
  version: string;
  versions: string[];
  downloads: number;
  rating: number;
  reviews: Array<{
    author: string;
    rating: number;
    comment: string;
    date: Date;
  }>;
  tags: string[];
  categories: string[];
  screenshots: string[];
  documentation: string;
  source: {
    type: 'git' | 'npm' | 'upload';
    url?: string;
  };
  dependencies: Record<string, string>;
  permissions: PluginPermissions;
  verified: boolean;
  lastUpdated: Date;
  createdAt: Date;
}
```

#### POST /api/marketplace/plugins/:id/install
Install a plugin from the marketplace.

**Response:**
```typescript
{
  success: boolean;
  downloadUrl: string;
  installationId: string;
  estimatedSize: number;
}
```

### Development API

#### POST /api/dev/plugins/create
Create a new plugin from template.

**Request Body:**
```typescript
{
  name: string;
  template: 'basic' | 'agent' | 'tool' | 'workflow';
  author: string;
  description: string;
  permissions: PluginPermissions;
}
```

**Response:**
```typescript
{
  success: boolean;
  pluginPath: string;
  templateFiles: string[];
  nextSteps: string[];
}
```

#### POST /api/dev/plugins/:id/reload
Hot-reload a plugin during development.

**Response:**
```typescript
{
  success: boolean;
  reloadedAt: Date;
  changes: Array<{
    file: string;
    type: 'modified' | 'added' | 'deleted';
  }>;
  errors?: string[];
  warnings?: string[];
}
```

#### GET /api/dev/plugins/:id/logs
Get plugin-specific logs.

**Query Parameters:**
- `level`: Log level filter (debug, info, warn, error)
- `since`: ISO timestamp for log filtering
- `limit`: Maximum number of logs (default: 100)

**Response:**
```typescript
{
  logs: Array<{
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    context?: any;
    source: string;
  }>;
  total: number;
}
```

## Controllers

### PluginController

**Responsibilities:**
- Plugin lifecycle management (install, activate, deactivate, uninstall)
- Plugin status monitoring and health checks
- Configuration management and updates
- Resource usage tracking and limits enforcement

**Key Methods:**
```typescript
class PluginController {
  async listPlugins(filters?: PluginFilters): Promise<PluginInfo[]>;
  async installPlugin(request: InstallRequest): Promise<InstallResult>;
  async activatePlugin(id: string, config?: any): Promise<ActivationResult>;
  async deactivatePlugin(id: string, graceful: boolean = true): Promise<DeactivationResult>;
  async uninstallPlugin(id: string, cleanup: boolean = true): Promise<UninstallResult>;
  async updatePlugin(id: string, version?: string): Promise<UpdateResult>;
  async getPluginStatus(id: string): Promise<PluginStatus>;
  async configurePlugin(id: string, config: any): Promise<ConfigurationResult>;
}
```

### SDKController

**Responsibilities:**
- Plugin SDK API endpoints
- System integration services
- Event management and broadcasting
- Plugin-to-plugin communication

**Key Methods:**
```typescript
class SDKController {
  async getSystemInfo(pluginId: string): Promise<SystemInfo>;
  async emitEvent(pluginId: string, event: EventData): Promise<EventResult>;
  async subscribeToEvents(pluginId: string, events: string[]): Promise<SubscriptionResult>;
  async getPluginStorage(pluginId: string): Promise<PluginStorage>;
  async logMessage(pluginId: string, level: LogLevel, message: string, context?: any): Promise<void>;
  async requestPermission(pluginId: string, permission: string): Promise<PermissionResult>;
}
```

### MarketplaceController

**Responsibilities:**
- Marketplace integration and search
- Plugin discovery and metadata management
- Version management and updates
- User ratings and reviews

**Key Methods:**
```typescript
class MarketplaceController {
  async searchPlugins(query: SearchQuery): Promise<SearchResult>;
  async getPluginDetails(id: string): Promise<PluginDetails>;
  async installFromMarketplace(id: string, version?: string): Promise<InstallResult>;
  async checkForUpdates(): Promise<UpdateInfo[]>;
  async submitReview(pluginId: string, review: Review): Promise<ReviewResult>;
  async reportPlugin(pluginId: string, reason: string): Promise<ReportResult>;
  async publishPlugin(pluginPath: string, metadata: PublishMetadata): Promise<PublishResult>;
}
```

### DevelopmentController

**Responsibilities:**
- Development tools and utilities
- Hot-reloading and debugging support
- Plugin testing and validation
- Template and scaffolding generation

**Key Methods:**
```typescript
class DevelopmentController {
  async createFromTemplate(request: TemplateRequest): Promise<CreationResult>;
  async hotReloadPlugin(id: string): Promise<ReloadResult>;
  async validatePlugin(pluginPath: string): Promise<ValidationResult>;
  async runPluginTests(id: string): Promise<TestResult>;
  async generateDocs(pluginPath: string): Promise<DocumentationResult>;
  async packagePlugin(pluginPath: string): Promise<PackageResult>;
  async getPluginLogs(id: string, filters?: LogFilters): Promise<LogResult>;
}
```

### SecurityController

**Responsibilities:**
- Security scanning and validation
- Permission management and enforcement
- Audit logging and compliance
- Quarantine and threat mitigation

**Key Methods:**
```typescript
class SecurityController {
  async scanPlugin(pluginPath: string): Promise<SecurityScanResult>;
  async validatePermissions(pluginId: string, requested: PluginPermissions): Promise<PermissionValidation>;
  async auditPluginActivity(pluginId: string, timeframe?: TimeRange): Promise<AuditResult>;
  async quarantinePlugin(pluginId: string, reason: string): Promise<QuarantineResult>;
  async updateSecurityPolicy(policy: SecurityPolicy): Promise<PolicyResult>;
  async checkThreatIntelligence(pluginId: string): Promise<ThreatResult>;
}
```