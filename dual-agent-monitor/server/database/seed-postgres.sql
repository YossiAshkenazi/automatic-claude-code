-- PostgreSQL Seed Data for Dual-Agent Monitor Database
-- This script inserts initial data needed for the application to function

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

-- Create sample session data for demonstration
DO $$
DECLARE
    sample_session_id UUID;
    sample_user_id UUID;
    msg_id_1 UUID;
    msg_id_2 UUID;
    msg_id_3 UUID;
BEGIN
    -- Get admin user ID
    SELECT id INTO sample_user_id FROM users WHERE username = 'admin';
    
    -- Create sample session
    INSERT INTO sessions (id, start_time, end_time, status, initial_task, work_dir)
    VALUES (
        uuid_generate_v4(),
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '1 hour',
        'completed',
        'Create a React component with TypeScript for displaying user profiles',
        '/tmp/sample-react-project'
    )
    RETURNING id INTO sample_session_id;
    
    -- Add sample messages
    INSERT INTO messages (id, session_id, agent_type, message_type, content, timestamp, tools_used, files_modified, duration, cost)
    VALUES (
        uuid_generate_v4(),
        sample_session_id,
        'manager',
        'prompt',
        'I need to create a React component that displays user information with proper TypeScript types. The component should be reusable and follow modern React practices.',
        NOW() - INTERVAL '2 hours',
        '["Read", "Write"]'::jsonb,
        '["src/components/UserCard.tsx"]'::jsonb,
        2500,
        0.015
    )
    RETURNING id INTO msg_id_1;
    
    INSERT INTO messages (id, session_id, agent_type, message_type, content, timestamp, tools_used, files_modified, duration, cost, parent_message_id)
    VALUES (
        uuid_generate_v4(),
        sample_session_id,
        'worker',
        'response',
        'I''ll create a TypeScript React component for displaying user information. Let me start by creating the component file and defining the necessary types.',
        NOW() - INTERVAL '1 hour 55 minutes',
        '["Write", "Edit"]'::jsonb,
        '["src/components/UserCard.tsx", "src/types/User.ts"]'::jsonb,
        1800,
        0.025,
        msg_id_1
    )
    RETURNING id INTO msg_id_2;
    
    INSERT INTO messages (id, session_id, agent_type, message_type, content, timestamp, tools_used, files_modified, duration, cost)
    VALUES (
        uuid_generate_v4(),
        sample_session_id,
        'manager',
        'prompt',
        'Excellent work! Now let''s add some basic styling and make the component responsive for mobile devices.',
        NOW() - INTERVAL '1 hour 30 minutes',
        '["Edit"]'::jsonb,
        '["src/components/UserCard.tsx", "src/components/UserCard.css"]'::jsonb,
        1200,
        0.010
    )
    RETURNING id INTO msg_id_3;
    
    -- Add agent communication
    INSERT INTO agent_communications (session_id, from_agent, to_agent, message_type, content, timestamp, related_message_id)
    VALUES (
        sample_session_id,
        'manager',
        'worker',
        'instruction',
        'Please implement the UserCard component with TypeScript interfaces for the user data structure.',
        NOW() - INTERVAL '1 hour 58 minutes',
        msg_id_1
    );
    
    -- Add system events
    INSERT INTO system_events (session_id, event_type, details, timestamp)
    VALUES 
        (sample_session_id, 'session_start', 'Dual-agent session started with React component creation task', NOW() - INTERVAL '2 hours'),
        (sample_session_id, 'agent_switch', 'Manager handed off task to Worker agent', NOW() - INTERVAL '1 hour 58 minutes'),
        (sample_session_id, 'session_end', 'Session completed successfully - UserCard component created with TypeScript', NOW() - INTERVAL '1 hour');
    
    -- Add performance metrics
    INSERT INTO performance_metrics (session_id, agent_type, response_time, tokens_used, cost, error_rate, timestamp)
    VALUES 
        (sample_session_id, 'manager', 1250, 450, 0.015, 0.0, NOW() - INTERVAL '1 hour 45 minutes'),
        (sample_session_id, 'worker', 2100, 680, 0.032, 0.0, NOW() - INTERVAL '1 hour 30 minutes'),
        (sample_session_id, 'manager', 800, 320, 0.008, 0.0, NOW() - INTERVAL '1 hour 20 minutes');
    
    -- Add session summary
    INSERT INTO session_summaries (
        session_id, 
        total_messages, 
        manager_messages, 
        worker_messages, 
        total_duration, 
        total_cost,
        files_modified,
        commands_executed,
        tools_used,
        success_rate
    )
    VALUES (
        sample_session_id,
        3,
        2,
        1,
        5500,
        0.050,
        '["src/components/UserCard.tsx", "src/types/User.ts", "src/components/UserCard.css"]'::jsonb,
        '["npm install", "npm run build", "npm test"]'::jsonb,
        '["Read", "Write", "Edit"]'::jsonb,
        1.0
    );
    
    -- Add audit log entry
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, timestamp)
    VALUES (
        sample_user_id,
        'session_create',
        'session',
        sample_session_id,
        '{"task": "React component creation", "duration": "1 hour", "files_created": 3}'::jsonb,
        NOW() - INTERVAL '2 hours'
    );
    
END $$;