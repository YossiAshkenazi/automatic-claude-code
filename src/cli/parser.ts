import { Command } from 'commander';
import packageInfo from '../../package.json';

// Import all command creators
import { createRunCommand } from './commands/run';
import { createDualCommand } from './commands/dual';
import { createMonitorCommand } from './commands/monitor';
import { createHistoryCommand } from './commands/history';
import { createLogsCommand } from './commands/logs';
import { createSessionsCommand } from './commands/sessions';
import { createSessionCommand } from './commands/session';
import { createBrowserCommand } from './commands/browser';
import { createExamplesCommand } from './commands/examples';
import { CommandCoordinator } from '../core/coordinator';

export function createCLIParser(): Command {
  const program = new Command();
  const coordinator = new CommandCoordinator();
  
  // Configure the main program
  program
    .name('automatic-claude-code')
    .description('Run Claude Code in an automated loop for continuous development')
    .version(packageInfo.version);

  // Add all commands
  program.addCommand(createRunCommand(coordinator));
  program.addCommand(createDualCommand());
  program.addCommand(createHistoryCommand());
  program.addCommand(createExamplesCommand());
  program.addCommand(createMonitorCommand());
  program.addCommand(createLogsCommand());
  program.addCommand(createSessionsCommand());
  program.addCommand(createSessionCommand());
  program.addCommand(createBrowserCommand());

  return program;
}