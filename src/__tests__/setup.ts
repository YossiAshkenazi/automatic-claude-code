// Test setup for Vitest
import { vi } from 'vitest';

// Global test configuration
global.console = {
  ...console,
  // Suppress debug logs in tests unless explicitly needed
  debug: vi.fn(),
  log: vi.fn(),
  // Keep errors and warnings for debugging
  error: console.error,
  warn: console.warn,
  info: console.info
};

// Mock process.env for consistent testing
process.env.NODE_ENV = 'test';

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global cleanup
afterAll(() => {
  vi.restoreAllMocks();
});