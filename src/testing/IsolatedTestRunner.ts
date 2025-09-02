/**
 * Isolated Test Process Spawning for ACC SDK Testing Infrastructure
 * Epic 3, Story 3.2: Create Isolated Test Process Spawning
 * 
 * Provides complete process isolation for high-level integration tests with:
 * - Separate Node.js process spawning for complete state isolation
 * - Inter-Process Communication (IPC) for test coordination and results
 * - Timeout management with forcible process termination
 * - Minimized process spawning overhead (under 2 seconds per process)
 * - Child process failure isolation from main test runner
 * - Cross-platform process management compatibility
 */

import { fork, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../logger';
import ProcessHandleTracker, { 
  ProcessTerminationOptions, 
  HandleCleanupResult 
} from './ProcessHandleTracker';
import { TestSDKFactory, TestSDKOptions } from './TestSDKFactory';

export interface IsolatedTestOptions {
  // Process configuration
  processTimeout: number; // Maximum process execution time (default: 30000ms)
  spawnTimeout: number; // Maximum time to spawn process (default: 5000ms)
  cleanupTimeout: number; // Maximum time for cleanup (default: 10000ms)
  maxConcurrentProcesses: number; // Limit concurrent test processes (default: 4)
  
  // Test configuration
  testSDKOptions: TestSDKOptions;
  nodeOptions?: string[]; // Additional Node.js options
  envOverrides?: { [key: string]: string }; // Environment variable overrides
  workingDirectory?: string; // Working directory for child process
  
  // IPC configuration
  enableIPC: boolean; // Enable inter-process communication (default: true)
  ipcTimeout: number; // IPC response timeout (default: 5000ms)
  heartbeatInterval: number; // Health check interval (default: 1000ms)
  
  // Debugging
  enableProcessLogging: boolean; // Log child process stdout/stderr (default: false)
  logLevel: 'debug' | 'info' | 'warning' | 'error';
  preserveProcessOnFailure: boolean; // Keep process running for debugging (default: false)
}

export interface IsolatedTestResult {
  success: boolean;
  exitCode: number | null;
  signal: string | null;
  duration: number;
  stdout: string;
  stderr: string;
  error?: string;
  testResults?: any; // Test-specific results from IPC
  processId: number;
  spawnTime: number;
  cleanupTime: number;
  memoryUsage?: NodeJS.MemoryUsage;
  handleStats?: HandleCleanupResult;
}

export interface TestProcessInfo {
  processId: number;
  childProcess: ChildProcess;
  startTime: number;
  testFunction: string;
  options: IsolatedTestOptions;
  status: 'spawning' | 'running' | 'completing' | 'completed' | 'failed' | 'timeout';
  stdout: string[];
  stderr: string[];
  ipcMessages: any[];
  heartbeatCount: number;
  lastHeartbeat: number;
}

export interface IPCMessage {
  type: 'ready' | 'test_start' | 'test_progress' | 'test_result' | 'error' | 'heartbeat' | 'cleanup';
  timestamp: number;
  processId: number;
  data?: any;
  correlationId?: string;
}

/**
 * Isolated Test Runner for spawning tests in separate Node.js processes
 */
export class IsolatedTestRunner extends EventEmitter {
  private logger: Logger;
  private defaultOptions: Required<IsolatedTestOptions>;
  private activeProcesses: Map<number, TestProcessInfo> = new Map();
  private processCounter: number = 0;
  private isShuttingDown: boolean = false;
  private processPool: Set<number> = new Set();
  private handleTracker: ProcessHandleTracker;

  // Statistics tracking
  private stats = {
    totalProcessesSpawned: 0,
    successfulTests: 0,
    failedTests: 0,
    timeoutTests: 0,
    averageSpawnTime: 0,
    averageExecutionTime: 0,
    averageCleanupTime: 0,
    totalExecutionTime: 0,
    peakMemoryUsage: 0,
    currentConcurrentProcesses: 0,
    maxConcurrentProcesses: 0
  };

  constructor(logger?: Logger, options: Partial<IsolatedTestOptions> = {}) {
    super();
    this.logger = logger || new Logger('isolated-test-runner', { 
      essentialMode: true, 
      enableFileLogging: false 
    });
    
    this.defaultOptions = {
      processTimeout: 30000,
      spawnTimeout: 5000,
      cleanupTimeout: 10000,
      maxConcurrentProcesses: Math.min(4, os.cpus().length),
      testSDKOptions: {
        mockLevel: 'session_only',
        sessionBehavior: 'isolated',
        authentication: 'mock',
        processIsolation: true,
        enableLogging: false,
        enableHandleTracking: true
      },
      nodeOptions: ['--max-old-space-size=512'],
      envOverrides: {},
      workingDirectory: process.cwd(),
      enableIPC: true,
      ipcTimeout: 5000,
      heartbeatInterval: 1000,
      enableProcessLogging: false,
      logLevel: 'error',
      preserveProcessOnFailure: false,
      ...options
    };

    this.handleTracker = ProcessHandleTracker.getInstance(this.logger);
    this.setupShutdownHandlers();
    this.logger.info('IsolatedTestRunner initialized', { 
      maxConcurrentProcesses: this.defaultOptions.maxConcurrentProcesses,
      nodeOptions: this.defaultOptions.nodeOptions
    });
  }

  /**
   * Run a test function in an isolated Node.js process
   */
  async runIsolatedTest(
    testFunction: string | Function,
    args: any[] = [],
    options: Partial<IsolatedTestOptions> = {}
  ): Promise<IsolatedTestResult> {
    const effectiveOptions = { ...this.defaultOptions, ...options };
    
    // Wait for available process slot
    await this.waitForProcessSlot(effectiveOptions.maxConcurrentProcesses);
    
    const processId = ++this.processCounter;
    const startTime = Date.now();
    
    this.logger.info('Starting isolated test process', { 
      processId, 
      testFunction: typeof testFunction === 'string' ? testFunction : testFunction.name,
      concurrentProcesses: this.activeProcesses.size 
    });

    try {
      // Create test script for child process
      const testScript = await this.createTestScript(testFunction, args, effectiveOptions);
      const scriptPath = await this.writeTemporaryScript(testScript, processId);
      
      // Spawn child process
      const childProcess = await this.spawnTestProcess(scriptPath, effectiveOptions);
      const spawnTime = Date.now() - startTime;
      
      // Register process info
      const processInfo: TestProcessInfo = {
        processId,
        childProcess,
        startTime,
        testFunction: typeof testFunction === 'string' ? testFunction : testFunction.name,
        options: effectiveOptions,
        status: 'running',
        stdout: [],
        stderr: [],
        ipcMessages: [],
        heartbeatCount: 0,
        lastHeartbeat: Date.now()
      };
      
      this.activeProcesses.set(processId, processInfo);
      this.updateConcurrencyStats();
      
      // Setup IPC if enabled
      if (effectiveOptions.enableIPC) {
        this.setupIPC(processInfo);
      }
      
      // Setup heartbeat monitoring
      const heartbeatTimer = this.setupHeartbeatMonitoring(processInfo);
      
      // Setup process timeout
      const timeoutTimer = this.setupProcessTimeout(processInfo);
      
      try {
        // Wait for process completion
        const result = await this.waitForProcessCompletion(processInfo);
        
        // Clear timers
        clearTimeout(heartbeatTimer);
        clearTimeout(timeoutTimer);
        
        // Cleanup process resources
        await this.cleanupProcess(processInfo);
        
        // Update statistics
        this.updateStats(result, spawnTime);
        
        // Clean up temporary script
        await this.cleanupTemporaryScript(scriptPath);
        
        this.logger.info('Isolated test process completed', { 
          processId, 
          success: result.success, 
          duration: result.duration,
          exitCode: result.exitCode
        });
        
        return result;
        
      } catch (error: any) {
        // Clear timers on error
        clearTimeout(heartbeatTimer);
        clearTimeout(timeoutTimer);
        
        // Force cleanup on error
        await this.forceCleanupProcess(processInfo, error.message);
        
        // Clean up temporary script
        await this.cleanupTemporaryScript(scriptPath);
        
        throw error;
      }
      
    } catch (error: any) {
      this.stats.failedTests++;
      this.logger.error('Failed to run isolated test', { processId, error: error.message });
      
      return {
        success: false,
        exitCode: null,
        signal: null,
        duration: Date.now() - startTime,
        stdout: '',
        stderr: '',
        error: error.message,
        processId,
        spawnTime: 0,
        cleanupTime: 0
      };
    }
  }

  /**
   * Wait for an available process slot
   */
  private async waitForProcessSlot(maxConcurrent: number): Promise<void> {
    while (this.activeProcesses.size >= maxConcurrent && !this.isShuttingDown) {
      this.logger.debug('Waiting for process slot', { 
        active: this.activeProcesses.size, 
        max: maxConcurrent 
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.isShuttingDown) {
      throw new Error('Test runner is shutting down');
    }
  }

  /**
   * Create test script content for child process execution
   */
  private async createTestScript(
    testFunction: string | Function,
    args: any[],
    options: IsolatedTestOptions
  ): Promise<string> {
    const testFunctionStr = typeof testFunction === 'function' 
      ? testFunction.toString() 
      : testFunction;
    
    const scriptContent = `
const { TestSDKFactory } = require('${path.resolve(__dirname, 'TestSDKFactory.js')}');
const ProcessHandleTracker = require('${path.resolve(__dirname, 'ProcessHandleTracker.js')}').default;

// Process management
const processId = process.pid;
const startTime = Date.now();
let testInstance = null;
let handleTracker = null;

// IPC setup
const sendIPC = (type, data = null) => {
  if (process.send) {
    process.send({
      type,
      timestamp: Date.now(),
      processId,
      data,
      correlationId: \`test-\${processId}-\${Date.now()}\`
    });
  }
};

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in test process:', error);
  sendIPC('error', { message: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection in test process:', reason);
  sendIPC('error', { message: \`Unhandled rejection: \${reason}\`, promise: promise.toString() });
  process.exit(1);
});

// Heartbeat
if (${options.enableIPC}) {
  setInterval(() => {
    sendIPC('heartbeat', { 
      uptime: Date.now() - startTime,
      memoryUsage: process.memoryUsage(),
      handleCount: handleTracker ? handleTracker.getStatistics().totalHandles : 0
    });
  }, ${options.heartbeatInterval});
}

// Main test execution
async function runTest() {
  try {
    sendIPC('ready');
    
    // Create test SDK instance
    const testSDKOptions = ${JSON.stringify(options.testSDKOptions)};
    testInstance = TestSDKFactory.createIsolated(testSDKOptions);
    handleTracker = testInstance.handleTracker;
    
    sendIPC('test_start', { testFunction: \`${typeof testFunction === 'string' ? testFunction : testFunction.name}\` });
    
    // Execute test function
    const testFunc = ${testFunctionStr};
    const args = ${JSON.stringify(args)};
    
    let result;
    if (typeof testFunc === 'function') {
      result = await testFunc(...args, testInstance);
    } else {
      // If it's a string, assume it's a module path or eval-able code
      result = await eval(testFunc);
    }
    
    sendIPC('test_result', { 
      success: true, 
      result,
      memoryUsage: process.memoryUsage(),
      handleStats: handleTracker ? handleTracker.getStatistics() : null
    });
    
    // Cleanup
    await cleanup();
    process.exit(0);
    
  } catch (error) {
    console.error('Test execution failed:', error);
    sendIPC('test_result', { 
      success: false, 
      error: error.message, 
      stack: error.stack,
      memoryUsage: process.memoryUsage()
    });
    
    await cleanup();
    process.exit(1);
  }
}

async function cleanup() {
  try {
    sendIPC('cleanup', { phase: 'start' });
    
    if (testInstance && testInstance.cleanup) {
      await testInstance.cleanup();
    }
    
    if (handleTracker) {
      const cleanupResult = await handleTracker.forceCleanupAll({
        maxWaitTime: ${options.cleanupTimeout},
        forceKillAfter: Math.min(${options.cleanupTimeout} / 2, 5000),
        enableSigkillFallback: false, // Don't kill the process itself
        logCleanupProgress: ${options.enableProcessLogging}
      });
      
      sendIPC('cleanup', { 
        phase: 'complete', 
        handleCleanupResult: cleanupResult 
      });
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
    sendIPC('error', { message: \`Cleanup failed: \${error.message}\` });
  }
}

// Start test execution
runTest().catch(console.error);
`;
    
    return scriptContent;
  }

  /**
   * Write temporary test script file
   */
  private async writeTemporaryScript(content: string, processId: number): Promise<string> {
    const fs = require('fs').promises;
    const tempDir = os.tmpdir();
    const scriptPath = path.join(tempDir, `isolated-test-${processId}-${Date.now()}.js`);
    
    await fs.writeFile(scriptPath, content, 'utf8');
    
    // Register cleanup handle
    this.handleTracker.registerHandle('custom', {
      scriptPath,
      cleanup: async () => {
        try {
          await fs.unlink(scriptPath);
        } catch (error) {
          // File might already be deleted
        }
      }
    }, `temp-script-${processId}`, { temporary: true, processId });
    
    return scriptPath;
  }

  /**
   * Spawn child test process
   */
  private async spawnTestProcess(
    scriptPath: string,
    options: IsolatedTestOptions
  ): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      const spawnTimeout = setTimeout(() => {
        reject(new Error(`Process spawn timeout after ${options.spawnTimeout}ms`));
      }, options.spawnTimeout);
      
      try {
        const childProcess = fork(scriptPath, [], {
          stdio: options.enableProcessLogging ? ['pipe', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe', 'ipc'],
          cwd: options.workingDirectory || process.cwd(),
          env: {
            ...process.env,
            ...options.envOverrides,
            ACC_ISOLATED_TEST: 'true',
            ACC_PROCESS_ISOLATION: 'true',
            NODE_ENV: 'test'
          },
          execArgv: options.nodeOptions || []
        });
        
        // Handle spawn success
        childProcess.once('spawn', () => {
          clearTimeout(spawnTimeout);
          
          // Register with handle tracker
          this.handleTracker.registerHandle('childprocess', childProcess, 
            `isolated-test-process`, { 
              testProcess: true, 
              spawnTime: Date.now() 
            });
          
          resolve(childProcess);
        });
        
        // Handle spawn error
        childProcess.once('error', (error) => {
          clearTimeout(spawnTimeout);
          reject(new Error(`Failed to spawn test process: ${error.message}`));
        });
        
      } catch (error: any) {
        clearTimeout(spawnTimeout);
        reject(new Error(`Process spawn error: ${error.message}`));
      }
    });
  }

  /**
   * Setup Inter-Process Communication
   */
  private setupIPC(processInfo: TestProcessInfo): void {
    if (!processInfo.childProcess || !processInfo.options.enableIPC) {
      return;
    }
    
    processInfo.childProcess.on('message', (message: IPCMessage) => {
      message.timestamp = message.timestamp || Date.now();
      processInfo.ipcMessages.push(message);
      
      this.logger.debug('IPC message received', { 
        processId: processInfo.processId,
        type: message.type,
        data: message.data 
      });
      
      switch (message.type) {
        case 'ready':
          processInfo.status = 'running';
          this.emit('process_ready', { processInfo, message });
          break;
          
        case 'test_start':
          this.emit('test_start', { processInfo, message });
          break;
          
        case 'test_progress':
          this.emit('test_progress', { processInfo, message });
          break;
          
        case 'test_result':
          this.emit('test_result', { processInfo, message });
          break;
          
        case 'error':
          processInfo.status = 'failed';
          this.emit('test_error', { processInfo, message });
          break;
          
        case 'heartbeat':
          processInfo.lastHeartbeat = Date.now();
          processInfo.heartbeatCount++;
          if (message.data?.memoryUsage) {
            const memUsage = message.data.memoryUsage.heapUsed;
            if (memUsage > this.stats.peakMemoryUsage) {
              this.stats.peakMemoryUsage = memUsage;
            }
          }
          break;
          
        case 'cleanup':
          if (message.data?.phase === 'complete') {
            processInfo.status = 'completing';
            this.emit('cleanup_complete', { processInfo, message });
          }
          break;
      }
    });
  }

  /**
   * Setup heartbeat monitoring for process health
   */
  private setupHeartbeatMonitoring(processInfo: TestProcessInfo): NodeJS.Timeout {
    if (!processInfo.options.enableIPC) {
      return setTimeout(() => {}, 0); // Dummy timer
    }
    
    return setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - processInfo.lastHeartbeat;
      const maxHeartbeatGap = processInfo.options.heartbeatInterval * 3; // Allow 3 missed heartbeats
      
      if (timeSinceLastHeartbeat > maxHeartbeatGap && processInfo.status === 'running') {
        this.logger.warning('Process heartbeat timeout', { 
          processId: processInfo.processId,
          timeSinceLastHeartbeat,
          maxAllowed: maxHeartbeatGap
        });
        
        processInfo.status = 'timeout';
        this.emit('heartbeat_timeout', { processInfo });
      }
    }, processInfo.options.heartbeatInterval);
  }

  /**
   * Setup process execution timeout
   */
  private setupProcessTimeout(processInfo: TestProcessInfo): NodeJS.Timeout {
    return setTimeout(async () => {
      if (processInfo.status === 'running' || processInfo.status === 'spawning') {
        this.logger.warning('Process execution timeout', { 
          processId: processInfo.processId,
          timeout: processInfo.options.processTimeout
        });
        
        processInfo.status = 'timeout';
        this.stats.timeoutTests++;
        
        await this.forceCleanupProcess(processInfo, 'Process timeout');
      }
    }, processInfo.options.processTimeout);
  }

  /**
   * Wait for process completion
   */
  private async waitForProcessCompletion(processInfo: TestProcessInfo): Promise<IsolatedTestResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      
      // Collect output if logging is enabled
      if (processInfo.options.enableProcessLogging && processInfo.childProcess.stdout) {
        processInfo.childProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          processInfo.stdout.push(output);
        });
      }
      
      if (processInfo.childProcess.stderr) {
        processInfo.childProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          processInfo.stderr.push(output);
        });
      }
      
      // Handle process exit
      processInfo.childProcess.once('exit', async (code, signal) => {
        const duration = Date.now() - startTime;
        
        // Get test results from IPC if available
        const testResultMessage = processInfo.ipcMessages.find(msg => msg.type === 'test_result');
        const cleanupMessage = processInfo.ipcMessages.find(msg => 
          msg.type === 'cleanup' && msg.data?.phase === 'complete'
        );
        
        const result: IsolatedTestResult = {
          success: code === 0 && (!testResultMessage || testResultMessage.data?.success),
          exitCode: code,
          signal,
          duration,
          stdout,
          stderr,
          testResults: testResultMessage?.data || null,
          processId: processInfo.processId,
          spawnTime: 0, // Will be set by caller
          cleanupTime: 0, // Will be set by caller
          handleStats: cleanupMessage?.data?.handleCleanupResult
        };
        
        // Check for test-specific errors
        if (testResultMessage?.data && !testResultMessage.data.success) {
          result.error = testResultMessage.data.error || 'Test execution failed';
        }
        
        // Get memory usage from last heartbeat
        const lastHeartbeat = processInfo.ipcMessages
          .filter(msg => msg.type === 'heartbeat' && msg.data?.memoryUsage)
          .pop();
        if (lastHeartbeat?.data?.memoryUsage) {
          result.memoryUsage = lastHeartbeat.data.memoryUsage;
        }
        
        processInfo.status = result.success ? 'completed' : 'failed';
        resolve(result);
      });
      
      // Handle process error
      processInfo.childProcess.once('error', (error) => {
        processInfo.status = 'failed';
        reject(new Error(`Child process error: ${error.message}`));
      });
      
      // Handle timeout from heartbeat monitoring
      this.once('heartbeat_timeout', (event) => {
        if (event.processInfo.processId === processInfo.processId) {
          reject(new Error('Process heartbeat timeout'));
        }
      });
    });
  }

  /**
   * Clean up process resources gracefully
   */
  private async cleanupProcess(processInfo: TestProcessInfo): Promise<number> {
    const cleanupStartTime = Date.now();
    
    try {
      // Remove from active processes
      this.activeProcesses.delete(processInfo.processId);
      this.updateConcurrencyStats();
      
      // Close IPC channel if it exists
      if (processInfo.childProcess && processInfo.childProcess.connected) {
        processInfo.childProcess.disconnect();
      }
      
      // The process should have exited already, but ensure cleanup
      if (processInfo.childProcess && !processInfo.childProcess.killed) {
        processInfo.childProcess.kill('SIGTERM');
        
        // Wait briefly for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Force kill if still running
        if (!processInfo.childProcess.killed) {
          processInfo.childProcess.kill('SIGKILL');
        }
      }
      
      this.logger.debug('Process cleanup completed', { 
        processId: processInfo.processId,
        cleanupTime: Date.now() - cleanupStartTime
      });
      
    } catch (error: any) {
      this.logger.error('Process cleanup failed', { 
        processId: processInfo.processId,
        error: error.message 
      });
    }
    
    return Date.now() - cleanupStartTime;
  }

  /**
   * Force cleanup process (emergency)
   */
  private async forceCleanupProcess(processInfo: TestProcessInfo, reason: string): Promise<void> {
    this.logger.warning('Force cleaning up process', { 
      processId: processInfo.processId, 
      reason 
    });
    
    try {
      processInfo.status = 'failed';
      
      // Remove from tracking immediately
      this.activeProcesses.delete(processInfo.processId);
      this.updateConcurrencyStats();
      
      // Disconnect IPC
      if (processInfo.childProcess && processInfo.childProcess.connected) {
        processInfo.childProcess.disconnect();
      }
      
      // Kill process immediately
      if (processInfo.childProcess && !processInfo.childProcess.killed) {
        processInfo.childProcess.kill('SIGKILL');
      }
      
      // Don't preserve process even if option is set for force cleanup
      
    } catch (error: any) {
      this.logger.error('Force cleanup failed', { 
        processId: processInfo.processId,
        error: error.message 
      });
    }
  }

  /**
   * Clean up temporary script file
   */
  private async cleanupTemporaryScript(scriptPath: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      await fs.unlink(scriptPath);
    } catch (error: any) {
      this.logger.debug('Failed to cleanup temporary script', { scriptPath, error: error.message });
    }
  }

  /**
   * Update concurrency statistics
   */
  private updateConcurrencyStats(): void {
    this.stats.currentConcurrentProcesses = this.activeProcesses.size;
    if (this.stats.currentConcurrentProcesses > this.stats.maxConcurrentProcesses) {
      this.stats.maxConcurrentProcesses = this.stats.currentConcurrentProcesses;
    }
  }

  /**
   * Update overall statistics
   */
  private updateStats(result: IsolatedTestResult, spawnTime: number): void {
    this.stats.totalProcessesSpawned++;
    
    if (result.success) {
      this.stats.successfulTests++;
    } else {
      this.stats.failedTests++;
    }
    
    // Update timing averages
    this.stats.averageSpawnTime = this.updateAverage(this.stats.averageSpawnTime, spawnTime, this.stats.totalProcessesSpawned);
    this.stats.averageExecutionTime = this.updateAverage(this.stats.averageExecutionTime, result.duration, this.stats.totalProcessesSpawned);
    this.stats.averageCleanupTime = this.updateAverage(this.stats.averageCleanupTime, result.cleanupTime, this.stats.totalProcessesSpawned);
    
    this.stats.totalExecutionTime += result.duration;
  }

  /**
   * Update running average
   */
  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  /**
   * Setup process shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal as NodeJS.Signals, () => {
        this.logger.info(`Received ${signal} - initiating test runner shutdown`);
        this.shutdown().then(() => {
          process.exit(0);
        }).catch(() => {
          process.exit(1);
        });
      });
    });

    process.on('beforeExit', () => {
      if (this.activeProcesses.size > 0) {
        this.logger.warning(`Process exiting with ${this.activeProcesses.size} active test processes`);
      }
    });
  }

  /**
   * Shutdown the test runner and cleanup all processes
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    this.logger.info('Shutting down isolated test runner', { 
      activeProcesses: this.activeProcesses.size 
    });
    
    // Force cleanup all active processes
    const cleanupPromises = Array.from(this.activeProcesses.values()).map(processInfo => 
      this.forceCleanupProcess(processInfo, 'Shutdown requested')
    );
    
    await Promise.all(cleanupPromises);
    
    // Clear all tracking
    this.activeProcesses.clear();
    this.processPool.clear();
    
    this.logger.info('Isolated test runner shutdown complete');
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      activeProcesses: this.activeProcesses.size,
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * Get active process information
   */
  getActiveProcesses(): TestProcessInfo[] {
    return Array.from(this.activeProcesses.values());
  }

  /**
   * Kill a specific process
   */
  async killProcess(processId: number, signal: NodeJS.Signals = 'SIGTERM'): Promise<boolean> {
    const processInfo = this.activeProcesses.get(processId);
    if (!processInfo) {
      return false;
    }
    
    this.logger.info('Killing test process', { processId, signal });
    
    try {
      if (processInfo.childProcess && !processInfo.childProcess.killed) {
        processInfo.childProcess.kill(signal);
        
        // Wait for process to exit
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Force kill if graceful shutdown failed
            if (!processInfo.childProcess.killed) {
              processInfo.childProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
          
          processInfo.childProcess.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        
        await this.cleanupProcess(processInfo);
        return true;
      }
    } catch (error: any) {
      this.logger.error('Failed to kill process', { processId, error: error.message });
    }
    
    return false;
  }

  /**
   * Check if runner is healthy
   */
  isHealthy(): boolean {
    return !this.isShuttingDown && 
           this.activeProcesses.size <= this.defaultOptions.maxConcurrentProcesses;
  }

  /**
   * Wait for all active processes to complete
   */
  async waitForAllProcesses(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (this.activeProcesses.size > 0 && (Date.now() - startTime) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeProcesses.size > 0) {
      throw new Error(`Timeout waiting for ${this.activeProcesses.size} processes to complete`);
    }
  }
}

export default IsolatedTestRunner;