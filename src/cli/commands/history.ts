import { Command } from 'commander';
import { SessionManager } from '../../sessionManager';

export function createHistoryCommand(): Command {
  const historyCommand = new Command('history');
  
  historyCommand
    .description('Show session history')
    .action(async () => {
      const sessionManager = new SessionManager();
      await sessionManager.showHistory();
    });

  return historyCommand;
}