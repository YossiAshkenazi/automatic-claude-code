#!/usr/bin/env npx ts-node

/**
 * Example usage of the Claude Session Management System
 * 
 * This file demonstrates how to:
 * 1. Create and manage Claude-compatible sessions
 * 2. Read and write JSONL session files
 * 3. Maintain persistence across Claude invocations
 * 4. Integrate with existing automatic-claude-code systems
 */

import * as path from 'path';
import { ClaudeSessionManager } from './sessionManager';
import SessionIntegration from './sessionIntegration';
import { Logger } from '../logger';

async function demonstrateSessionManagement() {
  const logger = new Logger('SessionDemo');
  const currentProject = process.cwd();
  
  console.log('🚀 Claude Session Management System Demo\n');

  // Initialize session manager
  const sessionManager = new ClaudeSessionManager(logger);
  const integration = new SessionIntegration(logger);

  try {
    // 1. Create a new Claude session
    console.log('📝 Creating new Claude session...');
    const sessionId = await sessionManager.createSession({
      projectPath: currentProject,
      initialMessage: 'Implement authentication system with JWT tokens',
      version: '1.0.92',
      gitBranch: 'main'
    });
    console.log(`   ✅ Session created: ${sessionId}\n`);

    // 2. Add user messages to the session
    console.log('💬 Adding user messages...');
    await sessionManager.appendMessage(currentProject, sessionId, {
      parentUuid: null,
      isSidechain: false,
      userType: 'external',
      version: '1.0.92',
      type: 'user',
      message: {
        role: 'user',
        content: 'Please start with setting up the JWT library and basic middleware'
      }
    });

    // 3. Add assistant response with token usage
    await sessionManager.appendMessage(currentProject, sessionId, {
      parentUuid: null,
      isSidechain: false,
      userType: 'external',
      version: '1.0.92',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: 'I\'ll help you implement JWT authentication. Let me start by setting up the necessary dependencies and middleware.',
        id: 'msg_example_123',
        model: 'claude-3-sonnet',
        stop_reason: 'stop_sequence',
        usage: {
          input_tokens: 150,
          output_tokens: 85,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0
        }
      }
    });
    console.log('   ✅ Messages added successfully\n');

    // 4. Load and display session
    console.log('📖 Loading session data...');
    const messages = await sessionManager.loadSession(currentProject, sessionId);
    console.log(`   📊 Session contains ${messages.length} messages:`);
    messages.forEach((msg, index) => {
      const type = msg.type.toUpperCase().padEnd(9);
      const content = msg.type === 'summary' 
        ? msg.summary 
        : msg.message?.content?.toString().substring(0, 50) + '...';
      console.log(`   ${index + 1}. [${type}] ${content}`);
    });
    console.log();

    // 5. Get session metadata
    console.log('📈 Session metadata:');
    const metadata = await sessionManager.getSessionMetadata(currentProject, sessionId);
    console.log(`   🆔 ID: ${metadata.id}`);
    console.log(`   📁 Project: ${metadata.projectPath}`);
    console.log(`   📅 Created: ${metadata.created.toISOString()}`);
    console.log(`   💬 Messages: ${metadata.messageCount}`);
    console.log(`   🎯 Tokens: ${metadata.totalTokens}`);
    console.log(`   ⚡ Status: ${metadata.status}`);
    console.log();

    // 6. Resume session with new message
    console.log('🔄 Resuming session...');
    await sessionManager.resumeSession(
      currentProject, 
      sessionId, 
      'Now let\'s add password hashing using bcrypt'
    );
    console.log('   ✅ Session resumed with new user message\n');

    // 7. List all sessions for this project
    console.log('📋 All sessions for this project:');
    const allSessions = await sessionManager.listSessions(currentProject);
    allSessions.forEach((session, index) => {
      console.log(`   ${index + 1}. ${session.id}`);
      console.log(`      📅 Created: ${session.created.toLocaleString()}`);
      console.log(`      💬 Messages: ${session.messageCount}`);
      console.log(`      🎯 Tokens: ${session.totalTokens}`);
      console.log(`      ⚡ Status: ${session.status}`);
      console.log();
    });

    // 8. Export session data
    console.log('📦 Exporting session data...');
    const exportData = await sessionManager.exportSession(currentProject, sessionId);
    console.log(`   ✅ Export contains ${exportData.messages.length} messages`);
    console.log(`   📊 Export metadata:`);
    console.log(`      🆔 Session ID: ${exportData.metadata.id}`);
    console.log(`      📅 Export time: ${exportData.export_timestamp}`);
    console.log();

    // 9. Validate session format
    console.log('✅ Validating session format...');
    const validation = await sessionManager.validateSession(currentProject, sessionId);
    if (validation.valid) {
      console.log(`   ✅ Session is valid! (${validation.messageCount} messages)`);
    } else {
      console.log(`   ❌ Session has errors:`);
      validation.errors.forEach(error => console.log(`      - ${error}`));
    }
    console.log();

    // 10. Demonstrate integration with existing system
    console.log('🔗 Testing integration with existing system...');
    const sessionInfo = await integration.getSessionInfo(currentProject, sessionId);
    console.log(`   📊 Combined stats:`);
    console.log(`      💬 Total messages: ${sessionInfo.combined.totalMessages}`);
    console.log(`      🎯 Total tokens: ${sessionInfo.combined.totalTokens}`);
    console.log(`      📅 Start time: ${sessionInfo.combined.startTime.toLocaleString()}`);
    console.log(`      🔄 Last activity: ${sessionInfo.combined.lastActivity.toLocaleString()}`);
    console.log(`      ⚡ Status: ${sessionInfo.combined.status}`);
    console.log();

    // 11. Show project statistics
    console.log('📈 Project statistics:');
    const stats = await sessionManager.getSessionStats(currentProject);
    console.log(`   📊 Total sessions: ${stats.totalSessions}`);
    console.log(`   🔥 Active sessions: ${stats.activeSessions}`);
    console.log(`   ✅ Completed sessions: ${stats.completedSessions}`);
    console.log(`   ❌ Error sessions: ${stats.errorSessions}`);
    console.log(`   💬 Total messages: ${stats.totalMessages}`);
    console.log(`   🎯 Total tokens: ${stats.totalTokens}`);
    if (stats.oldestSession) {
      console.log(`   📅 Oldest session: ${stats.oldestSession.toLocaleString()}`);
    }
    if (stats.newestSession) {
      console.log(`   📅 Newest session: ${stats.newestSession.toLocaleString()}`);
    }
    console.log();

    // 12. Show where Claude stores sessions
    console.log('📁 Claude session storage locations:');
    const { ClaudePathEncoder } = await import('./sessionManager');
    const claudeProjectsDir = ClaudePathEncoder.getClaudeProjectsDir();
    const projectSessionDir = ClaudePathEncoder.getProjectSessionDir(currentProject);
    const sessionFile = ClaudePathEncoder.getSessionFilePath(currentProject, sessionId);
    
    console.log(`   🏠 Claude projects directory: ${claudeProjectsDir}`);
    console.log(`   📁 This project's session directory: ${projectSessionDir}`);
    console.log(`   📄 Current session file: ${sessionFile}`);
    console.log();

    // 13. Demonstrate path encoding (Claude's method)
    console.log('🔐 Path encoding demonstration:');
    const encodedPath = ClaudePathEncoder.encodePath(currentProject);
    const decodedPath = ClaudePathEncoder.decodePath(encodedPath);
    console.log(`   📥 Original path: ${currentProject}`);
    console.log(`   🔐 Encoded path: ${encodedPath}`);
    console.log(`   📤 Decoded path: ${decodedPath}`);
    console.log(`   ✅ Encoding matches: ${currentProject === decodedPath}`);
    console.log();

    console.log('🎉 Demo completed successfully!');
    console.log('\n💡 Key Benefits:');
    console.log('   • True persistence across Claude invocations');
    console.log('   • Compatible with Claude\'s native session format');
    console.log('   • Automatic path encoding/decoding');
    console.log('   • JSONL format exactly matching Claude\'s expectations');
    console.log('   • Session validation and error checking');
    console.log('   • Integration with existing automatic-claude-code systems');
    console.log('   • Export/import capabilities for backup and migration');
    console.log('   • Comprehensive session statistics and management');

    // Optional cleanup
    console.log('\n🧹 Cleaning up demo session...');
    await sessionManager.deleteSession(currentProject, sessionId);
    console.log('   ✅ Demo session deleted\n');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateSessionManagement().catch(error => {
    console.error('Demo crashed:', error);
    process.exit(1);
  });
}

export { demonstrateSessionManagement };