#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const agentOrchestrator_1 = require("./src/agentOrchestrator");
const claudeUtils_1 = require("./src/claudeUtils");
const chalk_1 = __importDefault(require("chalk"));
async function testDualAgentSystem() {
    console.log(chalk_1.default.blue.bold('🧪 Testing Dual-Agent Orchestration System\n'));
    // Test 1: Validate Claude installation
    console.log(chalk_1.default.yellow('Test 1: Validating Claude CLI installation...'));
    const isClaudeInstalled = claudeUtils_1.ClaudeUtils.validateClaudeInstallation();
    if (!isClaudeInstalled) {
        console.error(chalk_1.default.red('❌ Claude CLI is not properly installed or configured'));
        console.log(chalk_1.default.gray('Please install with: npm install -g @anthropic-ai/claude-code'));
        process.exit(1);
    }
    console.log(chalk_1.default.green('✅ Claude CLI is installed and accessible'));
    // Test 2: Test Claude connection
    console.log(chalk_1.default.yellow('\nTest 2: Testing Claude connection...'));
    try {
        const connectionTest = await claudeUtils_1.ClaudeUtils.testClaudeConnection('sonnet', 30000);
        if (connectionTest) {
            console.log(chalk_1.default.green('✅ Claude connection test successful'));
        }
        else {
            console.log(chalk_1.default.yellow('⚠️ Claude connection test returned unexpected response'));
        }
    }
    catch (error) {
        console.log(chalk_1.default.yellow('⚠️ Claude connection test failed (this may be normal if no API key is configured)'));
    }
    // Test 3: Initialize AgentOrchestrator
    console.log(chalk_1.default.yellow('\nTest 3: Initializing Agent Orchestrator...'));
    try {
        const orchestrator = new agentOrchestrator_1.AgentOrchestrator();
        console.log(chalk_1.default.green('✅ Agent Orchestrator initialized successfully'));
        // Test agent status (should be empty initially)
        const initialStatus = orchestrator.getAgentStatus();
        console.log(chalk_1.default.gray(`Initial agent count: ${Object.keys(initialStatus).length}`));
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Failed to initialize Agent Orchestrator:'), error);
        process.exit(1);
    }
    // Test 4: Dry run validation
    console.log(chalk_1.default.yellow('\nTest 4: Validating dual-agent configuration...'));
    try {
        const orchestrator = new agentOrchestrator_1.AgentOrchestrator();
        // Test with very basic task and minimal iterations for validation
        const testPrompt = 'Hello, please respond with "Test successful" to validate the dual-agent system is working.';
        console.log(chalk_1.default.gray('Starting minimal dual-agent test (1 iteration)...'));
        console.log(chalk_1.default.gray('This will test agent initialization and basic communication flow.'));
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
        console.log(chalk_1.default.green('\n✅ Dual-agent system validation completed successfully!'));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ Dual-agent system validation failed:'), error);
        console.log(chalk_1.default.yellow('\nThis may be due to:'));
        console.log(chalk_1.default.gray('- API key not configured'));
        console.log(chalk_1.default.gray('- Network connectivity issues'));
        console.log(chalk_1.default.gray('- Claude service availability'));
        console.log(chalk_1.default.gray('- Permission or configuration issues'));
    }
    // Test summary
    console.log(chalk_1.default.blue.bold('\n📋 Test Summary:'));
    console.log(chalk_1.default.green('✅ Claude CLI Installation: PASSED'));
    console.log(chalk_1.default.green('✅ Agent Orchestrator Initialization: PASSED'));
    console.log(chalk_1.default.cyan('ℹ️ Full dual-agent test: See above results'));
    console.log(chalk_1.default.yellow.bold('\n🚀 Dual-Agent System Ready for Use!'));
    console.log(chalk_1.default.cyan('Usage: npm run build && node dist/index.js dual "your task here" -i 5 -v'));
    console.log(chalk_1.default.cyan('CLI: acc dual "your task here" --manager opus --worker sonnet -v'));
}
// Run the test
testDualAgentSystem().catch((error) => {
    console.error(chalk_1.default.red('Test runner failed:'), error);
    process.exit(1);
});
