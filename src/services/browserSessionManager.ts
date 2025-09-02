// DEPRECATED: Browser Session Manager removed in SDK-only architecture (Story 1.4)
// This file has been deprecated and is no longer used.
// The SDK handles browser authentication internally - no manual session management needed.
// 
// Migration: Browser authentication is now handled transparently by the Claude SDK.

export interface BrowserSession {
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';
  isActive: boolean;
  claudeTabOpen: boolean;
}

export interface BrowserSessionStatus {
  hasActiveSessions: boolean;
  sessionsFound: BrowserSession[];
  claudeTabsOpen: number;
  authenticatedSessions: number;
  recommendedBrowser?: string;
  issues: string[];
}

export class BrowserSessionManager {
  constructor() {
    throw new Error('Browser Session Manager is deprecated. Browser authentication is now handled by the Claude SDK.');
  }
}