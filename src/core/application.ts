import { EnhancedSessionManager, SessionLimitError } from '../sessionManager';
import { OutputParser, ParsedOutput } from '../outputParser';
import { PromptBuilder } from '../promptBuilder';
import { Logger } from '../logger';
import { SDKAutopilotEngine, AutopilotOptions, AutopilotResult } from './SDKAutopilotEngine';
import { SDKClaudeExecutor, SDKClaudeOptions, SDKExecutionResult } from '../services/sdkClaudeExecutor';
import { ClaudeUtils } from '../claudeUtils';

export interface LoopOptions {
  maxIterations?: number;
  continueOnError?: boolean;
  verbose?: boolean;
  model?: 'sonnet' | 'opus';
  sessionId?: string;
  workDir?: string;
  allowedTools?: string;
  timeout?: number;
}

export interface AnalysisResult {
  isComplete: boolean;
  hasError: boolean;
  needsMoreWork: boolean;
  suggestions?: string[];
}

export class AutomaticClaudeCodeCore {
  private sessionManager: EnhancedSessionManager;
  private outputParser: OutputParser;
  private promptBuilder: PromptBuilder;
  private logger: Logger;
  private sdkClaudeExecutor: SDKClaudeExecutor;
  private sdkAutopilotEngine: SDKAutopilotEngine;
  private browserSessionManager: any; // Deprecated - SDK handles browser auth
  private iteration: number = 0;
  private sessionHistory: string[] = [];

  constructor() {
    this.outputParser = new OutputParser();
    this.promptBuilder = new PromptBuilder();
    this.logger = new Logger();
    this.sdkClaudeExecutor = new SDKClaudeExecutor(this.logger);
    this.sessionManager = new EnhancedSessionManager('.claude-sessions', this.logger, this.sdkClaudeExecutor);
    this.sdkAutopilotEngine = new SDKAutopilotEngine(this.logger);
    // BrowserSessionManager is deprecated - SDK handles browser auth transparently
    this.browserSessionManager = {
      checkBrowserAuth: async () => true,
      resetBrowserSessions: async () => {},
      getBrowserSessions: async () => []
    };
  }

  getClaudeCommand(): { command: string; baseArgs: string[] } {
    return ClaudeUtils.getClaudeCommand();
  }

  async runClaudeCode(prompt: string, options: LoopOptions): Promise<{ output: string; exitCode: number }> {
    // Convert LoopOptions to SDKClaudeOptions for SDK execution
    const sdkOptions: SDKClaudeOptions = {
      model: options.model,
      workDir: options.workDir,
      allowedTools: options.allowedTools,
      sessionId: options.sessionId,
      verbose: options.verbose,
      continueOnError: options.continueOnError,
      timeout: options.timeout
    };

    // Use the SDK ClaudeExecutor for execution
    const result = await this.sdkClaudeExecutor.executeWithSDK(prompt, sdkOptions);
    return { output: result.output, exitCode: result.exitCode };
  }

  async runLoop(initialPrompt: string, options: LoopOptions | AutopilotOptions): Promise<void> {
    const maxIterations = Math.min(options.maxIterations || 10, 50);
    
    console.log('\n🚀 Starting SDK Autopilot Execution\n');
    console.log(`Initial Task: ${initialPrompt}`);
    console.log(`Max Iterations: ${maxIterations} (SDK-enhanced)`);
    console.log(`Working Directory: ${options.workDir || process.cwd()}`);
    console.log(`Session Log: ${this.logger.getLogFilePath()}`);
    console.log(`Work Output: ${this.logger.getWorkLogFilePath()}\n`);
    
    this.logger.info('Starting SDK Autopilot execution', {
      initialPrompt,
      maxIterations,
      workDir: options.workDir || process.cwd(),
      options
    });

    try {
      // Convert LoopOptions to AutopilotOptions
      const autopilotOptions: AutopilotOptions = {
        model: options.model,
        workDir: options.workDir,
        maxIterations,
        timeout: options.timeout,
        verbose: options.verbose,
        continueOnError: options.continueOnError,
        allowedTools: options.allowedTools,
        sessionId: options.sessionId,
        enableHooks: true,
        enableMonitoring: true
      };

      // Use the new SDK Autopilot Engine
      const result = await this.sdkAutopilotEngine.execute(initialPrompt, autopilotOptions);
      
      // Display results
      this.displaySDKResults(result);
      
    } catch (error) {
      this.logger.error('SDK Autopilot execution failed', { error: error instanceof Error ? error.message : String(error) });
      
      // Fallback to legacy execution if SDK fails
      console.log('\n⚠️ SDK execution failed, falling back to legacy mode...\n');
      
      try {
        await this.runLegacyLoop(initialPrompt, options);
      } catch (legacyError) {
        console.error('Both SDK and legacy execution failed:', legacyError);
        throw legacyError;
      }
    }
  }

  private async runLegacyLoop(initialPrompt: string, options: LoopOptions): Promise<void> {
    const maxIterations = Math.min(options.maxIterations || 10, 20);
    let currentPrompt = initialPrompt;
    let sessionId: string | undefined;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    let lastError: Error | null = null;
    
    console.log('\n🔄 Starting Legacy Claude Code Loop\n');
    console.log(`Initial Task: ${initialPrompt}`);
    console.log(`Max Iterations: ${maxIterations} (legacy mode)`);
    console.log(`Working Directory: ${options.workDir || process.cwd()}`);
    
    this.logger.info('Starting Legacy Claude Code Loop', {
      initialPrompt,
      maxIterations,
      workDir: options.workDir || process.cwd(),
      options
    });

    try {
      if (options.sessionId) {
        await this.sessionManager.resumeSession(options.sessionId, initialPrompt);
        sessionId = options.sessionId;
        console.log(`📄 Resumed session: ${sessionId}`);
      } else {
        sessionId = await this.sessionManager.createSession(initialPrompt, options.workDir || process.cwd());
        console.log(`📝 Created new session: ${sessionId}`);
      }
    } catch (error) {
      if (error instanceof SessionLimitError) {
        console.log(`❌ ${error.message}`);
        console.log('💡 Try closing some running sessions or use --resume to continue an existing session');
        
        const activeSessions = await this.sessionManager.listActiveSessions();
        if (activeSessions.length > 0) {
          console.log('\n🔄 Active sessions:');
          activeSessions.slice(0, 5).forEach(session => {
            console.log(`  - ${session.sessionId}: ${session.session?.initialPrompt?.substring(0, 60)}...`);
          });
        }
        return;
      }
      throw error;
    }

    while (this.iteration < maxIterations) {
      this.iteration++;
      this.logger.setIteration(this.iteration);
      
      console.log(`\n━━━ Iteration ${this.iteration}/${maxIterations} ━━━`);
      console.log(`Prompt: ${currentPrompt.substring(0, 100)}${currentPrompt.length > 100 ? '...' : ''}`);
      
      this.logger.info(`Starting iteration ${this.iteration}/${maxIterations}`, {
        prompt: currentPrompt
      });

      try {
        const startTime = Date.now();
        const claudeSessionId = this.iteration > 1 ? sessionId : undefined;
        const result = await this.runClaudeCode(currentPrompt, { ...options, sessionId: claudeSessionId });
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`✓ Completed in ${duration}s`);

        const parsedOutput = this.outputParser.parse(result.output);
        
        if (parsedOutput.sessionId && !sessionId) {
          sessionId = parsedOutput.sessionId;
          console.log(`Session ID: ${sessionId}`);
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
          console.log('\n✅ Task completed successfully!');
          this.logger.success('Task completed successfully!');
          break;
        }

        if (analysisResult.hasError && !options.continueOnError) {
          console.log('\n❌ Error detected. Stopping loop.');
          this.logger.error('Error detected, stopping loop', { analysisResult });
          break;
        }

        consecutiveErrors = 0;
        lastError = null;
        
        currentPrompt = this.promptBuilder.buildNextPrompt(
          parsedOutput,
          this.sessionHistory,
          analysisResult
        );

        if (this.iteration < maxIterations) {
          console.log('\n🔄 Preparing next iteration...');
          await this.delay(2000);
        }

      } catch (error) {
        consecutiveErrors++;
        lastError = error as Error;
        this.logger.error(`Error in iteration ${this.iteration}/${maxIterations}`, { error: lastError.message });
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.log(`\n🛑 Stopping after ${maxConsecutiveErrors} consecutive errors`);
          console.log('This prevents infinite error loops and system instability.');
          this.logger.close();
          throw new Error(`Execution stopped after ${maxConsecutiveErrors} consecutive errors. Last error: ${lastError.message}`);
        }
        
        if (!options.continueOnError) {
          this.logger.close();
          throw error;
        }
        
        if (options.continueOnError) {
          const errorContext = consecutiveErrors > 1 
            ? ` (consecutive error ${consecutiveErrors}/${maxConsecutiveErrors})`
            : '';
          currentPrompt = `Previous attempt failed with error${errorContext}: ${lastError.message}. Please try a different approach and avoid repeating the same actions.`;
          
          if (consecutiveErrors > 1) {
            const errorDelay = 3000 * consecutiveErrors;
            console.log(`⏳ Waiting ${errorDelay}ms before retry due to consecutive errors...`);
            await this.delay(errorDelay);
          }
        }
      }
    }

    if (this.iteration >= maxIterations) {
      console.log('\n⚠️ Maximum iterations reached.');
    }

    await this.sessionManager.saveSession();
    console.log('\n📊 Session Summary:');
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
    
    console.log(`Total Iterations: ${summary.totalIterations}`);
    console.log(`Total Duration: ${summary.totalDuration}s`);
    console.log(`Success Rate: ${summary.successRate}%`);
    
    if (summary.totalCost) {
      console.log(`Estimated Cost: $${summary.totalCost.toFixed(4)}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private displaySDKResults(result: AutopilotResult): void {
    console.log('\n📊 SDK Autopilot Execution Summary:\n');
    
    if (result.success) {
      console.log('✅ Execution completed successfully!');
    } else {
      console.log('❌ Execution completed with errors');
    }
    
    console.log(`Iterations: ${result.iterations}`);
    console.log(`Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);
    console.log(`Method: ${result.executionMethod ? result.executionMethod.toUpperCase() : 'SDK'}`);
    console.log(`Success Rate: ${result.successRate || 0}%`);
    
    if (result.browserUsed) {
      console.log(`Browser: ${result.browserUsed.toUpperCase()}`);
    }
    
    if (result.modelUsed) {
      console.log(`Model: ${result.modelUsed}`);
    }
    
    if (result.totalTokens != null && result.totalTokens > 0) {
      console.log(`Tokens Used: ${result.totalTokens}`);
    }
    
    if (result.toolsInvoked && result.toolsInvoked.length > 0) {
      console.log(`Tools Used: ${result.toolsInvoked.join(', ')}`);
    }
    
    if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      result.errors.forEach((error, index) => {
        if (typeof error === 'string') {
          console.log(`  ${index + 1}. ${error.substring(0, 100)}...`);
        } else if (error && typeof error === 'object') {
          const errorObj = error as any;
          const status = errorObj.recovered ? '✓ Recovered' : '✗ Failed';
          console.log(`  ${index + 1}. Iteration ${errorObj.iteration || 'N/A'}: ${status}`);
          console.log(`     ${(errorObj.error || errorObj.message || String(error)).substring(0, 100)}...`);
        }
      });
    }
    
    if (result.qualityScore) {
      console.log(`Quality Score: ${(result.qualityScore * 100).toFixed(1)}%`);
    }
    
    console.log('');
    
    this.logger.info('SDK Autopilot execution completed', {
      success: result.success,
      iterations: result.iterations,
      duration: result.totalDuration,
      method: result.executionMethod,
      successRate: result.successRate,
      tokensUsed: result.totalTokens
    });
  }

  // Getters for accessing internal components
  get sessionManagerInstance() { return this.sessionManager; }
  get sdkAutopilotEngineInstance() { return this.sdkAutopilotEngine; }
  get loggerInstance() { return this.logger; }
}