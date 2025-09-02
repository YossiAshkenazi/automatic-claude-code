#!/usr/bin/env node

/**
 * Get detailed session information from the monitoring API
 */

const http = require('http');

async function makeApiRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4001,
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

async function getSessionDetails() {
  console.log('📋 Fetching detailed session information...');
  console.log('');

  try {
    // Get all sessions
    const sessionsResponse = await makeApiRequest('/api/sessions');
    if (sessionsResponse.status === 200 && sessionsResponse.data) {
      const sessions = sessionsResponse.data.sessions;
      console.log(`✅ Found ${sessions.length} session(s):`);
      console.log('');

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        console.log(`📊 Session ${i + 1}:`);
        console.log(`   ID: ${session.id || 'N/A'}`);
        console.log(`   Session ID: ${session.sessionId || 'N/A'}`);
        console.log(`   Task: ${session.task || 'N/A'}`);
        console.log(`   Work Directory: ${session.workDir || 'N/A'}`);
        console.log(`   Started: ${session.startTime || session.createdAt || 'N/A'}`);
        console.log(`   Status: ${session.status || 'N/A'}`);
        console.log(`   Messages: ${session.messageCount || session.messages?.length || 'N/A'}`);
        console.log(`   Progress: ${session.overallProgress ? (session.overallProgress * 100).toFixed(1) + '%' : 'N/A'}`);
        console.log('');

        if (session.messages && Array.isArray(session.messages)) {
          console.log(`   📨 Recent Messages (${Math.min(5, session.messages.length)} of ${session.messages.length}):`);
          session.messages.slice(-5).forEach((msg, idx) => {
            console.log(`      ${idx + 1}. [${msg.agentType || 'unknown'}] ${msg.message || msg.content || 'No message'}`);
            if (msg.metadata && msg.metadata.eventType) {
              console.log(`         Event: ${msg.metadata.eventType}`);
            }
            if (msg.metadata && msg.metadata.overallProgress) {
              console.log(`         Progress: ${(msg.metadata.overallProgress * 100).toFixed(1)}%`);
            }
          });
          console.log('');
        }

        if (session.id) {
          // Get detailed session info
          console.log('   🔍 Fetching detailed session data...');
          const detailResponse = await makeApiRequest(`/api/sessions/${session.id}`);
          if (detailResponse.status === 200 && detailResponse.data) {
            const details = detailResponse.data;
            if (details.agents) {
              console.log(`   👥 Agents: ${Object.keys(details.agents).join(', ')}`);
            }
            if (details.metrics) {
              console.log(`   📊 Metrics available: ${Object.keys(details.metrics).length} keys`);
            }
            if (details.events) {
              console.log(`   🎯 Events: ${details.events.length} events`);
              
              // Show event breakdown
              const eventTypes = {};
              details.events.forEach(event => {
                const type = event.eventType || event.type || 'unknown';
                eventTypes[type] = (eventTypes[type] || 0) + 1;
              });
              
              console.log('   📈 Event breakdown:');
              Object.entries(eventTypes).forEach(([type, count]) => {
                console.log(`      • ${type}: ${count}`);
              });
            }
          }
        }
        
        console.log('   ' + '─'.repeat(50));
        console.log('');
      }
    }

    // Get dashboard analytics
    console.log('📊 Dashboard Analytics:');
    const analyticsResponse = await makeApiRequest('/api/analytics/dashboard');
    if (analyticsResponse.status === 200 && analyticsResponse.data) {
      const analytics = analyticsResponse.data;
      
      if (analytics.overview) {
        console.log('   Overview:');
        Object.entries(analytics.overview).forEach(([key, value]) => {
          console.log(`      • ${key}: ${value}`);
        });
      }
      
      if (analytics.topSessions && analytics.topSessions.length > 0) {
        console.log('   Top Sessions:');
        analytics.topSessions.forEach((session, idx) => {
          console.log(`      ${idx + 1}. ${session.task || session.sessionId} (${session.messageCount || 0} messages)`);
        });
      }
      
      console.log('');
    }

    console.log('🌐 Dashboard URLs:');
    console.log('   Main Dashboard: http://localhost:6011');
    console.log('   Session List: http://localhost:6011/sessions');
    console.log('   Analytics: http://localhost:6011/analytics');
    console.log('   Real-time View: http://localhost:6011/realtime');

  } catch (error) {
    console.error('❌ Error fetching session details:', error.message);
  }
}

getSessionDetails().catch(console.error);