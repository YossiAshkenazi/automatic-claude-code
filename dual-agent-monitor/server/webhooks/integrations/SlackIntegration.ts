import { WebhookEventPayload, WebhookEvent } from '../../types.js';

export interface SlackMessage {
  text?: string;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  channel?: string;
  attachments?: SlackAttachment[];
  blocks?: any[];
  thread_ts?: string;
  reply_broadcast?: boolean;
}

export interface SlackAttachment {
  fallback?: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: SlackField[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

export interface SlackField {
  title: string;
  value: string;
  short?: boolean;
}

export class SlackIntegration {
  /**
   * Transform webhook event payload to Slack message format
   */
  static transformPayload(event: WebhookEvent, payload: WebhookEventPayload): SlackMessage {
    const baseMessage: SlackMessage = {
      username: 'Dual-Agent Monitor',
      icon_emoji: ':robot_face:',
    };

    switch (event) {
      case 'session.started':
        return {
          ...baseMessage,
          text: '🚀 *New Dual-Agent Session Started*',
          attachments: [{
            color: 'good',
            fields: [
              {
                title: 'Session ID',
                value: payload.sessionId || 'Unknown',
                short: true
              },
              {
                title: 'Initial Task',
                value: payload.session?.initialTask || 'Not specified',
                short: false
              },
              {
                title: 'Started At',
                value: new Date().toLocaleString(),
                short: true
              },
              {
                title: 'Status',
                value: payload.session?.status || 'running',
                short: true
              }
            ]
          }]
        };

      case 'session.completed':
        const summary = payload.session?.summary;
        return {
          ...baseMessage,
          text: '✅ *Dual-Agent Session Completed Successfully*',
          attachments: [{
            color: 'good',
            fields: [
              {
                title: 'Session ID',
                value: payload.sessionId || 'Unknown',
                short: true
              },
              {
                title: 'Task',
                value: payload.session?.initialTask || 'Not specified',
                short: false
              },
              {
                title: 'Duration',
                value: summary?.totalDuration ? `${Math.round(summary.totalDuration / 1000)}s` : 'Unknown',
                short: true
              },
              {
                title: 'Messages',
                value: summary?.totalMessages?.toString() || '0',
                short: true
              },
              {
                title: 'Files Modified',
                value: summary?.filesModified?.length?.toString() || '0',
                short: true
              },
              {
                title: 'Success Rate',
                value: summary?.successRate ? `${Math.round(summary.successRate * 100)}%` : 'Unknown',
                short: true
              }
            ]
          }]
        };

      case 'session.failed':
        return {
          ...baseMessage,
          text: '❌ *Dual-Agent Session Failed*',
          attachments: [{
            color: 'danger',
            fields: [
              {
                title: 'Session ID',
                value: payload.sessionId || 'Unknown',
                short: true
              },
              {
                title: 'Task',
                value: payload.session?.initialTask || 'Not specified',
                short: false
              },
              {
                title: 'Error',
                value: payload.alert?.message || 'Unknown error',
                short: false
              },
              {
                title: 'Severity',
                value: payload.alert?.severity || 'unknown',
                short: true
              },
              {
                title: 'Failed At',
                value: new Date().toLocaleString(),
                short: true
              }
            ]
          }]
        };

      case 'agent.message':
        const agentEmoji = payload.agentType === 'manager' ? '👨‍💼' : '🔧';
        const agentName = payload.agentType === 'manager' ? 'Manager Agent' : 'Worker Agent';
        return {
          ...baseMessage,
          text: `${agentEmoji} *${agentName} Message*`,
          attachments: [{
            color: payload.agentType === 'manager' ? '#2196F3' : '#FF9800',
            fields: [
              {
                title: 'Session ID',
                value: payload.sessionId || 'Unknown',
                short: true
              },
              {
                title: 'Agent Type',
                value: payload.agentType || 'unknown',
                short: true
              },
              {
                title: 'Message Type',
                value: payload.message?.messageType || 'unknown',
                short: true
              },
              {
                title: 'Content',
                value: payload.message?.content?.substring(0, 500) + (payload.message?.content && payload.message.content.length > 500 ? '...' : '') || 'No content',
                short: false
              }
            ]
          }]
        };

      case 'performance.alert':
        const severityColors = {
          low: 'warning',
          medium: 'warning',
          high: 'danger',
          critical: 'danger'
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
          text: `${severityEmojis[severity as keyof typeof severityEmojis]} *Performance Alert*`,
          attachments: [{
            color: severityColors[severity as keyof typeof severityColors],
            fields: [
              {
                title: 'Alert Type',
                value: payload.alert?.type || 'Unknown',
                short: true
              },
              {
                title: 'Severity',
                value: severity.toUpperCase(),
                short: true
              },
              {
                title: 'Session ID',
                value: payload.sessionId || 'N/A',
                short: true
              },
              {
                title: 'Message',
                value: payload.alert?.message || 'No details available',
                short: false
              }
            ]
          }]
        };

      case 'anomaly.detected':
        return {
          ...baseMessage,
          text: '🔍 *Anomaly Detected*',
          attachments: [{
            color: 'warning',
            fields: [
              {
                title: 'Anomaly Type',
                value: payload.anomaly?.type || 'Unknown',
                short: true
              },
              {
                title: 'Confidence',
                value: payload.anomaly?.confidence ? `${Math.round(payload.anomaly.confidence * 100)}%` : 'Unknown',
                short: true
              },
              {
                title: 'Session ID',
                value: payload.sessionId || 'N/A',
                short: true
              },
              {
                title: 'Description',
                value: payload.anomaly?.description || 'No description available',
                short: false
              }
            ]
          }]
        };

      case 'cost.threshold':
        return {
          ...baseMessage,
          text: '💰 *Cost Threshold Alert*',
          attachments: [{
            color: 'warning',
            fields: [
              {
                title: 'Current Cost',
                value: payload.cost ? `$${payload.cost.current.toFixed(2)}` : 'Unknown',
                short: true
              },
              {
                title: 'Threshold',
                value: payload.cost ? `$${payload.cost.threshold.toFixed(2)}` : 'Unknown',
                short: true
              },
              {
                title: 'Period',
                value: payload.cost?.period || 'Unknown',
                short: true
              },
              {
                title: 'Overage',
                value: payload.cost ? `$${(payload.cost.current - payload.cost.threshold).toFixed(2)}` : 'Unknown',
                short: true
              },
              {
                title: 'Message',
                value: payload.alert?.message || 'Cost threshold has been exceeded',
                short: false
              }
            ]
          }]
        };

      case 'user.login':
        return {
          ...baseMessage,
          text: '👤 *User Login*',
          attachments: [{
            color: 'good',
            fields: [
              {
                title: 'User ID',
                value: payload.user?.id || 'Unknown',
                short: true
              },
              {
                title: 'Email',
                value: payload.user?.email || 'Unknown',
                short: true
              },
              {
                title: 'Login Time',
                value: payload.user?.timestamp ? new Date(payload.user.timestamp).toLocaleString() : new Date().toLocaleString(),
                short: false
              }
            ]
          }]
        };

      case 'webhook.test':
        return {
          ...baseMessage,
          text: '🧪 *Webhook Test*',
          attachments: [{
            color: 'good',
            fields: [
              {
                title: 'Test Status',
                value: 'Success',
                short: true
              },
              {
                title: 'Timestamp',
                value: new Date().toLocaleString(),
                short: true
              },
              {
                title: 'Message',
                value: 'This is a test webhook delivery from Dual-Agent Monitor',
                short: false
              }
            ]
          }]
        };

      default:
        return {
          ...baseMessage,
          text: `📢 *Webhook Event: ${event}*`,
          attachments: [{
            color: 'good',
            fields: [
              {
                title: 'Event Type',
                value: event,
                short: true
              },
              {
                title: 'Timestamp',
                value: new Date().toLocaleString(),
                short: true
              },
              {
                title: 'Data',
                value: JSON.stringify(payload, null, 2).substring(0, 1000),
                short: false
              }
            ]
          }]
        };
    }
  }

  /**
   * Create Slack blocks format (alternative to attachments)
   */
  static transformToBlocks(event: WebhookEvent, payload: WebhookEventPayload): any[] {
    const baseHeader = {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Dual-Agent Monitor - ${event}`,
        emoji: true
      }
    };

    const divider = { type: 'divider' };

    switch (event) {
      case 'session.started':
        return [
          baseHeader,
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🚀 *New dual-agent session started*\n*Task:* ${payload.session?.initialTask || 'Not specified'}\n*Session ID:* ${payload.sessionId}`
            }
          },
          divider
        ];

      case 'session.completed':
        const summary = payload.session?.summary;
        return [
          baseHeader,
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Session completed successfully*\n*Task:* ${payload.session?.initialTask || 'Not specified'}`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Duration:*\n${summary?.totalDuration ? Math.round(summary.totalDuration / 1000) + 's' : 'Unknown'}`
              },
              {
                type: 'mrkdwn',
                text: `*Messages:*\n${summary?.totalMessages || 0}`
              },
              {
                type: 'mrkdwn',
                text: `*Files Modified:*\n${summary?.filesModified?.length || 0}`
              },
              {
                type: 'mrkdwn',
                text: `*Success Rate:*\n${summary?.successRate ? Math.round(summary.successRate * 100) + '%' : 'Unknown'}`
              }
            ]
          },
          divider
        ];

      case 'session.failed':
        return [
          baseHeader,
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `❌ *Session failed*\n*Task:* ${payload.session?.initialTask || 'Not specified'}\n*Error:* ${payload.alert?.message || 'Unknown error'}`
            }
          },
          divider
        ];

      default:
        return [
          baseHeader,
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Event received: ${event}`
            }
          },
          divider
        ];
    }
  }

  /**
   * Validate Slack webhook configuration
   */
  static validateConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.url || !config.url.includes('hooks.slack.com')) {
      errors.push('Invalid Slack webhook URL');
    }

    if (config.channel && !config.channel.startsWith('#') && !config.channel.startsWith('@')) {
      errors.push('Channel must start with # for channels or @ for users');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get recommended configuration for Slack
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
        'performance.alert'
      ],
      payloadFields: ['text', 'username', 'icon_emoji', 'attachments', 'blocks'],
      rateLimitPerMinute: 1 // Slack rate limit
    };
  }
}