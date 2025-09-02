/**
 * Authentication Module for Automatic Claude Code
 * Provides OAuth token extraction and management for Claude subscription authentication
 */

export {
  OAuthTokenExtractor,
  tokenExtractor,
  extractOAuthToken,
  validateToken,
  type OAuthExtractionResult,
  type OAuthCredentials,
  type TokenValidationResult
} from './tokenExtractor';