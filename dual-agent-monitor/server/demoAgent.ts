import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { DualAgentMockDataGenerator } from './database/mockData.js';
import { AgentMessage, SystemEvent, WebSocketMessage } from './types.js';

/**
 * Demo Agent for Dual-Agent Monitoring System
 * 
 * This agent creates realistic dual-agent conversations in real-time
 * to showcase the monitoring dashboard capabilities.
 */
export class DemoAgent {
  private wsClients: Set<WebSocket> = new Set();
  private demoSessions: Map<string, any> = new Map();
  private isRunningDemo = false;

  constructor(private wss?: any) {}

  // Register WebSocket clients for real-time updates
  public addWebSocketClient(ws: WebSocket) {
    this.wsClients.add(ws);
    
    ws.on('close', () => {
      this.wsClients.delete(ws);
    });
  }

  // Broadcast message to all connected clients
  private broadcast(message: WebSocketMessage) {
    const payload = JSON.stringify(message);
    this.wsClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  // Start an interactive demo session
  public async startInteractiveDemo(scenario: 'oauth' | 'api' | 'bugfix' | 'feature' = 'oauth'): Promise<string> {
    const demoSessionId = `demo-${uuidv4()}`;
    
    console.log(`🎬 Starting interactive demo: ${scenario.toUpperCase()}`);
    
    // Generate realistic session data
    const mockSessions = DualAgentMockDataGenerator.generateRealisticSessions(1);
    const session = mockSessions[0];
    session.id = demoSessionId;
    
    this.demoSessions.set(demoSessionId, {
      session,
      currentMessageIndex: 0,
      scenario,
      startTime: new Date(),
      isActive: true
    });

    // Start the demo conversation
    this.playDemoConversation(demoSessionId);

    return demoSessionId;
  }

  // Play out a demo conversation message by message
  private async playDemoConversation(demoSessionId: string) {
    const demo = this.demoSessions.get(demoSessionId);
    if (!demo || !demo.isActive) return;

    const { session, currentMessageIndex, scenario } = demo;
    const messages = session.messages;

    if (currentMessageIndex >= messages.length) {
      // Demo complete
      demo.isActive = false;
      this.broadcast({
        type: 'system_event',
        data: {
          id: uuidv4(),
          sessionId: demoSessionId,
          eventType: 'session_end',
          details: `🎭 Demo completed successfully! Scenario: ${scenario}`,
          timestamp: new Date()
        } as SystemEvent
      });
      return;
    }

    const message = messages[currentMessageIndex];
    
    // Update message to current demo session
    const demoMessage: AgentMessage = {
      ...message,
      sessionId: demoSessionId,
      timestamp: new Date()
    };

    // Broadcast the message to all connected clients
    this.broadcast({
      type: 'new_message',
      data: demoMessage
    });

    console.log(`💬 Demo ${scenario}: ${message.agentType} - ${message.content.split('\\n')[0].substring(0, 60)}...`);

    // Update demo state
    demo.currentMessageIndex++;
    this.demoSessions.set(demoSessionId, demo);

    // Schedule next message with realistic delay
    const delay = this.getRealisticDelay(message.agentType, currentMessageIndex);
    setTimeout(() => {
      this.playDemoConversation(demoSessionId);
    }, delay);
  }

  // Get realistic delays between messages
  private getRealisticDelay(agentType: 'manager' | 'worker', messageIndex: number): number {
    const baseDelay = agentType === 'manager' ? 8000 : 15000; // Manager faster
    const variance = Math.random() * 5000; // Add randomness
    const thoughtDelay = messageIndex === 0 ? 3000 : 0; // Initial thinking time
    
    return baseDelay + variance + thoughtDelay;
  }

  // Generate live performance metrics
  public generateLiveMetrics(sessionId: string): void {
    const demo = this.demoSessions.get(sessionId);
    if (!demo || !demo.isActive) return;

    const agentType: 'manager' | 'worker' = Math.random() > 0.5 ? 'manager' : 'worker';
    const baseResponseTime = agentType === 'manager' ? 1200 : 2800;
    const variance = Math.random() * 800 - 400;
    
    const metrics = {
      sessionId,
      agentType,
      responseTime: Math.max(500, baseResponseTime + variance),
      tokensUsed: Math.floor(Math.random() * 300) + (agentType === 'manager' ? 400 : 650),
      cost: Math.random() * 0.05 + 0.01,
      errorRate: Math.random() < 0.95 ? 0 : Math.random() * 0.2,
      timestamp: new Date()
    };

    this.broadcast({
      type: 'performance_update',
      data: metrics
    });

    // Schedule next metrics update
    if (demo.isActive) {
      setTimeout(() => this.generateLiveMetrics(sessionId), 5000 + Math.random() * 5000);
    }
  }

  // Stop demo session
  public stopDemo(demoSessionId: string): boolean {
    const demo = this.demoSessions.get(demoSessionId);
    if (!demo) return false;

    demo.isActive = false;
    this.demoSessions.delete(demoSessionId);
    
    this.broadcast({
      type: 'system_event',
      data: {
        id: uuidv4(),
        sessionId: demoSessionId,
        eventType: 'session_end',
        details: '🛑 Demo stopped by user',
        timestamp: new Date()
      } as SystemEvent
    });

    console.log(`🛑 Demo stopped: ${demoSessionId}`);
    return true;
  }

  // Get current demo status
  public getDemoStatus(): any {
    const activeDemos = Array.from(this.demoSessions.values()).filter(d => d.isActive);
    
    return {
      activeCount: activeDemos.length,
      connectedClients: this.wsClients.size,
      scenarios: activeDemos.map(d => ({
        id: d.session.id,
        scenario: d.scenario,
        progress: `${d.currentMessageIndex}/${d.session.messages.length}`,
        startTime: d.startTime
      }))
    };
  }

  // Create system-wide analytics demo
  public async createAnalyticsDemo(): Promise<any> {
    console.log('📊 Generating analytics demo data...');
    
    const analytics = DualAgentMockDataGenerator.generateAnalyticsData();
    
    // Broadcast analytics updates
    this.broadcast({
      type: 'session_list', // Repurpose for analytics
      data: analytics as any
    });

    return {
      message: 'Analytics demo data generated and broadcast',
      dataPoints: {
        dailyActivity: (analytics.dailyActivity as any[]).length,
        agentPerformance: (analytics.agentPerformance as any[]).length,
        costTrends: (analytics.costTrends as any[]).length,
        toolUsage: (analytics.toolUsage as any[]).length,
        projectTypes: (analytics.projectTypes as any[]).length
      }
    };
  }

  // Start continuous background demos
  public startContinuousDemo(intervalMinutes: number = 10): void {
    if (this.isRunningDemo) {
      console.log('⚠️  Continuous demo already running');
      return;
    }

    this.isRunningDemo = true;
    console.log(`🔄 Starting continuous demo mode (every ${intervalMinutes} minutes)`);

    const runDemo = () => {
      if (!this.isRunningDemo) return;

      const scenarios = ['oauth', 'api', 'bugfix', 'feature'] as const;
      const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
      
      this.startInteractiveDemo(randomScenario).then(sessionId => {
        console.log(`🎭 Auto-started demo: ${randomScenario} (${sessionId})`);
        this.generateLiveMetrics(sessionId);
      });

      // Schedule next demo
      setTimeout(runDemo, intervalMinutes * 60 * 1000);
    };

    // Start first demo immediately
    runDemo();
  }

  // Stop continuous demos
  public stopContinuousDemo(): void {
    this.isRunningDemo = false;
    console.log('⏹️  Continuous demo mode stopped');

    // Stop all active demos
    Array.from(this.demoSessions.keys()).forEach(id => {
      this.stopDemo(id);
    });
  }

  // Get comprehensive demo statistics
  public getDemoStats(): any {
    const activeDemos = Array.from(this.demoSessions.values()).filter(d => d.isActive);
    const totalDemos = this.demoSessions.size;
    
    return {
      system: {
        connectedClients: this.wsClients.size,
        continuousMode: this.isRunningDemo,
        uptime: process.uptime()
      },
      demos: {
        active: activeDemos.length,
        total: totalDemos,
        scenarios: {
          oauth: activeDemos.filter(d => d.scenario === 'oauth').length,
          api: activeDemos.filter(d => d.scenario === 'api').length,
          bugfix: activeDemos.filter(d => d.scenario === 'bugfix').length,
          feature: activeDemos.filter(d => d.scenario === 'feature').length
        }
      },
      performance: {
        messagesGenerated: Array.from(this.demoSessions.values())
          .reduce((sum, d) => sum + d.currentMessageIndex, 0),
        avgSessionProgress: activeDemos.length > 0 
          ? activeDemos.reduce((sum, d) => sum + (d.currentMessageIndex / d.session.messages.length), 0) / activeDemos.length
          : 0
      }
    };
  }
}