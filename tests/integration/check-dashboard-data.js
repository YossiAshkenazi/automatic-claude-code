#!/usr/bin/env node

/**
 * Dashboard Data Verification Script
 * 
 * This script queries the monitoring API to verify that the test data
 * was received and is available in the dashboard.
 */

const http = require('http');

async function makeApiRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4005,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: body, error: e.message });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkDashboardData() {
  console.log('🔍 Checking dashboard data availability...');
  console.log('');

  try {
    // Check API health
    console.log('1. Checking API health...');
    const healthResponse = await makeApiRequest('/api/health');
    if (healthResponse.status === 200) {
      console.log('   ✅ API is healthy');
    } else {
      console.log(`   ❌ API health check failed: ${healthResponse.status}`);
    }

    // Check sessions
    console.log('');
    console.log('2. Checking sessions data...');
    const sessionsResponse = await makeApiRequest('/api/sessions');
    if (sessionsResponse.status === 200 && sessionsResponse.data) {
      const sessions = sessionsResponse.data.sessions || sessionsResponse.data;
      console.log(`   ✅ Found ${Array.isArray(sessions) ? sessions.length : 'some'} sessions`);
      
      if (Array.isArray(sessions) && sessions.length > 0) {
        const testSession = sessions.find(s => s.sessionId && s.sessionId.includes('test-session'));
        if (testSession) {
          console.log(`   ✅ Test session found: ${testSession.sessionId}`);
          console.log(`   📋 Task: ${testSession.task || 'N/A'}`);
          console.log(`   📊 Messages: ${testSession.messageCount || 'N/A'}`);
        } else {
          console.log('   ⚠️  No test session found in recent sessions');
        }
      }
    } else {
      console.log(`   ❌ Sessions check failed: ${sessionsResponse.status}`);
      if (sessionsResponse.error) {
        console.log(`   Error: ${sessionsResponse.error}`);
      }
    }

    // Check metrics
    console.log('');
    console.log('3. Checking metrics data...');
    const metricsResponse = await makeApiRequest('/api/metrics');
    if (metricsResponse.status === 200 && metricsResponse.data) {
      console.log('   ✅ Metrics endpoint responding');
      if (metricsResponse.data.agentMessages) {
        console.log(`   📈 Agent messages: ${metricsResponse.data.agentMessages}`);
      }
      if (metricsResponse.data.totalSessions) {
        console.log(`   📈 Total sessions: ${metricsResponse.data.totalSessions}`);
      }
    } else {
      console.log(`   ❌ Metrics check failed: ${metricsResponse.status}`);
    }

    // Check recent activities
    console.log('');
    console.log('4. Checking recent activities...');
    const activitiesResponse = await makeApiRequest('/api/activities/recent');
    if (activitiesResponse.status === 200 && activitiesResponse.data) {
      const activities = activitiesResponse.data.activities || activitiesResponse.data;
      if (Array.isArray(activities)) {
        console.log(`   ✅ Found ${activities.length} recent activities`);
        
        const eventTypes = {};
        activities.forEach(activity => {
          const eventType = activity.eventType || activity.type || 'unknown';
          eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;
        });
        
        console.log('   📊 Event type breakdown:');
        Object.entries(eventTypes).forEach(([type, count]) => {
          console.log(`      • ${type}: ${count}`);
        });
      } else {
        console.log('   ⚠️  Activities data format unexpected');
      }
    } else {
      console.log(`   ❌ Activities check failed: ${activitiesResponse.status}`);
    }

    console.log('');
    console.log('🎯 Dashboard Access:');
    console.log('   Frontend: http://localhost:6011');
    console.log('   API Base: http://localhost:4005/api');
    console.log('');
    console.log('📋 What to Look For in Dashboard:');
    console.log('   - Session list with test-session-* entries');
    console.log('   - Real-time metrics showing agent activity');
    console.log('   - Communication timeline with Manager/Worker events');
    console.log('   - Progress tracking from 0% to 100%');
    console.log('   - Error recovery events showing resolution');
    console.log('   - Quality scores and performance metrics');

  } catch (error) {
    console.error('❌ Error checking dashboard data:', error.message);
  }
}

checkDashboardData().catch(console.error);