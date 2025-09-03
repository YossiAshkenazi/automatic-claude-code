import { v4 as uuidv4 } from 'uuid';
import { DualAgentSession, AgentMessage, SystemEvent, PerformanceMetrics, AgentCommunication } from '../types';

// Mock data generator for realistic dual-agent monitoring demos
export class DualAgentMockDataGenerator {
  
  // Realistic conversation templates for different scenarios
  private static readonly conversationTemplates = {
    oauth_implementation: [
      {
        agentType: 'manager' as const,
        messageType: 'prompt' as const,
        content: '🎯 **Task Assignment**: Implement OAuth2 authentication system with JWT tokens\n\n**Requirements:**\n- Support Google & GitHub providers\n- JWT token management\n- Refresh token rotation\n- Secure session handling\n\n**Priority**: High | **Complexity**: 7/10',
        tools: ['Read', 'Grep', 'Write'],
        files: ['src/auth/oauth.ts', 'package.json'],
        duration: 2800,
        cost: 0.032
      },
      {
        agentType: 'worker' as const,
        messageType: 'response' as const,
        content: '✅ **Analysis Complete** - I\'ve reviewed the codebase structure\n\n**Implementation Plan:**\n1. Install OAuth dependencies (passport-google-oauth20, passport-github2)\n2. Create AuthProvider base class\n3. Implement Google & GitHub strategies\n4. Set up JWT token management\n5. Add refresh token rotation\n\n**Starting with dependency installation...**',
        tools: ['Bash', 'Write', 'Edit'],
        files: ['package.json', 'src/auth/providers/BaseAuthProvider.ts'],
        duration: 3200,
        cost: 0.045
      },
      {
        agentType: 'manager' as const,
        messageType: 'prompt' as const,
        content: '📊 **Quality Check**: Good planning! Please ensure:\n- Rate limiting for auth endpoints\n- PKCE security for OAuth flows\n- Comprehensive error handling\n- Unit tests for all providers\n\n**Proceed with implementation.**',
        tools: ['Read'],
        files: ['src/auth/providers/BaseAuthProvider.ts'],
        duration: 1800,
        cost: 0.028
      },
      {
        agentType: 'worker' as const,
        messageType: 'response' as const,
        content: '🔧 **Implementation Progress** (Step 1/5)\n\n✅ Dependencies installed\n✅ BaseAuthProvider class created with PKCE support\n✅ Rate limiting middleware added\n\n**Currently implementing:**\n- GoogleAuthProvider with proper error handling\n- JWT token validation with refresh rotation\n\n**Files modified:** 4 | **Tests added:** 3',
        tools: ['Write', 'Edit', 'Bash'],
        files: ['src/auth/providers/GoogleAuthProvider.ts', 'src/auth/middleware/rateLimiter.ts', 'src/tests/auth/google.test.ts'],
        duration: 4500,
        cost: 0.067
      },
      {
        agentType: 'manager' as const,
        messageType: 'prompt' as const,
        content: '⚡ **Validation Phase**: Excellent progress! Run the auth test suite and verify:\n- All OAuth flows work correctly\n- Token refresh mechanism is secure\n- Error scenarios are properly handled\n\n**Quality gate**: 95%+ test coverage required.',
        tools: ['Bash'],
        files: [],
        duration: 1200,
        cost: 0.019
      },
      {
        agentType: 'worker' as const,
        messageType: 'response' as const,
        content: '🎉 **IMPLEMENTATION COMPLETE**\n\n✅ OAuth2 system fully implemented\n✅ Test coverage: 98.3%\n✅ All security requirements met\n✅ Performance benchmarks passed\n\n**Features delivered:**\n- Google & GitHub OAuth providers\n- JWT with refresh token rotation\n- PKCE security implementation\n- Rate limiting & error handling\n- Comprehensive test suite\n\n**Ready for deployment! 🚀**',
        tools: ['Bash', 'Read'],
        files: ['src/auth/**/*.ts'],
        duration: 3800,
        cost: 0.058
      }
    ],

    api_development: [
      {
        agentType: 'manager' as const,
        messageType: 'prompt' as const,
        content: '🏗️ **Architecture Task**: Build RESTful API for task management system\n\n**Scope:**\n- CRUD operations for tasks, projects, users\n- Advanced filtering & search\n- Real-time notifications\n- Performance optimization\n\n**Target**: 500+ concurrent users',
        tools: ['Read', 'Glob'],
        files: ['src/api/**/*.ts', 'database/schema.sql'],
        duration: 2400,
        cost: 0.038
      },
      {
        agentType: 'worker' as const,
        messageType: 'response' as const,
        content: '📋 **System Analysis Complete**\n\n**Current Architecture:**\n- Express.js server with TypeScript\n- PostgreSQL database\n- Redis for caching\n- WebSocket for real-time features\n\n**Implementation Strategy:**\n1. Database optimization & indexing\n2. API endpoint creation with validation\n3. Caching layer implementation\n4. Real-time notification system\n5. Load testing & optimization',
        tools: ['Read', 'Grep', 'Write'],
        files: ['src/api/routes/**/*.ts', 'src/database/models/**/*.ts'],
        duration: 3600,
        cost: 0.052
      },
      {
        agentType: 'manager' as const,
        messageType: 'prompt' as const,
        content: '🎯 **Performance Focus**: Prioritize these optimizations:\n- Database query optimization (N+1 prevention)\n- Response compression & caching\n- Connection pooling\n- Background job processing\n\n**Metrics target**: <100ms response time, 99.9% uptime',
        tools: ['Read'],
        files: ['src/api/middleware/performance.ts'],
        duration: 1600,
        cost: 0.025
      },
      {
        agentType: 'worker' as const,
        messageType: 'response' as const,
        content: '⚡ **Performance Optimizations Applied**\n\n🚀 **Results:**\n- Query time: 45ms → 12ms (-73%)\n- Response compression: 65% size reduction\n- Connection pool: 100 concurrent connections\n- Background jobs: Redis Bull queue implemented\n\n**API Endpoints Created:** 24\n**Automated Tests:** 156\n**Performance Tests:** Passed ✅',
        tools: ['Write', 'Edit', 'Bash'],
        files: ['src/api/routes/**/*.ts', 'src/tests/api/**/*.ts', 'src/jobs/**/*.ts'],
        duration: 5200,
        cost: 0.078
      }
    ],

    bug_fix: [
      {
        agentType: 'manager' as const,
        messageType: 'prompt' as const,
        content: '🐛 **Critical Bug Report**: Memory leak in WebSocket connections\n\n**Symptoms:**\n- Server memory usage increases over time\n- WebSocket connections not properly cleaned up\n- Performance degradation after 6+ hours\n\n**Priority**: CRITICAL 🔥\n**Impact**: Production system instability',
        tools: ['Read', 'Grep'],
        files: ['src/websocket/**/*.ts', 'server/index.ts'],
        duration: 1800,
        cost: 0.029
      },
      {
        agentType: 'worker' as const,
        messageType: 'response' as const,
        content: '🔍 **Root Cause Analysis**\n\n**Issue Identified:**\n- WebSocket event listeners not removed on disconnect\n- Circular references in connection objects\n- Missing cleanup in error handling paths\n\n**Impact Assessment:**\n- Memory growth: ~50MB/hour\n- Connection leaks: 15-20 per hour\n\n**Fix Strategy:**\n1. Implement proper cleanup patterns\n2. Add connection lifecycle management\n3. Fix error handling edge cases\n4. Add monitoring & alerts',
        tools: ['Read', 'Grep', 'Edit'],
        files: ['src/websocket/ConnectionManager.ts', 'src/websocket/handlers/**/*.ts'],
        duration: 4200,
        cost: 0.064
      },
      {
        agentType: 'manager' as const,
        messageType: 'prompt' as const,
        content: '✅ **Validation Required**: Deploy fix to staging and monitor:\n- Memory usage patterns over 24 hours\n- Connection cleanup verification\n- Performance regression testing\n\n**Rollback plan**: Ready for immediate revert if issues detected.',
        tools: ['Bash'],
        files: [],
        duration: 1400,
        cost: 0.022
      },
      {
        agentType: 'worker' as const,
        messageType: 'response' as const,
        content: '🎯 **BUG FIX DEPLOYED & VERIFIED**\n\n✅ **Results after 24h monitoring:**\n- Memory usage: Stable (no growth detected)\n- Connection cleanup: 100% success rate\n- Performance: 15% improvement\n- Zero errors in production logs\n\n**Memory leak eliminated! 🏆**\n**Ready for production deployment.**',
        tools: ['Bash', 'Read'],
        files: ['src/websocket/**/*.ts'],
        duration: 2800,
        cost: 0.043
      }
    ],

    feature_enhancement: [
      {
        agentType: 'manager' as const,
        messageType: 'prompt' as const,
        content: '✨ **Feature Request**: Add advanced analytics dashboard\n\n**Requirements:**\n- Real-time metrics visualization\n- Custom dashboard builder\n- Export capabilities (PDF, CSV, PNG)\n- Mobile responsive design\n- Role-based access control\n\n**Timeline**: 2 weeks | **Users**: 1000+ daily',
        tools: ['Read', 'Glob'],
        files: ['src/components/dashboard/**/*.tsx', 'src/analytics/**/*.ts'],
        duration: 2200,
        cost: 0.035
      },
      {
        agentType: 'worker' as const,
        messageType: 'response' as const,
        content: '📊 **Analytics Dashboard Design**\n\n**Technical Architecture:**\n- React + TypeScript frontend\n- Chart.js for visualizations\n- WebSocket for real-time updates\n- PDF generation with Puppeteer\n- Responsive Tailwind CSS\n\n**Component Structure:**\n1. Dashboard Builder UI\n2. Chart Components (12 types)\n3. Real-time Data Pipeline\n4. Export Service\n5. Access Control Layer\n\n**Starting development...**',
        tools: ['Write', 'Edit', 'Bash'],
        files: ['src/components/analytics/**/*.tsx', 'src/services/analytics.ts'],
        duration: 4800,
        cost: 0.072
      },
      {
        agentType: 'manager' as const,
        messageType: 'prompt' as const,
        content: '🎨 **UX Focus**: Ensure the dashboard is intuitive:\n- Drag-and-drop widget arrangement\n- One-click chart type switching\n- Smart default configurations\n- Contextual help tooltips\n\n**User testing**: Schedule with 5 beta users this week.',
        tools: ['Read'],
        files: ['src/components/analytics/DashboardBuilder.tsx'],
        duration: 1900,
        cost: 0.031
      },
      {
        agentType: 'worker' as const,
        messageType: 'response' as const,
        content: '🎉 **ANALYTICS DASHBOARD COMPLETE**\n\n🚀 **Features Delivered:**\n- 12 interactive chart types\n- Drag & drop dashboard builder\n- Real-time data streaming\n- Multi-format exports (PDF, CSV, PNG)\n- Mobile responsive (tested on 8 devices)\n- Role-based permissions\n\n**Performance:**\n- Load time: <2s for 1000+ data points\n- Real-time updates: <100ms latency\n- Export generation: <5s\n\n**Beta testing**: 4.8/5 user satisfaction!',
        tools: ['Write', 'Edit', 'Bash'],
        files: ['src/components/analytics/**/*.tsx', 'src/tests/analytics/**/*.test.tsx'],
        duration: 6200,
        cost: 0.094
      }
    ]
  };

  private static readonly projectTypes = [
    'E-commerce Platform',
    'Task Management System',
    'Social Media Analytics',
    'Real-time Chat Application',
    'IoT Data Dashboard',
    'Financial Trading System',
    'Healthcare Management',
    'Educational Platform',
    'Logistics Tracking',
    'Content Management System'
  ];

  public static generateRealisticSessions(count: number = 10): DualAgentSession[] {
    const sessions: DualAgentSession[] = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const sessionId = `session-${uuidv4()}`;
      const templateKey = Object.keys(this.conversationTemplates)[i % Object.keys(this.conversationTemplates).length] as keyof typeof this.conversationTemplates;
      const template = this.conversationTemplates[templateKey];
      const projectType = this.projectTypes[i % this.projectTypes.length];
      
      // Vary session timing
      const hoursAgo = Math.floor(Math.random() * 168); // Last week
      const startTime = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
      const sessionDuration = Math.floor(Math.random() * 7200000) + 600000; // 10min - 2h
      const endTime = new Date(startTime.getTime() + sessionDuration);
      
      const messages: AgentMessage[] = [];
      let currentTime = startTime.getTime();
      let totalCost = 0;
      let filesModified: string[] = [];
      let toolsUsed: string[] = [];
      let commandsExecuted: string[] = [];
      
      // Generate conversation from template
      template.forEach((msg, msgIndex) => {
        const messageId = uuidv4();
        const messageDuration = msg.duration + Math.floor(Math.random() * 1000) - 500; // Add variance
        const messageCost = msg.cost + (Math.random() * 0.02) - 0.01; // Add cost variance
        
        totalCost += messageCost;
        filesModified.push(...(msg.files || []));
        toolsUsed.push(...(msg.tools || []));
        
        if (msg.messageType === 'response' && msg.tools?.includes('Bash')) {
          commandsExecuted.push(`npm test`, `pnpm build`, `git commit -m "Implement ${templateKey.replace('_', ' ')}"`, `pnpm start`);
        }
        
        messages.push({
          id: messageId,
          sessionId,
          agentType: msg.agentType,
          messageType: msg.messageType,
          content: msg.content.replace('${templateKey}', templateKey.replace('_', ' ')),
          timestamp: new Date(currentTime),
          metadata: {
            tools: msg.tools,
            files: msg.files,
            duration: messageDuration,
            cost: messageCost,
            ...(msg.messageType === 'response' && { exitCode: 0 })
          }
        });
        
        // Add realistic delays between messages
        if (msgIndex < template.length - 1) {
          const delay = Math.floor(Math.random() * 30000) + 10000; // 10-40s between messages
          currentTime += delay + messageDuration;
        }
      });
      
      // Determine session status based on completion
      const status = Math.random() > 0.1 ? 'completed' : (Math.random() > 0.5 ? 'running' : 'failed');
      const actualEndTime = status === 'running' ? undefined : endTime;
      
      // Generate session summary
      const summary = {
        totalMessages: messages.length,
        managerMessages: messages.filter(m => m.agentType === 'manager').length,
        workerMessages: messages.filter(m => m.agentType === 'worker').length,
        totalDuration: sessionDuration,
        totalCost: Math.round(totalCost * 100) / 100,
        filesModified: Array.from(new Set(filesModified)),
        commandsExecuted: Array.from(new Set(commandsExecuted)),
        toolsUsed: Array.from(new Set(toolsUsed)),
        successRate: status === 'completed' ? 1.0 : (status === 'running' ? 0.8 : 0.3)
      };
      
      sessions.push({
        id: sessionId,
        startTime,
        endTime: actualEndTime,
        status,
        initialTask: `${template[0].content.split('\n')[0].replace(/[*🎯]/g, '').trim()} - ${projectType}`,
        workDir: `/workspace/${projectType.toLowerCase().replace(/\s+/g, '-')}`,
        messages,
        summary
      });
    }
    
    return sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  public static generatePerformanceMetrics(sessions: DualAgentSession[]): PerformanceMetrics[] {
    const metrics: PerformanceMetrics[] = [];
    
    sessions.forEach(session => {
      // Generate metrics for each agent in the session
      ['manager', 'worker'].forEach(agentType => {
        const agentMessages = session.messages.filter(m => m.agentType === agentType);
        
        agentMessages.forEach((message, index) => {
          const baseResponseTime = agentType === 'manager' ? 1200 : 2800; // Manager faster
          const variance = Math.random() * 1000 - 500;
          const responseTime = Math.max(500, baseResponseTime + variance);
          
          const baseTokens = agentType === 'manager' ? 400 : 650;
          const tokenVariance = Math.random() * 200 - 100;
          const tokensUsed = Math.max(100, baseTokens + tokenVariance);
          
          const baseCost = tokensUsed * (agentType === 'manager' ? 0.00015 : 0.00008); // Opus vs Sonnet
          
          // Introduce occasional errors
          const errorRate = Math.random() < 0.95 ? 0 : Math.random() * 0.3;
          
          metrics.push({
            sessionId: session.id,
            agentType: agentType as 'manager' | 'worker',
            responseTime: Math.round(responseTime),
            tokensUsed: Math.round(tokensUsed),
            cost: Math.round(baseCost * 1000) / 1000,
            errorRate: Math.round(errorRate * 100) / 100,
            timestamp: message.timestamp
          });
        });
      });
    });
    
    return metrics;
  }

  public static generateSystemEvents(sessions: DualAgentSession[]): SystemEvent[] {
    const events: SystemEvent[] = [];
    
    sessions.forEach(session => {
      // Session start event
      events.push({
        id: uuidv4(),
        sessionId: session.id,
        eventType: 'session_start',
        details: `Dual-agent session initiated for: ${session.initialTask}`,
        timestamp: session.startTime
      });
      
      // Add some agent switch events
      const agentSwitches = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < agentSwitches; i++) {
        const switchTime = new Date(session.startTime.getTime() + (i + 1) * (session.summary?.totalDuration || 0) / (agentSwitches + 1));
        events.push({
          id: uuidv4(),
          sessionId: session.id,
          eventType: 'agent_switch',
          details: `Coordination handoff: ${i % 2 === 0 ? 'Manager → Worker' : 'Worker → Manager'}`,
          timestamp: switchTime
        });
      }
      
      // Add occasional error events
      if (Math.random() < 0.2) {
        const errorTime = new Date(session.startTime.getTime() + Math.random() * (session.summary?.totalDuration || 0));
        events.push({
          id: uuidv4(),
          sessionId: session.id,
          eventType: 'error',
          details: 'Temporary communication timeout - resolved automatically',
          timestamp: errorTime
        });
      }
      
      // Session end event
      if (session.endTime) {
        events.push({
          id: uuidv4(),
          sessionId: session.id,
          eventType: 'session_end',
          details: `Session ${session.status} - ${session.summary?.totalMessages} messages exchanged`,
          timestamp: session.endTime
        });
      }
    });
    
    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  public static generateAgentCommunications(sessions: DualAgentSession[]): AgentCommunication[] {
    const communications: AgentCommunication[] = [];
    
    sessions.forEach(session => {
      const messages = session.messages;
      
      // Generate coordination messages between agents
      for (let i = 1; i < messages.length; i++) {
        const prevMessage = messages[i - 1];
        const currentMessage = messages[i];
        
        // When agent switches, create a communication record
        if (prevMessage.agentType !== currentMessage.agentType) {
          const commTime = new Date(currentMessage.timestamp.getTime() - 5000); // 5s before response
          
          let commType: 'instruction' | 'feedback' | 'result' | 'question' = 'instruction';
          let content = '';
          
          if (prevMessage.agentType === 'manager') {
            commType = 'instruction';
            content = `Task coordination: Implementing ${currentMessage.content.split('\n')[0].substring(0, 50)}...`;
          } else {
            commType = 'result';
            content = `Progress update: ${prevMessage.content.split('\n')[0].substring(0, 50)}...`;
          }
          
          communications.push({
            id: uuidv4(),
            sessionId: session.id,
            fromAgent: prevMessage.agentType,
            toAgent: currentMessage.agentType,
            messageType: commType,
            content,
            timestamp: commTime,
            relatedMessageId: currentMessage.id
          });
        }
      }
    });
    
    return communications;
  }

  // Generate analytics data for charts
  public static generateAnalyticsData() {
    const now = new Date();
    const days = 30;
    const analytics = {
      dailyActivity: [],
      agentPerformance: [],
      costTrends: [],
      successRates: [],
      toolUsage: [],
      projectTypes: []
    };

    // Daily activity for the last 30 days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      const sessionsCount = Math.floor(Math.random() * 15) + 5; // 5-20 sessions per day
      const avgDuration = Math.floor(Math.random() * 3600) + 1800; // 30min - 1.5h average
      
      (analytics.dailyActivity as any).push({
        date: date.toISOString().split('T')[0],
        sessions: sessionsCount,
        avgDuration: avgDuration,
        successRate: 0.85 + Math.random() * 0.15, // 85-100%
        totalCost: Math.round((sessionsCount * (0.5 + Math.random() * 1.5)) * 100) / 100
      });
    }

    // Agent performance comparison
    (analytics.agentPerformance as any).push(
      {
        agent: 'Manager',
        avgResponseTime: 1250,
        successRate: 0.96,
        tokensPerMessage: 420,
        costEfficiency: 0.92,
        tasksCompleted: 245
      },
      {
        agent: 'Worker', 
        avgResponseTime: 2800,
        successRate: 0.94,
        tokensPerMessage: 680,
        costEfficiency: 0.88,
        tasksCompleted: 238
      }
    );

    // Cost trends over time
    let cumulativeCost = 0;
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      const dailyCost = Math.random() * 25 + 15; // $15-40 per day
      cumulativeCost += dailyCost;
      
      (analytics.costTrends as any).push({
        date: date.toISOString().split('T')[0],
        daily: Math.round(dailyCost * 100) / 100,
        cumulative: Math.round(cumulativeCost * 100) / 100,
        manager: Math.round(dailyCost * 0.6 * 100) / 100,
        worker: Math.round(dailyCost * 0.4 * 100) / 100
      });
    }

    // Tool usage statistics
    const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'MultiEdit', 'TodoWrite'];
    tools.forEach(tool => {
      (analytics.toolUsage as any).push({
        tool,
        usage: Math.floor(Math.random() * 150) + 50,
        successRate: 0.85 + Math.random() * 0.15,
        avgDuration: Math.floor(Math.random() * 2000) + 500
      });
    });

    // Project type distribution
    this.projectTypes.forEach(type => {
      (analytics.projectTypes as any).push({
        type,
        count: Math.floor(Math.random() * 20) + 5,
        avgSuccessRate: 0.80 + Math.random() * 0.20,
        avgDuration: Math.floor(Math.random() * 7200) + 1800
      });
    });

    return analytics;
  }
}