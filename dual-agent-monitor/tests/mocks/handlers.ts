import { http, HttpResponse } from 'msw';

export const handlers = [
  // Authentication endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.username === 'admin' && body.password === 'admin') {
      return HttpResponse.json({
        success: true,
        user: {
          id: '1',
          username: 'admin',
          role: 'admin',
          permissions: ['read', 'write', 'admin']
        },
        token: 'mock-jwt-token'
      });
    }
    
    return HttpResponse.json(
      { success: false, message: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/auth/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader === 'Bearer mock-jwt-token') {
      return HttpResponse.json({
        user: {
          id: '1',
          username: 'admin',
          role: 'admin',
          permissions: ['read', 'write', 'admin']
        }
      });
    }
    
    return HttpResponse.json(
      { message: 'Unauthorized' },
      { status: 401 }
    );
  }),

  // Session endpoints
  http.get('/api/sessions', () => {
    return HttpResponse.json({
      sessions: [
        {
          id: 'session-1',
          name: 'Test Session 1',
          status: 'completed',
          createdAt: new Date().toISOString(),
          duration: 120000,
          messageCount: 25
        },
        {
          id: 'session-2',
          name: 'Test Session 2',
          status: 'active',
          createdAt: new Date().toISOString(),
          duration: 60000,
          messageCount: 12
        }
      ]
    });
  }),

  http.get('/api/sessions/:id', ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      id,
      name: `Test Session ${id}`,
      status: 'completed',
      createdAt: new Date().toISOString(),
      duration: 120000,
      messageCount: 25,
      messages: [
        {
          id: 'msg-1',
          agent: 'manager',
          content: 'Analyzing the task...',
          timestamp: new Date().toISOString(),
          type: 'analysis'
        },
        {
          id: 'msg-2',
          agent: 'worker',
          content: 'Implementing the solution...',
          timestamp: new Date().toISOString(),
          type: 'implementation'
        }
      ]
    });
  }),

  // Analytics endpoints
  http.get('/api/analytics/performance', () => {
    return HttpResponse.json({
      metrics: {
        averageResponseTime: 1500,
        successRate: 0.95,
        totalSessions: 150,
        activeAgents: 2
      },
      trends: {
        responseTime: [1200, 1300, 1500, 1400, 1600],
        successRate: [0.92, 0.94, 0.95, 0.93, 0.96]
      }
    });
  }),

  http.get('/api/analytics/agent-comparison', () => {
    return HttpResponse.json({
      comparison: {
        manager: {
          averageResponseTime: 2000,
          successRate: 0.92,
          tasksCompleted: 45
        },
        worker: {
          averageResponseTime: 1200,
          successRate: 0.97,
          tasksCompleted: 68
        }
      }
    });
  }),

  // WebSocket endpoint (for HTTP upgrade)
  http.get('/ws', () => {
    return new HttpResponse(null, { status: 101 });
  })
];