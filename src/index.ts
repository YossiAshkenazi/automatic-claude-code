#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import chalk from 'chalk';
import { Command } from 'commander';
import { SessionManager } from './sessionManager';
import { OutputParser, ParsedOutput } from './outputParser';
import { PromptBuilder } from './promptBuilder';
import { Logger } from './logger';
import { LogViewer } from './logViewer';
import { launchTUI } from './tuiBrowser';
import { AgentCoordinator } from './agents/agentCoordinator';
import { ClaudeUtils } from './claudeUtils';
import { monitoringManager } from './monitoringManager';
import { config } from './config';
import { ClaudeExecutor, ClaudeExecutionOptions } from './services/claudeExecutor';
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
  private sessionManager: SessionManager;
  private outputParser: OutputParser;
  private promptBuilder: PromptBuilder;
  private logger: Logger;
  private claudeExecutor: ClaudeExecutor;
  private iteration: number = 0;
  private sessionHistory: string[] = [];

  constructor() {
    this.sessionManager = new SessionManager();
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

    await this.sessionManager.createSession(initialPrompt, options.workDir || process.cwd());

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
        const result = await this.runClaudeCode(currentPrompt, { ...options, sessionId });
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
        console.error(chalk.red(`\n❌ Error in iteration ${this.iteration}:`), error);
        this.logger.error(`Error in iteration ${this.iteration}`, { error: error instanceof Error ? error.message : error });
        
        if (!options.continueOnError) {
          this.logger.close();
          throw error;
        }
        
        currentPrompt = `Previous attempt failed with error: ${error}. Please try a different approach.`;
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

  // Helper method to identify Claude's actual work output
}

async function main() {
  const program = new Command();
  
  program
    .name('automatic-claude-code')
    .description('Run Claude Code in an automated loop for continuous development')
    .version('1.0.0');

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
    .option('--no-monitoring', 'Disable monitoring server')
    .option('--timeout <minutes>', 'Timeout for each Claude execution in minutes (default: 30)', '30')
    .action(async (prompt, options) => {
      // Start monitoring server if enabled and not disabled
      if (!options.noMonitoring && config.isMonitoringEnabled()) {
        await monitoringManager.startServer();
      }

      // Handle dual-agent mode
      if (options.dualAgent) {
        const coordinator = new AgentCoordinator({
          coordinationInterval: 3,
          qualityGateThreshold: 0.8,
          maxConcurrentTasks: 2,
          enableCrossValidation: true,
          timeoutMs: 300000,
          retryAttempts: 3
        });
        
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
          });
        } catch (error) {
          console.error(chalk.red('Fatal error in dual-agent mode:'), error);
          process.exit(1);
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

  program.parse();
}

if (require.main === module) {
  main().catch(console.error);
}

export { AutomaticClaudeCode };