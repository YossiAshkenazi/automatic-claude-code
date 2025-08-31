const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const platformDetection = require('./platform-detection.js');
const ErrorHandler = require('./error-handler.js');

/**
 * Universal Hook Wrapper - Routes hook calls to appropriate platform-specific implementations
 */
class UniversalHookWrapper {
  constructor(options = {}) {
    this.debug = options.debug || process.env.DEBUG === 'true';
    this.timeout = options.timeout || 2000; // 2 second default timeout (as per requirements)
    this.hookDir = options.hookDir || path.join(__dirname, '..', 'universal-hooks');
    this.maxRetries = options.maxRetries || 3;
    this.enableFallback = options.enableFallback !== false; // Default true
    this.errorHandler = new ErrorHandler({ debug: this.debug });
  }

  /**
   * Log debug messages if debug mode is enabled
   * @param {string} message - Debug message
   */
  _debug(message) {
    if (this.debug) {
      console.log(`[DEBUG] UniversalHookWrapper: ${message}`);
    }
  }

  /**
   * Get the appropriate script path for the current platform
   * @param {string} hookName - Name of the hook (e.g., 'user-prompt-submit-hook')
   * @param {string} platform - Platform identifier from platformDetection
   * @returns {string} - Absolute path to the platform-specific script
   */
  getScriptPath(hookName, platform) {
    const extension = this._getScriptExtension(platform);
    const scriptName = `${hookName}${extension}`;
    const scriptPath = path.resolve(this.hookDir, scriptName);
    
    this._debug(`Resolved script path: ${scriptPath} for platform: ${platform}`);
    return scriptPath;
  }

  /**
   * Get the appropriate script extension for the platform
   * @param {string} platform - Platform identifier
   * @returns {string} - File extension (.ps1, .sh)
   */
  _getScriptExtension(platform) {
    switch (platform) {
      case 'windows':
      case 'cygwin':
        return '.ps1';
      case 'wsl':
      case 'linux':
      case 'macos':
      case 'mingw':
        return '.sh';
      default:
        this._debug(`Unknown platform: ${platform}, defaulting to .sh`);
        return '.sh';
    }
  }

  /**
   * Get the appropriate command executor for the platform
   * @param {string} platform - Platform identifier
   * @param {string} scriptPath - Path to the script
   * @returns {object} - Command and arguments for execution
   */
  _getExecutionCommand(platform, scriptPath) {
    switch (platform) {
      case 'windows':
        return {
          command: 'powershell.exe',
          args: ['-ExecutionPolicy', 'Bypass', '-File', scriptPath]
        };
      case 'cygwin':
        // Cygwin can run PowerShell scripts if available
        return {
          command: 'powershell.exe',
          args: ['-ExecutionPolicy', 'Bypass', '-File', scriptPath]
        };
      case 'wsl':
      case 'linux':
      case 'macos':
        return {
          command: 'bash',
          args: [scriptPath]
        };
      case 'mingw':
        // Git Bash environment
        return {
          command: 'bash',
          args: [scriptPath]
        };
      default:
        this._debug(`Unknown platform: ${platform}, defaulting to bash`);
        return {
          command: 'bash',
          args: [scriptPath]
        };
    }
  }

  /**
   * Validate that the platform-specific script exists
   * @param {string} scriptPath - Path to the script
   * @returns {Promise<boolean>} - True if script exists and is accessible
   */
  async validateScript(scriptPath) {
    try {
      await fs.promises.access(scriptPath, fs.constants.F_OK | fs.constants.R_OK);
      this._debug(`Script validation passed: ${scriptPath}`);
      return true;
    } catch (error) {
      this._debug(`Script validation failed: ${scriptPath} - ${error.message}`);
      return false;
    }
  }

  /**
   * Create JSON data from Claude environment variables
   * @returns {string|null} - JSON string or null if no data available
   */
  _createClaudeJSON() {
    const env = process.env;
    
    // Check if we have any Claude environment variables
    const claudeVars = Object.keys(env).filter(key => key.startsWith('CLAUDE_'));
    if (claudeVars.length === 0) {
      this._debug('No Claude environment variables found');
      return null;
    }

    // Create JSON object from Claude environment variables with proper field mapping
    const claudeData = {
      session_id: env.CLAUDE_SESSION_ID || '',
      cwd: env.CLAUDE_CWD || env.CLAUDE_PROJECT_PATH || env.PWD || process.cwd(),
      transcript_path: env.CLAUDE_TRANSCRIPT_PATH || '',
      // Hook-specific data with proper field names
      prompt: env.CLAUDE_PROMPT || env.CLAUDE_USER_PROMPT || env.CLAUDE_MESSAGE || '',
      message: env.CLAUDE_MESSAGE || env.CLAUDE_NOTIFICATION_MESSAGE || '',
      tool_name: env.CLAUDE_TOOL_NAME || '',
      tool_args: env.CLAUDE_TOOL_ARGS || '',
      tool_result: env.CLAUDE_TOOL_RESULT || '',
      // Additional context
      user: env.CLAUDE_USER || env.USERNAME || env.USER || '',
      platform: platformDetection.detectPlatform(),
      timestamp: new Date().toISOString()
    };

    // Remove empty values
    Object.keys(claudeData).forEach(key => {
      if (!claudeData[key]) {
        delete claudeData[key];
      }
    });

    const jsonString = JSON.stringify(claudeData);
    this._debug(`Created Claude JSON data: ${jsonString}`);
    return jsonString;
  }

  /**
   * Get fallback execution strategies for a platform
   * @param {string} platform - Platform identifier
   * @param {string} hookName - Name of the hook
   * @returns {Array} - Array of execution strategies to try
   */
  _getFallbackStrategies(platform, hookName) {
    const strategies = [];
    
    // Primary strategy based on platform
    switch (platform) {
      case 'windows':
        strategies.push(
          { type: 'powershell', extension: '.ps1', command: 'powershell.exe', args: ['-ExecutionPolicy', 'Bypass', '-File'] },
          { type: 'node', extension: '.js', command: 'node', args: [] },
          { type: 'bash', extension: '.sh', command: 'bash', args: [] } // WSL fallback
        );
        break;
      case 'wsl':
      case 'linux':
      case 'macos':
        strategies.push(
          { type: 'bash', extension: '.sh', command: 'bash', args: [] },
          { type: 'node', extension: '.js', command: 'node', args: [] },
          { type: 'powershell', extension: '.ps1', command: 'pwsh', args: ['-ExecutionPolicy', 'Bypass', '-File'] } // PowerShell Core
        );
        break;
      case 'mingw':
        strategies.push(
          { type: 'bash', extension: '.sh', command: 'bash', args: [] },
          { type: 'node', extension: '.js', command: 'node', args: [] },
          { type: 'powershell', extension: '.ps1', command: 'powershell.exe', args: ['-ExecutionPolicy', 'Bypass', '-File'] }
        );
        break;
      case 'cygwin':
        strategies.push(
          { type: 'bash', extension: '.sh', command: 'bash', args: [] },
          { type: 'powershell', extension: '.ps1', command: 'powershell.exe', args: ['-ExecutionPolicy', 'Bypass', '-File'] },
          { type: 'node', extension: '.js', command: 'node', args: [] }
        );
        break;
      default:
        strategies.push(
          { type: 'bash', extension: '.sh', command: 'bash', args: [] },
          { type: 'node', extension: '.js', command: 'node', args: [] }
        );
    }
    
    return strategies;
  }

  /**
   * Execute a hook with retry and fallback logic
   * @param {string} hookName - Name of the hook
   * @param {Array<string>} args - Arguments to pass to the hook
   * @param {object} options - Execution options
   * @returns {Promise<object>} - Execution result with stdout, stderr, exitCode
   */
  async executeHookWithFallback(hookName, args = [], options = {}) {
    const startTime = Date.now();
    const platform = platformDetection.detectPlatform();
    const strategies = this._getFallbackStrategies(platform, hookName);
    const maxRetries = options.maxRetries || 3;
    
    let lastError = null;
    let attemptResults = [];

    this._debug(`Attempting hook execution with ${strategies.length} fallback strategies`);

    // Try each strategy
    for (let strategyIndex = 0; strategyIndex < strategies.length; strategyIndex++) {
      const strategy = strategies[strategyIndex];
      const scriptPath = path.resolve(this.hookDir, `${hookName}${strategy.extension}`);
      
      this._debug(`Strategy ${strategyIndex + 1}/${strategies.length}: ${strategy.type} (${scriptPath})`);

      // Check if script exists
      if (!await this.validateScript(scriptPath)) {
        this._debug(`Script not found: ${scriptPath}`);
        attemptResults.push({
          strategy: strategy.type,
          error: `Script not found: ${scriptPath}`,
          skipped: true
        });
        continue;
      }

      // Try execution with exponential backoff retry
      for (let retry = 0; retry < maxRetries; retry++) {
        if (retry > 0) {
          const backoffDelay = Math.min(1000 * Math.pow(2, retry - 1), 5000);
          this._debug(`Retry ${retry + 1}/${maxRetries} after ${backoffDelay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }

        try {
          const result = await this._executeStrategy(strategy, scriptPath, args, options);
          
          if (result.exitCode === 0) {
            this._debug(`Hook execution successful with strategy: ${strategy.type}`);
            return {
              ...result,
              executionTime: Date.now() - startTime,
              strategy: strategy.type,
              attempts: attemptResults.length + 1,
              retryCount: retry
            };
          } else {
            this._debug(`Strategy ${strategy.type} failed with exit code: ${result.exitCode}`);
            lastError = result.error || new Error(`Process exited with code ${result.exitCode}`);
            
            attemptResults.push({
              strategy: strategy.type,
              retry,
              exitCode: result.exitCode,
              stderr: result.stderr,
              error: lastError.message
            });
          }
        } catch (error) {
          this._debug(`Strategy ${strategy.type} failed with error: ${error.message}`);
          lastError = error;
          
          // Get detailed error analysis
          const errorAnalysis = await this.errorHandler.handleError(error, {
            strategy: strategy.type,
            hookName,
            platform,
            command: strategy.command,
            retry,
            timeout: options.timeout || this.timeout
          });
          
          attemptResults.push({
            strategy: strategy.type,
            retry,
            error: error.message,
            errorAnalysis
          });
          
          // Don't retry on certain errors
          if (error.code === 'ENOENT' || error.message.includes('not found') || 
              errorAnalysis.category === 'COMMAND_NOT_FOUND') {
            this._debug(`Skipping retries for ${strategy.type} - command not available`);
            break; // Command not available, try next strategy
          }
          
          // Don't retry on permission errors either
          if (errorAnalysis.category === 'PERMISSION_DENIED') {
            this._debug(`Skipping retries for ${strategy.type} - permission denied`);
            break;
          }
        }
      }
    }

    // All strategies failed - create minimal fallback
    this._debug('All strategies failed, creating minimal fallback response');
    const minimalResult = this._createMinimalFallback(hookName, options);
    
    return {
      ...minimalResult,
      executionTime: Date.now() - startTime,
      error: lastError,
      allAttemptsFailure: true,
      attemptResults
    };
  }

  /**
   * Execute a specific strategy
   * @param {object} strategy - Execution strategy
   * @param {string} scriptPath - Path to the script
   * @param {Array<string>} args - Arguments to pass
   * @param {object} options - Execution options
   * @returns {Promise<object>} - Execution result
   */
  async _executeStrategy(strategy, scriptPath, args = [], options = {}) {
    const allArgs = [...strategy.args, scriptPath, ...args];
    const claudeData = this._createClaudeJSON();
    const timeout = options.timeout || this.timeout;

    this._debug(`Executing strategy: ${strategy.command} ${allArgs.join(' ')}`);

    return new Promise((resolve) => {
      const child = spawn(strategy.command, allArgs, {
        env: { ...process.env, ...options.env },
        cwd: options.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;

      // Send JSON data to stdin if available
      if (claudeData && child.stdin) {
        this._debug(`Sending JSON to stdin: ${claudeData.substring(0, 200)}...`);
        child.stdin.write(claudeData);
        child.stdin.end();
      }

      // Set up timeout with graceful termination
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          
          // Attempt graceful termination first
          child.kill('SIGTERM');
          
          // Force kill after 2 seconds
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 2000);

          resolve({
            stdout,
            stderr: stderr + `\nProcess timed out after ${timeout}ms`,
            exitCode: 124,
            error: new Error(`Process timed out after ${timeout}ms`)
          });
        }
      }, timeout);

      // Handle output
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      // Handle completion
      child.on('close', (code, signal) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          
          resolve({
            stdout,
            stderr,
            exitCode: code || 0,
            signal
          });
        }
      });

      // Handle errors
      child.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          
          resolve({
            stdout,
            stderr: stderr + `\nExecution error: ${error.message}`,
            exitCode: 1,
            error
          });
        }
      });
    });
  }

  /**
   * Create minimal fallback when all strategies fail
   * @param {string} hookName - Name of the hook
   * @param {object} options - Execution options
   * @returns {object} - Minimal result object
   */
  _createMinimalFallback(hookName, options = {}) {
    this._debug(`Creating minimal fallback for hook: ${hookName}`);
    
    // Create basic event data from environment
    const claudeData = this._createClaudeJSON();
    let minimalEvent = null;
    
    if (claudeData) {
      try {
        const data = JSON.parse(claudeData);
        const projectName = data.cwd ? path.basename(data.cwd) : 'unknown-project';
        
        // Create minimal event based on hook type
        minimalEvent = {
          source_app: projectName,
          session_id: data.session_id || 'fallback-session',
          hook_event_type: this._getEventTypeFromHookName(hookName),
          payload: {
            message: data.message || data.prompt || `Fallback event for ${hookName}`,
            timestamp: new Date().toISOString(),
            cwd: data.cwd,
            fallback_mode: true,
            platform: data.platform
          }
        };
        
        this._debug(`Created minimal fallback event: ${JSON.stringify(minimalEvent, null, 2)}`);
      } catch (error) {
        this._debug(`Failed to create minimal event: ${error.message}`);
      }
    }

    return {
      stdout: minimalEvent ? JSON.stringify(minimalEvent) : '',
      stderr: 'All hook execution strategies failed - using fallback mode',
      exitCode: minimalEvent ? 0 : 1,
      fallbackMode: true
    };
  }

  /**
   * Convert hook name to event type
   * @param {string} hookName - Name of the hook
   * @returns {string} - Event type
   */
  _getEventTypeFromHookName(hookName) {
    const mapping = {
      'user-prompt-submit-hook': 'UserPromptSubmit',
      'pre-tool-use-hook': 'PreToolUse',
      'post-tool-use-hook': 'PostToolUse',
      'notification-hook': 'Notification',
      'pre-compact-hook': 'PreCompact',
      'stop-hook': 'Stop',
      'subagent-stop-hook': 'SubagentStop'
    };
    
    return mapping[hookName] || 'Unknown';
  }

  /**
   * Execute a hook with the given arguments (LEGACY METHOD - kept for compatibility)
   * @param {string} hookName - Name of the hook
   * @param {Array<string>} args - Arguments to pass to the hook
   * @param {object} options - Execution options
   * @returns {Promise<object>} - Execution result with stdout, stderr, exitCode
   */
  async executeHook(hookName, args = [], options = {}) {
    // Redirect to new fallback-aware method
    return this.executeHookWithFallback(hookName, args, options);
  }

  /**
   * Execute a hook with automatic platform detection and error handling
   * This is the main entry point for universal hook execution
   * @param {string} hookName - Name of the hook
   * @param {Array<string>} args - Arguments to pass to the hook
   * @param {object} options - Execution options
   * @returns {Promise<object>} - Execution result
   */
  async run(hookName, args = [], options = {}) {
    try {
      const result = await this.executeHook(hookName, args, options);
      
      // Log performance warning if execution is slow
      if (result.executionTime > 50) {
        this._debug(`WARNING: Hook execution took ${result.executionTime}ms (> 50ms threshold)`);
      }

      return result;
    } catch (error) {
      this._debug(`Unexpected error during hook execution: ${error.message}`);
      return {
        stdout: '',
        stderr: `Unexpected error: ${error.message}`,
        exitCode: 1,
        error,
        executionTime: 0
      };
    }
  }

  /**
   * Get information about available hooks for the current platform
   * @returns {object} - Information about available hooks
   */
  async getHookInfo() {
    const platform = platformDetection.detectPlatform();
    const hookTypes = [
      'user-prompt-submit-hook',
      'pre-tool-use-hook',
      'post-tool-use-hook',
      'notification-hook',
      'pre-compact-hook',
      'stop-hook',
      'subagent-stop-hook'
    ];

    const hookInfo = {
      platform,
      availableHooks: [],
      missingHooks: []
    };

    for (const hookName of hookTypes) {
      const scriptPath = this.getScriptPath(hookName, platform);
      const exists = await this.validateScript(scriptPath);
      
      if (exists) {
        hookInfo.availableHooks.push({ name: hookName, path: scriptPath });
      } else {
        hookInfo.missingHooks.push({ name: hookName, expectedPath: scriptPath });
      }
    }

    return hookInfo;
  }
}

module.exports = UniversalHookWrapper;