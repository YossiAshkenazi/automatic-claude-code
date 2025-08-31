import React from 'react';
import { Play, Pause, Square, RotateCcw, Download, Trash2 } from 'lucide-react';
import { SessionControlProps } from '../types';
import { getStatusBadgeColor } from '../utils/formatters';

export function SessionControls({ session, onStatusChange }: SessionControlProps) {
  const handleStatusChange = (newStatus: typeof session.status) => {
    onStatusChange(session.id, newStatus);
  };

  const downloadSessionData = () => {
    const dataStr = JSON.stringify(session, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `session-${session.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
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
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(session.status)}`}>
          {session.status.toUpperCase()}
        </span>
        <span className="text-sm text-gray-600">
          Session: {session.id}
        </span>
        <span className="text-sm text-gray-600">
          Messages: {session.messages.length}
        </span>
        {session.summary?.totalCost && (
          <span className="text-sm text-gray-600">
            Cost: ${session.summary.totalCost.toFixed(4)}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {getControlButtons()}
        
        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        <button
          onClick={downloadSessionData}
          className="flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          title="Download session data"
        >
          <Download size={16} />
          Export
        </button>
        
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this session?')) {
              // This would trigger a delete API call
              console.log('Delete session:', session.id);
            }
          }}
          className="flex items-center gap-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
          title="Delete session"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}