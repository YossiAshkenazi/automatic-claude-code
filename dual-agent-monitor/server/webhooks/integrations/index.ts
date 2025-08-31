export { SlackIntegration } from './SlackIntegration.js';
export { DiscordIntegration } from './DiscordIntegration.js';
export { EmailIntegration } from './EmailIntegration.js';

export type { SlackMessage, SlackAttachment, SlackField } from './SlackIntegration.js';
export type { DiscordMessage, DiscordEmbed } from './DiscordIntegration.js';
export type { EmailMessage, EmailAttachment } from './EmailIntegration.js';

import { SlackIntegration } from './SlackIntegration.js';
import { DiscordIntegration } from './DiscordIntegration.js';
import { EmailIntegration } from './EmailIntegration.js';
import type { WebhookEvent, WebhookEventPayload } from '../../types.js';

/**
 * Integration registry for webhook payload transformations
 */
export class IntegrationRegistry {
  private static integrations = new Map([
    ['slack', SlackIntegration],
    ['discord', DiscordIntegration],
    ['email', EmailIntegration],
  ]);

  /**
   * Get integration by type
   */
  static getIntegration(type: string) {
    return this.integrations.get(type.toLowerCase());
  }

  /**
   * Transform payload for specific integration
   */
  static transformPayload(
    integrationType: string, 
    event: WebhookEvent, 
    payload: WebhookEventPayload, 
    config?: any
  ): any {
    const integration = this.getIntegration(integrationType);
    if (!integration || !integration.transformPayload) {
      return payload; // Return original if no transformation available
    }

    try {
      return integration.transformPayload(event, payload, config);
    } catch (error) {
      console.error(`Failed to transform payload for ${integrationType}:`, error);
      return payload; // Fallback to original payload
    }
  }

  /**
   * Validate integration configuration
   */
  static validateConfig(integrationType: string, config: any): { valid: boolean; errors: string[] } {
    const integration = this.getIntegration(integrationType);
    if (!integration || !integration.validateConfig) {
      return { valid: true, errors: [] }; // No validation available
    }

    try {
      return integration.validateConfig(config);
    } catch (error) {
      return {
        valid: false,
        errors: [`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get recommended configuration for integration
   */
  static getRecommendedConfig(integrationType: string): any {
    const integration = this.getIntegration(integrationType);
    if (!integration || !integration.getRecommendedConfig) {
      return {};
    }

    try {
      return integration.getRecommendedConfig();
    } catch (error) {
      console.error(`Failed to get recommended config for ${integrationType}:`, error);
      return {};
    }
  }

  /**
   * Register a new integration
   */
  static registerIntegration(type: string, integration: any) {
    this.integrations.set(type.toLowerCase(), integration);
  }

  /**
   * Get all available integrations
   */
  static getAvailableIntegrations(): string[] {
    return Array.from(this.integrations.keys());
  }

  /**
   * Check if integration is available
   */
  static hasIntegration(type: string): boolean {
    return this.integrations.has(type.toLowerCase());
  }
}