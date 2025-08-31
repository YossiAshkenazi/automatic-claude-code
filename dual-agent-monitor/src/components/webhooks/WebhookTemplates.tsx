import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  Plus, 
  ExternalLink, 
  Book, 
  Settings,
  Zap,
  MessageCircle,
  Mail,
  AlertTriangle,
  Code,
  Monitor
} from 'lucide-react';

interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  integration: string;
  defaultEvents: string[];
  defaultHeaders: Record<string, string>;
  defaultPayloadFields: string[];
  configSchema: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'select';
    required: boolean;
    description: string;
    options?: string[];
  }>;
}

interface WebhookIntegration {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  category: 'communication' | 'project-management' | 'monitoring' | 'development' | 'other';
  setupInstructions: string[];
  configFields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required: boolean;
    description: string;
    options?: string[];
  }>;
}

interface WebhookTemplatesProps {
  onCreateFromTemplate: (templateId: string) => void;
}

const getCategoryIcon = (category: string) => {
  const icons: Record<string, React.ElementType> = {
    communication: MessageCircle,
    'project-management': Settings,
    monitoring: Monitor,
    development: Code,
    other: Zap
  };
  return icons[category] || Zap;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    communication: 'bg-blue-100 text-blue-800',
    'project-management': 'bg-purple-100 text-purple-800',
    monitoring: 'bg-green-100 text-green-800',
    development: 'bg-orange-100 text-orange-800',
    other: 'bg-gray-100 text-gray-800'
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
};

const getIntegrationIcon = (integration: string) => {
  const icons: Record<string, string> = {
    slack: '💬',
    discord: '🎮',
    email: '📧',
    jira: '📋',
    github: '🐙',
    pagerduty: '🚨',
    http: '🔗'
  };
  return icons[integration] || '🔗';
};

export const WebhookTemplates: React.FC<WebhookTemplatesProps> = ({
  onCreateFromTemplate,
}) => {
  const [templates, setTemplates] = useState<WebhookTemplate[]>([]);
  const [integrations, setIntegrations] = useState<WebhookIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<WebhookTemplate | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<WebhookIntegration | null>(null);
  const [view, setView] = useState<'templates' | 'integrations' | 'setup'>('templates');

  useEffect(() => {
    loadTemplatesAndIntegrations();
  }, []);

  const loadTemplatesAndIntegrations = async () => {
    try {
      const [templatesResponse, integrationsResponse] = await Promise.all([
        fetch('/api/webhooks/templates'),
        fetch('/api/webhooks/integrations')
      ]);

      if (templatesResponse.ok) {
        const templatesResult = await templatesResponse.json();
        setTemplates(templatesResult.data || []);
      }

      if (integrationsResponse.ok) {
        const integrationsResult = await integrationsResponse.json();
        setIntegrations(integrationsResult.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const getUniqueCategories = () => {
    const categories = Array.from(new Set(integrations.map(i => i.category)));
    return categories.sort();
  };

  const filteredIntegrations = selectedCategory === 'all' 
    ? integrations 
    : integrations.filter(i => i.category === selectedCategory);

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => {
        const integration = integrations.find(i => i.id === t.integration);
        return integration?.category === selectedCategory;
      });

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
          <h2 className="text-2xl font-bold text-gray-900">Webhook Templates & Integrations</h2>
          <p className="text-gray-600">Quick setup for popular webhook integrations</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'templates' ? 'default' : 'outline'}
            onClick={() => setView('templates')}
            size="sm"
          >
            Templates
          </Button>
          <Button
            variant={view === 'integrations' ? 'default' : 'outline'}
            onClick={() => setView('integrations')}
            size="sm"
          >
            Integrations
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          All Categories
        </Button>
        {getUniqueCategories().map((category) => {
          const Icon = getCategoryIcon(category);
          return (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="flex items-center gap-1"
            >
              <Icon size={14} />
              {category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Templates View */}
      {view === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const integration = integrations.find(i => i.id === template.integration);
            return (
              <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {getIntegrationIcon(template.integration)}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      {integration && (
                        <Badge className={getCategoryColor(integration.category)}>
                          {integration.category.replace('-', ' ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4">{template.description}</p>

                {/* Default Events */}
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Default Events</h4>
                  <div className="flex flex-wrap gap-1">
                    {template.defaultEvents.slice(0, 3).map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                    {template.defaultEvents.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.defaultEvents.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Configuration Fields */}
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Configuration</h4>
                  <div className="text-xs text-gray-500">
                    {Object.keys(template.configSchema).length} configuration fields
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => onCreateFromTemplate(template.id)}
                    className="flex-1"
                  >
                    <Plus size={14} />
                    Use Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setView('setup');
                    }}
                  >
                    <Book size={14} />
                  </Button>
                </div>
              </Card>
            );
          })}

          {filteredTemplates.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="text-gray-400 mb-4">
                <Settings size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
              <p className="text-gray-600">
                {selectedCategory === 'all' 
                  ? 'No webhook templates available yet.' 
                  : `No templates available for the ${selectedCategory} category.`
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Integrations View */}
      {view === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredIntegrations.map((integration) => (
            <Card key={integration.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {getIntegrationIcon(integration.id)}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                    <Badge className={getCategoryColor(integration.category)}>
                      {integration.category.replace('-', ' ')}
                    </Badge>
                  </div>
                </div>
                <ExternalLink size={16} className="text-gray-400" />
              </div>

              <p className="text-gray-600 text-sm mb-4">{integration.description}</p>

              {/* Setup Instructions Preview */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Setup Steps</h4>
                <div className="text-xs text-gray-500">
                  {integration.setupInstructions.length} setup steps
                </div>
              </div>

              {/* Config Fields Preview */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Configuration</h4>
                <div className="space-y-1">
                  {integration.configFields.slice(0, 2).map((field) => (
                    <div key={field.name} className="text-xs text-gray-500">
                      {field.name} ({field.required ? 'required' : 'optional'})
                    </div>
                  ))}
                  {integration.configFields.length > 2 && (
                    <div className="text-xs text-gray-500">
                      +{integration.configFields.length - 2} more fields
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    // Find template for this integration and use it
                    const template = templates.find(t => t.integration === integration.id);
                    if (template) {
                      onCreateFromTemplate(template.id);
                    }
                  }}
                  className="flex-1"
                  disabled={!templates.find(t => t.integration === integration.id)}
                >
                  <Plus size={14} />
                  Create Webhook
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedIntegration(integration);
                    setView('setup');
                  }}
                >
                  <Book size={14} />
                </Button>
              </div>
            </Card>
          ))}

          {filteredIntegrations.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="text-gray-400 mb-4">
                <MessageCircle size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations found</h3>
              <p className="text-gray-600">
                {selectedCategory === 'all' 
                  ? 'No webhook integrations available yet.' 
                  : `No integrations available for the ${selectedCategory} category.`
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Setup Guide View */}
      {view === 'setup' && (selectedTemplate || selectedIntegration) && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {getIntegrationIcon(selectedTemplate?.integration || selectedIntegration?.id || '')}
              </span>
              <div>
                <h3 className="text-xl font-semibold">
                  {selectedTemplate?.name || selectedIntegration?.name} Setup Guide
                </h3>
                <p className="text-gray-600">
                  {selectedTemplate?.description || selectedIntegration?.description}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setView(selectedTemplate ? 'templates' : 'integrations')}>
              Back
            </Button>
          </div>

          {selectedIntegration && (
            <div className="space-y-6">
              {/* Setup Instructions */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Setup Instructions</h4>
                <ol className="space-y-3">
                  {selectedIntegration.setupInstructions.map((instruction, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Configuration Fields */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Configuration Fields</h4>
                <div className="space-y-3">
                  {selectedIntegration.configFields.map((field) => (
                    <div key={field.name} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{field.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={field.required ? 'default' : 'outline'} className="text-xs">
                            {field.required ? 'Required' : 'Optional'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {field.type}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm">{field.description}</p>
                      {field.options && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">Options: </span>
                          <span className="text-xs text-gray-700">{field.options.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Create Webhook Button */}
              <div className="pt-4 border-t">
                <Button
                  onClick={() => {
                    const template = templates.find(t => t.integration === selectedIntegration.id);
                    if (template) {
                      onCreateFromTemplate(template.id);
                    }
                  }}
                  disabled={!templates.find(t => t.integration === selectedIntegration.id)}
                  className="w-full"
                >
                  <Plus size={16} />
                  Create {selectedIntegration.name} Webhook
                </Button>
              </div>
            </div>
          )}

          {selectedTemplate && (
            <div className="space-y-6">
              {/* Template Details */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Template Details</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Default Events:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.defaultEvents.map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-700">Default Headers:</span>
                    <div className="mt-1 text-sm text-gray-600">
                      {Object.keys(selectedTemplate.defaultHeaders).length} headers configured
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-700">Payload Fields:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.defaultPayloadFields.map((field) => (
                        <Badge key={field} variant="outline" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration Schema */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Configuration Schema</h4>
                <div className="space-y-3">
                  {Object.entries(selectedTemplate.configSchema).map(([key, config]) => (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{key}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={config.required ? 'default' : 'outline'} className="text-xs">
                            {config.required ? 'Required' : 'Optional'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {config.type}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm">{config.description}</p>
                      {config.options && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">Options: </span>
                          <span className="text-xs text-gray-700">{config.options.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Use Template Button */}
              <div className="pt-4 border-t">
                <Button
                  onClick={() => onCreateFromTemplate(selectedTemplate.id)}
                  className="w-full"
                >
                  <Plus size={16} />
                  Use This Template
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};