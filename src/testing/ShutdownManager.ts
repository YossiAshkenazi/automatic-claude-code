/**
 * Graceful Shutdown Manager for ACC SDK Testing Infrastructure
 * Epic 3, Story 3.3: Implement Graceful Shutdown Hooks
 * 
 * Provides comprehensive graceful shutdown coordination system that:
 * - All SDK components implement shutdown() methods with cleanup logic
 * - SIGTERM and SIGINT signals are handled gracefully in test mode
 * - Shutdown hooks are registered automatically during test SDK initialization
 * - Maximum shutdown time is enforced (3 seconds) with fallback to SIGKILL
 * - Shutdown status is logged for debugging hanging process issues
 * - Resource cleanup order is optimized to prevent cleanup deadlocks
 */

import { EventEmitter } from 'events';
import { Logger } from '../logger';
import ProcessHandleTracker, { 
  ProcessTerminationOptions, 
  HandleCleanupResult 
} from './ProcessHandleTracker';

// Types for shutdown management
export interface ShutdownHook {
  id: string;
  name: string;
  priority: ShutdownPriority;
  cleanup: () => Promise<void>;
  timeoutMs: number;
  enabled: boolean;
  description?: string;
  dependencies?: string[]; // IDs of hooks that must complete first
  metadata?: any;
}

export type ShutdownPriority = 
  | 'critical'     // Priority 0 - Process handles, file descriptors
  | 'high'         // Priority 1 - Database connections, network streams
  | 'normal'       // Priority 2 - User sessions, caches
  | 'low'          // Priority 3 - Background tasks, statistics
  | 'cleanup';     // Priority 4 - Temporary files, logging

export interface ShutdownOptions {
  maxShutdownTime?: number;        // Maximum total shutdown time (default: 3000ms)
  gracefulTimeout?: number;        // Graceful shutdown timeout (default: 2000ms)
  forceKillTimeout?: number;       // Time before SIGKILL (default: 1000ms)
  enableSignalHandlers?: boolean;  // Register signal handlers (default: true)
  logProgress?: boolean;           // Log shutdown progress (default: true)
  enableEscalation?: boolean;      // Enable escalation to SIGKILL (default: true)
  hookTimeout?: number;            // Default hook timeout (default: 500ms)
  parallelExecution?: boolean;     // Execute hooks in parallel where possible (default: true)
}

export interface ShutdownResult {
  success: boolean;
  totalTime: number;
  completedHooks: number;
  failedHooks: number;
  timedOutHooks: number;
  skippedHooks: number;
  escalatedToSigkill: boolean;
  errors: string[];
  hookResults: Map<string, HookExecutionResult>;
}

export interface HookExecutionResult {
  hookId: string;
  success: boolean;
  executionTime: number;
  error?: string;
  timedOut: boolean;
  skipped: boolean;
  reason?: string;
}

export interface ShutdownStatus {
  phase: ShutdownPhase;
  startTime?: number;
  currentHook?: string;
  progress: {
    completed: number;
    failed: number;
    remaining: number;
    total: number;
  };
  timeRemaining?: number;
  canCancel: boolean;
}

export type ShutdownPhase = 
  | 'idle'
  | 'initializing'
  | 'graceful_shutdown'
  | 'force_shutdown'
  | 'sigkill_escalation'
  | 'completed'
  | 'failed';

// Cross-platform signal mapping
const SHUTDOWN_SIGNALS = process.platform === 'win32' 
  ? ['SIGINT', 'SIGTERM'] 
  : ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP'];

const PRIORITY_ORDER: { [key in ShutdownPriority]: number } = {
  'critical': 0,
  'high': 1,
  'normal': 2,
  'low': 3,
  'cleanup': 4
};

/**
 * Comprehensive graceful shutdown coordination system
 */
export class ShutdownManager extends EventEmitter {
  private static instance: ShutdownManager | null = null;
  private logger: Logger;
  private options: Required<ShutdownOptions>;
  
  // Hook management
  private hooks: Map<string, ShutdownHook> = new Map();
  private hookCounter: number = 0;
  private executionOrder: ShutdownHook[] = [];
  private dependencyGraph: Map<string, Set<string>> = new Map();
  
  // Shutdown state
  private currentPhase: ShutdownPhase = 'idle';
  private isShuttingDown: boolean = false;
  private shutdownStartTime?: number;
  private completedHooks: Set<string> = new Set();
  private failedHooks: Set<string> = new Set();
  private currentHookResults: Map<string, HookExecutionResult> = new Map();
  
  // Timers and signals
  private shutdownTimer: NodeJS.Timeout | null = null;
  private gracefulTimer: NodeJS.Timeout | null = null;
  private forceKillTimer: NodeJS.Timeout | null = null;
  private signalHandlersRegistered: boolean = false;
  
  // Integration components
  private handleTracker?: ProcessHandleTracker;
  
  private constructor(logger: Logger, options: ShutdownOptions = {}) {
    super();
    this.logger = logger;
    this.options = {
      maxShutdownTime: 3000,
      gracefulTimeout: 2000,
      forceKillTimeout: 1000,
      enableSignalHandlers: true,
      logProgress: true,
      enableEscalation: true,
      hookTimeout: 500,
      parallelExecution: true,
      ...options
    };
    
    this.validateOptions();
    this.setupErrorHandling();
    
    if (this.options.enableSignalHandlers) {
      this.registerSignalHandlers();
    }
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(logger?: Logger, options?: ShutdownOptions): ShutdownManager {
    if (!ShutdownManager.instance) {
      if (!logger) {
        throw new Error('Logger is required for first-time ShutdownManager initialization');
      }
      ShutdownManager.instance = new ShutdownManager(logger, options);
    }
    return ShutdownManager.instance;
  }

  /**
   * Register a shutdown hook with dependency management
   */
  public registerHook(
    name: string,
    cleanup: () => Promise<void>,
    priority: ShutdownPriority = 'normal',
    options: {
      timeoutMs?: number;
      dependencies?: string[];
      description?: string;
      metadata?: any;
    } = {}
  ): string {
    if (this.isShuttingDown) {
      throw new Error('Cannot register hooks during shutdown');
    }

    const id = `hook_${++this.hookCounter}_${Date.now()}`;
    const hook: ShutdownHook = {
      id,
      name,
      priority,
      cleanup,
      timeoutMs: options.timeoutMs || this.options.hookTimeout,
      enabled: true,
      description: options.description,
      dependencies: options.dependencies || [],
      metadata: options.metadata
    };

    this.hooks.set(id, hook);
    
    // Update dependency graph
    if (hook.dependencies && hook.dependencies.length > 0) {
      this.dependencyGraph.set(id, new Set(hook.dependencies));
    }
    
    // Invalidate execution order - will be recalculated on next shutdown
    this.executionOrder = [];
    
    this.logger.debug(`Registered shutdown hook '${name}'`, {
      id,
      priority,
      timeout: hook.timeoutMs,
      dependencies: hook.dependencies,
      totalHooks: this.hooks.size
    });
    
    this.emit('hook_registered', { hook });
    return id;
  }

  /**
   * Unregister a shutdown hook
   */
  public unregisterHook(hookId: string): boolean {
    if (this.isShuttingDown) {
      this.logger.warning('Attempted to unregister hook during shutdown', { hookId });
      return false;
    }

    const hook = this.hooks.get(hookId);
    if (!hook) {
      return false;
    }

    this.hooks.delete(hookId);
    this.dependencyGraph.delete(hookId);
    
    // Remove from dependencies of other hooks
    for (const [id, deps] of this.dependencyGraph) {
      deps.delete(hookId);
      if (deps.size === 0) {
        this.dependencyGraph.delete(id);
      }
    }
    
    // Invalidate execution order
    this.executionOrder = [];
    
    this.logger.debug(`Unregistered shutdown hook '${hook.name}'`, { hookId });
    this.emit('hook_unregistered', { hookId, hookName: hook.name });
    return true;
  }

  /**
   * Enable or disable a specific hook
   */
  public setHookEnabled(hookId: string, enabled: boolean): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      return false;
    }

    hook.enabled = enabled;
    this.logger.debug(`${enabled ? 'Enabled' : 'Disabled'} shutdown hook '${hook.name}'`, { hookId });
    return true;
  }

  /**
   * Set handle tracker for integration
   */
  public setHandleTracker(handleTracker: ProcessHandleTracker): void {
    this.handleTracker = handleTracker;
    
    // Register handle tracker cleanup as critical priority hook
    this.registerHook(
      'ProcessHandleTracker-Cleanup',
      async () => {
        if (this.handleTracker) {
          await this.handleTracker.forceCleanupAll({
            maxWaitTime: this.options.gracefulTimeout,
            forceKillAfter: Math.min(this.options.forceKillTimeout, 1500),
            enableSigkillFallback: false, // We'll handle SIGKILL escalation
            logCleanupProgress: this.options.logProgress
          });
        }
      },
      'critical',
      {
        timeoutMs: this.options.gracefulTimeout,
        description: 'Clean up tracked process handles'
      }
    );
  }

  /**
   * Initiate graceful shutdown sequence
   */
  public async shutdown(reason: string = 'Manual shutdown'): Promise<ShutdownResult> {
    if (this.isShuttingDown) {
      this.logger.warning('Shutdown already in progress');
      return this.waitForShutdownCompletion();
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();
    this.currentPhase = 'initializing';
    
    this.logger.info('Initiating graceful shutdown sequence', { 
      reason, 
      totalHooks: this.hooks.size,
      maxShutdownTime: this.options.maxShutdownTime
    });

    this.emit('shutdown_started', { reason, options: this.options });

    // Set overall shutdown timeout
    this.shutdownTimer = setTimeout(() => {
      this.handleShutdownTimeout();
    }, this.options.maxShutdownTime);

    try {
      // Phase 1: Initialize shutdown sequence
      this.calculateExecutionOrder();
      this.currentPhase = 'graceful_shutdown';
      
      // Phase 2: Execute graceful shutdown hooks
      const result = await this.executeShutdownHooks();
      
      if (result.success) {
        this.currentPhase = 'completed';
        this.logger.info('Graceful shutdown completed successfully', {
          totalTime: result.totalTime,
          completedHooks: result.completedHooks,
          failedHooks: result.failedHooks
        });
      } else {
        this.currentPhase = 'failed';
        this.logger.error('Graceful shutdown completed with failures', {
          totalTime: result.totalTime,
          completedHooks: result.completedHooks,
          failedHooks: result.failedHooks,
          errors: result.errors
        });
      }
      
      this.clearTimers();
      this.emit('shutdown_completed', result);
      return result;
      
    } catch (error: any) {
      this.currentPhase = 'failed';
      this.logger.error('Shutdown sequence failed', { error: error.message });
      
      const result: ShutdownResult = {
        success: false,
        totalTime: Date.now() - this.shutdownStartTime!,
        completedHooks: this.completedHooks.size,
        failedHooks: this.failedHooks.size,
        timedOutHooks: 0,
        skippedHooks: this.hooks.size - this.completedHooks.size - this.failedHooks.size,
        escalatedToSigkill: false,
        errors: [error.message],
        hookResults: this.currentHookResults
      };
      
      this.clearTimers();
      this.emit('shutdown_failed', result);
      return result;
    }
  }

  /**
   * Force immediate shutdown with escalation
   */
  public async forceShutdown(): Promise<void> {
    this.logger.warning('Force shutdown initiated - escalating to SIGKILL');
    this.currentPhase = 'sigkill_escalation';
    
    this.clearTimers();
    
    // Cancel any running hooks
    this.emit('force_shutdown');
    
    if (this.options.enableEscalation) {
      // Give a brief moment for cleanup, then SIGKILL
      this.forceKillTimer = setTimeout(() => {
        this.escalateToSigkill();
      }, 500);
    }
  }

  /**
   * Get current shutdown status
   */
  public getStatus(): ShutdownStatus {
    return {
      phase: this.currentPhase,
      startTime: this.shutdownStartTime,
      progress: {
        completed: this.completedHooks.size,
        failed: this.failedHooks.size,
        remaining: this.hooks.size - this.completedHooks.size - this.failedHooks.size,
        total: this.hooks.size
      },
      timeRemaining: this.shutdownStartTime 
        ? Math.max(0, this.options.maxShutdownTime - (Date.now() - this.shutdownStartTime))
        : undefined,
      canCancel: this.currentPhase === 'idle'
    };
  }

  /**
   * Get registered hooks information
   */
  public getHooks(): ShutdownHook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Wait for shutdown completion if already in progress
   */
  private async waitForShutdownCompletion(): Promise<ShutdownResult> {
    return new Promise((resolve) => {
      const checkShutdown = () => {
        if (this.currentPhase === 'completed' || this.currentPhase === 'failed') {
          resolve({
            success: this.currentPhase === 'completed',
            totalTime: Date.now() - (this.shutdownStartTime || Date.now()),
            completedHooks: this.completedHooks.size,
            failedHooks: this.failedHooks.size,
            timedOutHooks: 0,
            skippedHooks: 0,
            escalatedToSigkill: false,
            errors: [],
            hookResults: this.currentHookResults
          });
        } else {
          setTimeout(checkShutdown, 100);
        }
      };
      checkShutdown();
    });
  }

  /**
   * Calculate optimal execution order for hooks with dependency resolution
   */
  private calculateExecutionOrder(): void {
    if (this.executionOrder.length > 0) {
      return; // Already calculated
    }

    const allHooks = Array.from(this.hooks.values()).filter(hook => hook.enabled);
    const resolved: string[] = [];
    const visiting: Set<string> = new Set();
    const visited: Set<string> = new Set();

    // Topological sort with cycle detection
    const visit = (hookId: string): void => {
      if (visiting.has(hookId)) {
        throw new Error(`Circular dependency detected involving hook: ${hookId}`);
      }
      if (visited.has(hookId)) {
        return;
      }

      visiting.add(hookId);
      
      const dependencies = this.dependencyGraph.get(hookId) || new Set();
      for (const depId of dependencies) {
        if (this.hooks.has(depId) && this.hooks.get(depId)!.enabled) {
          visit(depId);
        }
      }
      
      visiting.delete(hookId);
      visited.add(hookId);
      resolved.push(hookId);
    };

    // Visit all hooks
    for (const hook of allHooks) {
      if (!visited.has(hook.id)) {
        visit(hook.id);
      }
    }

    // Sort by priority within dependency groups
    const sortedHooks = resolved
      .map(id => this.hooks.get(id)!)
      .sort((a, b) => {
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Secondary sort by name for consistency
        return a.name.localeCompare(b.name);
      });

    this.executionOrder = sortedHooks;
    
    this.logger.debug('Calculated hook execution order', {
      totalHooks: this.executionOrder.length,
      order: this.executionOrder.map(h => ({ 
        name: h.name, 
        priority: h.priority, 
        dependencies: h.dependencies 
      }))
    });
  }

  /**
   * Execute shutdown hooks in calculated order
   */
  private async executeShutdownHooks(): Promise<ShutdownResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let timedOutHooks = 0;

    this.logger.info('Executing shutdown hooks', { 
      totalHooks: this.executionOrder.length,
      parallelExecution: this.options.parallelExecution 
    });

    // Group hooks by priority for potential parallel execution
    const priorityGroups: Map<ShutdownPriority, ShutdownHook[]> = new Map();
    for (const hook of this.executionOrder) {
      const group = priorityGroups.get(hook.priority) || [];
      group.push(hook);
      priorityGroups.set(hook.priority, group);
    }

    // Execute hooks by priority groups
    for (const priority of ['critical', 'high', 'normal', 'low', 'cleanup'] as ShutdownPriority[]) {
      const group = priorityGroups.get(priority);
      if (!group || group.length === 0) continue;

      this.logger.debug(`Executing ${priority} priority hooks`, { count: group.length });

      if (this.options.parallelExecution && group.length > 1) {
        // Execute hooks in parallel within the same priority
        await this.executeHooksParallel(group, errors);
      } else {
        // Execute hooks sequentially
        for (const hook of group) {
          await this.executeHook(hook, errors);
        }
      }

      // Check if we should continue
      if (this.currentPhase !== 'graceful_shutdown') {
        break;
      }
    }

    const result: ShutdownResult = {
      success: this.failedHooks.size === 0 && errors.length === 0,
      totalTime: Date.now() - startTime,
      completedHooks: this.completedHooks.size,
      failedHooks: this.failedHooks.size,
      timedOutHooks,
      skippedHooks: this.hooks.size - this.completedHooks.size - this.failedHooks.size,
      escalatedToSigkill: false,
      errors,
      hookResults: this.currentHookResults
    };

    return result;
  }

  /**
   * Execute hooks in parallel
   */
  private async executeHooksParallel(hooks: ShutdownHook[], errors: string[]): Promise<void> {
    const promises = hooks.map(hook => this.executeHook(hook, errors));
    await Promise.all(promises);
  }

  /**
   * Execute a single shutdown hook with timeout
   */
  private async executeHook(hook: ShutdownHook, errors: string[]): Promise<void> {
    const startTime = Date.now();
    const result: HookExecutionResult = {
      hookId: hook.id,
      success: false,
      executionTime: 0,
      timedOut: false,
      skipped: false
    };

    try {
      // Check dependencies
      if (hook.dependencies && hook.dependencies.length > 0) {
        for (const depId of hook.dependencies) {
          if (!this.completedHooks.has(depId)) {
            result.skipped = true;
            result.reason = `Dependency '${depId}' not completed`;
            this.logger.warning(`Skipping hook '${hook.name}' due to unresolved dependency`, { 
              hookId: hook.id, 
              dependency: depId 
            });
            this.currentHookResults.set(hook.id, result);
            return;
          }
        }
      }

      this.logger.debug(`Executing shutdown hook '${hook.name}'`, { 
        hookId: hook.id, 
        timeout: hook.timeoutMs 
      });

      this.emit('hook_executing', { hook });

      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Hook '${hook.name}' timed out after ${hook.timeoutMs}ms`));
        }, hook.timeoutMs);
      });

      await Promise.race([hook.cleanup(), timeoutPromise]);

      result.success = true;
      result.executionTime = Date.now() - startTime;
      
      this.completedHooks.add(hook.id);
      this.logger.debug(`Completed shutdown hook '${hook.name}'`, { 
        hookId: hook.id, 
        executionTime: result.executionTime 
      });
      
      this.emit('hook_completed', { hook, result });

    } catch (error: any) {
      result.success = false;
      result.executionTime = Date.now() - startTime;
      result.error = error.message;
      
      if (error.message.includes('timed out')) {
        result.timedOut = true;
      }
      
      this.failedHooks.add(hook.id);
      errors.push(`Hook '${hook.name}' failed: ${error.message}`);
      
      this.logger.error(`Shutdown hook '${hook.name}' failed`, { 
        hookId: hook.id, 
        error: error.message,
        executionTime: result.executionTime
      });
      
      this.emit('hook_failed', { hook, error: error.message, result });
    } finally {
      this.currentHookResults.set(hook.id, result);
    }
  }

  /**
   * Handle overall shutdown timeout
   */
  private handleShutdownTimeout(): void {
    this.logger.error(`Shutdown timeout exceeded (${this.options.maxShutdownTime}ms) - forcing immediate shutdown`);
    this.currentPhase = 'force_shutdown';
    
    // Cancel any remaining hooks
    this.emit('shutdown_timeout');
    
    // Escalate to SIGKILL if enabled
    if (this.options.enableEscalation) {
      this.escalateToSigkill();
    }
  }

  /**
   * Escalate to SIGKILL as last resort
   */
  private escalateToSigkill(): void {
    this.currentPhase = 'sigkill_escalation';
    this.logger.error('Escalating to SIGKILL - immediate process termination');
    
    this.emit('sigkill_escalation');
    
    // Give a final moment for any critical cleanup
    setTimeout(() => {
      if (process.platform === 'win32') {
        process.exit(1);
      } else {
        process.kill(process.pid, 'SIGKILL');
      }
    }, 100);
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) {
      return;
    }

    for (const signal of SHUTDOWN_SIGNALS) {
      process.on(signal as NodeJS.Signals, (sig) => {
        this.logger.info(`Received ${sig} signal - initiating graceful shutdown`);
        this.shutdown(`Signal: ${sig}`).then((result) => {
          process.exit(result.success ? 0 : 1);
        }).catch(() => {
          process.exit(1);
        });
      });
    }

    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception - forcing shutdown', { error: error.message });
      this.forceShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection - forcing shutdown', { reason });
      this.forceShutdown();
    });

    this.signalHandlersRegistered = true;
    this.logger.debug('Signal handlers registered', { signals: SHUTDOWN_SIGNALS });
  }

  /**
   * Setup error handling for shutdown manager
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      this.logger.error('ShutdownManager internal error', { error: error.message });
    });
  }

  /**
   * Validate shutdown options
   */
  private validateOptions(): void {
    if (this.options.maxShutdownTime <= 0) {
      throw new Error('maxShutdownTime must be positive');
    }
    if (this.options.gracefulTimeout >= this.options.maxShutdownTime) {
      throw new Error('gracefulTimeout must be less than maxShutdownTime');
    }
    if (this.options.forceKillTimeout >= this.options.maxShutdownTime) {
      throw new Error('forceKillTimeout must be less than maxShutdownTime');
    }
    if (this.options.hookTimeout <= 0) {
      throw new Error('hookTimeout must be positive');
    }
  }

  /**
   * Clear all shutdown timers
   */
  private clearTimers(): void {
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = null;
    }
    if (this.gracefulTimer) {
      clearTimeout(this.gracefulTimer);
      this.gracefulTimer = null;
    }
    if (this.forceKillTimer) {
      clearTimeout(this.forceKillTimer);
      this.forceKillTimer = null;
    }
  }

  /**
   * Cleanup and destroy the manager instance
   */
  public static destroy(): void {
    if (ShutdownManager.instance) {
      ShutdownManager.instance.clearTimers();
      ShutdownManager.instance.removeAllListeners();
      ShutdownManager.instance = null;
    }
  }

  /**
   * Check if manager is in shutdown state
   */
  public isInShutdown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get shutdown statistics
   */
  public getStatistics() {
    return {
      registeredHooks: this.hooks.size,
      enabledHooks: Array.from(this.hooks.values()).filter(h => h.enabled).length,
      completedHooks: this.completedHooks.size,
      failedHooks: this.failedHooks.size,
      currentPhase: this.currentPhase,
      isShuttingDown: this.isShuttingDown,
      signalHandlersRegistered: this.signalHandlersRegistered,
      uptime: this.shutdownStartTime ? Date.now() - this.shutdownStartTime : 0
    };
  }
}

export default ShutdownManager;