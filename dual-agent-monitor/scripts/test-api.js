#!/usr/bin/env node

/**
 * API Server Test Script
 * Tests all API endpoints and WebSocket functionality
 */

const http = require('http');
const WebSocket = require('ws');
const { URL } = require('url');

// Configuration
const config = {
  apiBaseUrl: process.env.VITE_API_BASE_URL || 'http://localhost:4005/api',
  wsUrl: process.env.VITE_WS_URL || 'ws://localhost:4005',
  timeout: 10000
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const colorMap = {
    INFO: colors.blue,
    SUCCESS: colors.green,
    WARNING: colors.yellow,
    ERROR: colors.red,
    TEST: colors.cyan
  };
  
  console.log(`${colorMap[level] || ''}[${level}] ${timestamp} - ${message}${colors.reset}`);
}

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: config.timeout
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Test suite
class APITestSuite {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async runTest(test) {
    log('TEST', `Running: ${test.name}`);
    try {
      await test.testFn();
      log('SUCCESS', `✓ ${test.name}`);
      this.results.passed++;
    } catch (error) {
      log('ERROR', `✗ ${test.name}: ${error.message}`);
      this.results.failed++;
    }
    this.results.total++;
  }

  async runAll() {
    log('INFO', 'Starting API Server Test Suite');
    log('INFO', `API Base URL: ${config.apiBaseUrl}`);
    log('INFO', `WebSocket URL: ${config.wsUrl}`);
    
    for (const test of this.tests) {
      await this.runTest(test);
    }

    // Summary
    log('INFO', '\n=== Test Summary ===');
    log('INFO', `Total: ${this.results.total}`);
    log('SUCCESS', `Passed: ${this.results.passed}`);
    log('ERROR', `Failed: ${this.results.failed}`);
    log('INFO', `Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      process.exit(1);
    }
  }
}

// Create test suite
const testSuite = new APITestSuite();

// Health Check Test
testSuite.addTest('Health Check', async () => {
  const response = await makeRequest(`${config.apiBaseUrl}/health`);
  if (response.status !== 200) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  if (!response.data.status || response.data.status !== 'healthy') {
    throw new Error('Health check returned unhealthy status');
  }
});

// Sessions API Tests
testSuite.addTest('Get Sessions List', async () => {
  const response = await makeRequest(`${config.apiBaseUrl}/sessions`);
  if (response.status !== 200) {
    throw new Error(`Get sessions failed with status ${response.status}`);
  }
  if (!response.data.sessions || !Array.isArray(response.data.sessions)) {
    throw new Error('Sessions response does not contain sessions array');
  }
});

testSuite.addTest('Create Session', async () => {
  const sessionData = {
    initialTask: 'Test session creation',
    workDir: '/test/workspace'
  };
  
  const response = await makeRequest(`${config.apiBaseUrl}/sessions`, {
    method: 'POST',
    body: sessionData
  });
  
  if (response.status !== 200) {
    throw new Error(`Create session failed with status ${response.status}`);
  }
  if (!response.data.id) {
    throw new Error('Created session response does not contain id');
  }
  
  // Store session ID for later tests
  global.testSessionId = response.data.id;
});

testSuite.addTest('Get Single Session', async () => {
  if (!global.testSessionId) {
    throw new Error('No test session ID available from previous test');
  }
  
  const response = await makeRequest(`${config.apiBaseUrl}/sessions/${global.testSessionId}`);
  if (response.status !== 200) {
    throw new Error(`Get session failed with status ${response.status}`);
  }
  if (response.data.id !== global.testSessionId) {
    throw new Error('Session ID mismatch in response');
  }
});

// Analytics API Tests
testSuite.addTest('Get Analytics Dashboard', async () => {
  const response = await makeRequest(`${config.apiBaseUrl}/analytics/dashboard`);
  if (response.status !== 200) {
    throw new Error(`Analytics dashboard failed with status ${response.status}`);
  }
});

testSuite.addTest('Get Real-time Analytics', async () => {
  const response = await makeRequest(`${config.apiBaseUrl}/analytics/realtime`);
  if (response.status !== 200) {
    throw new Error(`Real-time analytics failed with status ${response.status}`);
  }
});

// WebSocket Connection Test
testSuite.addTest('WebSocket Connection', async () => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(config.wsUrl);
    let connected = false;
    
    const timeout = setTimeout(() => {
      if (!connected) {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }
    }, config.timeout);
    
    ws.on('open', () => {
      connected = true;
      clearTimeout(timeout);
      
      // Send ping message
      ws.send(JSON.stringify({ type: 'ping' }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'pong') {
          ws.close();
          resolve();
        }
      } catch (e) {
        // Ignore malformed messages
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${error.message}`));
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
      if (connected) {
        resolve();
      } else {
        reject(new Error('WebSocket connection closed before establishing'));
      }
    });
  });
});

// Monitoring Endpoint Test
testSuite.addTest('Monitoring Endpoint', async () => {
  const monitoringData = {
    agentType: 'manager',
    messageType: 'prompt',
    message: 'Test monitoring integration',
    sessionInfo: {
      task: 'API test task',
      workDir: '/test'
    }
  };
  
  const response = await makeRequest(`${config.apiBaseUrl}/monitoring`, {
    method: 'POST',
    body: monitoringData
  });
  
  if (response.status !== 200) {
    throw new Error(`Monitoring endpoint failed with status ${response.status}`);
  }
  if (!response.data.success) {
    throw new Error('Monitoring endpoint returned failure');
  }
});

// Error Handling Tests
testSuite.addTest('404 Error Handling', async () => {
  const response = await makeRequest(`${config.apiBaseUrl}/nonexistent-endpoint`);
  if (response.status !== 404) {
    throw new Error(`Expected 404 status, got ${response.status}`);
  }
});

testSuite.addTest('Invalid JSON Handling', async () => {
  const response = await makeRequest(`${config.apiBaseUrl}/sessions`, {
    method: 'POST',
    body: 'invalid json'
  });
  if (response.status < 400) {
    throw new Error(`Expected error status for invalid JSON, got ${response.status}`);
  }
});

// Rate Limiting Test (if nginx is configured)
testSuite.addTest('Rate Limiting (Optional)', async () => {
  try {
    // Send multiple rapid requests to test rate limiting
    const requests = Array(15).fill().map((_, i) => 
      makeRequest(`${config.apiBaseUrl}/health`)
    );
    
    const responses = await Promise.allSettled(requests);
    const rateLimited = responses.some(result => 
      result.status === 'fulfilled' && result.value.status === 429
    );
    
    // This test is optional - rate limiting might not be configured
    if (rateLimited) {
      log('INFO', 'Rate limiting is working properly');
    } else {
      log('INFO', 'Rate limiting not detected (may not be configured)');
    }
  } catch (error) {
    // Rate limiting test is non-critical
    log('WARNING', `Rate limiting test failed: ${error.message}`);
  }
});

// Run the test suite
if (require.main === module) {
  testSuite.runAll().catch(error => {
    log('ERROR', `Test suite failed: ${error.message}`);
    process.exit(1);
  });
}