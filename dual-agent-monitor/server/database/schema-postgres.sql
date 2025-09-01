-- PostgreSQL Schema for Dual-Agent Monitor Database
-- Production-ready schema with proper PostgreSQL types and features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table - Core session management
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused')),
    initial_task TEXT NOT NULL,
    work_dir TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Messages table - All agent messages with relationships
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent_type VARCHAR(20) NOT NULL CHECK (agent_type IN ('manager', 'worker')),
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('prompt', 'response', 'tool_call', 'error', 'system')),
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    -- Metadata fields (using JSONB for better performance)
    tools_used JSONB, -- JSON array of tools
    files_modified JSONB, -- JSON array of file paths
    commands_executed JSONB, -- JSON array of commands
    cost DECIMAL(10,4),
    duration INTEGER, -- in milliseconds
    exit_code INTEGER
);

-- Agent communications table - Inter-agent message tracking
CREATE TABLE IF NOT EXISTS agent_communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    from_agent VARCHAR(20) NOT NULL CHECK (from_agent IN ('manager', 'worker')),
    to_agent VARCHAR(20) NOT NULL CHECK (to_agent IN ('manager', 'worker')),
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('instruction', 'feedback', 'result', 'question')),
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    related_message_id UUID REFERENCES messages(id) ON DELETE SET NULL
);

-- System events table - Important system events and state changes
CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('session_start', 'session_end', 'agent_switch', 'error', 'pause', 'resume')),
    details TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics table - Agent performance tracking
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent_type VARCHAR(20) NOT NULL CHECK (agent_type IN ('manager', 'worker')),
    response_time INTEGER NOT NULL, -- in milliseconds
    tokens_used INTEGER,
    cost DECIMAL(10,4),
    error_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Session summaries table - Aggregated session statistics
CREATE TABLE IF NOT EXISTS session_summaries (
    session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    total_messages INTEGER NOT NULL DEFAULT 0,
    manager_messages INTEGER NOT NULL DEFAULT 0,
    worker_messages INTEGER NOT NULL DEFAULT 0,
    total_duration INTEGER, -- in milliseconds
    total_cost DECIMAL(10,4),
    files_modified JSONB, -- JSON array
    commands_executed JSONB, -- JSON array
    tools_used JSONB, -- JSON array
    success_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- AUTHENTICATION AND USER MANAGEMENT TABLES
-- ===============================================

-- Users table - Core user accounts
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table - JWT and session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) NOT NULL UNIQUE,
    permissions JSONB, -- JSON array of permissions
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- User profiles table - Extended user information and preferences
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(200) NOT NULL,
    avatar TEXT, -- URL or file path to avatar image
    preferences JSONB NOT NULL, -- JSON object with user preferences
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table - Track all user actions and system access
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50), -- 'session', 'user', 'system', etc.
    resource_id UUID,
    details JSONB, -- JSON object with action details
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table - Define available permissions
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User permissions table - Grant specific permissions to users
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ, -- NULL means no expiration
    UNIQUE(user_id, permission_id)
);

-- ===============================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ===============================================

-- Core message and session indexes
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_agent_type ON messages(agent_type);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_composite ON messages(session_id, timestamp DESC, agent_type);

-- Agent communications indexes
CREATE INDEX IF NOT EXISTS idx_agent_communications_session_id ON agent_communications(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_communications_timestamp ON agent_communications(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_communications_agents ON agent_communications(from_agent, to_agent);

-- System events indexes
CREATE INDEX IF NOT EXISTS idx_system_events_session_id ON system_events(session_id);
CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events(event_type);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_session_id ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_type ON performance_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_composite ON performance_metrics(session_id, agent_type, timestamp DESC);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_work_dir ON sessions(work_dir);

-- Authentication indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);

-- User session indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- Permission indexes
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires ON user_permissions(expires_at);

-- ===============================================
-- POSTGRESQL-SPECIFIC TRIGGERS AND FUNCTIONS
-- ===============================================

-- Function to update timestamp columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_summaries_updated_at BEFORE UPDATE ON session_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger function for user login tracking
CREATE OR REPLACE FUNCTION audit_user_login()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_login_at IS DISTINCT FROM OLD.last_login_at THEN
        INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
        VALUES (
            NEW.id,
            'user_login',
            'user',
            NEW.id,
            jsonb_build_object(
                'username', NEW.username,
                'previous_login', OLD.last_login_at,
                'current_login', NEW.last_login_at
            )
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user login auditing
CREATE TRIGGER audit_user_login_trigger AFTER UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_user_login();

-- ===============================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ===============================================

-- Session overview materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS session_overview AS
SELECT 
    s.id,
    s.start_time,
    s.end_time,
    s.status,
    s.initial_task,
    s.work_dir,
    COALESCE(ss.total_messages, 0) as total_messages,
    COALESCE(ss.manager_messages, 0) as manager_messages,
    COALESCE(ss.worker_messages, 0) as worker_messages,
    ss.total_duration,
    ss.total_cost,
    ss.success_rate,
    (SELECT COUNT(*) FROM system_events se 
     WHERE se.session_id = s.id AND se.event_type = 'error') as error_count,
    s.created_at,
    s.updated_at
FROM sessions s
LEFT JOIN session_summaries ss ON s.id = ss.session_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_overview_id ON session_overview(id);

-- Recent activity materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS recent_activity AS
SELECT 
    'message' as activity_type,
    m.id,
    m.session_id,
    m.agent_type as agent,
    m.message_type as type,
    LEFT(m.content, 100) as preview,
    m.timestamp
FROM messages m
WHERE m.timestamp > CURRENT_TIMESTAMP - INTERVAL '7 days'
UNION ALL
SELECT 
    'communication' as activity_type,
    ac.id,
    ac.session_id,
    ac.from_agent || '->' || ac.to_agent as agent,
    ac.message_type as type,
    LEFT(ac.content, 100) as preview,
    ac.timestamp
FROM agent_communications ac
WHERE ac.timestamp > CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY timestamp DESC
LIMIT 1000;

-- User overview view (regular view, not materialized since it changes frequently)
CREATE OR REPLACE VIEW user_overview AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    u.is_active,
    u.last_login_at,
    u.created_at,
    up.display_name,
    (SELECT COUNT(*) FROM user_sessions us 
     WHERE us.user_id = u.id AND us.is_active = true 
     AND us.expires_at > CURRENT_TIMESTAMP) as active_sessions,
    (SELECT COUNT(*) FROM audit_log al 
     WHERE al.user_id = u.id AND al.timestamp > CURRENT_DATE) as today_actions
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.is_active = true;

-- Session activity with users view
CREATE OR REPLACE VIEW session_activity_with_users AS
SELECT 
    s.id as session_id,
    s.start_time,
    s.end_time,
    s.status,
    s.initial_task,
    s.work_dir,
    u.username as created_by_user,
    u.role as user_role,
    COALESCE(ss.total_messages, 0) as total_messages,
    ss.success_rate
FROM sessions s
LEFT JOIN audit_log al ON al.resource_id = s.id::text AND al.action = 'session_create'
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN session_summaries ss ON s.id = ss.session_id
ORDER BY s.start_time DESC;

-- ===============================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- ===============================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY session_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY recent_activity;
END;
$$ language 'plpgsql';

-- Initial sample data permissions
INSERT INTO permissions (name, description, category) VALUES
('session:create', 'Create new monitoring sessions', 'session'),
('session:read', 'View monitoring sessions', 'session'),
('session:update', 'Update session details', 'session'),
('session:delete', 'Delete monitoring sessions', 'session'),
('user:read', 'View user information', 'user'),
('user:update', 'Update user information', 'user'),
('admin:all', 'Full administrative access', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Create default admin user (password: 'admin123' - CHANGE IN PRODUCTION)
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@dual-agent-monitor.local', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Grant admin permissions to default admin user
INSERT INTO user_permissions (user_id, permission_id, granted_by)
SELECT 
    u.id,
    p.id,
    u.id
FROM users u, permissions p
WHERE u.username = 'admin' AND p.name = 'admin:all'
ON CONFLICT (user_id, permission_id) DO NOTHING;

-- Create default admin profile
INSERT INTO user_profiles (user_id, display_name, preferences)
SELECT 
    u.id,
    'Administrator',
    '{"theme": "dark", "notifications": true, "defaultView": "dashboard"}'::jsonb
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (user_id) DO NOTHING;

COMMIT;