import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  X, 
  RefreshCw, 
  Search, 
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Filter,
  Download
} from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
}

interface WebhookLog {
  id: string;
  endpointId: string;
  event: string;
  payload: any;
  result: {
    success: boolean;
    statusCode: number;
    response?: any;
    error?: string;
    deliveredAt: string;
    duration: number;
  };
  timestamp: string;
}

interface WebhookLogsProps {
  isOpen: boolean;
  webhook: WebhookEndpoint;
  onClose: () => void;
}

export const WebhookLogs: React.FC<WebhookLogsProps> = ({
  isOpen,
  webhook,
  onClose,
}) => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (autoRefresh && isOpen) {
      const interval = setInterval(loadLogs, 5000); // Refresh every 5 seconds
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, isOpen]);

  const loadLogs = async () => {
    if (!webhook) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/webhooks/${webhook.id}/logs?limit=100`);
      if (!response.ok) throw new Error('Failed to fetch logs');

      const result = await response.json();
      setLogs(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const getUniqueEvents = () => {
    const events = Array.from(new Set(logs.map(log => log.event)));
    return events.sort();
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      searchTerm === '' ||
      log.event.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.result.error && log.result.error.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'success' && log.result.success) ||
      (statusFilter === 'failed' && !log.result.success);
    
    const matchesEvent = 
      eventFilter === 'all' || 
      log.event === eventFilter;
    
    return matchesSearch && matchesStatus && matchesEvent;
  });

  const getStatusColor = (success: boolean) => {
    return success 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  const getStatusIcon = (success: boolean) => {
    return success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `webhook-logs-${webhook.name}-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Webhook Delivery Logs</h2>
              <p className="text-gray-600">{webhook.name} • {webhook.url}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'bg-green-50 text-green-700' : ''}
              >
                <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} />
                Auto Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <X size={16} />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="success">Success Only</option>
              <option value="failed">Failed Only</option>
            </select>

            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Events</option>
              {getUniqueEvents().map(event => (
                <option key={event} value={event}>{event}</option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
              disabled={filteredLogs.length === 0}
            >
              <Download size={16} />
              Export
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
            <span>Total: {logs.length}</span>
            <span className="text-green-600">
              Success: {logs.filter(l => l.result.success).length}
            </span>
            <span className="text-red-600">
              Failed: {logs.filter(l => !l.result.success).length}
            </span>
            <span>Filtered: {filteredLogs.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Logs List */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            {loading && logs.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Filter size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No logs found</p>
                  <p className="text-sm">
                    {searchTerm || statusFilter !== 'all' || eventFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'No webhook deliveries yet'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedLog?.id === log.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getStatusColor(log.result.success)}>
                            {getStatusIcon(log.result.success)}
                            {log.result.success ? 'Success' : 'Failed'}
                          </Badge>
                          <Badge variant="outline">{log.event}</Badge>
                          {log.result.statusCode && (
                            <span className="text-sm text-gray-600">
                              HTTP {log.result.statusCode}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            {formatTimestamp(log.timestamp)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            {formatDuration(log.result.duration)}
                          </div>
                        </div>

                        {log.result.error && (
                          <div className="text-sm text-red-600 truncate">
                            Error: {log.result.error}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <ExternalLink size={16} className="text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Log Details */}
          {selectedLog && (
            <div className="w-1/2 border-l border-gray-200 bg-gray-50 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Log Details</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedLog(null)}
                  >
                    <X size={16} />
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Basic Info */}
                  <Card className="p-4">
                    <h4 className="font-medium mb-3">Delivery Info</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Event:</span>
                        <Badge variant="outline">{selectedLog.event}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <Badge className={getStatusColor(selectedLog.result.success)}>
                          {selectedLog.result.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">HTTP Status:</span>
                        <span>{selectedLog.result.statusCode || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span>{formatDuration(selectedLog.result.duration)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Timestamp:</span>
                        <span>{formatTimestamp(selectedLog.timestamp)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Delivered At:</span>
                        <span>{formatTimestamp(selectedLog.result.deliveredAt)}</span>
                      </div>
                    </div>
                  </Card>

                  {/* Error */}
                  {selectedLog.result.error && (
                    <Card className="p-4">
                      <h4 className="font-medium mb-3 text-red-600">Error Details</h4>
                      <pre className="text-sm text-red-700 whitespace-pre-wrap bg-red-50 p-3 rounded border">
                        {selectedLog.result.error}
                      </pre>
                    </Card>
                  )}

                  {/* Request Payload */}
                  <Card className="p-4">
                    <h4 className="font-medium mb-3">Request Payload</h4>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-100 p-3 rounded border overflow-x-auto">
                      {JSON.stringify(selectedLog.payload, null, 2)}
                    </pre>
                  </Card>

                  {/* Response */}
                  {selectedLog.result.response && (
                    <Card className="p-4">
                      <h4 className="font-medium mb-3">Response</h4>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-100 p-3 rounded border overflow-x-auto">
                        {typeof selectedLog.result.response === 'string' 
                          ? selectedLog.result.response 
                          : JSON.stringify(selectedLog.result.response, null, 2)
                        }
                      </pre>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};