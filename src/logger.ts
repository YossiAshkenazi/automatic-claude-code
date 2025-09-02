import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import cliProgress from 'cli-progress';
import boxen from 'boxen';
import ora from 'ora';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  PROGRESS = 'PROGRESS',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  details?: Record<string, unknown> | string | number | boolean;
  repoName?: string;
  sessionId?: string;
  iteration?: number;
}

export class Logger extends EventEmitter {
  private logDir: string = '';
  private currentLogFile: string | null = null;
  private currentWorkLogFile: string | null = null;
  private repoName: string;
  private sessionId: string | null = null;
  private iteration: number = 0;
  private writeStream: fs.WriteStream | null = null;
  private workWriteStream: fs.WriteStream | null = null;
  private consoleEnabled: boolean = true;
  private fileEnabled: boolean = true;
  private maxIterations: number = 10;
  private progressBar: any | null = null;
  private spinner: any = null;
  private showJsonDetails: boolean = false;
  
  // Simplified mode for essential logging only
  private essentialMode: boolean = false;

  constructor(repoName?: string, options?: { essentialMode?: boolean; enableFileLogging?: boolean }) {
    super();
    this.repoName = repoName || this.extractRepoName();
    this.essentialMode = options?.essentialMode || false;
    this.fileEnabled = options?.enableFileLogging ?? true;
    
    if (this.fileEnabled) {
      this.logDir = this.initializeLogDirectory();
      this.initializeLogFile();
    }
  }

  private extractRepoName(): string {
    // Extract repo name from current working directory
    const cwd = process.cwd();
    const repoName = path.basename(cwd);
    return repoName || 'unknown-repo';
  }

  private initializeLogDirectory(): string {
    const baseLogDir = path.join(os.homedir(), '.automatic-claude-code', 'logs');
    const repoLogDir = path.join(baseLogDir, this.repoName);
    
    // Create directories if they don't exist
    if (!fs.existsSync(repoLogDir)) {
      fs.mkdirSync(repoLogDir, { recursive: true });
    }
    
    return repoLogDir;
  }

  private initializeLogFile(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // System/session log file
    this.currentLogFile = path.join(this.logDir, `session-${timestamp}.log`);
    this.writeStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
    
    // Work output log file (Claude's actual work)
    this.currentWorkLogFile = path.join(this.logDir, `work-${timestamp}.log`);
    this.workWriteStream = fs.createWriteStream(this.currentWorkLogFile, { flags: 'a' });
    
    // Write headers to both files
    this.writeToFile({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: `=== Session started for repo: ${this.repoName} ===`,
      repoName: this.repoName
    });
    
    this.writeToWorkFile({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: `=== Claude Work Output - ${this.repoName} ===`,
      repoName: this.repoName
    });
  }

  public setSessionInfo(sessionId: string, iteration?: number): void {
    this.sessionId = sessionId;
    if (iteration !== undefined) {
      this.iteration = iteration;
    }
  }

  public setIteration(iteration: number): void {
    this.iteration = iteration;
    this.updateProgressBar();
  }

  public setMaxIterations(maxIterations: number): void {
    this.maxIterations = maxIterations;
    this.initializeProgressBar();
  }

  public setShowJsonDetails(show: boolean): void {
    this.showJsonDetails = show;
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.padEnd(8);
    const iteration = entry.iteration !== undefined ? `[Iter ${entry.iteration}]` : '';
    const session = entry.sessionId ? `[${entry.sessionId.slice(0, 8)}]` : '';
    
    let formatted = `[${timestamp}] ${level} ${iteration}${session} ${entry.message}`;
    
    if (entry.details) {
      formatted += '\n' + JSON.stringify(entry.details, null, 2);
    }
    
    return formatted;
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.fileEnabled || !this.writeStream) return;
    
    const formatted = this.formatLogEntry(entry);
    this.writeStream.write(formatted + '\n');
  }

  private writeToWorkFile(entry: LogEntry): void {
    if (!this.fileEnabled || !this.workWriteStream) return;
    
    const formatted = this.formatLogEntry(entry);
    this.workWriteStream.write(formatted + '\n');
  }

  private initializeProgressBar(): void {
    if (this.progressBar) {
      this.progressBar.stop();
    }

    this.progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('Progress') + ' |' + chalk.cyan('{bar}') + '| {percentage}% | Iteration {value}/{total}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);

    this.progressBar.start(this.maxIterations, 0);
  }

  private updateProgressBar(): void {
    if (this.progressBar) {
      this.progressBar.update(this.iteration);
    }
  }

  public startSpinner(text?: string): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    this.spinner = ora(text || 'Processing...').start();
  }

  public updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  public stopSpinner(success: boolean = true): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed();
      } else {
        this.spinner.fail();
      }
      this.spinner = null;
    }
  }

  private displayIterationSeparator(iteration?: number): void {
    if (iteration !== undefined) {
      const separator = '═'.repeat(60);
      const title = ` ITERATION ${iteration} `;
      const padding = Math.max(0, Math.floor((separator.length - title.length) / 2));
      const centeredTitle = '═'.repeat(padding) + chalk.bold.yellow(title) + '═'.repeat(separator.length - padding - title.length);
      console.log(chalk.yellow(centeredTitle));
    }
  }

  private formatJsonDetails(details: any): string {
    if (!details) return '';

    const jsonStr = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    
    if (!this.showJsonDetails) {
      // Show collapsed version
      const lines = jsonStr.split('\n');
      if (lines.length > 3) {
        return chalk.dim(`    [JSON Details - ${lines.length} lines] (use --show-json to expand)`);
      }
    }

    // Show expanded version with syntax highlighting
    return jsonStr.split('\n')
      .map(line => chalk.dim(`    ${line}`))
      .join('\n');
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.consoleEnabled) return;
    
    // Show iteration separator when iteration changes
    if (entry.iteration !== undefined && entry.iteration !== this.iteration - 1) {
      this.displayIterationSeparator(entry.iteration);
    }

    const timestamp = new Date().toTimeString().split(' ')[0];
    const iteration = entry.iteration !== undefined ? chalk.cyan(`[${entry.iteration}]`) : '';
    
    let prefix = '';
    let color = chalk.white;
    let bgBox = false;
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        prefix = chalk.gray('🐛 DEBUG');
        color = chalk.gray;
        break;
      case LogLevel.INFO:
        prefix = chalk.blue('ℹ️  INFO');
        color = chalk.white;
        break;
      case LogLevel.PROGRESS:
        prefix = chalk.yellow('⏳ PROGRESS');
        color = chalk.yellow;
        break;
      case LogLevel.SUCCESS:
        prefix = chalk.green('✅ SUCCESS');
        color = chalk.green;
        bgBox = true;
        break;
      case LogLevel.WARNING:
        prefix = chalk.yellow('⚠️  WARNING');
        color = chalk.yellow;
        bgBox = true;
        break;
      case LogLevel.ERROR:
        prefix = chalk.red('❌ ERROR');
        color = chalk.red;
        bgBox = true;
        break;
    }

    const logMessage = `${chalk.gray(timestamp)} ${prefix} ${iteration} ${color(entry.message)}`;
    
    if (bgBox && (entry.level === LogLevel.SUCCESS || entry.level === LogLevel.ERROR || entry.level === LogLevel.WARNING)) {
      const borderColor = entry.level === LogLevel.SUCCESS ? 'green' : 
                          entry.level === LogLevel.ERROR ? 'red' : 'yellow';
      
      console.log(boxen(color(entry.message), {
        padding: 0,
        margin: { top: 0, bottom: 0, left: 2, right: 0 },
        borderStyle: 'round',
        borderColor: borderColor as any
      }));
    } else {
      console.log(logMessage);
    }
    
    if (entry.details) {
      const formattedDetails = this.formatJsonDetails(entry.details);
      if (formattedDetails) {
        console.log(formattedDetails);
      }
    }
  }

  private log(level: LogLevel, message: string, details?: Record<string, unknown> | string | number | boolean): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      details,
      repoName: this.repoName,
      sessionId: this.sessionId ?? undefined,
      iteration: this.iteration
    };
    
    // Always write to file if enabled (for analysis tools compatibility)
    if (this.fileEnabled) {
      this.writeToFile(entry);
    }
    
    // Only log to console if not in essential mode or if it's an essential message
    if (this.shouldLogInEssentialMode(level)) {
      this.logToConsole(entry);
    }
    
    // Emit event for real-time monitoring (optional)
    this.emit('log', entry);
  }

  public debug(message: string, details?: Record<string, unknown> | string | number | boolean): void {
    this.log(LogLevel.DEBUG, message, details);
  }

  public isDebugEnabled(): boolean {
    return process.env.DEBUG === '1' || process.env.NODE_ENV === 'development';
  }

  public info(message: string, details?: Record<string, unknown> | string | number | boolean): void {
    this.log(LogLevel.INFO, message, details);
  }

  public progress(message: string, details?: Record<string, unknown> | string | number | boolean): void {
    this.log(LogLevel.PROGRESS, message, details);
  }

  public success(message: string, details?: Record<string, unknown> | string | number | boolean): void {
    this.log(LogLevel.SUCCESS, message, details);
  }

  public warning(message: string, details?: Record<string, unknown> | string | number | boolean): void {
    this.log(LogLevel.WARNING, message, details);
  }

  public error(message: string, details?: Record<string, unknown> | string | number | boolean): void {
    this.log(LogLevel.ERROR, message, details);
  }

  /**
   * Enhanced logging for authentication flow with user-friendly messaging
   */
  public logAuthStep(step: string, details?: any): void {
    const stepIcons: { [key: string]: string } = {
      'starting': '🚀',
      'checking': '🔍',
      'auth_required': '🔐',
      'auth_success': '✅',
      'auth_failed': '❌',
      'fallback': '🔄',
      'completed': '🎉'
    };
    
    const icon = stepIcons[step.toLowerCase().replace(/\s+/g, '_')] || '📋';
    this.info(`${icon} [Auth] ${step}`, details);
  }

  /**
   * Enhanced logging for SDK operations with debugging information
   */
  public logSDKOperation(operation: string, details?: any): void {
    const operationIcons: { [key: string]: string } = {
      'initializing': '⚙️',
      'available': '✅',
      'not_available': '❌',
      'executing': '🚀',
      'success': '✅',
      'failed': '❌',
      'fallback': '🔄'
    };
    
    const icon = operationIcons[operation.toLowerCase().replace(/\s+/g, '_')] || '🔧';
    this.debug(`${icon} [SDK] ${operation}`, details);
  }

  /**
   * Enhanced logging for retry operations
   */
  public logRetryAttempt(attempt: number, maxAttempts: number, error?: string): void {
    const icon = attempt === 1 ? '🔄' : '⏳';
    this.warning(`${icon} Retry attempt ${attempt}/${maxAttempts}${error ? `: ${error}` : ''}`);
  }

  /**
   * User-friendly progress messaging for authentication steps
   */
  public promptUser(message: string, instructions?: string[]): void {
    console.log('\n' + boxen(chalk.cyan.bold(message), {
      padding: 1,
      margin: 0,
      borderStyle: 'round',
      borderColor: 'cyan'
    }));
    
    if (instructions && instructions.length > 0) {
      console.log(chalk.yellow('\n📋 Instructions:'));
      instructions.forEach((instruction, index) => {
        console.log(chalk.white(`  ${index + 1}. ${instruction}`));
      });
    }
  }

  // Special method for logging Claude's actual work output
  public logClaudeWork(message: string, details?: Record<string, unknown> | string | number | boolean): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      message,
      details,
      repoName: this.repoName,
      sessionId: this.sessionId ?? undefined,
      iteration: this.iteration
    };
    
    // Write to work file only
    this.writeToWorkFile(entry);
    
    // Also display in console with special formatting
    if (this.consoleEnabled) {
      console.log(chalk.cyan('📝 Claude:'), chalk.white(message));
      if (details && this.showJsonDetails) {
        console.log(chalk.gray(JSON.stringify(details, null, 2)));
      }
    }
    
    // Emit event for real-time monitoring
    this.emit('claude-work', entry);
  }

  // Method to log Claude's response/output separately
  public logClaudeResponse(output: string): void {
    // Split by lines and log each meaningful line
    const lines = output.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      // Skip system messages and focus on actual work
      if (!line.includes('DEBUG') && !line.includes('PROGRESS') && 
          !line.includes('Using Claude command') && line.trim()) {
        this.logClaudeWork(line);
      }
    });
  }

  public setConsoleEnabled(enabled: boolean): void {
    this.consoleEnabled = enabled;
  }

  public setFileEnabled(enabled: boolean): void {
    this.fileEnabled = enabled;
  }

  /**
   * Enable essential logging mode - only critical messages and progress
   */
  public setEssentialMode(enabled: boolean): void {
    this.essentialMode = enabled;
    if (enabled) {
      // In essential mode, we only keep basic console output
      this.showJsonDetails = false;
    }
  }

  /**
   * Check if we should log this message in essential mode
   */
  private shouldLogInEssentialMode(level: LogLevel): boolean {
    if (!this.essentialMode) return true;
    
    // In essential mode, only log critical levels
    return level === LogLevel.ERROR || 
           level === LogLevel.WARNING || 
           level === LogLevel.SUCCESS ||
           level === LogLevel.PROGRESS;
  }

  public getLogFilePath(): string | null {
    return this.currentLogFile;
  }

  public getWorkLogFilePath(): string | null {
    return this.currentWorkLogFile;
  }

  public getLogDirectory(): string {
    return this.logDir;
  }

  public close(): void {
    // Clean up progress bar
    if (this.progressBar) {
      this.progressBar.stop();
      this.progressBar = null;
    }

    // Clean up spinner
    this.stopSpinner();

    // Close session log stream
    if (this.writeStream && this.fileEnabled) {
      this.writeToFile({
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: '=== Session ended ===',
        repoName: this.repoName
      });
      
      this.writeStream.end();
      this.writeStream = null;
    }

    // Close work log stream
    if (this.workWriteStream && this.fileEnabled) {
      this.writeToWorkFile({
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: '=== Work output ended ===',
        repoName: this.repoName
      });
      
      this.workWriteStream.end();
      this.workWriteStream = null;
    }
  }

  // Method to get all logs for current repo
  public static getRepoLogs(repoName: string): string[] {
    const logDir = path.join(os.homedir(), '.automatic-claude-code', 'logs', repoName);
    
    if (!fs.existsSync(logDir)) {
      return [];
    }
    
    return fs.readdirSync(logDir)
      .filter(file => file.endsWith('.log'))
      .sort()
      .reverse();
  }

  // Method to tail a log file in real-time
  public static tailLog(logPath: string, callback: (line: string) => void): void {
    fs.watchFile(logPath, { interval: 100 }, () => {
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.split('\n');
      // Process new lines
      lines.forEach(line => {
        if (line.trim()) {
          callback(line);
        }
      });
    });
  }
}

export default Logger;