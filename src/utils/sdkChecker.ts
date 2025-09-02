import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

export interface SDKAvailabilityStatus {
  isAvailable: boolean;
  sdkPath?: string;
  version?: string;
  installationMethod?: 'npm' | 'pnpm' | 'curl' | 'unknown';
  issues: string[];
  recommendations: string[];
}

export interface SDKHealthStatus {
  sdkAvailable: boolean;
  canImportSDK: boolean;
  hasClaudeCLI: boolean;
  authenticationReady: boolean;
  overallHealth: 'healthy' | 'partial' | 'unavailable';
  details: {
    sdkPath?: string;
    version?: string;
    authMethod?: 'browser' | 'api_key' | 'unknown';
    lastCheckTime: Date;
  };
  issues: string[];
  actionItems: string[];
}

export class SDKChecker {
  private static instance: SDKChecker;
  private lastCheckTime?: Date;
  private cachedStatus?: SDKAvailabilityStatus;
  private cacheExpiryMs = 30000; // 30 seconds cache

  static getInstance(): SDKChecker {
    if (!this.instance) {
      this.instance = new SDKChecker();
    }
    return this.instance;
  }

  /**
   * Check if Claude Code SDK is available and functional
   */
  async checkSDKAvailability(forceRefresh = false): Promise<SDKAvailabilityStatus> {
    // Return cached result if still valid
    if (!forceRefresh && this.cachedStatus && this.lastCheckTime) {
      const cacheAge = Date.now() - this.lastCheckTime.getTime();
      if (cacheAge < this.cacheExpiryMs) {
        return this.cachedStatus;
      }
    }

    const status: SDKAvailabilityStatus = {
      isAvailable: false,
      issues: [],
      recommendations: []
    };

    try {
      // Step 1: Check if Claude CLI is available in PATH
      const cliCheck = await this.checkClaudeCLI();
      if (!cliCheck.available) {
        status.issues.push('Claude CLI not found in PATH');
        status.recommendations.push('Install Claude CLI: npm install -g @anthropic-ai/claude-code');
      }

      // Step 2: Try to find SDK path
      const sdkPath = await this.findSDKPath();
      if (sdkPath) {
        status.sdkPath = sdkPath;
        status.isAvailable = true;
        
        // Try to detect installation method
        status.installationMethod = this.detectInstallationMethod(sdkPath);
        
        // Get version if available
        try {
          const version = await this.getSDKVersion();
          if (version) {
            status.version = version;
          }
        } catch (error) {
          status.issues.push('Could not determine SDK version');
        }
      } else {
        status.issues.push('Claude Code SDK module not found');
        status.recommendations.push('Ensure @anthropic-ai/claude-code is installed globally');
      }

      // Step 3: Try dynamic import test
      if (status.isAvailable) {
        const importTest = await this.testSDKImport(sdkPath || undefined);
        if (!importTest.success) {
          status.isAvailable = false;
          status.issues.push(`SDK import failed: ${importTest.error}`);
          status.recommendations.push('Try reinstalling: npm uninstall -g @anthropic-ai/claude-code && npm install -g @anthropic-ai/claude-code');
        }
      }

    } catch (error) {
      status.issues.push(`SDK check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Add general recommendations if SDK not available
    if (!status.isAvailable) {
      status.recommendations.push('Verify Node.js version compatibility (Node 16+ recommended)');
      status.recommendations.push('Check npm/pnpm global installation permissions');
      status.recommendations.push('Try alternative installation: curl -sL https://claude.ai/install.sh | sh');
    }

    // Cache the result
    this.cachedStatus = status;
    this.lastCheckTime = new Date();

    return status;
  }

  /**
   * Get comprehensive SDK health status
   */
  async getSDKHealthStatus(): Promise<SDKHealthStatus> {
    const availability = await this.checkSDKAvailability();
    
    const health: SDKHealthStatus = {
      sdkAvailable: availability.isAvailable,
      canImportSDK: false,
      hasClaudeCLI: false,
      authenticationReady: false,
      overallHealth: 'unavailable',
      details: {
        lastCheckTime: new Date()
      },
      issues: [...availability.issues],
      actionItems: [...availability.recommendations]
    };

    // Check Claude CLI availability
    const cliCheck = await this.checkClaudeCLI();
    health.hasClaudeCLI = cliCheck.available;
    if (cliCheck.version) {
      health.details.version = cliCheck.version;
    }

    // Test SDK import if available
    if (availability.isAvailable && availability.sdkPath) {
      health.details.sdkPath = availability.sdkPath;
      
      const importTest = await this.testSDKImport(availability.sdkPath);
      health.canImportSDK = importTest.success;
      
      if (!importTest.success) {
        health.issues.push(`SDK import test failed: ${importTest.error}`);
      }
    }

    // Check authentication readiness
    const authCheck = await this.checkAuthenticationStatus();
    health.authenticationReady = authCheck.ready;
    health.details.authMethod = authCheck.method;
    
    if (!authCheck.ready) {
      health.issues.push(...authCheck.issues);
      health.actionItems.push(...authCheck.recommendations);
    }

    // Determine overall health
    if (health.sdkAvailable && health.canImportSDK && health.hasClaudeCLI && health.authenticationReady) {
      health.overallHealth = 'healthy';
    } else if (health.sdkAvailable && health.canImportSDK) {
      health.overallHealth = 'partial';
    } else {
      health.overallHealth = 'unavailable';
    }

    return health;
  }

  /**
   * Check if Claude CLI command is available
   */
  private async checkClaudeCLI(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      // Try the standard claude command
      const output = execSync('claude --version', { 
        encoding: 'utf-8', 
        stdio: 'pipe',
        timeout: 10000
      });
      
      return {
        available: true,
        version: output.trim()
      };
    } catch (error) {
      // Try npx fallback
      try {
        const output = execSync('npx @anthropic-ai/claude-code --version', { 
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 15000
        });
        
        return {
          available: true,
          version: output.trim()
        };
      } catch (npxError) {
        return {
          available: false,
          error: 'Claude CLI not found via claude command or npx'
        };
      }
    }
  }

  /**
   * Find Claude Code SDK installation path
   */
  private async findSDKPath(): Promise<string | null> {
    const userHome = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
    
    // Common SDK paths
    const searchPaths = [
      // NPM global locations
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.js'),
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'index.js'),
      path.join(userHome, '.npm-global', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
      
      // PNPM global locations
      ...this.generatePnpmPaths(localAppData),
      
      // System-wide paths
      'C:\\Program Files\\nodejs\\node_modules\\@anthropic-ai\\claude-code\\sdk.mjs',
      '/usr/local/lib/node_modules/@anthropic-ai/claude-code/sdk.mjs',
      '/usr/lib/node_modules/@anthropic-ai/claude-code/sdk.mjs',
    ];
    
    for (const searchPath of searchPaths) {
      try {
        if (fs.existsSync(searchPath)) {
          return searchPath;
        }
      } catch (error) {
        // Continue searching
        continue;
      }
    }
    
    return null;
  }

  /**
   * Generate potential PNPM installation paths
   */
  private generatePnpmPaths(localAppData: string): string[] {
    const paths: string[] = [];
    const basePaths = [
      path.join(localAppData, 'pnpm', 'global', '5', '.pnpm'),
      path.join(localAppData, 'pnpm', 'global', '6', '.pnpm'),
      path.join(localAppData, 'pnpm', 'global', '7', '.pnpm'),
      path.join(localAppData, 'pnpm', 'global', '8', '.pnpm'),
    ];
    
    for (const basePath of basePaths) {
      try {
        if (fs.existsSync(basePath)) {
          const entries = fs.readdirSync(basePath);
          const claudeDirs = entries.filter(entry => entry.startsWith('@anthropic-ai+claude-code@'));
          
          for (const claudeDir of claudeDirs) {
            paths.push(path.join(basePath, claudeDir, 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'));
            paths.push(path.join(basePath, claudeDir, 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.js'));
          }
        }
      } catch (error) {
        // Continue with other paths
      }
    }
    
    return paths;
  }

  /**
   * Test if SDK can be imported successfully
   */
  private async testSDKImport(sdkPath?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // First try standard import
      try {
        const sdkModule = await import('@anthropic-ai/claude-code');
        if (sdkModule && (typeof sdkModule.query === 'function' || typeof sdkModule.default?.query === 'function')) {
          return { success: true };
        }
      } catch (standardError) {
        // Continue to file import if standard import fails
      }

      // Try file import if path is provided
      if (sdkPath) {
        const fileUrl = process.platform === 'win32' ? 
          `file:///${sdkPath.replace(/\\/g, '/')}` : 
          `file://${sdkPath}`;
        
        const sdkModule = await import(fileUrl);
        if (sdkModule && (typeof sdkModule.query === 'function' || typeof sdkModule.default?.query === 'function')) {
          return { success: true };
        }
      }

      return { 
        success: false, 
        error: 'SDK module does not expose expected query function' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Get SDK version information
   */
  private async getSDKVersion(): Promise<string | null> {
    try {
      const output = execSync('claude --version', { 
        encoding: 'utf-8', 
        stdio: 'pipe',
        timeout: 10000
      });
      return output.trim();
    } catch (error) {
      try {
        const output = execSync('npx @anthropic-ai/claude-code --version', { 
          encoding: 'utf-8',
          stdio: 'pipe', 
          timeout: 15000
        });
        return output.trim();
      } catch (npxError) {
        return null;
      }
    }
  }

  /**
   * Detect how Claude Code was installed
   */
  private detectInstallationMethod(sdkPath: string): 'npm' | 'pnpm' | 'curl' | 'unknown' {
    if (sdkPath.includes('npm')) return 'npm';
    if (sdkPath.includes('pnpm')) return 'pnpm';
    if (sdkPath.includes('/usr/local') || sdkPath.includes('Program Files')) return 'curl';
    return 'unknown';
  }

  /**
   * Check authentication status (browser or API key)
   */
  private async checkAuthenticationStatus(): Promise<{
    ready: boolean;
    method?: 'browser' | 'api_key' | 'unknown';
    issues: string[];
    recommendations: string[];
  }> {
    const result: {
      ready: boolean;
      method?: 'browser' | 'api_key' | 'unknown';
      issues: string[];
      recommendations: string[];
    } = {
      ready: false,
      issues: [] as string[],
      recommendations: [] as string[]
    };

    // Check for API key
    if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) {
      result.ready = true;
      result.method = 'api_key';
      return result;
    }

    // Test basic CLI functionality to check browser auth
    try {
      execSync('claude --version', { 
        stdio: 'ignore', 
        timeout: 5000 
      });
      result.ready = true;
      result.method = 'browser';
      return result;
    } catch (error) {
      result.issues.push('Neither API key nor browser authentication detected');
      result.recommendations.push('Set ANTHROPIC_API_KEY environment variable OR ensure Claude is authenticated in browser');
    }

    return result;
  }

  /**
   * Display user-friendly SDK status report
   */
  displaySDKStatus(status: SDKAvailabilityStatus): void {
    console.log(chalk.blue.bold('\n🔍 Claude Code SDK Status Report\n'));

    if (status.isAvailable) {
      console.log(chalk.green('✅ SDK Available'));
      if (status.version) {
        console.log(chalk.cyan(`   Version: ${status.version}`));
      }
      if (status.sdkPath) {
        console.log(chalk.cyan(`   Location: ${status.sdkPath.substring(0, 80)}...`));
      }
      if (status.installationMethod) {
        console.log(chalk.cyan(`   Installed via: ${status.installationMethod.toUpperCase()}`));
      }
    } else {
      console.log(chalk.red('❌ SDK Not Available'));
    }

    if (status.issues.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️ Issues Found:'));
      status.issues.forEach((issue, index) => {
        console.log(chalk.yellow(`   ${index + 1}. ${issue}`));
      });
    }

    if (status.recommendations.length > 0) {
      console.log(chalk.blue.bold('\n💡 Recommendations:'));
      status.recommendations.forEach((rec, index) => {
        console.log(chalk.blue(`   ${index + 1}. ${rec}`));
      });
    }

    console.log(''); // Add spacing
  }

  /**
   * Display comprehensive health report
   */
  displayHealthReport(health: SDKHealthStatus): void {
    console.log(chalk.blue.bold('\n🏥 Claude Code Health Check\n'));

    // Overall health indicator
    const healthColor = health.overallHealth === 'healthy' ? chalk.green : 
                       health.overallHealth === 'partial' ? chalk.yellow : chalk.red;
    const healthIcon = health.overallHealth === 'healthy' ? '🟢' : 
                      health.overallHealth === 'partial' ? '🟡' : '🔴';
    
    console.log(healthColor(`${healthIcon} Overall Health: ${health.overallHealth.toUpperCase()}`));
    console.log('');

    // Component status
    console.log(chalk.cyan.bold('📋 Component Status:'));
    console.log(`   SDK Available: ${health.sdkAvailable ? chalk.green('✅') : chalk.red('❌')}`);
    console.log(`   Can Import SDK: ${health.canImportSDK ? chalk.green('✅') : chalk.red('❌')}`);
    console.log(`   Claude CLI: ${health.hasClaudeCLI ? chalk.green('✅') : chalk.red('❌')}`);
    console.log(`   Authentication: ${health.authenticationReady ? chalk.green('✅') : chalk.red('❌')}`);

    // Details
    if (health.details.version || health.details.sdkPath || health.details.authMethod) {
      console.log(chalk.cyan.bold('\n📊 Details:'));
      if (health.details.version) {
        console.log(chalk.cyan(`   Version: ${health.details.version}`));
      }
      if (health.details.sdkPath) {
        console.log(chalk.cyan(`   SDK Path: ...${health.details.sdkPath.slice(-50)}`));
      }
      if (health.details.authMethod) {
        console.log(chalk.cyan(`   Auth Method: ${health.details.authMethod.toUpperCase()}`));
      }
      console.log(chalk.gray(`   Last Check: ${health.details.lastCheckTime.toLocaleString()}`));
    }

    // Issues
    if (health.issues.length > 0) {
      console.log(chalk.red.bold('\n❌ Issues:'));
      health.issues.forEach((issue, index) => {
        console.log(chalk.red(`   ${index + 1}. ${issue}`));
      });
    }

    // Action items
    if (health.actionItems.length > 0) {
      console.log(chalk.blue.bold('\n🔧 Recommended Actions:'));
      health.actionItems.forEach((action, index) => {
        console.log(chalk.blue(`   ${index + 1}. ${action}`));
      });
    }

    console.log(''); // Add spacing
  }

  /**
   * Provide installation guidance based on current system
   */
  getInstallationGuidance(): string[] {
    const guidance: string[] = [];
    
    guidance.push('📦 Claude Code SDK Installation Options:');
    guidance.push('');
    guidance.push('Option 1 - NPM (Recommended):');
    guidance.push('  npm install -g @anthropic-ai/claude-code');
    guidance.push('');
    guidance.push('Option 2 - PNPM:');
    guidance.push('  pnpm install -g @anthropic-ai/claude-code');
    guidance.push('');
    guidance.push('Option 3 - Direct Install:');
    guidance.push('  curl -sL https://claude.ai/install.sh | sh');
    guidance.push('');
    guidance.push('🔐 Authentication Setup:');
    guidance.push('');
    guidance.push('Option A - Browser Authentication:');
    guidance.push('  1. Open https://claude.ai in your browser');
    guidance.push('  2. Sign in to your Claude account');
    guidance.push('  3. Keep the tab open while using ACC');
    guidance.push('');
    guidance.push('Option B - API Key Authentication:');
    guidance.push('  1. Get API key from https://console.anthropic.com');
    guidance.push('  2. Set environment variable: export ANTHROPIC_API_KEY="your-key"');
    guidance.push('');
    guidance.push('🔍 Verification:');
    guidance.push('  acc --verify-claude-cli    # Check installation');
    guidance.push('  claude --version           # Test direct CLI access');
    
    return guidance;
  }

  /**
   * Clear cached status (force refresh on next check)
   */
  clearCache(): void {
    this.cachedStatus = undefined;
    this.lastCheckTime = undefined;
  }
}