// Test script to send monitoring data to the server
const fetch = require('node-fetch');

async function sendTestData() {
  const baseUrl = 'http://localhost:4001/api/monitoring';
  
  // Test session data
  const sessionData = {
    task: 'Create a complete user authentication system with JWT tokens',
    workDir: 'C:\\Users\\Dev\\test-dual-agent'
  };
  
  // Send a series of monitoring events to simulate a real dual-agent session
  const events = [
    {
      agentType: 'manager',
      messageType: 'coordination_event',
      message: 'Starting task analysis',
      metadata: {
        eventType: 'AGENT_COORDINATION',
        eventData: { phase: 'initialization' },
        timestamp: new Date().toISOString(),
        workflowPhase: 'planning',
        overallProgress: 0.1
      },
      sessionInfo: sessionData
    },
    {
      agentType: 'manager',
      messageType: 'coordination_event',
      message: 'Task analysis completed - 3 work items identified',
      metadata: {
        eventType: 'MANAGER_TASK_ASSIGNMENT',
        eventData: {
          workItems: [
            { id: 'wi-1', title: 'Implement JWT token generation and validation' },
            { id: 'wi-2', title: 'Create password hashing with bcrypt' },
            { id: 'wi-3', title: 'Build role-based access control middleware' }
          ]
        },
        timestamp: new Date().toISOString(),
        workflowPhase: 'planning',
        overallProgress: 0.25
      },
      sessionInfo: sessionData
    },
    {
      agentType: 'manager',
      messageType: 'coordination_event',
      message: 'Delegating work item to Worker',
      metadata: {
        eventType: 'MANAGER_WORKER_HANDOFF',
        eventData: {
          workItem: { id: 'wi-1', title: 'Implement JWT token generation and validation' },
          context: 'Implementation phase starting',
          handoffCount: 1
        },
        timestamp: new Date().toISOString(),
        workflowPhase: 'execution',
        overallProgress: 0.3
      },
      sessionInfo: sessionData
    },
    {
      agentType: 'worker',
      messageType: 'response',
      message: 'Starting implementation of JWT token system',
      metadata: {
        eventType: 'WORKER_PROGRESS_UPDATE',
        eventData: {
          workItemId: 'wi-1',
          status: 'in_progress',
          completedSteps: [],
          nextSteps: ['Create JWT utility functions', 'Set up token signing']
        },
        timestamp: new Date().toISOString(),
        workflowPhase: 'execution',
        overallProgress: 0.4
      },
      sessionInfo: sessionData
    },
    {
      agentType: 'worker',
      messageType: 'response',
      message: 'JWT implementation completed',
      metadata: {
        eventType: 'WORKER_PROGRESS_UPDATE',
        eventData: {
          workItemId: 'wi-1',
          status: 'completed',
          completedSteps: ['JWT utility functions created', 'Token signing implemented', 'Token verification added'],
          nextSteps: []
        },
        timestamp: new Date().toISOString(),
        workflowPhase: 'execution',
        overallProgress: 0.5
      },
      sessionInfo: sessionData
    },
    {
      agentType: 'manager',
      messageType: 'coordination_event',
      message: 'Quality check passed for JWT implementation',
      metadata: {
        eventType: 'MANAGER_QUALITY_CHECK',
        eventData: {
          workItemId: 'wi-1',
          passed: true,
          qualityScore: 0.85,
          feedback: ['Good implementation', 'Follows security best practices']
        },
        timestamp: new Date().toISOString(),
        workflowPhase: 'validation',
        overallProgress: 0.6
      },
      sessionInfo: sessionData
    },
    {
      agentType: 'manager',
      messageType: 'coordination_event',
      message: 'Delegating next work item to Worker',
      metadata: {
        eventType: 'MANAGER_WORKER_HANDOFF',
        eventData: {
          workItem: { id: 'wi-2', title: 'Create password hashing with bcrypt' },
          context: 'Continue with security implementation',
          handoffCount: 2
        },
        timestamp: new Date().toISOString(),
        workflowPhase: 'execution',
        overallProgress: 0.65
      },
      sessionInfo: sessionData
    },
    {
      agentType: 'worker',
      messageType: 'response',
      message: 'Implementing bcrypt password hashing',
      metadata: {
        eventType: 'WORKER_PROGRESS_UPDATE',
        eventData: {
          workItemId: 'wi-2',
          status: 'completed',
          completedSteps: ['Bcrypt integration', 'Hash and compare functions', 'Salt rounds configured'],
          nextSteps: []
        },
        timestamp: new Date().toISOString(),
        workflowPhase: 'execution',
        overallProgress: 0.8
      },
      sessionInfo: sessionData
    },
    {
      agentType: 'manager',
      messageType: 'coordination_event',
      message: 'All work items completed successfully',
      metadata: {
        eventType: 'WORKFLOW_TRANSITION',
        eventData: {
          fromPhase: 'execution',
          toPhase: 'completion',
          completedWorkItems: 3,
          totalWorkItems: 3
        },
        timestamp: new Date().toISOString(),
        workflowPhase: 'completion',
        overallProgress: 1.0
      },
      sessionInfo: sessionData
    }
  ];
  
  console.log('Sending test monitoring data to server...');
  console.log(`URL: ${baseUrl}`);
  console.log(`Total events to send: ${events.length}`);
  
  // Send events with delays to simulate real-time activity
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    console.log(`\n[${i + 1}/${events.length}] Sending: ${event.message}`);
    
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`  ✓ Success:`, result);
      } else {
        console.log(`  ✗ Failed: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`  Response:`, text);
      }
    } catch (error) {
      console.log(`  ✗ Error:`, error.message);
    }
    
    // Small delay between events
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✓ Test data sent successfully!');
  console.log('Check the monitoring UI at http://localhost:6011');
}

// Run the test
sendTestData().catch(console.error);