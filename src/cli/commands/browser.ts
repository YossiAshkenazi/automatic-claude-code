import { Command } from 'commander';
import chalk from 'chalk';
import { AutomaticClaudeCodeCore } from '../../core/application';

export function createBrowserCommand(): Command {
  const browserCommand = new Command('browser');
  
  browserCommand
    .description('Manage browser sessions and authentication')
    .option('--check', 'Check browser session status')
    .option('--status', 'Show detailed browser status')
    .option('--clear-cache', 'Clear browser cache')
    .option('--reset', 'Reset browser sessions')
    .option('--monitor', 'Monitor browser sessions')
    .action(async (options) => {
      const core = new AutomaticClaudeCodeCore();
      
      try {
        if (options.check) {
          await handleBrowserSessionCheck(core);
        } else if (options.status) {
          await handleBrowserStatus();
        } else if (options.clearCache) {
          await handleClearBrowserCache();
        } else if (options.reset) {
          await handleResetBrowserSessions();
        } else if (options.monitor) {
          await handleMonitorBrowserSessions();
        } else {
          // Default to showing status
          await handleBrowserStatus();
        }
      } catch (error) {
        console.error(chalk.red('Browser command failed:'), error);
        process.exit(1);
      }
    });

  return browserCommand;
}

async function handleBrowserSessionCheck(core: AutomaticClaudeCodeCore): Promise<void> {
  console.log(chalk.blue.bold('\n🔍 SDK Browser Session Status\n'));
  
  try {
    const healthMetrics = await core.sdkAutopilotEngineInstance.getHealthMetrics();
    const browserStatus = healthMetrics.browserHealth || { available: false, authStatus: 'unknown' };
    
    console.log(chalk.cyan('📊 SDK Health Metrics:'));
    console.log(chalk.cyan(`  • Total Executions: ${healthMetrics.totalExecutions}`));
    console.log(chalk.cyan(`  • Success Rate: ${healthMetrics.successRate}%`));
    console.log(chalk.cyan(`  • Preferred Method: ${healthMetrics.preferredMethod?.toUpperCase() || 'SDK'}`));
    
    if (browserStatus.available || (browserStatus as any).authStatus === 'authenticated') {
      console.log(chalk.green('\n✅ SDK browser authentication available!'));
      console.log(chalk.cyan(`📊 Authentication Status: ${(browserStatus as any).authStatus || 'ready'}`));
      
      console.log(chalk.green.bold('\n🚀 Ready for SDK Execution!'));
      console.log(chalk.gray('   Try: acc run "your task" --use-sdk-only'));
    } else {
      console.log(chalk.red('❌ SDK browser authentication not ready'));
      
      console.log(chalk.cyan.bold('\n📋 To enable SDK execution:'));
      console.log(chalk.white('  1. Open your browser and go to https://claude.ai'));
      console.log(chalk.white('  2. Sign in to your Claude account'));
      console.log(chalk.white('  3. Keep the Claude tab open'));
      console.log(chalk.white('  4. Run this command again to verify'));
    }
    
    process.exit((browserStatus.available || (browserStatus as any).authStatus === 'authenticated') ? 0 : 1);
    
  } catch (error) {
    console.error(chalk.red('❌ Error checking SDK browser sessions:'), error);
    process.exit(1);
  }
}

async function handleBrowserStatus(): Promise<void> {
  console.log(chalk.yellow('⚠️  Browser session management is deprecated in SDK-only architecture'));
  console.log(chalk.gray('   Browser authentication is now handled transparently by the Claude SDK'));
  console.log(chalk.green('✅ Claude SDK handles browser authentication automatically'));
  process.exit(0);
}

async function handleClearBrowserCache(): Promise<void> {
  console.log(chalk.yellow('⚠️  Browser cache management is deprecated in SDK-only architecture'));
  console.log(chalk.gray('   Browser authentication is now handled transparently by the Claude SDK'));
  console.log(chalk.green('✅ No manual cache management needed'));
  process.exit(0);
}

async function handleResetBrowserSessions(): Promise<void> {
  console.log(chalk.yellow('⚠️  Browser session reset is deprecated in SDK-only architecture'));
  console.log(chalk.gray('   Browser authentication is now handled transparently by the Claude SDK'));
  console.log(chalk.green('✅ No manual session reset needed'));
  process.exit(0);
}

async function handleMonitorBrowserSessions(): Promise<void> {
  console.log(chalk.yellow('⚠️  Browser session monitoring is deprecated in SDK-only architecture'));
  console.log(chalk.gray('   Browser authentication is now handled transparently by the Claude SDK'));
  console.log(chalk.green('✅ No manual session monitoring needed'));
  process.exit(0);
}