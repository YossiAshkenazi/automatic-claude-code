import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

// Test configuration
export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% of requests must complete below 1.5s
    errors: ['rate<0.1'], // Error rate must be below 10%
    http_req_failed: ['rate<0.1'], // Failed requests must be below 10%
  },
};

// Base URL
const BASE_URL = 'http://localhost:8080';

// Test data
const credentials = {
  username: 'testuser',
  password: 'testpass123'
};

let authToken = '';

export function setup() {
  // Login to get auth token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(credentials), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const responseBody = JSON.parse(loginRes.body);
    return { authToken: responseBody.token };
  }

  console.error('Failed to authenticate during setup');
  return { authToken: '' };
}

export default function (data) {
  authToken = data.authToken;

  // Test scenarios
  testAuthentication();
  testSessionsAPI();
  testAnalyticsAPI();
  testWebSocketConnection();
  
  sleep(1);
}

function testAuthentication() {
  // Test login endpoint
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(credentials), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
    'login returns token': (r) => {
      const body = JSON.parse(r.body);
      return body.token !== undefined;
    },
  }) || errorRate.add(1);

  // Test token verification
  if (authToken) {
    const meRes = http.get(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });

    check(meRes, {
      'auth verification status is 200': (r) => r.status === 200,
      'auth verification response time < 200ms': (r) => r.timings.duration < 200,
    }) || errorRate.add(1);
  }
}

function testSessionsAPI() {
  if (!authToken) return;

  // Test sessions list
  const sessionsRes = http.get(`${BASE_URL}/api/sessions`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  check(sessionsRes, {
    'sessions list status is 200': (r) => r.status === 200,
    'sessions list response time < 1000ms': (r) => r.timings.duration < 1000,
    'sessions list returns array': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.sessions);
    },
  }) || errorRate.add(1);

  // Test specific session
  const sessionRes = http.get(`${BASE_URL}/api/sessions/test-session-1`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  check(sessionRes, {
    'session detail status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'session detail response time < 800ms': (r) => r.timings.duration < 800,
  }) || errorRate.add(1);
}

function testAnalyticsAPI() {
  if (!authToken) return;

  // Test performance metrics
  const metricsRes = http.get(`${BASE_URL}/api/analytics/performance`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  check(metricsRes, {
    'performance metrics status is 200': (r) => r.status === 200,
    'performance metrics response time < 1500ms': (r) => r.timings.duration < 1500,
    'performance metrics returns data': (r) => {
      const body = JSON.parse(r.body);
      return body.metrics !== undefined;
    },
  }) || errorRate.add(1);

  // Test agent comparison
  const comparisonRes = http.get(`${BASE_URL}/api/analytics/agent-comparison`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  check(comparisonRes, {
    'agent comparison status is 200': (r) => r.status === 200,
    'agent comparison response time < 1200ms': (r) => r.timings.duration < 1200,
    'agent comparison returns data': (r) => {
      const body = JSON.parse(r.body);
      return body.comparison !== undefined;
    },
  }) || errorRate.add(1);
}

function testWebSocketConnection() {
  // Simulate WebSocket upgrade request
  const wsRes = http.get(`${BASE_URL}/ws`, {
    headers: { 
      'Upgrade': 'websocket',
      'Connection': 'upgrade',
      'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
      'Sec-WebSocket-Version': '13'
    },
  });

  check(wsRes, {
    'websocket upgrade response': (r) => r.status === 101 || r.status === 426,
    'websocket response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);
}

export function teardown(data) {
  // Logout to clean up
  if (data.authToken) {
    const logoutRes = http.post(`${BASE_URL}/api/auth/logout`, '', {
      headers: { 'Authorization': `Bearer ${data.authToken}` },
    });
    
    console.log(`Logout status: ${logoutRes.status}`);
  }
}