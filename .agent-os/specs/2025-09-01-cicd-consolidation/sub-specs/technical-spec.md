# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-cicd-consolidation/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Technical Requirements

### Workflow Architecture
- **Single Workflow File**: `.github/workflows/ci.yml` replaces all existing workflows
- **Matrix Strategy**: Node.js versions [18.x, 20.x, 22.x] on [ubuntu-latest, windows-latest, macos-latest]
- **Conditional Execution**: Jobs triggered based on changed file patterns using `paths` filters
- **Parallel Execution**: Independent jobs run concurrently where dependencies allow

### Caching Strategy
```yaml
- name: Setup pnpm cache
  uses: pnpm/action-setup@v4
  with:
    version: latest
    run_install: false

- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: |
      ~/.pnpm-store
      node_modules
      dual-agent-monitor/node_modules
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-
```

### Job Structure
1. **lint-and-typecheck**: Code quality and type safety validation
2. **test-matrix**: Unit and integration tests across matrix combinations
3. **build-matrix**: Build verification across platforms
4. **docker-build**: Container builds with multi-architecture support
5. **publish**: Conditional publishing to GHCR on main branch

### Fail-Fast Implementation
- Matrix builds with `fail-fast: false` for comprehensive feedback
- Early termination on critical failures (lint, typecheck)
- Conditional job execution to skip irrelevant builds
- Fast feedback within 2-3 minutes for common failures

## Approach

### Phase 1: Analysis and Consolidation
- Analyze existing workflows (simple-ci.yml, main.yml, ci.yml)
- Identify unique features and requirements from each workflow
- Map dependencies between jobs and determine optimal execution order

### Phase 2: Unified Workflow Design
- Create comprehensive job dependency graph
- Implement matrix strategy for platform and version coverage
- Design caching strategy for maximum efficiency
- Implement conditional execution based on file changes

### Phase 3: Migration and Testing
- Create new consolidated workflow
- Test workflow with various scenarios (PR, push, release)
- Verify all existing functionality is preserved
- Remove redundant workflow files

### Optimization Strategies

#### Smart Caching
- **pnpm Store**: Global package cache across jobs
- **node_modules**: Per-platform dependency caching
- **Build Artifacts**: TypeScript compilation and dist/ caching
- **Docker Layers**: Multi-stage build optimization

#### Conditional Execution
```yaml
jobs:
  frontend-tests:
    if: contains(github.event.head_commit.message, '[frontend]') || 
        contains(github.event.pull_request.changed_files, 'dual-agent-monitor/')
  
  docker-build:
    if: github.ref == 'refs/heads/main' || 
        contains(github.event.pull_request.labels.*.name, 'docker')
```

#### Matrix Optimization
```yaml
strategy:
  fail-fast: false
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node: [18.x, 20.x, 22.x]
    include:
      - os: ubuntu-latest
        node: 20.x
        publish: true
    exclude:
      - os: macos-latest
        node: 18.x  # Skip older Node on macOS for speed
```

## External Dependencies

### GitHub Actions
- `actions/checkout@v4`: Source code checkout
- `actions/setup-node@v4`: Node.js environment setup
- `pnpm/action-setup@v4`: pnpm package manager
- `actions/cache@v4`: Dependency and artifact caching
- `docker/setup-buildx-action@v3`: Docker multi-arch builds
- `docker/login-action@v3`: GHCR authentication
- `docker/build-push-action@v5`: Container publishing

### Runtime Dependencies
- Node.js 18.x, 20.x, 22.x support
- pnpm package manager
- Docker and Docker Buildx
- GitHub Container Registry access

### Performance Targets
- **Build Time**: Reduce from current ~8-12 minutes to 4-6 minutes
- **Cache Hit Rate**: Achieve 85%+ cache hit rate for dependencies
- **Parallel Execution**: 3-4 jobs running concurrently
- **Feedback Time**: Critical failures detected within 2-3 minutes