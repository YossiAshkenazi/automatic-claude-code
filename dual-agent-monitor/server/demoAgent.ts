import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { DualAgentMockDataGenerator } from './database/mockData';
import { AgentMessage, SystemEvent, WebSocketMessage } from './types';

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
    const demoMessage: AgentMessage = {\n      ...message,\n      sessionId: demoSessionId,\n      timestamp: new Date()\n    };\n\n    // Broadcast the message to all connected clients\n    this.broadcast({\n      type: 'new_message',\n      data: demoMessage\n    });\n\n    console.log(`💬 Demo ${scenario}: ${message.agentType} - ${message.content.split('\\n')[0].substring(0, 60)}...`);\n\n    // Update demo state\n    demo.currentMessageIndex++;\n    this.demoSessions.set(demoSessionId, demo);\n\n    // Schedule next message with realistic delay\n    const delay = this.getRealisticDelay(message.agentType, currentMessageIndex);\n    setTimeout(() => {\n      this.playDemoConversation(demoSessionId);\n    }, delay);\n  }\n\n  // Get realistic delays between messages\n  private getRealisticDelay(agentType: 'manager' | 'worker', messageIndex: number): number {\n    const baseDelay = agentType === 'manager' ? 8000 : 15000; // Manager faster\n    const variance = Math.random() * 5000; // Add randomness\n    const thoughtDelay = messageIndex === 0 ? 3000 : 0; // Initial thinking time\n    \n    return baseDelay + variance + thoughtDelay;\n  }\n\n  // Generate live performance metrics\n  public generateLiveMetrics(sessionId: string): void {\n    const demo = this.demoSessions.get(sessionId);\n    if (!demo || !demo.isActive) return;\n\n    const agentType = Math.random() > 0.5 ? 'manager' : 'worker';\n    const baseResponseTime = agentType === 'manager' ? 1200 : 2800;\n    const variance = Math.random() * 800 - 400;\n    \n    const metrics = {\n      sessionId,\n      agentType,\n      responseTime: Math.max(500, baseResponseTime + variance),\n      tokensUsed: Math.floor(Math.random() * 300) + (agentType === 'manager' ? 400 : 650),\n      cost: Math.random() * 0.05 + 0.01,\n      errorRate: Math.random() < 0.95 ? 0 : Math.random() * 0.2,\n      timestamp: new Date()\n    };\n\n    this.broadcast({\n      type: 'performance_update',\n      data: metrics\n    });\n\n    // Schedule next metrics update\n    if (demo.isActive) {\n      setTimeout(() => this.generateLiveMetrics(sessionId), 5000 + Math.random() * 5000);\n    }\n  }\n\n  // Stop demo session\n  public stopDemo(demoSessionId: string): boolean {\n    const demo = this.demoSessions.get(demoSessionId);\n    if (!demo) return false;\n\n    demo.isActive = false;\n    this.demoSessions.delete(demoSessionId);\n    \n    this.broadcast({\n      type: 'system_event',\n      data: {\n        id: uuidv4(),\n        sessionId: demoSessionId,\n        eventType: 'session_end',\n        details: '🛑 Demo stopped by user',\n        timestamp: new Date()\n      } as SystemEvent\n    });\n\n    console.log(`🛑 Demo stopped: ${demoSessionId}`);\n    return true;\n  }\n\n  // Get current demo status\n  public getDemoStatus(): any {\n    const activeDemos = Array.from(this.demoSessions.values()).filter(d => d.isActive);\n    \n    return {\n      activeCount: activeDemos.length,\n      connectedClients: this.wsClients.size,\n      scenarios: activeDemos.map(d => ({\n        id: d.session.id,\n        scenario: d.scenario,\n        progress: `${d.currentMessageIndex}/${d.session.messages.length}`,\n        startTime: d.startTime\n      }))\n    };\n  }\n\n  // Create system-wide analytics demo\n  public async createAnalyticsDemo(): Promise<any> {\n    console.log('📊 Generating analytics demo data...');\n    \n    const analytics = DualAgentMockDataGenerator.generateAnalyticsData();\n    \n    // Broadcast analytics updates\n    this.broadcast({\n      type: 'session_list', // Repurpose for analytics\n      data: analytics as any\n    });\n\n    return {\n      message: 'Analytics demo data generated and broadcast',\n      dataPoints: {\n        dailyActivity: (analytics.dailyActivity as any[]).length,\n        agentPerformance: (analytics.agentPerformance as any[]).length,\n        costTrends: (analytics.costTrends as any[]).length,\n        toolUsage: (analytics.toolUsage as any[]).length,\n        projectTypes: (analytics.projectTypes as any[]).length\n      }\n    };\n  }\n\n  // Start continuous background demos\n  public startContinuousDemo(intervalMinutes: number = 10): void {\n    if (this.isRunningDemo) {\n      console.log('⚠️  Continuous demo already running');\n      return;\n    }\n\n    this.isRunningDemo = true;\n    console.log(`🔄 Starting continuous demo mode (every ${intervalMinutes} minutes)`);\n\n    const runDemo = () => {\n      if (!this.isRunningDemo) return;\n\n      const scenarios = ['oauth', 'api', 'bugfix', 'feature'] as const;\n      const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];\n      \n      this.startInteractiveDemo(randomScenario).then(sessionId => {\n        console.log(`🎭 Auto-started demo: ${randomScenario} (${sessionId})`);\n        this.generateLiveMetrics(sessionId);\n      });\n\n      // Schedule next demo\n      setTimeout(runDemo, intervalMinutes * 60 * 1000);\n    };\n\n    // Start first demo immediately\n    runDemo();\n  }\n\n  // Stop continuous demos\n  public stopContinuousDemo(): void {\n    this.isRunningDemo = false;\n    console.log('⏹️  Continuous demo mode stopped');\n\n    // Stop all active demos\n    Array.from(this.demoSessions.keys()).forEach(id => {\n      this.stopDemo(id);\n    });\n  }\n\n  // Get comprehensive demo statistics\n  public getDemoStats(): any {\n    const activeDemos = Array.from(this.demoSessions.values()).filter(d => d.isActive);\n    const totalDemos = this.demoSessions.size;\n    \n    return {\n      system: {\n        connectedClients: this.wsClients.size,\n        continuousMode: this.isRunningDemo,\n        uptime: process.uptime()\n      },\n      demos: {\n        active: activeDemos.length,\n        total: totalDemos,\n        scenarios: {\n          oauth: activeDemos.filter(d => d.scenario === 'oauth').length,\n          api: activeDemos.filter(d => d.scenario === 'api').length,\n          bugfix: activeDemos.filter(d => d.scenario === 'bugfix').length,\n          feature: activeDemos.filter(d => d.scenario === 'feature').length\n        }\n      },\n      performance: {\n        messagesGenerated: Array.from(this.demoSessions.values())\n          .reduce((sum, d) => sum + d.currentMessageIndex, 0),\n        avgSessionProgress: activeDemos.length > 0 \n          ? activeDemos.reduce((sum, d) => sum + (d.currentMessageIndex / d.session.messages.length), 0) / activeDemos.length\n          : 0\n      }\n    };\n  }\n}"