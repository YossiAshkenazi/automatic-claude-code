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

interface LoopOptions {
  maxIterations?: number;
  continueOnError?: boolean;
  verbose?: boolean;
  model?: 'sonnet' | 'opus';
  sessionId?: string;
  workDir?: string;
  allowedTools?: string;
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
  private iteration: number = 0;
  private sessionHistory: string[] = [];

  constructor() {
    this.sessionManager = new SessionManager();
    this.outputParser = new OutputParser();
    this.promptBuilder = new PromptBuilder();
    this.logger = new Logger();
  }

  private getClaudeCommand(): string {
    // Try to actually run claude --version to verify it works
    try {
      execSync('claude --version', { stdio: 'ignore' });
      return 'claude --dangerously-skip-permissions';
    } catch {
      // Try npx approach
      try {
        this.logger.info('Claude not directly accessible, trying npx...');
        execSync('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 10000 });
        return 'npx @anthropic-ai/claude-code --dangerously-skip-permissions';
      } catch {
        // Try to find claude-code instead of claude
        try {
          execSync('claude-code --version', { stdio: 'ignore' });
          this.logger.info('Using claude-code command');
          return 'claude-code --dangerously-skip-permissions';
        } catch {
          // Last resort - try direct npm global path
          try {
            const npmPrefix = execSync('npm config get prefix', { encoding: 'utf-8' }).trim();
            const possiblePaths = [
              path.join(npmPrefix, 'bin', 'claude'),
              path.join(npmPrefix, 'bin', 'claude-code'),
              path.join(process.env.HOME || '', '.npm-global', 'bin', 'claude'),
              path.join(process.env.HOME || '', '.npm-global', 'bin', 'claude-code')
            ];
            
            for (const claudePath of possiblePaths) {
              if (fs.existsSync(claudePath)) {
                this.logger.info(`Found Claude at: ${claudePath}`);
                return `"${claudePath}" --dangerously-skip-permissions`;
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
    const args = ['-p', prompt];
    
    if (options.model) {
      args.push('--model', options.model);
    }
    
    if (options.workDir) {
      args.push('--add-dir', options.workDir);
    }
    
    if (options.allowedTools) {
      args.push('--allowedTools', options.allowedTools);
    }
    
    if (options.sessionId) {
      args.push('--resume', options.sessionId);
    }
    
    args.push('--output-format', 'json');
    args.push('--permission-mode', 'acceptEdits');
    args.push('--max-turns', '10');
    
    if (options.verbose) {
      args.push('--verbose');
    }

    return new Promise((resolve, reject) => {
      const claudeCommand = this.getClaudeCommand();
      this.logger.debug(`Using Claude command: ${claudeCommand}`);
      
      const claudeProcess = spawn(claudeCommand, args, {
        shell: true,
        env: { ...process.env },
        cwd: options.workDir || process.cwd(),
      });

      let output = '';
      let errorOutput = '';

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        // Log real-time output
        const lines = chunk.split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => {
          this.logger.progress(`Claude output: ${line.substring(0, 200)}`);
        });
        
        if (options.verbose) {
          process.stdout.write(chalk.gray(chunk));
        }
      });

      claudeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        
        // Log errors in real-time
        this.logger.error(`Claude error: ${chunk}`);
        
        if (options.verbose) {
          process.stderr.write(chalk.red(chunk));
        }
      });

      claudeProcess.on('close', (code) => {
        if (code !== 0 && !options.continueOnError) {
          reject(new Error(`Claude Code exited with code ${code}: ${errorOutput}`));
        } else {
          resolve({ output, exitCode: code || 0 });
        }
      });

      claudeProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  async runLoop(initialPrompt: string, options: LoopOptions): Promise<void> {
    const maxIterations = options.maxIterations || 10;
    let currentPrompt = initialPrompt;
    let sessionId: string | undefined;
    
    console.log(chalk.blue.bold('\n🚀 Starting Automatic Claude Code Loop\n'));
    console.log(chalk.cyan(`Initial Task: ${initialPrompt}`));
    console.log(chalk.cyan(`Max Iterations: ${maxIterations}`));
    console.log(chalk.cyan(`Working Directory: ${options.workDir || process.cwd()}`));
    console.log(chalk.cyan(`Log File: ${this.logger.getLogFilePath()}\n`));
    
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
    .action(async (prompt, options) => {
      const app = new AutomaticClaudeCode();
      
      try {
        await app.runLoop(prompt, {
          maxIterations: parseInt(options.iterations),
          model: options.model,
          workDir: options.dir,
          allowedTools: options.tools,
          continueOnError: options.continueOnError,
          verbose: options.verbose,
        });
      } catch (error) {
        console.error(chalk.red('Fatal error:'), error);
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
    .command('logs [repo]')
    .description('View logs for a repository')
    .option('-t, --tail', 'Tail the latest log file in real-time')
    .option('-l, --list', 'List all log files')
    .action(async (repo, options) => {
      const repoName = repo || path.basename(process.cwd());
      
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