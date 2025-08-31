import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import Table from 'cli-table3';
import { highlight } from 'cli-highlight';
import boxen from 'boxen';
import cliProgress from 'cli-progress';

export interface ParsedLogEntry {
  timestamp: Date;
  level: string;
  message: string;
  details?: any;
  iteration?: number;
  sessionId?: string;
  repoName?: string;
}

export interface SessionSummary {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  iterations: number;
  errors: number;
  warnings: number;
  successes: number;
  initialPrompt: string;
  status: 'completed' | 'failed' | 'ongoing';
}

export class LogViewer {
  private logDir: string;
  private repoName: string;
  
  constructor(repoName?: string) {
    this.repoName = repoName || path.basename(process.cwd());
    this.logDir = path.join(os.homedir(), '.automatic-claude-code', 'logs', this.repoName);
  }

  // Parse a single log file
  public parseLogFile(filePath: string): ParsedLogEntry[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const entries: ParsedLogEntry[] = [];
    let currentEntry: Partial<ParsedLogEntry> | null = null;
    let jsonBuffer = '';
    let inJsonBlock = false;

    for (const line of lines) {
      // Check if this is a log line start
      const logMatch = line.match(/^\[(.*?)\]\s+(\w+)\s+(?:\[Iter (\d+)\])?\s*(?:\[(.*?)\])?\s*(.*)$/);
      
      if (logMatch) {
        // If we were building a JSON block, finalize it
        if (currentEntry && inJsonBlock && jsonBuffer) {
          try {
            currentEntry.details = JSON.parse(jsonBuffer);
          } catch (e) {
            // If JSON parsing fails, store as string
            currentEntry.details = jsonBuffer;
          }
          entries.push(currentEntry as ParsedLogEntry);
          jsonBuffer = '';
          inJsonBlock = false;
        }

        // Start new entry
        const [, timestamp, level, iteration, sessionId, message] = logMatch;
        currentEntry = {
          timestamp: new Date(timestamp),
          level: level.trim(),
          message: message.trim(),
          iteration: iteration ? parseInt(iteration) : undefined,
          sessionId: sessionId || undefined,
          repoName: this.repoName
        };

        // Check if this line starts a JSON block
        if (message.trim().startsWith('{') || message.trim().startsWith('[')) {
          inJsonBlock = true;
          jsonBuffer = message.trim();
        } else if (currentEntry) {
          entries.push(currentEntry as ParsedLogEntry);
          currentEntry = null;
        }
      } else if (inJsonBlock) {
        // Continue building JSON block
        jsonBuffer += '\n' + line;
        
        // Try to parse to see if JSON block is complete
        try {
          const parsed = JSON.parse(jsonBuffer);
          if (currentEntry) {
            currentEntry.details = parsed;
            entries.push(currentEntry as ParsedLogEntry);
          }
          currentEntry = null;
          jsonBuffer = '';
          inJsonBlock = false;
        } catch (e) {
          // JSON not complete yet, continue
        }
      }
    }

    // Handle any remaining entry
    if (currentEntry) {
      if (jsonBuffer && inJsonBlock) {
        try {
          currentEntry.details = JSON.parse(jsonBuffer);
        } catch (e) {
          currentEntry.details = jsonBuffer;
        }
      }
      entries.push(currentEntry as ParsedLogEntry);
    }

    return entries;
  }

  // Get all sessions with summaries
  public getSessionSummaries(): SessionSummary[] {
    if (!fs.existsSync(this.logDir)) {
      return [];
    }

    const logFiles = fs.readdirSync(this.logDir)
      .filter(file => file.endsWith('.log'))
      .sort()
      .reverse();

    const summaries: SessionSummary[] = [];

    for (const logFile of logFiles) {
      const filePath = path.join(this.logDir, logFile);
      const entries = this.parseLogFile(filePath);
      
      if (entries.length === 0) continue;

      const sessionId = logFile.replace('.log', '');
      const startTime = entries[0].timestamp;
      const endTime = entries[entries.length - 1].timestamp;
      const duration = endTime.getTime() - startTime.getTime();

      // Count different log levels
      const errors = entries.filter(e => e.level === 'ERROR').length;
      const warnings = entries.filter(e => e.level === 'WARNING').length;
      const successes = entries.filter(e => e.level === 'SUCCESS').length;

      // Get initial prompt
      const initialPromptEntry = entries.find(e => 
        e.details && typeof e.details === 'object' && e.details.initialPrompt
      );
      const initialPrompt = initialPromptEntry?.details?.initialPrompt || 'Unknown task';

      // Get max iteration
      const iterations = Math.max(...entries
        .filter(e => e.iteration !== undefined)
        .map(e => e.iteration!), 0);

      // Determine status
      const hasEndMarker = entries.some(e => e.message.includes('session ended'));
      const status: SessionSummary['status'] = hasEndMarker ? 'completed' : 
                 errors > 0 ? 'failed' : 'ongoing';

      summaries.push({
        sessionId,
        startTime,
        endTime,
        duration,
        iterations,
        errors,
        warnings,
        successes,
        initialPrompt,
        status
      });
    }

    return summaries;
  }

  // Enhanced console display with better formatting
  public displaySessionSummary(summaries: SessionSummary[]): void {
    if (summaries.length === 0) {
      console.log(chalk.yellow('No sessions found.'));
      return;
    }

    console.log(boxen(
      chalk.bold.blue('📊 Session Overview'), 
      { padding: 1, borderColor: 'blue', borderStyle: 'round' }
    ));

    const table = new Table({
      head: ['Session', 'Start Time', 'Duration', 'Iterations', 'Status', 'Task'],
      colWidths: [25, 20, 12, 12, 12, 40],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    });

    summaries.slice(0, 10).forEach(session => {
      const duration = Math.round(session.duration / 1000);
      const durationStr = duration > 3600 ? `${Math.floor(duration/3600)}h ${Math.floor((duration%3600)/60)}m` :
                         duration > 60 ? `${Math.floor(duration/60)}m ${duration%60}s` :
                         `${duration}s`;

      let statusIcon = '';
      let statusColor = chalk.white;
      
      switch (session.status) {
        case 'completed':
          statusIcon = '✅ Done';
          statusColor = chalk.green;
          break;
        case 'failed':
          statusIcon = '❌ Failed';
          statusColor = chalk.red;
          break;
        case 'ongoing':
          statusIcon = '⏳ Running';
          statusColor = chalk.yellow;
          break;
      }

      table.push([
        session.sessionId.substring(8, 20) + '...',
        session.startTime.toLocaleString().split(',')[1].trim(),
        durationStr,
        session.iterations.toString(),
        statusColor(statusIcon),
        session.initialPrompt.substring(0, 37) + (session.initialPrompt.length > 37 ? '...' : '')
      ]);
    });

    console.log(table.toString());
    console.log();
  }

  // Display detailed session view
  public displaySessionDetails(sessionId: string): void {
    const logFile = sessionId.endsWith('.log') ? sessionId : `${sessionId}.log`;
    const filePath = path.join(this.logDir, logFile);
    const entries = this.parseLogFile(filePath);

    if (entries.length === 0) {
      console.log(chalk.red(`No entries found for session: ${sessionId}`));
      return;
    }

    // Session header
    const sessionInfo = entries.find(e => e.details && e.details.initialPrompt);
    const initialPrompt = sessionInfo?.details?.initialPrompt || 'Unknown task';
    
    console.log(boxen(
      chalk.bold.blue(`📋 Session: ${sessionId}\n`) +
      chalk.cyan(`Task: ${initialPrompt}\n`) +
      chalk.gray(`Started: ${entries[0].timestamp.toLocaleString()}`),
      { padding: 1, borderColor: 'blue', borderStyle: 'double' }
    ));

    // Group entries by iteration
    const iterationGroups: Map<number, ParsedLogEntry[]> = new Map();
    const otherEntries: ParsedLogEntry[] = [];

    entries.forEach(entry => {
      if (entry.iteration !== undefined) {
        if (!iterationGroups.has(entry.iteration)) {
          iterationGroups.set(entry.iteration, []);
        }
        iterationGroups.get(entry.iteration)!.push(entry);
      } else {
        otherEntries.push(entry);
      }
    });

    // Display other entries first
    if (otherEntries.length > 0) {
      console.log(chalk.yellow.bold('📝 Session Setup:'));
      otherEntries.forEach(entry => this.displayLogEntry(entry));
      console.log();
    }

    // Display iterations
    const sortedIterations = Array.from(iterationGroups.keys()).sort((a, b) => a - b);
    
    sortedIterations.forEach(iteration => {
      const iterEntries = iterationGroups.get(iteration)!;
      const errors = iterEntries.filter(e => e.level === 'ERROR').length;
      const warnings = iterEntries.filter(e => e.level === 'WARNING').length;
      
      let statusIcon = '🔄';
      if (errors > 0) statusIcon = '❌';
      else if (warnings > 0) statusIcon = '⚠️';
      else if (iterEntries.some(e => e.level === 'SUCCESS')) statusIcon = '✅';

      console.log(chalk.blue.bold(`\n${statusIcon} Iteration ${iteration}:`));
      console.log('─'.repeat(50));
      
      iterEntries.forEach(entry => this.displayLogEntry(entry, true));
    });
  }

  // Enhanced log entry display
  private displayLogEntry(entry: ParsedLogEntry, compact: boolean = false): void {
    const timestamp = entry.timestamp.toTimeString().split(' ')[0];
    
    let levelIcon = '';
    let levelColor = chalk.white;
    
    switch (entry.level) {
      case 'DEBUG':
        levelIcon = '🐛';
        levelColor = chalk.gray;
        break;
      case 'INFO':
        levelIcon = 'ℹ️';
        levelColor = chalk.blue;
        break;
      case 'PROGRESS':
        levelIcon = '⏳';
        levelColor = chalk.yellow;
        break;
      case 'SUCCESS':
        levelIcon = '✅';
        levelColor = chalk.green;
        break;
      case 'WARNING':
        levelIcon = '⚠️';
        levelColor = chalk.yellow;
        break;
      case 'ERROR':
        levelIcon = '❌';
        levelColor = chalk.red;
        break;
      default:
        levelIcon = '📝';
    }

    const prefix = compact ? 
      `  ${levelIcon} ${levelColor(entry.level.padEnd(8))}` :
      `${chalk.gray(timestamp)} ${levelIcon} ${levelColor(entry.level.padEnd(8))}`;

    console.log(`${prefix} ${entry.message}`);

    // Display details if present
    if (entry.details && !compact) {
      const detailsStr = typeof entry.details === 'string' ? 
        entry.details : 
        JSON.stringify(entry.details, null, 2);
      
      // Syntax highlight JSON
      try {
        const highlighted = highlight(detailsStr, { language: 'json' });
        console.log(chalk.gray(highlighted.split('\n').map(line => `    ${line}`).join('\n')));
      } catch (e) {
        console.log(chalk.gray(detailsStr.split('\n').map(line => `    ${line}`).join('\n')));
      }
    }
  }

  // Export to HTML
  public exportToHTML(sessionId: string, outputPath?: string): void {
    const logFile = sessionId.endsWith('.log') ? sessionId : `${sessionId}.log`;
    const filePath = path.join(this.logDir, logFile);
    const entries = this.parseLogFile(filePath);

    if (entries.length === 0) {
      console.log(chalk.red(`No entries found for session: ${sessionId}`));
      return;
    }

    const sessionInfo = entries.find(e => e.details && e.details.initialPrompt);
    const initialPrompt = sessionInfo?.details?.initialPrompt || 'Unknown task';

    const html = this.generateSessionHTML(sessionId, initialPrompt, entries);
    
    const defaultPath = path.join(process.cwd(), `session-${sessionId}.html`);
    const finalPath = outputPath || defaultPath;
    
    fs.writeFileSync(finalPath, html);
    console.log(chalk.green(`✅ HTML report exported to: ${finalPath}`));
  }

  private generateSessionHTML(sessionId: string, task: string, entries: ParsedLogEntry[]): string {
    const startTime = entries[0]?.timestamp.toLocaleString() || 'Unknown';
    const endTime = entries[entries.length - 1]?.timestamp.toLocaleString() || 'Unknown';
    
    const entriesHTML = entries.map(entry => {
      const levelClass = entry.level.toLowerCase();
      const detailsHTML = entry.details ? 
        `<div class="details"><pre><code>${JSON.stringify(entry.details, null, 2)}</code></pre></div>` : '';
      
      return `
        <div class="log-entry ${levelClass}">
          <div class="log-header">
            <span class="timestamp">${entry.timestamp.toLocaleString()}</span>
            <span class="level ${levelClass}">${entry.level}</span>
            ${entry.iteration ? `<span class="iteration">Iteration ${entry.iteration}</span>` : ''}
          </div>
          <div class="message">${entry.message}</div>
          ${detailsHTML}
        </div>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session ${sessionId} - Automatic Claude Code</title>
    <style>
        body { font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; margin: 20px; background: #1a1a1a; color: #e0e0e0; }
        .header { background: #2d2d2d; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #007acc; }
        .session-info { margin: 0; }
        .session-info h1 { margin: 0 0 10px 0; color: #007acc; }
        .log-entry { margin: 10px 0; padding: 15px; border-radius: 6px; background: #252525; }
        .log-header { display: flex; gap: 15px; align-items: center; margin-bottom: 8px; font-size: 0.9em; }
        .timestamp { color: #888; }
        .level { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8em; }
        .level.debug { background: #444; color: #bbb; }
        .level.info { background: #1f4788; color: #79aef0; }
        .level.progress { background: #785d1f; color: #f0d079; }
        .level.success { background: #1f5f3f; color: #79f097; }
        .level.warning { background: #785d1f; color: #f0d079; }
        .level.error { background: #7a2d2d; color: #f07979; }
        .iteration { background: #444; padding: 4px 8px; border-radius: 4px; color: #ccc; font-size: 0.8em; }
        .message { font-size: 1em; line-height: 1.4; }
        .details { margin-top: 10px; background: #1a1a1a; padding: 15px; border-radius: 4px; border-left: 3px solid #007acc; }
        .details pre { margin: 0; overflow-x: auto; }
        .details code { color: #e0e0e0; }
        .debug { opacity: 0.7; }
    </style>
</head>
<body>
    <div class="header">
        <div class="session-info">
            <h1>Session ${sessionId}</h1>
            <p><strong>Task:</strong> ${task}</p>
            <p><strong>Started:</strong> ${startTime}</p>
            <p><strong>Ended:</strong> ${endTime}</p>
        </div>
    </div>
    <div class="log-entries">
        ${entriesHTML}
    </div>
</body>
</html>
    `;
  }

  // Search functionality
  public searchLogs(searchTerm: string, sessionId?: string): ParsedLogEntry[] {
    const results: ParsedLogEntry[] = [];
    
    if (sessionId) {
      // Search in specific session
      const logFile = sessionId.endsWith('.log') ? sessionId : `${sessionId}.log`;
      const filePath = path.join(this.logDir, logFile);
      const entries = this.parseLogFile(filePath);
      
      return entries.filter(entry => 
        entry.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.details && JSON.stringify(entry.details).toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } else {
      // Search across all sessions
      const logFiles = fs.readdirSync(this.logDir).filter(file => file.endsWith('.log'));
      
      for (const logFile of logFiles) {
        const filePath = path.join(this.logDir, logFile);
        const entries = this.parseLogFile(filePath);
        
        const matches = entries.filter(entry => 
          entry.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (entry.details && JSON.stringify(entry.details).toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        results.push(...matches);
      }
    }
    
    return results;
  }

  // Statistics
  public getStats(): any {
    const summaries = this.getSessionSummaries();
    
    if (summaries.length === 0) {
      return { message: 'No sessions found' };
    }

    const totalSessions = summaries.length;
    const completedSessions = summaries.filter(s => s.status === 'completed').length;
    const failedSessions = summaries.filter(s => s.status === 'failed').length;
    const avgDuration = summaries.reduce((sum, s) => sum + s.duration, 0) / totalSessions / 1000; // in seconds
    const totalIterations = summaries.reduce((sum, s) => sum + s.iterations, 0);
    const avgIterations = totalIterations / totalSessions;

    return {
      totalSessions,
      completedSessions,
      failedSessions,
      ongoingSessions: totalSessions - completedSessions - failedSessions,
      successRate: Math.round((completedSessions / totalSessions) * 100),
      avgDuration: Math.round(avgDuration),
      totalIterations,
      avgIterations: Math.round(avgIterations * 10) / 10
    };
  }
}

export default LogViewer;