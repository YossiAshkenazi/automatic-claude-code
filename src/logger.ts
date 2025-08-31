import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { EventEmitter } from 'events';

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
  private logDir: string;
  private currentLogFile: string | null = null;
  private repoName: string;
  private sessionId: string | null = null;
  private iteration: number = 0;
  private writeStream: fs.WriteStream | null = null;
  private consoleEnabled: boolean = true;
  private fileEnabled: boolean = true;

  constructor(repoName?: string) {
    super();
    this.repoName = repoName || this.extractRepoName();
    this.logDir = this.initializeLogDirectory();
    this.initializeLogFile();
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
    this.currentLogFile = path.join(this.logDir, `session-${timestamp}.log`);
    
    // Create write stream for continuous logging
    this.writeStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
    
    // Write header
    this.writeToFile({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: `=== Logging session started for repo: ${this.repoName} ===`,
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

  private logToConsole(entry: LogEntry): void {
    if (!this.consoleEnabled) return;
    
    const timestamp = new Date().toTimeString().split(' ')[0];
    const iteration = entry.iteration !== undefined ? chalk.cyan(`[${entry.iteration}]`) : '';
    
    let prefix = '';
    let color = chalk.white;
    
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
        break;
      case LogLevel.WARNING:
        prefix = chalk.yellow('⚠️  WARNING');
        color = chalk.yellow;
        break;
      case LogLevel.ERROR:
        prefix = chalk.red('❌ ERROR');
        color = chalk.red;
        break;
    }
    
    console.log(`${chalk.gray(timestamp)} ${prefix} ${iteration} ${color(entry.message)}`);
    
    if (entry.details) {
      console.log(chalk.gray(JSON.stringify(entry.details, null, 2)));
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
    
    this.writeToFile(entry);
    this.logToConsole(entry);
    
    // Emit event for real-time monitoring
    this.emit('log', entry);
  }

  public debug(message: string, details?: Record<string, unknown> | string | number | boolean): void {
    this.log(LogLevel.DEBUG, message, details);
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

  public setConsoleEnabled(enabled: boolean): void {
    this.consoleEnabled = enabled;
  }

  public setFileEnabled(enabled: boolean): void {
    this.fileEnabled = enabled;
  }

  public getLogFilePath(): string | null {
    return this.currentLogFile;
  }

  public getLogDirectory(): string {
    return this.logDir;
  }

  public close(): void {
    if (this.writeStream) {
      this.writeToFile({
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: '=== Logging session ended ===',
        repoName: this.repoName
      });
      
      this.writeStream.end();
      this.writeStream = null;
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