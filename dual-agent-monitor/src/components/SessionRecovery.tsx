import React, { useState } from 'react';
import { RefreshCw, Database, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { DualAgentSession } from '../types';
import { formatRelativeTime } from '../utils/formatters';
import { apiClient } from '../utils/api';

interface SessionRecoveryProps {
  sessions: DualAgentSession[];
  onSelectSession: (sessionId: string) => void;
  onRefresh: () => void;
}

export function SessionRecovery({ sessions, onSelectSession, onRefresh }: SessionRecoveryProps) {
  const [recoveryStatus, setRecoveryStatus] = useState<Record<string, 'loading' | 'success' | 'error'>>({});

  // Filter sessions that can be recovered (not completed/failed but have data)
  const recoverableSessions = sessions.filter(session => 
    (session.status === 'paused' || session.status === 'error') && 
    session.messages.length > 0
  );

  // Recent completed sessions that might be resumed
  const recentSessions = sessions.filter(session => 
    (session.status === 'completed' || session.status === 'failed') &&
    session.messages.length > 0 &&
    session.endTime &&
    (Date.now() - new Date(session.endTime).getTime()) < 24 * 60 * 60 * 1000 // Last 24 hours
  ).slice(0, 5);

  const handleResumeSession = async (sessionId: string) => {
    setRecoveryStatus(prev => ({ ...prev, [sessionId]: 'loading' }));

    try {
      // Update session status to running
      await apiClient.updateSessionStatus(sessionId, 'running');
      setRecoveryStatus(prev => ({ ...prev, [sessionId]: 'success' }));
      onSelectSession(sessionId);
      
      // Clear success status after 2 seconds
      setTimeout(() => {
        setRecoveryStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[sessionId];
          return newStatus;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to resume session:', error);
      setRecoveryStatus(prev => ({ ...prev, [sessionId]: 'error' }));
      
      // Clear error status after 5 seconds
      setTimeout(() => {
        setRecoveryStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[sessionId];
          return newStatus;
        });
      }, 5000);
    }
  };

  if (recoverableSessions.length === 0 && recentSessions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Database size={48} className="mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium mb-2">No recoverable sessions</h3>
        <p className="text-sm mb-4">All sessions are either running or too old to recover</p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
          Check for Sessions
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Session Recovery</h2>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Recoverable Sessions */}
      {recoverableSessions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-500" />
            Paused/Error Sessions ({recoverableSessions.length})
          </h3>
          <div className="space-y-3">
            {recoverableSessions.map(session => (
              <div
                key={session.id}
                className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 line-clamp-1">
                      {session.initialTask}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>Started {formatRelativeTime(session.startTime)}</span>
                      <span>{session.messages.length} messages</span>
                      <span className="flex items-center gap-1">
                        <Database size={12} />
                        Persisted
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      session.status === 'paused' 
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {session.status}
                    </span>
                    
                    <button
                      onClick={() => handleResumeSession(session.id)}
                      disabled={recoveryStatus[session.id] === 'loading'}
                      className="flex items-center gap-2 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {recoveryStatus[session.id] === 'loading' ? (
                        <>
                          <div className="animate-spin w-4 h-4 border border-green-600 border-t-transparent rounded-full" />
                          Resuming...
                        </>
                      ) : recoveryStatus[session.id] === 'success' ? (
                        <>
                          <CheckCircle size={16} />
                          Resumed
                        </>
                      ) : recoveryStatus[session.id] === 'error' ? (
                        <>
                          <AlertTriangle size={16} />
                          Failed
                        </>
                      ) : (
                        <>
                          <RefreshCw size={16} />
                          Resume
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 flex items-center justify-between">
                  <span>Working directory: {session.workDir}</span>
                  <span>Session ID: {session.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Completed Sessions */}
      {recentSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-blue-500" />
            Recent Sessions ({recentSessions.length})
          </h3>
          <div className="space-y-3">
            {recentSessions.map(session => (
              <div
                key={session.id}
                className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 line-clamp-1">
                      {session.initialTask}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>
                        {session.endTime 
                          ? `Completed ${formatRelativeTime(session.endTime)}`
                          : `Started ${formatRelativeTime(session.startTime)}`
                        }
                      </span>
                      <span>{session.messages.length} messages</span>
                      {session.summary?.totalDuration && (
                        <span>{session.summary.totalDuration}s duration</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      session.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {session.status}
                    </span>
                    
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                    >
                      <Database size={16} />
                      View
                    </button>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 flex items-center justify-between">
                  <span>Working directory: {session.workDir}</span>
                  <span>Session ID: {session.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}