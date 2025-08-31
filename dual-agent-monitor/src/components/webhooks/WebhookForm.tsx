import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { X, Plus, Trash2, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  headers?: Record<string, string>;
  payloadFields?: string[];
  filters?: Record<string, any>;
  integration?: string;
}

interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  integration: string;
  defaultEvents: string[];
  defaultHeaders: Record<string, string>;
  defaultPayloadFields: string[];
  configSchema: Record<string, any>;
}

interface WebhookFormProps {
  isOpen: boolean;
  webhook?: WebhookEndpoint;
  onClose: () => void;
  onSuccess: () => void;
}

const WEBHOOK_EVENTS = [
  { id: 'session.started', label: 'Session Started', description: 'When a new dual-agent session begins' },
  { id: 'session.completed', label: 'Session Completed', description: 'When a session finishes successfully' },
  { id: 'session.failed', label: 'Session Failed', description: 'When a session encounters critical errors' },
  { id: 'agent.message', label: 'Agent Message', description: 'Real-time agent communication events' },
  { id: 'performance.alert', label: 'Performance Alert', description: 'Performance threshold violations' },
  { id: 'anomaly.detected', label: 'Anomaly Detected', description: 'ML anomaly detection alerts' },
  { id: 'user.login', label: 'User Login', description: 'User authentication events' },
  { id: 'cost.threshold', label: 'Cost Threshold', description: 'Budget threshold notifications' },
];

export const WebhookForm: React.FC<WebhookFormProps> = ({
  isOpen,
  webhook,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
    active: true,
    headers: {} as Record<string, string>,
    payloadFields: [] as string[],
    integration: '',
  });

  const [templates, setTemplates] = useState<WebhookTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showSecret, setShowSecret] = useState(false);
  const [customHeaders, setCustomHeaders] = useState([{ key: '', value: '' }]);
  const [customPayloadFields, setCustomPayloadFields] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [urlValidation, setUrlValidation] = useState<{
    valid: boolean;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      if (webhook) {
        setFormData({
          name: webhook.name,
          url: webhook.url,
          secret: webhook.secret || '',
          events: webhook.events,
          active: webhook.active,
          headers: webhook.headers || {},
          payloadFields: webhook.payloadFields || [],
          integration: webhook.integration || '',
        });
        
        // Set up custom headers
        const headerEntries = Object.entries(webhook.headers || {});
        setCustomHeaders(headerEntries.length > 0 ? headerEntries.map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }]);
        
        // Set up custom payload fields
        setCustomPayloadFields((webhook.payloadFields || []).length > 0 ? webhook.payloadFields || [] : ['']);
      }
    }
  }, [isOpen, webhook]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/webhooks/templates');
      if (response.ok) {
        const result = await response.json();
        setTemplates(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const validateUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setUrlValidation({ valid: false, message: 'URL must use HTTP or HTTPS protocol' });
        return;
      }
      setUrlValidation({ valid: true, message: 'Valid URL' });
    } catch {
      setUrlValidation({ valid: false, message: 'Invalid URL format' });
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setFormData(prev => ({
      ...prev,
      events: template.defaultEvents,
      headers: { ...prev.headers, ...template.defaultHeaders },
      payloadFields: template.defaultPayloadFields,
      integration: template.integration,
    }));

    // Update custom headers
    const templateHeaders = Object.entries(template.defaultHeaders);
    setCustomHeaders(prev => [
      ...templateHeaders.map(([key, value]) => ({ key, value })),
      ...prev.filter(h => h.key && !template.defaultHeaders[h.key]),
    ]);

    // Update payload fields
    setCustomPayloadFields(prev => [
      ...template.defaultPayloadFields,
      ...prev.filter(f => f && !template.defaultPayloadFields.includes(f)),
    ]);

    setSelectedTemplate(templateId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url) {
      setError('Name and URL are required');
      return;
    }

    if (urlValidation && !urlValidation.valid) {
      setError('Please provide a valid URL');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Build headers from custom headers
      const headers: Record<string, string> = {};
      customHeaders.forEach(({ key, value }) => {
        if (key.trim() && value.trim()) {
          headers[key.trim()] = value.trim();
        }
      });

      // Build payload fields from custom fields
      const payloadFields = customPayloadFields.filter(field => field.trim()).map(field => field.trim());

      const payload = {
        ...formData,
        headers,
        payloadFields,
      };

      const url = webhook ? `/api/webhooks/${webhook.id}` : '/api/webhooks';
      const method = webhook ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save webhook');
      }

      setSuccess(webhook ? 'Webhook updated successfully!' : 'Webhook created successfully!');
      
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook');
    } finally {
      setLoading(false);
    }
  };

  const addCustomHeader = () => {
    setCustomHeaders(prev => [...prev, { key: '', value: '' }]);
  };

  const removeCustomHeader = (index: number) => {
    setCustomHeaders(prev => prev.filter((_, i) => i !== index));
  };

  const updateCustomHeader = (index: number, field: 'key' | 'value', value: string) => {
    setCustomHeaders(prev => prev.map((header, i) => 
      i === index ? { ...header, [field]: value } : header
    ));
  };

  const addPayloadField = () => {
    setCustomPayloadFields(prev => [...prev, '']);
  };

  const removePayloadField = (index: number) => {
    setCustomPayloadFields(prev => prev.filter((_, i) => i !== index));
  };

  const updatePayloadField = (index: number, value: string) => {
    setCustomPayloadFields(prev => prev.map((field, i) => i === index ? value : field));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {webhook ? 'Edit Webhook' : 'Create New Webhook'}
            </h2>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>

          {/* Template Selection */}
          {!webhook && templates.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Setup (Optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Slack Notifications"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Integration Type
                </label>
                <Input
                  value={formData.integration}
                  onChange={(e) => setFormData(prev => ({ ...prev, integration: e.target.value }))}
                  placeholder="e.g., slack, discord, email"
                />
              </div>
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL *
              </label>
              <Input
                value={formData.url}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, url: e.target.value }));
                  if (e.target.value) validateUrl(e.target.value);
                }}
                placeholder="https://hooks.slack.com/services/..."
                required
              />
              {urlValidation && (
                <div className={`flex items-center gap-1 mt-1 text-sm ${
                  urlValidation.valid ? 'text-green-600' : 'text-red-600'
                }`}>
                  {urlValidation.valid ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  {urlValidation.message}
                </div>
              )}
            </div>

            {/* Secret */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret (Optional)
              </label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={formData.secret}
                  onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                  placeholder="Webhook signing secret"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Used for webhook signature verification
              </p>
            </div>

            {/* Events */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Events to Subscribe
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Leave empty to receive all events
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, events: [...prev.events, event.id] }));
                        } else {
                          setFormData(prev => ({ ...prev, events: prev.events.filter(id => id !== event.id) }));
                        }
                      }}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-sm">{event.label}</p>
                      <p className="text-xs text-gray-500">{event.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Headers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Headers
              </label>
              <div className="space-y-2">
                {customHeaders.map((header, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Header name"
                      value={header.key}
                      onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
                    />
                    <Input
                      placeholder="Header value"
                      value={header.value}
                      onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeCustomHeader(index)}
                      className="text-red-600"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomHeader}
                  className="flex items-center gap-1"
                >
                  <Plus size={14} />
                  Add Header
                </Button>
              </div>
            </div>

            {/* Payload Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payload Fields Filter
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Specify which fields to include in the payload. Leave empty to include all fields.
              </p>
              <div className="space-y-2">
                {customPayloadFields.map((field, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Field name (e.g., sessionId, message, timestamp)"
                      value={field}
                      onChange={(e) => updatePayloadField(index, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removePayloadField(index)}
                      className="text-red-600"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPayloadField}
                  className="flex items-center gap-1"
                >
                  <Plus size={14} />
                  Add Field
                </Button>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
              />
              <label htmlFor="active" className="text-sm font-medium text-gray-700">
                Active (webhook will receive events)
              </label>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-700">{success}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <LoadingSpinner />
                    {webhook ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  webhook ? 'Update Webhook' : 'Create Webhook'
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};