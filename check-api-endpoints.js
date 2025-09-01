#!/usr/bin/env node

/**
 * API Endpoints Verification Script
 * Tests the actual monitoring API endpoints to see stored data
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

async function checkAllEndpoints() {
  console.log('🔍 Checking all available API endpoints...');
  console.log('');

  const endpoints = [
    '/api/health',
    '/api/sessions', 
    '/api/analytics/dashboard',
    '/api/analytics/realtime',
    '/api/ml/status'
  ];

  for (const endpoint of endpoints) {
    console.log(`📡 Testing ${endpoint}:`);
    try {
      const response = await makeApiRequest(endpoint);
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200 && response.data) {
        if (typeof response.data === 'object') {
          console.log('   Data structure:');
          Object.keys(response.data).forEach(key => {
            const value = response.data[key];
            if (Array.isArray(value)) {
              console.log(`     • ${key}: Array[${value.length}]`);
            } else if (typeof value === 'object' && value !== null) {
              console.log(`     • ${key}: Object{${Object.keys(value).length} keys}`);
            } else {
              console.log(`     • ${key}: ${typeof value} (${String(value).substring(0, 50)}${String(value).length > 50 ? '...' : ''})`);
            }
          });
        } else {
          console.log(`   Data: ${typeof response.data}`);
        }
      } else if (response.body) {
        console.log(`   Response: ${response.body.substring(0, 200)}${response.body.length > 200 ? '...' : ''}`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log('');
    }
  }

  console.log('🎯 Summary:');
  console.log('The test data was sent to the /api/monitoring endpoint.');
  console.log('Check the dashboard at http://localhost:6011 to see the visual representation.');
  console.log('The monitoring data should appear in real-time charts and session lists.');
}

checkAllEndpoints().catch(console.error);