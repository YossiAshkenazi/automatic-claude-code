-- SQLite Schema for Dual-Agent Monitor Database
-- This schema supports both development (SQLite) and can be adapted for production (PostgreSQL)

PRAGMA foreign_keys = ON;

-- Sessions table - Core session management
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused')),
    initial_task TEXT NOT NULL,
    work_dir TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Messages table - All agent messages with relationships
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    agent_type TEXT NOT NULL CHECK (agent_type IN ('manager', 'worker')),
    message_type TEXT NOT NULL CHECK (message_type IN ('prompt', 'response', 'tool_call', 'error', 'system')),
    content TEXT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    parent_message_id TEXT,
    
    -- Metadata fields (stored as JSON in SQLite, can be separate columns in PostgreSQL)
    tools_used TEXT, -- JSON array of tools
    files_modified TEXT, -- JSON array of file paths
    commands_executed TEXT, -- JSON array of commands
    cost REAL,
    duration INTEGER, -- in milliseconds
    exit_code INTEGER,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Agent communications table - Inter-agent message tracking
CREATE TABLE IF NOT EXISTS agent_communications (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    from_agent TEXT NOT NULL CHECK (from_agent IN ('manager', 'worker')),
    to_agent TEXT NOT NULL CHECK (to_agent IN ('manager', 'worker')),
    message_type TEXT NOT NULL CHECK (message_type IN ('instruction', 'feedback', 'result', 'question')),
    content TEXT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    related_message_id TEXT,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (related_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- System events table - Important system events and state changes
CREATE TABLE IF NOT EXISTS system_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('session_start', 'session_end', 'agent_switch', 'error', 'pause', 'resume')),
    details TEXT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Performance metrics table - Agent performance tracking
CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    agent_type TEXT NOT NULL CHECK (agent_type IN ('manager', 'worker')),
    response_time INTEGER NOT NULL, -- in milliseconds
    tokens_used INTEGER,
    cost REAL,
    error_rate REAL NOT NULL DEFAULT 0,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Session summaries table - Aggregated session statistics
CREATE TABLE IF NOT EXISTS session_summaries (
    session_id TEXT PRIMARY KEY,
    total_messages INTEGER NOT NULL DEFAULT 0,
    manager_messages INTEGER NOT NULL DEFAULT 0,
    worker_messages INTEGER NOT NULL DEFAULT 0,
    total_duration INTEGER, -- in milliseconds
    total_cost REAL,
    files_modified TEXT, -- JSON array
    commands_executed TEXT, -- JSON array
    tools_used TEXT, -- JSON array
    success_rate REAL NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_agent_type ON messages(agent_type);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);

CREATE INDEX IF NOT EXISTS idx_agent_communications_session_id ON agent_communications(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_communications_timestamp ON agent_communications(timestamp);

CREATE INDEX IF NOT EXISTS idx_system_events_session_id ON system_events(session_id);
CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events(event_type);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_session_id ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_type ON performance_metrics(agent_type);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp 
    AFTER UPDATE ON sessions
    BEGIN
        UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_session_summaries_timestamp 
    AFTER UPDATE ON session_summaries
    BEGIN
        UPDATE session_summaries SET updated_at = CURRENT_TIMESTAMP WHERE session_id = NEW.session_id;
    END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS session_overview AS
SELECT 
    s.id,
    s.start_time,
    s.end_time,
    s.status,
    s.initial_task,
    s.work_dir,
    ss.total_messages,
    ss.manager_messages,
    ss.worker_messages,
    ss.total_duration,
    ss.total_cost,
    ss.success_rate,
    (SELECT COUNT(*) FROM system_events se WHERE se.session_id = s.id AND se.event_type = 'error') as error_count
FROM sessions s
LEFT JOIN session_summaries ss ON s.id = ss.session_id;

CREATE VIEW IF NOT EXISTS recent_activity AS
SELECT 
    'message' as activity_type,
    m.id,
    m.session_id,
    m.agent_type as agent,
    m.message_type as type,
    substr(m.content, 1, 100) as preview,
    m.timestamp
FROM messages m
UNION ALL
SELECT 
    'communication' as activity_type,
    ac.id,
    ac.session_id,
    ac.from_agent || '->' || ac.to_agent as agent,
    ac.message_type as type,
    substr(ac.content, 1, 100) as preview,
    ac.timestamp
FROM agent_communications ac
ORDER BY timestamp DESC
LIMIT 100;