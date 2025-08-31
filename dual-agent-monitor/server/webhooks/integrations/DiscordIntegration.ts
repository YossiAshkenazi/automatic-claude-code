import { WebhookEventPayload, WebhookEvent } from '../../types.js';

export interface DiscordMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  tts?: boolean;
  embeds?: DiscordEmbed[];
  allowed_mentions?: {
    parse?: ('roles' | 'users' | 'everyone')[];
    roles?: string[];
    users?: string[];
    replied_user?: boolean;
  };
  components?: any[];
}

export interface DiscordEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: {
    text: string;
    icon_url?: string;
    proxy_icon_url?: string;
  };
  image?: {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
  };
  thumbnail?: {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
  };
  video?: {
    url?: string;
    proxy_url?: string;
    height?: number;
    width?: number;
  };
  provider?: {
    name?: string;
    url?: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
    proxy_icon_url?: string;
  };
  fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
}

export class DiscordIntegration {
  // Discord color constants
  static readonly COLORS = {
    SUCCESS: 0x00ff00, // Green
    WARNING: 0xffaa00, // Orange
    ERROR: 0xff0000,   // Red
    INFO: 0x0099ff,    // Blue
    PURPLE: 0x9932cc,  // Purple
    YELLOW: 0xffff00,  // Yellow
  };

  /**
   * Transform webhook event payload to Discord message format
   */
  static transformPayload(event: WebhookEvent, payload: WebhookEventPayload): DiscordMessage {
    const baseMessage: DiscordMessage = {
      username: 'Dual-Agent Monitor',
      avatar_url: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/robot.svg',
    };

    switch (event) {
      case 'session.started':
        return {
          ...baseMessage,
          embeds: [{
            title: '🚀 New Dual-Agent Session Started',
            color: this.COLORS.SUCCESS,
            fields: [
              {
                name: 'Session ID',
                value: `\`${payload.sessionId || 'Unknown'}\``,
                inline: true
              },
              {
                name: 'Status',
                value: `\`${payload.session?.status || 'running'}\``,
                inline: true
              },
              {
                name: 'Started At',
                value: new Date().toLocaleString(),
                inline: true
              },
              {
                name: 'Initial Task',
                value: payload.session?.initialTask || 'Not specified',
                inline: false
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Dual-Agent Monitor',
              icon_url: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/monitoring.svg'
            }
          }]
        };

      case 'session.completed':
        const summary = payload.session?.summary;
        return {
          ...baseMessage,
          embeds: [{
            title: '✅ Dual-Agent Session Completed',
            color: this.COLORS.SUCCESS,
            description: `Task: ${payload.session?.initialTask || 'Not specified'}`,
            fields: [
              {
                name: 'Session ID',
                value: `\`${payload.sessionId || 'Unknown'}\``,
                inline: true
              },
              {
                name: 'Duration',
                value: summary?.totalDuration ? `${Math.round(summary.totalDuration / 1000)}s` : 'Unknown',
                inline: true
              },
              {
                name: 'Success Rate',
                value: summary?.successRate ? `${Math.round(summary.successRate * 100)}%` : 'Unknown',
                inline: true
              },
              {
                name: 'Total Messages',
                value: summary?.totalMessages?.toString() || '0',
                inline: true
              },
              {
                name: 'Files Modified',
                value: summary?.filesModified?.length?.toString() || '0',
                inline: true
              },
              {
                name: 'Commands Executed',
                value: summary?.commandsExecuted?.length?.toString() || '0',
                inline: true
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Dual-Agent Monitor'
            }
          }]
        };

      case 'session.failed':
        return {
          ...baseMessage,
          embeds: [{
            title: '❌ Dual-Agent Session Failed',
            color: this.COLORS.ERROR,
            description: `Task: ${payload.session?.initialTask || 'Not specified'}`,
            fields: [
              {
                name: 'Session ID',
                value: `\`${payload.sessionId || 'Unknown'}\``,
                inline: true
              },
              {
                name: 'Severity',
                value: payload.alert?.severity?.toUpperCase() || 'UNKNOWN',
                inline: true
              },
              {
                name: 'Failed At',
                value: new Date().toLocaleString(),
                inline: true
              },
              {
                name: 'Error Details',
                value: payload.alert?.message || 'Unknown error occurred',
                inline: false
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Dual-Agent Monitor'
            }
          }]
        };

      case 'agent.message':
        const agentEmoji = payload.agentType === 'manager' ? '👨‍💼' : '🔧';
        const agentColor = payload.agentType === 'manager' ? this.COLORS.INFO : this.COLORS.WARNING;
        const agentName = payload.agentType === 'manager' ? 'Manager Agent' : 'Worker Agent';
        
        return {
          ...baseMessage,
          embeds: [{
            title: `${agentEmoji} ${agentName} Message`,
            color: agentColor,
            fields: [
              {
                name: 'Session ID',
                value: `\`${payload.sessionId || 'Unknown'}\``,
                inline: true
              },
              {
                name: 'Message Type',
                value: `\`${payload.message?.messageType || 'unknown'}\``,
                inline: true
              },
              {
                name: 'Timestamp',
                value: new Date().toLocaleString(),
                inline: true
              },
              {
                name: 'Content',
                value: this.truncateText(payload.message?.content || 'No content', 1000),
                inline: false
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: `Dual-Agent Monitor • ${agentName}`
            }
          }]
        };

      case 'performance.alert':
        const severityColors = {
          low: this.COLORS.YELLOW,
          medium: this.COLORS.WARNING,
          high: this.COLORS.ERROR,
          critical: this.COLORS.ERROR
        };
        const severityEmojis = {
          low: '⚡',
          medium: '⚠️',
          high: '🚨',
          critical: '🆘'
        };
        const severity = payload.alert?.severity || 'medium';
        
        return {
          ...baseMessage,
          embeds: [{
            title: `${severityEmojis[severity as keyof typeof severityEmojis]} Performance Alert`,
            color: severityColors[severity as keyof typeof severityColors],
            fields: [
              {
                name: 'Alert Type',
                value: `\`${payload.alert?.type || 'Unknown'}\``,
                inline: true
              },
              {
                name: 'Severity',
                value: `**${severity.toUpperCase()}**`,
                inline: true
              },
              {
                name: 'Session ID',
                value: payload.sessionId ? `\`${payload.sessionId}\`` : 'N/A',
                inline: true
              },
              {
                name: 'Alert Message',
                value: payload.alert?.message || 'No details available',
                inline: false
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Dual-Agent Monitor • Performance Alert'
            }
          }]
        };

      case 'anomaly.detected':
        return {
          ...baseMessage,
          embeds: [{
            title: '🔍 Anomaly Detected',
            color: this.COLORS.WARNING,
            fields: [
              {
                name: 'Anomaly Type',
                value: `\`${payload.anomaly?.type || 'Unknown'}\``,
                inline: true
              },
              {
                name: 'Confidence',
                value: payload.anomaly?.confidence ? `**${Math.round(payload.anomaly.confidence * 100)}%**` : 'Unknown',
                inline: true
              },
              {
                name: 'Session ID',
                value: payload.sessionId ? `\`${payload.sessionId}\`` : 'N/A',
                inline: true
              },
              {
                name: 'Description',
                value: payload.anomaly?.description || 'No description available',
                inline: false
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Dual-Agent Monitor • Anomaly Detection'
            }
          }]
        };

      case 'cost.threshold':
        const overage = payload.cost ? payload.cost.current - payload.cost.threshold : 0;
        return {
          ...baseMessage,
          embeds: [{
            title: '💰 Cost Threshold Exceeded',
            color: this.COLORS.WARNING,
            fields: [
              {
                name: 'Current Cost',
                value: payload.cost ? `**$${payload.cost.current.toFixed(2)}**` : 'Unknown',
                inline: true
              },
              {
                name: 'Threshold',
                value: payload.cost ? `$${payload.cost.threshold.toFixed(2)}` : 'Unknown',
                inline: true
              },
              {
                name: 'Period',
                value: `\`${payload.cost?.period || 'Unknown'}\``,
                inline: true
              },
              {
                name: 'Overage Amount',
                value: overage > 0 ? `**+$${overage.toFixed(2)}**` : '$0.00',
                inline: true
              },
              {
                name: 'Percentage Over',
                value: payload.cost ? `**${Math.round((overage / payload.cost.threshold) * 100)}%**` : 'Unknown',
                inline: true
              },
              {
                name: 'Alert Time',
                value: new Date().toLocaleString(),
                inline: true
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Dual-Agent Monitor • Cost Monitoring'
            }
          }]
        };

      case 'user.login':
        return {
          ...baseMessage,
          embeds: [{
            title: '👤 User Login Event',
            color: this.COLORS.INFO,
            fields: [
              {
                name: 'User ID',
                value: `\`${payload.user?.id || 'Unknown'}\``,
                inline: true
              },
              {
                name: 'Email',
                value: payload.user?.email || 'Unknown',
                inline: true
              },
              {
                name: 'Login Time',
                value: payload.user?.timestamp ? new Date(payload.user.timestamp).toLocaleString() : new Date().toLocaleString(),
                inline: true
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Dual-Agent Monitor • Authentication'
            }
          }]
        };

      case 'webhook.test':
        return {
          ...baseMessage,
          embeds: [{
            title: '🧪 Webhook Test',
            color: this.COLORS.SUCCESS,
            description: 'This is a test webhook delivery from Dual-Agent Monitor',
            fields: [
              {
                name: 'Test Status',
                value: '**✅ Success**',
                inline: true
              },
              {
                name: 'Test Time',
                value: new Date().toLocaleString(),
                inline: true
              },
              {
                name: 'Integration',
                value: '`Discord Webhook`',
                inline: true
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Dual-Agent Monitor • Test Message'
            }
          }]
        };

      default:
        return {
          ...baseMessage,
          embeds: [{
            title: `📢 Webhook Event: ${event}`,
            color: this.COLORS.INFO,
            fields: [
              {
                name: 'Event Type',
                value: `\`${event}\``,
                inline: true
              },
              {
                name: 'Timestamp',
                value: new Date().toLocaleString(),
                inline: true
              },
              {
                name: 'Raw Data',
                value: `\`\`\`json\n${this.truncateText(JSON.stringify(payload, null, 2), 800)}\n\`\`\``,
                inline: false
              }
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Dual-Agent Monitor • Generic Event'
            }
          }]
        };
    }
  }

  /**
   * Create a simple text message format (alternative to embeds)
   */
  static transformToSimpleMessage(event: WebhookEvent, payload: WebhookEventPayload): DiscordMessage {
    const baseMessage: DiscordMessage = {
      username: 'Dual-Agent Monitor',
      avatar_url: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/robot.svg',
    };

    switch (event) {
      case 'session.started':
        return {
          ...baseMessage,
          content: `🚀 **New dual-agent session started**\n**Task:** ${payload.session?.initialTask || 'Not specified'}\n**Session ID:** \`${payload.sessionId}\``
        };

      case 'session.completed':
        const summary = payload.session?.summary;
        return {
          ...baseMessage,
          content: `✅ **Session completed successfully**\n**Task:** ${payload.session?.initialTask || 'Not specified'}\n**Duration:** ${summary?.totalDuration ? Math.round(summary.totalDuration / 1000) + 's' : 'Unknown'}\n**Success Rate:** ${summary?.successRate ? Math.round(summary.successRate * 100) + '%' : 'Unknown'}`
        };

      case 'session.failed':
        return {
          ...baseMessage,
          content: `❌ **Session failed**\n**Task:** ${payload.session?.initialTask || 'Not specified'}\n**Error:** ${payload.alert?.message || 'Unknown error'}`
        };

      default:
        return {
          ...baseMessage,
          content: `📢 **Webhook Event:** \`${event}\`\n**Time:** ${new Date().toLocaleString()}`
        };
    }
  }

  /**
   * Truncate text to fit Discord limits
   */
  private static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Validate Discord webhook configuration
   */
  static validateConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.url || !config.url.includes('discord.com/api/webhooks/')) {
      errors.push('Invalid Discord webhook URL');
    }

    if (config.username && config.username.length > 80) {
      errors.push('Username must be 80 characters or less');
    }

    if (config.avatar_url && !this.isValidUrl(config.avatar_url)) {
      errors.push('Avatar URL must be a valid URL');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate URL format
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get recommended configuration for Discord
   */
  static getRecommendedConfig() {
    return {
      headers: {
        'Content-Type': 'application/json'
      },
      events: [
        'session.started',
        'session.completed',
        'session.failed',
        'performance.alert',
        'anomaly.detected'
      ],
      payloadFields: ['content', 'username', 'avatar_url', 'embeds'],
      rateLimitPerMinute: 30 // Discord allows 30 requests per minute per webhook
    };
  }

  /**
   * Get Discord webhook limits
   */
  static getLimits() {
    return {
      contentMaxLength: 2000,
      embedTitleMaxLength: 256,
      embedDescriptionMaxLength: 4096,
      embedFieldNameMaxLength: 256,
      embedFieldValueMaxLength: 1024,
      embedFooterMaxLength: 2048,
      embedAuthorMaxLength: 256,
      maxEmbeds: 10,
      maxEmbedFields: 25,
      rateLimitPerMinute: 30
    };
  }
}