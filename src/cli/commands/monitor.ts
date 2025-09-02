import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { monitoringManager } from '../../monitoringManager';
import { config } from '../../config';

export function createMonitorCommand(): Command {
  const monitorCommand = new Command('monitor');
  
  monitorCommand
    .description('Manage monitoring server and show status')
    .option('--start', 'Start monitoring server')
    .option('--stop', 'Stop monitoring server')
    .option('--status', 'Show monitoring status')
    .option('--config', 'Show monitoring configuration')
    .action(async (options) => {
      if (options.start) {
        console.log(chalk.blue('🚀 Starting monitoring server...'));
        const started = await monitoringManager.startServer();
        if (started) {
          const status = await monitoringManager.getStatus();
          console.log(chalk.green('✅ Monitoring server started'));
          console.log(chalk.cyan(`   UI: ${status.urls.ui}`));
          console.log(chalk.cyan(`   API: ${status.urls.server}`));
        } else {
          console.log(chalk.red('❌ Failed to start monitoring server'));
        }
        return;
      }

      if (options.stop) {
        console.log(chalk.yellow('⏹️  Stopping monitoring server...'));
        monitoringManager.stopServer();
        console.log(chalk.green('✅ Monitoring server stopped'));
        return;
      }

      if (options.config) {
        const cfg = config.getAll();
        console.log(chalk.blue.bold('\n📊 Monitoring Configuration:\n'));
        
        const configTable = new Table({
          head: ['Setting', 'Value'],
          colWidths: [30, 50],
          style: {
            head: ['cyan'],
            border: ['gray']
          }
        });
        
        configTable.push(
          ['Enabled', cfg.monitoring.enabled ? 'Yes' : 'No'],
          ['Server URL', cfg.monitoring.serverUrl],
          ['UI URL', cfg.monitoring.uiUrl],
          ['Server Path', cfg.monitoring.serverPath || 'Auto-detect'],
          ['Auto Start', cfg.monitoring.autoStartServer ? 'Yes' : 'No']
        );
        
        console.log(configTable.toString());
        return;
      }

      // Default: show status
      const status = await monitoringManager.getStatus();
      console.log(chalk.blue.bold('\n📊 Monitoring Status:\n'));
      
      const statusTable = new Table({
        head: ['Component', 'Status', 'URL'],
        colWidths: [20, 15, 40],
        style: {
          head: ['cyan'],
          border: ['gray']
        }
      });
      
      statusTable.push(
        ['Server', status.serverRunning ? chalk.green('Running') : chalk.red('Stopped'), status.urls.server],
        ['UI', status.serverRunning ? chalk.green('Available') : chalk.red('Unavailable'), status.urls.ui],
        ['Server Path', status.serverPath ? chalk.green('Found') : chalk.yellow('Not Found'), status.serverPath || 'N/A']
      );
      
      console.log(statusTable.toString());
      
      if (!status.serverRunning && status.serverPath) {
        console.log(chalk.yellow('\n💡 Start the server with: acc monitor --start'));
      } else if (!status.serverPath) {
        console.log(chalk.yellow('\n💡 Run from a directory containing dual-agent-monitor/ folder'));
      }
    });

  return monitorCommand;
}