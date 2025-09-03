#!/usr/bin/env node
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
exports.AutomaticClaudeCode = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const commander_1 = require("commander");
const sessionManager_1 = require("./sessionManager");
const outputParser_1 = require("./outputParser");
const promptBuilder_1 = require("./promptBuilder");
const logger_1 = require("./logger");
const logViewer_1 = require("./logViewer");
const tuiBrowser_1 = require("./tuiBrowser");
const agentOrchestrator_1 = require("./agentOrchestrator");
const claudeUtils_1 = require("./claudeUtils");
const cli_table3_1 = __importDefault(require("cli-table3"));
class AutomaticClaudeCode {
    constructor() {
        this.iteration = 0;
        this.sessionHistory = [];
        this.sessionManager = new sessionManager_1.SessionManager();
        this.outputParser = new outputParser_1.OutputParser();
        this.promptBuilder = new promptBuilder_1.PromptBuilder();
        this.logger = new logger_1.Logger();
    }
    getClaudeCommand() {
        return claudeUtils_1.ClaudeUtils.getClaudeCommand();
    }
    getClaudeCommandOld() {
        // For WSL/Linux compatibility, try multiple approaches
        if (process.platform === 'linux' || process.env.WSL_DISTRO_NAME) {
            // First try to find full path to npx
            try {
                const npxPath = (0, child_process_1.execSync)('which npx', { encoding: 'utf-8' }).trim();
                (0, child_process_1.execSync)(`${npxPath} @anthropic-ai/claude-code --version`, { stdio: 'ignore', timeout: 15000 });
                return { command: npxPath, baseArgs: ['@anthropic-ai/claude-code', '--dangerously-skip-permissions'] };
            }
            catch (error) {
                // Silently continue to next approach
            }
            // Fallback to regular npx
            try {
                (0, child_process_1.execSync)('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
                return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code', '--dangerously-skip-permissions'] };
            }
            catch (error) {
                // Silently continue to next approach
            }
        }
        // Try to actually run claude --version to verify it works
        try {
            (0, child_process_1.execSync)('claude --version', { stdio: 'ignore' });
            return { command: 'claude', baseArgs: ['--dangerously-skip-permissions'] };
        }
        catch {
            // Try npx approach as fallback
            try {
                (0, child_process_1.execSync)('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
                return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code', '--dangerously-skip-permissions'] };
            }
            catch {
                // Try to find claude-code instead of claude
                try {
                    (0, child_process_1.execSync)('claude-code --version', { stdio: 'ignore' });
                    return { command: 'claude-code', baseArgs: ['--dangerously-skip-permissions'] };
                }
                catch {
                    // Last resort - try direct npm global path
                    try {
                        const npmPrefix = (0, child_process_1.execSync)('npm config get prefix', { encoding: 'utf-8' }).trim();
                        const possiblePaths = [
                            { path: path.join(npmPrefix, 'bin', 'claude'), name: 'claude' },
                            { path: path.join(npmPrefix, 'bin', 'claude-code'), name: 'claude-code' },
                            { path: path.join(process.env.HOME || '', '.npm-global', 'bin', 'claude'), name: 'claude' },
                            { path: path.join(process.env.HOME || '', '.npm-global', 'bin', 'claude-code'), name: 'claude-code' }
                        ];
                        for (const { path: claudePath, name } of possiblePaths) {
                            if (fs.existsSync(claudePath)) {
                                return { command: claudePath, baseArgs: ['--dangerously-skip-permissions'] };
                            }
                        }
                    }
                    catch {
                        // Ignore and fall through to error
                    }
                    throw new Error('Claude CLI not found. Please install with: npm install -g @anthropic-ai/claude-code');
                }
            }
        }
    }
    async runClaudeCode(prompt, options) {
        const args = ['-p', prompt];
        if (options.model) {
            args.push('--model', options.model);
        }
        // Always add working directory (use current directory if not specified)
        const workingDir = options.workDir || process.cwd();
        // Temporarily remove --add-dir to test if it's causing the hang
        // args.push('--add-dir', workingDir);
        if (options.allowedTools) {
            args.push('--allowedTools', options.allowedTools);
        }
        if (options.sessionId) {
            args.push('--resume', options.sessionId);
        }
        // Temporarily remove problematic arguments that may cause hanging
        // args.push('--output-format', 'json');
        // args.push('--permission-mode', 'acceptEdits'); 
        // args.push('--max-turns', '10');
        if (options.verbose) {
            args.push('--verbose');
        }
        return new Promise((resolve, reject) => {
            const { command, baseArgs } = this.getClaudeCommand();
            const allArgs = [...baseArgs, ...args];
            // Only log debug info if verbose mode is enabled
            if (options.verbose) {
                this.logger.debug(`Using Claude command: ${command} ${allArgs.join(' ')}`);
            }
            // Use shell mode for npx commands to ensure proper PATH resolution
            const useShell = command === 'npx' || command.includes('npx');
            const claudeProcess = (0, child_process_1.spawn)(command, allArgs, {
                shell: useShell,
                env: { ...process.env, PATH: process.env.PATH },
                cwd: workingDir,
                stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin to prevent hanging
            });
            let output = '';
            let errorOutput = '';
            claudeProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                // Separate Claude's work output from system logs
                const lines = chunk.split('\n').filter((line) => line.trim());
                lines.forEach((line) => {
                    // Check if this is Claude's actual work or system message
                    if (this.isClaudeWork(line)) {
                        // Log to work file
                        this.logger.logClaudeWork(line);
                    }
                    else if (this.isSystemMessage(line)) {
                        // Log to session file only
                        this.logger.debug(`System: ${line.substring(0, 200)}`);
                    }
                    else if (line.trim()) {
                        // Default to work output for non-empty lines
                        this.logger.logClaudeWork(line);
                    }
                });
                if (options.verbose) {
                    process.stdout.write(chalk_1.default.gray(chunk));
                }
            });
            claudeProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                // Log errors in real-time
                this.logger.error(`Claude error: ${chunk}`);
                if (options.verbose) {
                    process.stderr.write(chalk_1.default.red(chunk));
                }
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
            // Add timeout to prevent hanging (default 30 minutes, configurable)
            const timeoutMs = options.timeout || 1800000; // Default 30 minutes
            const timeoutMinutes = Math.round(timeoutMs / 60000);
            const timeout = setTimeout(() => {
                this.logger.error(`Claude process timed out after ${timeoutMinutes} minutes`);
                claudeProcess.kill('SIGTERM');
                reject(new Error(`Claude process timed out after ${timeoutMinutes} minutes`));
            }, timeoutMs);
            claudeProcess.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }
    async runLoop(initialPrompt, options) {
        const maxIterations = options.maxIterations || 10;
        let currentPrompt = initialPrompt;
        let sessionId;
        console.log(chalk_1.default.blue.bold('\n🚀 Starting Automatic Claude Code Loop\n'));
        console.log(chalk_1.default.cyan(`Initial Task: ${initialPrompt}`));
        console.log(chalk_1.default.cyan(`Max Iterations: ${maxIterations}`));
        console.log(chalk_1.default.cyan(`Working Directory: ${options.workDir || process.cwd()}`));
        console.log(chalk_1.default.cyan(`Session Log: ${this.logger.getLogFilePath()}`));
        console.log(chalk_1.default.cyan(`Work Output: ${this.logger.getWorkLogFilePath()}\n`));
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
            console.log(chalk_1.default.yellow.bold(`\n━━━ Iteration ${this.iteration}/${maxIterations} ━━━`));
            console.log(chalk_1.default.gray(`Prompt: ${currentPrompt.substring(0, 100)}${currentPrompt.length > 100 ? '...' : ''}`));
            this.logger.info(`Starting iteration ${this.iteration}/${maxIterations}`, {
                prompt: currentPrompt
            });
            try {
                const startTime = Date.now();
                const result = await this.runClaudeCode(currentPrompt, { ...options, sessionId });
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(chalk_1.default.green(`✓ Completed in ${duration}s`));
                const parsedOutput = this.outputParser.parse(result.output);
                if (parsedOutput.sessionId && !sessionId) {
                    sessionId = parsedOutput.sessionId;
                    console.log(chalk_1.default.gray(`Session ID: ${sessionId}`));
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
                    console.log(chalk_1.default.green.bold('\n✅ Task completed successfully!'));
                    this.logger.success('Task completed successfully!');
                    break;
                }
                if (analysisResult.hasError && !options.continueOnError) {
                    console.log(chalk_1.default.red.bold('\n❌ Error detected. Stopping loop.'));
                    this.logger.error('Error detected, stopping loop', { analysisResult });
                    break;
                }
                currentPrompt = this.promptBuilder.buildNextPrompt(parsedOutput, this.sessionHistory, analysisResult);
                if (this.iteration < maxIterations) {
                    console.log(chalk_1.default.cyan('\n🔄 Preparing next iteration...'));
                    await this.delay(2000);
                }
            }
            catch (error) {
                console.error(chalk_1.default.red(`\n❌ Error in iteration ${this.iteration}:`), error);
                this.logger.error(`Error in iteration ${this.iteration}`, { error: error instanceof Error ? error.message : error });
                if (!options.continueOnError) {
                    this.logger.close();
                    throw error;
                }
                currentPrompt = `Previous attempt failed with error: ${error}. Please try a different approach.`;
            }
        }
        if (this.iteration >= maxIterations) {
            console.log(chalk_1.default.yellow.bold('\n⚠️ Maximum iterations reached.'));
        }
        await this.sessionManager.saveSession();
        console.log(chalk_1.default.blue.bold('\n📊 Session Summary:'));
        await this.printSummary();
        this.logger.info('Session completed', { summary: await this.sessionManager.getSummary() });
        this.logger.close();
    }
    async analyzeOutput(output, exitCode) {
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
        const isComplete = completionIndicators.some(indicator => result.toLowerCase().includes(indicator));
        const errorIndicators = [
            'error:',
            'failed',
            'exception',
            'cannot find',
            'undefined',
            'not found',
        ];
        const hasErrorInOutput = errorIndicators.some(indicator => result.toLowerCase().includes(indicator));
        return {
            isComplete,
            hasError: hasError || hasErrorInOutput,
            needsMoreWork: !isComplete && !(hasError || hasErrorInOutput),
        };
    }
    async printSummary() {
        const summary = await this.sessionManager.getSummary();
        console.log(chalk_1.default.cyan(`Total Iterations: ${summary.totalIterations}`));
        console.log(chalk_1.default.cyan(`Total Duration: ${summary.totalDuration}s`));
        console.log(chalk_1.default.cyan(`Success Rate: ${summary.successRate}%`));
        if (summary.totalCost) {
            console.log(chalk_1.default.cyan(`Estimated Cost: $${summary.totalCost.toFixed(4)}`));
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Helper method to identify Claude's actual work output
    isClaudeWork(line) {
        const workIndicators = [
            'Creating',
            'Writing',
            'Reading',
            'Editing',
            'Updating',
            'Installing',
            'Building',
            'Testing',
            'Implementing',
            'Adding',
            'Removing',
            'Fixing',
            'I\'ll',
            'I will',
            'I\'m',
            'Let me',
            'Here\'s',
            'This',
            '```', // Code blocks
            'File created',
            'File updated',
            'Successfully'
        ];
        return workIndicators.some(indicator => line.toLowerCase().includes(indicator.toLowerCase()));
    }
    // Helper method to identify system/debug messages
    isSystemMessage(line) {
        const systemIndicators = [
            '[DEBUG]',
            '[INFO]',
            '[PROGRESS]',
            '[WARNING]',
            '[ERROR]',
            'Using Claude command',
            'Working directory',
            'Session ID:',
            'Iteration',
            'Exit Code:',
            'npm WARN',
            'npm notice',
            'pnpm:',
            'node_modules',
            'package.json'
        ];
        return systemIndicators.some(indicator => line.includes(indicator));
    }
}
exports.AutomaticClaudeCode = AutomaticClaudeCode;
async function main() {
    const program = new commander_1.Command();
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
        .option('--timeout <minutes>', 'Timeout for each Claude execution in minutes (default: 30)', '30')
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
                timeout: parseInt(options.timeout) * 60000, // Convert minutes to milliseconds
            });
        }
        catch (error) {
            console.error(chalk_1.default.red('Fatal error:'), error);
            process.exit(1);
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
        const orchestrator = new agentOrchestrator_1.AgentOrchestrator();
        try {
            await orchestrator.startDualAgentSession(prompt, {
                maxIterations: parseInt(options.iterations),
                managerModel: options.manager,
                workerModel: options.worker,
                workDir: options.dir,
                allowedTools: options.tools,
                continueOnError: options.continueOnError,
                verbose: options.verbose,
                timeout: parseInt(options.timeout) * 60000, // Convert minutes to milliseconds
                loopDetectionThreshold: parseInt(options.loopThreshold),
                maxRetries: parseInt(options.maxRetries),
                escalationThreshold: parseInt(options.escalationThreshold),
                fallbackToSingleAgent: options.fallbackSingle
            });
        }
        catch (error) {
            console.error(chalk_1.default.red('Fatal error in dual-agent mode:'), error);
            process.exit(1);
        }
    });
    program
        .command('history')
        .description('Show session history')
        .action(async () => {
        const sessionManager = new sessionManager_1.SessionManager();
        await sessionManager.showHistory();
    });
    program
        .command('examples')
        .description('Show example prompts and usage patterns')
        .action(async () => {
        console.log(chalk_1.default.blue.bold('\n🚀 Automatic Claude Code - Example Prompts\n'));
        console.log(chalk_1.default.yellow.bold('💡 Development Tasks:'));
        console.log(chalk_1.default.cyan('  acc run "add unit tests for all functions in src/utils.ts" -i 3'));
        console.log(chalk_1.default.cyan('  acc run "implement error handling for network requests" -i 4'));
        console.log(chalk_1.default.cyan('  acc run "add JSDoc comments to all exported functions" -i 2'));
        console.log(chalk_1.default.cyan('  acc run "refactor the authentication module to use JWT" -i 5'));
        console.log(chalk_1.default.yellow.bold('\n🐛 Bug Fixes:'));
        console.log(chalk_1.default.cyan('  acc run "fix the memory leak in the websocket connection" -i 3'));
        console.log(chalk_1.default.cyan('  acc run "resolve TypeScript errors in the build process" -i 4'));
        console.log(chalk_1.default.cyan('  acc run "fix the race condition in async data loading" -i 3'));
        console.log(chalk_1.default.yellow.bold('\n📚 Documentation:'));
        console.log(chalk_1.default.cyan('  acc run "create comprehensive README with installation guide" -i 2'));
        console.log(chalk_1.default.cyan('  acc run "add inline documentation for complex algorithms" -i 3'));
        console.log(chalk_1.default.cyan('  acc run "generate API documentation from TypeScript interfaces" -i 2'));
        console.log(chalk_1.default.yellow.bold('\n🏗️ Architecture:'));
        console.log(chalk_1.default.cyan('  acc run "migrate from Express to Fastify framework" -i 6'));
        console.log(chalk_1.default.cyan('  acc run "implement dependency injection pattern" -i 4'));
        console.log(chalk_1.default.cyan('  acc run "add database connection pooling and optimization" -i 3'));
        console.log(chalk_1.default.yellow.bold('\n🤖 Dual-Agent Mode:'));
        console.log(chalk_1.default.cyan('  acc dual "design and implement a REST API for user management" -i 8'));
        console.log(chalk_1.default.cyan('  acc dual "refactor legacy code to modern TypeScript patterns" -i 6 --verbose'));
        console.log(chalk_1.default.cyan('  acc dual "create a comprehensive test suite with 90% coverage" -i 5'));
        console.log(chalk_1.default.cyan('  acc dual "implement OAuth2 authentication with refresh tokens" -i 7 --manager opus --worker sonnet'));
        console.log(chalk_1.default.cyan('  acc dual "optimize database queries and add caching layer" -i 4 --continue-on-error'));
        console.log(chalk_1.default.yellow.bold('\n📊 Enhanced Log Viewing:'));
        console.log(chalk_1.default.cyan('  acc logs                    Show session summary'));
        console.log(chalk_1.default.cyan('  acc logs --work            View Claude work output only'));
        console.log(chalk_1.default.cyan('  acc logs --ui              Launch interactive TUI browser'));
        console.log(chalk_1.default.cyan('  acc logs --web             Generate HTML report'));
        console.log(chalk_1.default.cyan('  acc logs --stats           Show detailed statistics'));
        console.log(chalk_1.default.cyan('  acc logs --search "error"  Search across all sessions'));
        console.log(chalk_1.default.cyan('  acc logs --export html     Export session to HTML'));
        console.log(chalk_1.default.cyan('  acc logs --session abc123  View specific session'));
        console.log(chalk_1.default.yellow.bold('\n⚙️ Useful Options:'));
        console.log(chalk_1.default.gray('  -i, --iterations <num>   Set max iterations (default: 10)'));
        console.log(chalk_1.default.gray('  -m, --model <model>      Use sonnet or opus (default: sonnet)'));
        console.log(chalk_1.default.gray('  -v, --verbose           Show detailed output'));
        console.log(chalk_1.default.gray('  -c, --continue-on-error Continue even if errors occur'));
        console.log(chalk_1.default.gray('  -d, --dir <path>        Specify working directory'));
        console.log(chalk_1.default.gray('  --manager <model>       Manager agent model (dual mode)'));
        console.log(chalk_1.default.gray('  --worker <model>        Worker agent model (dual mode)'));
        console.log(chalk_1.default.gray('  --loop-threshold <num>  Loop detection threshold (dual mode)'));
        console.log(chalk_1.default.yellow.bold('\n📋 Tips for Better Results:'));
        console.log(chalk_1.default.green('  • Be specific about what you want to achieve'));
        console.log(chalk_1.default.green('  • Include file names or modules when relevant'));
        console.log(chalk_1.default.green('  • Start with smaller, focused tasks (2-3 iterations)'));
        console.log(chalk_1.default.green('  • Use --verbose to see detailed progress'));
        console.log(chalk_1.default.green('  • Use "acc logs --ui" for interactive log browsing'));
        console.log(chalk_1.default.green('  • Export sessions to HTML for sharing and analysis'));
        console.log(chalk_1.default.green('  • Use dual-agent mode for complex tasks requiring planning'));
        console.log(chalk_1.default.green('  • Manager agent (opus) handles planning, Worker (sonnet) implements'));
    });
    program
        .command('session [sessionId]')
        .description('View detailed session data')
        .option('-l, --list', 'List all sessions')
        .action(async (sessionId, options) => {
        const sessionManager = new sessionManager_1.SessionManager();
        if (options.list) {
            const sessions = fs.readdirSync('.claude-sessions/').filter(f => f.endsWith('.json'));
            if (sessions.length === 0) {
                console.log(chalk_1.default.yellow('No sessions found.'));
                return;
            }
            console.log(chalk_1.default.blue.bold('\n📋 Available Sessions:\n'));
            sessions.reverse().slice(0, 10).forEach((file, index) => {
                const data = JSON.parse(fs.readFileSync(path.join('.claude-sessions/', file), 'utf-8'));
                const duration = data.endTime ? Math.round((new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / 1000) : 'ongoing';
                console.log(chalk_1.default.cyan(`${index + 1}. ${data.id}`));
                console.log(chalk_1.default.gray(`   Task: ${data.initialPrompt.substring(0, 50)}${data.initialPrompt.length > 50 ? '...' : ''}`));
                console.log(chalk_1.default.gray(`   Iterations: ${data.iterations?.length || 0} | Duration: ${duration}s\n`));
            });
            return;
        }
        if (!sessionId) {
            // Show latest session
            const sessions = fs.readdirSync('.claude-sessions/').filter(f => f.endsWith('.json'));
            if (sessions.length === 0) {
                console.log(chalk_1.default.yellow('No sessions found.'));
                return;
            }
            sessionId = sessions[sessions.length - 1].replace('.json', '');
        }
        try {
            const sessionFile = path.join('.claude-sessions/', `${sessionId}.json`);
            const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
            console.log(chalk_1.default.blue.bold(`\n📊 Session: ${sessionData.id}\n`));
            console.log(chalk_1.default.cyan(`Initial Task: ${sessionData.initialPrompt}`));
            console.log(chalk_1.default.cyan(`Working Directory: ${sessionData.workDir}`));
            console.log(chalk_1.default.cyan(`Started: ${new Date(sessionData.startTime).toLocaleString()}`));
            console.log(chalk_1.default.cyan(`Status: ${sessionData.status || 'unknown'}`));
            if (sessionData.iterations) {
                console.log(chalk_1.default.yellow.bold(`\n🔄 Iterations (${sessionData.iterations.length}):\n`));
                sessionData.iterations.forEach((iter, index) => {
                    console.log(chalk_1.default.blue.bold(`--- Iteration ${iter.iteration} ---`));
                    console.log(chalk_1.default.gray(`Prompt: ${iter.prompt}`));
                    console.log(chalk_1.default.gray(`Duration: ${iter.duration}s`));
                    console.log(chalk_1.default.gray(`Exit Code: ${iter.exitCode}`));
                    if (iter.output.files && iter.output.files.length > 0) {
                        console.log(chalk_1.default.green(`Files Modified: ${iter.output.files.join(', ')}`));
                    }
                    if (iter.output.commands && iter.output.commands.length > 0) {
                        console.log(chalk_1.default.magenta(`Commands: ${iter.output.commands.join(', ')}`));
                    }
                    if (iter.output.tools && iter.output.tools.length > 0) {
                        console.log(chalk_1.default.blue(`Tools Used: ${iter.output.tools.join(', ')}`));
                    }
                    console.log(chalk_1.default.white('Claude Response:'));
                    console.log(chalk_1.default.gray(iter.output.result || 'No response'));
                    console.log('');
                });
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`Error reading session: ${error instanceof Error ? error.message : String(error)}`));
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
        const logViewer = new logViewer_1.LogViewer(repoName);
        // View work output only
        if (options.work) {
            try {
                if (options.session) {
                    // Extract timestamp from session ID if provided
                    const timestamp = options.session.replace('session-', '').replace('work-', '');
                    logViewer.displayWorkOutput(timestamp);
                }
                else {
                    logViewer.displayWorkOutput();
                }
                return;
            }
            catch (error) {
                console.error(chalk_1.default.red('Error displaying work output:'), error);
                return;
            }
        }
        // Interactive TUI viewer
        if (options.ui) {
            try {
                (0, tuiBrowser_1.launchTUI)(repoName);
                return;
            }
            catch (error) {
                console.error(chalk_1.default.red('Error launching TUI:'), error);
                return;
            }
        }
        // Generate HTML report
        if (options.web) {
            try {
                const summaries = logViewer.getSessionSummaries();
                if (summaries.length === 0) {
                    console.log(chalk_1.default.yellow('No sessions found to export.'));
                    return;
                }
                // Export the latest session or a specific one
                const sessionId = options.session || summaries[0].sessionId;
                logViewer.exportToHTML(sessionId);
                // Try to open in browser (optional)
                const htmlFile = `session-${sessionId}.html`;
                console.log(chalk_1.default.green(`\n✅ HTML report generated: ${htmlFile}`));
                console.log(chalk_1.default.cyan(`To view: open ${htmlFile} in your browser`));
                return;
            }
            catch (error) {
                console.error(chalk_1.default.red('Error generating HTML report:'), error);
                return;
            }
        }
        // Show statistics
        if (options.stats) {
            try {
                const stats = logViewer.getStats();
                if (stats.message) {
                    console.log(chalk_1.default.yellow(stats.message));
                    return;
                }
                console.log(chalk_1.default.blue.bold('\n📊 Session Statistics\n'));
                // Create a stats table
                const statsTable = new cli_table3_1.default({
                    head: ['Metric', 'Value'],
                    colWidths: [25, 20],
                    style: {
                        head: ['cyan'],
                        border: ['gray']
                    }
                });
                statsTable.push(['Total Sessions', stats.totalSessions], ['Completed Sessions', `${stats.completedSessions} (${stats.successRate}%)`], ['Failed Sessions', stats.failedSessions], ['Ongoing Sessions', stats.ongoingSessions], ['Average Duration', `${stats.avgDuration}s`], ['Total Iterations', stats.totalIterations], ['Average Iterations', stats.avgIterations]);
                console.log(statsTable.toString());
                console.log();
                return;
            }
            catch (error) {
                console.error(chalk_1.default.red('Error generating statistics:'), error);
                return;
            }
        }
        // Search functionality
        if (options.search) {
            try {
                const results = logViewer.searchLogs(options.search, options.session);
                if (results.length === 0) {
                    console.log(chalk_1.default.yellow(`No results found for: "${options.search}"`));
                    return;
                }
                console.log(chalk_1.default.blue.bold(`\n🔍 Search Results for "${options.search}" (${results.length} matches)\n`));
                results.forEach((entry, index) => {
                    const sessionId = entry.sessionId ? entry.sessionId.substring(0, 8) + '...' : 'unknown';
                    const timestamp = entry.timestamp.toLocaleString();
                    const iteration = entry.iteration ? `Iter ${entry.iteration}` : 'Setup';
                    console.log(chalk_1.default.cyan(`${index + 1}. [${sessionId}] ${iteration} - ${timestamp}`));
                    console.log(chalk_1.default.gray(`   ${entry.level}: ${entry.message}`));
                    if (entry.details && typeof entry.details === 'string' && entry.details.length < 100) {
                        console.log(chalk_1.default.gray(`   Details: ${entry.details}`));
                    }
                    console.log();
                });
                return;
            }
            catch (error) {
                console.error(chalk_1.default.red('Error searching logs:'), error);
                return;
            }
        }
        // Export functionality
        if (options.export) {
            try {
                const format = options.export.toLowerCase();
                const summaries = logViewer.getSessionSummaries();
                if (summaries.length === 0) {
                    console.log(chalk_1.default.yellow('No sessions found to export.'));
                    return;
                }
                const sessionId = options.session || summaries[0].sessionId;
                if (format === 'html') {
                    logViewer.exportToHTML(sessionId);
                }
                else if (format === 'json') {
                    const sessionFile = path.join('.claude-sessions', `${sessionId}.json`);
                    if (fs.existsSync(sessionFile)) {
                        const outputFile = `session-${sessionId}.json`;
                        fs.copyFileSync(sessionFile, outputFile);
                        console.log(chalk_1.default.green(`✅ JSON export saved: ${outputFile}`));
                    }
                    else {
                        console.log(chalk_1.default.red(`Session file not found: ${sessionFile}`));
                    }
                }
                else {
                    console.log(chalk_1.default.red(`Unsupported export format: ${format}. Use 'html' or 'json'.`));
                }
                return;
            }
            catch (error) {
                console.error(chalk_1.default.red('Error exporting:'), error);
                return;
            }
        }
        // Specific session details
        if (options.session) {
            try {
                logViewer.displaySessionDetails(options.session);
                return;
            }
            catch (error) {
                console.error(chalk_1.default.red('Error displaying session:'), error);
                return;
            }
        }
        // Default behavior: show session summary
        if (!options.list && !options.tail) {
            try {
                const summaries = logViewer.getSessionSummaries();
                logViewer.displaySessionSummary(summaries);
                return;
            }
            catch (error) {
                console.error(chalk_1.default.red('Error displaying session summary:'), error);
                // Fall through to original behavior
            }
        }
        // Original log file listing/tailing behavior
        if (options.list) {
            const logs = logger_1.Logger.getRepoLogs(repoName);
            if (logs.length === 0) {
                console.log(chalk_1.default.yellow(`No logs found for repo: ${repoName}`));
            }
            else {
                console.log(chalk_1.default.blue.bold(`\nLogs for ${repoName}:\n`));
                logs.forEach((log, index) => {
                    console.log(chalk_1.default.cyan(`${index + 1}. ${log}`));
                });
            }
            return;
        }
        const logs = logger_1.Logger.getRepoLogs(repoName);
        if (logs.length === 0) {
            console.log(chalk_1.default.yellow(`No logs found for repo: ${repoName}`));
            return;
        }
        const latestLog = logs[0];
        const logPath = path.join(os.homedir(), '.automatic-claude-code', 'logs', repoName, latestLog);
        if (options.tail) {
            console.log(chalk_1.default.blue.bold(`\nTailing log: ${latestLog}\n`));
            console.log(chalk_1.default.gray('Press Ctrl+C to exit\n'));
            // Display current content
            const content = fs.readFileSync(logPath, 'utf-8');
            console.log(content);
            // Watch for changes
            logger_1.Logger.tailLog(logPath, (line) => {
                console.log(line);
            });
            // Keep process running
            process.stdin.resume();
        }
        else {
            // Display log content
            const content = fs.readFileSync(logPath, 'utf-8');
            console.log(chalk_1.default.blue.bold(`\nLog: ${latestLog}\n`));
            console.log(content);
        }
    });
    program.parse();
}
if (require.main === module) {
    main().catch(console.error);
}
