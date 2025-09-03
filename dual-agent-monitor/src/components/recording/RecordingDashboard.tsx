import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Download, 
  Eye, 
  Clock, 
  FileText, 
  Bookmark, 
  MessageSquare, 
  MoreVertical,
  Search,
  Filter,
  Calendar,
  HardDrive,
  Activity
} from 'lucide-react';
import { SessionRecording, RecordingStats } from '../../types';
import { SessionRecordingViewer } from './SessionRecordingViewer';

interface RecordingDashboardProps {
  onStartRecording?: (sessionId: string, options: any) => void;
  onStopRecording?: (sessionId: string) => void;
  onPlayRecording?: (recordingId: string) => void;
  onExportRecording?: (recordingId: string, format: string) => void;
  onDeleteRecording?: (recordingId: string) => void;
  className?: string;
}

export const RecordingDashboard: React.FC<RecordingDashboardProps> = ({
  onStartRecording,
  onStopRecording,
  onPlayRecording,
  onExportRecording,
  onDeleteRecording,
  className = ''
}) => {
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [stats, setStats] = useState<RecordingStats | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<SessionRecording | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'duration' | 'views'>('date');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load recordings and stats
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [recordingsData, statsData] = await Promise.all([
          fetchRecordings({
            limit: 100,
            status: filterStatus === 'all' ? undefined : filterStatus,
            search: searchQuery || undefined
          }),
          fetchRecordingStats()
        ]);
        setRecordings(recordingsData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load recording data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Set up polling for live updates
    const interval = setInterval(loadData, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [searchQuery, filterStatus]);

  // Filter and sort recordings
  const filteredRecordings = React.useMemo(() => {
    let filtered = recordings;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(recording =>
        recording.recordingName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recording.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recording.sessionId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(recording => recording.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'duration':
          return (b.playbackDurationMs || 0) - (a.playbackDurationMs || 0);
        case 'views':
          return b.downloadCount - a.downloadCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [recordings, searchQuery, filterStatus, sortBy]);

  const formatDuration = (ms?: number): string => {
    if (!ms) return '0:00';
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      recording: { color: 'bg-red-100 text-red-800', icon: '●', label: 'Recording' },
      completed: { color: 'bg-green-100 text-green-800', icon: '✓', label: 'Completed' },
      processing: { color: 'bg-yellow-100 text-yellow-800', icon: '⟳', label: 'Processing' },
      failed: { color: 'bg-gray-100 text-gray-800', icon: '✗', label: 'Failed' }
    };

    const config = statusConfig[status] || statusConfig.completed;

    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const handlePlayRecording = (recording: SessionRecording) => {
    if (recording.status === 'completed') {
      setSelectedRecording(recording);
      if (onPlayRecording) {
        onPlayRecording(recording.id);
      }
    }
  };

  const handleExportRecording = async (recordingId: string, format: string) => {
    if (onExportRecording) {
      onExportRecording(recordingId, format);
      return;
    }
    
    try {
      await exportRecording(recordingId, format);
      // Show success notification
      console.log(`Export started for recording ${recordingId} in ${format} format`);
    } catch (error) {
      console.error('Export failed:', error);
      // Show error notification
    }
  };
  
  const handleStartRecording = async (sessionId: string) => {
    if (onStartRecording) {
      onStartRecording(sessionId, {});
      return;
    }
    
    try {
      const recordingId = await startRecording(sessionId, {
        recordingName: `Recording for session ${sessionId.slice(0, 8)}`,
        recordingQuality: 'high'
      });
      console.log('Recording started:', recordingId);
      // Refresh recordings
      const updatedRecordings = await fetchRecordings();
      setRecordings(updatedRecordings);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };
  
  const handleStopRecording = async (recordingId: string) => {
    try {
      await stopRecording(recordingId);
      console.log('Recording stopped:', recordingId);
      // Refresh recordings
      const updatedRecordings = await fetchRecordings();
      setRecordings(updatedRecordings);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading recordings...</span>
      </div>
    );
  }

  // If viewing a specific recording
  if (selectedRecording) {
    return (
      <div className={className}>
        <div className="mb-4">
          <button
            onClick={() => setSelectedRecording(null)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to recordings
          </button>
        </div>
        <SessionRecordingViewer
          recording={selectedRecording}
          onExportRecording={(format) => handleExportRecording(selectedRecording.id, format)}
          className="w-full"
        />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header with Stats */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Session Recordings</h2>
            <p className="text-gray-600 mt-1">Manage and view recorded agent sessions</p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <Activity className="w-6 h-6 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Active</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.activeRecordings}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <FileText className="w-6 h-6 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-900">Total</p>
                  <p className="text-2xl font-bold text-green-600">{stats.totalRecordings}</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <HardDrive className="w-6 h-6 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-purple-900">Storage</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatFileSize(recordings.reduce((acc, r) => acc + r.totalSizeBytes, 0))}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center">
                <Download className="w-6 h-6 text-orange-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-orange-900">Downloads</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {recordings.reduce((acc, r) => acc + r.downloadCount, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center space-x-4 flex-grow">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search recordings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-3 py-2 border rounded-lg transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-300' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'duration' | 'views')}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="date">Date</option>
              <option value="duration">Duration</option>
              <option value="views">Views</option>
            </select>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="all">All Status</option>
                  <option value="recording">Recording</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Last 30 days</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quality</label>
                <select className="w-full border border-gray-300 rounded px-3 py-2">
                  <option value="all">All Qualities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="lossless">Lossless</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recordings List */}
      <div className="divide-y divide-gray-200">
        {filteredRecordings.map((recording) => (
          <div key={recording.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-grow">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {recording.recordingName || `Recording ${recording.id.slice(0, 8)}`}
                  </h3>
                  {getStatusBadge(recording.status)}
                </div>

                {recording.description && (
                  <p className="text-gray-600 mb-3">{recording.description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDuration(recording.playbackDurationMs)}
                  </div>
                  
                  <div className="flex items-center">
                    <Activity className="w-4 h-4 mr-1" />
                    {recording.totalInteractions} interactions
                  </div>
                  
                  <div className="flex items-center">
                    <HardDrive className="w-4 h-4 mr-1" />
                    {formatFileSize(recording.totalSizeBytes)}
                  </div>
                  
                  <div className="flex items-center">
                    <Download className="w-4 h-4 mr-1" />
                    {recording.downloadCount} downloads
                  </div>

                  <div className="flex items-center">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    {recording.annotations?.length || 0} notes
                  </div>

                  <div className="flex items-center">
                    <Bookmark className="w-4 h-4 mr-1" />
                    {recording.bookmarks?.length || 0} bookmarks
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  Session: {recording.sessionId} • 
                  Created: {new Date(recording.createdAt).toLocaleDateString()} • 
                  Quality: {recording.recordingQuality}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 ml-4">
                {recording.status === 'recording' && (
                  <button
                    onClick={() => {
                      if (onStopRecording) {
                        onStopRecording(recording.sessionId);
                      } else {
                        handleStopRecording(recording.id);
                      }
                    }}
                    className="flex items-center px-3 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </button>
                )}

                {recording.status === 'completed' && (
                  <>
                    <button
                      onClick={() => handlePlayRecording(recording)}
                      className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </button>

                    <div className="relative group">
                      <button className="flex items-center px-3 py-2 text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="p-1">
                          <button
                            onClick={() => handleExportRecording(recording.id, 'json')}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                          >
                            Export as JSON
                          </button>
                          <button
                            onClick={() => handleExportRecording(recording.id, 'csv')}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                          >
                            Export as CSV
                          </button>
                          <button
                            onClick={() => handleExportRecording(recording.id, 'html')}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                          >
                            Export as HTML
                          </button>
                          <button
                            onClick={() => handleExportRecording(recording.id, 'pdf')}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                          >
                            Export as PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredRecordings.length === 0 && (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recordings found</h3>
            <p className="text-gray-600">
              {searchQuery || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Start recording a session to see recordings here'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Real API functions integrated with PostgreSQL backend
const fetchRecordings = async (params?: {
  limit?: number;
  status?: string;
  quality?: string;
  search?: string;
}): Promise<SessionRecording[]> => {
  try {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.quality) searchParams.set('quality', params.quality);
    if (params?.search) searchParams.set('search', params.search);
    
    const response = await fetch(`/api/recordings?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch recordings');
    }
    const data = await response.json();
    return data.recordings || [];
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return [];
  }
};

const fetchRecordingStats = async (): Promise<RecordingStats> => {
  try {
    const response = await fetch('/api/recordings/stats');
    if (!response.ok) {
      throw new Error('Failed to fetch recording stats');
    }
    const data = await response.json();
    return data.stats || {
      activeRecordings: 0,
      totalRecordings: 0,
      autoRecordingSessions: 0,
      recordingPoliciesCount: 0
    };
  } catch (error) {
    console.error('Error fetching recording stats:', error);
    return {
      activeRecordings: 0,
      totalRecordings: 0,
      autoRecordingSessions: 0,
      recordingPoliciesCount: 0
    };
  }
};

// Additional API functions for recording management
const startRecording = async (sessionId: string, options?: {
  recordingName?: string;
  description?: string;
  recordingQuality?: 'low' | 'medium' | 'high' | 'lossless';
}): Promise<string> => {
  try {
    const response = await fetch('/api/recordings/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        ...options,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to start recording');
    }
    const data = await response.json();
    return data.recordingId;
  } catch (error) {
    console.error('Error starting recording:', error);
    throw error;
  }
};

const stopRecording = async (recordingId: string): Promise<void> => {
  try {
    const response = await fetch(`/api/recordings/${recordingId}/stop`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to stop recording');
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
    throw error;
  }
};

const exportRecording = async (recordingId: string, format: string): Promise<void> => {
  try {
    const response = await fetch(`/api/recordings/${recordingId}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exportFormat: format,
        includeAnnotations: true,
        includeBookmarks: true,
        includeMetadata: true,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to export recording');
    }
    const data = await response.json();
    console.log('Export started:', data.exportId);
  } catch (error) {
    console.error('Error exporting recording:', error);
    throw error;
  }
};

export default RecordingDashboard;