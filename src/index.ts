#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import chalk from 'chalk';
import { Command } from 'commander';
import { SessionManager, EnhancedSessionManager, SessionLimitError } from './sessionManager';
import { OutputParser, ParsedOutput } from './outputParser';
import { PromptBuilder } from './promptBuilder';
import { Logger } from './logger';
import { LogViewer } from './logViewer';
import { launchTUI } from './tuiBrowser';
import { AgentCoordinator } from './agents/agentCoordinator';
import { ClaudeUtils } from './claudeUtils';
import { monitoringManager } from './monitoringManager';
import { config } from './config';
import { 
  ClaudeExecutor, 
  ClaudeExecutionOptions,
  AuthenticationError,
  BrowserAuthRequiredError,
  SDKNotInstalledError,
  ClaudeInstallationError,
  NetworkError,
  APIKeyRequiredError,
  ModelQuotaError,
  RetryExhaustedError
} from './services/claudeExecutor';
import Table from 'cli-table3';

interface LoopOptions {
  maxIterations?: number;
  continueOnError?: boolean;
  verbose?: boolean;
  model?: 'sonnet' | 'opus';
  sessionId?: string;
  workDir?: string;
  allowedTools?: string;
  timeout?: number;
}

interface AnalysisResult {
  isComplete: boolean;
  hasError: boolean;
  needsMoreWork: boolean;
  suggestions?: string[];
}

class AutomaticClaudeCode {
  private sessionManager: EnhancedSessionManager;
  private outputParser: OutputParser;
  private promptBuilder: PromptBuilder;
  private logger: Logger;
  private claudeExecutor: ClaudeExecutor;
  private iteration: number = 0;
  private sessionHistory: string[] = [];

  constructor() {
    this.sessionManager = new EnhancedSessionManager();
    this.outputParser = new OutputParser();
    this.promptBuilder = new PromptBuilder();
    this.logger = new Logger();
    this.claudeExecutor = new ClaudeExecutor(this.logger);
  }

  private getClaudeCommand(): { command: string; baseArgs: string[] } {
    return ClaudeUtils.getClaudeCommand();
  }
  
  private getClaudeCommandOld(): { command: string; baseArgs: string[] } {
    // For WSL/Linux compatibility, try multiple approaches
    if (process.platform === 'linux' || process.env.WSL_DISTRO_NAME) {
      // First try to find full path to npx
      try {
        const npxPath = execSync('which npx', { encoding: 'utf-8' }).trim();
        execSync(`${npxPath} @anthropic-ai/claude-code --version`, { stdio: 'ignore', timeout: 15000 });
        return { command: npxPath, baseArgs: ['@anthropic-ai/claude-code', '--dangerously-skip-permissions'] };
      } catch (error) {
        // Silently continue to next approach
      }
      
      // Fallback to regular npx
      try {
        execSync('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
        return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code', '--dangerously-skip-permissions'] };
      } catch (error) {
        // Silently continue to next approach
      }
    }

    // Try to actually run claude --version to verify it works
    try {
      execSync('claude --version', { stdio: 'ignore' });
      return { command: 'claude', baseArgs: ['--dangerously-skip-permissions'] };
    } catch {
      // Try npx approach as fallback
      try {
        execSync('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
        return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code', '--dangerously-skip-permissions'] };
      } catch {
        // Try to find claude-code instead of claude
        try {
          execSync('claude-code --version', { stdio: 'ignore' });
          return { command: 'claude-code', baseArgs: ['--dangerously-skip-permissions'] };
        } catch {
          // Last resort - try direct npm global path
          try {
            const npmPrefix = execSync('npm config get prefix', { encoding: 'utf-8' }).trim();
            const possiblePaths = [
              { path: path.join(npmPrefix, 'bin', 'claude'), name: 'claude' },
              { path: path.join(npmPrefix, 'bin', 'claude-code'), name: 'claude-code' },
              { path: path.join(process.env.HOME || '', '.npm-global', 'bin', 'claude'), name: 'claude' },
              { path: path.join(process.env.HOME || '', '.npm-global', 'bin', 'claude-code'), name: 'claude-code' }
            ];
            
            for (const { path: claudePath } of possiblePaths) {
              if (fs.existsSync(claudePath)) {
                return { command: claudePath, baseArgs: ['--dangerously-skip-permissions'] };
              }
            }
          } catch {
            // Ignore and fall through to error
          }
          
          throw new Error('Claude CLI not found. Please install with: npm install -g @anthropic-ai/claude-code');
        }
      }
    }
  }

  async runClaudeCode(prompt: string, options: LoopOptions): Promise<{ output: string; exitCode: number }> {
    // Convert LoopOptions to ClaudeExecutionOptions
    const claudeOptions: ClaudeExecutionOptions = {
      model: options.model,
      workDir: options.workDir,
      allowedTools: options.allowedTools,
      sessionId: options.sessionId,
      verbose: options.verbose,
      continueOnError: options.continueOnError,
      timeout: options.timeout
    };

    // Use the centralized ClaudeExecutor service
    return await this.claudeExecutor.executeClaudeCode(prompt, claudeOptions);
  }

  async runLoop(initialPrompt: string, options: LoopOptions): Promise<void> {
    const maxIterations = options.maxIterations || 10;
    let currentPrompt = initialPrompt;
    let sessionId: string | undefined;
    
    console.log(chalk.blue.bold('\n🚀 Starting Automatic Claude Code Loop\n'));
    console.log(chalk.cyan(`Initial Task: ${initialPrompt}`));
    console.log(chalk.cyan(`Max Iterations: ${maxIterations}`));
    console.log(chalk.cyan(`Working Directory: ${options.workDir || process.cwd()}`));
    console.log(chalk.cyan(`Session Log: ${this.logger.getLogFilePath()}`));
    console.log(chalk.cyan(`Work Output: ${this.logger.getWorkLogFilePath()}\n`));
    
    this.logger.info('Starting Automatic Claude Code Loop', {
      initialPrompt,
      maxIterations,
      workDir: options.workDir || process.cwd(),
      options
    });

    try {
      if (options.sessionId) {
        // Resume existing session
        await this.sessionManager.resumeSession(options.sessionId, initialPrompt);
        sessionId = options.sessionId;
        console.log(chalk.green(`📄 Resumed session: ${sessionId}`));
      } else {
        // Create new session
        sessionId = await this.sessionManager.createSession(initialPrompt, options.workDir || process.cwd());
        console.log(chalk.green(`📝 Created new session: ${sessionId}`));
      }
    } catch (error) {
      if (error instanceof SessionLimitError) {
        console.log(chalk.red(`❌ ${error.message}`));
        console.log(chalk.yellow('💡 Try closing some running sessions or use --resume to continue an existing session'));
        
        // Show current sessions
        const activeSessions = await this.sessionManager.listActiveSessions();
        if (activeSessions.length > 0) {
          console.log(chalk.cyan('\n🔄 Active sessions:'));
          activeSessions.slice(0, 5).forEach(session => {
            console.log(chalk.gray(`  - ${session.sessionId}: ${session.session?.initialPrompt?.substring(0, 60)}...`));
          });
        }
        return;
      }
      throw error;
    }

    while (this.iteration < maxIterations) {
      this.iteration++;
      this.logger.setIteration(this.iteration);
      
      console.log(chalk.yellow.bold(`\n━━━ Iteration ${this.iteration}/${maxIterations} ━━━`));
      console.log(chalk.gray(`Prompt: ${currentPrompt.substring(0, 100)}${currentPrompt.length > 100 ? '...' : ''}`));
      
      this.logger.info(`Starting iteration ${this.iteration}/${maxIterations}`, {
        prompt: currentPrompt
      });

      try {
        const startTime = Date.now();
        // Only pass sessionId after the first iteration (when we have an actual Claude session to resume)
        const claudeSessionId = this.iteration > 1 ? sessionId : undefined;
        const result = await this.runClaudeCode(currentPrompt, { ...options, sessionId: claudeSessionId });
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(chalk.green(`✓ Completed in ${duration}s`));

        const parsedOutput = this.outputParser.parse(result.output);
        
        if (parsedOutput.sessionId && !sessionId) {
          sessionId = parsedOutput.sessionId;
          console.log(chalk.gray(`Session ID: ${sessionId}`));
          this.logger.setSessionInfo(sessionId, this.iteration);
        }

        await this.sessionManager.addIteration({
          iteration: this.iteration,
          prompt: currentPrompt,
          output: parsedOutput,
          exitCode: result.exitCode,
          duration: parseFloat(duration),
        });

        this.sessionHistory.push(parsedOutput.result || result.output);

        // Log parsed output details
        if (parsedOutput.files && parsedOutput.files.length > 0) {
          this.logger.info(`Files modified: ${parsedOutput.files.join(', ')}`);
        }
        if (parsedOutput.commands && parsedOutput.commands.length > 0) {
          this.logger.info(`Commands executed: ${parsedOutput.commands.join(', ')}`);
        }
        if (parsedOutput.tools && parsedOutput.tools.length > 0) {
          this.logger.info(`Tools used: ${parsedOutput.tools.join(', ')}`);
        }
        
        const analysisResult = await this.analyzeOutput(parsedOutput, result.exitCode);
        
        if (analysisResult.isComplete) {
          console.log(chalk.green.bold('\n✅ Task completed successfully!'));
          this.logger.success('Task completed successfully!');
          break;
        }

        if (analysisResult.hasError && !options.continueOnError) {
          console.log(chalk.red.bold('\n❌ Error detected. Stopping loop.'));
          this.logger.error('Error detected, stopping loop', { analysisResult });
          break;
        }

        currentPrompt = this.promptBuilder.buildNextPrompt(
          parsedOutput,
          this.sessionHistory,
          analysisResult
        );

        if (this.iteration < maxIterations) {
          console.log(chalk.cyan('\n🔄 Preparing next iteration...'));
          await this.delay(2000);
        }

      } catch (error) {
        const handled = this.handleIterationError(error, this.iteration, options);
        
        if (!handled && !options.continueOnError) {
          this.logger.close();
          throw error;
        }
        
        if (handled && options.continueOnError) {
          currentPrompt = `Previous attempt failed with error: ${(error as Error).message}. Please try a different approach.`;
        }
      }
    }

    if (this.iteration >= maxIterations) {
      console.log(chalk.yellow.bold('\n⚠️ Maximum iterations reached.'));
    }

    await this.sessionManager.saveSession();
    console.log(chalk.blue.bold('\n📊 Session Summary:'));
    await this.printSummary();
    
    this.logger.info('Session completed', { summary: await this.sessionManager.getSummary() });
    this.logger.close();
  }

  private async analyzeOutput(output: ParsedOutput, exitCode: number): Promise<AnalysisResult> {
    const hasError = exitCode !== 0 || Boolean(output.error);
    const result = output.result || '';
    
    const completionIndicators = [
      'task completed',
      'successfully implemented',
      'all tests pass',
      'build successful',
      'deployment complete',
      'feature implemented',
      'bug fixed',
    ];
    
    const isComplete = completionIndicators.some(indicator => 
      result.toLowerCase().includes(indicator)
    );
    
    const errorIndicators = [
      'error:',
      'failed',
      'exception',
      'cannot find',
      'undefined',
      'not found',
    ];
    
    const hasErrorInOutput = errorIndicators.some(indicator =>
      result.toLowerCase().includes(indicator)
    );

    return {
      isComplete,
      hasError: hasError || hasErrorInOutput,
      needsMoreWork: !isComplete && !(hasError || hasErrorInOutput),
    };
  }

  private async printSummary(): Promise<void> {
    const summary = await this.sessionManager.getSummary();
    
    console.log(chalk.cyan(`Total Iterations: ${summary.totalIterations}`));
    console.log(chalk.cyan(`Total Duration: ${summary.totalDuration}s`));
    console.log(chalk.cyan(`Success Rate: ${summary.successRate}%`));
    
    if (summary.totalCost) {
      console.log(chalk.cyan(`Estimated Cost: $${summary.totalCost.toFixed(4)}`));
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhanced error handling with user-friendly prompts and guidance
   */
  private handleIterationError(error: any, iteration: number, options: LoopOptions): boolean {
    this.logger.error(`Error in iteration ${iteration}`, { error: error instanceof Error ? error.message : error });

    // Handle specific error types with user guidance
    if (error instanceof AuthenticationError || error instanceof BrowserAuthRequiredError) {
      console.error(chalk.red.bold('\n🔐 Authentication Issue'));
      console.log(chalk.yellow('This error indicates Claude needs authentication.'));
      console.log(chalk.cyan('\n📋 To fix this:'));
      console.log(chalk.white('  1. Open your browser and go to claude.ai'));
      console.log(chalk.white('  2. Log in to your Claude account'));
      console.log(chalk.white('  3. Keep the browser tab open'));
      console.log(chalk.white('  4. Run the command again'));
      console.log(chalk.yellow('\n💡 Alternative: Set ANTHROPIC_API_KEY for headless mode'));
      return true;
    }

    if (error instanceof SDKNotInstalledError || error instanceof ClaudeInstallationError) {
      console.error(chalk.red.bold('\n📦 Claude Installation Issue'));
      console.log(chalk.yellow('Claude Code is not properly installed.'));
      console.log(chalk.cyan('\n📋 Installation Options:'));
      console.log(chalk.white('  Option 1 (Recommended): npm install -g @anthropic-ai/claude-code'));
      console.log(chalk.white('  Option 2: curl -sL https://claude.ai/install.sh | sh'));
      console.log(chalk.white('  Option 3: Download from https://claude.ai/download'));
      console.log(chalk.yellow('\n💡 After installation, run "claude auth" to authenticate'));
      return false; // Don't continue for installation issues
    }

    if (error instanceof NetworkError) {
      console.error(chalk.red.bold('\n🌐 Network Issue'));
      console.log(chalk.yellow('Unable to connect to Claude services.'));
      console.log(chalk.cyan('\n📋 Troubleshooting:'));
      console.log(chalk.white('  1. Check your internet connection'));
      console.log(chalk.white('  2. Verify firewall/proxy settings'));
      console.log(chalk.white('  3. Try again in a few moments'));
      console.log(chalk.white('  4. Check https://status.anthropic.com for service status'));
      return true;
    }

    if (error instanceof APIKeyRequiredError) {
      console.error(chalk.red.bold('\n🗝️  API Key Required'));
      console.log(chalk.yellow('Headless mode requires an API key.'));
      console.log(chalk.cyan('\n📋 API Key Setup Options:'));
      console.log(chalk.white('  Option 1: export ANTHROPIC_API_KEY="your-key-here"'));
      console.log(chalk.white('  Option 2: Set CLAUDE_API_KEY environment variable'));
      console.log(chalk.white('  Option 3: Use interactive mode (remove API key)'));
      console.log(chalk.yellow('\n💡 Get your API key from https://console.anthropic.com'));
      return false; // Don't continue without API key
    }

    if (error instanceof ModelQuotaError) {
      console.error(chalk.red.bold('\n⚡ Usage Limit Exceeded'));
      console.log(chalk.yellow('You have hit your model usage quota or rate limit.'));
      console.log(chalk.cyan('\n📋 Solutions:'));
      console.log(chalk.white('  1. Wait a few minutes before retrying'));
      console.log(chalk.white('  2. Check your usage at https://console.anthropic.com'));
      console.log(chalk.white('  3. Consider upgrading your plan if needed'));
      console.log(chalk.white('  4. Try using "sonnet" model instead of "opus"'));
      return true;
    }

    if (error instanceof RetryExhaustedError) {
      console.error(chalk.red.bold('\n🔄 All Retries Exhausted'));
      console.log(chalk.yellow('Multiple attempts failed to execute the request.'));
      console.log(chalk.cyan('\n📋 Next Steps:'));
      console.log(chalk.white('  1. Check the specific error details above'));
      console.log(chalk.white('  2. Try a simpler or more specific prompt'));
      console.log(chalk.white('  3. Ensure Claude is properly authenticated'));
      console.log(chalk.white('  4. Check your network connection'));
      return true;
    }

    // Generic error handling
    console.error(chalk.red(`\n❌ Error in iteration ${iteration}:`));
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
      if (options.verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red(String(error)));
    }

    console.log(chalk.cyan('\n📋 General Troubleshooting:'));
    console.log(chalk.white('  1. Try a simpler or more specific prompt'));
    console.log(chalk.white('  2. Check that Claude is authenticated'));
    console.log(chalk.white('  3. Verify your internet connection'));
    console.log(chalk.white('  4. Use --verbose flag for more details'));

    return true; // Allow continuation for generic errors
  }

  // Helper method to identify Claude's actual work output
}

async function main() {
  const program = new Command();
  
  program
    .name('automatic-claude-code')
    .description('Run Claude Code in an automated loop for continuous development')
    .version('1.1.1');

  program
    .command('run <prompt>')
    .description('Start an automated Claude Code loop with the given prompt')
    .option('-i, --iterations <number>', 'Maximum number of iterations', '10')
    .option('-m, --model <model>', 'Claude model to use (sonnet or opus)', 'sonnet')
    .option('-d, --dir <path>', 'Working directory for the project')
    .option('-t, --tools <tools>', 'Comma-separated list of allowed tools')
    .option('-c, --continue-on-error', 'Continue loop even if errors occur')
    .option('-v, --verbose', 'Show detailed output')
    .option('--dual-agent', 'Enable dual-agent mode (Manager + Worker)')
    .option('--manager-model <model>', 'Manager agent model (sonnet or opus)', 'opus')
    .option('--worker-model <model>', 'Worker agent model (sonnet or opus)', 'sonnet')
    .option('--use-pty', 'Enable PTY-based execution (default for dual-agent)')
    .option('--no-pty', 'Disable PTY-based execution and use spawn')
    .option('--no-monitoring', 'Disable monitoring server')
    .option('--timeout <minutes>', 'Timeout for each Claude execution in minutes (default: 30)', '30')
    .option('--resume <sessionId>', 'Resume an existing session instead of creating a new one')
    .action(async (prompt, options) => {
      // Start monitoring server if enabled and not disabled
      if (!options.noMonitoring && config.isMonitoringEnabled()) {
        await monitoringManager.startServer();
      }

      // Handle dual-agent mode
      if (options.dualAgent) {
        // Determine PTY usage - use config default, command line options override
        const configDefaultPTY = config.get('dualAgent').usePTY;
        const usePTY = options.noPty ? false : (options.usePty !== undefined ? options.usePty : configDefaultPTY);
        
        const coordinator = new AgentCoordinator({
          coordinationInterval: 3,
          qualityGateThreshold: 0.8,
          maxConcurrentTasks: 2,
          enableCrossValidation: true,
          timeoutMs: 300000,
          retryAttempts: 3
        });
        
        console.log(chalk.cyan(`🚀 Starting dual-agent coordination${usePTY ? ' with PTY execution' : ' with spawn execution'}`));
        
        try {
          await coordinator.startCoordination(prompt, {
            maxIterations: parseInt(options.iterations),
            managerModel: options.managerModel,
            workerModel: options.workerModel,
            workDir: options.dir,
            allowedTools: options.tools,
            continueOnError: options.continueOnError,
            verbose: options.verbose,
            timeout: parseInt(options.timeout) * 60000,
            usePTY: usePTY
          });
        } catch (error) {
          console.error(chalk.red('Fatal error in dual-agent mode:'), error);
          
          // If PTY failed and it wasn't explicitly requested, try falling back to spawn
          if (usePTY && !options.usePty) {
            console.log(chalk.yellow('🔄 PTY execution failed, retrying with spawn execution...'));
            try {
              await coordinator.startCoordination(prompt, {
                maxIterations: parseInt(options.iterations),
                managerModel: options.managerModel,
                workerModel: options.workerModel,
                workDir: options.dir,
                allowedTools: options.tools,
                continueOnError: options.continueOnError,
                verbose: options.verbose,
                timeout: parseInt(options.timeout) * 60000,
                usePTY: false
              });
            } catch (fallbackError) {
              console.error(chalk.red('Fatal error after fallback:'), fallbackError);
              process.exit(1);
            }
          } else {
            process.exit(1);
          }
        }
      } else {
        // Single-agent mode
        const app = new AutomaticClaudeCode();
        
        try {
          await app.runLoop(prompt, {
            maxIterations: parseInt(options.iterations),
            model: options.model,
            workDir: options.dir,
            allowedTools: options.tools,
            continueOnError: options.continueOnError,
            verbose: options.verbose,
            timeout: parseInt(options.timeout) * 60000,
            sessionId: options.resume,
          });
        } catch (error) {
          console.error(chalk.red('Fatal error:'), error);
          process.exit(1);
        }
      }
    });

  program
    .command('dual <prompt>')
    .description('Start a dual-agent Claude Code session with Manager and Worker agents')
    .option('-i, --iterations <number>', 'Maximum number of iterations', '10')
    .option('--manager <model>', 'Manager agent model (sonnet or opus)', 'opus')
    .option('--worker <model>', 'Worker agent model (sonnet or opus)', 'sonnet')
    .option('-d, --dir <path>', 'Working directory for the project')
    .option('-t, --tools <tools>', 'Comma-separated list of allowed tools')
    .option('-c, --continue-on-error', 'Continue even if errors occur')
    .option('-v, --verbose', 'Show detailed output')
    .option('--timeout <minutes>', 'Timeout for each agent execution in minutes (default: 30)', '30')
    .option('--loop-threshold <number>', 'Number of iterations before loop detection triggers (default: 3)', '3')
    .option('--max-retries <number>', 'Maximum retries per agent before escalation (default: 3)', '3')
    .option('--escalation-threshold <number>', 'Max failures before human intervention (default: 5)', '5')
    .option('--fallback-single', 'Fall back to single-agent mode if dual-agent fails')
    .action(async (prompt, options) => {
      const coordinator = new AgentCoordinator({
        coordinationInterval: 3,
        qualityGateThreshold: 0.8,
        maxConcurrentTasks: 2,
        enableCrossValidation: true,
        timeoutMs: parseInt(options.timeout) * 60000,
        retryAttempts: parseInt(options.maxRetries)
      });
      
      try {
        await coordinator.startCoordination(prompt, {
          maxIterations: parseInt(options.iterations),
          managerModel: options.manager,
          workerModel: options.worker,
          workDir: options.dir,
          allowedTools: options.tools,
          continueOnError: options.continueOnError,
          verbose: options.verbose,
          timeout: parseInt(options.timeout) * 60000 // Convert minutes to milliseconds
        });
      } catch (error) {
        console.error(chalk.red('Fatal error in dual-agent mode:'), error);
        process.exit(1);
      }
    });

  program
    .command('history')
    .description('Show session history')
    .action(async () => {
      const sessionManager = new SessionManager();
      await sessionManager.showHistory();
    });

  program
    .command('examples')
    .description('Show example prompts and usage patterns')
    .action(async () => {
      console.log(chalk.blue.bold('\n🚀 Automatic Claude Code - Example Prompts\n'));
      
      console.log(chalk.yellow.bold('💡 Development Tasks:'));
      console.log(chalk.cyan('  acc run "add unit tests for all functions in src/utils.ts" -i 3'));
      console.log(chalk.cyan('  acc run "implement error handling for network requests" -i 4'));
      console.log(chalk.cyan('  acc run "add JSDoc comments to all exported functions" -i 2'));
      console.log(chalk.cyan('  acc run "refactor the authentication module to use JWT" -i 5'));
      
      console.log(chalk.yellow.bold('\n🐛 Bug Fixes:'));
      console.log(chalk.cyan('  acc run "fix the memory leak in the websocket connection" -i 3'));
      console.log(chalk.cyan('  acc run "resolve TypeScript errors in the build process" -i 4'));
      console.log(chalk.cyan('  acc run "fix the race condition in async data loading" -i 3'));
      
      console.log(chalk.yellow.bold('\n📚 Documentation:'));
      console.log(chalk.cyan('  acc run "create comprehensive README with installation guide" -i 2'));
      console.log(chalk.cyan('  acc run "add inline documentation for complex algorithms" -i 3'));
      console.log(chalk.cyan('  acc run "generate API documentation from TypeScript interfaces" -i 2'));
      
      console.log(chalk.yellow.bold('\n🏗️ Architecture:'));
      console.log(chalk.cyan('  acc run "migrate from Express to Fastify framework" -i 6'));
      console.log(chalk.cyan('  acc run "implement dependency injection pattern" -i 4'));
      console.log(chalk.cyan('  acc run "add database connection pooling and optimization" -i 3'));
      
      console.log(chalk.yellow.bold('\n🤖 Dual-Agent Mode:'));
      console.log(chalk.cyan('  acc run "design and implement a REST API for user management" --dual-agent -i 8'));
      console.log(chalk.cyan('  acc run "refactor legacy code to modern TypeScript patterns" --dual-agent -i 6 --verbose'));
      console.log(chalk.cyan('  acc run "create a comprehensive test suite with 90% coverage" --dual-agent -i 5'));
      console.log(chalk.cyan('  acc run "implement OAuth2 authentication with refresh tokens" --dual-agent -i 7 --manager-model opus --worker-model sonnet'));
      console.log(chalk.cyan('  acc run "optimize database queries and add caching layer" --dual-agent -i 4 --continue-on-error'));
      
      console.log(chalk.yellow.bold('\n📊 Monitoring Commands:'));
      console.log(chalk.cyan('  acc monitor                 Show monitoring status'));
      console.log(chalk.cyan('  acc monitor --start         Start monitoring server'));
      console.log(chalk.cyan('  acc monitor --stop          Stop monitoring server'));
      console.log(chalk.cyan('  acc monitor --config        Show monitoring configuration'));
      console.log(chalk.cyan('  acc run "task" --no-monitoring  Disable monitoring for this run'));
      
      console.log(chalk.yellow.bold('\n📊 Enhanced Log Viewing:'));
      console.log(chalk.cyan('  acc logs                    Show session summary'));
      console.log(chalk.cyan('  acc logs --work            View Claude work output only'));
      console.log(chalk.cyan('  acc logs --ui              Launch interactive TUI browser'));
      console.log(chalk.cyan('  acc logs --web             Generate HTML report'));
      console.log(chalk.cyan('  acc logs --stats           Show detailed statistics'));
      console.log(chalk.cyan('  acc logs --search "error"  Search across all sessions'));
      console.log(chalk.cyan('  acc logs --export html     Export session to HTML'));
      console.log(chalk.cyan('  acc logs --session abc123  View specific session'));
      
      console.log(chalk.yellow.bold('\n⚙️ Useful Options:'));
      console.log(chalk.gray('  -i, --iterations <num>     Set max iterations (default: 10)'));
      console.log(chalk.gray('  -m, --model <model>        Use sonnet or opus (default: sonnet)'));
      console.log(chalk.gray('  -v, --verbose             Show detailed output'));
      console.log(chalk.gray('  -c, --continue-on-error   Continue even if errors occur'));
      console.log(chalk.gray('  -d, --dir <path>          Specify working directory'));
      console.log(chalk.gray('  --dual-agent              Enable dual-agent mode (Manager+Worker)'));
      console.log(chalk.gray('  --manager-model <model>   Manager agent model (default: opus)'));
      console.log(chalk.gray('  --worker-model <model>    Worker agent model (default: sonnet)'));
      console.log(chalk.gray('  --no-monitoring           Disable monitoring server'));
      
      console.log(chalk.yellow.bold('\n📋 Tips for Better Results:'));
      console.log(chalk.green('  • Be specific about what you want to achieve'));
      console.log(chalk.green('  • Include file names or modules when relevant'));
      console.log(chalk.green('  • Start with smaller, focused tasks (2-3 iterations)'));
      console.log(chalk.green('  • Use --verbose to see detailed progress'));
      console.log(chalk.green('  • Use "acc logs --ui" for interactive log browsing'));
      console.log(chalk.green('  • Export sessions to HTML for sharing and analysis'));
      console.log(chalk.green('  • Use dual-agent mode for complex tasks requiring planning'));
      console.log(chalk.green('  • Manager agent (opus) handles planning, Worker (sonnet) implements'));
    });

  program
    .command('monitor')
    .description('Manage monitoring server and show status')
    .option('--start', 'Start monitoring server')
    .option('--stop', 'Stop monitoring server')
    .option('--status', 'Show monitoring status')
    .option('--config', 'Show monitoring configuration')
    .action(async (options) => {
      if (options.start) {
        console.log(chalk.blue('🚀 Starting monitoring server...'));
        const started = await monitoringManager.startServer();
        if (started) {
          const status = await monitoringManager.getStatus();
          console.log(chalk.green('✅ Monitoring server started'));
          console.log(chalk.cyan(`   UI: ${status.urls.ui}`));
          console.log(chalk.cyan(`   API: ${status.urls.server}`));
        } else {
          console.log(chalk.red('❌ Failed to start monitoring server'));
        }
        return;
      }

      if (options.stop) {
        console.log(chalk.yellow('⏹️  Stopping monitoring server...'));
        monitoringManager.stopServer();
        console.log(chalk.green('✅ Monitoring server stopped'));
        return;
      }

      if (options.config) {
        const cfg = config.getAll();
        console.log(chalk.blue.bold('\n📊 Monitoring Configuration:\n'));
        
        const configTable = new Table({
          head: ['Setting', 'Value'],
          colWidths: [30, 50],
          style: {
            head: ['cyan'],
            border: ['gray']
          }
        });
        
        configTable.push(
          ['Enabled', cfg.monitoring.enabled ? 'Yes' : 'No'],
          ['Server URL', cfg.monitoring.serverUrl],
          ['WebSocket URL', cfg.monitoring.webSocketUrl],
          ['UI URL', cfg.monitoring.uiUrl],
          ['Server Path', cfg.monitoring.serverPath || 'Auto-detect'],
          ['Auto Start', cfg.monitoring.autoStartServer ? 'Yes' : 'No']
        );
        
        console.log(configTable.toString());
        return;
      }

      // Default: show status
      const status = await monitoringManager.getStatus();
      console.log(chalk.blue.bold('\n📊 Monitoring Status:\n'));
      
      const statusTable = new Table({
        head: ['Component', 'Status', 'URL'],
        colWidths: [20, 15, 40],
        style: {
          head: ['cyan'],
          border: ['gray']
        }
      });
      
      statusTable.push(
        ['Server', status.serverRunning ? chalk.green('Running') : chalk.red('Stopped'), status.urls.server],
        ['WebSocket', status.serverRunning ? chalk.green('Available') : chalk.red('Unavailable'), status.urls.webSocket],
        ['UI', status.serverRunning ? chalk.green('Available') : chalk.red('Unavailable'), status.urls.ui],
        ['Server Path', status.serverPath ? chalk.green('Found') : chalk.yellow('Not Found'), status.serverPath || 'N/A']
      );
      
      console.log(statusTable.toString());
      
      if (!status.serverRunning && status.serverPath) {
        console.log(chalk.yellow('\n💡 Start the server with: acc monitor --start'));
      } else if (!status.serverPath) {
        console.log(chalk.yellow('\n💡 Run from a directory containing dual-agent-monitor/ folder'));
      }
    });

  program
    .command('session [sessionId]')
    .description('View detailed session data')
    .option('-l, --list', 'List all sessions')
    .action(async (sessionId, options) => {
      if (options.list) {
        const sessions = fs.readdirSync('.claude-sessions/').filter(f => f.endsWith('.json'));
        if (sessions.length === 0) {
          console.log(chalk.yellow('No sessions found.'));
          return;
        }
        
        console.log(chalk.blue.bold('\n📋 Available Sessions:\n'));
        sessions.reverse().slice(0, 10).forEach((file, index) => {
          const data = JSON.parse(fs.readFileSync(path.join('.claude-sessions/', file), 'utf-8'));
          const duration = data.endTime ? Math.round((new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / 1000) : 'ongoing';
          console.log(chalk.cyan(`${index + 1}. ${data.id}`));
          console.log(chalk.gray(`   Task: ${data.initialPrompt.substring(0, 50)}${data.initialPrompt.length > 50 ? '...' : ''}`));
          console.log(chalk.gray(`   Iterations: ${data.iterations?.length || 0} | Duration: ${duration}s\n`));
        });
        return;
      }
      
      if (!sessionId) {
        // Show latest session
        const sessions = fs.readdirSync('.claude-sessions/').filter(f => f.endsWith('.json'));
        if (sessions.length === 0) {
          console.log(chalk.yellow('No sessions found.'));
          return;
        }
        sessionId = sessions[sessions.length - 1].replace('.json', '');
      }
      
      try {
        const sessionFile = path.join('.claude-sessions/', `${sessionId}.json`);
        const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        
        console.log(chalk.blue.bold(`\n📊 Session: ${sessionData.id}\n`));
        console.log(chalk.cyan(`Initial Task: ${sessionData.initialPrompt}`));
        console.log(chalk.cyan(`Working Directory: ${sessionData.workDir}`));
        console.log(chalk.cyan(`Started: ${new Date(sessionData.startTime).toLocaleString()}`));
        console.log(chalk.cyan(`Status: ${sessionData.status || 'unknown'}`));
        
        if (sessionData.iterations) {
          console.log(chalk.yellow.bold(`\n🔄 Iterations (${sessionData.iterations.length}):\n`));
          
          sessionData.iterations.forEach((iter: any, _index: number) => {
            console.log(chalk.blue.bold(`--- Iteration ${iter.iteration} ---`));
            console.log(chalk.gray(`Prompt: ${iter.prompt}`));
            console.log(chalk.gray(`Duration: ${iter.duration}s`));
            console.log(chalk.gray(`Exit Code: ${iter.exitCode}`));
            
            if (iter.output.files && iter.output.files.length > 0) {
              console.log(chalk.green(`Files Modified: ${iter.output.files.join(', ')}`));
            }
            if (iter.output.commands && iter.output.commands.length > 0) {
              console.log(chalk.magenta(`Commands: ${iter.output.commands.join(', ')}`));
            }
            if (iter.output.tools && iter.output.tools.length > 0) {
              console.log(chalk.blue(`Tools Used: ${iter.output.tools.join(', ')}`));
            }
            
            console.log(chalk.white('Claude Response:'));
            console.log(chalk.gray(iter.output.result || 'No response'));
            console.log('');
          });
        }
        
      } catch (error) {
        console.error(chalk.red(`Error reading session: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

  program
    .command('logs [repo]')
    .description('View logs for a repository with enhanced visualization')
    .option('-t, --tail', 'Tail the latest log file in real-time')
    .option('-l, --list', 'List all log files')
    .option('--ui', 'Launch interactive TUI viewer')
    .option('--web', 'Generate and open HTML report')
    .option('--stats', 'Show analytics and statistics')
    .option('--search <term>', 'Search across logs')
    .option('--export <format>', 'Export in different formats (html, json)')
    .option('--session <sessionId>', 'View specific session details')
    .option('--work', 'View Claude work output only (no system logs)')
    .action(async (repo, options) => {
      const repoName = repo || path.basename(process.cwd());
      const logViewer = new LogViewer(repoName);
      
      // View work output only
      if (options.work) {
        try {
          if (options.session) {
            // Extract timestamp from session ID if provided
            const timestamp = options.session.replace('session-', '').replace('work-', '');
            logViewer.displayWorkOutput(timestamp);
          } else {
            logViewer.displayWorkOutput();
          }
          return;
        } catch (error) {
          console.error(chalk.red('Error displaying work output:'), error);
          return;
        }
      }
      
      // Interactive TUI viewer
      if (options.ui) {
        try {
          launchTUI(repoName);
          return;
        } catch (error) {
          console.error(chalk.red('Error launching TUI:'), error);
          return;
        }
      }
      
      // Generate HTML report
      if (options.web) {
        try {
          const summaries = logViewer.getSessionSummaries();
          if (summaries.length === 0) {
            console.log(chalk.yellow('No sessions found to export.'));
            return;
          }
          
          // Export the latest session or a specific one
          const sessionId = options.session || summaries[0].sessionId;
          logViewer.exportToHTML(sessionId);
          
          // Try to open in browser (optional)
          const htmlFile = `session-${sessionId}.html`;
          console.log(chalk.green(`\n✅ HTML report generated: ${htmlFile}`));
          console.log(chalk.cyan(`To view: open ${htmlFile} in your browser`));
          return;
        } catch (error) {
          console.error(chalk.red('Error generating HTML report:'), error);
          return;
        }
      }
      
      // Show statistics
      if (options.stats) {
        try {
          const stats = logViewer.getStats();
          
          if (stats.message) {
            console.log(chalk.yellow(stats.message));
            return;
          }
          
          console.log(chalk.blue.bold('\n📊 Session Statistics\n'));
          
          // Create a stats table
          const statsTable = new Table({
            head: ['Metric', 'Value'],
            colWidths: [25, 20],
            style: {
              head: ['cyan'],
              border: ['gray']
            }
          });
          
          statsTable.push(
            ['Total Sessions', stats.totalSessions],
            ['Completed Sessions', `${stats.completedSessions} (${stats.successRate}%)`],
            ['Failed Sessions', stats.failedSessions],
            ['Ongoing Sessions', stats.ongoingSessions],
            ['Average Duration', `${stats.avgDuration}s`],
            ['Total Iterations', stats.totalIterations],
            ['Average Iterations', stats.avgIterations]
          );
          
          console.log(statsTable.toString());
          console.log();
          return;
        } catch (error) {
          console.error(chalk.red('Error generating statistics:'), error);
          return;
        }
      }
      
      // Search functionality
      if (options.search) {
        try {
          const results = logViewer.searchLogs(options.search, options.session);
          
          if (results.length === 0) {
            console.log(chalk.yellow(`No results found for: "${options.search}"`));
            return;
          }
          
          console.log(chalk.blue.bold(`\n🔍 Search Results for "${options.search}" (${results.length} matches)\n`));
          
          results.forEach((entry, index) => {
            const sessionId = entry.sessionId ? entry.sessionId.substring(0, 8) + '...' : 'unknown';
            const timestamp = entry.timestamp.toLocaleString();
            const iteration = entry.iteration ? `Iter ${entry.iteration}` : 'Setup';
            
            console.log(chalk.cyan(`${index + 1}. [${sessionId}] ${iteration} - ${timestamp}`));
            console.log(chalk.gray(`   ${entry.level}: ${entry.message}`));
            if (entry.details && typeof entry.details === 'string' && entry.details.length < 100) {
              console.log(chalk.gray(`   Details: ${entry.details}`));
            }
            console.log();
          });
          return;
        } catch (error) {
          console.error(chalk.red('Error searching logs:'), error);
          return;
        }
      }
      
      // Export functionality
      if (options.export) {
        try {
          const format = options.export.toLowerCase();
          const summaries = logViewer.getSessionSummaries();
          
          if (summaries.length === 0) {
            console.log(chalk.yellow('No sessions found to export.'));
            return;
          }
          
          const sessionId = options.session || summaries[0].sessionId;
          
          if (format === 'html') {
            logViewer.exportToHTML(sessionId);
          } else if (format === 'json') {
            const sessionFile = path.join('.claude-sessions', `${sessionId}.json`);
            if (fs.existsSync(sessionFile)) {
              const outputFile = `session-${sessionId}.json`;
              fs.copyFileSync(sessionFile, outputFile);
              console.log(chalk.green(`✅ JSON export saved: ${outputFile}`));
            } else {
              console.log(chalk.red(`Session file not found: ${sessionFile}`));
            }
          } else {
            console.log(chalk.red(`Unsupported export format: ${format}. Use 'html' or 'json'.`));
          }
          return;
        } catch (error) {
          console.error(chalk.red('Error exporting:'), error);
          return;
        }
      }
      
      // Specific session details
      if (options.session) {
        try {
          logViewer.displaySessionDetails(options.session);
          return;
        } catch (error) {
          console.error(chalk.red('Error displaying session:'), error);
          return;
        }
      }
      
      // Default behavior: show session summary
      if (!options.list && !options.tail) {
        try {
          const summaries = logViewer.getSessionSummaries();
          logViewer.displaySessionSummary(summaries);
          return;
        } catch (error) {
          console.error(chalk.red('Error displaying session summary:'), error);
          // Fall through to original behavior
        }
      }
      
      // Original log file listing/tailing behavior
      if (options.list) {
        const logs = Logger.getRepoLogs(repoName);
        if (logs.length === 0) {
          console.log(chalk.yellow(`No logs found for repo: ${repoName}`));
        } else {
          console.log(chalk.blue.bold(`\nLogs for ${repoName}:\n`));
          logs.forEach((log, index) => {
            console.log(chalk.cyan(`${index + 1}. ${log}`));
          });
        }
        return;
      }
      
      const logs = Logger.getRepoLogs(repoName);
      if (logs.length === 0) {
        console.log(chalk.yellow(`No logs found for repo: ${repoName}`));
        return;
      }
      
      const latestLog = logs[0];
      const logPath = path.join(
        os.homedir(),
        '.automatic-claude-code',
        'logs',
        repoName,
        latestLog
      );
      
      if (options.tail) {
        console.log(chalk.blue.bold(`\nTailing log: ${latestLog}\n`));
        console.log(chalk.gray('Press Ctrl+C to exit\n'));
        
        // Display current content
        const content = fs.readFileSync(logPath, 'utf-8');
        console.log(content);
        
        // Watch for changes
        Logger.tailLog(logPath, (line: string) => {
          console.log(line);
        });
        
        // Keep process running
        process.stdin.resume();
      } else {
        // Display log content
        const content = fs.readFileSync(logPath, 'utf-8');
        console.log(chalk.blue.bold(`\nLog: ${latestLog}\n`));
        console.log(content);
      }
    });

  // Session management commands
  program
    .command('sessions')
    .description('Manage active and completed sessions')
    .option('-l, --list', 'List all sessions')
    .option('-a, --active', 'Show only active sessions')
    .option('-s, --stats', 'Show session statistics')
    .option('-r, --resume <sessionId>', 'Resume a specific session')
    .option('-k, --kill <sessionId>', 'Force kill a session')
    .option('-c, --cleanup [hours]', 'Clean up old sessions (default: 24 hours)')
    .option('--export <sessionId>', 'Export session data for backup')
    .option('--limit <number>', 'Set max concurrent sessions limit')
    .action(async (options) => {
      const acc = new AutomaticClaudeCode();
      const sessionManager = acc['sessionManager'] as EnhancedSessionManager;

      try {
        // List sessions
        if (options.list) {
          const sessions = await sessionManager.listSessions();
          if (sessions.length === 0) {
            console.log(chalk.yellow('No sessions found.'));
            return;
          }

          const table = new Table({
            head: ['Session ID', 'Status', 'Created', 'Task'],
            colWidths: [20, 12, 20, 50]
          });

          sessions.forEach(session => {
            const status = session.status === 'running' ? chalk.green('●') : 
                          session.status === 'completed' ? chalk.blue('✓') : 
                          chalk.red('✗');
            table.push([
              session.id.substring(0, 18),
              `${status} ${session.status}`,
              session.date.toLocaleDateString(),
              session.prompt
            ]);
          });

          console.log('\n📋 Session History:');
          console.log(table.toString());
          return;
        }

        // Show active sessions
        if (options.active) {
          const activeSessions = await sessionManager.listActiveSessions();
          if (activeSessions.length === 0) {
            console.log(chalk.yellow('No active sessions.'));
            return;
          }

          console.log(chalk.cyan.bold('\n🔄 Active Sessions:\n'));
          activeSessions.forEach(session => {
            const state = sessionManager.getSessionState(session.sessionId);
            console.log(chalk.green(`● ${session.sessionId}`));
            console.log(chalk.gray(`  Task: ${session.session?.initialPrompt?.substring(0, 80)}...`));
            console.log(chalk.gray(`  Directory: ${state?.paths.workDir || 'Unknown'}`));
            console.log(chalk.gray(`  Controller: ${state?.processInfo.hasActiveController ? 'Active' : 'Inactive'}`));
            console.log(chalk.gray(`  Last Activity: ${state?.processInfo.lastActivity?.toLocaleTimeString() || 'Unknown'}`));
            console.log('');
          });
          return;
        }

        // Show statistics
        if (options.stats) {
          const stats = sessionManager.getSessionStatistics();
          console.log(chalk.cyan.bold('\n📊 Session Statistics:\n'));
          console.log(chalk.green(`✓ Total Sessions: ${stats.total}`));
          console.log(chalk.yellow(`🔄 Running: ${stats.running}`));
          console.log(chalk.blue(`✅ Completed: ${stats.completed}`));
          console.log(chalk.red(`❌ Failed: ${stats.failed}`));
          console.log(chalk.cyan(`🎯 Max Concurrent: ${stats.maxConcurrent}`));
          
          if (stats.running > 0) {
            const usage = Math.round((stats.running / stats.maxConcurrent) * 100);
            console.log(chalk.magenta(`📈 Usage: ${usage}% (${stats.running}/${stats.maxConcurrent})`));
          }
          return;
        }

        // Resume session
        if (options.resume) {
          try {
            await sessionManager.resumeSession(options.resume);
            console.log(chalk.green(`✅ Resumed session: ${options.resume}`));
          } catch (error) {
            console.log(chalk.red(`❌ Failed to resume session: ${error instanceof Error ? error.message : error}`));
          }
          return;
        }

        // Force kill session
        if (options.kill) {
          try {
            await sessionManager.forceKillSession(options.kill);
            console.log(chalk.red(`🗑️  Force killed session: ${options.kill}`));
          } catch (error) {
            console.log(chalk.red(`❌ Failed to kill session: ${error instanceof Error ? error.message : error}`));
          }
          return;
        }

        // Cleanup old sessions
        if (options.cleanup !== undefined) {
          const hours = options.cleanup ? parseInt(options.cleanup) : 24;
          try {
            const cleaned = await sessionManager.cleanupOldSessions(hours);
            console.log(chalk.green(`🧹 Cleaned up ${cleaned.length} old sessions (older than ${hours}h)`));
            if (cleaned.length > 0) {
              cleaned.forEach(id => console.log(chalk.gray(`  - ${id}`)));
            }
          } catch (error) {
            console.log(chalk.red(`❌ Cleanup failed: ${error instanceof Error ? error.message : error}`));
          }
          return;
        }

        // Export session
        if (options.export) {
          try {
            const exportData = await sessionManager.exportSession(options.export);
            const filename = `session-export-${options.export}-${Date.now()}.json`;
            await fs.promises.writeFile(filename, JSON.stringify(exportData, null, 2));
            console.log(chalk.green(`📦 Exported session to: ${filename}`));
            console.log(chalk.gray(`  Session: ${exportData.session.initialPrompt?.substring(0, 60)}...`));
            console.log(chalk.gray(`  Iterations: ${exportData.session.iterations.length}`));
            console.log(chalk.gray(`  Status: ${exportData.session.status}`));
          } catch (error) {
            console.log(chalk.red(`❌ Export failed: ${error instanceof Error ? error.message : error}`));
          }
          return;
        }

        // Set session limit
        if (options.limit) {
          const limit = parseInt(options.limit);
          if (isNaN(limit) || limit < 1) {
            console.log(chalk.red('❌ Invalid limit. Must be a positive number.'));
            return;
          }
          
          sessionManager.setMaxConcurrentSessions(limit);
          console.log(chalk.green(`✅ Set max concurrent sessions to: ${limit}`));
          return;
        }

        // Default: show active sessions
        const activeSessions = await sessionManager.listActiveSessions();
        if (activeSessions.length === 0) {
          console.log(chalk.yellow('No active sessions. Use --list to see all sessions.'));
        } else {
          console.log(chalk.cyan.bold(`\n🔄 Active Sessions (${activeSessions.length}):\n`));
          activeSessions.slice(0, 5).forEach(session => {
            console.log(chalk.green(`● ${session.sessionId.substring(0, 18)}`));
            console.log(chalk.gray(`  ${session.session?.initialPrompt?.substring(0, 80)}...`));
          });
          if (activeSessions.length > 5) {
            console.log(chalk.gray(`  ... and ${activeSessions.length - 5} more (use --active to see all)`));
          }
        }

      } catch (error) {
        console.error(chalk.red('Session management error:'), error);
      }
    });

  program.parse();
}

if (require.main === module) {
  main().catch(console.error);
}

export { AutomaticClaudeCode };