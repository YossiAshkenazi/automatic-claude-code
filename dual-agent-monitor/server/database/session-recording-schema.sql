-- Session Recording System PostgreSQL Schema
-- Integrates with existing dual-agent monitoring database

-- Session recordings table
CREATE TABLE IF NOT EXISTS session_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  project_name VARCHAR(255),
  
  -- Recording metadata
  recording_name VARCHAR(500),
  description TEXT,
  recorded_by VARCHAR(255),
  recording_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recording_completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'recording', 'completed', 'failed', 'processing')),
  
  -- Recording configuration and metrics
  total_interactions INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  compression_type VARCHAR(50),
  recording_quality VARCHAR(20) DEFAULT 'high' CHECK (recording_quality IN ('low', 'medium', 'high', 'lossless')),
  
  -- Playback metadata
  playback_duration_ms BIGINT,
  key_moments JSONB,
  
  -- Export and sharing
  export_formats TEXT[],
  shared_publicly BOOLEAN DEFAULT FALSE,
  download_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  CONSTRAINT unique_session_recording UNIQUE (session_id, recording_started_at)
);

-- Session events table for detailed recording
CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES session_recordings(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  agent_type VARCHAR(50),
  event_data JSONB,
  sequence_number INTEGER,
  
  -- Timing information
  relative_time_ms BIGINT,
  duration_ms BIGINT,
  
  -- Content and metadata
  content TEXT,
  content_type VARCHAR(50) DEFAULT 'text',
  content_hash VARCHAR(64),
  is_compressed BOOLEAN DEFAULT FALSE,
  compressed_size BIGINT,
  original_size BIGINT,
  
  -- Related data
  related_message_id VARCHAR(255),
  related_event_id VARCHAR(255),
  parent_interaction_id UUID,
  
  -- Additional context
  metadata JSONB,
  files_touched TEXT[],
  commands_executed TEXT[],
  tools_used TEXT[],
  screenshot_path TEXT
);

-- Recording interactions table (detailed event log)
CREATE TABLE IF NOT EXISTS recording_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES session_recordings(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Interaction metadata
  sequence_number INTEGER NOT NULL,
  interaction_type VARCHAR(100) NOT NULL,
  
  -- Timing information
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  relative_time_ms BIGINT NOT NULL,
  duration_ms BIGINT,
  
  -- Agent context
  agent_type VARCHAR(50),
  agent_context JSONB,
  
  -- Content
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'text',
  content_hash VARCHAR(64),
  
  -- Relations
  related_message_id VARCHAR(255),
  related_event_id VARCHAR(255),
  parent_interaction_id UUID,
  
  -- Metadata
  metadata JSONB,
  screenshot_path TEXT,
  files_touched TEXT[],
  commands_executed TEXT[],
  tools_used TEXT[],
  
  -- Compression
  is_compressed BOOLEAN DEFAULT FALSE,
  compressed_size BIGINT,
  original_size BIGINT
);

-- Playback sessions table
CREATE TABLE IF NOT EXISTS playback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES session_recordings(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  playback_name VARCHAR(500),
  
  -- Playback state
  current_position_ms BIGINT DEFAULT 0,
  playback_speed DECIMAL(3,2) DEFAULT 1.0,
  is_playing BOOLEAN DEFAULT FALSE,
  is_paused BOOLEAN DEFAULT FALSE,
  
  -- Session metadata
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  total_watch_time_ms BIGINT DEFAULT 0,
  
  -- User interactions
  annotations_added INTEGER DEFAULT 0,
  bookmarks_added INTEGER DEFAULT 0,
  notes TEXT,
  
  -- Settings
  playback_settings JSONB,
  filters_applied TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recording annotations table
CREATE TABLE IF NOT EXISTS recording_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES session_recordings(id) ON DELETE CASCADE,
  playback_session_id UUID REFERENCES playback_sessions(id) ON DELETE SET NULL,
  user_id VARCHAR(255),
  
  -- Positioning
  timestamp_ms BIGINT NOT NULL,
  duration_ms BIGINT,
  
  -- Content
  annotation_type VARCHAR(50) DEFAULT 'note' CHECK (annotation_type IN ('note', 'highlight', 'bookmark', 'flag', 'question')),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  color VARCHAR(20) DEFAULT '#ffeb3b',
  
  -- Metadata
  is_public BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recording bookmarks table
CREATE TABLE IF NOT EXISTS recording_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES session_recordings(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  
  -- Positioning and metadata
  timestamp_ms BIGINT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  bookmark_type VARCHAR(50) DEFAULT 'user' CHECK (bookmark_type IN ('user', 'system', 'auto', 'key_moment')),
  
  -- Visual
  icon VARCHAR(50) DEFAULT 'bookmark',
  color VARCHAR(20) DEFAULT '#0066cc',
  chapter_marker BOOLEAN DEFAULT FALSE,
  
  -- Usage tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recording exports table
CREATE TABLE IF NOT EXISTS recording_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES session_recordings(id) ON DELETE CASCADE,
  requested_by VARCHAR(255),
  
  -- Export configuration
  export_format VARCHAR(50) NOT NULL CHECK (export_format IN ('json', 'csv', 'video', 'html', 'pdf', 'zip')),
  export_options JSONB,
  include_annotations BOOLEAN DEFAULT TRUE,
  include_bookmarks BOOLEAN DEFAULT TRUE,
  include_metadata BOOLEAN DEFAULT TRUE,
  
  -- Time range filtering
  start_time_ms BIGINT,
  end_time_ms BIGINT,
  
  -- Export status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_path TEXT,
  file_size_bytes BIGINT,
  download_count INTEGER DEFAULT 0,
  
  -- Timestamps
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  -- Error handling
  error_message TEXT
);

-- Key moments table for AI-detected important points
CREATE TABLE IF NOT EXISTS recording_key_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES session_recordings(id) ON DELETE CASCADE,
  
  -- Moment positioning
  timestamp_ms BIGINT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  moment_type VARCHAR(50) NOT NULL,
  
  -- AI analysis
  importance VARCHAR(20) DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high', 'critical')),
  confidence_score DECIMAL(3,2) DEFAULT 0.5,
  automatically_detected BOOLEAN DEFAULT TRUE,
  
  -- Relations
  related_interaction_ids UUID[],
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_session_recordings_session ON session_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_status ON session_recordings(status);
CREATE INDEX IF NOT EXISTS idx_session_recordings_user ON session_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_project ON session_recordings(project_name);
CREATE INDEX IF NOT EXISTS idx_session_recordings_created ON session_recordings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_events_session_timeline ON session_events(session_id, relative_time_ms);
CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_session_events_agent ON session_events(agent_type);

CREATE INDEX IF NOT EXISTS idx_recording_interactions_recording ON recording_interactions(recording_id, relative_time_ms);
CREATE INDEX IF NOT EXISTS idx_recording_interactions_type ON recording_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_recording_interactions_sequence ON recording_interactions(recording_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_recording_annotations_recording_time ON recording_annotations(recording_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_recording_annotations_user ON recording_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_annotations_type ON recording_annotations(annotation_type);

CREATE INDEX IF NOT EXISTS idx_recording_bookmarks_recording_time ON recording_bookmarks(recording_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_recording_bookmarks_user ON recording_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_bookmarks_type ON recording_bookmarks(bookmark_type);

CREATE INDEX IF NOT EXISTS idx_recording_exports_recording ON recording_exports(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_exports_status ON recording_exports(status);
CREATE INDEX IF NOT EXISTS idx_recording_exports_requested ON recording_exports(requested_by);

CREATE INDEX IF NOT EXISTS idx_key_moments_recording_time ON recording_key_moments(recording_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_key_moments_type ON recording_key_moments(moment_type);
CREATE INDEX IF NOT EXISTS idx_key_moments_importance ON recording_key_moments(importance);

-- Triggers to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_recordings_updated_at BEFORE UPDATE ON session_recordings 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_playback_sessions_updated_at BEFORE UPDATE ON playback_sessions 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_recording_annotations_updated_at BEFORE UPDATE ON recording_annotations 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_recording_bookmarks_updated_at BEFORE UPDATE ON recording_bookmarks 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Views for easier querying
CREATE OR REPLACE VIEW session_recording_stats AS
SELECT 
  sr.id,
  sr.session_id,
  sr.recording_name,
  sr.status,
  sr.recording_started_at,
  sr.recording_completed_at,
  sr.playback_duration_ms,
  COUNT(DISTINCT ri.id) as total_interactions,
  COUNT(DISTINCT ra.id) as total_annotations,
  COUNT(DISTINCT rb.id) as total_bookmarks,
  COUNT(DISTINCT ps.id) as playback_sessions,
  MAX(ps.last_accessed_at) as last_viewed_at,
  sr.download_count
FROM session_recordings sr
LEFT JOIN recording_interactions ri ON sr.id = ri.recording_id
LEFT JOIN recording_annotations ra ON sr.id = ra.recording_id
LEFT JOIN recording_bookmarks rb ON sr.id = rb.recording_id
LEFT JOIN playback_sessions ps ON sr.id = ps.recording_id
GROUP BY sr.id, sr.session_id, sr.recording_name, sr.status, 
         sr.recording_started_at, sr.recording_completed_at, 
         sr.playback_duration_ms, sr.download_count;

-- View for recording timeline data
CREATE OR REPLACE VIEW recording_timeline_view AS
SELECT 
  ri.recording_id,
  ri.relative_time_ms,
  ri.interaction_type,
  ri.agent_type,
  ri.content,
  ri.timestamp,
  ri.duration_ms,
  ri.metadata,
  'interaction' as item_type
FROM recording_interactions ri
UNION ALL
SELECT 
  ra.recording_id,
  ra.timestamp_ms as relative_time_ms,
  ra.annotation_type as interaction_type,
  'user' as agent_type,
  ra.content,
  ra.created_at as timestamp,
  ra.duration_ms,
  jsonb_build_object('title', ra.title, 'color', ra.color, 'priority', ra.priority) as metadata,
  'annotation' as item_type
FROM recording_annotations ra
UNION ALL
SELECT 
  rb.recording_id,
  rb.timestamp_ms as relative_time_ms,
  'bookmark' as interaction_type,
  'user' as agent_type,
  COALESCE(rb.description, rb.title) as content,
  rb.created_at as timestamp,
  NULL as duration_ms,
  jsonb_build_object('title', rb.title, 'icon', rb.icon, 'color', rb.color) as metadata,
  'bookmark' as item_type
FROM recording_bookmarks rb
ORDER BY recording_id, relative_time_ms;

-- Sample data insertion function for testing
CREATE OR REPLACE FUNCTION create_sample_recording(
  p_session_id VARCHAR(255),
  p_recording_name VARCHAR(500) DEFAULT 'Sample Recording'
) RETURNS UUID AS $$
DECLARE
  recording_id UUID;
BEGIN
  INSERT INTO session_recordings (
    session_id, recording_name, status, total_interactions, 
    playback_duration_ms, recording_quality
  ) VALUES (
    p_session_id, p_recording_name, 'completed', 15,
    300000, 'high'
  ) RETURNING id INTO recording_id;
  
  -- Add sample interactions
  INSERT INTO recording_interactions (
    recording_id, session_id, sequence_number, interaction_type,
    relative_time_ms, agent_type, content
  ) VALUES 
  (recording_id, p_session_id, 1, 'message', 1000, 'manager', 'Starting task analysis'),
  (recording_id, p_session_id, 2, 'agent_communication', 5000, 'manager', 'Delegating to worker agent'),
  (recording_id, p_session_id, 3, 'tool_call', 10000, 'worker', 'Executing file operation'),
  (recording_id, p_session_id, 4, 'message', 15000, 'worker', 'Task completed successfully');
  
  -- Add sample annotation
  INSERT INTO recording_annotations (
    recording_id, timestamp_ms, title, content, annotation_type
  ) VALUES (
    recording_id, 10000, 'Important Decision', 'Worker agent chose optimal approach', 'note'
  );
  
  -- Add sample bookmark
  INSERT INTO recording_bookmarks (
    recording_id, timestamp_ms, title, description
  ) VALUES (
    recording_id, 15000, 'Task Completion', 'Successful completion of the assigned task'
  );
  
  RETURN recording_id;
END;
$$ LANGUAGE plpgsql;