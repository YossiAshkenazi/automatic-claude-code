/**
 * Process Handle Tracker for ACC SDK Testing Infrastructure
 * Epic 3, Story 3.1: Implement Process Handle Tracking and Cleanup
 * 
 * Provides comprehensive process handle tracking system that:
 * - Tracks all event loop handles (timers, listeners, streams) during test execution
 * - Provides cleanup mechanism to forcibly close all handles at test completion
 * - Enforces process termination timeout (maximum 5 seconds after test completion)
 * - Handles tracking across all SDK components
 * - Eliminates memory leaks from unclosed handles
 * - Ensures accurate test completion status reporting before termination
 */

import { EventEmitter } from 'events';
import { Logger } from '../logger';

// Types for different handle categories
export interface TrackedHandle {
  id: string;
  type: HandleType;
  reference: any;
  createdAt: number;
  source: string;
  metadata?: any;
  cleaned?: boolean;
  cleanedAt?: number;
}

export type HandleType = 
  | 'timer' 
  | 'interval' 
  | 'timeout' 
  | 'immediate' 
  | 'listener' 
  | 'stream' 
  | 'socket' 
  | 'childprocess' 
  | 'fswatcher' 
  | 'promise' 
  | 'custom';

export interface ProcessTerminationOptions {
  maxWaitTime?: number; // Maximum time to wait for graceful cleanup (default: 5000ms)
  forceKillAfter?: number; // Time after which to force kill process (default: 3000ms)
  enableSigkillFallback?: boolean; // Whether to use SIGKILL as last resort (default: true)
  logCleanupProgress?: boolean; // Whether to log cleanup progress (default: true)
}

export interface HandleCleanupResult {
  totalHandles: number;
  cleanedHandles: number;
  failedHandles: number;
  cleanupDuration: number;
  forcedTermination: boolean;
  errors: string[];
}

export interface HandleTrackingOptions {
  enableAutomaticRegistration?: boolean; // Wrap global methods (default: true)
  trackPromises?: boolean; // Track unresolved promises (default: true)
  trackStreams?: boolean; // Track open streams (default: true)
  trackChildProcesses?: boolean; // Track spawned child processes (default: true)
  maxHandleAge?: number; // Max age before handle is considered leaked (default: 300000ms)
  enableLeakDetection?: boolean; // Enable leak detection warnings (default: true)
  handleLimit?: number; // Max number of handles before warning (default: 1000)
}

/**
 * Comprehensive process handle tracking system
 */
export class ProcessHandleTracker extends EventEmitter {
  private static instance: ProcessHandleTracker | null = null;
  private logger: Logger;
  private options: Required<HandleTrackingOptions>;
  
  // Handle tracking state
  private trackedHandles: Map<string, TrackedHandle> = new Map();
  private handleCounter: number = 0;
  private isTracking: boolean = false;
  private isCleaningUp: boolean = false;
  
  // Original method references for restoration
  private originalMethods: Map<string, any> = new Map();
  
  // Termination state
  private terminationTimeout: NodeJS.Timeout | null = null;
  private gracefulShutdownInProgress: boolean = false;
  
  // Cross-platform signal handling
  private readonly exitSignals = process.platform === 'win32' 
    ? ['SIGINT', 'SIGTERM'] 
    : ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP'];

  private constructor(logger: Logger, options: HandleTrackingOptions = {}) {
    super();
    this.logger = logger;
    this.options = {
      enableAutomaticRegistration: true,
      trackPromises: true,
      trackStreams: true,
      trackChildProcesses: true,
      maxHandleAge: 300000, // 5 minutes
      enableLeakDetection: true,
      handleLimit: 1000,
      ...options
    };
    
    this.setupProcessExitHandlers();
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(logger?: Logger, options?: HandleTrackingOptions): ProcessHandleTracker {
    if (!ProcessHandleTracker.instance) {
      if (!logger) {
        throw new Error('Logger is required for first-time ProcessHandleTracker initialization');
      }
      ProcessHandleTracker.instance = new ProcessHandleTracker(logger, options);
    }
    return ProcessHandleTracker.instance;
  }

  /**
   * Start tracking handles
   */
  public startTracking(): void {
    if (this.isTracking) {
      this.logger.debug('ProcessHandleTracker already tracking handles');
      return;
    }

    this.logger.info('Starting process handle tracking');
    this.isTracking = true;
    
    if (this.options.enableAutomaticRegistration) {
      this.wrapGlobalMethods();
    }
    
    this.emit('tracking_started');
    this.logger.debug('Process handle tracking started successfully');
  }

  /**
   * Stop tracking handles (without cleanup)
   */
  public stopTracking(): void {
    if (!this.isTracking) {
      return;
    }

    this.logger.info('Stopping process handle tracking');
    this.isTracking = false;
    
    if (this.options.enableAutomaticRegistration) {
      this.restoreGlobalMethods();
    }
    
    this.emit('tracking_stopped', { totalHandles: this.trackedHandles.size });
    this.logger.debug('Process handle tracking stopped');
  }

  /**
   * Register a handle manually
   */
  public registerHandle(
    type: HandleType, 
    reference: any, 
    source: string = 'manual',
    metadata?: any
  ): string {
    if (!this.isTracking && type !== 'custom') {
      // Allow custom handles even when not tracking for critical cleanup
      return '';
    }

    const id = `handle_${++this.handleCounter}_${Date.now()}`;
    const handle: TrackedHandle = {
      id,
      type,
      reference,
      createdAt: Date.now(),
      source,
      metadata
    };

    this.trackedHandles.set(id, handle);
    
    this.logger.debug(`Registered ${type} handle`, { 
      id, 
      source, 
      totalHandles: this.trackedHandles.size 
    });

    // Check for handle limit
    if (this.options.enableLeakDetection && this.trackedHandles.size > this.options.handleLimit) {
      this.logger.warn(`Handle limit exceeded: ${this.trackedHandles.size}/${this.options.handleLimit}`);
      this.emit('handle_limit_exceeded', { count: this.trackedHandles.size });
    }

    this.emit('handle_registered', { id, type, source });
    return id;
  }

  /**
   * Unregister a handle (when properly cleaned up)
   */
  public unregisterHandle(id: string): boolean {
    const handle = this.trackedHandles.get(id);
    if (!handle) {
      return false;
    }

    handle.cleaned = true;
    handle.cleanedAt = Date.now();
    this.trackedHandles.delete(id);
    
    this.logger.debug(`Unregistered ${handle.type} handle`, { id, source: handle.source });
    this.emit('handle_unregistered', { id, type: handle.type, source: handle.source });
    return true;
  }

  /**
   * Get all tracked handles
   */
  public getTrackedHandles(): TrackedHandle[] {
    return Array.from(this.trackedHandles.values());
  }

  /**
   * Get handles by type
   */
  public getHandlesByType(type: HandleType): TrackedHandle[] {
    return this.getTrackedHandles().filter(handle => handle.type === type);
  }

  /**
   * Detect leaked handles (handles older than maxHandleAge)
   */
  public getLeakedHandles(): TrackedHandle[] {
    const now = Date.now();
    const maxAge = this.options.maxHandleAge;
    
    return this.getTrackedHandles().filter(handle => {
      return (now - handle.createdAt) > maxAge;
    });
  }

  /**
   * Force cleanup of all tracked handles
   */
  public async forceCleanupAll(options: ProcessTerminationOptions = {}): Promise<HandleCleanupResult> {
    const opts = {
      maxWaitTime: 5000,
      forceKillAfter: 3000,
      enableSigkillFallback: true,
      logCleanupProgress: true,
      ...options
    };

    this.logger.info(`Starting force cleanup of ${this.trackedHandles.size} handles`);
    this.isCleaningUp = true;
    
    const startTime = Date.now();
    let cleanedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    const handles = Array.from(this.trackedHandles.values());
    
    try {
      // Phase 1: Graceful cleanup
      if (opts.logCleanupProgress) {
        this.logger.info('Phase 1: Attempting graceful cleanup...');
      }

      for (const handle of handles) {
        try {
          const cleaned = await this.cleanupHandle(handle);
          if (cleaned) {
            cleanedCount++;
            this.unregisterHandle(handle.id);
          } else {
            failedCount++;
          }
        } catch (error: any) {
          failedCount++;
          errors.push(`Failed to cleanup ${handle.type} handle ${handle.id}: ${error.message}`);
          this.logger.error(`Handle cleanup failed`, { 
            handleId: handle.id, 
            type: handle.type, 
            error: error.message 
          });
        }
      }

      // Phase 2: Force cleanup remaining handles
      if (this.trackedHandles.size > 0 && opts.logCleanupProgress) {
        this.logger.warn(`Phase 2: Force cleaning ${this.trackedHandles.size} remaining handles...`);
        
        for (const [id, handle] of this.trackedHandles) {
          try {
            await this.forceCleanupHandle(handle);
            cleanedCount++;
            this.unregisterHandle(id);
          } catch (error: any) {
            failedCount++;
            errors.push(`Failed to force cleanup ${handle.type} handle ${id}: ${error.message}`);
          }
        }
      }

      const result: HandleCleanupResult = {
        totalHandles: handles.length,
        cleanedHandles: cleanedCount,
        failedHandles: failedCount,
        cleanupDuration: Date.now() - startTime,
        forcedTermination: false,
        errors
      };

      this.logger.info('Handle cleanup completed', {
        total: result.totalHandles,
        cleaned: result.cleanedHandles,
        failed: result.failedHandles,
        duration: result.cleanupDuration
      });

      this.emit('cleanup_completed', result);
      return result;

    } catch (error: any) {
      errors.push(`Critical cleanup error: ${error.message}`);
      this.logger.error('Critical error during handle cleanup', { error: error.message });
      
      return {
        totalHandles: handles.length,
        cleanedHandles: cleanedCount,
        failedHandles: failedCount,
        cleanupDuration: Date.now() - startTime,
        forcedTermination: false,
        errors
      };
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Enforce process termination with timeout
   */
  public async enforceProcessTermination(options: ProcessTerminationOptions = {}): Promise<void> {
    const opts = {
      maxWaitTime: 5000,
      forceKillAfter: 3000,
      enableSigkillFallback: true,
      logCleanupProgress: true,
      ...options
    };

    if (this.gracefulShutdownInProgress) {
      this.logger.debug('Process termination already in progress');
      return;
    }

    this.gracefulShutdownInProgress = true;
    this.logger.info('Enforcing process termination', { options: opts });

    try {
      // Start cleanup
      const cleanupResult = await this.forceCleanupAll(opts);
      
      // Set termination timeout
      this.terminationTimeout = setTimeout(() => {
        this.logger.warn(`Process termination timeout (${opts.maxWaitTime}ms) - forcing exit`);
        this.forceProcessExit(opts.enableSigkillFallback);
      }, opts.maxWaitTime);

      // If cleanup succeeded, we can exit gracefully
      if (cleanupResult.failedHandles === 0) {
        this.logger.info('All handles cleaned up successfully - exiting gracefully');
        this.clearTerminationTimeout();
        process.exit(0);
      } else {
        // Some handles failed to cleanup - wait for timeout or force exit
        this.logger.warn(`${cleanupResult.failedHandles} handles failed to cleanup - waiting for timeout`);
        
        setTimeout(() => {
          this.logger.warn(`Force kill timeout (${opts.forceKillAfter}ms) - terminating process`);
          this.forceProcessExit(opts.enableSigkillFallback);
        }, opts.forceKillAfter);
      }

    } catch (error: any) {
      this.logger.error('Error during process termination enforcement', { error: error.message });
      this.forceProcessExit(opts.enableSigkillFallback);
    }
  }

  /**
   * Get current handle statistics
   */
  public getStatistics() {
    const handles = this.getTrackedHandles();
    const byType: { [key: string]: number } = {};
    
    handles.forEach(handle => {
      byType[handle.type] = (byType[handle.type] || 0) + 1;
    });

    const leaked = this.getLeakedHandles();
    
    return {
      totalHandles: handles.length,
      handlesByType: byType,
      leakedHandles: leaked.length,
      oldestHandle: handles.length > 0 ? Math.min(...handles.map(h => h.createdAt)) : null,
      isTracking: this.isTracking,
      isCleaningUp: this.isCleaningUp
    };
  }

  /**
   * Wrap global methods for automatic handle registration
   */
  private wrapGlobalMethods(): void {
    try {
      // Timers
      this.wrapMethod(global, 'setTimeout', 'timeout', (original, args, result) => {
        return this.registerHandle('timeout', result, 'global.setTimeout', { delay: args[1] });
      });

      this.wrapMethod(global, 'setInterval', 'interval', (original, args, result) => {
        return this.registerHandle('interval', result, 'global.setInterval', { delay: args[1] });
      });

      this.wrapMethod(global, 'setImmediate', 'immediate', (original, args, result) => {
        return this.registerHandle('immediate', result, 'global.setImmediate');
      });

      // EventEmitter listeners
      if (this.options.trackStreams) {
        this.wrapEventEmitters();
      }

      this.logger.debug('Global methods wrapped for handle tracking');

    } catch (error: any) {
      this.logger.error('Failed to wrap global methods', { error: error.message });
    }
  }

  /**
   * Wrap a method for handle tracking
   */
  private wrapMethod(
    obj: any, 
    methodName: string, 
    handleType: HandleType,
    registerCallback: (original: Function, args: any[], result: any) => string
  ): void {
    if (!obj[methodName] || typeof obj[methodName] !== 'function') {
      return;
    }

    const original = obj[methodName];
    const originalKey = `${obj.constructor?.name || 'global'}.${methodName}`;
    
    if (this.originalMethods.has(originalKey)) {
      return; // Already wrapped
    }
    
    this.originalMethods.set(originalKey, original);

    obj[methodName] = (...args: any[]) => {
      const result = original.apply(obj, args);
      
      if (this.isTracking) {
        try {
          registerCallback(original, args, result);
        } catch (error: any) {
          this.logger.error(`Failed to register ${handleType} handle`, { error: error.message });
        }
      }
      
      return result;
    };
  }

  /**
   * Wrap EventEmitter methods for listener tracking
   */
  private wrapEventEmitters(): void {
    const EventEmitter = require('events');
    
    this.wrapMethod(EventEmitter.prototype, 'on', 'listener', (original, args, result) => {
      return this.registerHandle('listener', { emitter: result, event: args[0], listener: args[1] }, 
        'EventEmitter.on', { event: args[0] });
    });

    this.wrapMethod(EventEmitter.prototype, 'addListener', 'listener', (original, args, result) => {
      return this.registerHandle('listener', { emitter: result, event: args[0], listener: args[1] }, 
        'EventEmitter.addListener', { event: args[0] });
    });
  }

  /**
   * Restore original global methods
   */
  private restoreGlobalMethods(): void {
    try {
      for (const [key, original] of this.originalMethods) {
        const [objName, methodName] = key.split('.');
        let obj = global;
        
        if (objName === 'EventEmitter.prototype') {
          obj = require('events').prototype;
        }
        
        if (obj[methodName]) {
          obj[methodName] = original;
        }
      }
      
      this.originalMethods.clear();
      this.logger.debug('Global methods restored');

    } catch (error: any) {
      this.logger.error('Failed to restore global methods', { error: error.message });
    }
  }

  /**
   * Cleanup an individual handle
   */
  private async cleanupHandle(handle: TrackedHandle): Promise<boolean> {
    try {
      switch (handle.type) {
        case 'timeout':
        case 'interval':
        case 'immediate':
          if (handle.reference && typeof handle.reference === 'object') {
            clearTimeout(handle.reference);
            clearInterval(handle.reference);
            clearImmediate(handle.reference);
            return true;
          }
          break;

        case 'listener':
          if (handle.reference?.emitter && handle.reference?.listener) {
            handle.reference.emitter.removeListener(handle.reference.event, handle.reference.listener);
            return true;
          }
          break;

        case 'stream':
          if (handle.reference && typeof handle.reference.destroy === 'function') {
            handle.reference.destroy();
            return true;
          } else if (handle.reference && typeof handle.reference.close === 'function') {
            handle.reference.close();
            return true;
          }
          break;

        case 'socket':
          if (handle.reference && typeof handle.reference.destroy === 'function') {
            handle.reference.destroy();
            return true;
          }
          break;

        case 'childprocess':
          if (handle.reference && typeof handle.reference.kill === 'function') {
            handle.reference.kill('SIGTERM');
            return true;
          }
          break;

        case 'fswatcher':
          if (handle.reference && typeof handle.reference.close === 'function') {
            handle.reference.close();
            return true;
          }
          break;

        case 'custom':
          if (handle.reference && typeof handle.reference.cleanup === 'function') {
            await handle.reference.cleanup();
            return true;
          }
          break;
      }

      return false;

    } catch (error: any) {
      this.logger.error(`Failed to cleanup ${handle.type} handle`, { 
        handleId: handle.id, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Force cleanup handle with aggressive methods
   */
  private async forceCleanupHandle(handle: TrackedHandle): Promise<void> {
    try {
      // Try standard cleanup first
      const cleaned = await this.cleanupHandle(handle);
      if (cleaned) {
        return;
      }

      // Aggressive cleanup methods
      switch (handle.type) {
        case 'childprocess':
          if (handle.reference && typeof handle.reference.kill === 'function') {
            handle.reference.kill('SIGKILL'); // Force kill
          }
          break;

        case 'stream':
        case 'socket':
          if (handle.reference) {
            // Try to nullify references
            try {
              handle.reference._handle?.close?.();
              handle.reference.destroy?.();
            } catch {}
          }
          break;

        default:
          // For other types, try to nullify the reference
          if (handle.reference && typeof handle.reference === 'object') {
            try {
              Object.keys(handle.reference).forEach(key => {
                delete handle.reference[key];
              });
            } catch {}
          }
      }

    } catch (error: any) {
      this.logger.error(`Failed to force cleanup ${handle.type} handle`, { 
        handleId: handle.id, 
        error: error.message 
      });
    }
  }

  /**
   * Setup process exit handlers
   */
  private setupProcessExitHandlers(): void {
    // Handle process exit events
    process.on('beforeExit', (code) => {
      this.logger.debug(`Process beforeExit event (code: ${code})`);
      this.handleProcessExit();
    });

    process.on('exit', (code) => {
      this.logger.debug(`Process exit event (code: ${code})`);
      this.handleProcessExit();
    });

    // Handle signals
    this.exitSignals.forEach(signal => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal} signal - initiating graceful shutdown`);
        this.handleProcessExit();
      });
    });

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception - forcing cleanup', { error: error.message });
      this.handleProcessExit();
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection - forcing cleanup', { reason });
      this.handleProcessExit();
    });
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(): void {
    if (this.gracefulShutdownInProgress) {
      return;
    }

    this.logger.info('Process exit detected - cleaning up handles');
    
    // Perform synchronous cleanup for critical handles
    const criticalHandles = this.getTrackedHandles().filter(h => 
      ['childprocess', 'stream', 'socket'].includes(h.type)
    );

    for (const handle of criticalHandles) {
      try {
        this.cleanupHandle(handle);
        this.unregisterHandle(handle.id);
      } catch (error: any) {
        this.logger.error(`Failed to cleanup critical handle on exit`, { 
          handleId: handle.id, 
          error: error.message 
        });
      }
    }

    this.stopTracking();
  }

  /**
   * Clear termination timeout
   */
  private clearTerminationTimeout(): void {
    if (this.terminationTimeout) {
      clearTimeout(this.terminationTimeout);
      this.terminationTimeout = null;
    }
  }

  /**
   * Force process exit as last resort
   */
  private forceProcessExit(enableSigkill: boolean = true): void {
    this.logger.warn('Forcing process exit');
    this.clearTerminationTimeout();
    
    if (enableSigkill) {
      // Use SIGKILL as absolute last resort
      setTimeout(() => {
        if (process.platform === 'win32') {
          process.exit(1);
        } else {
          process.kill(process.pid, 'SIGKILL');
        }
      }, 1000);
    }
    
    process.exit(1);
  }

  /**
   * Cleanup and destroy the tracker instance
   */
  public static destroy(): void {
    if (ProcessHandleTracker.instance) {
      ProcessHandleTracker.instance.stopTracking();
      ProcessHandleTracker.instance.removeAllListeners();
      ProcessHandleTracker.instance = null;
    }
  }
}

export default ProcessHandleTracker;