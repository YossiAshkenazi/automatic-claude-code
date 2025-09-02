import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export function createSessionCommand(): Command {
  const sessionCommand = new Command('session');
  
  sessionCommand
    .description('View detailed session data')
    .argument('[sessionId]', 'Session ID to view (defaults to latest session)')
    .option('-l, --list', 'List all sessions')
    .action(async (sessionId: string | undefined, options) => {
      if (options.list) {
        const sessions = fs.readdirSync('.claude-sessions/').filter(f => f.endsWith('.json'));
        if (sessions.length === 0) {
          console.log(chalk.yellow('No sessions found.'));
          return;
        }
        
        console.log(chalk.blue.bold('\n📋 Available Sessions:\n'));
        sessions.reverse().slice(0, 10).forEach((file, index) => {
          const data = JSON.parse(fs.readFileSync(path.join('.claude-sessions/', file), 'utf-8'));
          const duration = data.endTime ? Math.round((new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / 1000) : 'ongoing';
          console.log(chalk.cyan(`${index + 1}. ${data.id}`));
          
          let promptText: string;
          if (typeof data.initialPrompt === 'string') {
            promptText = data.initialPrompt;
          } else if (data.initialPrompt && typeof data.initialPrompt === 'object') {
            promptText = (data.initialPrompt as any).task || 'Unknown task';
          } else {
            promptText = 'Unknown task';
          }
          console.log(chalk.gray(`   Task: ${promptText.substring(0, 50)}${promptText.length > 50 ? '...' : ''}`));
          console.log(chalk.gray(`   Iterations: ${data.iterations?.length || 0} | Duration: ${duration}s\n`));
        });
        return;
      }
      
      if (!sessionId) {
        const sessions = fs.readdirSync('.claude-sessions/').filter(f => f.endsWith('.json'));
        if (sessions.length === 0) {
          console.log(chalk.yellow('No sessions found.'));
          return;
        }
        sessionId = sessions[sessions.length - 1].replace('.json', '');
      }
      
      try {
        const sessionFile = path.join('.claude-sessions/', `${sessionId}.json`);
        const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        
        console.log(chalk.blue.bold(`\n📊 Session: ${sessionData.id}\n`));
        
        let promptText: string;
        if (typeof sessionData.initialPrompt === 'string') {
          promptText = sessionData.initialPrompt;
        } else if (sessionData.initialPrompt && typeof sessionData.initialPrompt === 'object') {
          promptText = (sessionData.initialPrompt as any).task || 'Unknown task';
        } else {
          promptText = 'Unknown task';
        }
        console.log(chalk.cyan(`Initial Task: ${promptText}`));
        console.log(chalk.cyan(`Working Directory: ${sessionData.workDir}`));
        console.log(chalk.cyan(`Started: ${new Date(sessionData.startTime).toLocaleString()}`));
        console.log(chalk.cyan(`Status: ${sessionData.status || 'unknown'}`));
        
        if (sessionData.iterations) {
          console.log(chalk.yellow.bold(`\n🔄 Iterations (${sessionData.iterations.length}):\n`));
          
          sessionData.iterations.forEach((iter: any) => {
            console.log(chalk.blue.bold(`--- Iteration ${iter.iteration} ---`));
            console.log(chalk.gray(`Prompt: ${iter.prompt}`));
            console.log(chalk.gray(`Duration: ${iter.duration}s`));
            console.log(chalk.gray(`Exit Code: ${iter.exitCode}`));
            
            if (iter.output.files && iter.output.files.length > 0) {
              console.log(chalk.green(`Files Modified: ${iter.output.files.join(', ')}`));
            }
            if (iter.output.commands && iter.output.commands.length > 0) {
              console.log(chalk.magenta(`Commands: ${iter.output.commands.join(', ')}`));
            }
            if (iter.output.tools && iter.output.tools.length > 0) {
              console.log(chalk.blue(`Tools Used: ${iter.output.tools.join(', ')}`));
            }
            
            console.log(chalk.white('Claude Response:'));
            console.log(chalk.gray(iter.output.result || 'No response'));
            console.log('');
          });
        }
        
      } catch (error) {
        console.error(chalk.red(`Error reading session: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

  return sessionCommand;
}