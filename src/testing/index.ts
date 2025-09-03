/**
 * Testing Infrastructure Module
 * Epic 2: Core Session Management Resolution
 * Epic 3: Process Isolation and Testing Infrastructure
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
export { 
  default as ProcessHandleTracker, 
  TrackedHandle,
  HandleType,
  ProcessTerminationOptions,
  HandleCleanupResult,
  HandleTrackingOptions
} from './ProcessHandleTracker';
export { 
  default as IsolatedTestRunner,
  IsolatedTestOptions,
  IsolatedTestResult,
  TestProcessInfo,
  IPCMessage
} from './IsolatedTestRunner';
export { 
  default as ShutdownManager,
  ShutdownHook,
  ShutdownPriority,
  ShutdownOptions,
  ShutdownResult,
  HookExecutionResult,
  ShutdownStatus,
  ShutdownPhase
} from './ShutdownManager';

// Note: Convenience functions available as TestSDKFactory.createIsolated, etc.
// to avoid circular dependency issues