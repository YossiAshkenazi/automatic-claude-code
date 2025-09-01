# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-native-dependency-migration/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Technical Requirements

### Core Migration Requirements
- **Dependency Replacement**: Replace `sqlite3` with `better-sqlite3` in all package.json files
- **API Migration**: Convert callback-based database operations to synchronous calls
- **Error Handling**: Update error handling patterns for synchronous operations
- **Connection Management**: Update database connection initialization and cleanup
- **Transaction Handling**: Migrate transaction patterns to better-sqlite3 syntax
- **Prepared Statements**: Update prepared statement creation and execution

### Platform Compatibility
- **Node.js Versions**: Support Node 16, 18, 20+ 
- **Architectures**: x64, ARM64 support across all platforms
- **Operating Systems**: Windows 10/11, macOS 12+, Ubuntu 20.04+
- **Container Environments**: Docker, Kubernetes compatibility

### Performance Requirements
- **Query Performance**: 2-3x improvement in read operations
- **Memory Usage**: Reduced memory footprint compared to sqlite3
- **Startup Time**: Faster application initialization
- **Build Time**: Eliminate native compilation during npm install

## Approach

### Phase 1: Dependency Update
1. **Package Dependencies**: Update package.json in both main app and dual-agent-monitor
2. **Lock File Regeneration**: Delete package-lock.json/pnpm-lock.yaml and reinstall
3. **Docker Images**: Update Dockerfile to remove build dependencies (python, build-essential)

### Phase 2: Code Migration
1. **Database Connections**: Update connection initialization from async to sync
2. **Query Patterns**: Convert `.all()`, `.get()`, `.run()` callback patterns to synchronous calls
3. **Error Handling**: Wrap synchronous calls in try-catch blocks
4. **Transaction Patterns**: Update transaction begin/commit/rollback to better-sqlite3 syntax
5. **Prepared Statements**: Update prepared statement creation and binding

### Phase 3: API Compatibility Layer
```javascript
// Migration pattern example
// OLD (sqlite3):
db.get("SELECT * FROM sessions WHERE id = ?", [id], (err, row) => {
  if (err) return callback(err);
  callback(null, row);
});

// NEW (better-sqlite3):
try {
  const stmt = db.prepare("SELECT * FROM sessions WHERE id = ?");
  const row = stmt.get(id);
  callback(null, row);
} catch (err) {
  callback(err);
}
```

### Phase 4: Testing & Validation
1. **Unit Tests**: Update existing database tests to use synchronous patterns
2. **Integration Tests**: Validate dual-agent-monitor database operations
3. **Cross-Platform Testing**: Validate on Windows, macOS, Linux
4. **Docker Testing**: Ensure container builds work without build tools
5. **Performance Testing**: Benchmark query performance improvements

## External Dependencies

### Removed Dependencies
- `sqlite3` - Current SQLite driver with native compilation
- `node-gyp` - No longer required for better-sqlite3
- `python` - Build dependency eliminated
- `build-essential` (Linux) / Visual Studio Build Tools (Windows) - No longer needed

### Added Dependencies
- `better-sqlite3` - New SQLite driver with precompiled binaries
- No additional build dependencies required

### Updated Build Process
- **Docker**: Remove python and build-essential from base images
- **CI/CD**: Faster builds without compilation steps
- **Local Development**: One-command installation without setup prerequisites

### Database File Compatibility
- **File Format**: 100% compatible with existing SQLite database files
- **Schema**: No changes required to existing database schemas
- **Data Migration**: No data migration needed - same file format
- **Backup/Restore**: Existing procedures remain unchanged