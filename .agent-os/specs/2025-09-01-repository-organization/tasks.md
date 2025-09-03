# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-01-repository-organization/spec.md

> Created: 2025-09-01
> Status: Ready for Implementation

## Tasks

### Phase 1: Analysis and Planning
- [ ] **Task 1.1**: Conduct comprehensive audit of all 38+ root directory files
- [ ] **Task 1.2**: Identify and map all relative path references across the codebase
- [ ] **Task 1.3**: Classify scripts by function (build, deploy, development, maintenance)
- [ ] **Task 1.4**: Document current CI/CD dependencies and path requirements
- [ ] **Task 1.5**: Create detailed file movement plan with backward compatibility considerations

### Phase 2: Directory Structure Creation
- [ ] **Task 2.1**: Create `/scripts` directory with subdirectories (build, deploy, dev, maintenance)
- [ ] **Task 2.2**: Create `/archive` directory with version-specific subdirectories
- [ ] **Task 2.3**: Set up proper permissions and executable flags for script directories
- [ ] **Task 2.4**: Create README files for each new directory explaining contents and usage

### Phase 3: Script Organization and Movement
- [ ] **Task 3.1**: Move PowerShell scripts (*.ps1) to appropriate `/scripts` subdirectories using `git mv`
- [ ] **Task 3.2**: Move shell scripts (*.sh) to appropriate `/scripts` subdirectories using `git mv`
- [ ] **Task 3.3**: Move batch files (*.cmd, *.bat) to appropriate `/scripts` subdirectories using `git mv`
- [ ] **Task 3.4**: Organize Docker Compose variants into `/scripts/deploy` directory
- [ ] **Task 3.5**: Verify all moved scripts maintain executable permissions

### Phase 4: Documentation Archiving
- [ ] **Task 4.1**: Move migration documents (MIGRATION-*.md) to `/archive/v1.0/migration-docs/`
- [ ] **Task 4.2**: Move implementation summaries (*-IMPLEMENTATION-*.md) to `/archive/v1.0/implementation-summaries/`
- [ ] **Task 4.3**: Archive duplicate documentation files to `/archive/legacy/`
- [ ] **Task 4.4**: Move research documents to `/archive/research/`
- [ ] **Task 4.5**: Create index files in archive directories for easy navigation

### Phase 5: Path Reference Updates
- [ ] **Task 5.1**: Update package.json scripts section with new script paths
- [ ] **Task 5.2**: Update GitHub Actions workflows (.github/workflows/) with corrected paths
- [ ] **Task 5.3**: Update Dockerfile COPY instructions for any moved files
- [ ] **Task 5.4**: Update docker-compose.yml volume mounts and configuration paths
- [ ] **Task 5.5**: Scan and update all markdown files with internal references to moved files

### Phase 6: Configuration Management
- [ ] **Task 6.1**: Evaluate need for `/config` directory for non-root configuration files
- [ ] **Task 6.2**: Consolidate duplicate configuration files where appropriate
- [ ] **Task 6.3**: Update configuration file references in source code and scripts
- [ ] **Task 6.4**: Document configuration file locations and purposes

### Phase 7: Validation and Testing
- [ ] **Task 7.1**: Run full build process (`pnpm run build`) to verify no broken references
- [ ] **Task 7.2**: Test all moved scripts for proper execution and functionality
- [ ] **Task 7.3**: Validate that `npm link` global installation still functions correctly
- [ ] **Task 7.4**: Verify CI/CD pipelines execute successfully with new structure
- [ ] **Task 7.5**: Test Docker build and deployment processes with updated paths

### Phase 8: Documentation Updates
- [ ] **Task 8.1**: Update main README.md with new directory structure explanation
- [ ] **Task 8.2**: Update CLAUDE.md with any changed file references
- [ ] **Task 8.3**: Create or update CONTRIBUTING.md with new file organization guidelines
- [ ] **Task 8.4**: Update any API documentation with corrected script and file paths
- [ ] **Task 8.5**: Create migration guide for developers familiar with old structure

### Phase 9: Final Cleanup and Verification
- [ ] **Task 9.1**: Verify root directory contains <15 files (target achieved)
- [ ] **Task 9.2**: Run comprehensive test suite to ensure no functional regressions
- [ ] **Task 9.3**: Update project documentation with before/after directory structure comparison
- [ ] **Task 9.4**: Create rollback plan in case of issues with new structure
- [ ] **Task 9.5**: Commit all changes with descriptive commit message documenting reorganization

### Success Criteria
- Root directory reduced from 38+ files to <15 essential files
- All scripts properly organized and executable in `/scripts` directory
- Historical documents preserved and organized in `/archive` directory
- All build, test, and deployment processes continue to function correctly
- Documentation accurately reflects new repository organization
- No broken file references or path dependencies