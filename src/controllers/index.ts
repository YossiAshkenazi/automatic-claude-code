/**
 * Controllers Module Export
 * 
 * Provides interactive control interfaces for external processes
 * and services, with focus on Claude Code integration.
 */

import { ClaudeCodeController } from './claudeCodeController';

export { 
  ClaudeCodeController, 
  type ClaudeCodeControllerOptions,
  type ClaudeCodeResponse,
  type ClaudeCodeEvent
} from './claudeCodeController';

// Export examples for usage reference
export * from './claudeCodeController.example';

export default {
  ClaudeCodeController: ClaudeCodeController
};