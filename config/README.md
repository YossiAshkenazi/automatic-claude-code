# Configuration Management

This directory contains organized configuration files for the automatic-claude-code project.

## Directory Structure

```
config/
├── base/                  # Common configurations shared across environments
├── development/           # Development-specific configurations
├── production/            # Production environment configurations  
├── testing/               # Test environment configurations
├── monitoring/            # Monitoring service configurations
├── index.ts              # Centralized configuration loader
└── README.md             # This file
```

## Usage

### Centralized Config Loader

```typescript
import { getConfig, getPM2Config, getMCPConfig, getJestConfig } from './config';

// Get application configuration
const appConfig = getConfig();

// Get specific configurations
const pm2Config = getPM2Config();
const mcpConfig = getMCPConfig();
const jestConfig = getJestConfig();
```

### Environment Resolution

Configuration files are loaded with environment-specific precedence:

1. **Environment-specific** (e.g., `config/production/`)
2. **Base fallback** (e.g., `config/base/`)

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `ecosystem.config.js` | `production/` | PM2 process management |
| `mcp_config.json` | `base/` | MCP server configurations |
| `jest.config.js` | `testing/` | Jest test configurations |
| `jest.config.sdk.js` | `testing/` | Jest SDK-specific tests |
| `monitoring-server.js` | `monitoring/` | Monitoring service |
| `verify-monitoring-setup.js` | `monitoring/` | Monitoring verification |

## Environment Variables

The configuration system respects these environment variables:

- `NODE_ENV` - Environment selection (development, production, testing)
- `MONITORING_PORT` - Monitoring service port (default: 6007)
- `MONITORING_HOST` - Monitoring service host (default: localhost)
- `WEBSOCKET_ENABLED` - Enable WebSocket support (default: true)
- `LOG_LEVEL` - Logging level (default: info)

## Migration from Root Directory

Previously scattered configuration files have been organized:

- `ecosystem.config.js` → `config/production/ecosystem.config.js`
- `mcp_config.json` → `config/base/mcp_config.json`
- `monitoring-server.js` → `config/monitoring/monitoring-server.js`
- `jest.config.js` → `config/testing/jest.config.js`
- `jest.config.sdk.js` → `config/testing/jest.config.sdk.js`
- `verify-monitoring-setup.js` → `config/monitoring/verify-monitoring-setup.js`

All references in source code, Docker configurations, and package.json have been updated accordingly.