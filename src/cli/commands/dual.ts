import { Command } from 'commander';
import chalk from 'chalk';
import { SDKAutopilotEngine, AutopilotOptions } from '../../core/SDKAutopilotEngine';
import { Logger } from '../../logger';

export function createDualCommand(): Command {
  const dualCommand = new Command('dual');
  
  dualCommand
    .description('Start a dual-agent Claude Code session with Manager and Worker agents')
    .argument('<prompt>', 'The prompt to execute with dual agents')
    .option('-i, --iterations <number>', 'Maximum number of iterations', '10')
    .option('--manager <model>', 'Manager agent model (sonnet or opus)', 'opus')
    .option('--worker <model>', 'Worker agent model (sonnet or opus)', 'sonnet')
    .option('-d, --dir <path>', 'Working directory for the project')
    .option('-t, --tools <tools>', 'Comma-separated list of allowed tools')
    .option('-c, --continue-on-error', 'Continue even if errors occur')
    .option('-v, --verbose', 'Show detailed output')
    .option('--timeout <minutes>', 'Timeout for each agent execution in minutes (default: 30)', '30')
    .option('--loop-threshold <number>', 'Number of iterations before loop detection triggers (default: 3)', '3')
    .option('--max-retries <number>', 'Maximum retries per agent before escalation (default: 3)', '3')
    .option('--escalation-threshold <number>', 'Max failures before human intervention (default: 5)', '5')
    .option('--fallback-single', 'Fall back to single-agent mode if dual-agent fails')
    .action(async (prompt: string, options) => {
      console.log(chalk.cyan('🚀 Starting dedicated SDK dual-agent session'));
      console.log(chalk.gray('   Manager (Opus) + Worker (Sonnet) coordination via Claude SDK'));
      
      const autopilotEngine = new SDKAutopilotEngine(new Logger());
      
      try {
        const autopilotOptions: AutopilotOptions = {
          dualAgent: true,
          maxIterations: parseInt(options.iterations),
          managerModel: options.manager,
          workerModel: options.worker,
          workDir: options.dir,
          allowedTools: options.tools,
          continueOnError: options.continueOnError,
          verbose: options.verbose,
          timeout: parseInt(options.timeout) * 60000
        };

        const result = await autopilotEngine.runAutopilotLoop(prompt, autopilotOptions);
        
        if (result.success) {
          console.log(chalk.green('\n✅ SDK dual-agent session completed successfully'));
          console.log(chalk.gray(`   Duration: ${(result.duration / 1000).toFixed(1)}s`));
          console.log(chalk.gray(`   Total iterations: ${result.iterations}`));
          
          if (result.dualAgentMetrics) {
            console.log(chalk.cyan('\n📊 Dual-Agent Performance:'));
            console.log(chalk.gray(`   Manager-Worker handoffs: ${result.dualAgentMetrics.handoffCount}`));
            console.log(chalk.gray(`   Manager iterations: ${result.dualAgentMetrics.managerIterations}`));
            console.log(chalk.gray(`   Worker iterations: ${result.dualAgentMetrics.workerIterations}`));
            console.log(chalk.gray(`   Overall quality: ${(result.dualAgentMetrics.qualityScore * 100).toFixed(1)}%`));
          }
          
          // Validate coordination quality
          const qualityValidation = autopilotEngine.validateDualAgentQuality();
          if (qualityValidation.issues.length > 0) {
            console.log(chalk.yellow('\n⚠️  Coordination Quality Issues:'));
            qualityValidation.issues.forEach(issue => {
              console.log(chalk.gray(`   - ${issue}`));
            });
          } else {
            console.log(chalk.green(`\n✅ SDK coordination quality: ${(qualityValidation.overallQuality * 100).toFixed(1)}%`));
          }
        } else {
          console.error(chalk.red('\n❌ SDK dual-agent session failed'));
          console.error(chalk.red(`   Error: ${result.error}`));
          
          if (options.fallbackSingle) {
            console.log(chalk.yellow('\n🔄 Falling back to single-agent mode...'));
            const singleAgentOptions: AutopilotOptions = {
              dualAgent: false,
              maxIterations: parseInt(options.iterations),
              model: 'sonnet',
              workDir: options.dir,
              allowedTools: options.tools,
              continueOnError: options.continueOnError,
              verbose: options.verbose,
              timeout: parseInt(options.timeout) * 60000
            };
            
            const fallbackResult = await autopilotEngine.runAutopilotLoop(prompt, singleAgentOptions);
            if (fallbackResult.success) {
              console.log(chalk.green('✅ Fallback single-agent execution completed'));
            } else {
              console.error(chalk.red('❌ Fallback execution also failed'));
              process.exit(1);
            }
          } else {
            process.exit(1);
          }
        }
      } catch (error) {
        console.error(chalk.red('Fatal error in SDK dual-agent mode:'), error);
        if (options.fallbackSingle) {
          console.log(chalk.yellow('\n🔄 Attempting single-agent fallback...'));
          try {
            const singleAgentEngine = new SDKAutopilotEngine(new Logger());
            const fallbackOptions: AutopilotOptions = {
              dualAgent: false,
              maxIterations: parseInt(options.iterations),
              model: 'sonnet',
              workDir: options.dir,
              allowedTools: options.tools,
              continueOnError: options.continueOnError,
              verbose: options.verbose,
              timeout: parseInt(options.timeout) * 60000
            };
            
            await singleAgentEngine.runAutopilotLoop(prompt, fallbackOptions);
          } catch (fallbackError) {
            console.error(chalk.red('❌ Fallback also failed:'), fallbackError);
            process.exit(1);
          }
        } else {
          process.exit(1);
        }
      }
    });

  return dualCommand;
}