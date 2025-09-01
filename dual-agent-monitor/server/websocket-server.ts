import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { InMemoryDatabaseService } from './database/InMemoryDatabaseService.js';
import { DatabaseInterface } from './database/DatabaseInterface.js';
import { AgentMessage, DualAgentSession, SystemEvent, WebSocketMessage } from './types.js';
import { AnalyticsService } from './analytics/AnalyticsService.js';
import { SessionReplayManager } from './replay/SessionReplayManager.js';
import { MLService } from './ml/MLService.js';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors({
  origin: ['http://localhost:6005', 'http://localhost:6011', 'http://localhost:6012', 'http://localhost:6013', 'http://localhost:6014', 'http://localhost:6015', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:4001'],
  credentials: true
}));
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize in-memory database service for testing
console.log('Using in-memory database for development/testing');
const dbService = new InMemoryDatabaseService() as DatabaseInterface;
const analyticsService = new AnalyticsService(dbService as any);
const replayManager = new SessionReplayManager(dbService as any);
const mlService = new MLService(dbService as any, {
  enableRealTimeAnalysis: true,
  insightGenerationInterval: 5 * 60 * 1000, // 5 minutes
  anomalyDetectionSensitivity: 'medium'
});
const clients = new Set<WebSocket>();

// Initialize services
analyticsService.initialize().catch(console.error);
// mlService.initialize().catch(console.error); // Temporarily disabled until ML issues are resolved

// Subscribe to real-time analytics updates
analyticsService.subscribeToRealTime((metrics) => {
  broadcast({
    type: 'analytics:realtime',
    data: metrics
  });
});

// Subscribe to ML service updates
// mlService.subscribe((update) => {
//   broadcast({
//     type: `ml:${update.event}`,
//     data: update.data,
//     timestamp: update.timestamp
//   });
// }); // Temporarily disabled

// In-memory storage for active sessions (will be replaced by database later)
let currentSession: DualAgentSession | null = null;

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  clients.add(ws);

  // Analytics subscription tracking for this connection
  let analyticsInterval: NodeJS.Timeout | null = null;
  let analyticsUnsubscribe: (() => void) | null = null;

  // Send current session data if available
  if (currentSession) {
    ws.send(JSON.stringify({
      type: 'session:current',
      data: currentSession
    }));
  }

  // Send all sessions from database
  dbService.getAllSessions().then(sessions => {
    ws.send(JSON.stringify({
      type: 'sessions:list',
      data: sessions
    }));
  }).catch(error => {
    console.error('Error fetching sessions:', error);
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data.type);

      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'analytics:subscribe':
          // Client wants to subscribe to specific analytics data
          const { sessionIds, includeRealTime, refreshInterval } = data;
          
          // Clear existing subscription
          if (analyticsInterval) {
            clearInterval(analyticsInterval);
          }
          if (analyticsUnsubscribe) {
            analyticsUnsubscribe();
          }

          // Subscribe to real-time metrics
          analyticsUnsubscribe = analyticsService.subscribeToRealTime((metrics) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'analytics:realtime',
                data: metrics
              }));
            }
          });
          
          // Set up periodic dashboard updates
          analyticsInterval = setInterval(async () => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                const dashboardData = await analyticsService.getDashboardData({
                  sessionIds,
                  includeRealTime: includeRealTime || false
                });
                
                ws.send(JSON.stringify({
                  type: 'analytics:dashboard',
                  data: dashboardData
                }));
              } catch (error) {
                console.error('Error sending analytics update:', error);
              }
            } else {
              clearInterval(analyticsInterval!);
            }
          }, refreshInterval || 5000);

          // Send initial data
          try {
            const initialData = await analyticsService.getDashboardData({
              sessionIds,
              includeRealTime: includeRealTime || false
            });
            
            ws.send(JSON.stringify({
              type: 'analytics:dashboard',
              data: initialData
            }));
          } catch (error) {
            console.error('Error sending initial analytics data:', error);
          }
          break;

        case 'analytics:trends:subscribe':
          // Subscribe to performance trends
          const { sessionIds: trendSessionIds, timeRange, granularity } = data;
          
          if (trendSessionIds && timeRange) {
            try {
              const trends = await analyticsService.getPerformanceTrends(
                trendSessionIds,
                {
                  start: new Date(timeRange.start),
                  end: new Date(timeRange.end)
                },
                granularity || 'hour'
              );
              
              ws.send(JSON.stringify({
                type: 'analytics:trends',
                data: trends
              }));
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to get performance trends'
              }));
            }
          }
          break;

        case 'analytics:unsubscribe':
          // Clean up analytics subscriptions
          if (analyticsInterval) {
            clearInterval(analyticsInterval);
            analyticsInterval = null;
          }
          if (analyticsUnsubscribe) {
            analyticsUnsubscribe();
            analyticsUnsubscribe = null;
          }
          break;

        case 'agents:start':
          try {
            // Create new session in database
            const sessionId = await dbService.createSession({
              startTime: new Date(),
              status: 'running',
              initialTask: data.task || 'Agent task',
              workDir: process.cwd()
            });
            
            currentSession = await dbService.getSession(sessionId);
            
            broadcast({
              type: 'agents:started',
              data: {
                sessionId: sessionId,
                task: data.task
              }
            });
          } catch (error: any) {
            ws.send(JSON.stringify({
              type: 'error',
              message: error.message
            }));
          }
          break;

        case 'agents:stop':
          if (currentSession) {
            await dbService.updateSessionStatus(currentSession.id, 'completed', new Date());
            currentSession = await dbService.getSession(currentSession.id);
            
            broadcast({
              type: 'agents:stopped',
              data: {
                sessionId: currentSession?.id
              }
            });
          }
          break;

        case 'session:get':
          try {
            const session = await dbService.getSession(data.sessionId);
            ws.send(JSON.stringify({
              type: 'session:data',
              data: session
            }));
          } catch (error) {
            console.error('Error fetching session:', error);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to fetch session'
            }));
          }
          break;

        case 'sessions:list':
          try {
            const sessions = await dbService.getAllSessions();
            ws.send(JSON.stringify({
              type: 'sessions:list',
              data: sessions
            }));
          } catch (error) {
            console.error('Error fetching sessions:', error);
          }
          break;

        case 'message:send':
          // Add message to database
          if (currentSession) {
            try {
              const agentMessage: AgentMessage = {
                id: uuidv4(),
                sessionId: currentSession.id,
                agentType: data.agent === 'manager' ? 'manager' : 'worker',
                messageType: 'prompt',
                content: data.message,
                timestamp: new Date()
              };
              
              await dbService.addMessage(agentMessage);
              
              // Collect analytics metrics
              await analyticsService.collectMetricsFromMessage(agentMessage, currentSession);
              
              broadcast({
                type: 'agent:message',
                data: agentMessage
              });
            } catch (error) {
              console.error('Error adding message:', error);
            }
          }
          break;

        case 'session:export':
          try {
            const session = await dbService.getSession(data.sessionId);
            ws.send(JSON.stringify({
              type: 'session:export',
              data: session
            }));
          } catch (error) {
            console.error('Error exporting session:', error);
          }
          break;


        case 'analytics:compare':
          try {
            const { sessionIds } = data;
            const comparison = await analyticsService.compareSessionPerformance(sessionIds);
            
            ws.send(JSON.stringify({
              type: 'analytics:comparison',
              data: comparison
            }));
          } catch (error) {
            console.error('Error comparing sessions:', error);
            ws.send(JSON.stringify({
              type: 'error', 
              message: 'Failed to compare sessions'
            }));
          }
          break;

        case 'send_message':
          // Handle messages from automatic-claude-code dual-agent system
          try {
            // Create or update current session if needed
            if (!currentSession && data.sessionInfo) {
              const sessionId = await dbService.createSession({
                startTime: new Date(),
                status: 'running',
                initialTask: data.sessionInfo.task || 'Dual-agent task',
                workDir: data.sessionInfo.workDir || process.cwd()
              });
              currentSession = await dbService.getSession(sessionId);
            }

            if (currentSession && data.message && data.agent) {
              const agentMessage: AgentMessage = {
                id: uuidv4(),
                sessionId: currentSession.id,
                agentType: data.agent === 'manager' ? 'manager' : 'worker',
                messageType: data.messageType || 'prompt',
                content: data.message,
                timestamp: new Date(),
                metadata: data.metadata
              };
              
              await dbService.addMessage(agentMessage);
              
              // Collect analytics metrics
              await analyticsService.collectMetricsFromMessage(agentMessage, currentSession);
              
              broadcast({
                type: 'agent:message',
                data: agentMessage
              });
            }
          } catch (error) {
            console.error('Error handling send_message:', error);
          }
          break;

        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
    
    // Clean up analytics subscriptions
    if (analyticsInterval) {
      clearInterval(analyticsInterval);
    }
    if (analyticsUnsubscribe) {
      analyticsUnsubscribe();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
    
    // Clean up analytics subscriptions on error
    if (analyticsInterval) {
      clearInterval(analyticsInterval);
    }
    if (analyticsUnsubscribe) {
      analyticsUnsubscribe();
    }
  });
});

// Broadcast to all connected clients
function broadcast(message: any) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// REST API endpoints for non-WebSocket clients
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = dbService.getHealthCheck ? await dbService.getHealthCheck() : { healthy: true, message: 'Health check not implemented' };
    
    res.json({
      status: 'healthy',
      database: dbHealth,
      agents: {
        running: currentSession?.status === 'running',
        sessionId: currentSession?.id
      },
      websocket: {
        clients: clients.size
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      database: { healthy: false, message: 'Database health check failed' },
      agents: {
        running: false,
        sessionId: null
      },
      websocket: {
        clients: clients.size
      }
    });
  }
});

// Monitoring data endpoint for automatic-claude-code integration
app.post('/api/monitoring', async (req, res) => {
  try {
    const data = req.body;
    
    // Handle dual-agent monitoring data
    if (data.agentType && data.message) {
      // Create or update current session if needed
      if (!currentSession && data.sessionInfo) {
        const sessionId = await dbService.createSession({
          startTime: new Date(),
          status: 'running',
          initialTask: data.sessionInfo.task || 'Dual-agent task',
          workDir: data.sessionInfo.workDir || process.cwd()
        });
        currentSession = await dbService.getSession(sessionId);
      }

      if (currentSession) {
        const agentMessage: AgentMessage = {
          id: uuidv4(),
          sessionId: currentSession.id,
          agentType: data.agentType,
          messageType: data.messageType || 'prompt',
          content: data.message,
          timestamp: new Date(),
          metadata: data.metadata
        };
        
        await dbService.addMessage(agentMessage);
        
        // Collect analytics metrics
        await analyticsService.collectMetricsFromMessage(agentMessage, currentSession);
        
        // Broadcast to connected clients
        broadcast({
          type: 'agent_message',
          data: agentMessage
        });
      }
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error processing monitoring data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await dbService.getAllSessions();
    
    // Parse query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const sortBy = req.query.sortBy as string || 'startTime';
    const sortOrder = req.query.sortOrder as string || 'desc';
    
    // Apply sorting
    let sortedSessions = [...sessions];
    sortedSessions.sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case 'lastActivity':
          aValue = a.endTime || a.startTime;
          bValue = b.endTime || b.startTime;
          break;
        case 'messageCount':
          aValue = a.messages?.length || 0;
          bValue = b.messages?.length || 0;
          break;
        default: // startTime
          aValue = a.startTime;
          bValue = b.startTime;
      }
      
      if (sortOrder === 'desc') {
        return new Date(bValue).getTime() - new Date(aValue).getTime();
      } else {
        return new Date(aValue).getTime() - new Date(bValue).getTime();
      }
    });
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSessions = sortedSessions.slice(startIndex, endIndex);
    
    // Return paginated response structure expected by UI
    res.json({
      sessions: paginatedSessions,
      total: sessions.length,
      page: page,
      limit: limit
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await dbService.getSession(req.params.id);
    if (session) {
      res.json(session);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { initialTask, workDir } = req.body;
    
    if (!initialTask?.trim()) {
      return res.status(400).json({ error: 'Initial task is required' });
    }
    
    // Create new session in database
    const sessionId = await dbService.createSession({
      startTime: new Date(),
      status: 'running',
      initialTask: initialTask,
      workDir: workDir || process.cwd()
    });
    
    const session = await dbService.getSession(sessionId);
    if (session) {
      currentSession = session;
      
      // Broadcast session creation to all WebSocket clients
      broadcast({
        type: 'session:current',
        data: session
      });
      
      const allSessions = await dbService.getAllSessions();
      broadcast({
        type: 'sessions:list',
        data: allSessions
      });
      
      res.json({
        id: session.id,
        initialTask: session.initialTask,
        workDir: session.workDir,
        startTime: session.startTime,
        status: session.status,
        messages: session.messages
      });
    } else {
      res.status(500).json({ error: 'Failed to create session' });
    }
  } catch (error: any) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message || 'Failed to create session' });
  }
});

app.post('/api/agents/start', async (req, res) => {
  try {
    const sessionId = await dbService.createSession({
      startTime: new Date(),
      status: 'running',
      initialTask: req.body.task || 'Agent task',
      workDir: process.cwd()
    });
    
    currentSession = await dbService.getSession(sessionId);
    
    res.json({
      success: true,
      sessionId: sessionId
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/agents/stop', async (req, res) => {
  try {
    if (currentSession) {
      await dbService.updateSessionStatus(currentSession.id, 'completed', new Date());
      currentSession = await dbService.getSession(currentSession.id);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sessions/:id/export', async (req, res) => {
  try {
    const session = await dbService.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get additional data for export
    const communications = await dbService.getSessionCommunications(req.params.id);
    const events = await dbService.getSessionEvents(req.params.id);
    const metrics = await dbService.getSessionMetrics(req.params.id);
    
    const exportData = {
      session,
      communications,
      events,
      metrics
    };
    
    res.header('Content-Type', 'application/json');
    res.header('Content-Disposition', `attachment; filename="session_${req.params.id}.json"`);
    res.json(exportData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Message API endpoint
app.post('/api/sessions/:id/messages', async (req, res) => {
  try {
    const { agentType, messageType, content, metadata } = req.body;
    
    const message: AgentMessage = {
      id: uuidv4(),
      sessionId: req.params.id,
      agentType,
      messageType,
      content,
      timestamp: new Date(),
      metadata
    };
    
    await dbService.addMessage(message);
    
    // Collect analytics metrics
    const session = await dbService.getSession(req.params.id);
    if (session) {
      await analyticsService.collectMetricsFromMessage(message, session);
    }
    
    // Broadcast to WebSocket clients
    broadcast({
      type: 'agent:message',
      data: message
    });
    
    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics API endpoints
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const { sessionIds, timeRange, includeRealTime } = req.query;
    
    const query: any = {
      includeRealTime: includeRealTime === 'true'
    };
    
    if (sessionIds) {
      query.sessionIds = Array.isArray(sessionIds) ? sessionIds : [sessionIds];
    }
    
    if (timeRange) {
      const range = JSON.parse(timeRange as string);
      query.timeRange = {
        start: new Date(range.start),
        end: new Date(range.end)
      };
    }
    
    const dashboardData = await analyticsService.getDashboardData(query);
    res.json(dashboardData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/performance/:sessionId', async (req, res) => {
  try {
    const analytics = await analyticsService.analyzeSession(req.params.sessionId);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analytics/comparison', async (req, res) => {
  try {
    const { sessionIds } = req.body;
    
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ error: 'sessionIds array is required' });
    }
    
    const comparison = await analyticsService.compareSessionPerformance(sessionIds);
    res.json(comparison);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/trends', async (req, res) => {
  try {
    const { sessionIds, timeRange, granularity } = req.query;
    
    if (!sessionIds) {
      return res.status(400).json({ error: 'sessionIds parameter is required' });
    }
    
    if (!timeRange) {
      return res.status(400).json({ error: 'timeRange parameter is required' });
    }
    
    const ids = Array.isArray(sessionIds) ? sessionIds : [sessionIds];
    const range = JSON.parse(timeRange as string);
    
    const trends = await analyticsService.getPerformanceTrends(
      ids as string[],
      {
        start: new Date(range.start),
        end: new Date(range.end)
      },
      (granularity as 'minute' | 'hour' | 'day') || 'hour'
    );
    
    res.json(trends);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/realtime', async (req, res) => {
  try {
    const metrics = analyticsService.getRealTimeMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analytics/export', async (req, res) => {
  try {
    const { format, query } = req.body;
    
    if (!format || !['json', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'format must be json or csv' });
    }
    
    const data = await analyticsService.exportAnalytics(format, query || {});
    
    if (format === 'csv') {
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', 'attachment; filename="analytics.csv"');
      res.send(data);
    } else {
      res.json(data);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analytics/report', async (req, res) => {
  try {
    const { sessionIds, reportType } = req.body;
    
    if (!Array.isArray(sessionIds)) {
      return res.status(400).json({ error: 'sessionIds array is required' });
    }
    
    const report = await analyticsService.generateReport(
      sessionIds,
      reportType || 'summary'
    );
    
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Enhanced analytics endpoints
app.get('/api/analytics/metrics/aggregated', async (req, res) => {
  try {
    const { timeWindow, sessionIds } = req.query;
    
    if (!timeWindow || !['hour', 'day', 'week'].includes(timeWindow as string)) {
      return res.status(400).json({ error: 'timeWindow must be hour, day, or week' });
    }

    const ids = sessionIds ? (Array.isArray(sessionIds) ? sessionIds : [sessionIds]) : undefined;
    const aggregated = await dbService.getAggregatedMetrics(
      timeWindow as 'hour' | 'day' | 'week',
      ids as string[]
    );
    
    res.json(aggregated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/sessions/top', async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 10;
    
    const topSessions = await dbService.getTopPerformingSessions(limitNum);
    res.json(topSessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/costs', async (req, res) => {
  try {
    const { timeRange, sessionIds } = req.query;
    
    let range: { start: Date; end: Date } | undefined;
    if (timeRange) {
      const parsed = JSON.parse(timeRange as string);
      range = {
        start: new Date(parsed.start),
        end: new Date(parsed.end)
      };
    }

    const ids = sessionIds ? (Array.isArray(sessionIds) ? sessionIds : [sessionIds]) : undefined;
    const costAnalytics = await dbService.getCostAnalytics(range, ids as string[]);
    
    res.json(costAnalytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/errors', async (req, res) => {
  try {
    const { sessionIds } = req.query;
    
    const ids = sessionIds ? (Array.isArray(sessionIds) ? sessionIds : [sessionIds]) : undefined;
    const errorAnalytics = await dbService.getErrorAnalytics(ids as string[]);
    
    res.json(errorAnalytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/metrics/timerange', async (req, res) => {
  try {
    const { timeRange, sessionIds } = req.query;
    
    if (!timeRange) {
      return res.status(400).json({ error: 'timeRange parameter is required' });
    }

    const range = JSON.parse(timeRange as string);
    const timeRangeObj = {
      start: new Date(range.start),
      end: new Date(range.end)
    };

    const ids = sessionIds ? (Array.isArray(sessionIds) ? sessionIds : [sessionIds]) : undefined;
    const metrics = await dbService.getMetricsInTimeRange(timeRangeObj, ids as string[]);
    
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analytics/metrics', async (req, res) => {
  try {
    const metric = req.body;
    
    if (!metric.sessionId || !metric.agentType || typeof metric.responseTime !== 'number') {
      return res.status(400).json({ error: 'sessionId, agentType, and responseTime are required' });
    }

    await dbService.addPerformanceMetric({
      ...metric,
      timestamp: new Date(metric.timestamp || Date.now())
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ML Service API Endpoints

// ML Insights
app.get('/api/ml/insights', async (req, res) => {
  try {
    const { type, severity, minConfidence } = req.query;
    
    const filters: any = {};
    if (type) filters.type = type as string;
    if (severity) filters.severity = severity as string;
    if (minConfidence) filters.minConfidence = parseFloat(minConfidence as string);
    
    const insights = mlService.getInsights(filters);
    const patterns = await mlService.insightsEngine.analyzeCollaborationPatterns(
      await dbService.getAllSessions(),
      []
    );
    const clusters = await mlService.insightsEngine.performanceClusterAnalysis(
      await dbService.getAllSessions(),
      []
    );
    
    res.json({
      insights,
      patterns,
      clusters
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ML Recommendations
app.get('/api/ml/recommendations', async (req, res) => {
  try {
    const { category, priority, minImpact } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category as string;
    if (priority) filters.priority = priority as string;
    if (minImpact) filters.minImpact = parseFloat(minImpact as string);
    
    const recommendations = mlService.getRecommendations(filters);
    
    res.json({ recommendations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Optimization Strategies
app.get('/api/ml/strategies', async (req, res) => {
  try {
    const strategies = mlService.getOptimizationStrategies();
    res.json({ strategies });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resource Optimization
app.get('/api/ml/resource-optimization', async (req, res) => {
  try {
    const resourceOptimization = mlService.getResourceOptimization();
    res.json({ resourceOptimization });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Predictive Analytics
app.get('/api/ml/forecast', async (req, res) => {
  try {
    const { days } = req.query;
    const forecastDays = days ? parseInt(days as string) : 30;
    
    const forecast = await mlService.getResourceForecast(forecastDays);
    res.json({ forecast });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ml/trends', async (req, res) => {
  try {
    const trends = mlService.getTrends();
    res.json({ trends });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ml/predict-session', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    
    const session = await dbService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const analysis = await mlService.analyzeSession(session, false);
    res.json(analysis);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Anomaly Detection
app.get('/api/ml/anomalies', async (req, res) => {
  try {
    const { type, severity, sessionId, since, limit } = req.query;
    
    const filters: any = {};
    if (type) filters.type = type as string;
    if (severity) filters.severity = severity as string;
    if (sessionId) filters.sessionId = sessionId as string;
    if (since) filters.since = new Date(since as string);
    
    const anomalies = mlService.getAnomalies(filters);
    const limitedAnomalies = limit ? 
      anomalies.slice(0, parseInt(limit as string)) : 
      anomalies;
    
    res.json({ anomalies: limitedAnomalies });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ml/anomaly-patterns', async (req, res) => {
  try {
    const patterns = mlService.getAnomalyPatterns();
    res.json({ patterns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ml/anomaly-insights', async (req, res) => {
  try {
    const insights = mlService.getAnomalyInsights();
    res.json({ insights });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Prediction Models
app.get('/api/ml/models', async (req, res) => {
  try {
    const models = mlService.getPredictionModels();
    res.json({ models });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ml/models/retrain', async (req, res) => {
  try {
    await mlService.retrainModels();
    res.json({ success: true, message: 'Models retrained successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ML Service Management
app.get('/api/ml/status', async (req, res) => {
  try {
    const status = mlService.getStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ml/analyze', async (req, res) => {
  try {
    await mlService.performFullAnalysis();
    res.json({ 
      success: true, 
      message: 'Full ML analysis completed',
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ml/config', async (req, res) => {
  try {
    const config = req.body;
    mlService.updateConfig(config);
    res.json({ 
      success: true, 
      message: 'ML service configuration updated',
      config: mlService.getStatus()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/ml/cache', async (req, res) => {
  try {
    mlService.clearCache();
    res.json({ 
      success: true, 
      message: 'ML cache cleared' 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Session Replay API Endpoints
app.post('/api/replay/sessions/:id/prepare', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const options = req.body || {};
    
    const replayId = await replayManager.prepareSessionForReplay(sessionId, options);
    const replaySession = replayManager.getReplaySession(replayId);
    
    if (!replaySession) {
      return res.status(500).json({ error: 'Failed to create replay session' });
    }
    
    const state = replaySession.stateManager.getState();
    const metadata = replaySession.metadata;
    
    res.json({
      replayId,
      state,
      metadata,
      success: true
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/replay/:replayId', async (req, res) => {
  try {
    await replayManager.closeReplaySession(req.params.replayId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/play', async (req, res) => {
  try {
    const replaySession = replayManager.getReplaySession(req.params.replayId);
    if (!replaySession) {
      return res.status(404).json({ error: 'Replay session not found' });
    }
    
    const options = req.body || {};
    replaySession.controls.play(options);
    
    // Broadcast state update to WebSocket clients
    broadcast({
      type: 'replay:state_update',
      data: {
        replayId: req.params.replayId,
        state: replaySession.stateManager.getState()
      }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/pause', async (req, res) => {
  try {
    const replaySession = replayManager.getReplaySession(req.params.replayId);
    if (!replaySession) {
      return res.status(404).json({ error: 'Replay session not found' });
    }
    
    replaySession.controls.pause();
    
    // Broadcast state update to WebSocket clients
    broadcast({
      type: 'replay:state_update',
      data: {
        replayId: req.params.replayId,
        state: replaySession.stateManager.getState()
      }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/stop', async (req, res) => {
  try {
    const replaySession = replayManager.getReplaySession(req.params.replayId);
    if (!replaySession) {
      return res.status(404).json({ error: 'Replay session not found' });
    }
    
    replaySession.controls.stop();
    
    // Broadcast state update to WebSocket clients
    broadcast({
      type: 'replay:state_update',
      data: {
        replayId: req.params.replayId,
        state: replaySession.stateManager.getState()
      }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/step', async (req, res) => {
  try {
    const replaySession = replayManager.getReplaySession(req.params.replayId);
    if (!replaySession) {
      return res.status(404).json({ error: 'Replay session not found' });
    }
    
    const { direction, options } = req.body;
    
    if (direction === 'forward') {
      replaySession.controls.stepForward(options);
    } else if (direction === 'backward') {
      replaySession.controls.stepBackward(options);
    } else {
      return res.status(400).json({ error: 'direction must be "forward" or "backward"' });
    }
    
    // Broadcast state update to WebSocket clients
    broadcast({
      type: 'replay:state_update',
      data: {
        replayId: req.params.replayId,
        state: replaySession.stateManager.getState()
      }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/seek', async (req, res) => {
  try {
    const replaySession = replayManager.getReplaySession(req.params.replayId);
    if (!replaySession) {
      return res.status(404).json({ error: 'Replay session not found' });
    }
    
    const { position } = req.body;
    if (typeof position !== 'number') {
      return res.status(400).json({ error: 'position must be a number' });
    }
    
    replaySession.stateManager.setCurrentIndex(position);
    
    // Broadcast state update to WebSocket clients
    broadcast({
      type: 'replay:state_update',
      data: {
        replayId: req.params.replayId,
        state: replaySession.stateManager.getState()
      }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/speed', async (req, res) => {
  try {
    const replaySession = replayManager.getReplaySession(req.params.replayId);
    if (!replaySession) {
      return res.status(404).json({ error: 'Replay session not found' });
    }
    
    const { speed } = req.body;
    if (typeof speed !== 'number') {
      return res.status(400).json({ error: 'speed must be a number' });
    }
    
    replaySession.controls.setSpeed(speed);
    
    // Broadcast state update to WebSocket clients
    broadcast({
      type: 'replay:state_update',
      data: {
        replayId: req.params.replayId,
        state: replaySession.stateManager.getState()
      }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/jump', async (req, res) => {
  try {
    const replaySession = replayManager.getReplaySession(req.params.replayId);
    if (!replaySession) {
      return res.status(404).json({ error: 'Replay session not found' });
    }
    
    const { type, value } = req.body;
    if (!type || value === undefined) {
      return res.status(400).json({ error: 'type and value are required' });
    }
    
    replaySession.controls.jumpTo({ type, value });
    
    // Broadcast state update to WebSocket clients
    broadcast({
      type: 'replay:state_update',
      data: {
        replayId: req.params.replayId,
        state: replaySession.stateManager.getState()
      }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bookmark management
app.post('/api/replay/:replayId/bookmarks', async (req, res) => {
  try {
    const bookmark = await replayManager.addBookmark(req.params.replayId, req.body);
    
    // Broadcast bookmark added to WebSocket clients
    broadcast({
      type: 'replay:bookmark_added',
      data: {
        replayId: req.params.replayId,
        bookmark
      }
    });
    
    res.json(bookmark);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/replay/:replayId/bookmarks/:bookmarkId', async (req, res) => {
  try {
    await replayManager.updateBookmark(req.params.replayId, req.params.bookmarkId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/replay/:replayId/bookmarks/:bookmarkId', async (req, res) => {
  try {
    await replayManager.removeBookmark(req.params.replayId, req.params.bookmarkId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Annotation management
app.post('/api/replay/:replayId/annotations', async (req, res) => {
  try {
    const annotation = await replayManager.addAnnotation(req.params.replayId, req.body);
    
    // Broadcast annotation added to WebSocket clients
    broadcast({
      type: 'replay:annotation_added',
      data: {
        replayId: req.params.replayId,
        annotation
      }
    });
    
    res.json(annotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/replay/:replayId/annotations/:annotationId', async (req, res) => {
  try {
    await replayManager.updateAnnotation(req.params.replayId, req.params.annotationId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/replay/:replayId/annotations/:annotationId', async (req, res) => {
  try {
    await replayManager.removeAnnotation(req.params.replayId, req.params.annotationId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Segment management
app.post('/api/replay/:replayId/segments', async (req, res) => {
  try {
    const segment = await replayManager.addSegment(req.params.replayId, req.body);
    res.json(segment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export functionality
app.post('/api/replay/:replayId/export', async (req, res) => {
  try {
    const { format, includeBookmarks, includeAnnotations, includeSegments, timeRange, eventTypes } = req.body;
    
    const data = await replayManager.exportReplayData(req.params.replayId, {
      format: format || 'json',
      includeBookmarks: includeBookmarks !== false,
      includeAnnotations: includeAnnotations !== false,
      includeSegments: includeSegments !== false,
      timeRange,
      eventTypes
    });
    
    if (format === 'csv') {
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="replay-${req.params.replayId}.csv"`);
    } else if (format === 'markdown') {
      res.header('Content-Type', 'text/markdown');
      res.header('Content-Disposition', `attachment; filename="replay-${req.params.replayId}.md"`);
    } else {
      res.header('Content-Type', 'application/json');
      res.header('Content-Disposition', `attachment; filename="replay-${req.params.replayId}.json"`);
    }
    
    res.send(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/segments/:segmentId/export', async (req, res) => {
  try {
    const { format } = req.body;
    
    const data = await replayManager.exportSegment(
      req.params.replayId, 
      req.params.segmentId,
      {
        format: format || 'json',
        includeBookmarks: true,
        includeAnnotations: true,
        includeSegments: true
      }
    );
    
    if (format === 'csv') {
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="segment-${req.params.segmentId}.csv"`);
    } else if (format === 'markdown') {
      res.header('Content-Type', 'text/markdown');
      res.header('Content-Disposition', `attachment; filename="segment-${req.params.segmentId}.md"`);
    } else {
      res.header('Content-Type', 'application/json');
      res.header('Content-Disposition', `attachment; filename="segment-${req.params.segmentId}.json"`);
    }
    
    res.send(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Multi-session comparison
app.post('/api/replay/compare', async (req, res) => {
  try {
    const { sessionIds } = req.body;
    
    if (!Array.isArray(sessionIds) || sessionIds.length < 2) {
      return res.status(400).json({ error: 'sessionIds array with at least 2 sessions is required' });
    }
    
    const comparisonData = await replayManager.compareSessionsForReplay(sessionIds);
    res.json(comparisonData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Collaborative features
app.get('/api/replay/:replayId/collaborators', async (req, res) => {
  try {
    const sessionInfo = replayManager.getSessionInfo(req.params.replayId);
    if (!sessionInfo) {
      return res.status(404).json({ error: 'Replay session not found' });
    }
    
    const replaySession = replayManager.getReplaySession(req.params.replayId);
    res.json({
      collaborators: replaySession?.collaborators || [],
      isCollaborative: replaySession?.isCollaborative || false
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/collaborators', async (req, res) => {
  try {
    const { collaborators } = req.body;
    
    if (!Array.isArray(collaborators)) {
      return res.status(400).json({ error: 'collaborators array is required' });
    }
    
    await replayManager.enableCollaborativeMode(req.params.replayId, collaborators);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replay/:replayId/collaborators/:collaboratorId', async (req, res) => {
  try {
    await replayManager.addCollaborator(req.params.replayId, req.params.collaboratorId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Replay status and management
app.get('/api/replay/status', async (req, res) => {
  try {
    res.json({
      activeSessionsCount: replayManager.getActiveSessionsCount(),
      activeSessionIds: replayManager.getActiveSessionIds()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// Enhanced port configuration with proper environment variable handling
const DEFAULT_PORT = 4001;
const PORT = parseInt(process.env.WEBSOCKET_SERVER_PORT || process.env.PORT || DEFAULT_PORT.toString(), 10);

server.listen(PORT, async () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
  console.log(`REST API available at http://localhost:${PORT}/api`);
  
  try {
    if (dbService.getHealthCheck) {
      const dbHealth = await dbService.getHealthCheck();
      console.log(`Database health: ${dbHealth.healthy ? 'healthy' : 'unhealthy'}`);
      if (dbHealth.details) {
        console.log(`Database details:`, dbHealth.details);
      }
    } else {
      console.log('Database health check not implemented');
    }
  } catch (error) {
    console.error('Error checking database health:', error);
  }
});

// Cleanup background tasks
setInterval(async () => {
  try {
    await replayManager.cleanup();
  } catch (error) {
    console.error('Error during replay cleanup:', error);
  }
}, 60 * 60 * 1000); // Every hour

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down WebSocket server...');
  await analyticsService.shutdown();
  // await mlService.shutdown();
  await replayManager.cleanup();
  dbService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down WebSocket server...');
  await analyticsService.shutdown();
  // await mlService.shutdown();
  await replayManager.cleanup();
  dbService.close();
  process.exit(0);
});