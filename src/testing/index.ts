/**
 * Testing Infrastructure Module
 * Epic 2: Core Session Management Resolution
 * 
 * Exports all testing utilities for SDK session isolation and testing
 */

export { ContextDetector, ExecutionContext, ContextDetectionResult } from './ContextDetector';
export { 
  EnhancedSessionDetector, 
  SessionDetectionResult, 
  SessionDetectionOptions 
} from './EnhancedSessionDetector';
export { 
  TestSDKFactory, 
  TestSDKClaudeExecutor,
  TestSDKOptions, 
  TestSDKInstance 
} from './TestSDKFactory';
export { 
  MockSDKLayer, 
  SDKMockConfig, 
  SDKCall, 
  MockResponse 
} from './MockSDKLayer';

// Note: Convenience functions available as TestSDKFactory.createIsolated, etc.
// to avoid circular dependency issues