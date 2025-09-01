# Spec Requirements Document

> Spec: Comprehensive Folder Structure Reorganization
> Created: 2025-09-01
> Status: Planning

## Overview

Reorganize the automatic-claude-code project's folder structure to eliminate root directory clutter, improve maintainability, and align with Agent OS conventions while preserving the robust dual-agent architecture and monitoring capabilities.

## User Stories

### Developer Navigation Enhancement

As a developer contributing to the automatic-claude-code project, I want a clean, organized folder structure, so that I can quickly locate files, understand the codebase architecture, and contribute effectively without getting lost in scattered documentation and configuration files.

**Detailed Workflow**: Developers will navigate to specific functionality areas (docs, tests, config, source code) through clearly defined directories rather than scanning through 15+ markdown files and numerous scripts in the root directory.

### Maintenance and Scalability Improvement

As a project maintainer, I want a modular, well-structured codebase, so that I can easily add new features, update documentation, and manage configurations without breaking existing functionality or creating technical debt.

**Detailed Workflow**: Maintainers will follow established patterns for adding new components, with clear separation between CLI application code, monitoring system, documentation, tests, and configuration files.

### Agent OS Integration Compliance

As an Agent OS user, I want the project to follow Agent OS folder conventions, so that AI agents can efficiently navigate the codebase and assist with development tasks using standardized patterns.

**Detailed Workflow**: Agent OS workflows will seamlessly integrate with the project structure, using the `.agent-os/` directory for specs, instructions, and AI-optimized documentation formats.

## Spec Scope

1. **Documentation Reorganization** - Move 15+ scattered markdown files into a hierarchical `docs/` structure with logical categorization (architecture, setup, operations, development)
2. **Test File Consolidation** - Migrate all test scripts, PowerShell files, and verification scripts from root into organized `tests/` directory with subdirectories for different test types
3. **Configuration Management** - Consolidate scattered config files (ecosystem.config.js, mcp_config.json, monitoring-server.js) into a centralized `config/` directory structure
4. **Source Code Modularization** - Refactor the monolithic 920-line `src/index.ts` into a command-based CLI structure with separate modules for each command type
5. **Port Configuration Standardization** - Resolve inconsistent port configurations across monitoring system components (4001 vs 4005 vs 6007 vs 6011)

## Out of Scope

- Changes to the dual-agent architecture core logic or algorithms
- Modifications to the monitoring system's React frontend structure (already well-organized)
- Database schema or data migration changes
- External API integrations or webhook configurations
- Performance optimizations or feature additions
- Docker container internal structure changes (focus only on host folder mapping)

## Expected Deliverable

1. **Clean Root Directory** - Root directory contains only essential files (package.json, README.md, core config files) with all documentation moved to organized `docs/` hierarchy
2. **Modular CLI Application** - Main entry point refactored from 920-line monolith to command-based structure with separate modules for run, dual-agent, monitor, history, and log commands
3. **Comprehensive Migration Guide** - Detailed documentation of all moved files, updated import paths, and configuration changes required to maintain functionality without breaking the application

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-01-comprehensive-folder-restructure/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-01-comprehensive-folder-restructure/sub-specs/technical-spec.md