import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { WebhookForm } from './WebhookForm';
import { WebhookLogs } from './WebhookLogs';
import { WebhookTester } from './WebhookTester';
import { 
  Plus, 
  Settings, 
  Trash2, 
  TestTube, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  integration?: string;
  createdAt: string;
  updatedAt: string;
}

interface WebhookStats {
  totalEndpoints: number;
  activeEndpoints: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageDeliveryTime: number;
}

export const WebhookManager: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEndpoint | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadWebhooks();
    loadStats();
  }, []);

  const loadWebhooks = async () => {
    try {
      const response = await fetch('/api/webhooks');
      if (!response.ok) throw new Error('Failed to fetch webhooks');
      
      const result = await response.json();
      setWebhooks(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/webhooks/statistics');
      if (!response.ok) throw new Error('Failed to fetch statistics');
      
      const result = await response.json();
      setStats(result.data?.manager || null);
    } catch (err) {
      console.error('Failed to load webhook statistics:', err);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete webhook');
      
      await loadWebhooks();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const toggleWebhook = async (id: string, active: boolean) => {
    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active })
      });
      
      if (!response.ok) throw new Error('Failed to update webhook');
      
      await loadWebhooks();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    }
  };

  const testWebhook = async (id: string) => {
    try {
      const response = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        alert('Test webhook sent successfully!');
      } else {
        alert(`Test failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const filteredWebhooks = webhooks.filter(webhook => {
    const matchesFilter = filter === 'all' || 
      (filter === 'active' && webhook.active) ||
      (filter === 'inactive' && !webhook.active);
    
    const matchesSearch = webhook.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      webhook.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (webhook.integration && webhook.integration.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  const formatDeliveryTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusColor = (active: boolean) => {
    return active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const getIntegrationIcon = (integration?: string) => {
    const icons: Record<string, string> = {
      slack: '💬',
      discord: '🎮',
      email: '📧',
      jira: '📋',
      github: '🐙',
      pagerduty: '🚨'
    };
    return integration ? icons[integration] || '🔗' : '🔗';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhook Management</h1>
          <p className="text-gray-600">Configure and manage external webhook integrations</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus size={16} />
          Add Webhook
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Endpoints</p>
                <p className="text-2xl font-bold">{stats.totalEndpoints}</p>
              </div>
              <Settings className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Endpoints</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeEndpoints}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.totalDeliveries > 0 
                    ? `${Math.round((stats.successfulDeliveries / stats.totalDeliveries) * 100)}%`
                    : '0%'
                  }
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Response Time</p>
                <p className="text-2xl font-bold">
                  {formatDeliveryTime(stats.averageDeliveryTime)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({webhooks.length})
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('active')}
          >
            Active ({webhooks.filter(w => w.active).length})
          </Button>
          <Button
            variant={filter === 'inactive' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('inactive')}
          >
            Inactive ({webhooks.filter(w => !w.active).length})
          </Button>
        </div>
        
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search webhooks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Webhooks List */}
      <div className="space-y-4">
        {filteredWebhooks.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Settings size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No webhooks found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || filter !== 'all' 
                ? 'No webhooks match your current filters.' 
                : 'Get started by creating your first webhook integration.'
              }
            </p>
            {!searchTerm && filter === 'all' && (
              <Button onClick={() => setShowCreateForm(true)}>
                Create Your First Webhook
              </Button>
            )}
          </Card>
        ) : (
          filteredWebhooks.map((webhook) => (
            <Card key={webhook.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl" title={webhook.integration}>
                      {getIntegrationIcon(webhook.integration)}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900">{webhook.name}</h3>
                    <Badge className={getStatusColor(webhook.active)}>
                      {webhook.active ? 'Active' : 'Inactive'}
                    </Badge>
                    {webhook.integration && (
                      <Badge variant="outline">{webhook.integration}</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <ExternalLink size={14} />
                    <span className="truncate max-w-md">{webhook.url}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {webhook.events.length > 0 ? (
                      webhook.events.map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-xs">All events</Badge>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Created: {new Date(webhook.createdAt).toLocaleDateString()} • 
                    Updated: {new Date(webhook.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testWebhook(webhook.id)}
                    title="Test webhook"
                  >
                    <TestTube size={16} />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedWebhook(webhook);
                      setShowLogs(true);
                    }}
                    title="View logs"
                  >
                    <Activity size={16} />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedWebhook(webhook);
                      setShowEditForm(true);
                    }}
                    title="Edit webhook"
                  >
                    <Settings size={16} />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleWebhook(webhook.id, webhook.active)}
                    title={webhook.active ? 'Disable' : 'Enable'}
                    className={webhook.active ? 'text-orange-600' : 'text-green-600'}
                  >
                    {webhook.active ? 'Disable' : 'Enable'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteWebhook(webhook.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete webhook"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <WebhookForm
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false);
            loadWebhooks();
            loadStats();
          }}
        />
      )}

      {/* Edit Form Modal */}
      {showEditForm && selectedWebhook && (
        <WebhookForm
          isOpen={showEditForm}
          webhook={selectedWebhook}
          onClose={() => {
            setShowEditForm(false);
            setSelectedWebhook(null);
          }}
          onSuccess={() => {
            setShowEditForm(false);
            setSelectedWebhook(null);
            loadWebhooks();
            loadStats();
          }}
        />
      )}

      {/* Logs Modal */}
      {showLogs && selectedWebhook && (
        <WebhookLogs
          isOpen={showLogs}
          webhook={selectedWebhook}
          onClose={() => {
            setShowLogs(false);
            setSelectedWebhook(null);
          }}
        />
      )}

      {/* Tester Modal */}
      {showTester && selectedWebhook && (
        <WebhookTester
          isOpen={showTester}
          webhook={selectedWebhook}
          onClose={() => {
            setShowTester(false);
            setSelectedWebhook(null);
          }}
        />
      )}
    </div>
  );
};