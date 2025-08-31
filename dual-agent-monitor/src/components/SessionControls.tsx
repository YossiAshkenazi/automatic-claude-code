import React, { useState } from 'react';
import { Play, Pause, Square, RotateCcw, Download, Trash2, RefreshCw, Database, AlertTriangle } from 'lucide-react';
import { SessionControlProps } from '../types';
import { getStatusBadgeColor } from '../utils/formatters';

interface EnhancedSessionControlProps extends SessionControlProps {
  onExport?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
  isPersisted?: boolean;
  isUpdating?: boolean;
}

export function SessionControls({ 
  session, 
  onStatusChange, 
  onExport, 
  onDelete, 
  onRefresh,
  isPersisted = true,
  isUpdating = false 
}: EnhancedSessionControlProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleStatusChange = async (newStatus: typeof session.status) => {
    setIsLoading(true);
    try {
      await onStatusChange(session.id, newStatus);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      if (onExport) {
        await onExport();
      } else {
        // Enhanced fallback with persistence check
        const exportData = {
          ...session,
          exportMetadata: {
            exportedAt: new Date().toISOString(),
            isPersisted,
            version: '2.0'
          }
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `session-${session.id}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmMessage = isPersisted 
      ? 'This will permanently delete the session from the database. This action cannot be undone. Continue?'
      : 'Are you sure you want to delete this session?';
      
    if (!confirm(confirmMessage)) return;
    
    setIsLoading(true);
    try {
      if (onDelete) {
        await onDelete();
      } else {
        console.log('Delete session:', session.id);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    if (onRefresh) {
      setIsLoading(true);
      try {
        await onRefresh();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getControlButtons = () => {
    switch (session.status) {
      case 'running':
        return (
          <>
            <button
              onClick={() => handleStatusChange('paused')}
              className="flex items-center gap-2 px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition-colors"
            >
              <Pause size={16} />
              Pause
            </button>
            <button
              onClick={() => handleStatusChange('failed')}
              className="flex items-center gap-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              <Square size={16} />
              Stop
            </button>
          </>
        );
      
      case 'paused':
        return (
          <>
            <button
              onClick={() => handleStatusChange('running')}
              className="flex items-center gap-2 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
            >
              <Play size={16} />
              Resume
            </button>
            <button
              onClick={() => handleStatusChange('failed')}
              className="flex items-center gap-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              <Square size={16} />
              Stop
            </button>
          </>
        );
      
      case 'completed':
      case 'failed':
        return (
          <button
            onClick={() => handleStatusChange('running')}
            className="flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
            title="Restart session"
          >
            <RotateCcw size={16} />
            Restart
          </button>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(session.status)}`}>
            {session.status.toUpperCase()}
          </span>
          {isUpdating && (
            <div className="animate-spin w-4 h-4 border border-blue-400 border-t-transparent rounded-full" />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Session: {session.id.split('-')[0]}...
          </span>
          {isPersisted ? (
            <Database size={16} className="text-blue-600" title="Persisted to database" />
          ) : (
            <AlertTriangle size={16} className="text-yellow-600" title="Not yet persisted" />
          )}
        </div>
        
        <span className="text-sm text-gray-600">
          Messages: {session.messages?.length || 0}
        </span>
        
        {session.lastActivity && (
          <span className="text-xs text-gray-500">
            Last: {new Date(session.lastActivity).toLocaleTimeString()}
          </span>
        )}
        
        {session.summary?.totalCost && (
          <span className="text-sm text-gray-600">
            Cost: ${session.summary.totalCost.toFixed(4)}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {getControlButtons()}
        
        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh from database"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
        
        <button
          onClick={handleExport}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title="Export session data"
        >
          {isLoading ? (
            <div className="animate-spin w-4 h-4 border border-gray-600 border-t-transparent rounded-full" />
          ) : (
            <Download size={16} />
          )}
          Export
        </button>
        
        <button
          onClick={handleDelete}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors disabled:opacity-50"
          title={isPersisted ? "Permanently delete from database" : "Delete session"}
        >
          {isLoading ? (
            <div className="animate-spin w-4 h-4 border border-red-600 border-t-transparent rounded-full" />
          ) : (
            <Trash2 size={16} />
          )}
          Delete
        </button>
      </div>
    </div>
  );
}