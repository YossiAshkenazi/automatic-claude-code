const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Error Handler for Hook Execution
 * Provides detailed error analysis, categorization, and recovery suggestions
 */
class ErrorHandler {
  constructor(options = {}) {
    this.debug = options.debug || process.env.DEBUG === 'true';
    this.logErrors = options.logErrors !== false; // Default true
    this.logFile = options.logFile || path.join(os.tmpdir(), 'hook-errors.log');
  }

  /**
   * Log debug messages if debug mode is enabled
   * @param {string} message - Debug message
   */
  _debug(message) {
    if (this.debug) {
      console.log(`[DEBUG] ErrorHandler: ${message}`);
    }
  }

  /**
   * Log error to file if logging is enabled
   * @param {object} errorInfo - Error information object
   */
  async _logError(errorInfo) {
    if (!this.logErrors) return;

    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        ...errorInfo
      };
      
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.promises.appendFile(this.logFile, logLine);
    } catch (e) {
      // Silent fail - we don't want error logging to break the main process
    }
  }

  /**
   * Categorize error based on error message and context
   * @param {Error|string} error - Error object or message
   * @param {object} context - Execution context
   * @returns {string} - Error category
   */
  categorizeError(error, context = {}) {
    const message = error.message || error.toString();
    const code = error.code;
    
    // System-level errors
    if (code === 'ENOENT' || message.includes('not found') || message.includes('command not found')) {
      return 'COMMAND_NOT_FOUND';
    }
    
    if (code === 'EACCES' || message.includes('permission denied') || message.includes('access denied')) {
      return 'PERMISSION_DENIED';
    }
    
    if (code === 'ETIMEDOUT' || message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT';
    }
    
    if (code === 'ECONNREFUSED' || message.includes('connection refused') || message.includes('network')) {
      return 'NETWORK_ERROR';
    }
    
    // PowerShell-specific errors
    if (message.includes('execution policy') || message.includes('ExecutionPolicy')) {
      return 'POWERSHELL_EXECUTION_POLICY';
    }
    
    if (message.includes('powershell') && message.includes('not recognized')) {
      return 'POWERSHELL_NOT_INSTALLED';
    }
    
    // Bash-specific errors
    if (message.includes('bash: command not found') || message.includes('/bin/bash: No such file')) {
      return 'BASH_NOT_AVAILABLE';
    }
    
    // Script-specific errors
    if (message.includes('syntax error') || message.includes('unexpected token')) {
      return 'SCRIPT_SYNTAX_ERROR';
    }
    
    if (message.includes('Cannot bind argument')) {
      return 'SCRIPT_PARAMETER_ERROR';
    }
    
    // JSON/Data errors
    if (message.includes('JSON') || message.includes('parse')) {
      return 'DATA_PARSING_ERROR';
    }
    
    // Platform-specific errors
    if (message.includes('WSL') || message.includes('Windows Subsystem')) {
      return 'WSL_ERROR';
    }
    
    if (message.includes('Docker') || message.includes('container')) {
      return 'CONTAINER_ERROR';
    }
    
    // Hook-specific errors
    if (context.hookName && message.includes('hook')) {
      return 'HOOK_SPECIFIC_ERROR';
    }
    
    // Generic categories
    if (error.exitCode && error.exitCode !== 0) {
      return 'PROCESS_EXIT_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get detailed error analysis with recovery suggestions
   * @param {Error|string} error - Error object or message
   * @param {object} context - Execution context
   * @returns {object} - Detailed error analysis
   */
  analyzeError(error, context = {}) {
    const category = this.categorizeError(error, context);
    const message = error.message || error.toString();
    const platform = context.platform || os.platform();
    
    const analysis = {
      category,
      severity: this._getSeverity(category),
      platform,
      context,
      originalError: {
        message,
        code: error.code,
        exitCode: error.exitCode,
        signal: error.signal
      },
      diagnosis: this._getDiagnosis(category, error, context),
      solutions: this._getSolutions(category, platform, context),
      preventiveMeasures: this._getPreventiveMeasures(category, platform),
      escalationPath: this._getEscalationPath(category)
    };

    this._debug(`Error analysis completed: ${category} (${analysis.severity})`);
    return analysis;
  }

  /**
   * Get error severity level
   * @param {string} category - Error category
   * @returns {string} - Severity level
   */
  _getSeverity(category) {
    const severityMap = {
      'COMMAND_NOT_FOUND': 'HIGH',
      'PERMISSION_DENIED': 'HIGH',
      'POWERSHELL_NOT_INSTALLED': 'HIGH',
      'BASH_NOT_AVAILABLE': 'HIGH',
      'POWERSHELL_EXECUTION_POLICY': 'MEDIUM',
      'TIMEOUT': 'MEDIUM',
      'NETWORK_ERROR': 'MEDIUM',
      'SCRIPT_SYNTAX_ERROR': 'MEDIUM',
      'WSL_ERROR': 'MEDIUM',
      'SCRIPT_PARAMETER_ERROR': 'LOW',
      'DATA_PARSING_ERROR': 'LOW',
      'HOOK_SPECIFIC_ERROR': 'LOW',
      'CONTAINER_ERROR': 'LOW',
      'PROCESS_EXIT_ERROR': 'LOW',
      'UNKNOWN_ERROR': 'MEDIUM'
    };
    
    return severityMap[category] || 'MEDIUM';
  }

  /**
   * Get detailed diagnosis for error category
   * @param {string} category - Error category
   * @param {Error} error - Original error
   * @param {object} context - Execution context
   * @returns {string} - Detailed diagnosis
   */
  _getDiagnosis(category, error, context) {
    const diagnoses = {
      'COMMAND_NOT_FOUND': `The required command '${context.command || 'unknown'}' is not available in the system PATH. This prevents hook execution.`,
      'PERMISSION_DENIED': `Insufficient permissions to execute the hook script or access required resources. This may be due to file permissions or security policies.`,
      'POWERSHELL_EXECUTION_POLICY': `PowerShell execution policy is preventing script execution. Current policy may be set to Restricted.`,
      'POWERSHELL_NOT_INSTALLED': `PowerShell is not installed or not accessible. This is required for Windows hook execution.`,
      'BASH_NOT_AVAILABLE': `Bash shell is not available. This is required for Unix-like system hook execution.`,
      'TIMEOUT': `Hook execution exceeded the timeout limit (${context.timeout || 'unknown'}ms). This may indicate a hung process or slow network.`,
      'NETWORK_ERROR': `Network connectivity issues preventing communication with the observability server.`,
      'SCRIPT_SYNTAX_ERROR': `The hook script contains syntax errors that prevent execution.`,
      'WSL_ERROR': `Windows Subsystem for Linux related error. This may be due to WSL configuration or compatibility issues.`,
      'CONTAINER_ERROR': `Docker container related error. This may be due to container configuration or resource limitations.`,
      'SCRIPT_PARAMETER_ERROR': `The hook script received invalid or missing parameters.`,
      'DATA_PARSING_ERROR': `Failed to parse JSON data or other structured input.`,
      'HOOK_SPECIFIC_ERROR': `Error specific to the ${context.hookName || 'unknown'} hook implementation.`,
      'PROCESS_EXIT_ERROR': `The hook process exited with non-zero code ${error.exitCode}`,
      'UNKNOWN_ERROR': `An unexpected error occurred that doesn't match known error patterns.`
    };
    
    return diagnoses[category] || 'Unknown error condition.';
  }

  /**
   * Get solutions for error category
   * @param {string} category - Error category
   * @param {string} platform - Platform identifier
   * @param {object} context - Execution context
   * @returns {Array<string>} - Array of solution steps
   */
  _getSolutions(category, platform, context) {
    const solutionMap = {
      'COMMAND_NOT_FOUND': this._getCommandNotFoundSolutions(platform, context),
      'PERMISSION_DENIED': this._getPermissionSolutions(platform),
      'POWERSHELL_EXECUTION_POLICY': [
        'Run as Administrator: Set-ExecutionPolicy RemoteSigned',
        'Use Bypass for single execution: powershell -ExecutionPolicy Bypass -File script.ps1',
        'Check current policy: Get-ExecutionPolicy',
        'Consider using PowerShell Core (pwsh) which has different policies'
      ],
      'POWERSHELL_NOT_INSTALLED': this._getPowerShellInstallSolutions(platform),
      'BASH_NOT_AVAILABLE': this._getBashInstallSolutions(platform),
      'TIMEOUT': [
        'Increase timeout value in configuration',
        'Check network connectivity to observability server',
        'Verify hook script is not hanging on input/output',
        'Consider using background execution mode'
      ],
      'NETWORK_ERROR': [
        'Verify observability server is running on localhost:4000',
        'Check firewall settings',
        'Test network connectivity: curl http://localhost:4000/health',
        'Ensure Docker containers are running if using containerized setup'
      ],
      'SCRIPT_SYNTAX_ERROR': [
        'Review hook script syntax',
        'Check for missing quotes, brackets, or semicolons',
        'Test script execution manually',
        'Verify script encoding (UTF-8 recommended)'
      ],
      'WSL_ERROR': [
        'Restart WSL: wsl --shutdown && wsl',
        'Update WSL to version 2: wsl --set-default-version 2',
        'Check WSL distribution: wsl -l -v',
        'Reinstall WSL distribution if necessary'
      ],
      'CONTAINER_ERROR': [
        'Check Docker container status: docker ps',
        'Verify volume mounts are correct',
        'Check container logs: docker logs <container>',
        'Restart containers: docker-compose restart'
      ]
    };
    
    return solutionMap[category] || [
      'Review error logs for more details',
      'Try running hook manually for debugging',
      'Check system requirements and dependencies',
      'Contact support if issue persists'
    ];
  }

  /**
   * Get command not found solutions based on platform and context
   */
  _getCommandNotFoundSolutions(platform, context) {
    const command = context.command;
    const solutions = [];
    
    if (command === 'powershell' || command === 'powershell.exe') {
      solutions.push(...this._getPowerShellInstallSolutions(platform));
    } else if (command === 'bash') {
      solutions.push(...this._getBashInstallSolutions(platform));
    } else if (command === 'node') {
      solutions.push(...this._getNodeInstallSolutions(platform));
    } else if (command === 'curl') {
      solutions.push(...this._getCurlInstallSolutions(platform));
    } else {
      solutions.push(
        `Install ${command} for your ${platform} system`,
        `Check if ${command} is in your PATH environment variable`,
        `Try using absolute path to ${command}`,
        'Update your system package manager'
      );
    }
    
    return solutions;
  }

  /**
   * Get permission-related solutions
   */
  _getPermissionSolutions(platform) {
    if (platform === 'win32') {
      return [
        'Run terminal as Administrator',
        'Check file permissions on hook scripts',
        'Verify PowerShell execution policy',
        'Ensure user has access to temp directory'
      ];
    } else {
      return [
        'Check file permissions: ls -la',
        'Make script executable: chmod +x script.sh',
        'Check directory permissions',
        'Run with sudo if necessary (not recommended for hooks)'
      ];
    }
  }

  /**
   * PowerShell installation solutions
   */
  _getPowerShellInstallSolutions(platform) {
    const solutions = {
      win32: [
        'PowerShell should be pre-installed on Windows',
        'Try restarting your terminal',
        'Check Windows Update for PowerShell updates',
        'Download PowerShell from Microsoft Store'
      ],
      linux: [
        'Install PowerShell Core: https://docs.microsoft.com/en-us/powershell/scripting/install/install-linux',
        'Ubuntu/Debian: wget -q https://packages.microsoft.com/keys/microsoft.asc -O- | sudo apt-key add -',
        'Add Microsoft repository and install: sudo apt install powershell',
        'Alternative: Use Snap: sudo snap install powershell --classic'
      ],
      darwin: [
        'Install PowerShell Core: brew install powershell',
        'Download from GitHub: https://github.com/PowerShell/PowerShell/releases',
        'Use MacPorts: sudo port install powershell'
      ]
    };
    
    return solutions[platform] || solutions.linux;
  }

  /**
   * Bash installation solutions
   */
  _getBashInstallSolutions(platform) {
    const solutions = {
      win32: [
        'Install Git Bash from https://git-scm.com/downloads',
        'Enable Windows Subsystem for Linux (WSL)',
        'Install WSL 2: wsl --install',
        'Use Cygwin or MSYS2 for Unix tools'
      ],
      linux: [
        'Bash should be pre-installed',
        'Ubuntu/Debian: sudo apt install bash',
        'RHEL/CentOS: sudo yum install bash',
        'Check if bash is in PATH: which bash'
      ],
      darwin: [
        'Bash should be pre-installed on macOS',
        'Update bash: brew install bash',
        'Check bash version: bash --version'
      ]
    };
    
    return solutions[platform] || solutions.linux;
  }

  /**
   * Node.js installation solutions
   */
  _getNodeInstallSolutions(platform) {
    return [
      'Download Node.js from https://nodejs.org/',
      'Use package manager: npm install -g node',
      'Windows: winget install OpenJS.NodeJS',
      'macOS: brew install node',
      'Linux: sudo apt install nodejs npm'
    ];
  }

  /**
   * curl installation solutions
   */
  _getCurlInstallSolutions(platform) {
    const solutions = {
      win32: [
        'curl is included in Windows 10 version 1803+',
        'Download curl from https://curl.se/windows/',
        'Install via package manager: winget install curl',
        'Use PowerShell Invoke-WebRequest as alternative'
      ],
      linux: [
        'Ubuntu/Debian: sudo apt install curl',
        'RHEL/CentOS: sudo yum install curl',
        'Arch: sudo pacman -S curl'
      ],
      darwin: [
        'curl should be pre-installed on macOS',
        'Update curl: brew install curl'
      ]
    };
    
    return solutions[platform] || solutions.linux;
  }

  /**
   * Get preventive measures for error category
   */
  _getPreventiveMeasures(category, platform) {
    const measures = {
      'COMMAND_NOT_FOUND': [
        'Verify all required dependencies before deployment',
        'Use environment validation in installation scripts',
        'Provide clear system requirements documentation'
      ],
      'PERMISSION_DENIED': [
        'Set proper file permissions during installation',
        'Use user-accessible directories for temporary files',
        'Avoid requiring administrator privileges'
      ],
      'TIMEOUT': [
        'Optimize hook scripts for performance',
        'Use appropriate timeout values based on expected execution time',
        'Implement proper error handling in scripts'
      ],
      'NETWORK_ERROR': [
        'Implement retry logic with exponential backoff',
        'Use health checks to verify server availability',
        'Provide offline mode or graceful degradation'
      ]
    };
    
    return measures[category] || [
      'Regular system health checks',
      'Monitor hook execution metrics',
      'Keep dependencies up to date'
    ];
  }

  /**
   * Get escalation path for error category
   */
  _getEscalationPath(category) {
    const highSeverity = ['COMMAND_NOT_FOUND', 'PERMISSION_DENIED', 'POWERSHELL_NOT_INSTALLED', 'BASH_NOT_AVAILABLE'];
    
    if (highSeverity.includes(category)) {
      return [
        'Check system requirements documentation',
        'Run platform compatibility verification',
        'Contact system administrator',
        'File issue with platform/environment details'
      ];
    }
    
    return [
      'Check troubleshooting documentation',
      'Review error logs for patterns',
      'Try alternative execution methods',
      'Contact support with full error details'
    ];
  }

  /**
   * Handle error with comprehensive analysis and logging
   * @param {Error|string} error - Error object or message
   * @param {object} context - Execution context
   * @returns {Promise<object>} - Error handling result
   */
  async handleError(error, context = {}) {
    const analysis = this.analyzeError(error, context);
    
    // Log error details
    await this._logError({
      error: analysis.originalError,
      analysis,
      context
    });
    
    this._debug(`Error handled: ${analysis.category} with ${analysis.solutions.length} solutions`);
    
    return {
      ...analysis,
      timestamp: new Date().toISOString(),
      handled: true
    };
  }

  /**
   * Create user-friendly error report
   * @param {object} analysis - Error analysis result
   * @returns {string} - Formatted error report
   */
  formatErrorReport(analysis) {
    const lines = [];
    
    lines.push(`❌ Hook Execution Error (${analysis.severity})`);
    lines.push(`Category: ${analysis.category}`);
    lines.push(`Platform: ${analysis.platform}`);
    lines.push('');
    
    lines.push('🔍 Diagnosis:');
    lines.push(analysis.diagnosis);
    lines.push('');
    
    lines.push('🛠️  Solutions:');
    analysis.solutions.forEach((solution, index) => {
      lines.push(`${index + 1}. ${solution}`);
    });
    lines.push('');
    
    if (analysis.preventiveMeasures.length > 0) {
      lines.push('🛡️  Prevention:');
      analysis.preventiveMeasures.forEach(measure => {
        lines.push(`• ${measure}`);
      });
      lines.push('');
    }
    
    lines.push('📞 Need Help?');
    analysis.escalationPath.forEach(step => {
      lines.push(`• ${step}`);
    });
    
    return lines.join('\n');
  }
}

module.exports = ErrorHandler;