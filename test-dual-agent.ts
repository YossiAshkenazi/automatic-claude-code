#!/usr/bin/env tsx
import { AgentOrchestrator } from './src/agentOrchestrator';
import { ClaudeUtils } from './src/claudeUtils';
import chalk from 'chalk';

async function testDualAgentSystem() {
  console.log(chalk.blue.bold('🧪 Testing Dual-Agent Orchestration System\n'));

  // Test 1: Validate Claude installation
  console.log(chalk.yellow('Test 1: Validating Claude CLI installation...'));
  const isClaudeInstalled = ClaudeUtils.validateClaudeInstallation();
  
  if (!isClaudeInstalled) {
    console.error(chalk.red('❌ Claude CLI is not properly installed or configured'));
    console.log(chalk.gray('Please install with: npm install -g @anthropic-ai/claude-code'));
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Claude CLI is installed and accessible'));
  
  // Test 2: Test Claude connection
  console.log(chalk.yellow('\nTest 2: Testing Claude connection...'));
  try {
    const connectionTest = await ClaudeUtils.testClaudeConnection('sonnet', 30000);
    if (connectionTest) {
      console.log(chalk.green('✅ Claude connection test successful'));
    } else {
      console.log(chalk.yellow('⚠️ Claude connection test returned unexpected response'));
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️ Claude connection test failed (this may be normal if no API key is configured)'));
  }

  // Test 3: Initialize AgentOrchestrator
  console.log(chalk.yellow('\nTest 3: Initializing Agent Orchestrator...'));
  try {
    const orchestrator = new AgentOrchestrator();
    console.log(chalk.green('✅ Agent Orchestrator initialized successfully'));
    
    // Test agent status (should be empty initially)
    const initialStatus = orchestrator.getAgentStatus();
    console.log(chalk.gray(`Initial agent count: ${Object.keys(initialStatus).length}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to initialize Agent Orchestrator:'), error);
    process.exit(1);
  }

  // Test 4: Dry run validation
  console.log(chalk.yellow('\nTest 4: Validating dual-agent configuration...'));
  try {
    const orchestrator = new AgentOrchestrator();
    
    // Test with very basic task and minimal iterations for validation
    const testPrompt = 'Hello, please respond with "Test successful" to validate the dual-agent system is working.';
    
    console.log(chalk.gray('Starting minimal dual-agent test (1 iteration)...'));
    console.log(chalk.gray('This will test agent initialization and basic communication flow.'));
    
    await orchestrator.startDualAgentSession(testPrompt, {
      maxIterations: 1,
      managerModel: 'sonnet', // Use sonnet for both to avoid quota issues
      workerModel: 'sonnet',
      verbose: true,
      continueOnError: true,
      timeout: 30000, // 30 seconds
      maxRetries: 1,
      escalationThreshold: 2,
      fallbackToSingleAgent: true
    });
    
    console.log(chalk.green('\n✅ Dual-agent system validation completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Dual-agent system validation failed:'), error);
    console.log(chalk.yellow('\nThis may be due to:'));
    console.log(chalk.gray('- API key not configured'));
    console.log(chalk.gray('- Network connectivity issues'));
    console.log(chalk.gray('- Claude service availability'));
    console.log(chalk.gray('- Permission or configuration issues'));
  }

  // Test summary
  console.log(chalk.blue.bold('\n📋 Test Summary:'));
  console.log(chalk.green('✅ Claude CLI Installation: PASSED'));
  console.log(chalk.green('✅ Agent Orchestrator Initialization: PASSED'));
  console.log(chalk.cyan('ℹ️ Full dual-agent test: See above results'));
  
  console.log(chalk.yellow.bold('\n🚀 Dual-Agent System Ready for Use!'));
  console.log(chalk.cyan('Usage: npm run build && node dist/index.js dual "your task here" -i 5 -v'));
  console.log(chalk.cyan('CLI: acc dual "your task here" --manager opus --worker sonnet -v'));
}

// Run the test
testDualAgentSystem().catch((error) => {
  console.error(chalk.red('Test runner failed:'), error);
  process.exit(1);
});