# Migration Guide: Comprehensive Folder Restructure

This is the detailed migration guide for the comprehensive folder restructure detailed in @.agent-os/specs/2025-09-01-comprehensive-folder-restructure/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## File Movement Mappings

### Documentation Files Migration

#### Root Markdown Files → docs/ Structure
```bash
# EXACT SOURCE → DESTINATION MAPPINGS
QUICK-SETUP.md                                    → docs/setup/QUICK-SETUP.md
DOCKER.md                                         → docs/deployment/DOCKER.md
CHANGELOG.md                                      → docs/reference/CHANGELOG.md
MIGRATION-v1.1.0.md                              → docs/reference/MIGRATION-v1.1.0.md
DOCUMENTATION-UPDATE-SUMMARY.md                  → docs/development/DOCUMENTATION-UPDATE-SUMMARY.md
DUAL-AGENT-TEST-SUMMARY.md                       → docs/development/DUAL-AGENT-TEST-SUMMARY.md
GEMINI.md                                         → docs/reference/GEMINI.md
MCP_SERVERS.md                                    → docs/development/MCP_SERVERS.md
MONITORING-TEST-REPORT.md                        → docs/operations/MONITORING-TEST-REPORT.md
TEST-SCRIPTS-README.md                           → docs/development/TEST-SCRIPTS-README.md
"Agent-Coordination-Patterns (gemini aistudio).md" → docs/reference/research/Agent-Coordination-Patterns-gemini-aistudio.md
"Agent-Coordination-Patterns (gemini).md"        → docs/reference/research/Agent-Coordination-Patterns-gemini.md
"Agent-Coordination-Patterns (grok).md"          → docs/reference/research/Agent-Coordination-Patterns-grok.md
CLAUDE_DESKTOP_RESEARCH_PROMPT.md                → docs/reference/research/CLAUDE_DESKTOP_RESEARCH_PROMPT.md

# EXISTING FILES REMAIN IN PLACE
docs/troubleshooting.md                          → docs/operations/troubleshooting.md (MOVE)
README.md                                         → README.md (STAYS)
CLAUDE.md                                         → CLAUDE.md (STAYS)
```

#### New Documentation Structure Creation
```bash
# DIRECTORIES TO CREATE
docs/
├── setup/
├── deployment/  
├── development/
├── operations/
├── reference/
└── reference/research/
```

### Configuration Files Migration

#### Root Config Files → config/ Structure
```bash
# EXACT SOURCE → DESTINATION MAPPINGS
ecosystem.config.js                              → config/production/ecosystem.config.js
docker-compose.yml                               → config/development/docker-compose.dev.yml
docker-compose.prod.yml                         → config/production/docker-compose.prod.yml
monitoring-server.js                            → config/monitoring/monitoring-server.js
.eslintrc.json                                  → config/base/.eslintrc.json
.mcp.json                                       → config/development/.mcp.json
mcp_config.json                                 → config/development/mcp_config.json
```

#### New Configuration Structure Creation
```bash
# DIRECTORIES TO CREATE
config/
├── base/
├── development/
├── production/
├── testing/
└── monitoring/
```

### Script Files Migration

#### Root Scripts → tests/support/ Structure
```bash
# EXACT SOURCE → DESTINATION MAPPINGS
check-api-endpoints.js                          → tests/support/check-api-endpoints.js
check-dashboard-data.js                         → tests/support/check-dashboard-data.js
get-session-details.js                          → tests/support/get-session-details.js
send-test-session.ps1                           → tests/support/send-test-session.ps1
start-app.bat                                   → tests/support/start-app.bat
start-monitoring.ps1                            → tests/support/start-monitoring.ps1
test-example.sh                                 → tests/e2e/test-example.sh
test-wsl.sh                                     → tests/e2e/test-wsl.sh
```

#### New Test Structure Creation  
```bash
# DIRECTORIES TO CREATE
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
├── load/
├── fixtures/
└── support/
```

### Source Code Restructuring

#### CLI Modularization from src/index.ts
```bash
# NEW CLI STRUCTURE TO CREATE
src/cli/
├── commands/
│   ├── run.ts                  # Extract run command logic from src/index.ts
│   ├── monitor.ts              # Extract monitor command logic
│   ├── history.ts              # Extract history command logic  
│   ├── logs.ts                 # Extract logs command logic
│   ├── examples.ts             # Extract examples command logic
│   └── config.ts               # Extract config command logic
├── middleware/
│   ├── validation.ts           # Extract validation logic
│   ├── logging.ts              # Extract logging middleware
│   └── authentication.ts      # Extract auth middleware
├── utils/
│   ├── command-builder.ts      # Extract command building utilities
│   ├── option-parser.ts        # Extract option parsing
│   └── help-formatter.ts       # Extract help formatting
└── index.ts                    # New CLI entry point
```

### Import Path Changes Required

#### Package.json Scripts Updates
```json
{
  "scripts": {
    "build": "tsc --project config/base/tsconfig.json",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "lint": "eslint src/**/*.ts --config config/base/.eslintrc.json",
    "typecheck": "tsc --noEmit --project config/base/tsconfig.json",
    "clean": "rimraf dist",
    "prebuild": "pnpm run clean",
    "prepublishOnly": "pnpm run build",
    
    "docker:build": "docker build -f config/development/Dockerfile -t automatic-claude-code .",
    "docker:build-dev": "docker build --target development -f config/development/Dockerfile -t automatic-claude-code:dev .",
    "docker:run": "docker run -it --rm -v \"$(pwd):/workspace:ro\" -v \"$HOME/.claude:/home/nodejs/.claude:ro\" automatic-claude-code",
    "docker:shell": "docker run -it --rm -v \"$(pwd):/workspace\" -v \"$HOME/.claude:/home/nodejs/.claude:ro\" --entrypoint /bin/sh automatic-claude-code",
    "docker:dev": "docker-compose -f config/development/docker-compose.dev.yml up --build",
    "docker:dev-app": "docker-compose -f config/development/docker-compose.dev.yml --profile app up --build",
    "docker:dev-monitoring": "docker-compose -f config/development/docker-compose.dev.yml --profile monitoring up --build",
    "docker:prod": "docker-compose -f config/production/docker-compose.prod.yml up -d --build",
    "docker:prod-full": "docker-compose -f config/production/docker-compose.prod.yml --profile nginx up -d --build",
    "docker:stop": "docker-compose -f config/development/docker-compose.dev.yml down",
    "docker:stop-prod": "docker-compose -f config/production/docker-compose.prod.yml down",
    "docker:logs": "docker-compose -f config/development/docker-compose.dev.yml logs -f",
    "docker:logs-app": "docker-compose -f config/development/docker-compose.dev.yml logs -f acc-app",
    "docker:backup": "docker-compose -f config/production/docker-compose.prod.yml --profile backup up backup",
    "docker:clean": "docker system prune -f && docker volume prune -f",
    
    "monitor:start": "node config/monitoring/monitoring-server.js",
    "monitor:persistent": "powershell -ExecutionPolicy Bypass -File tests/support/start-monitoring.ps1",
    "monitor:docker": "docker-compose -f config/development/docker-compose.dev.yml up -d postgres redis",
    "monitor:status": "curl -s http://localhost:6007/health | json_pp || echo 'Monitor not running'",
    "monitor:pm2": "pm2 start config/production/ecosystem.config.js",
    "monitor:pm2-stop": "pm2 stop acc-monitoring",
    "monitor:pm2-restart": "pm2 restart acc-monitoring",
    "monitor:pm2-logs": "pm2 logs acc-monitoring",
    "monitor:pm2-status": "pm2 list",
    
    "test": "jest --config config/testing/jest.config.js",
    "test:unit": "jest --config config/testing/jest.config.js tests/unit",
    "test:integration": "jest --config config/testing/jest.config.js tests/integration",
    "test:e2e": "playwright test --config config/testing/playwright.config.ts",
    "test:load": "artillery run tests/load/dual-agent-workflow.yml",
    "test:api": "node tests/support/check-api-endpoints.js",
    "test:dashboard": "node tests/support/check-dashboard-data.js"
  }
}
```

#### Configuration File Updates

##### config/base/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "../../dist",
    "rootDir": "../../src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": "../..",
    "paths": {
      "@/config/*": ["config/*"],
      "@/docs/*": ["docs/*"],
      "@/tests/*": ["tests/*"],
      "@/cli/*": ["src/cli/*"],
      "@/agents/*": ["src/agents/*"],
      "@/services/*": ["src/services/*"],
      "@/utils/*": ["src/utils/*"]
    }
  },
  "include": [
    "../../src/**/*"
  ],
  "exclude": [
    "../../node_modules",
    "../../dist",
    "../../tests/**/*"
  ]
}
```

##### config/production/ecosystem.config.js
```javascript
module.exports = {
  apps: [{
    name: 'acc-monitoring',
    script: './monitoring-server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 6007
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 6007
    },
    error_file: '../../logs/pm2-error.log',
    out_file: '../../logs/pm2-out.log',
    log_file: '../../logs/pm2-combined.log',
    time: true
  }]
};
```

##### config/development/docker-compose.dev.yml
```yaml
version: '3.8'
services:
  acc-app:
    build:
      context: ../..
      dockerfile: config/development/Dockerfile
      target: development
    profiles: ["app"]
    volumes:
      - "../..:/workspace"
      - "../../src:/app/src"
      - "../../config:/app/config:ro"
      - "../../docs:/app/docs:ro"
      - "../../tests:/app/tests:ro"
      - "$HOME/.claude:/home/nodejs/.claude:ro"
      - "$HOME/.automatic-claude-code:/home/nodejs/.automatic-claude-code"
    working_dir: /app
    environment:
      - NODE_ENV=development
    command: ["pnpm", "run", "dev"]

  dual-agent-monitor:
    build:
      context: ../../dual-agent-monitor
      dockerfile: Dockerfile
    profiles: ["monitoring"]
    ports:
      - "6011:6011"
      - "4001:4001"
    volumes:
      - "../../dual-agent-monitor/src:/app/src"
      - "../../config/monitoring:/app/config:ro"
    environment:
      - NODE_ENV=development
      - VITE_API_BASE_URL=http://localhost:4001
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    profiles: ["monitoring", "database"]
    environment:
      POSTGRES_DB: dual_agent_monitor
      POSTGRES_USER: monitor_user
      POSTGRES_PASSWORD: monitor_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - "../../config/monitoring/init.sql:/docker-entrypoint-initdb.d/init.sql:ro"

  redis:
    image: redis:7-alpine
    profiles: ["monitoring", "cache"]
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

##### config/production/docker-compose.prod.yml
```yaml
version: '3.8'
services:
  acc-app:
    build:
      context: ../..
      dockerfile: config/production/Dockerfile
      target: production
    volumes:
      - "/workspace:/workspace:ro"
      - "$HOME/.claude:/home/nodejs/.claude:ro"
      - "$HOME/.automatic-claude-code:/home/nodejs/.automatic-claude-code"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  dual-agent-monitor:
    build:
      context: ../../dual-agent-monitor
      dockerfile: config/production/Dockerfile
    ports:
      - "6011:6011"
      - "4001:4001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://monitor_user:${POSTGRES_PASSWORD}@postgres:5432/dual_agent_monitor
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: dual_agent_monitor
      POSTGRES_USER: monitor_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - "../../config/monitoring/init.sql:/docker-entrypoint-initdb.d/init.sql:ro"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    profiles: ["nginx"]
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "../../config/production/nginx.conf:/etc/nginx/nginx.conf:ro"
      - "../../config/production/ssl:/etc/nginx/ssl:ro"
    depends_on:
      - dual-agent-monitor
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### Source Code Import Updates

##### src/cli/index.ts (New CLI Entry Point)
```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { runCommand } from './commands/run';
import { monitorCommand } from './commands/monitor';
import { historyCommand } from './commands/history';
import { logsCommand } from './commands/logs';
import { examplesCommand } from './commands/examples';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('automatic-claude-code')
  .description('Automated loop runner for Claude Code - enables continuous AI-assisted development')
  .version(process.env.npm_package_version || '1.1.0')
  .alias('acc');

// Register all commands
program.addCommand(runCommand);
program.addCommand(monitorCommand);
program.addCommand(historyCommand);
program.addCommand(logsCommand);
program.addCommand(examplesCommand);
program.addCommand(configCommand);

program.parse();
```

##### src/cli/commands/run.ts
```typescript
import { Command } from 'commander';
import { AutomaticClaudeCode } from '../../index';
import { Logger } from '../../logger';
import { config } from '@/config/base/config';
import { monitoringManager } from '../../monitoringManager';

export const runCommand = new Command('run')
  .description('Run Claude Code in automated loop')
  .argument('<prompt>', 'The initial prompt to send to Claude')
  .option('-i, --max-iterations <number>', 'Maximum number of iterations', '10')
  .option('-c, --continue-on-error', 'Continue execution even if errors occur', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('-m, --model <model>', 'Claude model to use', 'sonnet')
  .option('--dual-agent', 'Enable dual-agent mode (Manager + Worker)', false)
  .option('--manager-model <model>', 'Model for Manager agent', 'opus')
  .option('--worker-model <model>', 'Model for Worker agent', 'sonnet')
  .option('--session-id <id>', 'Resume specific session')
  .option('--work-dir <dir>', 'Working directory', process.cwd())
  .option('--allowed-tools <tools>', 'Comma-separated list of allowed tools')
  .option('--timeout <seconds>', 'Timeout for each iteration in seconds', '300')
  .action(async (prompt, options) => {
    const logger = new Logger(options.verbose);
    
    try {
      // Start monitoring if enabled
      if (config.monitoring?.enabled) {
        await monitoringManager.start();
      }

      const acc = new AutomaticClaudeCode();
      
      const loopOptions = {
        maxIterations: parseInt(options.maxIterations),
        continueOnError: options.continueOnError,
        verbose: options.verbose,
        model: options.model,
        sessionId: options.sessionId,
        workDir: options.workDir,
        allowedTools: options.allowedTools,
        timeout: parseInt(options.timeout) * 1000
      };

      if (options.dualAgent) {
        await acc.runDualAgentLoop(prompt, {
          ...loopOptions,
          managerModel: options.managerModel,
          workerModel: options.workerModel
        });
      } else {
        await acc.runLoop(prompt, loopOptions);
      }
    } catch (error) {
      logger.error('Command failed:', error);
      process.exit(1);
    }
  });
```

##### src/config.ts (Updated Config Import)
```typescript
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Load configuration from new location
const configPath = path.join(__dirname, '..', 'config', 'base', 'config.json');
const userConfigPath = path.join(os.homedir(), '.automatic-claude-code', 'config.json');

let defaultConfig = {};
if (fs.existsSync(configPath)) {
  defaultConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

let userConfig = {};
if (fs.existsSync(userConfigPath)) {
  userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf-8'));
}

export const config = {
  ...defaultConfig,
  ...userConfig
};
```

##### src/monitoringManager.ts (Updated Path References)
```typescript
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

class MonitoringManager {
  private monitoringServerPath: string;
  
  constructor() {
    // Updated path to monitoring server
    this.monitoringServerPath = path.join(
      __dirname, 
      '..', 
      'config', 
      'monitoring', 
      'monitoring-server.js'
    );
  }

  async start(): Promise<void> {
    if (!fs.existsSync(this.monitoringServerPath)) {
      throw new Error(`Monitoring server not found at ${this.monitoringServerPath}`);
    }

    const process = spawn('node', [this.monitoringServerPath], {
      detached: true,
      stdio: 'ignore'
    });

    process.unref();
  }

  // ... rest of implementation
}

export const monitoringManager = new MonitoringManager();
```

#### Docker Configuration Updates

##### config/development/Dockerfile
```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

FROM base AS development
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

FROM base AS production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY dist ./dist
COPY config ./config
COPY docs ./docs
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

#### GitHub Actions CI/CD Updates

##### .github/workflows/ci.yml
```yaml
name: CI
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'pnpm'
    
    - name: Install dependencies
      run: pnpm install
    
    - name: Lint
      run: pnpm lint --config config/base/.eslintrc.json
    
    - name: Type check
      run: pnpm typecheck --project config/base/tsconfig.json
    
    - name: Build
      run: pnpm build --project config/base/tsconfig.json
    
    - name: Unit tests
      run: pnpm test:unit --config config/testing/jest.config.js
    
    - name: Integration tests
      run: pnpm test:integration --config config/testing/jest.config.js
      
    - name: Docker build test
      run: docker build -f config/production/Dockerfile .
```

### .gitignore Pattern Updates

```gitignore
# Existing patterns (keep these)
node_modules/
*.log
npm-debug.log*
.DS_Store
Thumbs.db
dist/
*.tsbuildinfo

# NEW PATTERNS FOR RESTRUCTURE
# Configuration
config/development/.env.development
config/production/.env.production
config/production/ecosystem.config.local.js
config/monitoring/*.local.*

# Test outputs
tests/coverage/
tests/results/
tests/screenshots/
tests/reports/
tests/.nyc_output/

# Documentation builds  
docs/build/
docs/dist/
docs/.vitepress/cache/
docs/.vitepress/dist/

# Development artifacts
*.local
.env.local
.env.*.local

# IDE and editor files
.vscode/settings.json
.idea/
*.swp
*.swo

# Monitoring data
dual-agent-monitor/data/
dual-agent-monitor/logs/
dual-agent-monitor/backups/
dual-agent-monitor/.dual-agent-sessions/

# Build artifacts
/build/
*.tgz
```

## Critical Code Changes Required

### 1. Main Entry Point Refactoring

#### Extract Command Logic from src/index.ts
The current 920-line `src/index.ts` must be refactored to separate concerns:

```typescript
// BEFORE: Monolithic structure in src/index.ts
class AutomaticClaudeCode {
  // 920 lines of mixed CLI and business logic
}

// AFTER: Separated structure
// src/cli/index.ts - CLI entry point only
// src/cli/commands/run.ts - Run command logic
// src/index.ts - Core business logic class (AutomaticClaudeCode)
```

**Required Changes:**
1. Move CLI parsing logic to `src/cli/index.ts`
2. Extract individual command handlers to `src/cli/commands/*.ts`
3. Keep core `AutomaticClaudeCode` class in `src/index.ts`
4. Update all imports and dependencies

### 2. Configuration File Path Updates

#### Update All Hardcoded Paths
```typescript
// BEFORE: Hardcoded paths
const configPath = './ecosystem.config.js';
const dockerCompose = './docker-compose.yml';

// AFTER: Dynamic paths based on environment
const configPath = path.join(__dirname, '..', 'config', process.env.NODE_ENV || 'development', 'ecosystem.config.js');
const dockerCompose = path.join(__dirname, '..', 'config', process.env.NODE_ENV || 'development', 'docker-compose.yml');
```

**Files Requiring Updates:**
- `src/sessionManager.ts` - Config file references
- `src/monitoringManager.ts` - Monitoring server path
- `dual-agent-monitor/server/*.ts` - Relative path references
- All hook scripts in `.claude/hooks/` - Documentation paths

### 3. Port Configuration Standardization

#### Resolve Port Conflicts
Current conflicts between different services using ports 4001 and 4005 need resolution:

```typescript
// config/base/ports.ts (NEW FILE)
export const PORTS = {
  MONITORING_API: 4001,
  MONITORING_DASHBOARD: 6011,
  PERSISTENT_MONITOR: 6007,
  DEVELOPMENT_API: 4005, // Dev-only services
} as const;

// Update all services to use standardized ports
```

**Files Requiring Port Updates:**
- `dual-agent-monitor/vite.config.ts` - Proxy configuration
- `dual-agent-monitor/server/websocket-server.ts` - Server port
- All Docker Compose files - Port mappings
- `config/monitoring/monitoring-server.js` - Service port

### 4. Docker Volume Mapping Changes

#### Update Container Mount Points
```dockerfile
# BEFORE: Root file references
COPY ecosystem.config.js ./
COPY docs/troubleshooting.md ./docs/

# AFTER: Structured references
COPY config/production/ecosystem.config.js ./config/production/
COPY docs/ ./docs/
```

**Docker Compose Volume Updates:**
```yaml
# BEFORE
volumes:
  - "./:/workspace"
  - "./docs:/app/docs:ro"

# AFTER  
volumes:
  - "../../:/workspace"
  - "../../docs:/app/docs:ro"
  - "../../config:/app/config:ro"
  - "../../tests:/app/tests:ro"
```

## Step-by-Step Migration Process

### Phase 1: Preparation and Backup (30 minutes)

#### Step 1.1: Create Backup
```bash
# Create full project backup
cd ..
tar -czf automatic-claude-code-backup-$(date +%Y%m%d_%H%M%S).tar.gz automatic-claude-code/
cd automatic-claude-code

# Create git backup branch
git checkout -b backup-before-restructure
git push origin backup-before-restructure
git checkout main
```

#### Step 1.2: Validate Current State
```bash
# Ensure everything works before migration
pnpm install
pnpm run build
pnpm run lint
pnpm run typecheck

# Test core functionality
node dist/index.js run "test basic functionality" -i 1 -v

# Test monitoring system
pnpm run monitor:start &
sleep 5
curl -s http://localhost:6007/health
pkill -f monitoring-server
```

#### Step 1.3: Create New Directory Structure
```bash
# Create all new directories
mkdir -p docs/setup docs/deployment docs/development docs/operations docs/reference docs/reference/research
mkdir -p config/base config/development config/production config/testing config/monitoring  
mkdir -p tests/unit/agents tests/unit/services tests/unit/utils
mkdir -p tests/integration/api tests/integration/database tests/integration/monitoring
mkdir -p tests/e2e tests/load tests/fixtures tests/support
mkdir -p src/cli/commands src/cli/middleware src/cli/utils
mkdir -p logs
```

### Phase 2: Documentation Migration (45 minutes)

#### Step 2.1: Move Documentation Files
```bash
# Move documentation files with git mv for history preservation
git mv QUICK-SETUP.md docs/setup/
git mv DOCKER.md docs/deployment/
git mv CHANGELOG.md docs/reference/
git mv MIGRATION-v1.1.0.md docs/reference/
git mv DOCUMENTATION-UPDATE-SUMMARY.md docs/development/
git mv DUAL-AGENT-TEST-SUMMARY.md docs/development/
git mv GEMINI.md docs/reference/
git mv MCP_SERVERS.md docs/development/
git mv MONITORING-TEST-REPORT.md docs/operations/
git mv TEST-SCRIPTS-README.md docs/development/

# Handle files with spaces in names
git mv "Agent-Coordination-Patterns (gemini aistudio).md" docs/reference/research/Agent-Coordination-Patterns-gemini-aistudio.md
git mv "Agent-Coordination-Patterns (gemini).md" docs/reference/research/Agent-Coordination-Patterns-gemini.md
git mv "Agent-Coordination-Patterns (grok).md" docs/reference/research/Agent-Coordination-Patterns-grok.md
git mv CLAUDE_DESKTOP_RESEARCH_PROMPT.md docs/reference/research/

# Move existing docs
git mv docs/troubleshooting.md docs/operations/
```

#### Step 2.2: Create Documentation Index Files
```bash
# Create README files for each docs subdirectory
cat > docs/setup/README.md << 'EOF'
# Setup Documentation

This directory contains all setup and installation documentation:

- [QUICK-SETUP.md](QUICK-SETUP.md) - Quick start guide
- [INSTALLATION.md](INSTALLATION.md) - Detailed installation instructions
- [CONFIGURATION.md](CONFIGURATION.md) - Configuration guide
EOF

cat > docs/deployment/README.md << 'EOF'
# Deployment Documentation

This directory contains deployment-related documentation:

- [DOCKER.md](DOCKER.md) - Docker deployment guide
- [PRODUCTION.md](PRODUCTION.md) - Production deployment
- [CLOUD.md](CLOUD.md) - Cloud deployment options
EOF

cat > docs/development/README.md << 'EOF'  
# Development Documentation

This directory contains developer documentation:

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [API.md](API.md) - API documentation
- [TESTING.md](TESTING.md) - Testing guide
EOF
```

#### Step 2.3: Test Documentation Links
```bash
# Verify all documentation files exist and are accessible
find docs/ -name "*.md" -exec echo "✓ {}" \;

# Check for broken internal links (if using markdown link checker)
# npx markdown-link-check docs/**/*.md 2>/dev/null || echo "Link checker not available"
```

### Phase 3: Configuration Migration (60 minutes)

#### Step 3.1: Move Configuration Files
```bash
# Move configuration files with git mv
git mv ecosystem.config.js config/production/
git mv docker-compose.yml config/development/docker-compose.dev.yml  
git mv docker-compose.prod.yml config/production/
git mv monitoring-server.js config/monitoring/
git mv .eslintrc.json config/base/
git mv .mcp.json config/development/
git mv mcp_config.json config/development/
```

#### Step 3.2: Update Configuration File Contents

**Update config/production/ecosystem.config.js:**
```bash
cat > config/production/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'acc-monitoring',
    script: './monitoring-server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 6007
    },
    env_production: {
      NODE_ENV: 'production', 
      PORT: 6007
    },
    error_file: '../../logs/pm2-error.log',
    out_file: '../../logs/pm2-out.log',
    log_file: '../../logs/pm2-combined.log',
    time: true
  }]
};
EOF
```

**Create base TypeScript config:**
```bash
cat > config/base/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs", 
    "lib": ["ES2020"],
    "outDir": "../../dist",
    "rootDir": "../../src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": "../..",
    "paths": {
      "@/config/*": ["config/*"],
      "@/docs/*": ["docs/*"],
      "@/tests/*": ["tests/*"],
      "@/cli/*": ["src/cli/*"],
      "@/agents/*": ["src/agents/*"],
      "@/services/*": ["src/services/*"],
      "@/utils/*": ["src/utils/*"]
    }
  },
  "include": [
    "../../src/**/*"
  ],
  "exclude": [
    "../../node_modules",
    "../../dist", 
    "../../tests/**/*"
  ]
}
EOF
```

**Update root tsconfig.json to extend base:**
```bash
cat > tsconfig.json << 'EOF'
{
  "extends": "./config/base/tsconfig.json"
}
EOF
```

#### Step 3.3: Create Environment-Specific Configs

**Development environment config:**
```bash
cat > config/development/.env.development << 'EOF'
NODE_ENV=development
MONITORING_API_PORT=4001
MONITORING_DASHBOARD_PORT=6011
PERSISTENT_MONITOR_PORT=6007
DEBUG_API_PORT=4005
DATABASE_URL=postgresql://monitor_user:monitor_pass@localhost:5432/dual_agent_monitor
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
EOF
```

**Production environment template:**
```bash
cat > config/production/.env.production.example << 'EOF'
NODE_ENV=production
MONITORING_API_PORT=4001
MONITORING_DASHBOARD_PORT=6011
PERSISTENT_MONITOR_PORT=6007
DATABASE_URL=postgresql://monitor_user:${POSTGRES_PASSWORD}@localhost:5432/dual_agent_monitor
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
# Set POSTGRES_PASSWORD in production
# POSTGRES_PASSWORD=your_secure_password_here
EOF
```

#### Step 3.4: Test Configuration Changes
```bash
# Test TypeScript compilation with new config
pnpm run build

# Verify config files are accessible
node -e "console.log(require('./config/base/tsconfig.json'))"
node -e "console.log(require('./config/production/ecosystem.config.js'))"
```

### Phase 4: Script Migration (30 minutes)

#### Step 4.1: Move Script Files  
```bash
# Move test and support scripts
git mv check-api-endpoints.js tests/support/
git mv check-dashboard-data.js tests/support/
git mv get-session-details.js tests/support/
git mv send-test-session.ps1 tests/support/
git mv start-app.bat tests/support/
git mv start-monitoring.ps1 tests/support/
git mv test-example.sh tests/e2e/
git mv test-wsl.sh tests/e2e/
```

#### Step 4.2: Update Script Internal Paths
**Update tests/support/check-api-endpoints.js:**
```bash
# Update relative paths in script
sed -i 's|\.\/|\.\.\/\.\./|g' tests/support/check-api-endpoints.js
sed -i 's|require(\x27\.\x27)|require(\x27../..\x27)|g' tests/support/check-api-endpoints.js
```

**Update tests/support/start-monitoring.ps1:**
```bash
# Update PowerShell script paths
sed -i 's|monitoring-server\.js|\.\.\/\.\./config/monitoring/monitoring-server.js|g' tests/support/start-monitoring.ps1
```

#### Step 4.3: Create Test Infrastructure Files

**Create tests/support/test-helpers.ts:**
```bash
cat > tests/support/test-helpers.ts << 'EOF'
import * as path from 'path';
import * as fs from 'fs';

export class TestHelper {
  static getConfigPath(env: string = 'development'): string {
    return path.join(__dirname, '..', '..', 'config', env);
  }

  static loadConfig(configName: string, env: string = 'development') {
    const configPath = path.join(this.getConfigPath(env), configName);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config not found: ${configPath}`);
    }
    return require(configPath);
  }

  static async waitForPort(port: number, timeout: number = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) return true;
      } catch (error) {
        // Port not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }
}
EOF
```

### Phase 5: Source Code Refactoring (90 minutes)

#### Step 5.1: Create CLI Command Structure

**Create src/cli/index.ts:**
```bash
cat > src/cli/index.ts << 'EOF'
#!/usr/bin/env node

import { Command } from 'commander';
import { runCommand } from './commands/run';
import { monitorCommand } from './commands/monitor';
import { historyCommand } from './commands/history'; 
import { logsCommand } from './commands/logs';
import { examplesCommand } from './commands/examples';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('automatic-claude-code')
  .description('Automated loop runner for Claude Code - enables continuous AI-assisted development')
  .version(process.env.npm_package_version || '1.1.0')
  .alias('acc');

// Register all commands
program.addCommand(runCommand);
program.addCommand(monitorCommand);
program.addCommand(historyCommand);
program.addCommand(logsCommand);
program.addCommand(examplesCommand);
program.addCommand(configCommand);

// Handle unknown commands
program.on('command:*', (operands) => {
  console.error(`Unknown command: ${operands[0]}`);
  console.log('See --help for available commands');
  process.exit(1);
});

program.parse();
EOF
```

#### Step 5.2: Extract Run Command

**Create src/cli/commands/run.ts:**
Extract the run command logic from the current `src/index.ts` file:
```bash
# This requires manual extraction of the run logic from the monolithic index.ts
# The logic should be moved to src/cli/commands/run.ts
# While keeping the core AutomaticClaudeCode class in src/index.ts
```

#### Step 5.3: Update src/index.ts Structure

The original `src/index.ts` should be refactored to:
1. Remove CLI parsing logic (moved to `src/cli/index.ts`)
2. Keep the core `AutomaticClaudeCode` class
3. Update imports for new config locations
4. Export the class for use by CLI commands

#### Step 5.4: Update Import Paths in Source Files

**Update src/config.ts:**
```typescript
// Update config loading path
const configPath = path.join(__dirname, '..', 'config', 'base', 'config.json');
```

**Update src/monitoringManager.ts:**  
```typescript
// Update monitoring server path
const monitoringServerPath = path.join(__dirname, '..', 'config', 'monitoring', 'monitoring-server.js');
```

**Update all other source files with new import paths**

### Phase 6: Package.json and Build Updates (45 minutes)

#### Step 6.1: Update Package.json Scripts
Apply the complete package.json updates from the "Import Path Changes Required" section above.

#### Step 6.2: Update Main Entry Point
```bash
# Update package.json main entry point
sed -i 's|"main": "dist/index.js"|"main": "dist/cli/index.js"|' package.json
sed -i 's|"automatic-claude-code": "./dist/index.js"|"automatic-claude-code": "./dist/cli/index.js"|' package.json
sed -i 's|"acc": "./dist/index.js"|"acc": "./dist/cli/index.js"|' package.json
```

#### Step 6.3: Test Build Process
```bash
# Clean and rebuild
pnpm run clean
pnpm run build

# Verify build output structure
find dist/ -name "*.js" | head -10

# Test CLI functionality
node dist/cli/index.js --help
node dist/cli/index.js run --help
```

### Phase 7: Docker and Deployment Updates (60 minutes)

#### Step 7.1: Create New Dockerfiles

**Create config/development/Dockerfile:**
```bash
cat > config/development/Dockerfile << 'EOF'
FROM node:18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

FROM base AS development  
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

FROM base AS production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY dist ./dist
COPY config ./config
COPY docs ./docs
USER node
EXPOSE 3000
CMD ["node", "dist/cli/index.js"]
EOF
```

**Create config/production/Dockerfile:**
```bash
cp config/development/Dockerfile config/production/Dockerfile
```

#### Step 7.2: Update Docker Compose Files
Apply the Docker Compose changes from the "Configuration File Updates" section above.

#### Step 7.3: Update GitHub Actions
Update CI/CD pipeline files to use new config paths as shown in the "GitHub Actions CI/CD Updates" section.

#### Step 7.4: Test Docker Builds
```bash
# Test development build
docker build -f config/development/Dockerfile -t acc-dev .

# Test production build
docker build -f config/production/Dockerfile -t acc-prod .

# Test Docker Compose
docker-compose -f config/development/docker-compose.dev.yml config
```

### Phase 8: Port Standardization (30 minutes)

#### Step 8.1: Create Port Configuration File
```bash
cat > config/base/ports.ts << 'EOF'
export const PORTS = {
  MONITORING_API: 4001,
  MONITORING_DASHBOARD: 6011, 
  PERSISTENT_MONITOR: 6007,
  DEVELOPMENT_API: 4005,
} as const;

export type PortName = keyof typeof PORTS;
EOF
```

#### Step 8.2: Update Vite Configuration
```bash
# Update dual-agent-monitor/vite.config.ts
cat > dual-agent-monitor/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6011,
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
EOF
```

#### Step 8.3: Update All Port References
```bash
# Update monitoring server configuration
sed -i 's|PORT.*=.*4005|PORT = 4001|g' config/monitoring/monitoring-server.js
sed -i 's|:4005|:4001|g' config/monitoring/monitoring-server.js

# Update WebSocket server configuration
sed -i 's|:4005|:4001|g' dual-agent-monitor/server/websocket-server.ts
```

### Phase 9: Testing and Validation (60 minutes)

#### Step 9.1: Build and Link Test
```bash
# Full clean build
pnpm run clean
pnpm install
pnpm run build

# Test global link
npm unlink 2>/dev/null || true
npm link

# Verify acc command works
acc --help
acc examples
```

#### Step 9.2: Core Functionality Test
```bash
# Test basic functionality
cd /tmp
mkdir test-acc-migration && cd test-acc-migration
echo "console.log('Hello from test')" > test.js

# Test single agent mode
acc run "add a comment to test.js explaining what it does" -i 1 -v

# Verify file was modified
cat test.js

cd ~ && rm -rf /tmp/test-acc-migration
```

#### Step 9.3: Monitoring System Test
```bash
# Start monitoring in background
cd dual-agent-monitor
pnpm install
pnpm run dev &
MONITOR_PID=$!

# Wait for startup
sleep 10

# Test monitoring endpoints
curl -f http://localhost:6011/ || echo "Dashboard not accessible"
curl -f http://localhost:4001/api/health || echo "API not accessible"

# Cleanup
kill $MONITOR_PID 2>/dev/null || true
cd ..
```

#### Step 9.4: Docker Integration Test  
```bash
# Test Docker development setup
docker-compose -f config/development/docker-compose.dev.yml up -d postgres redis

# Wait for services
sleep 10

# Test database connectivity
docker-compose -f config/development/docker-compose.dev.yml exec postgres psql -U monitor_user -d dual_agent_monitor -c "SELECT 1;"

# Cleanup
docker-compose -f config/development/docker-compose.dev.yml down
```

#### Step 9.5: Dual-Agent Mode Test
```bash
# Test dual-agent functionality
cd /tmp
mkdir test-dual-agent && cd test-dual-agent
echo "# Test Project" > README.md

# Test dual-agent mode
acc run "Create a simple Node.js project with package.json and a hello world server" --dual-agent -i 3 -v

# Verify files were created
ls -la
cat package.json 2>/dev/null || echo "No package.json created"

cd ~ && rm -rf /tmp/test-dual-agent
```

## Validation Checklist

### Core Functionality Validation

#### ✅ CLI Command Tests
```bash
# Test all commands work after restructure
acc --help                          # Should show help
acc run --help                      # Should show run command help  
acc monitor --help                  # Should show monitor command help
acc history --help                  # Should show history command help
acc logs --help                     # Should show logs command help
acc examples                        # Should show examples
acc config --help                   # Should show config command help
```

#### ✅ Single Agent Mode Test
```bash
# Test basic single agent functionality
cd /tmp && mkdir acc-test && cd acc-test
echo "function test() { return true; }" > test.js

acc run "add JSDoc comments to test.js" -i 1 -v
# ✅ Expected: File should be modified with comments
# ✅ Expected: No errors in output
# ✅ Expected: Session should complete successfully

cat test.js  # Should contain JSDoc comments
cd ~ && rm -rf /tmp/acc-test
```

#### ✅ Dual Agent Mode Test
```bash
# Test dual agent coordination
cd /tmp && mkdir acc-dual-test && cd acc-dual-test
echo "# Project" > README.md

acc run "Create a simple Express.js API with basic CRUD endpoints" --dual-agent -i 5 -v
# ✅ Expected: Manager should create task breakdown
# ✅ Expected: Worker should implement specific tasks
# ✅ Expected: Files should be created (package.json, server.js, etc.)
# ✅ Expected: No coordination errors

ls -la  # Should show created files
cd ~ && rm -rf /tmp/acc-dual-test
```

### Configuration Validation

#### ✅ TypeScript Compilation Test
```bash
pnpm run clean
pnpm run build
# ✅ Expected: No compilation errors
# ✅ Expected: dist/ directory created with correct structure
# ✅ Expected: dist/cli/index.js exists as main entry point

find dist/ -name "*.js" | wc -l  # Should show compiled files
```

#### ✅ Linting and Type Checking
```bash
pnpm run lint
# ✅ Expected: No linting errors with new config location

pnpm run typecheck  
# ✅ Expected: No type errors with new path mappings
```

#### ✅ Config File Access Test
```bash
# Test configuration files are accessible
node -e "console.log(require('./config/base/tsconfig.json'))" 
# ✅ Expected: Config loads without errors

node -e "console.log(require('./config/production/ecosystem.config.js'))"
# ✅ Expected: Ecosystem config loads without errors

# Test environment configs exist
ls config/development/ | grep -E "\.(json|js|yml)$"
ls config/production/ | grep -E "\.(json|js|yml)$"  
# ✅ Expected: Config files present in both environments
```

### Docker Validation

#### ✅ Docker Build Test
```bash
# Test development build
docker build -f config/development/Dockerfile -t acc-dev-test .
# ✅ Expected: Build completes without errors
# ✅ Expected: Image created successfully

# Test production build
docker build -f config/production/Dockerfile -t acc-prod-test .
# ✅ Expected: Build completes without errors  
# ✅ Expected: Smaller image size than development

docker images | grep acc-.*-test  # Should show both images
```

#### ✅ Docker Compose Validation
```bash
# Validate Docker Compose configuration
docker-compose -f config/development/docker-compose.dev.yml config
# ✅ Expected: No configuration errors
# ✅ Expected: Services properly defined

docker-compose -f config/production/docker-compose.prod.yml config  
# ✅ Expected: No configuration errors
# ✅ Expected: Production-ready configuration
```

#### ✅ Container Functionality Test
```bash
# Test containerized ACC functionality
docker run --rm -v "$(pwd):/workspace:ro" -v "$HOME/.claude:/home/nodejs/.claude:ro" acc-dev-test run "test containerized functionality" -i 1
# ✅ Expected: Command executes without errors
# ✅ Expected: Claude CLI accessible in container
# ✅ Expected: Volume mounts working correctly
```

### Monitoring System Validation

#### ✅ Monitoring Service Start Test
```bash
# Test monitoring server startup
pnpm run monitor:start &
MONITOR_PID=$!
sleep 5

# Test monitoring endpoints
curl -f http://localhost:6007/health
# ✅ Expected: Returns health status
# ✅ Expected: No connection errors

kill $MONITOR_PID 2>/dev/null || true
```

#### ✅ Monitoring Dashboard Test  
```bash
# Test full monitoring dashboard
cd dual-agent-monitor
pnpm install  # Ensure dependencies installed
pnpm run dev &
DASHBOARD_PID=$!
sleep 10

# Test dashboard accessibility
curl -f http://localhost:6011/ 
# ✅ Expected: Returns HTML content
# ✅ Expected: Dashboard loads without errors

# Test API endpoint
curl -f http://localhost:4001/api/health
# ✅ Expected: Returns JSON health status
# ✅ Expected: API responding correctly

kill $DASHBOARD_PID 2>/dev/null || true
cd ..
```

#### ✅ Database Integration Test
```bash
# Test database connectivity (if using PostgreSQL)
docker-compose -f config/development/docker-compose.dev.yml up -d postgres
sleep 10

# Test database connection
docker-compose -f config/development/docker-compose.dev.yml exec postgres psql -U monitor_user -d dual_agent_monitor -c "SELECT version();"
# ✅ Expected: Returns PostgreSQL version
# ✅ Expected: Database accessible and functional

docker-compose -f config/development/docker-compose.dev.yml down
```

### Documentation Validation

#### ✅ Documentation Structure Test
```bash
# Verify all documentation moved correctly
find docs/ -name "*.md" -type f | sort
# ✅ Expected: All documentation files in proper locations
# ✅ Expected: No broken file references

# Test documentation accessibility
ls docs/setup/QUICK-SETUP.md
ls docs/deployment/DOCKER.md  
ls docs/reference/CHANGELOG.md
# ✅ Expected: All files accessible at new locations
```

#### ✅ Link Validation Test  
```bash
# Check for broken internal documentation links
grep -r "\.\./" docs/ | grep "\.md"
# ✅ Expected: No broken relative links in documentation

# Verify README files created
ls docs/*/README.md
# ✅ Expected: README files in each docs subdirectory
```

### Performance and Monitoring Verification

#### ✅ Response Time Test
```bash
# Test CLI response time
time acc --help  
# ✅ Expected: Response < 2 seconds
# ✅ Expected: Help displayed correctly

# Test monitoring API response time  
time curl -s http://localhost:4001/api/health
# ✅ Expected: Response < 500ms
# ✅ Expected: Proper JSON response
```

#### ✅ Memory Usage Test
```bash
# Test memory usage during operation
acc run "create a simple test file" -i 1 -v &
ACC_PID=$!
sleep 2

# Check memory usage
ps -o pid,pmem,rss,cmd -p $ACC_PID
# ✅ Expected: Memory usage < 512MB for single agent
# ✅ Expected: No memory leaks during execution

wait $ACC_PID
```

#### ✅ Session Management Test
```bash
# Test session persistence
acc run "test session management" -i 1 --session-id test-session -v
# ✅ Expected: Session created with ID
# ✅ Expected: Session data stored correctly

# Test session resumption
acc run "continue session test" -i 1 --session-id test-session -v  
# ✅ Expected: Previous session context loaded
# ✅ Expected: No session conflicts
```

### Integration and End-to-End Validation

#### ✅ Multi-Command Workflow Test
```bash
cd /tmp && mkdir workflow-test && cd workflow-test

# Test complete workflow
acc run "create package.json for Node.js project" -i 1 -v
# ✅ Expected: package.json created

acc run "add express dependency and create server.js" -i 2 -v  
# ✅ Expected: Dependencies added, server file created

acc run "add basic error handling to server.js" -i 1 -v
# ✅ Expected: Error handling implemented

# Verify final state
cat package.json | grep express  # Should show express dependency
grep -i error server.js          # Should show error handling

cd ~ && rm -rf /tmp/workflow-test
```

#### ✅ External Tool Integration Test
```bash
# Test tool integration still works
cd /tmp && mkdir tool-test && cd tool-test
echo "test file" > input.txt

acc run "read input.txt and create summary.txt with file contents analysis" -i 2 -v
# ✅ Expected: Read tool works correctly
# ✅ Expected: Write tool creates new file
# ✅ Expected: No tool permission errors

ls -la  # Should show both input.txt and summary.txt
cd ~ && rm -rf /tmp/tool-test
```

#### ✅ Cross-Platform Compatibility Test
```bash
# Test Windows batch file (if on Windows)
tests/support/start-app.bat 2>/dev/null || echo "Windows script not testable on this platform"

# Test PowerShell script (if available)  
powershell -ExecutionPolicy Bypass -File tests/support/start-monitoring.ps1 2>/dev/null || echo "PowerShell not available"

# Test shell scripts
bash tests/e2e/test-example.sh 2>/dev/null || echo "Shell script requires Claude CLI setup"
```

## Rollback Procedures

### Emergency Rollback (if critical issues occur)

#### Immediate Rollback to Backup Branch
```bash
# If major issues occur, immediately rollback
git stash  # Save any current work
git checkout backup-before-restructure
git checkout -b emergency-rollback

# Test functionality
pnpm install
pnpm run build
node dist/index.js run "test emergency rollback" -i 1

# If working, merge back to main
git checkout main
git reset --hard backup-before-restructure
```

#### Selective Rollback of Specific Changes

**Rollback Documentation Changes Only:**
```bash
# Restore original documentation structure
git checkout backup-before-restructure -- *.md
git checkout backup-before-restructure -- docs/

# Remove new docs structure
rm -rf docs/setup docs/deployment docs/development docs/operations docs/reference
```

**Rollback Configuration Changes Only:**
```bash
# Restore original config files
git checkout backup-before-restructure -- ecosystem.config.js
git checkout backup-before-restructure -- docker-compose.yml
git checkout backup-before-restructure -- docker-compose.prod.yml
git checkout backup-before-restructure -- .eslintrc.json

# Remove new config structure
rm -rf config/
```

**Rollback Source Code Changes Only:**
```bash
# Restore original src/index.ts
git checkout backup-before-restructure -- src/index.ts
git checkout backup-before-restructure -- package.json

# Remove CLI structure
rm -rf src/cli/
```

#### Partial Migration Recovery

If migration fails at a specific phase, you can continue from that point:

**Resume from Phase 3 (Configuration Migration):**
```bash
# Assuming documentation migration (Phase 2) completed successfully
# Reset only configuration changes
git checkout backup-before-restructure -- ecosystem.config.js docker-compose.yml docker-compose.prod.yml
rm -rf config/
# Then restart from Phase 3 Step 3.1
```

**Resume from Phase 5 (Source Code Refactoring):**
```bash
# Keep docs and config changes, reset only source code
git checkout backup-before-restructure -- src/index.ts package.json
rm -rf src/cli/
# Then restart from Phase 5 Step 5.1
```

### Validation After Rollback

#### Test Core Functionality After Rollback
```bash
# After any rollback, verify basic functionality
pnpm install
pnpm run build
npm link

# Test basic command
acc run "test rollback functionality" -i 1 -v
# ✅ Expected: Command works as before migration

# Test monitoring  
pnpm run monitor:start &
sleep 5
curl http://localhost:6007/health
pkill -f monitoring-server
# ✅ Expected: Monitoring works as before migration
```

This comprehensive migration guide ensures that the folder restructuring can be executed safely with clear rollback procedures if any issues occur during the migration process.