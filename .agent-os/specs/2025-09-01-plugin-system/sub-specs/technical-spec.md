# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-plugin-system/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Technical Requirements

### Plugin Architecture

**Plugin Structure:**
```typescript
interface Plugin {
  manifest: PluginManifest;
  entry: string;
  dependencies: Record<string, string>;
  permissions: PluginPermissions;
  sandbox: SandboxConfig;
}

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  main: string;
  engines: { node: string; acc: string };
  keywords: string[];
  repository?: string;
  homepage?: string;
  bugs?: string;
}
```

**Plugin SDK Core:**
```typescript
class PluginSDK {
  // Agent Registration
  registerAgent(config: AgentConfig): void;
  registerTool(tool: ToolDefinition): void;
  registerWorkflow(workflow: WorkflowDefinition): void;
  
  // Lifecycle Hooks
  onActivate(callback: () => void): void;
  onDeactivate(callback: () => void): void;
  onConfigChange(callback: (config: any) => void): void;
  
  // System Integration
  getSystemAPI(): SystemAPI;
  getLogger(name: string): Logger;
  getStorage(): PluginStorage;
  emitEvent(event: string, data: any): void;
  subscribeEvent(event: string, handler: Function): void;
}
```

### Sandboxing System

**VM2-based Isolation:**
```typescript
class PluginSandbox {
  private vm: VM;
  private resourceMonitor: ResourceMonitor;
  
  constructor(config: SandboxConfig) {
    this.vm = new VM({
      timeout: config.timeoutMs,
      sandbox: this.createSandboxContext(config.permissions)
    });
    this.resourceMonitor = new ResourceMonitor(config.limits);
  }
  
  execute(code: string, context?: any): Promise<any> {
    return this.resourceMonitor.wrap(() => {
      return this.vm.run(code, context);
    });
  }
}
```

**Resource Monitoring:**
```typescript
interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxExecutionTimeMs: number;
  maxFileSystemAccess: number;
  maxNetworkRequests: number;
}

class ResourceMonitor {
  monitor(callback: () => Promise<any>): Promise<any>;
  getUsage(): ResourceUsage;
  enforceLimit(type: ResourceType, current: number): void;
}
```

### Hot-Reloading System

**File Watcher Integration:**
```typescript
class PluginHotReloader {
  private watchers: Map<string, FSWatcher> = new Map();
  private reloadQueue: Set<string> = new Set();
  
  watch(pluginPath: string): void {
    const watcher = chokidar.watch(pluginPath, {
      ignored: /node_modules|\.git/,
      persistent: true
    });
    
    watcher.on('change', (file) => {
      this.scheduleReload(pluginPath);
    });
    
    this.watchers.set(pluginPath, watcher);
  }
  
  private async scheduleReload(pluginPath: string): Promise<void> {
    // Debounced reload with dependency tracking
    this.reloadQueue.add(pluginPath);
    await this.processReloadQueue();
  }
}
```

### Plugin Discovery

**Directory Scanner:**
```typescript
class PluginDiscovery {
  private scanPaths: string[] = [
    '~/.acc/plugins',
    './plugins',
    './node_modules/@acc-plugins'
  ];
  
  async discoverPlugins(): Promise<PluginDescriptor[]> {
    const plugins: PluginDescriptor[] = [];
    
    for (const path of this.scanPaths) {
      const discovered = await this.scanDirectory(path);
      plugins.push(...discovered);
    }
    
    return this.deduplicatePlugins(plugins);
  }
  
  private async validatePlugin(path: string): Promise<boolean> {
    const manifestPath = join(path, 'plugin.json');
    if (!existsSync(manifestPath)) return false;
    
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      return this.validateManifest(manifest);
    } catch {
      return false;
    }
  }
}
```

## Approach

### 1. Plugin Lifecycle Management

**State Machine:**
```
DISCOVERED → LOADED → ACTIVATED → RUNNING → DEACTIVATED → UNLOADED
                ↓         ↑
             ERROR ←→ RELOADING
```

**Lifecycle Events:**
- `plugin:discovered` - Plugin found in scan
- `plugin:loaded` - Plugin code loaded into memory
- `plugin:activated` - Plugin initialized and ready
- `plugin:error` - Plugin encountered error
- `plugin:reloading` - Hot-reload in progress
- `plugin:deactivated` - Plugin shut down gracefully

### 2. Security Architecture

**Permission System:**
```typescript
interface PluginPermissions {
  filesystem: {
    read: string[];      // Allowed read paths
    write: string[];     // Allowed write paths
    execute: boolean;    // Can execute commands
  };
  network: {
    http: string[];      // Allowed HTTP domains
    websocket: boolean;  // WebSocket access
    external: boolean;   // External API access
  };
  system: {
    environment: boolean; // Access env vars
    process: boolean;     // Spawn processes
    native: boolean;      // Native modules
  };
  claude: {
    api: boolean;        // Claude API access
    tools: string[];     // Allowed tool usage
    sessions: boolean;   // Session management
  };
}
```

**Security Validation:**
```typescript
class SecurityValidator {
  validatePermissions(requested: PluginPermissions, allowed: PluginPermissions): ValidationResult;
  scanForMaliciousCode(code: string): SecurityScanResult;
  auditPluginActivity(pluginId: string, action: string, context: any): void;
  enforceQuarantine(pluginId: string, reason: string): void;
}
```

### 3. Marketplace Integration

**Registry API Client:**
```typescript
class PluginRegistry {
  async search(query: string, filters?: SearchFilters): Promise<PluginSearchResult[]>;
  async getPlugin(id: string): Promise<PluginDetails>;
  async install(id: string, version?: string): Promise<InstallResult>;
  async update(id: string): Promise<UpdateResult>;
  async publish(pluginPath: string): Promise<PublishResult>;
  async getUpdates(): Promise<UpdateInfo[]>;
}
```

**Marketplace Schema:**
```typescript
interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  author: AuthorInfo;
  version: string;
  tags: string[];
  downloads: number;
  rating: number;
  reviews: Review[];
  screenshots: string[];
  documentation: string;
  source: SourceInfo;
  verified: boolean;
  lastUpdated: Date;
}
```

## External Dependencies

**Core Dependencies:**
- `vm2` - Secure JavaScript sandbox environment
- `chokidar` - File system watching for hot-reload
- `semver` - Semantic versioning support
- `tar` - Plugin packaging and extraction
- `jsonschema` - Plugin manifest validation

**Security Dependencies:**
- `safe-eval` - Additional code evaluation safety
- `node-acl` - Access control lists for permissions
- `helmet` - Security headers for marketplace API
- `rate-limiter-flexible` - API rate limiting

**Development Dependencies:**
- `typescript` - Plugin SDK type definitions
- `jest` - Plugin testing framework
- `eslint` - Code quality for plugin development
- `rollup` - Plugin bundling and optimization
- `typedoc` - API documentation generation

**Optional Dependencies:**
- `docker` - Container-based plugin isolation
- `worker_threads` - Thread-based plugin execution
- `cluster` - Multi-process plugin scaling
- `redis` - Distributed plugin state management