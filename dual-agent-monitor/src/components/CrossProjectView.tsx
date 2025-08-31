import React from 'react';
import { Globe, Calendar, Clock, User, Terminal, Zap } from 'lucide-react';
import { formatDate, formatDuration } from '../utils/formatters';

interface CrossProjectEvent {
  id: string;
  source_app: string;
  hook_event_type: string;
  session_id?: string;
  timestamp: string;
  payload?: any;
  engineer_name?: string;
}

interface CrossProjectViewProps {
  events: CrossProjectEvent[];
  activeProjects: string[];
  selectedProject: string;
  onProjectChange: (project: string) => void;
  onRefresh: () => void;
}

export function CrossProjectView({ 
  events, 
  activeProjects, 
  selectedProject, 
  onProjectChange,
  onRefresh 
}: CrossProjectViewProps) {
  const filteredEvents = selectedProject === 'all' 
    ? events 
    : events.filter(event => event.source_app === selectedProject);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'UserPromptSubmit':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'PreToolUse':
        return <Terminal className="w-4 h-4 text-yellow-500" />;
      case 'PostToolUse':
        return <Zap className="w-4 h-4 text-green-500" />;
      case 'Stop':
        return <Clock className="w-4 h-4 text-red-500" />;
      default:
        return <Globe className="w-4 h-4 text-gray-500" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'UserPromptSubmit':
        return 'border-l-blue-500 bg-blue-50';
      case 'PreToolUse':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'PostToolUse':
        return 'border-l-green-500 bg-green-50';
      case 'Stop':
        return 'border-l-red-500 bg-red-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Cross-Project Monitor</h2>
          </div>
          <button
            onClick={onRefresh}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Project Filter */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Project:</label>
          <select
            value={selectedProject}
            onChange={(e) => onProjectChange(e.target.value)}
            className="px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Projects ({events.length} events)</option>
            {activeProjects.map(project => (
              <option key={project} value={project}>
                {project} ({events.filter(e => e.source_app === project).length} events)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Globe className="w-12 h-12 mb-2" />
            <p className="text-lg font-medium">No events found</p>
            <p className="text-sm">Check if Claude Code is running in other projects</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredEvents.map((event, index) => (
              <div
                key={`${event.id || event.timestamp}-${index}`}
                className={`border-l-4 p-4 rounded-r-lg shadow-sm ${getEventColor(event.hook_event_type)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getEventIcon(event.hook_event_type)}
                    <span className="font-medium text-sm">{event.hook_event_type}</span>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                      {event.source_app}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {formatDate(new Date(event.timestamp))}
                  </div>
                </div>

                {/* Event Details */}
                {event.engineer_name && (
                  <div className="text-xs text-gray-600 mb-1">
                    Engineer: {event.engineer_name}
                  </div>
                )}
                
                {event.session_id && (
                  <div className="text-xs text-gray-600 mb-2">
                    Session: {event.session_id.substring(0, 8)}...
                  </div>
                )}

                {/* Payload Preview */}
                {event.payload && (
                  <div className="mt-2">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                        View payload
                      </summary>
                      <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="flex-shrink-0 p-4 border-t bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {filteredEvents.length} events from {selectedProject === 'all' ? activeProjects.length : 1} project{selectedProject === 'all' && activeProjects.length !== 1 ? 's' : ''}
          </span>
          <span>
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}