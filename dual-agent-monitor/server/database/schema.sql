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

-- ===============================================
-- AUTHENTICATION AND USER MANAGEMENT TABLES
-- ===============================================

-- Users table - Core user accounts
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table - JWT and session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token TEXT NOT NULL UNIQUE,
    permissions TEXT, -- JSON array of permissions
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User profiles table - Extended user information and preferences
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar TEXT, -- URL or file path to avatar image
    preferences TEXT NOT NULL, -- JSON object with user preferences
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit log table - Track all user actions and system access
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT, -- 'session', 'user', 'system', etc.
    resource_id TEXT,
    details TEXT, -- JSON object with action details
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Permissions table - Define available permissions
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User permissions table - Grant specific permissions to users
CREATE TABLE IF NOT EXISTS user_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by TEXT NOT NULL, -- user ID who granted this permission
    expires_at DATETIME, -- NULL means no expiration
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, permission_id)
);

-- ===============================================
-- AUTHENTICATION INDEXES FOR PERFORMANCE
-- ===============================================

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- Session table indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- Permission indexes
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

-- User permission indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires ON user_permissions(expires_at);

-- ===============================================
-- AUTHENTICATION TRIGGERS
-- ===============================================

-- Update user timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update user profile timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_user_profiles_timestamp 
    AFTER UPDATE ON user_profiles
    BEGIN
        UPDATE user_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update user session timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_user_sessions_timestamp 
    AFTER UPDATE ON user_sessions
    BEGIN
        UPDATE user_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Audit log trigger for user login/logout
CREATE TRIGGER IF NOT EXISTS audit_user_login 
    AFTER UPDATE ON users
    WHEN NEW.last_login_at != OLD.last_login_at
    BEGIN
        INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, details, timestamp)
        VALUES (
            hex(randomblob(16)),
            NEW.id,
            'user_login',
            'user',
            NEW.id,
            json_object('username', NEW.username, 'previous_login', OLD.last_login_at),
            CURRENT_TIMESTAMP
        );
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

-- User management views
CREATE VIEW IF NOT EXISTS user_overview AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    u.is_active,
    u.last_login_at,
    u.created_at,
    up.display_name,
    (SELECT COUNT(*) FROM user_sessions us WHERE us.user_id = u.id AND us.is_active = 1 AND us.expires_at > CURRENT_TIMESTAMP) as active_sessions,
    (SELECT COUNT(*) FROM audit_log al WHERE al.user_id = u.id AND date(al.timestamp) = date('now')) as today_actions
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.is_active = 1;

-- ===============================================
-- SESSION RECORDING TABLES
-- ===============================================

-- Session recordings table - Store complete session recordings
CREATE TABLE IF NOT EXISTS session_recordings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    recording_name TEXT,
    description TEXT,
    recorded_by TEXT, -- user ID who initiated the recording
    recording_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recording_completed_at DATETIME,
    status TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'completed', 'failed', 'processing')),
    
    -- Recording metadata
    total_interactions INTEGER NOT NULL DEFAULT 0,
    total_size_bytes INTEGER NOT NULL DEFAULT 0,
    compression_type TEXT DEFAULT 'gzip',
    recording_quality TEXT DEFAULT 'high' CHECK (recording_quality IN ('low', 'medium', 'high', 'lossless')),
    
    -- Playback metadata
    playback_duration_ms INTEGER, -- calculated duration for playback
    key_moments TEXT, -- JSON array of timestamps for important moments
    annotations TEXT, -- JSON array of user annotations
    bookmarks TEXT, -- JSON array of bookmarked moments
    
    -- Export and sharing
    export_formats TEXT, -- JSON array of available export formats
    shared_publicly INTEGER NOT NULL DEFAULT 0,
    download_count INTEGER NOT NULL DEFAULT 0,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Recording interactions table - Store all captured interactions with precise timing
CREATE TABLE IF NOT EXISTS recording_interactions (
    id TEXT PRIMARY KEY,
    recording_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    
    -- Interaction metadata
    sequence_number INTEGER NOT NULL, -- Order of interactions for playback
    interaction_type TEXT NOT NULL CHECK (interaction_type IN (
        'message', 'agent_communication', 'system_event', 'tool_call', 
        'file_operation', 'command_execution', 'user_input', 'agent_switch',
        'performance_metric', 'error', 'state_change'
    )),
    
    -- Timing information
    timestamp DATETIME NOT NULL,
    relative_time_ms INTEGER NOT NULL, -- milliseconds from recording start
    duration_ms INTEGER DEFAULT 0, -- how long this interaction lasted
    
    -- Agent context
    agent_type TEXT CHECK (agent_type IN ('manager', 'worker', 'system', 'user')),
    agent_context TEXT, -- JSON object with agent state at this moment
    
    -- Interaction content
    content TEXT NOT NULL, -- The actual content of the interaction
    content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'json', 'binary', 'image', 'file')),
    content_hash TEXT, -- SHA-256 hash for integrity verification
    
    -- Related data
    related_message_id TEXT,
    related_event_id TEXT,
    parent_interaction_id TEXT,
    
    -- Metadata and context
    metadata TEXT, -- JSON object with additional context
    screenshot_path TEXT, -- Path to screenshot if captured
    files_touched TEXT, -- JSON array of files modified during this interaction
    commands_executed TEXT, -- JSON array of commands executed
    tools_used TEXT, -- JSON array of tools used
    
    -- Compression and storage
    is_compressed INTEGER NOT NULL DEFAULT 0,
    compressed_size INTEGER,
    original_size INTEGER,
    
    FOREIGN KEY (recording_id) REFERENCES session_recordings(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (related_message_id) REFERENCES messages(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_interaction_id) REFERENCES recording_interactions(id) ON DELETE SET NULL
);

-- Playback sessions table - Track playback sessions and user interactions
CREATE TABLE IF NOT EXISTS playback_sessions (
    id TEXT PRIMARY KEY,
    recording_id TEXT NOT NULL,
    user_id TEXT, -- who is viewing the playback
    playback_name TEXT,
    
    -- Playback state
    current_position_ms INTEGER NOT NULL DEFAULT 0,
    playback_speed REAL NOT NULL DEFAULT 1.0,
    is_playing INTEGER NOT NULL DEFAULT 0,
    is_paused INTEGER NOT NULL DEFAULT 0,
    
    -- Playback metadata
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    total_watch_time_ms INTEGER NOT NULL DEFAULT 0,
    
    -- User interactions during playback
    annotations_added INTEGER NOT NULL DEFAULT 0,
    bookmarks_added INTEGER NOT NULL DEFAULT 0,
    notes TEXT, -- User's notes about this playback session
    
    -- Settings and preferences
    playback_settings TEXT, -- JSON object with user preferences
    filters_applied TEXT, -- JSON array of filters applied during playback
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (recording_id) REFERENCES session_recordings(id) ON DELETE CASCADE
);

-- User annotations table - User-created annotations on recordings
CREATE TABLE IF NOT EXISTS recording_annotations (
    id TEXT PRIMARY KEY,
    recording_id TEXT NOT NULL,
    playback_session_id TEXT,
    user_id TEXT, -- who created the annotation
    
    -- Annotation positioning
    timestamp_ms INTEGER NOT NULL, -- position in recording where annotation applies
    duration_ms INTEGER DEFAULT 0, -- how long the annotation spans
    
    -- Annotation content
    annotation_type TEXT NOT NULL CHECK (annotation_type IN ('note', 'highlight', 'bookmark', 'flag', 'question')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    color TEXT DEFAULT '#ffff00', -- color for visual annotations
    
    -- Metadata
    is_public INTEGER NOT NULL DEFAULT 0,
    tags TEXT, -- JSON array of tags
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (recording_id) REFERENCES session_recordings(id) ON DELETE CASCADE,
    FOREIGN KEY (playback_session_id) REFERENCES playback_sessions(id) ON DELETE SET NULL
);

-- Recording bookmarks table - Quick navigation points
CREATE TABLE IF NOT EXISTS recording_bookmarks (
    id TEXT PRIMARY KEY,
    recording_id TEXT NOT NULL,
    user_id TEXT, -- who created the bookmark
    
    -- Bookmark positioning and metadata
    timestamp_ms INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    bookmark_type TEXT DEFAULT 'user' CHECK (bookmark_type IN ('user', 'system', 'auto', 'key_moment')),
    
    -- Visual and navigation
    icon TEXT DEFAULT 'bookmark',
    color TEXT DEFAULT '#0066cc',
    chapter_marker INTEGER NOT NULL DEFAULT 0, -- is this a chapter/section marker
    
    -- Usage tracking
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at DATETIME,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (recording_id) REFERENCES session_recordings(id) ON DELETE CASCADE
);

-- Recording exports table - Track exports and downloads
CREATE TABLE IF NOT EXISTS recording_exports (
    id TEXT PRIMARY KEY,
    recording_id TEXT NOT NULL,
    requested_by TEXT, -- user ID who requested the export
    
    -- Export configuration
    export_format TEXT NOT NULL CHECK (export_format IN ('json', 'csv', 'video', 'html', 'pdf', 'zip')),
    export_options TEXT, -- JSON object with format-specific options
    include_annotations INTEGER NOT NULL DEFAULT 1,
    include_bookmarks INTEGER NOT NULL DEFAULT 1,
    include_metadata INTEGER NOT NULL DEFAULT 1,
    
    -- Time range filtering
    start_time_ms INTEGER DEFAULT 0,
    end_time_ms INTEGER, -- NULL means full recording
    
    -- Export status and results
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_path TEXT, -- path to generated export file
    file_size_bytes INTEGER,
    download_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    expires_at DATETIME, -- when the export file expires and is deleted
    
    error_message TEXT, -- if export failed
    
    FOREIGN KEY (recording_id) REFERENCES session_recordings(id) ON DELETE CASCADE
);

-- Performance indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id ON session_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_status ON session_recordings(status);
CREATE INDEX IF NOT EXISTS idx_session_recordings_created_at ON session_recordings(created_at);

CREATE INDEX IF NOT EXISTS idx_recording_interactions_recording_id ON recording_interactions(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_interactions_session_id ON recording_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_recording_interactions_sequence ON recording_interactions(recording_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_recording_interactions_timestamp ON recording_interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_recording_interactions_relative_time ON recording_interactions(recording_id, relative_time_ms);
CREATE INDEX IF NOT EXISTS idx_recording_interactions_type ON recording_interactions(interaction_type);

CREATE INDEX IF NOT EXISTS idx_playback_sessions_recording_id ON playback_sessions(recording_id);
CREATE INDEX IF NOT EXISTS idx_playback_sessions_user_id ON playback_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_playback_sessions_accessed ON playback_sessions(last_accessed_at);

CREATE INDEX IF NOT EXISTS idx_recording_annotations_recording_id ON recording_annotations(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_annotations_timestamp ON recording_annotations(recording_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_recording_annotations_type ON recording_annotations(annotation_type);

CREATE INDEX IF NOT EXISTS idx_recording_bookmarks_recording_id ON recording_bookmarks(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_bookmarks_timestamp ON recording_bookmarks(recording_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_recording_bookmarks_type ON recording_bookmarks(bookmark_type);

CREATE INDEX IF NOT EXISTS idx_recording_exports_recording_id ON recording_exports(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_exports_status ON recording_exports(status);
CREATE INDEX IF NOT EXISTS idx_recording_exports_expires ON recording_exports(expires_at);

-- Triggers for maintaining data consistency and timestamps
CREATE TRIGGER IF NOT EXISTS update_session_recordings_timestamp 
    AFTER UPDATE ON session_recordings
    BEGIN
        UPDATE session_recordings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_playback_sessions_timestamp 
    AFTER UPDATE ON playback_sessions
    BEGIN
        UPDATE playback_sessions 
        SET updated_at = CURRENT_TIMESTAMP, last_accessed_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_recording_annotations_timestamp 
    AFTER UPDATE ON recording_annotations
    BEGIN
        UPDATE recording_annotations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_recording_bookmarks_timestamp 
    AFTER UPDATE ON recording_bookmarks
    BEGIN
        UPDATE recording_bookmarks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update recording statistics when interactions are added
CREATE TRIGGER IF NOT EXISTS update_recording_stats_on_interaction
    AFTER INSERT ON recording_interactions
    BEGIN
        UPDATE session_recordings 
        SET 
            total_interactions = (SELECT COUNT(*) FROM recording_interactions WHERE recording_id = NEW.recording_id),
            total_size_bytes = total_size_bytes + COALESCE(NEW.original_size, length(NEW.content)),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.recording_id;
    END;

-- Views for common recording queries
CREATE VIEW IF NOT EXISTS recording_overview AS
SELECT 
    sr.id,
    sr.session_id,
    sr.recording_name,
    sr.description,
    sr.status,
    sr.recording_started_at,
    sr.recording_completed_at,
    sr.total_interactions,
    sr.total_size_bytes,
    sr.playback_duration_ms,
    sr.shared_publicly,
    sr.download_count,
    s.initial_task,
    s.work_dir,
    s.start_time as session_start_time,
    s.end_time as session_end_time,
    (SELECT COUNT(*) FROM playback_sessions ps WHERE ps.recording_id = sr.id) as total_views,
    (SELECT COUNT(*) FROM recording_annotations ra WHERE ra.recording_id = sr.id) as total_annotations,
    (SELECT COUNT(*) FROM recording_bookmarks rb WHERE rb.recording_id = sr.id) as total_bookmarks
FROM session_recordings sr
JOIN sessions s ON sr.session_id = s.id
ORDER BY sr.created_at DESC;

CREATE VIEW IF NOT EXISTS active_recordings AS
SELECT 
    sr.*,
    s.initial_task,
    s.work_dir,
    s.status as session_status,
    (julianday('now') - julianday(sr.recording_started_at)) * 24 * 60 * 60 * 1000 as current_duration_ms
FROM session_recordings sr
JOIN sessions s ON sr.session_id = s.id
WHERE sr.status = 'recording'
ORDER BY sr.recording_started_at ASC;

CREATE VIEW IF NOT EXISTS popular_recordings AS
SELECT 
    sr.*,
    s.initial_task,
    s.work_dir,
    (SELECT COUNT(*) FROM playback_sessions ps WHERE ps.recording_id = sr.id) as view_count,
    (SELECT AVG(total_watch_time_ms) FROM playback_sessions ps WHERE ps.recording_id = sr.id) as avg_watch_time
FROM session_recordings sr
JOIN sessions s ON sr.session_id = s.id
WHERE sr.status = 'completed' AND sr.shared_publicly = 1
ORDER BY view_count DESC, sr.download_count DESC
LIMIT 50;

CREATE VIEW IF NOT EXISTS session_activity_with_users AS
SELECT 
    s.id as session_id,
    s.start_time,
    s.end_time,
    s.status,
    s.initial_task,
    s.work_dir,
    u.username as created_by_user,
    u.role as user_role,
    ss.total_messages,
    ss.success_rate
FROM sessions s
LEFT JOIN audit_log al ON al.resource_id = s.id AND al.action = 'session_create'
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN session_summaries ss ON s.id = ss.session_id
ORDER BY s.start_time DESC;