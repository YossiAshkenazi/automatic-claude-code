import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LogViewer } from '../../logViewer';
import { launchTUI } from '../../tuiBrowser';
import { Logger } from '../../logger';

export function createLogsCommand(): Command {
  const logsCommand = new Command('logs');
  
  logsCommand
    .description('View logs for a repository with enhanced visualization')
    .argument('[repo]', 'Repository name (defaults to current directory name)')
    .option('-t, --tail', 'Tail the latest log file in real-time')
    .option('-l, --list', 'List all log files')
    .option('--ui', 'Launch interactive TUI viewer')
    .option('--web', 'Generate and open HTML report')
    .option('--stats', 'Show analytics and statistics')
    .option('--search <term>', 'Search across logs')
    .option('--export <format>', 'Export in different formats (html, json)')
    .option('--session <sessionId>', 'View specific session details')
    .option('--work', 'View Claude work output only (no system logs)')
    .action(async (repo: string | undefined, options) => {
      const repoName = repo || path.basename(process.cwd());
      const logViewer = new LogViewer(repoName);
      
      // View work output only
      if (options.work) {
        try {
          if (options.session) {
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
          
          const sessionId = options.session || summaries[0].sessionId;
          logViewer.exportToHTML(sessionId);
          
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
        
        const content = fs.readFileSync(logPath, 'utf-8');
        console.log(content);
        
        Logger.tailLog(logPath, (line: string) => {
          console.log(line);
        });
        
        process.stdin.resume();
      } else {
        const content = fs.readFileSync(logPath, 'utf-8');
        console.log(chalk.blue.bold(`\nLog: ${latestLog}\n`));
        console.log(content);
      }
    });

  return logsCommand;
}