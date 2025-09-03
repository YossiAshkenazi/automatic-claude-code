import { Command } from 'commander';
import chalk from 'chalk';
import { CommandCoordinator, CommandOptions } from '../../core/coordinator';
import { monitoringManager } from '../../monitoringManager';
import { config } from '../../config';

export function createRunCommand(coordinator: CommandCoordinator): Command {
  const runCommand = new Command('run');
  
  runCommand
    .description('Start an automated Claude Code loop with the given prompt')
    .argument('<prompt>', 'The prompt to execute')
    .option('-i, --iterations <number>', 'Maximum number of iterations', '10')
    .option('-m, --model <model>', 'Claude model to use (sonnet or opus)', 'sonnet')
    .option('-d, --dir <path>', 'Working directory for the project')
    .option('-t, --tools <tools>', 'Comma-separated list of allowed tools')
    .option('-c, --continue-on-error', 'Continue loop even if errors occur')
    .option('-v, --verbose', 'Show detailed output')
    .option('--dual-agent', 'Enable dual-agent mode (Manager + Worker)')
    .option('--manager-model <model>', 'Manager agent model (sonnet or opus)', 'opus')
    .option('--worker-model <model>', 'Worker agent model (sonnet or opus)', 'sonnet')
    .option('--no-monitoring', 'Disable monitoring server')
    .option('--timeout <minutes>', 'Timeout for each Claude execution in minutes (default: 30)', '30')
    .option('--resume <sessionId>', 'Resume an existing session instead of creating a new one')
    .option('--browser <browser>', 'Specify browser for authentication (chrome, firefox, safari, edge)')
    .option('--refresh-browser-session', 'Force browser session refresh before execution')
    .option('--browser-auth', 'Force browser authentication mode')
    .option('--api-mode', 'Force API key mode (requires ANTHROPIC_API_KEY)')
    .option('--use-sdk-only', 'Force SDK-only execution (no CLI fallback)')
    .option('--use-legacy', 'Force legacy CLI execution (bypass SDK)')
    .option('--sdk-status', 'Show SDK and browser status')
    .option('--verify-claude-cli', 'Comprehensive Claude CLI and SDK verification')
    .option('--quality-gate', 'Enable quality validation checks')
    .option('--check-browser-session', 'Check browser session status and exit')
    .option('--browser-status', 'Show all browser session status and exit')
    .option('--clear-browser-cache', 'Clear browser session cache')
    .option('--reset-browser-sessions', 'Reset all browser sessions')
    .option('--monitor-browser-sessions', 'Monitor browser session health')
    .option('--headless-browser', 'Use headless browser mode')
    .option('--persistent-browser', 'Use persistent browser sessions')
    .option('--clean-browser', 'Start with clean browser profile')
    .action(async (prompt: string, options: CommandOptions) => {
      try {
        // Start monitoring server if enabled and not disabled
        if (!options.noMonitoring && config.isMonitoringEnabled()) {
          await monitoringManager.startServer();
        }

        // Execute the run command through the coordinator
        await coordinator.executeRunCommand(prompt, options);
        
      } catch (error) {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
      }
    });

  return runCommand;
}