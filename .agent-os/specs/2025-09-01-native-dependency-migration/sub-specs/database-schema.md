# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-01-native-dependency-migration/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Schema Changes

**No schema changes required** - better-sqlite3 uses the same SQLite file format and is 100% compatible with existing database schemas.

### Database Compatibility
- **File Format**: SQLite database files (.db, .sqlite, .sqlite3) remain unchanged
- **Table Structures**: All existing table definitions work without modification
- **Data Types**: All SQLite data types (INTEGER, TEXT, REAL, BLOB, NULL) supported identically
- **Constraints**: PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK constraints unchanged
- **Indexes**: All existing indexes continue to work without recreation
- **Views**: All database views maintain compatibility
- **Triggers**: All database triggers continue to function

### Current Database Schema (Unchanged)
```sql
-- Sessions table (dual-agent-monitor)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  workDir TEXT NOT NULL,
  startTime INTEGER NOT NULL,
  endTime INTEGER,
  status TEXT DEFAULT 'active',
  agentType TEXT,
  metadata TEXT
);

-- Events table (dual-agent-monitor)
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  agentType TEXT NOT NULL,
  eventType TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (sessionId) REFERENCES sessions(id)
);

-- Configuration table (main app)
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

## Migrations

**No database migrations required** - this is a runtime dependency change only.

### Migration Process
1. **Database Files**: Existing .db files work without modification
2. **Schema Version**: No schema version updates needed
3. **Data Integrity**: All existing data remains accessible
4. **Backup Strategy**: Current backup files remain valid

### Connection String Updates
```javascript
// OLD (sqlite3):
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sessions.db');

// NEW (better-sqlite3):
const Database = require('better-sqlite3');
const db = new Database('./sessions.db');
```

### Query Pattern Updates
```javascript
// CREATE TABLE (unchanged SQL, different execution)
// OLD:
db.run(`CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  workDir TEXT NOT NULL
)`, callback);

// NEW:
db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  workDir TEXT NOT NULL
)`);
```

### Database File Locations (Unchanged)
- **Main App**: `~/.automatic-claude-code/sessions.db`
- **Dual-Agent Monitor**: `./dual-agent-monitor/database/monitor.db`
- **Test Databases**: `./tests/fixtures/*.db`

### Performance Considerations
- **File Size**: Database files may be slightly smaller due to better-sqlite3 optimizations
- **Write Speed**: Faster write operations may result in more frequent disk flushes
- **Read Speed**: Significantly faster read operations with better caching
- **Memory Usage**: Lower memory overhead per connection