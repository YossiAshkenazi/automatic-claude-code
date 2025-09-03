# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-01-monorepo-structure/spec.md

> Created: 2025-09-01
> Status: Ready for Implementation

## Tasks

### Phase 1: Monorepo Structure Setup (2-3 hours)

#### Task 1.1: Create Root Workspace Configuration
- [ ] Create `pnpm-workspace.yaml` in root directory
- [ ] Update root `package.json` with workspace configuration
- [ ] Add unified scripts for build, test, lint, dev operations
- [ ] Setup workspace-specific `.gitignore` patterns

#### Task 1.2: Create Package Directory Structure
- [ ] Create `packages/` directory
- [ ] Setup `packages/cli/` directory structure
- [ ] Setup `packages/monitor/` directory structure  
- [ ] Create `packages/types/` for shared TypeScript definitions
- [ ] Create `packages/shared-config/` for common configurations

#### Task 1.3: Initialize Package Configurations
- [ ] Create `package.json` for each package with proper naming
- [ ] Setup TypeScript `tsconfig.json` with project references
- [ ] Configure ESLint and Prettier for each package
- [ ] Add build scripts and entry points for each package

### Phase 2: Code Migration (3-4 hours)

#### Task 2.1: Migrate CLI Package
- [ ] Move `src/` directory to `packages/cli/src/`
- [ ] Update imports and paths in CLI code
- [ ] Migrate CLI-specific dependencies to `packages/cli/package.json`
- [ ] Update build configuration for CLI executable

#### Task 2.2: Migrate Monitoring Package
- [ ] Move `dual-agent-monitor/` to `packages/monitor/`
- [ ] Update monitoring package structure and dependencies
- [ ] Fix imports and paths in monitoring code
- [ ] Ensure WebSocket server and React frontend work together

#### Task 2.3: Extract Shared Types
- [ ] Identify common types used across packages
- [ ] Move shared types to `packages/types/src/`
- [ ] Update imports across all packages to use shared types
- [ ] Export types properly from types package

#### Task 2.4: Create Shared Configuration Package
- [ ] Move common ESLint, Prettier, TypeScript configs to `packages/shared-config/`
- [ ] Create shared utility functions used across packages
- [ ] Update package references to use shared configurations
- [ ] Ensure consistent tooling across all packages

### Phase 3: Dependency Optimization (1-2 hours)

#### Task 3.1: Analyze and Hoist Dependencies
- [ ] Audit current dependencies across all packages
- [ ] Identify candidates for hoisting to root level
- [ ] Move shared dependencies to root `package.json`
- [ ] Keep package-specific dependencies in respective packages

#### Task 3.2: Optimize Package Dependencies
- [ ] Remove duplicate dependencies between packages
- [ ] Ensure proper peer dependency relationships
- [ ] Update version constraints to be consistent across workspace
- [ ] Run `pnpm install` to optimize dependency tree

#### Task 3.3: Validate Dependency Resolution
- [ ] Check for any missing dependencies after migration
- [ ] Ensure all packages can resolve their dependencies correctly
- [ ] Test import resolution across package boundaries
- [ ] Verify no circular dependencies exist

### Phase 4: Build System Integration (2-3 hours)

#### Task 4.1: Configure TypeScript Project References
- [ ] Setup root `tsconfig.json` with project references
- [ ] Configure each package's TypeScript build to reference dependencies
- [ ] Enable incremental builds and composite projects
- [ ] Test TypeScript compilation across entire workspace

#### Task 4.2: Unified Build Scripts
- [ ] Configure `pnpm -r build` to build all packages in correct order
- [ ] Setup parallel development scripts with `pnpm -r --parallel dev`
- [ ] Create unified test runner for all packages
- [ ] Add workspace-wide lint and typecheck commands

#### Task 4.3: Development Workflow Setup
- [ ] Configure watch mode for cross-package development
- [ ] Ensure hot reload works for monitoring dashboard
- [ ] Test CLI development workflow with linked packages
- [ ] Verify Docker builds work with new monorepo structure

### Phase 5: CI/CD and Documentation (1-2 hours)

#### Task 5.1: Update CI/CD Workflows
- [ ] Modify GitHub Actions to work with monorepo structure
- [ ] Update Docker build processes for new package structure
- [ ] Ensure all existing CI/CD functionality continues to work
- [ ] Add workspace-specific build and test jobs if needed

#### Task 5.2: Update Documentation
- [ ] Update README.md with new monorepo setup instructions
- [ ] Document package structure and relationships
- [ ] Update development workflow documentation
- [ ] Create migration guide from current structure

#### Task 5.3: Verification and Testing
- [ ] Run full test suite to ensure all functionality works
- [ ] Test CLI commands work from any directory
- [ ] Verify monitoring dashboard builds and runs correctly
- [ ] Test Docker containers work with new structure
- [ ] Validate all existing features continue to function

### Phase 6: Final Cleanup (1 hour)

#### Task 6.1: Remove Legacy Structure
- [ ] Remove old `dual-agent-monitor/` directory after migration
- [ ] Clean up root-level files that moved to packages
- [ ] Update .gitignore for new structure
- [ ] Remove any obsolete configuration files

#### Task 6.2: Performance Validation
- [ ] Measure install time improvement with hoisted dependencies
- [ ] Verify build times are reasonable across all packages
- [ ] Test memory usage during development
- [ ] Ensure no regression in CLI startup time

## Success Criteria

### Functional Requirements
- [ ] All existing CLI commands work identically
- [ ] Monitoring dashboard functions without changes
- [ ] Docker builds complete successfully
- [ ] CI/CD pipelines pass all tests
- [ ] Development workflows function smoothly

### Performance Requirements
- [ ] `pnpm install` completes faster than current setup
- [ ] Build times are comparable or better than current setup
- [ ] No increase in CLI startup time
- [ ] Development hot reload times remain fast

### Maintainability Requirements
- [ ] Clear package boundaries and responsibilities
- [ ] Consistent tooling configuration across packages
- [ ] Simplified dependency management
- [ ] Easy to add new packages to workspace
- [ ] Clear documentation for development workflow