"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
const child_process_1 = require("child_process");
const sessionManager_1 = require("./sessionManager");
const outputParser_1 = require("./outputParser");
const logger_1 = require("./logger");
const claudeUtils_1 = require("./claudeUtils");
const chalk_1 = __importDefault(require("chalk"));
class AgentOrchestrator {
    constructor() {
        this.agents = new Map();
        this.handoffHistory = [];
        this.messageHistory = [];
        this.iteration = 0;
        this.loopDetectionBuffer = [];
        this.errorHistory = new Map(); // Track error counts per agent
        this.retryCount = 0;
        this.recoveryAttempts = 0;
        this.sessionManager = new sessionManager_1.SessionManager();
        this.outputParser = new outputParser_1.OutputParser();
        this.logger = new logger_1.Logger();
    }
    async startDualAgentSession(initialTask, options) {
        console.log(chalk_1.default.blue.bold('\n🤖 Starting Dual-Agent Orchestration\n'));
        console.log(chalk_1.default.cyan(`Initial Task: ${initialTask}`));
        console.log(chalk_1.default.cyan(`Manager Model: ${options.managerModel || 'opus'}`));
        console.log(chalk_1.default.cyan(`Worker Model: ${options.workerModel || 'sonnet'}`));
        console.log(chalk_1.default.cyan(`Max Iterations: ${options.maxIterations || 10}`));
        console.log(chalk_1.default.cyan(`Working Directory: ${options.workDir || process.cwd()}\n`));
        this.logger.info('Starting dual-agent orchestration', {
            initialTask,
            options
        });
        // Initialize agents
        await this.initializeAgents(options);
        // Create session
        await this.sessionManager.createSession(initialTask, options.workDir || process.cwd());
        try {
            // Start with manager receiving the initial task
            await this.executeAgentLoop(initialTask, options);
        }
        catch (error) {
            this.logger.error('Dual-agent session failed', { error });
            throw error;
        }
        finally {
            await this.cleanup();
        }
    }
    async initializeAgents(options) {
        // Manager agent (typically Opus for high-level planning)
        const managerAgent = {
            id: 'manager',
            config: {
                name: 'Manager',
                model: options.managerModel || 'opus',
                role: 'manager',
                timeout: options.timeout || 1800000
            },
            active: false,
            lastActivity: new Date(),
            conversationHistory: []
        };
        // Worker agent (typically Sonnet for implementation)
        const workerAgent = {
            id: 'worker',
            config: {
                name: 'Worker',
                model: options.workerModel || 'sonnet',
                role: 'worker',
                timeout: options.timeout || 1800000
            },
            active: false,
            lastActivity: new Date(),
            conversationHistory: []
        };
        this.agents.set('manager', managerAgent);
        this.agents.set('worker', workerAgent);
        this.logger.info('Agents initialized', {
            manager: managerAgent.config,
            worker: workerAgent.config
        });
    }
    async handleAgentError(agentId, error, options) {
        this.lastError = error;
        this.recoveryAttempts++;
        const errorCount = (this.errorHistory.get(agentId) || 0) + 1;
        this.errorHistory.set(agentId, errorCount);
        this.logger.error(`Agent ${agentId} error (count: ${errorCount})`, {
            error: error.message,
            recoveryAttempts: this.recoveryAttempts,
            totalRetries: this.retryCount
        });
        // Check if we've exceeded error thresholds
        const maxRetries = options.maxRetries || 3;
        const escalationThreshold = options.escalationThreshold || 5;
        if (errorCount >= escalationThreshold) {
            console.log(chalk_1.default.red.bold(`\n⚠️ Agent ${agentId} has failed ${errorCount} times. Escalating to human intervention.`));
            this.logger.error(`Agent ${agentId} exceeded failure threshold`, { errorCount, escalationThreshold });
            return { shouldContinue: false };
        }
        if (this.retryCount >= maxRetries) {
            if (options.fallbackToSingleAgent) {
                console.log(chalk_1.default.yellow.bold('\n🔄 Too many failures. Falling back to single-agent mode.'));
                this.logger.info('Falling back to single-agent mode due to errors');
                return { shouldContinue: false }; // Will trigger fallback in caller
            }
            else {
                console.log(chalk_1.default.red.bold('\n❌ Maximum retries exceeded. Stopping dual-agent session.'));
                return { shouldContinue: false };
            }
        }
        // Determine recovery strategy
        const recoveryStrategy = this.determineRecoveryStrategy(agentId, error, errorCount);
        console.log(chalk_1.default.yellow(`\n🔧 Attempting recovery: ${recoveryStrategy.action}`));
        this.logger.info(`Recovery strategy for agent ${agentId}`, recoveryStrategy);
        if (recoveryStrategy.switchAgent) {
            const fallbackAgent = agentId === 'manager' ? 'worker' : 'manager';
            console.log(chalk_1.default.cyan(`\n🔄 Switching to ${fallbackAgent} agent for recovery`));
            return {
                shouldContinue: true,
                recoveryAction: recoveryStrategy.action,
                fallbackAgent
            };
        }
        return {
            shouldContinue: true,
            recoveryAction: recoveryStrategy.action
        };
    }
    determineRecoveryStrategy(agentId, error, errorCount) {
        const errorMessage = error.message.toLowerCase();
        // Network/timeout errors - retry with same agent
        if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('connection')) {
            return {
                action: 'Retrying due to network/timeout issue',
                switchAgent: false,
                retryDelay: Math.min(2000 * errorCount, 10000) // Exponential backoff up to 10s
            };
        }
        // Model-specific errors - switch agents
        if (errorMessage.includes('model') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            return {
                action: 'Switching agents due to model/quota issue',
                switchAgent: true,
                retryDelay: 5000
            };
        }
        // Claude CLI errors - retry with cleanup
        if (errorMessage.includes('claude') || errorMessage.includes('spawn') || errorMessage.includes('command not found')) {
            return {
                action: 'Retrying with Claude CLI cleanup',
                switchAgent: false,
                retryDelay: 3000
            };
        }
        // Permission or file system errors
        if (errorMessage.includes('permission') || errorMessage.includes('access') || errorMessage.includes('enoent')) {
            return {
                action: 'Retrying with modified permissions/paths',
                switchAgent: false,
                retryDelay: 1000
            };
        }
        // After multiple failures, try switching agents
        if (errorCount >= 2) {
            return {
                action: 'Switching agents after multiple failures',
                switchAgent: true,
                retryDelay: 4000
            };
        }
        // Default recovery - simple retry
        return {
            action: 'Simple retry with brief delay',
            switchAgent: false,
            retryDelay: 2000
        };
    }
    async attemptErrorRecovery(recoveryAction, agentId, options) {
        this.logger.info(`Attempting error recovery for agent ${agentId}`, { recoveryAction });
        try {
            // Cleanup agent session if needed
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.active = false;
                agent.lastActivity = new Date();
                // Reset session ID to force fresh session
                if (recoveryAction.includes('cleanup') || recoveryAction.includes('fresh')) {
                    agent.sessionId = undefined;
                    this.logger.info(`Reset session for agent ${agentId}`);
                }
            }
            // Add recovery delay
            const strategy = this.determineRecoveryStrategy(agentId, this.lastError || new Error('Unknown'), this.recoveryAttempts);
            await this.delay(strategy.retryDelay);
            return true;
        }
        catch (recoveryError) {
            this.logger.error(`Error recovery failed for agent ${agentId}`, {
                recoveryError: recoveryError instanceof Error ? recoveryError.message : recoveryError
            });
            return false;
        }
    }
    async fallbackToSingleAgent(currentTask, options) {
        console.log(chalk_1.default.yellow.bold('\n🔧 Initiating single-agent fallback mode'));
        this.logger.info('Starting single-agent fallback', { currentTask: currentTask.substring(0, 100) });
        try {
            // Import and use the original AutomaticClaudeCode class
            const { AutomaticClaudeCode } = await Promise.resolve().then(() => __importStar(require('./index')));
            const fallbackApp = new AutomaticClaudeCode();
            const fallbackPrompt = `The dual-agent system encountered issues. Please complete this task in single-agent mode: ${currentTask}`;
            await fallbackApp.runLoop(fallbackPrompt, {
                maxIterations: Math.max((options.maxIterations || 10) - this.iteration, 3),
                model: 'sonnet', // Use reliable model for fallback
                workDir: options.workDir,
                allowedTools: options.allowedTools,
                continueOnError: true, // More resilient in fallback mode
                verbose: options.verbose,
                timeout: options.timeout
            });
            console.log(chalk_1.default.green.bold('\n✅ Single-agent fallback completed successfully'));
        }
        catch (fallbackError) {
            console.log(chalk_1.default.red.bold('\n❌ Single-agent fallback also failed'));
            this.logger.error('Single-agent fallback failed', {
                error: fallbackError instanceof Error ? fallbackError.message : fallbackError
            });
            throw fallbackError;
        }
    }
    async executeAgentLoop(initialTask, options) {
        const maxIterations = options.maxIterations || 10;
        let currentTask = initialTask;
        let activeAgent = 'manager';
        while (this.iteration < maxIterations) {
            this.iteration++;
            this.logger.setIteration(this.iteration);
            console.log(chalk_1.default.yellow.bold(`\n━━━ Dual-Agent Iteration ${this.iteration}/${maxIterations} ━━━`));
            console.log(chalk_1.default.gray(`Active Agent: ${activeAgent.toUpperCase()}`));
            console.log(chalk_1.default.gray(`Task: ${currentTask.substring(0, 100)}${currentTask.length > 100 ? '...' : ''}`));
            // Check for infinite loop
            if (this.detectInfiniteLoop(currentTask)) {
                console.log(chalk_1.default.red.bold('\n⚠️ Infinite loop detected! Escalating to human intervention.'));
                this.logger.error('Infinite loop detected', {
                    loopBuffer: this.loopDetectionBuffer,
                    iteration: this.iteration
                });
                break;
            }
            try {
                const agentResult = await this.runAgent(activeAgent, currentTask, options);
                // Parse and analyze the result
                const parsedOutput = this.outputParser.parse(agentResult.output);
                // Log agent session info if available
                if (parsedOutput.sessionId) {
                    const agent = this.agents.get(activeAgent);
                    if (agent && !agent.sessionId) {
                        agent.sessionId = parsedOutput.sessionId;
                        this.logger.info(`Agent ${activeAgent} session ID: ${parsedOutput.sessionId}`);
                    }
                }
                // Add to session history
                await this.sessionManager.addIteration({
                    iteration: this.iteration,
                    prompt: `[${activeAgent.toUpperCase()}] ${currentTask}`,
                    output: parsedOutput,
                    exitCode: agentResult.exitCode,
                    duration: parseFloat((agentResult.duration / 1000).toFixed(2))
                });
                // Determine next action
                const nextAction = await this.analyzeAgentOutput(activeAgent, parsedOutput, agentResult.exitCode);
                if (nextAction.isComplete) {
                    console.log(chalk_1.default.green.bold('\n✅ Task completed successfully by dual-agent system!'));
                    this.logger.success('Dual-agent task completed');
                    break;
                }
                if (nextAction.hasError && !options.continueOnError) {
                    console.log(chalk_1.default.red.bold('\n❌ Error detected. Stopping dual-agent loop.'));
                    this.logger.error('Error detected, stopping dual-agent loop', { nextAction });
                    break;
                }
                // Handle agent handoff
                if (nextAction.shouldHandoff) {
                    const handoffResult = await this.handleAgentHandoff(activeAgent, nextAction.nextAgent, parsedOutput, nextAction.handoffTask);
                    activeAgent = handoffResult.toAgent;
                    currentTask = handoffResult.task;
                }
                else {
                    // Continue with same agent
                    currentTask = nextAction.nextTask || this.generateContinuationTask(parsedOutput);
                }
                // Brief pause between iterations
                if (this.iteration < maxIterations) {
                    console.log(chalk_1.default.cyan('\n🔄 Preparing next agent iteration...'));
                    await this.delay(2000);
                }
            }
            catch (error) {
                console.error(chalk_1.default.red(`\n❌ Error in agent ${activeAgent} iteration ${this.iteration}:`), error);
                // Use enhanced error handling
                const recoveryResult = await this.handleAgentError(activeAgent, error instanceof Error ? error : new Error(String(error)), options);
                if (!recoveryResult.shouldContinue) {
                    if (options.fallbackToSingleAgent && this.iteration > 2) {
                        // Try single-agent fallback if we're past initial setup
                        await this.fallbackToSingleAgent(currentTask, options);
                        break;
                    }
                    else {
                        throw error;
                    }
                }
                // Attempt error recovery
                if (recoveryResult.recoveryAction) {
                    const recoverySuccess = await this.attemptErrorRecovery(recoveryResult.recoveryAction, activeAgent, options);
                    if (!recoverySuccess && !options.continueOnError) {
                        throw error;
                    }
                }
                // Switch agents if recommended
                if (recoveryResult.fallbackAgent) {
                    activeAgent = recoveryResult.fallbackAgent;
                    currentTask = `The previous ${activeAgent === 'worker' ? 'manager' : 'worker'} agent encountered an error: ${error instanceof Error ? error.message : error}. Please analyze the situation and continue the task with a different approach.`;
                }
                else {
                    // Modify task for retry with same agent
                    currentTask = `Previous attempt failed with error: ${error instanceof Error ? error.message : error}. Please diagnose and fix the issue, then continue with the task.`;
                }
                this.retryCount++;
            }
        }
        if (this.iteration >= maxIterations) {
            console.log(chalk_1.default.yellow.bold('\n⚠️ Maximum iterations reached in dual-agent mode.'));
        }
        await this.sessionManager.saveSession();
        console.log(chalk_1.default.blue.bold('\n📊 Dual-Agent Session Summary:'));
        await this.printDualAgentSummary();
    }
    async runAgent(agentId, task, options) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }
        agent.active = true;
        agent.lastActivity = new Date();
        const startTime = Date.now();
        console.log(chalk_1.default.blue(`\n🤖 Running ${agent.config.name} (${agent.config.model})...`));
        try {
            // Build agent-specific prompt
            const agentPrompt = this.buildAgentPrompt(agentId, task);
            // Execute Claude Code with agent-specific model
            const result = await this.runClaudeCode(agentPrompt, {
                model: agent.config.model,
                sessionId: agent.sessionId,
                workDir: options.workDir,
                allowedTools: options.allowedTools,
                continueOnError: options.continueOnError,
                verbose: options.verbose,
                timeout: agent.config.timeout
            });
            const duration = Date.now() - startTime;
            console.log(chalk_1.default.green(`✓ ${agent.config.name} completed in ${(duration / 1000).toFixed(2)}s`));
            agent.active = false;
            agent.lastActivity = new Date();
            return {
                ...result,
                duration
            };
        }
        catch (error) {
            agent.active = false;
            agent.lastActivity = new Date();
            throw error;
        }
    }
    buildAgentPrompt(agentId, task) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return task;
        }
        const prompts = [];
        if (agent.config.role === 'manager') {
            prompts.push('You are the MANAGER agent in a dual-agent system.', 'Your role is to break down complex tasks, provide clear instructions, and coordinate work.', 'Focus on high-level planning, task decomposition, and quality assurance.', 'When delegating to the worker agent, provide specific, actionable instructions.', 'Review worker output and decide on next steps.');
        }
        else {
            prompts.push('You are the WORKER agent in a dual-agent system.', 'Your role is to implement specific tasks with precision and attention to detail.', 'Focus on code implementation, testing, debugging, and technical execution.', 'Follow manager instructions carefully and report back with detailed results.', 'If you encounter issues, provide specific error details for the manager to review.');
        }
        // Add conversation context if available
        const recentMessages = this.getRecentAgentMessages(agentId, 3);
        if (recentMessages.length > 0) {
            prompts.push('\nRecent conversation context:');
            recentMessages.forEach(msg => {
                prompts.push(`${msg.from} → ${msg.to}: ${msg.content.substring(0, 200)}`);
            });
        }
        prompts.push(`\nCurrent task: ${task}`);
        return prompts.join(' ');
    }
    getRecentAgentMessages(agentId, count) {
        return this.messageHistory
            .filter(msg => msg.from === agentId || msg.to === agentId)
            .slice(-count);
    }
    async analyzeAgentOutput(agentId, output, exitCode) {
        const hasError = exitCode !== 0 || Boolean(output.error);
        const result = output.result || '';
        // Check for completion indicators
        const completionIndicators = [
            'task completed',
            'successfully implemented',
            'all requirements met',
            'implementation finished',
            'ready for review',
            'task accomplished'
        ];
        const isComplete = completionIndicators.some(indicator => result.toLowerCase().includes(indicator));
        // Determine if handoff is needed
        let shouldHandoff = false;
        let nextAgent = '';
        let handoffTask = '';
        if (agentId === 'manager' && !isComplete && !hasError) {
            // Manager should delegate implementation tasks to worker
            if (result.includes('implement') || result.includes('code') || result.includes('build')) {
                shouldHandoff = true;
                nextAgent = 'worker';
                handoffTask = this.extractWorkerInstructions(result);
            }
        }
        else if (agentId === 'worker' && !isComplete && !hasError) {
            // Worker should report back to manager for review/next steps
            if (result.includes('completed') || result.includes('done') || result.includes('finished')) {
                shouldHandoff = true;
                nextAgent = 'manager';
                handoffTask = `Review the work completed by the worker: ${this.summarizeWorkerOutput(output)}. Determine next steps or completion.`;
            }
        }
        return {
            isComplete,
            hasError,
            shouldHandoff,
            nextAgent: nextAgent || undefined,
            handoffTask: handoffTask || undefined
        };
    }
    extractWorkerInstructions(managerOutput) {
        // Extract actionable instructions from manager output
        const lines = managerOutput.split('\n');
        const instructions = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('1.') || trimmed.startsWith('2.') || trimmed.startsWith('3.') ||
                trimmed.startsWith('-') || trimmed.startsWith('*') ||
                trimmed.includes('implement') || trimmed.includes('create') ||
                trimmed.includes('add') || trimmed.includes('update')) {
                instructions.push(trimmed);
            }
        }
        if (instructions.length > 0) {
            return `Execute the following instructions: ${instructions.slice(0, 5).join(' ')}`;
        }
        // Fallback to summarized version
        return `Implement the requirements outlined in the manager's response: ${managerOutput.substring(0, 300)}${managerOutput.length > 300 ? '...' : ''}`;
    }
    summarizeWorkerOutput(output) {
        const summary = [];
        if (output.files && output.files.length > 0) {
            summary.push(`Modified ${output.files.length} files: ${output.files.slice(-3).join(', ')}`);
        }
        if (output.commands && output.commands.length > 0) {
            summary.push(`Executed ${output.commands.length} commands`);
        }
        if (output.tools && output.tools.length > 0) {
            summary.push(`Used tools: ${output.tools.slice(-3).join(', ')}`);
        }
        const result = output.result || '';
        if (result) {
            const firstSentence = result.split('.')[0] + '.';
            summary.push(`Result: ${firstSentence}`);
        }
        return summary.join('. ');
    }
    async handleAgentHandoff(fromAgent, toAgent, output, task) {
        console.log(chalk_1.default.magenta(`\n🔄 Agent handoff: ${fromAgent.toUpperCase()} → ${toAgent.toUpperCase()}`));
        const handoff = {
            fromAgent,
            toAgent,
            task,
            context: {
                previousWork: this.summarizeWorkerOutput(output),
                files: output.files,
                requirements: task
            },
            timestamp: new Date()
        };
        this.handoffHistory.push(handoff);
        // Log the handoff
        this.logger.info('Agent handoff', {
            from: fromAgent,
            to: toAgent,
            task: task.substring(0, 200),
            context: handoff.context
        });
        // Create agent message
        const message = {
            from: fromAgent,
            to: toAgent,
            content: task,
            timestamp: new Date(),
            messageId: this.generateMessageId(),
            context: {
                files: output.files,
                commands: output.commands,
                errors: output.error ? [output.error] : undefined
            }
        };
        this.messageHistory.push(message);
        // Update agent conversation history
        const fromAgentSession = this.agents.get(fromAgent);
        const toAgentSession = this.agents.get(toAgent);
        if (fromAgentSession) {
            fromAgentSession.conversationHistory.push(message);
        }
        if (toAgentSession) {
            toAgentSession.conversationHistory.push(message);
        }
        return handoff;
    }
    detectInfiniteLoop(currentTask) {
        const threshold = 3; // Default threshold for loop detection
        this.loopDetectionBuffer.push(currentTask.substring(0, 100));
        // Keep only recent tasks
        if (this.loopDetectionBuffer.length > threshold * 2) {
            this.loopDetectionBuffer = this.loopDetectionBuffer.slice(-threshold * 2);
        }
        // Check for repetitive patterns
        if (this.loopDetectionBuffer.length >= threshold) {
            const recent = this.loopDetectionBuffer.slice(-threshold);
            const counts = new Map();
            recent.forEach(task => {
                counts.set(task, (counts.get(task) || 0) + 1);
            });
            // If any task appears more than half the threshold, it's likely a loop
            for (const [task, count] of counts.entries()) {
                if (count >= Math.ceil(threshold / 2)) {
                    return true;
                }
            }
        }
        return false;
    }
    generateContinuationTask(output) {
        const result = output.result || '';
        // Simple continuation logic - can be enhanced
        if (result.includes('error') || result.includes('failed')) {
            return 'Fix the errors encountered in the previous step and continue.';
        }
        if (result.includes('implemented') || result.includes('created')) {
            return 'Review the implementation and proceed with testing or next requirements.';
        }
        return 'Continue with the next logical step in the task.';
    }
    generateMessageId() {
        return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }
    async runClaudeCode(prompt, options) {
        // This reuses the existing Claude Code execution logic from index.ts
        // We need to extract this into a shared utility or extend the main class
        const args = ['-p', prompt];
        if (options.model) {
            args.push('--model', options.model);
        }
        if (options.allowedTools) {
            args.push('--allowedTools', options.allowedTools);
        }
        if (options.sessionId) {
            args.push('--resume', options.sessionId);
        }
        if (options.verbose) {
            args.push('--verbose');
        }
        return new Promise((resolve, reject) => {
            // This is a simplified version - should use the full implementation from index.ts
            const { command, baseArgs } = this.getClaudeCommand();
            const allArgs = [...baseArgs, ...args];
            const claudeProcess = (0, child_process_1.spawn)(command, allArgs, {
                shell: command === 'npx' || command.includes('npx'),
                env: { ...process.env, PATH: process.env.PATH },
                cwd: options.workDir || process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe']
            });
            let output = '';
            let errorOutput = '';
            claudeProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            claudeProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            claudeProcess.on('close', (code) => {
                if (code !== 0 && !options.continueOnError) {
                    reject(new Error(`Claude Code exited with code ${code}: ${errorOutput}`));
                }
                else {
                    resolve({ output, exitCode: code || 0 });
                }
            });
            claudeProcess.on('error', (err) => {
                reject(err);
            });
            // Timeout handling
            const timeout = setTimeout(() => {
                claudeProcess.kill('SIGTERM');
                reject(new Error(`Claude process timed out`));
            }, options.timeout || 1800000);
            claudeProcess.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }
    getClaudeCommand() {
        return claudeUtils_1.ClaudeUtils.getClaudeCommand();
    }
    async printDualAgentSummary() {
        const summary = await this.sessionManager.getSummary();
        console.log(chalk_1.default.cyan(`Total Iterations: ${summary.totalIterations}`));
        console.log(chalk_1.default.cyan(`Total Duration: ${summary.totalDuration}s`));
        console.log(chalk_1.default.cyan(`Success Rate: ${summary.successRate}%`));
        if (summary.totalCost) {
            console.log(chalk_1.default.cyan(`Estimated Cost: $${summary.totalCost.toFixed(4)}`));
        }
        // Dual-agent specific summary
        console.log(chalk_1.default.magenta(`Agent Handoffs: ${this.handoffHistory.length}`));
        console.log(chalk_1.default.magenta(`Messages Exchanged: ${this.messageHistory.length}`));
        // Show recent handoffs
        if (this.handoffHistory.length > 0) {
            console.log(chalk_1.default.yellow('\nRecent Agent Handoffs:'));
            this.handoffHistory.slice(-3).forEach((handoff, index) => {
                console.log(chalk_1.default.gray(`  ${index + 1}. ${handoff.fromAgent} → ${handoff.toAgent}: ${handoff.task.substring(0, 60)}...`));
            });
        }
    }
    async cleanup() {
        // Cleanup agent sessions
        for (const [agentId, agent] of this.agents.entries()) {
            agent.active = false;
            this.logger.info(`Agent ${agentId} cleanup completed`, {
                totalMessages: agent.conversationHistory.length,
                sessionId: agent.sessionId
            });
        }
        this.agents.clear();
        this.logger.close();
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Public methods for accessing agent state
    getAgentStatus() {
        const status = {};
        for (const [agentId, agent] of this.agents.entries()) {
            status[agentId] = {
                active: agent.active,
                lastActivity: agent.lastActivity,
                messageCount: agent.conversationHistory.length
            };
        }
        return status;
    }
    getHandoffHistory() {
        return [...this.handoffHistory];
    }
    getMessageHistory() {
        return [...this.messageHistory];
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
