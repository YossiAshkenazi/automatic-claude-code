import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as fs from 'fs';
import { AutomaticClaudeCodeCore } from '../../core/application';
import { EnhancedSessionManager } from '../../sessionManager';

export function createSessionsCommand(): Command {
  const sessionsCommand = new Command('sessions');
  
  sessionsCommand
    .description('Manage active and completed sessions')
    .option('-l, --list', 'List all sessions')
    .option('-a, --active', 'Show only active sessions')
    .option('-s, --stats', 'Show session statistics')
    .option('-r, --resume <sessionId>', 'Resume a specific session')
    .option('-k, --kill <sessionId>', 'Force kill a session')
    .option('-c, --cleanup [hours]', 'Clean up old sessions (default: 24 hours)')
    .option('--export <sessionId>', 'Export session data for backup')
    .option('--limit <number>', 'Set max concurrent sessions limit')
    .action(async (options) => {
      const core = new AutomaticClaudeCodeCore();
      const sessionManager = core.sessionManagerInstance;

      try {
        // List sessions
        if (options.list) {
          const sessions = await sessionManager.listSessions();
          if (sessions.length === 0) {
            console.log(chalk.yellow('No sessions found.'));
            return;
          }

          const table = new Table({
            head: ['Session ID', 'Status', 'Created', 'Task'],
            colWidths: [20, 12, 20, 50]
          });

          sessions.forEach(session => {
            const status = session.status === 'running' ? chalk.green('●') : 
                          session.status === 'completed' ? chalk.blue('✓') : 
                          chalk.red('✗');
            table.push([
              session.id.substring(0, 18),
              `${status} ${session.status}`,
              session.date.toLocaleDateString(),
              session.prompt
            ]);
          });

          console.log('\n📋 Session History:');
          console.log(table.toString());
          return;
        }

        // Show active sessions
        if (options.active) {
          const activeSessions = await sessionManager.listActiveSessions();
          if (activeSessions.length === 0) {
            console.log(chalk.yellow('No active sessions.'));
            return;
          }

          console.log(chalk.cyan.bold('\n🔄 Active Sessions:\n'));
          activeSessions.forEach(session => {
            const state = sessionManager.getSessionState(session.sessionId);
            console.log(chalk.green(`● ${session.sessionId}`));
            console.log(chalk.gray(`  Task: ${session.session?.initialPrompt?.substring(0, 80)}...`));
            console.log(chalk.gray(`  Directory: ${state?.paths.workDir || 'Unknown'}`));
            console.log(chalk.gray(`  Controller: ${state?.processInfo.hasActiveController ? 'Active' : 'Inactive'}`));
            console.log(chalk.gray(`  Last Activity: ${state?.processInfo.lastActivity?.toLocaleTimeString() || 'Unknown'}`));
            console.log('');
          });
          return;
        }

        // Show statistics
        if (options.stats) {
          const stats = sessionManager.getSessionStatistics();
          console.log(chalk.cyan.bold('\n📊 Session Statistics:\n'));
          console.log(chalk.green(`✓ Total Sessions: ${stats.total}`));
          console.log(chalk.yellow(`🔄 Running: ${stats.running}`));
          console.log(chalk.blue(`✅ Completed: ${stats.completed}`));
          console.log(chalk.red(`❌ Failed: ${stats.failed}`));
          console.log(chalk.cyan(`🎯 Max Concurrent: ${stats.maxConcurrent}`));
          
          if (stats.running > 0) {
            const usage = Math.round((stats.running / stats.maxConcurrent) * 100);
            console.log(chalk.magenta(`📈 Usage: ${usage}% (${stats.running}/${stats.maxConcurrent})`));
          }
          return;
        }

        // Resume session
        if (options.resume) {
          try {
            await sessionManager.resumeSession(options.resume);
            console.log(chalk.green(`✅ Resumed session: ${options.resume}`));
          } catch (error) {
            console.log(chalk.red(`❌ Failed to resume session: ${error instanceof Error ? error.message : error}`));
          }
          return;
        }

        // Force kill session
        if (options.kill) {
          try {
            await sessionManager.forceKillSession(options.kill);
            console.log(chalk.red(`🗑️  Force killed session: ${options.kill}`));
          } catch (error) {
            console.log(chalk.red(`❌ Failed to kill session: ${error instanceof Error ? error.message : error}`));
          }
          return;
        }

        // Cleanup old sessions
        if (options.cleanup !== undefined) {
          const hours = options.cleanup ? parseInt(options.cleanup) : 24;
          try {
            const cleaned = await sessionManager.cleanupOldSessions(hours);
            console.log(chalk.green(`🧹 Cleaned up ${cleaned.length} old sessions (older than ${hours}h)`));
            if (cleaned.length > 0) {
              cleaned.forEach(id => console.log(chalk.gray(`  - ${id}`)));
            }
          } catch (error) {
            console.log(chalk.red(`❌ Cleanup failed: ${error instanceof Error ? error.message : error}`));
          }
          return;
        }

        // Export session
        if (options.export) {
          try {
            const exportData = await sessionManager.exportSession(options.export);
            const filename = `session-export-${options.export}-${Date.now()}.json`;
            await fs.promises.writeFile(filename, JSON.stringify(exportData, null, 2));
            console.log(chalk.green(`📦 Exported session to: ${filename}`));
            console.log(chalk.gray(`  Session: ${exportData.session.initialPrompt?.substring(0, 60)}...`));
            console.log(chalk.gray(`  Iterations: ${exportData.session.iterations.length}`));
            console.log(chalk.gray(`  Status: ${exportData.session.status}`));
          } catch (error) {
            console.log(chalk.red(`❌ Export failed: ${error instanceof Error ? error.message : error}`));
          }
          return;
        }

        // Set session limit
        if (options.limit) {
          const limit = parseInt(options.limit);
          if (isNaN(limit) || limit < 1) {
            console.log(chalk.red('❌ Invalid limit. Must be a positive number.'));
            return;
          }
          
          sessionManager.setMaxConcurrentSessions(limit);
          console.log(chalk.green(`✅ Set max concurrent sessions to: ${limit}`));
          return;
        }

        // Default: show active sessions
        const activeSessions = await sessionManager.listActiveSessions();
        if (activeSessions.length === 0) {
          console.log(chalk.yellow('No active sessions. Use --list to see all sessions.'));
        } else {
          console.log(chalk.cyan.bold(`\n🔄 Active Sessions (${activeSessions.length}):\n`));
          activeSessions.slice(0, 5).forEach(session => {
            console.log(chalk.green(`● ${session.sessionId.substring(0, 18)}`));
            console.log(chalk.gray(`  ${session.session?.initialPrompt?.substring(0, 80)}...`));
          });
          if (activeSessions.length > 5) {
            console.log(chalk.gray(`  ... and ${activeSessions.length - 5} more (use --active to see all)`));
          }
        }

      } catch (error) {
        console.error(chalk.red('Session management error:'), error);
      }
    });

  return sessionsCommand;
}