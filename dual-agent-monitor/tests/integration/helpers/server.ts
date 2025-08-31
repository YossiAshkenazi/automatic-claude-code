import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { DatabaseService } from '../../../server/database/DatabaseService';
import { AuthManager } from '../../../server/auth/AuthManager';
import { AnalyticsService } from '../../../server/analytics/AnalyticsService';

export function createServer(databaseService: DatabaseService): express.Application {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Services
  const authManager = new AuthManager();
  const analyticsService = new AnalyticsService();

  // Auth middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    try {
      const verification = await authManager.verifyToken(token);
      if (!verification.valid) {
        return res.status(403).json({ message: 'Invalid token' });
      }
      req.user = verification.user;
      next();
    } catch (error) {
      return res.status(403).json({ message: 'Invalid token' });
    }
  };

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password required'
        });
      }

      const result = await authManager.authenticateUser(username, password);

      if (result.success) {
        res.json(result);
      } else {
        res.status(401).json(result);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  });

  app.post('/api/auth/logout', authenticateToken, (req, res) => {
    res.json({ success: true });
  });

  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    res.json({ user: req.user });
  });

  // Session routes
  app.get('/api/sessions', authenticateToken, async (req, res) => {
    try {
      const sessions = await databaseService.query('SELECT * FROM sessions ORDER BY created_at DESC', []);
      res.json({ sessions });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  app.get('/api/sessions/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const sessions = await databaseService.query('SELECT * FROM sessions WHERE id = ?', [id]);
      
      if (sessions.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json(sessions[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });

  // Analytics routes
  app.get('/api/analytics/performance', authenticateToken, async (req, res) => {
    try {
      const metrics = {
        averageResponseTime: 1500,
        successRate: 0.95,
        totalSessions: 150,
        activeAgents: 2
      };
      
      const trends = {
        responseTime: [1200, 1300, 1500, 1400, 1600],
        successRate: [0.92, 0.94, 0.95, 0.93, 0.96]
      };

      res.json({ metrics, trends });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch performance metrics' });
    }
  });

  app.get('/api/analytics/agent-comparison', authenticateToken, async (req, res) => {
    try {
      const comparison = {
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
      };

      res.json({ comparison });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch agent comparison' });
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Error handling
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  return app;
}