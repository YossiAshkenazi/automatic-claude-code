import chalk from 'chalk';
import { AutomaticClaudeCodeCore } from './application';
import { SDKAutopilotEngine, AutopilotOptions } from './SDKAutopilotEngine';
import { Logger } from '../logger';
import { SDKChecker } from '../utils/sdkChecker';
import { ClaudeUtils } from '../claudeUtils';
import {
  AuthenticationError,
  BrowserAuthRequiredError,
  SDKNotInstalledError,
  ClaudeInstallationError,
  NetworkError,
  APIKeyRequiredError,
  ModelQuotaError,
  RetryExhaustedError
} from '../services/sdkClaudeExecutor';

export interface CommandOptions {
  iterations?: string;
  model?: string;
  dir?: string;
  tools?: string;
  continueOnError?: boolean;
  verbose?: boolean;
  dualAgent?: boolean;
  managerModel?: string;
  workerModel?: string;
  noMonitoring?: boolean;
  timeout?: string;
  resume?: string;
  browser?: string;
  refreshBrowserSession?: boolean;
  browserAuth?: boolean;
  apiMode?: boolean;
  useSdkOnly?: boolean;
  useLegacy?: boolean;
  sdkStatus?: boolean;
  verifyClaudeCli?: boolean;
  qualityGate?: boolean;
  checkBrowserSession?: boolean;
  browserStatus?: boolean;
  clearBrowserCache?: boolean;
  resetBrowserSessions?: boolean;
  monitorBrowserSessions?: boolean;
  headlessBrowser?: boolean;
  persistentBrowser?: boolean;
  cleanBrowser?: boolean;
}

export class CommandCoordinator {
  private core: AutomaticClaudeCodeCore;

  constructor() {
    this.core = new AutomaticClaudeCodeCore();
  }

  async executeRunCommand(prompt: string, options: CommandOptions): Promise<void> {
    // Show deprecation warnings for removed options
    if ((options as any).usePty) {
      console.log(chalk.yellow('⚠️  WARNING: --use-pty flag is deprecated in SDK-only architecture'));
      console.log(chalk.gray('   All execution now uses the Claude SDK directly'));
    }
    if ((options as any).noPty) {
      console.log(chalk.yellow('⚠️  WARNING: --no-pty flag is deprecated in SDK-only architecture'));
      console.log(chalk.gray('   All execution now uses the Claude SDK directly'));
    }

    // Handle comprehensive Claude CLI verification
    if (options.verifyClaudeCli) {
      await this.handleClaudeCliVerification();
      return;
    }

    // Handle SDK status check
    if (options.sdkStatus) {
      await this.handleSDKStatus();
      return;
    }

    // Handle browser session management commands
    if (options.checkBrowserSession || options.browserStatus || 
        options.clearBrowserCache || options.resetBrowserSessions ||
        options.monitorBrowserSessions) {
      await this.handleBrowserCommands(options);
      return;
    }

    // Handle dual-agent mode with SDK-based coordination
    if (options.dualAgent) {
      await this.handleDualAgentMode(prompt, options);
    } else {
      // Single-agent mode with SDK Autopilot Engine
      await this.handleSingleAgentMode(prompt, options);
    }
  }

  private async handleClaudeCliVerification(): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 Claude CLI & SDK Verification\n'));
    
    const sdkChecker = SDKChecker.getInstance();
    try {
      const healthStatus = await sdkChecker.getSDKHealthStatus();
      sdkChecker.displayHealthReport(healthStatus);
      
      console.log(chalk.blue.bold('🧪 Additional Verification:\n'));
      
      console.log(chalk.cyan('Testing Claude CLI command...'));
      try {
        const { command, baseArgs } = ClaudeUtils.getClaudeCommand();
        console.log(chalk.green(`✅ Claude CLI found: ${command} ${baseArgs.join(' ')}`));
      } catch (cliError) {
        console.log(chalk.red(`❌ Claude CLI test failed: ${cliError instanceof Error ? cliError.message : String(cliError)}`));
      }
      
      console.log(chalk.cyan('Testing SDK import...'));
      const availabilityStatus = await sdkChecker.checkSDKAvailability(true);
      if (availabilityStatus.isAvailable) {
        console.log(chalk.green('✅ SDK import test passed'));
      } else {
        console.log(chalk.red('❌ SDK import test failed'));
        console.log(chalk.yellow('Issues:'));
        availabilityStatus.issues.forEach((issue, i) => {
          console.log(chalk.yellow(`  ${i + 1}. ${issue}`));
        });
      }
      
      if (healthStatus.overallHealth !== 'healthy') {
        console.log(chalk.blue.bold('\n📋 Installation Guidance:\n'));
        const guidance = sdkChecker.getInstallationGuidance();
        guidance.forEach(line => {
          if (line.startsWith('📦') || line.startsWith('🔐') || line.startsWith('🔍')) {
            console.log(chalk.blue.bold(line));
          } else if (line.startsWith('Option') || line.startsWith('  ')) {
            console.log(chalk.cyan(line));
          } else if (line.trim() === '') {
            console.log('');
          } else {
            console.log(chalk.gray(line));
          }
        });
      }
      
      process.exit(healthStatus.overallHealth === 'healthy' ? 0 : 1);
      
    } catch (error) {
      console.error(chalk.red('❌ Verification failed:'), error);
      process.exit(1);
    }
  }

  private async handleSDKStatus(): Promise<void> {
    const healthMetrics = await this.core.sdkAutopilotEngineInstance.getHealthMetrics();
    
    console.log(chalk.blue.bold('\n📊 SDK Health Status\n'));
    console.log(chalk.cyan(`Total Executions: ${healthMetrics.totalExecutions || 0}`));
    console.log(chalk.cyan(`Success Rate: ${healthMetrics.successRate || 0}%`));
    console.log(chalk.cyan(`Average Duration: ${healthMetrics.averageDuration || 0}ms`));
    console.log(chalk.cyan(`Preferred Method: ${(healthMetrics.preferredMethod || 'SDK').toUpperCase()}`));
    
    const sdkHealth = healthMetrics.sdkHealth || { available: false };
    console.log(chalk.cyan(`\nSDK Available: ${sdkHealth.available ? '✅' : '❌'}`));
    console.log(chalk.cyan(`Circuit Breaker: ${(sdkHealth as any).circuitBreakerOpen ? '🔴 Open' : '🟢 Closed'}`));
    
    if (sdkHealth.overallHealth) {
      const healthColor = sdkHealth.overallHealth === 'healthy' ? chalk.green : 
                         sdkHealth.overallHealth === 'partial' ? chalk.yellow : chalk.red;
      console.log(chalk.cyan(`Overall Health: ${healthColor(sdkHealth.overallHealth.toUpperCase())}`));
    }
    
    if (sdkHealth.issues && sdkHealth.issues.length > 0) {
      console.log(chalk.yellow(`Issues Found: ${sdkHealth.issues.length}`));
    }
    
    const browserHealth = healthMetrics.browserHealth || { available: false };
    console.log(chalk.cyan(`\nBrowser Sessions: ${browserHealth.available ? '✅' : '❌'}`));
    
    console.log(chalk.gray(`\nLast Health Check: ${sdkHealth.lastChecked?.toLocaleString() || 'Never'}`));
    console.log(chalk.blue('\n💡 For detailed verification, use: acc --verify-claude-cli'));
  }

  private async handleBrowserCommands(options: CommandOptions): Promise<void> {
    try {
      if (options.checkBrowserSession) {
        await this.handleBrowserSessionCheck();
      } else if (options.browserStatus) {
        await this.handleBrowserStatus();
      } else if (options.clearBrowserCache) {
        await this.handleClearBrowserCache();
      } else if (options.resetBrowserSessions) {
        await this.handleResetBrowserSessions();
      } else if (options.monitorBrowserSessions) {
        await this.handleMonitorBrowserSessions();
      } else {
        await this.handleBrowserSessionCheck();
      }
    } catch (error) {
      console.error(chalk.red('Browser command failed:'), error);
      process.exit(1);
    }
  }

  private async handleBrowserSessionCheck(): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 SDK Browser Session Status\n'));
    
    try {
      const healthMetrics = await this.core.sdkAutopilotEngineInstance.getHealthMetrics();
      const browserStatus = healthMetrics.browserHealth || { available: false, authStatus: 'unknown' };
      
      console.log(chalk.cyan('📊 SDK Health Metrics:'));
      console.log(chalk.cyan(`  • Total Executions: ${healthMetrics.totalExecutions}`));
      console.log(chalk.cyan(`  • Success Rate: ${healthMetrics.successRate}%`));
      console.log(chalk.cyan(`  • Preferred Method: ${healthMetrics.preferredMethod?.toUpperCase() || 'SDK'}`));
      
      if (browserStatus.available || (browserStatus as any).authStatus === 'authenticated') {
        console.log(chalk.green('\n✅ SDK browser authentication available!'));
        console.log(chalk.cyan(`📊 Authentication Status: ${(browserStatus as any).authStatus || 'ready'}`));
        
        console.log(chalk.green.bold('\n🚀 Ready for SDK Execution!'));
        console.log(chalk.gray('   Try: acc run "your task" --use-sdk-only'));
      } else {
        console.log(chalk.red('❌ SDK browser authentication not ready'));
        
        console.log(chalk.cyan.bold('\n📋 To enable SDK execution:'));
        console.log(chalk.white('  1. Open your browser and go to https://claude.ai'));
        console.log(chalk.white('  2. Sign in to your Claude account'));
        console.log(chalk.white('  3. Keep the Claude tab open'));
        console.log(chalk.white('  4. Run this command again to verify'));
      }
      
      process.exit((browserStatus.available || (browserStatus as any).authStatus === 'authenticated') ? 0 : 1);
      
    } catch (error) {
      console.error(chalk.red('❌ Error checking SDK browser sessions:'), error);
      process.exit(1);
    }
  }

  private async handleBrowserStatus(): Promise<void> {
    console.log(chalk.yellow('⚠️  Browser session management is deprecated in SDK-only architecture'));
    console.log(chalk.gray('   Browser authentication is now handled transparently by the Claude SDK'));
    console.log(chalk.green('✅ Claude SDK handles browser authentication automatically'));
    process.exit(0);
  }

  private async handleClearBrowserCache(): Promise<void> {
    console.log(chalk.yellow('⚠️  Browser cache management is deprecated in SDK-only architecture'));
    console.log(chalk.gray('   Browser authentication is now handled transparently by the Claude SDK'));
    console.log(chalk.green('✅ No manual cache management needed'));
    process.exit(0);
  }

  private async handleResetBrowserSessions(): Promise<void> {
    console.log(chalk.yellow('⚠️  Browser session reset is deprecated in SDK-only architecture'));
    console.log(chalk.gray('   Browser authentication is now handled transparently by the Claude SDK'));
    console.log(chalk.green('✅ No manual session reset needed'));
    process.exit(0);
  }

  private async handleMonitorBrowserSessions(): Promise<void> {
    console.log(chalk.yellow('⚠️  Browser session monitoring is deprecated in SDK-only architecture'));
    console.log(chalk.gray('   Browser authentication is now handled transparently by the Claude SDK'));
    console.log(chalk.green('✅ No manual session monitoring needed'));
    process.exit(0);
  }

  private async handleDualAgentMode(prompt: string, options: CommandOptions): Promise<void> {
    console.log(chalk.cyan('🚀 Starting SDK-based dual-agent coordination (Manager + Worker)'));
    console.log(chalk.gray('   Using direct Claude SDK calls instead of PTY coordination'));
    
    const autopilotEngine = new SDKAutopilotEngine(new Logger());
    
    try {
      const autopilotOptions: AutopilotOptions = {
        dualAgent: true,
        maxIterations: parseInt(options.iterations || '10'),
        managerModel: (options.managerModel as 'opus' | 'sonnet') || 'opus',
        workerModel: (options.workerModel as 'opus' | 'sonnet') || 'sonnet',
        workDir: options.dir,
        allowedTools: options.tools,
        continueOnError: options.continueOnError,
        verbose: options.verbose,
        timeout: parseInt(options.timeout || '30') * 60000
      };

      const result = await autopilotEngine.runAutopilotLoop(prompt, autopilotOptions);
      
      if (result.success) {
        console.log(chalk.green('✅ SDK dual-agent coordination completed successfully'));
        console.log(chalk.gray(`   Duration: ${(result.duration / 1000).toFixed(1)}s`));
        console.log(chalk.gray(`   Iterations: ${result.iterations}`));
        console.log(chalk.gray(`   Coordination: ${result.coordinationType}`));
        
        if (result.dualAgentMetrics) {
          console.log(chalk.cyan('\n📊 Dual-Agent Metrics:'));
          console.log(chalk.gray(`   Handoffs: ${result.dualAgentMetrics.handoffCount}`));
          console.log(chalk.gray(`   Manager iterations: ${result.dualAgentMetrics.managerIterations}`));
          console.log(chalk.gray(`   Worker iterations: ${result.dualAgentMetrics.workerIterations}`));
          console.log(chalk.gray(`   Quality score: ${(result.dualAgentMetrics.qualityScore * 100).toFixed(1)}%`));
        }
      } else {
        console.error(chalk.red('❌ SDK dual-agent coordination failed'));
        console.error(chalk.red(`   Error: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Fatal error in SDK dual-agent mode:'), error);
      process.exit(1);
    }
  }

  private async handleSingleAgentMode(prompt: string, options: CommandOptions): Promise<void> {
    try {
      if (options.useLegacy) {
        console.log(chalk.yellow('⚠️  Using legacy CLI mode (SDK bypassed)'));
        await this.core['runLegacyLoop'](prompt, {
          maxIterations: parseInt(options.iterations || '10'),
          model: options.model as 'sonnet' | 'opus',
          workDir: options.dir,
          allowedTools: options.tools,
          continueOnError: options.continueOnError,
          verbose: options.verbose,
          timeout: parseInt(options.timeout || '30') * 60000,
          sessionId: options.resume,
        });
      } else {
        const autopilotOptions = {
          maxIterations: parseInt(options.iterations || '10'),
          model: (options.model as 'opus' | 'sonnet') || 'sonnet',
          workDir: options.dir,
          allowedTools: options.tools,
          continueOnError: options.continueOnError,
          verbose: options.verbose,
          timeout: parseInt(options.timeout || '30') * 60000,
          sessionId: options.resume,
          browser: options.browser,
          refreshBrowserSession: options.refreshBrowserSession,
          headless: options.headlessBrowser,
          useSDKOnly: options.useSdkOnly,
          enableHooks: true,
          enableMonitoring: !options.noMonitoring
        };

        await this.core.runLoop(prompt, autopilotOptions);
      }
    } catch (error) {
      this.handleIterationError(error, options);
      throw error;
    }
  }

  private handleIterationError(error: any, options: CommandOptions): void {
    // Enhanced error handling with user-friendly prompts and guidance
    if (error instanceof AuthenticationError || error instanceof BrowserAuthRequiredError) {
      console.error(chalk.red.bold('\n🔐 Authentication Required'));
      console.log(chalk.yellow('Claude needs authentication to continue.'));
      console.log(chalk.cyan('\n🆘 Quick Fix:'));
      console.log(chalk.white('  1. Open https://claude.ai in your browser'));
      console.log(chalk.white('  2. Log in to your Claude account'));
      console.log(chalk.white('  3. Keep the tab open and try again'));
      console.log(chalk.cyan('\n💡 Pro Tip: For unattended execution, set ANTHROPIC_API_KEY'));
      console.log(chalk.gray('     export ANTHROPIC_API_KEY="your-key-from-console.anthropic.com"'));
      return;
    }

    if (error instanceof SDKNotInstalledError || error instanceof ClaudeInstallationError) {
      console.error(chalk.red.bold('\n📦 Claude Installation Issue'));
      console.log(chalk.yellow('Claude Code SDK is not properly installed or configured.'));
      console.log(chalk.cyan('\n📋 Quick Fix Options:'));
      console.log(chalk.white('  Option 1 (Recommended): npm install -g @anthropic-ai/claude-code'));
      console.log(chalk.white('  Option 2: pnpm install -g @anthropic-ai/claude-code'));
      console.log(chalk.white('  Option 3: curl -sL https://claude.ai/install.sh | sh'));
      return;
    }

    if (error instanceof NetworkError) {
      console.error(chalk.red.bold('\n🌐 Network Connection Problem'));
      console.log(chalk.yellow('Cannot reach Claude services. This usually resolves quickly.'));
      console.log(chalk.cyan('\n🆘 Quick Fix:'));
      console.log(chalk.white('  1. Check your internet connection'));
      console.log(chalk.white('  2. Wait 30 seconds and try again'));
      console.log(chalk.white('  3. Check https://status.anthropic.com for outages'));
      return;
    }

    if (error instanceof APIKeyRequiredError) {
      console.error(chalk.red.bold('\n🗝️  API Key Required'));
      console.log(chalk.yellow('Headless mode requires an API key.'));
      console.log(chalk.cyan('\n📋 API Key Setup Options:'));
      console.log(chalk.white('  Option 1: export ANTHROPIC_API_KEY="your-key-here"'));
      console.log(chalk.white('  Option 2: Set CLAUDE_API_KEY environment variable'));
      console.log(chalk.white('  Option 3: Use interactive mode (remove API key)'));
      console.log(chalk.yellow('\n💡 Get your API key from https://console.anthropic.com'));
      return;
    }

    if (error instanceof ModelQuotaError) {
      console.error(chalk.red.bold('\n⚡ Usage Limit Exceeded'));
      console.log(chalk.yellow('You have hit your model usage quota or rate limit.'));
      console.log(chalk.cyan('\n📋 Solutions:'));
      console.log(chalk.white('  1. Wait a few minutes before retrying'));
      console.log(chalk.white('  2. Check your usage at https://console.anthropic.com'));
      console.log(chalk.white('  3. Consider upgrading your plan if needed'));
      console.log(chalk.white('  4. Try using "sonnet" model instead of "opus"'));
      return;
    }

    if (error instanceof RetryExhaustedError) {
      console.error(chalk.red.bold('\n🛑 System Unable to Proceed'));
      console.log(chalk.yellow('All automatic retry attempts have been exhausted.'));
      console.log(chalk.cyan('\n🆘 Recovery Plan:'));
      console.log(chalk.white('  1. Wait 2-3 minutes for systems to stabilize'));
      console.log(chalk.white('  2. Try a simpler task to verify basic functionality'));
      console.log(chalk.white('  3. Use --verbose flag to see detailed error info'));
      return;
    }

    // Generic error handling
    console.error(chalk.red('\n❌ Unexpected Error:'));
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
      if (options.verbose && error.stack) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red(String(error)));
    }
  }
}