-- Session Recording and Playback Schema Extension
-- This adds comprehensive session recording capabilities to the existing schema

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

-- Auto-increment interaction sequence numbers
CREATE TRIGGER IF NOT EXISTS auto_sequence_recording_interactions
    BEFORE INSERT ON recording_interactions
    WHEN NEW.sequence_number IS NULL OR NEW.sequence_number = 0
    BEGIN
        UPDATE recording_interactions SET sequence_number = (
            SELECT COALESCE(MAX(sequence_number), 0) + 1 
            FROM recording_interactions 
            WHERE recording_id = NEW.recording_id
        ) WHERE id = NEW.id;
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