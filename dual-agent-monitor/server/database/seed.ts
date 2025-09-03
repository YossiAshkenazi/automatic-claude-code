#!/usr/bin/env node
import { DatabaseService } from './DatabaseService.js';
import { databaseConfig, validateConfig } from './config.js';
import { v4 as uuidv4 } from 'uuid';
import { DualAgentMockDataGenerator } from './mockData.js';

async function seedDatabase() {
  try {
    console.log('🌱 Starting comprehensive database seeding with realistic dual-agent data...');
    
    // Validate configuration
    validateConfig(databaseConfig);
    
    if (databaseConfig.type === 'sqlite' && databaseConfig.sqlite) {
      const db = new DatabaseService(databaseConfig.sqlite.filename);
      
      console.log('🎭 Generating realistic dual-agent sessions...');
      
      // Generate comprehensive mock data
      const mockSessions = DualAgentMockDataGenerator.generateRealisticSessions(15);
      const allMetrics: any[] = [];
      const allSystemEvents: any[] = [];
      const allCommunications: any[] = [];
      
      console.log(`📊 Processing ${mockSessions.length} realistic sessions with full conversation flows...`);
      
      // Create all sessions and their data
      for (const session of mockSessions) {
        console.log(`  📝 Creating session: ${session.initialTask.substring(0, 60)}...`);
        
        // Create session
        const sessionId = await db.createSession({
          startTime: session.startTime,
          status: session.status,
          initialTask: session.initialTask,
          workDir: session.workDir
        });
        
        // Update session with proper ID for relationships
        session.id = sessionId;
        session.messages.forEach(msg => msg.sessionId = sessionId);
        
        // Add all messages for this session
        for (const message of session.messages) {
          await db.addMessage({
            id: message.id,
            sessionId: sessionId,
            agentType: message.agentType,
            messageType: message.messageType,
            content: message.content,
            timestamp: message.timestamp,
            metadata: message.metadata
          });
        }
        
        // Update session status and end time if completed
        if (session.endTime) {
          await db.updateSessionStatus(sessionId, session.status, session.endTime);
        }
      }
      
      console.log('📈 Generating performance metrics...');
      // Generate and add performance metrics
      const performanceMetrics = DualAgentMockDataGenerator.generatePerformanceMetrics(mockSessions);
      for (const metric of performanceMetrics) {
        await db.addPerformanceMetric(metric);
      }
      
      console.log('🎯 Adding system events...');
      // Generate and add system events  
      const systemEvents = DualAgentMockDataGenerator.generateSystemEvents(mockSessions);
      for (const event of systemEvents) {
        await db.addSystemEvent(event);
      }
      
      console.log('🤝 Creating agent communication records...');
      // Generate agent communications (if supported by DB)
      const communications = DualAgentMockDataGenerator.generateAgentCommunications(mockSessions);
      // Note: Add communications if your DB supports it
      
      console.log('\n🎉 COMPREHENSIVE SEEDING COMPLETED!\n');
      console.log(`📊 Demo Data Summary:`);
      console.log(`   Sessions: ${mockSessions.length} (with realistic dual-agent conversations)`);
      console.log(`   Messages: ${mockSessions.reduce((sum, s) => sum + s.messages.length, 0)} (detailed Manager-Worker exchanges)`);
      console.log(`   Metrics: ${performanceMetrics.length} performance data points`);
      console.log(`   Events: ${systemEvents.length} system events`);
      console.log(`   Communications: ${communications.length} agent coordination records`);
      console.log(`   Project Types: OAuth, API Development, Bug Fixes, Feature Enhancements`);
      console.log(`\n🚀 Dashboard ready with compelling demo data at http://localhost:6011\n`);
      
      db.close();
    } else {
      console.log('🐘 PostgreSQL seeding not yet implemented');
    }
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase };