#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:4005/api';

async function testDualAgentIngestion() {
  console.log('🤖 Testing Dual-Agent Data Ingestion...');
  
  try {
    // Test 1: Manager Agent Task Assignment
    console.log('\n1️⃣ Testing Manager Agent Task Assignment...');
    const managerData = {
      agentType: 'manager',
      messageType: 'coordination_event',
      message: 'Task assignment: Implement user authentication system',
      metadata: {
        eventType: 'MANAGER_TASK_ASSIGNMENT',
        workflowPhase: 'planning',
        overallProgress: 0.25,
        assignedTasks: [
          'Set up JWT authentication',
          'Create user registration endpoint',
          'Implement password hashing'
        ]
      },
      sessionInfo: {
        task: 'Implement authentication system',
        workDir: '/test-project'
      }
    };
    
    const managerResponse = await axios.post(`${API_BASE}/monitoring`, managerData);
    console.log('✅ Manager assignment recorded:', managerResponse.data);

    // Test 2: Worker Agent Progress Update
    console.log('\n2️⃣ Testing Worker Agent Progress Update...');
    const workerData = {
      agentType: 'worker',
      messageType: 'response',
      message: 'JWT authentication module completed successfully',
      metadata: {
        eventType: 'WORKER_PROGRESS_UPDATE',
        workflowPhase: 'execution',
        overallProgress: 0.6,
        completedTasks: ['JWT setup', 'Token validation', 'Middleware integration'],
        filesModified: ['src/auth/jwt.ts', 'src/middleware/auth.ts'],
        toolsUsed: ['Write', 'Edit', 'Read']
      },
      sessionInfo: {
        task: 'Implement authentication system', 
        workDir: '/test-project'
      }
    };
    
    const workerResponse = await axios.post(`${API_BASE}/monitoring`, workerData);
    console.log('✅ Worker progress recorded:', workerResponse.data);

    // Test 3: Manager Quality Check
    console.log('\n3️⃣ Testing Manager Quality Validation...');
    const qualityData = {
      agentType: 'manager',
      messageType: 'coordination_event',
      message: 'Quality validation: Authentication implementation meets requirements',
      metadata: {
        eventType: 'MANAGER_QUALITY_CHECK',
        workflowPhase: 'validation',
        overallProgress: 0.85,
        validationResult: 'passed',
        qualityScore: 0.95,
        recommendations: ['Add input validation', 'Include rate limiting']
      },
      sessionInfo: {
        task: 'Implement authentication system',
        workDir: '/test-project'
      }
    };
    
    const qualityResponse = await axios.post(`${API_BASE}/monitoring`, qualityData);
    console.log('✅ Quality check recorded:', qualityResponse.data);

    // Test 4: Error Handling
    console.log('\n4️⃣ Testing Error Event Recording...');
    const errorData = {
      agentType: 'worker',
      messageType: 'error',
      message: 'Failed to install bcrypt dependency - missing build tools',
      metadata: {
        eventType: 'WORKER_ERROR',
        errorType: 'dependency_error',
        errorCode: 'BUILD_TOOLS_MISSING',
        resolution: 'Installing python3 and build-essential'
      },
      sessionInfo: {
        task: 'Implement authentication system',
        workDir: '/test-project'
      }
    };
    
    const errorResponse = await axios.post(`${API_BASE}/monitoring`, errorData);
    console.log('✅ Error event recorded:', errorResponse.data);

    // Test 5: Verify Sessions Endpoint
    console.log('\n5️⃣ Checking Sessions Data...');
    const sessionsResponse = await axios.get(`${API_BASE}/sessions`);
    console.log('📊 Current sessions:', sessionsResponse.data);

    console.log('\n🎉 Dual-Agent Data Ingestion Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
testDualAgentIngestion();