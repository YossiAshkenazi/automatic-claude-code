#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline/promises';
import chalk from 'chalk';
import { Command } from 'commander';
import { config } from './config';
import { SessionManager } from './sessionManager';
import { OutputParser } from './outputParser';
import { PromptBuilder } from './promptBuilder';

interface LoopOptions {
  maxIterations?: number;
  continueOnError?: boolean;
  verbose?: boolean;
  model?: 'sonnet' | 'opus';
  sessionId?: string;
  workDir?: string;
  allowedTools?: string;
}

class AutomaticClaudeCode {
  private sessionManager: SessionManager;
  private outputParser: OutputParser;
  private promptBuilder: PromptBuilder;
  private iteration: number = 0;
  private sessionHistory: string[] = [];

  constructor() {
    this.sessionManager = new SessionManager();
    this.outputParser = new OutputParser();
    this.promptBuilder = new PromptBuilder();
  }

  async runClaudeCode(prompt: string, options: LoopOptions): Promise<{ output: string; exitCode: number }> {
    const args = ['-p', prompt];
    
    if (options.model) {
      args.push('--model', options.model);
    }
    
    if (options.workDir) {
      args.push('--cwd', options.workDir);
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
      const claudeProcess = spawn('claude', args, {
        shell: true,
        env: { ...process.env },
      });

      let output = '';
      let errorOutput = '';

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        if (options.verbose) {
          process.stdout.write(chalk.gray(chunk));
        }
      });

      claudeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
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
    console.log(chalk.cyan(`Working Directory: ${options.workDir || process.cwd()}\n`));

    await this.sessionManager.createSession(initialPrompt, options.workDir || process.cwd());

    while (this.iteration < maxIterations) {
      this.iteration++;
      
      console.log(chalk.yellow.bold(`\n━━━ Iteration ${this.iteration}/${maxIterations} ━━━`));
      console.log(chalk.gray(`Prompt: ${currentPrompt.substring(0, 100)}${currentPrompt.length > 100 ? '...' : ''}`));

      try {
        const startTime = Date.now();
        const result = await this.runClaudeCode(currentPrompt, { ...options, sessionId });
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(chalk.green(`✓ Completed in ${duration}s`));

        const parsedOutput = this.outputParser.parse(result.output);
        
        if (parsedOutput.sessionId && !sessionId) {
          sessionId = parsedOutput.sessionId;
          console.log(chalk.gray(`Session ID: ${sessionId}`));
        }

        await this.sessionManager.addIteration({
          iteration: this.iteration,
          prompt: currentPrompt,
          output: parsedOutput,
          exitCode: result.exitCode,
          duration: parseFloat(duration),
        });

        this.sessionHistory.push(parsedOutput.result || result.output);

        const analysisResult = await this.analyzeOutput(parsedOutput, result.exitCode);
        
        if (analysisResult.isComplete) {
          console.log(chalk.green.bold('\n✅ Task completed successfully!'));
          break;
        }

        if (analysisResult.hasError && !options.continueOnError) {
          console.log(chalk.red.bold('\n❌ Error detected. Stopping loop.'));
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
        
        if (!options.continueOnError) {
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
  }

  private async analyzeOutput(output: any, exitCode: number): Promise<{
    isComplete: boolean;
    hasError: boolean;
    needsMoreWork: boolean;
    suggestions?: string[];
  }> {
    const hasError = exitCode !== 0 || output.error;
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
      needsMoreWork: !isComplete && !hasError,
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

  program.parse();
}

if (require.main === module) {
  main().catch(console.error);
}

export { AutomaticClaudeCode };