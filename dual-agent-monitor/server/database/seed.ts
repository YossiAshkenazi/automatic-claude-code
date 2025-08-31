#!/usr/bin/env node
import { DatabaseService } from './DatabaseService';
import { databaseConfig, validateConfig } from './config';
import { v4 as uuidv4 } from 'uuid';

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Validate configuration
    validateConfig(databaseConfig);
    
    if (databaseConfig.type === 'sqlite' && databaseConfig.sqlite) {
      const db = new DatabaseService(databaseConfig.sqlite.filename);
      
      // Create sample session
      const sampleSessionId = await db.createSession({
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        status: 'completed',
        initialTask: 'Create a simple React component with TypeScript',
        workDir: '/tmp/sample-project'
      });
      
      // Add sample messages
      await db.addMessage({
        id: uuidv4(),
        sessionId: sampleSessionId,
        agentType: 'manager',
        messageType: 'prompt',
        content: 'I need to create a React component that displays user information with TypeScript types.',
        timestamp: new Date(Date.now() - 3500000),
        metadata: {
          tools: ['Read', 'Write'],
          files: ['src/components/UserCard.tsx'],
          duration: 2500
        }
      });
      
      await db.addMessage({
        id: uuidv4(),
        sessionId: sampleSessionId,
        agentType: 'worker',
        messageType: 'response',
        content: 'I\'ll create a TypeScript React component for displaying user information. Let me start by creating the component file.',
        timestamp: new Date(Date.now() - 3400000),
        metadata: {
          tools: ['Write', 'Edit'],
          files: ['src/components/UserCard.tsx', 'src/types/User.ts'],
          duration: 1800,
          cost: 0.025
        }
      });
      
      await db.addMessage({
        id: uuidv4(),
        sessionId: sampleSessionId,
        agentType: 'manager',
        messageType: 'prompt',
        content: 'Great! Now let\'s add some basic styling and make it responsive.',
        timestamp: new Date(Date.now() - 3200000),
        metadata: {
          tools: ['Edit'],
          files: ['src/components/UserCard.tsx', 'src/components/UserCard.css'],
          duration: 1200
        }
      });
      
      // Update session to completed
      await db.updateSessionStatus(sampleSessionId, 'completed', new Date(Date.now() - 3000000));
      
      // Add system events
      await db.addSystemEvent({
        id: uuidv4(),
        sessionId: sampleSessionId,
        eventType: 'session_end',
        details: 'Session completed successfully with React component created',
        timestamp: new Date(Date.now() - 3000000)
      });
      
      // Add performance metrics
      await db.addPerformanceMetric({
        sessionId: sampleSessionId,
        agentType: 'manager',
        responseTime: 1250,
        tokensUsed: 450,
        cost: 0.015,
        errorRate: 0,
        timestamp: new Date(Date.now() - 3300000)
      });
      
      await db.addPerformanceMetric({
        sessionId: sampleSessionId,
        agentType: 'worker',
        responseTime: 2100,
        tokensUsed: 680,
        cost: 0.032,
        errorRate: 0,
        timestamp: new Date(Date.now() - 3100000)
      });
      
      console.log('✅ Database seeding completed successfully');
      console.log(`📊 Sample session created: ${sampleSessionId}`);
      
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