# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-monorepo-structure/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Technical Requirements

### Root Configuration Files

#### pnpm-workspace.yaml
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

#### Root package.json Structure
```json
{
  "name": "automatic-claude-code-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

### Package Structure

#### packages/cli/
- **Purpose**: Main automatic-claude-code CLI application
- **Entry Point**: `src/index.ts`
- **Key Dependencies**: commander, chalk, spawn-related utilities
- **Build Target**: Executable CLI with proper shebang

#### packages/monitor/
- **Purpose**: Dual-agent monitoring dashboard
- **Structure**: 
  - `src/` - React frontend
  - `server/` - Express + WebSocket backend
- **Dependencies**: React, Express, WebSocket libraries
- **Build Targets**: Frontend bundle + server executable

#### packages/types/
- **Purpose**: Shared TypeScript type definitions
- **Exports**: Agent types, configuration interfaces, monitoring types
- **No Runtime Dependencies**: Types-only package

#### packages/shared-config/
- **Purpose**: Common configuration and utilities
- **Contents**: ESLint configs, TypeScript configs, shared utilities
- **Dependencies**: Configuration tools and utilities

### Dependency Management Strategy

#### Hoisted Dependencies (Root Level)
```json
{
  "dependencies": {
    "typescript": "^5.0.0",
    "zod": "^3.22.0",
    "winston": "^3.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "vitest": "^1.0.0"
  }
}
```

#### Package-Specific Dependencies
- CLI package: `commander`, `chalk`, process management
- Monitor package: `react`, `express`, `ws`, UI libraries
- Types package: No runtime dependencies
- Shared config: Configuration utilities only

### Build System Configuration

#### TypeScript Configuration
```json
// packages/tsconfig.json (shared)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

#### ESLint Configuration
```javascript
// .eslintrc.js (root)
module.exports = {
  extends: ['./packages/shared-config/eslint.config.js'],
  root: true
}
```

## Approach

### Phase 1: Structure Preparation
1. Create `packages/` directory structure
2. Setup root `pnpm-workspace.yaml`
3. Create package-specific `package.json` files
4. Configure TypeScript project references

### Phase 2: Code Migration
1. Move CLI code to `packages/cli/src/`
2. Move monitoring code to `packages/monitor/`
3. Extract shared types to `packages/types/`
4. Create shared configuration package

### Phase 3: Dependency Optimization
1. Analyze current dependencies for hoisting opportunities
2. Update package.json files with proper dependency distribution
3. Run `pnpm install` to optimize dependency tree
4. Verify no duplicate installations

### Phase 4: Tooling Unification
1. Setup unified build scripts using `pnpm -r`
2. Configure shared ESLint, Prettier, TypeScript configs
3. Update CI/CD workflows for monorepo structure
4. Test all cross-package integrations

### Phase 5: Verification & Documentation
1. Verify all existing functionality works
2. Test build, development, and deployment workflows
3. Update documentation for new structure
4. Validate Docker builds work with new structure

## External Dependencies

### Build Tools
- **pnpm**: Workspace management and dependency optimization
- **TypeScript**: Compilation with project references
- **ESLint**: Linting across all packages
- **Prettier**: Code formatting consistency

### Development Dependencies
- **Vitest**: Testing framework for all packages
- **tsx**: Development mode TypeScript execution
- **concurrently**: Parallel script execution for development

### Package Management
- **@manypkg/cli**: Monorepo package management utilities
- **syncpack**: Dependency version synchronization
- **changeset**: Package versioning and publishing (future)

### Integration Requirements
- Maintain existing CLI command compatibility
- Preserve monitoring dashboard functionality
- Keep Docker build processes working
- Ensure CI/CD pipelines continue to function