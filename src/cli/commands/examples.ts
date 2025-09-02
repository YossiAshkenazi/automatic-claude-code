import { Command } from 'commander';
import chalk from 'chalk';

export function createExamplesCommand(): Command {
  const examplesCommand = new Command('examples');
  
  examplesCommand
    .description('Show example prompts and usage patterns')
    .action(async () => {
      console.log(chalk.blue.bold('\n🚀 Automatic Claude Code - Example Prompts\n'));
      
      console.log(chalk.yellow.bold('💡 Development Tasks:'));
      console.log(chalk.cyan('  acc run "add unit tests for all functions in src/utils.ts" -i 3'));
      console.log(chalk.cyan('  acc run "implement error handling for network requests" -i 4'));
      console.log(chalk.cyan('  acc run "add JSDoc comments to all exported functions" -i 2'));
      console.log(chalk.cyan('  acc run "refactor the authentication module to use JWT" -i 5'));
      
      console.log(chalk.yellow.bold('\n🐛 Bug Fixes:'));
      console.log(chalk.cyan('  acc run "fix the memory leak in the websocket connection" -i 3'));
      console.log(chalk.cyan('  acc run "resolve TypeScript errors in the build process" -i 4'));
      console.log(chalk.cyan('  acc run "fix the race condition in async data loading" -i 3'));
      
      console.log(chalk.yellow.bold('\n📚 Documentation:'));
      console.log(chalk.cyan('  acc run "create comprehensive README with installation guide" -i 2'));
      console.log(chalk.cyan('  acc run "add inline documentation for complex algorithms" -i 3'));
      console.log(chalk.cyan('  acc run "generate API documentation from TypeScript interfaces" -i 2'));
      
      console.log(chalk.yellow.bold('\n🏗️ Architecture:'));
      console.log(chalk.cyan('  acc run "migrate from Express to Fastify framework" -i 6'));
      console.log(chalk.cyan('  acc run "implement dependency injection pattern" -i 4'));
      console.log(chalk.cyan('  acc run "add database connection pooling and optimization" -i 3'));
      
      console.log(chalk.yellow.bold('\n🤖 Dual-Agent Mode:'));
      console.log(chalk.cyan('  acc run "design and implement a REST API for user management" --dual-agent -i 8'));
      console.log(chalk.cyan('  acc run "refactor legacy code to modern TypeScript patterns" --dual-agent -i 6 --verbose'));
      console.log(chalk.cyan('  acc run "create a comprehensive test suite with 90% coverage" --dual-agent -i 5'));
      console.log(chalk.cyan('  acc run "implement OAuth2 authentication with refresh tokens" --dual-agent -i 7 --manager-model opus --worker-model sonnet'));
      console.log(chalk.cyan('  acc run "optimize database queries and add caching layer" --dual-agent -i 4 --continue-on-error'));
      
      console.log(chalk.yellow.bold('\n📊 Monitoring Commands:'));
      console.log(chalk.cyan('  acc monitor                 Show monitoring status'));
      console.log(chalk.cyan('  acc monitor --start         Start monitoring server'));
      console.log(chalk.cyan('  acc monitor --stop          Stop monitoring server'));
      console.log(chalk.cyan('  acc monitor --config        Show monitoring configuration'));
      console.log(chalk.cyan('  acc run "task" --no-monitoring  Disable monitoring for this run'));
      
      console.log(chalk.yellow.bold('\n📊 Enhanced Log Viewing:'));
      console.log(chalk.cyan('  acc logs                    Show session summary'));
      console.log(chalk.cyan('  acc logs --work            View Claude work output only'));
      console.log(chalk.cyan('  acc logs --ui              Launch interactive TUI browser'));
      console.log(chalk.cyan('  acc logs --web             Generate HTML report'));
      console.log(chalk.cyan('  acc logs --stats           Show detailed statistics'));
      console.log(chalk.cyan('  acc logs --search "error"  Search across all sessions'));
      console.log(chalk.cyan('  acc logs --export html     Export session to HTML'));
      console.log(chalk.cyan('  acc logs --session abc123  View specific session'));
      
      console.log(chalk.yellow.bold('\n⚙️ Useful Options:'));
      console.log(chalk.gray('  -i, --iterations <num>     Set max iterations (default: 10)'));
      console.log(chalk.gray('  -m, --model <model>        Use sonnet or opus (default: sonnet)'));
      console.log(chalk.gray('  -v, --verbose             Show detailed output'));
      console.log(chalk.gray('  -c, --continue-on-error   Continue even if errors occur'));
      console.log(chalk.gray('  -d, --dir <path>          Specify working directory'));
      console.log(chalk.gray('  --dual-agent              Enable dual-agent mode (Manager+Worker)'));
      console.log(chalk.gray('  --manager-model <model>   Manager agent model (default: opus)'));
      console.log(chalk.gray('  --worker-model <model>    Worker agent model (default: sonnet)'));
      console.log(chalk.gray('  --no-monitoring           Disable monitoring server'));
      
      console.log(chalk.yellow.bold('\n📋 Tips for Better Results:'));
      console.log(chalk.green('  • Be specific about what you want to achieve'));
      console.log(chalk.green('  • Include file names or modules when relevant'));
      console.log(chalk.green('  • Start with smaller, focused tasks (2-3 iterations)'));
      console.log(chalk.green('  • Use --verbose to see detailed progress'));
      console.log(chalk.green('  • Use "acc logs --ui" for interactive log browsing'));
      console.log(chalk.green('  • Export sessions to HTML for sharing and analysis'));
      console.log(chalk.green('  • Use dual-agent mode for complex tasks requiring planning'));
      console.log(chalk.green('  • Manager agent (opus) handles planning, Worker (sonnet) implements'));
    });

  return examplesCommand;
}