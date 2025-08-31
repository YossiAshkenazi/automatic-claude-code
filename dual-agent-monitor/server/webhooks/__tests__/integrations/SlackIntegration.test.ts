import { SlackIntegration } from '../../integrations/SlackIntegration';
import type { WebhookEventPayload } from '../../../types';

describe('SlackIntegration', () => {
  describe('transformPayload', () => {
    test('should transform session.started event', () => {
      const payload: WebhookEventPayload = {
        sessionId: 'sess_123',
        session: {
          id: 'sess_123',
          initialTask: 'Create a React component',
          startTime: new Date().toISOString(),
          status: 'running',
          workDir: '/workspace'
        } as any
      };

      const slackMessage = SlackIntegration.transformPayload('session.started', payload);

      expect(slackMessage).toBeDefined();
      expect(slackMessage.text).toContain('New Dual-Agent Session Started');
      expect(slackMessage.username).toBe('Dual-Agent Monitor');
      expect(slackMessage.icon_emoji).toBe(':robot_face:');
      expect(slackMessage.attachments).toBeDefined();
      expect(slackMessage.attachments![0].color).toBe('good');
      
      const fields = slackMessage.attachments![0].fields!;
      expect(fields.find(f => f.title === 'Session ID')?.value).toBe('sess_123');
      expect(fields.find(f => f.title === 'Initial Task')?.value).toBe('Create a React component');
    });

    test('should transform session.completed event', () => {
      const payload: WebhookEventPayload = {
        sessionId: 'sess_123',
        session: {
          id: 'sess_123',
          initialTask: 'Create a React component',
          startTime: new Date(Date.now() - 300000).toISOString(),
          endTime: new Date().toISOString(),
          status: 'completed',
          summary: {
            totalMessages: 15,
            totalDuration: 300000,
            filesModified: ['src/Component.tsx', 'src/index.ts'],
            successRate: 0.95
          }
        } as any
      };

      const slackMessage = SlackIntegration.transformPayload('session.completed', payload);

      expect(slackMessage.text).toContain('Session Completed Successfully');
      expect(slackMessage.attachments![0].color).toBe('good');
      
      const fields = slackMessage.attachments![0].fields!;
      expect(fields.find(f => f.title === 'Duration')?.value).toBe('300s');
      expect(fields.find(f => f.title === 'Messages')?.value).toBe('15');
      expect(fields.find(f => f.title === 'Files Modified')?.value).toBe('2');
      expect(fields.find(f => f.title === 'Success Rate')?.value).toBe('95%');
    });

    test('should transform session.failed event', () => {
      const payload: WebhookEventPayload = {
        sessionId: 'sess_123',
        session: {
          id: 'sess_123',
          initialTask: 'Create a React component',
          status: 'failed'
        } as any,
        alert: {
          type: 'session_failure',
          severity: 'high',
          message: 'Build process failed',
          details: { error: 'TypeScript compilation errors' }
        }
      };

      const slackMessage = SlackIntegration.transformPayload('session.failed', payload);

      expect(slackMessage.text).toContain('Session Failed');
      expect(slackMessage.attachments![0].color).toBe('danger');
      
      const fields = slackMessage.attachments![0].fields!;
      expect(fields.find(f => f.title === 'Error')?.value).toBe('Build process failed');
      expect(fields.find(f => f.title === 'Severity')?.value).toBe('high');
    });

    test('should transform agent.message event', () => {
      const payload: WebhookEventPayload = {
        sessionId: 'sess_123',
        agentType: 'manager',
        message: {
          id: 'msg_456',
          sessionId: 'sess_123',
          agentType: 'manager',
          messageType: 'response',
          content: 'I have analyzed the requirements and created a plan.',
          timestamp: new Date(),
          metadata: {
            tools: ['Read', 'Write'],
            duration: 2500
          }
        } as any
      };

      const slackMessage = SlackIntegration.transformPayload('agent.message', payload);

      expect(slackMessage.text).toContain('Manager Agent Message');
      expect(slackMessage.attachments![0].color).toBe('#2196F3');
      
      const fields = slackMessage.attachments![0].fields!;
      expect(fields.find(f => f.title === 'Agent Type')?.value).toBe('manager');
      expect(fields.find(f => f.title === 'Content')?.value).toContain('analyzed the requirements');
    });

    test('should transform performance.alert event with different severities', () => {
      const testCases = [
        { severity: 'low', expectedEmoji: '⚡', expectedColor: 'warning' },
        { severity: 'medium', expectedEmoji: '⚠️', expectedColor: 'warning' },
        { severity: 'high', expectedEmoji: '🚨', expectedColor: 'danger' },
        { severity: 'critical', expectedEmoji: '🆘', expectedColor: 'danger' }
      ];

      testCases.forEach(({ severity, expectedEmoji, expectedColor }) => {
        const payload: WebhookEventPayload = {
          sessionId: 'sess_123',
          alert: {
            type: 'high_response_time',
            severity: severity as any,
            message: `Response time exceeded threshold`,
            details: { threshold: 5000, actual: 8000 }
          }
        };

        const slackMessage = SlackIntegration.transformPayload('performance.alert', payload);

        expect(slackMessage.text).toContain(expectedEmoji);
        expect(slackMessage.text).toContain('Performance Alert');
        expect(slackMessage.attachments![0].color).toBe(expectedColor);
        
        const fields = slackMessage.attachments![0].fields!;
        expect(fields.find(f => f.title === 'Severity')?.value).toBe(severity.toUpperCase());
      });
    });

    test('should transform cost.threshold event', () => {
      const payload: WebhookEventPayload = {
        cost: {
          current: 125.50,
          threshold: 100.00,
          period: 'monthly'
        },
        alert: {
          type: 'cost_threshold',
          severity: 'medium',
          message: 'Monthly cost threshold exceeded',
          details: { overageAmount: 25.50 }
        }
      };

      const slackMessage = SlackIntegration.transformPayload('cost.threshold', payload);

      expect(slackMessage.text).toContain('Cost Threshold Alert');
      expect(slackMessage.attachments![0].color).toBe('warning');
      
      const fields = slackMessage.attachments![0].fields!;
      expect(fields.find(f => f.title === 'Current Cost')?.value).toBe('$125.50');
      expect(fields.find(f => f.title === 'Threshold')?.value).toBe('$100.00');
      expect(fields.find(f => f.title === 'Period')?.value).toBe('monthly');
    });

    test('should transform webhook.test event', () => {
      const payload: WebhookEventPayload = {
        message: 'This is a test webhook',
        test: true
      } as any;

      const slackMessage = SlackIntegration.transformPayload('webhook.test', payload);

      expect(slackMessage.text).toContain('Webhook Test');
      expect(slackMessage.attachments![0].color).toBe('good');
      
      const fields = slackMessage.attachments![0].fields!;
      expect(fields.find(f => f.title === 'Test Status')?.value).toBe('Success');
      expect(fields.find(f => f.title === 'Message')?.value).toContain('test webhook delivery');
    });

    test('should handle unknown events gracefully', () => {
      const payload: WebhookEventPayload = {
        sessionId: 'sess_123',
        customData: 'test'
      } as any;

      const slackMessage = SlackIntegration.transformPayload('unknown.event' as any, payload);

      expect(slackMessage.text).toContain('Webhook Event: unknown.event');
      expect(slackMessage.attachments![0].color).toBe('good');
    });

    test('should handle missing data gracefully', () => {
      const payload: WebhookEventPayload = {};

      const slackMessage = SlackIntegration.transformPayload('session.started', payload);

      expect(slackMessage.text).toContain('New Dual-Agent Session Started');
      
      const fields = slackMessage.attachments![0].fields!;
      expect(fields.find(f => f.title === 'Session ID')?.value).toBe('Unknown');
      expect(fields.find(f => f.title === 'Initial Task')?.value).toBe('Not specified');
    });
  });

  describe('transformToBlocks', () => {
    test('should create blocks format for session.started', () => {
      const payload: WebhookEventPayload = {
        sessionId: 'sess_123',
        session: {
          id: 'sess_123',
          initialTask: 'Create a React component',
          status: 'running'
        } as any
      };

      const blocks = SlackIntegration.transformToBlocks('session.started', payload);

      expect(blocks).toHaveLength(3); // header, section, divider
      expect(blocks[0].type).toBe('header');
      expect(blocks[0].text.text).toContain('session.started');
      expect(blocks[1].type).toBe('section');
      expect(blocks[1].text.text).toContain('New dual-agent session started');
      expect(blocks[2].type).toBe('divider');
    });

    test('should create blocks format for session.completed', () => {
      const payload: WebhookEventPayload = {
        sessionId: 'sess_123',
        session: {
          id: 'sess_123',
          initialTask: 'Create a React component',
          summary: {
            totalDuration: 300000,
            totalMessages: 15,
            filesModified: ['src/Component.tsx'],
            successRate: 0.95
          }
        } as any
      };

      const blocks = SlackIntegration.transformToBlocks('session.completed', payload);

      expect(blocks).toHaveLength(4); // header, section, section with fields, divider
      expect(blocks[1].text.text).toContain('Session completed successfully');
      expect(blocks[2].fields).toBeDefined();
      expect(blocks[2].fields).toHaveLength(4);
    });

    test('should create blocks format for unknown events', () => {
      const payload: WebhookEventPayload = { test: true } as any;

      const blocks = SlackIntegration.transformToBlocks('unknown.event' as any, payload);

      expect(blocks).toHaveLength(3);
      expect(blocks[1].text.text).toContain('Event received: unknown.event');
    });
  });

  describe('validateConfig', () => {
    test('should validate correct Slack webhook URL', () => {
      const config = {
        url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
        channel: '#general'
      };

      const result = SlackIntegration.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid webhook URL', () => {
      const config = {
        url: 'https://example.com/webhook',
        channel: '#general'
      };

      const result = SlackIntegration.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid Slack webhook URL');
    });

    test('should validate channel format', () => {
      const validConfigs = [
        { url: 'https://hooks.slack.com/services/T/B/X', channel: '#general' },
        { url: 'https://hooks.slack.com/services/T/B/X', channel: '@user' }
      ];

      validConfigs.forEach(config => {
        const result = SlackIntegration.validateConfig(config);
        expect(result.valid).toBe(true);
      });

      const invalidConfig = {
        url: 'https://hooks.slack.com/services/T/B/X',
        channel: 'general' // Missing # or @
      };

      const result = SlackIntegration.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Channel must start with # for channels or @ for users');
    });
  });

  describe('getRecommendedConfig', () => {
    test('should return recommended configuration', () => {
      const config = SlackIntegration.getRecommendedConfig();

      expect(config).toHaveProperty('headers');
      expect(config.headers['Content-Type']).toBe('application/json');
      expect(config).toHaveProperty('events');
      expect(config.events).toContain('session.started');
      expect(config.events).toContain('session.completed');
      expect(config.events).toContain('session.failed');
      expect(config.events).toContain('performance.alert');
      expect(config).toHaveProperty('payloadFields');
      expect(config).toHaveProperty('rateLimitPerMinute');
      expect(config.rateLimitPerMinute).toBe(1);
    });
  });
});