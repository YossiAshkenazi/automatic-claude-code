# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-comprehensive-folder-restructure/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Technical Requirements

### Folder Structure Migration

#### Documentation Files Migration (15+ files)
**Target Structure:**
```
docs/
├── setup/
│   ├── QUICK-SETUP.md
│   ├── INSTALLATION.md
│   └── CONFIGURATION.md
├── deployment/
│   ├── DEPLOYMENT.md
│   ├── DOCKER.md
│   └── PRODUCTION.md
├── development/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── HOOKS.md
├── operations/
│   ├── MONITORING.md
│   ├── TROUBLESHOOTING.md
│   └── MAINTENANCE.md
├── reference/
│   ├── CHANGELOG.md
│   ├── MIGRATION-v1.1.0.md
│   └── research/
│       ├── Agent-Coordination-Patterns (gemini aistudio).md
│       ├── Agent-Coordination-Patterns (gemini).md
│       ├── Agent-Coordination-Patterns (grok).md
│       └── CLAUDE_DESKTOP_RESEARCH_PROMPT.md
└── troubleshooting.md (existing)
```

**Files to Migrate:**
- Root markdown files: `QUICK-SETUP.md`, `DEPLOYMENT.md`, `CHANGELOG.md`, `MIGRATION-v1.1.0.md`
- Research documents: `Agent-Coordination-Patterns*.md`, `CLAUDE_DESKTOP_RESEARCH_PROMPT.md`
- Existing `docs/troubleshooting.md` remains in place

#### Test Files Migration
**Target Structure:**
```
tests/
├── unit/
│   ├── agents/
│   ├── services/
│   └── utils/
├── integration/
│   ├── api/
│   ├── database/
│   └── monitoring/
├── e2e/
│   ├── dual-agent-workflows/
│   ├── monitoring-dashboard/
│   └── docker-deployment/
├── load/
│   ├── artillery-configs/
│   └── performance-benchmarks/
├── fixtures/
│   ├── sample-sessions/
│   ├── mock-responses/
│   └── test-data/
└── support/
    ├── test-helpers.ts
    ├── setup.ts
    └── teardown.ts
```

**Migration Actions:**
- Create test directory structure
- Move any existing test files from `src/` or root
- Update test runner configurations
- Create placeholder test files for major components

#### Configuration Files Consolidation
**Target Structure:**
```
config/
├── development/
│   ├── .env.development
│   ├── docker-compose.dev.yml
│   └── tsconfig.dev.json
├── production/
│   ├── .env.production.example
│   ├── docker-compose.prod.yml
│   └── ecosystem.config.js
├── testing/
│   ├── jest.config.js
│   ├── vitest.config.ts
│   └── playwright.config.ts
├── monitoring/
│   ├── prometheus.yml
│   ├── grafana-dashboards/
│   └── alerting-rules.yml
└── base/
    ├── tsconfig.base.json
    ├── eslint.config.js
    └── prettier.config.js
```

**Files to Consolidate:**
- Move `ecosystem.config.js` to `config/production/`
- Consolidate Docker Compose files to `config/development/` and `config/production/`
- Move TypeScript configs to appropriate subdirectories
- Organize environment files by environment type

#### CLI Command Structure Enhancement
**Target Structure:**
```
src/cli/
├── commands/
│   ├── run.ts
│   ├── monitor.ts
│   ├── history.ts
│   ├── logs.ts
│   ├── examples.ts
│   └── config.ts
├── middleware/
│   ├── authentication.ts
│   ├── validation.ts
│   └── logging.ts
├── utils/
│   ├── command-builder.ts
│   ├── option-parser.ts
│   └── help-formatter.ts
└── index.ts (CLI entry point)
```

**Refactoring Actions:**
- Extract command handlers from `src/index.ts`
- Create dedicated command modules
- Implement command middleware system
- Add better help system and command validation

### Import Path Updates Required

#### Package.json Scripts Updates
**Current Issues:**
- Scripts reference files in root that will move to `docs/`
- Build scripts may reference moved config files
- Test scripts need to point to new `tests/` directory

**Required Changes:**
```json
{
  "scripts": {
    "docs:serve": "serve docs/",
    "test": "jest --config config/testing/jest.config.js",
    "test:e2e": "playwright test --config config/testing/playwright.config.ts",
    "build:prod": "tsc --project config/production/tsconfig.json",
    "monitor:start": "node dist/monitoring-server.js",
    "docker:dev": "docker-compose -f config/development/docker-compose.dev.yml up",
    "docker:prod": "docker-compose -f config/production/docker-compose.prod.yml up"
  }
}
```

#### Docker Volume Mapping Updates
**Current Mappings to Update:**
```dockerfile
# Before
COPY ecosystem.config.js ./
COPY docs/troubleshooting.md ./docs/

# After
COPY config/production/ecosystem.config.js ./config/production/
COPY docs/ ./docs/
```

**Docker Compose Changes:**
```yaml
# config/development/docker-compose.dev.yml
volumes:
  - "../../docs:/app/docs:ro"
  - "../../config:/app/config:ro"
  - "../../tests:/app/tests:ro"
```

#### TypeScript Path Mappings
**tsconfig.json Updates:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/config/*": ["config/*"],
      "@/docs/*": ["docs/*"],
      "@/tests/*": ["tests/*"],
      "@/cli/*": ["src/cli/*"]
    }
  },
  "extends": "./config/base/tsconfig.base.json"
}
```

#### Source File Import Updates
**Files Requiring Import Changes:**
- `src/index.ts` - CLI command imports
- `src/sessionManager.ts` - Config file paths
- `src/monitoringManager.ts` - Config references
- `dual-agent-monitor/server/` files - Relative paths to configs
- Hook scripts in `.claude/hooks/` - Documentation references

**Example Import Updates:**
```typescript
// Before
import { config } from '../ecosystem.config.js';
import troubleshootingDocs from './docs/troubleshooting.md';

// After
import { config } from '../config/production/ecosystem.config.js';
import troubleshootingDocs from './docs/operations/troubleshooting.md';
```

#### .gitignore Pattern Updates
**New Patterns Required:**
```gitignore
# Configuration
config/development/.env.development
config/production/.env.production
config/production/ecosystem.config.local.js

# Test outputs
tests/coverage/
tests/results/
tests/screenshots/

# Documentation builds
docs/build/
docs/.vitepress/cache/
```

### Configuration File Changes

#### Ecosystem.config.js References
**Current File:** Root-level `ecosystem.config.js`
**New Location:** `config/production/ecosystem.config.js`

**Required Updates:**
```javascript
// Update file paths in ecosystem config
module.exports = {
  apps: [{
    name: 'automatic-claude-code',
    script: '../../dist/index.js',  // Updated path
    cwd: process.cwd(),
    env_file: './config/production/.env.production'  // Updated path
  }]
};
```

#### Monitoring Server Path Updates
**Files to Update:**
- `dual-agent-monitor/server/websocket-server.ts`
- `dual-agent-monitor/vite.config.ts`
- `monitoring-server.js`

**Required Changes:**
```typescript
// Update config file references
const configPath = path.join(__dirname, '../config/production/ecosystem.config.js');
const monitoringConfig = path.join(__dirname, '../config/monitoring/prometheus.yml');
```

#### Docker Compose File Restructuring
**Split Current docker-compose.yml into:**
1. `config/development/docker-compose.dev.yml` - Development environment
2. `config/production/docker-compose.prod.yml` - Production deployment
3. `config/production/docker-compose.ha.yml` - High availability setup

**Update Volume Mappings:**
```yaml
services:
  app:
    volumes:
      - "./../../src:/app/src"
      - "./../../config:/app/config:ro"
      - "./../../docs:/app/docs:ro"
```

#### CI/CD Pipeline Updates
**Files to Update:**
- `.github/workflows/ci.yml`
- `.github/workflows/main.yml`
- `.github/workflows/simple-ci.yml`

**Required Changes:**
```yaml
# Update paths in GitHub Actions
- name: Run tests
  run: |
    pnpm test --config config/testing/jest.config.js
    
- name: Build production
  run: |
    pnpm build --project config/production/tsconfig.json
```

### Port Configuration Standardization

#### Monitoring System Port Resolution
**Current Conflict:**
- Some configs use port 4001 for monitoring API
- Others use port 4005 for monitoring API
- Dashboard consistently uses 6011
- Persistent monitor uses 6007

**Standardized Port Assignment:**
```typescript
const PORTS = {
  MONITORING_API: 4001,        // Standardize on 4001
  MONITORING_DASHBOARD: 6011,   // Keep existing
  PERSISTENT_MONITOR: 6007,     // Keep existing
  DEVELOPMENT_API: 4005,        // Use 4005 for dev-only services
} as const;
```

#### Development vs Production Port Configuration
**Environment-Specific Configs:**

**config/development/.env.development:**
```env
MONITORING_API_PORT=4001
MONITORING_DASHBOARD_PORT=6011
PERSISTENT_MONITOR_PORT=6007
DEBUG_API_PORT=4005
```

**config/production/.env.production.example:**
```env
MONITORING_API_PORT=4001
MONITORING_DASHBOARD_PORT=6011
PERSISTENT_MONITOR_PORT=6007
# DEBUG_API_PORT not available in production
```

#### Vite.config.ts Proxy Updates
**File:** `dual-agent-monitor/vite.config.ts`
**Required Changes:**
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4001', // Standardized port
        changeOrigin: true
      }
    }
  }
});
```

#### Docker Compose Port Standardization
**Update All Docker Compose Files:**
```yaml
services:
  monitoring-api:
    ports:
      - "4001:4001"  # Standardized across all environments
  monitoring-dashboard:
    ports:
      - "6011:6011"  # Consistent
```

### Backward Compatibility Maintenance

#### CLI Functionality Preservation
**Critical Requirements:**
- `acc` command must continue working without changes
- All existing command-line options preserved
- Session resume functionality maintained
- Configuration file compatibility preserved

**Implementation Strategy:**
1. Create compatibility layer in CLI entry point
2. Maintain existing command signatures
3. Add deprecation warnings for moved files
4. Provide automatic config migration

#### Docker Container Behavior Consistency
**Requirements:**
- Existing Docker commands continue working
- Container volume mounts remain functional
- Environment variable handling preserved
- Health checks continue operating

**Migration Approach:**
1. Update Dockerfile with new structure
2. Maintain backward-compatible volume mounts
3. Add symlinks for critical legacy paths
4. Test all Docker Compose configurations

#### Monitoring System Operational Continuity
**Critical Services:**
- WebSocket connections maintained
- Database schema compatibility
- Real-time dashboard functionality
- Session replay capabilities

**Migration Strategy:**
1. Implement graceful configuration migration
2. Maintain database connection pooling
3. Preserve WebSocket endpoint contracts
4. Keep monitoring data format stable

#### Build Process Integrity
**Requirements:**
- TypeScript compilation continues working
- Package bundling remains functional
- Development hot-reload preserved
- Production build optimization maintained

**Implementation Steps:**
1. Update all tsconfig.json extends paths
2. Modify build scripts for new structure
3. Test compilation in all environments
4. Verify source map generation

#### Session Data and Configuration Preservation
**Critical Data:**
- User configuration files in `~/.automatic-claude-code/`
- Session history and replay data
- Monitoring dashboard settings
- Agent communication logs

**Preservation Strategy:**
1. No changes to user config directory structure
2. Maintain session data schema compatibility
3. Preserve configuration file formats
4. Keep agent communication protocols stable

## Approach

### Migration Phases

#### Phase 1: Structure Creation and File Movement
1. Create new directory structures
2. Move documentation files to `docs/` subdirectories
3. Consolidate configuration files
4. Update basic import references

#### Phase 2: Configuration and Path Updates
1. Update all configuration files for new paths
2. Modify Docker and Docker Compose configurations
3. Fix TypeScript path mappings
4. Update CI/CD pipeline configurations

#### Phase 3: Import and Reference Resolution
1. Update all source code imports
2. Fix relative path references
3. Update documentation cross-references
4. Test all build processes

#### Phase 4: Port Standardization and Testing
1. Implement standardized port configuration
2. Update all service configurations
3. Test all deployment scenarios
4. Verify backward compatibility

### Implementation Guidelines

#### File Movement Strategy
- Use git mv for proper history preservation
- Maintain alphabetical organization within subdirectories  
- Create README.md files in new directories explaining structure
- Add .gitkeep files for empty directories

#### Testing Strategy
- Test CLI functionality after each major change
- Verify Docker builds and deployments
- Test monitoring system connectivity
- Validate all import resolutions

#### Rollback Plan
- Maintain git history for easy rollback
- Keep backup of current structure during migration
- Document all changes for potential reversion
- Test rollback procedures

## External Dependencies

This reorganization requires no external dependencies and uses only existing project tools:

### Development Tools
- **TypeScript Compiler**: For path mapping updates and compilation testing
- **pnpm**: For script execution and dependency management  
- **Docker**: For container testing and deployment validation
- **Git**: For file movement with history preservation

### Existing Project Infrastructure
- **Monitoring System**: Existing WebSocket and API infrastructure
- **Database Schema**: Current PostgreSQL schema remains unchanged
- **Agent Communication**: Existing agent coordination protocols preserved
- **Build System**: Current TypeScript and bundling configuration adapted

### Configuration Management
- **Environment Files**: Existing .env structure adapted for new locations
- **Docker Compose**: Current services configuration reorganized
- **PM2 Configuration**: Existing ecosystem.config.js moved and updated
- **CI/CD Pipelines**: Current GitHub Actions workflows updated for new paths

No new external services, APIs, or dependencies are required for this comprehensive reorganization project.