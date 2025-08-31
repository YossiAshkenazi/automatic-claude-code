import { EventEmitter } from 'events';
import type { 
  WebhookEndpoint, 
  WebhookEvent, 
  WebhookTemplate, 
  WebhookIntegration,
  WebhookConfig 
} from '../types.js';

export interface WebhookRegistryOptions {
  persistentStorage?: boolean;
  storageAdapter?: WebhookStorageAdapter;
  validateUrls?: boolean;
}

export interface WebhookStorageAdapter {
  save(endpoints: WebhookEndpoint[]): Promise<void>;
  load(): Promise<WebhookEndpoint[]>;
  delete(id: string): Promise<boolean>;
}

export class WebhookRegistry extends EventEmitter {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private templates: Map<string, WebhookTemplate> = new Map();
  private integrations: Map<string, WebhookIntegration> = new Map();
  private options: WebhookRegistryOptions;

  constructor(options: WebhookRegistryOptions = {}) {
    super();
    this.options = {
      persistentStorage: false,
      validateUrls: true,
      ...options
    };

    // Initialize built-in templates and integrations
    this.initializeBuiltInTemplates();
    this.initializeBuiltInIntegrations();

    // Load from storage if configured
    if (this.options.persistentStorage && this.options.storageAdapter) {
      this.loadFromStorage();
    }
  }

  /**
   * Register a new webhook endpoint
   */
  async register(config: Omit<WebhookEndpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookEndpoint> {
    // Validate URL if enabled
    if (this.options.validateUrls) {
      await this.validateWebhookUrl(config.url);
    }

    // Validate events
    this.validateEvents(config.events);

    const endpoint: WebhookEndpoint = {
      ...config,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.endpoints.set(endpoint.id, endpoint);
    this.emit('endpoint.registered', endpoint);

    // Persist if configured
    if (this.options.persistentStorage) {
      await this.persistToStorage();
    }

    return endpoint;
  }

  /**
   * Update an existing webhook endpoint
   */
  async update(id: string, updates: Partial<Omit<WebhookEndpoint, 'id' | 'createdAt'>>): Promise<WebhookEndpoint | null> {
    const existing = this.endpoints.get(id);
    if (!existing) {
      return null;
    }

    // Validate URL if being updated
    if (updates.url && this.options.validateUrls) {
      await this.validateWebhookUrl(updates.url);
    }

    // Validate events if being updated
    if (updates.events) {
      this.validateEvents(updates.events);
    }

    const updated: WebhookEndpoint = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date()
    };

    this.endpoints.set(id, updated);
    this.emit('endpoint.updated', updated);

    // Persist if configured
    if (this.options.persistentStorage) {
      await this.persistToStorage();
    }

    return updated;
  }

  /**
   * Unregister a webhook endpoint
   */
  async unregister(id: string): Promise<boolean> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      return false;
    }

    this.endpoints.delete(id);
    this.emit('endpoint.unregistered', endpoint);

    // Remove from storage if configured
    if (this.options.persistentStorage && this.options.storageAdapter) {
      await this.options.storageAdapter.delete(id);
    }

    return true;
  }

  /**
   * Get all registered endpoints
   */
  getEndpoints(filters?: {
    active?: boolean;
    event?: WebhookEvent;
    integration?: string;
  }): WebhookEndpoint[] {
    let endpoints = Array.from(this.endpoints.values());

    if (filters) {
      if (filters.active !== undefined) {
        endpoints = endpoints.filter(e => e.active === filters.active);
      }

      if (filters.event) {
        endpoints = endpoints.filter(e => 
          e.events.length === 0 || e.events.includes(filters.event!)
        );
      }

      if (filters.integration) {
        endpoints = endpoints.filter(e => e.integration === filters.integration);
      }
    }

    return endpoints;
  }

  /**
   * Get a specific endpoint by ID
   */
  getEndpoint(id: string): WebhookEndpoint | null {
    return this.endpoints.get(id) || null;
  }

  /**
   * Get endpoints for a specific event
   */
  getEndpointsForEvent(event: WebhookEvent): WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter(endpoint => 
      endpoint.active && (endpoint.events.length === 0 || endpoint.events.includes(event))
    );
  }

  /**
   * Register a webhook template
   */
  registerTemplate(template: WebhookTemplate): void {
    this.templates.set(template.id, template);
    this.emit('template.registered', template);
  }

  /**
   * Get all available templates
   */
  getTemplates(): WebhookTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(id: string): WebhookTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Create endpoint from template
   */
  async createFromTemplate(templateId: string, config: {
    url: string;
    name: string;
    secret?: string;
    events?: WebhookEvent[];
    headers?: Record<string, string>;
    filters?: Record<string, any>;
  }): Promise<WebhookEndpoint | null> {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    const endpointConfig: Omit<WebhookEndpoint, 'id' | 'createdAt' | 'updatedAt'> = {
      ...config,
      integration: template.integration,
      events: config.events || template.defaultEvents,
      headers: { ...template.defaultHeaders, ...config.headers },
      payloadFields: template.defaultPayloadFields,
      filters: { ...template.defaultFilters, ...config.filters },
      active: true
    };

    return this.register(endpointConfig);
  }

  /**
   * Register a webhook integration
   */
  registerIntegration(integration: WebhookIntegration): void {
    this.integrations.set(integration.id, integration);
    this.emit('integration.registered', integration);
  }

  /**
   * Get all available integrations
   */
  getIntegrations(): WebhookIntegration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Get a specific integration by ID
   */
  getIntegration(id: string): WebhookIntegration | null {
    return this.integrations.get(id) || null;
  }

  /**
   * Validate webhook URL
   */
  private async validateWebhookUrl(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Webhook URL must use HTTP or HTTPS protocol');
      }

      // Check for localhost/private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname.toLowerCase();
        if (
          hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')
        ) {
          throw new Error('Private/localhost URLs not allowed in production');
        }
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid webhook URL format');
      }
      throw error;
    }
  }

  /**
   * Validate webhook events
   */
  private validateEvents(events: WebhookEvent[]): void {
    const validEvents: WebhookEvent[] = [
      'session.started',
      'session.completed',
      'session.failed',
      'agent.message',
      'performance.alert',
      'anomaly.detected',
      'user.login',
      'cost.threshold',
      'webhook.test'
    ];

    for (const event of events) {
      if (!validEvents.includes(event)) {
        throw new Error(`Invalid webhook event: ${event}`);
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load endpoints from storage
   */
  private async loadFromStorage(): Promise<void> {
    if (!this.options.storageAdapter) {
      return;
    }

    try {
      const endpoints = await this.options.storageAdapter.load();
      for (const endpoint of endpoints) {
        this.endpoints.set(endpoint.id, endpoint);
      }
      this.emit('endpoints.loaded', endpoints);
    } catch (error) {
      console.error('Failed to load webhook endpoints from storage:', error);
    }
  }

  /**
   * Persist endpoints to storage
   */
  private async persistToStorage(): Promise<void> {
    if (!this.options.storageAdapter) {
      return;
    }

    try {
      const endpoints = Array.from(this.endpoints.values());
      await this.options.storageAdapter.save(endpoints);
    } catch (error) {
      console.error('Failed to persist webhook endpoints to storage:', error);
    }
  }

  /**
   * Initialize built-in webhook templates
   */
  private initializeBuiltInTemplates(): void {
    // Slack template
    this.registerTemplate({
      id: 'slack',
      name: 'Slack Webhook',
      description: 'Send notifications to Slack channels via incoming webhooks',
      integration: 'slack',
      defaultEvents: ['session.completed', 'session.failed', 'performance.alert'],
      defaultHeaders: {
        'Content-Type': 'application/json'
      },
      defaultPayloadFields: ['message', 'timestamp', 'event'],
      defaultFilters: {},
      configSchema: {
        channel: { type: 'string', required: true, description: 'Slack channel name' },
        username: { type: 'string', required: false, description: 'Bot username' },
        icon_emoji: { type: 'string', required: false, description: 'Bot icon emoji' }
      }
    });

    // Discord template
    this.registerTemplate({
      id: 'discord',
      name: 'Discord Webhook',
      description: 'Send messages to Discord channels via webhooks',
      integration: 'discord',
      defaultEvents: ['session.completed', 'session.failed', 'anomaly.detected'],
      defaultHeaders: {
        'Content-Type': 'application/json'
      },
      defaultPayloadFields: ['message', 'timestamp', 'event'],
      defaultFilters: {},
      configSchema: {
        username: { type: 'string', required: false, description: 'Bot username' },
        avatar_url: { type: 'string', required: false, description: 'Bot avatar URL' }
      }
    });

    // Generic HTTP template
    this.registerTemplate({
      id: 'http',
      name: 'Generic HTTP Webhook',
      description: 'Send HTTP POST requests to any endpoint',
      integration: 'http',
      defaultEvents: [],
      defaultHeaders: {
        'Content-Type': 'application/json'
      },
      defaultPayloadFields: [],
      defaultFilters: {},
      configSchema: {
        method: { type: 'string', required: false, description: 'HTTP method (default: POST)' },
        timeout: { type: 'number', required: false, description: 'Request timeout in ms' }
      }
    });

    // Email template
    this.registerTemplate({
      id: 'email',
      name: 'Email Notification',
      description: 'Send email notifications via SMTP',
      integration: 'email',
      defaultEvents: ['session.failed', 'performance.alert', 'cost.threshold'],
      defaultHeaders: {},
      defaultPayloadFields: ['subject', 'message', 'timestamp'],
      defaultFilters: {},
      configSchema: {
        to: { type: 'string', required: true, description: 'Recipient email address' },
        subject: { type: 'string', required: false, description: 'Email subject template' }
      }
    });

    // Jira template
    this.registerTemplate({
      id: 'jira',
      name: 'Jira Issue Creation',
      description: 'Create Jira issues for alerts and failures',
      integration: 'jira',
      defaultEvents: ['session.failed', 'performance.alert'],
      defaultHeaders: {
        'Content-Type': 'application/json'
      },
      defaultPayloadFields: ['summary', 'description', 'priority'],
      defaultFilters: {},
      configSchema: {
        project: { type: 'string', required: true, description: 'Jira project key' },
        issueType: { type: 'string', required: true, description: 'Issue type (e.g., Bug, Task)' },
        priority: { type: 'string', required: false, description: 'Issue priority' }
      }
    });

    // PagerDuty template
    this.registerTemplate({
      id: 'pagerduty',
      name: 'PagerDuty Alert',
      description: 'Trigger PagerDuty incidents for critical alerts',
      integration: 'pagerduty',
      defaultEvents: ['session.failed', 'performance.alert', 'anomaly.detected'],
      defaultHeaders: {
        'Content-Type': 'application/json'
      },
      defaultPayloadFields: ['summary', 'severity', 'timestamp'],
      defaultFilters: {},
      configSchema: {
        routing_key: { type: 'string', required: true, description: 'PagerDuty integration key' },
        severity: { type: 'string', required: false, description: 'Alert severity level' }
      }
    });
  }

  /**
   * Initialize built-in integrations
   */
  private initializeBuiltInIntegrations(): void {
    this.registerIntegration({
      id: 'slack',
      name: 'Slack',
      description: 'Integration with Slack for team notifications',
      iconUrl: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/slack.svg',
      category: 'communication',
      setupInstructions: [
        'Create a new Slack app or use an existing one',
        'Enable incoming webhooks for your app',
        'Create a webhook URL for the desired channel',
        'Copy the webhook URL and paste it in the URL field'
      ],
      configFields: [
        { name: 'channel', type: 'string', required: true, description: 'Target Slack channel' },
        { name: 'username', type: 'string', required: false, description: 'Bot display name' }
      ]
    });

    this.registerIntegration({
      id: 'discord',
      name: 'Discord',
      description: 'Integration with Discord for server notifications',
      iconUrl: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/discord.svg',
      category: 'communication',
      setupInstructions: [
        'Go to your Discord server settings',
        'Navigate to Integrations > Webhooks',
        'Create a new webhook or edit an existing one',
        'Copy the webhook URL and paste it in the URL field'
      ],
      configFields: [
        { name: 'username', type: 'string', required: false, description: 'Bot display name' },
        { name: 'avatar_url', type: 'string', required: false, description: 'Bot avatar URL' }
      ]
    });

    this.registerIntegration({
      id: 'email',
      name: 'Email',
      description: 'Send email notifications via SMTP',
      iconUrl: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/mail.svg',
      category: 'communication',
      setupInstructions: [
        'Configure your SMTP server settings',
        'Use a dedicated email service webhook endpoint',
        'Set up authentication credentials if required'
      ],
      configFields: [
        { name: 'to', type: 'string', required: true, description: 'Recipient email' },
        { name: 'from', type: 'string', required: false, description: 'Sender email' }
      ]
    });

    this.registerIntegration({
      id: 'jira',
      name: 'Jira',
      description: 'Create and update Jira issues',
      iconUrl: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/jira.svg',
      category: 'project-management',
      setupInstructions: [
        'Set up Jira webhook in your project settings',
        'Create an API token for authentication',
        'Configure the webhook endpoint URL'
      ],
      configFields: [
        { name: 'project', type: 'string', required: true, description: 'Jira project key' },
        { name: 'issueType', type: 'string', required: true, description: 'Default issue type' }
      ]
    });

    this.registerIntegration({
      id: 'github',
      name: 'GitHub',
      description: 'Create issues and update repositories',
      iconUrl: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/github.svg',
      category: 'development',
      setupInstructions: [
        'Go to your repository settings',
        'Navigate to Webhooks section',
        'Add a new webhook with your endpoint URL',
        'Select the events you want to receive'
      ],
      configFields: [
        { name: 'repository', type: 'string', required: true, description: 'Repository name (owner/repo)' },
        { name: 'token', type: 'string', required: true, description: 'GitHub personal access token' }
      ]
    });

    this.registerIntegration({
      id: 'pagerduty',
      name: 'PagerDuty',
      description: 'Create and manage PagerDuty incidents',
      iconUrl: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/pagerduty.svg',
      category: 'monitoring',
      setupInstructions: [
        'Create a new integration in PagerDuty',
        'Select "Events API v2" as integration type',
        'Copy the integration key',
        'Use the PagerDuty Events API endpoint'
      ],
      configFields: [
        { name: 'routing_key', type: 'string', required: true, description: 'PagerDuty integration key' },
        { name: 'severity', type: 'select', required: false, description: 'Default severity level' }
      ]
    });
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalEndpoints: number;
    activeEndpoints: number;
    endpointsByIntegration: Record<string, number>;
    endpointsByEvent: Record<string, number>;
  } {
    const endpoints = Array.from(this.endpoints.values());
    
    const endpointsByIntegration: Record<string, number> = {};
    const endpointsByEvent: Record<string, number> = {};

    for (const endpoint of endpoints) {
      // Count by integration
      const integration = endpoint.integration || 'unknown';
      endpointsByIntegration[integration] = (endpointsByIntegration[integration] || 0) + 1;

      // Count by events
      for (const event of endpoint.events) {
        endpointsByEvent[event] = (endpointsByEvent[event] || 0) + 1;
      }
    }

    return {
      totalEndpoints: endpoints.length,
      activeEndpoints: endpoints.filter(e => e.active).length,
      endpointsByIntegration,
      endpointsByEvent
    };
  }
}