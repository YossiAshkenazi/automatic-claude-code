import React, { useState } from 'react';
import { Clock, MessageSquare, DollarSign, CheckCircle, XCircle, Pause, Play, Download, AlertCircle, Database } from 'lucide-react';
import { DualAgentSession } from '../types';
import { formatRelativeTime, formatCost, getStatusBadgeColor, truncateText } from '../utils/formatters';
import { apiClient } from '../utils/api';

interface SessionListProps {
  sessions: DualAgentSession[];
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onExportSession?: (sessionId: string) => void;
  showPersistenceStatus?: boolean;
}

export function SessionList({ 
  sessions, 
  selectedSessionId, 
  onSelectSession, 
  onExportSession,
  showPersistenceStatus = true 
}: SessionListProps) {
  const [exportingSession, setExportingSession] = useState<string | null>(null);
  const handleExport = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent session selection
    setExportingSession(sessionId);
    
    try {
      if (onExportSession) {
        onExportSession(sessionId);
      } else {
        await apiClient.exportSession(sessionId, { format: 'json', includeMetadata: true });
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExportingSession(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play size={16} className="text-green-600" />;
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'failed':
      case 'error':
        return <XCircle size={16} className="text-red-600" />;
      case 'paused':
        return <Pause size={16} className="text-yellow-600" />;
      default:
        return <Clock size={16} className="text-gray-600" />;
    }
  };

  const getPersistenceIcon = (session: DualAgentSession) => {
    const hasMessages = session.messages && session.messages.length > 0;
    const hasEndTime = session.endTime;
    const isPersisted = hasMessages || hasEndTime;
    
    return isPersisted ? (
      <Database size={12} className="text-blue-600" title="Session persisted to database" />
    ) : (
      <AlertCircle size={12} className="text-gray-400" title="Session not yet persisted" />
    );
  };

  if (sessions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium mb-2">No sessions yet</h3>
        <p className="text-sm">Sessions will appear here once you start monitoring</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => onSelectSession(session.id)}
          className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
            selectedSessionId === session.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(session.status)}
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(session.status)}`}>
                {session.status}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(session.startTime)}
            </span>
          </div>

          <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
            {truncateText(session.initialTask, 80)}
          </h4>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <MessageSquare size={12} />
                {session.messages.length}
              </div>
              
              {session.summary?.totalCost && (
                <div className="flex items-center gap-1">
                  <DollarSign size={12} />
                  {formatCost(session.summary.totalCost)}
                </div>
              )}
              
              <div className="flex items-center gap-1">
                <Clock size={12} />
                {session.summary?.totalDuration 
                  ? `${session.summary.totalDuration}s`
                  : session.endTime 
                    ? `${Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000)}s`
                    : 'Ongoing'
                }
              </div>
              
              {showPersistenceStatus && (
                <div className="flex items-center gap-1" title="Database persistence status">
                  {getPersistenceIcon(session)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleExport(e, session.id)}
                disabled={exportingSession === session.id}
                className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                title="Export session"
              >
                {exportingSession === session.id ? (
                  <div className="animate-spin w-3 h-3 border border-gray-400 border-t-transparent rounded-full" />
                ) : (
                  <Download size={12} />
                )}
              </button>
              
              <span className="text-xs font-mono text-gray-400">
                {session.id.split('-')[1]}
              </span>
            </div>
          </div>

          {/* Agent activity indicators */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span className="text-xs text-gray-600">
                Manager: {session.messages.filter(m => m.agentType === 'manager').length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-xs text-gray-600">
                Worker: {session.messages.filter(m => m.agentType === 'worker').length}
              </span>
            </div>
          </div>

          {/* Enhanced session metadata */}
          <div className="mt-2 space-y-1">
            {/* Working directory */}
            {session.workDir && (
              <div className="text-xs text-gray-500 truncate">
                📁 {session.workDir}
              </div>
            )}
            
            {/* Tools and files summary */}
            {session.summary && (
              <div className="flex flex-wrap gap-1">
                {session.summary.toolsUsed.slice(0, 3).map((tool) => (
                  <span
                    key={tool}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                  >
                    {tool}
                  </span>
                ))}
                {session.summary.toolsUsed.length > 3 && (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                    +{session.summary.toolsUsed.length - 3} more
                  </span>
                )}
              </div>
            )}
            
            {/* Last activity timestamp */}
            {session.lastActivity && (
              <div className="text-xs text-gray-400">
                Last activity: {formatRelativeTime(new Date(session.lastActivity))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}