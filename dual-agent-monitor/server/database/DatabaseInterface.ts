import {
  AgentMessage,
  DualAgentSession,
  AgentCommunication,
  SystemEvent,
  PerformanceMetrics
} from '../types';

/**
 * Common interface for all database services
 * This allows for interchangeable database implementations
 */
export interface DatabaseInterface {
  // Session management
  createSession(sessionData: {
    startTime: Date;
    status: string;
    initialTask: string;
    workDir: string;
  }): Promise<string>;

  getSession(sessionId: string): Promise<DualAgentSession | null>;
  getAllSessions(limit?: number): Promise<DualAgentSession[]>;
  updateSessionStatus(sessionId: string, status: string, endTime?: Date): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  // Message management
  addMessage(message: {
    id: string;
    sessionId: string;
    agentType: 'manager' | 'worker';
    messageType: string;
    content: string;
    timestamp: Date;
    parentMessageId?: string;
    metadata?: {
      tools?: string[];
      files?: string[];
      commands?: string[];
      duration?: number;
      cost?: number;
      exitCode?: number;
    };
  }): Promise<void>;

  getSessionMessages(sessionId: string): Promise<AgentMessage[]>;

  // Communication tracking
  addAgentCommunication(communication: {
    sessionId: string;
    fromAgent: 'manager' | 'worker';
    toAgent: 'manager' | 'worker';
    messageType: string;
    content: string;
    timestamp: Date;
    relatedMessageId?: string;
  }): Promise<void>;

  getSessionCommunications(sessionId: string): Promise<AgentCommunication[]>;

  // System events
  addSystemEvent(event: {
    id: string;
    sessionId: string;
    eventType: string;
    details: string;
    timestamp: Date;
  }): Promise<void>;

  getSessionEvents(sessionId: string): Promise<SystemEvent[]>;

  // Performance metrics
  addPerformanceMetric(metric: {
    sessionId: string;
    agentType: 'manager' | 'worker';
    responseTime: number;
    tokensUsed?: number;
    cost?: number;
    errorRate: number;
    timestamp: Date;
  }): Promise<void>;

  getSessionMetrics(sessionId: string): Promise<PerformanceMetrics[]>;

  // Analytics methods
  getAggregatedMetrics(
    timeWindow: 'hour' | 'day' | 'week',
    sessionIds?: string[]
  ): Promise<any>;

  getTopPerformingSessions(limit?: number): Promise<Array<{
    sessionId: string;
    avgResponseTime: number;
    totalMessages: number;
    successRate: number;
  }>>;

  getCostAnalytics(
    timeRange?: { start: Date; end: Date },
    sessionIds?: string[]
  ): Promise<any>;

  getErrorAnalytics(sessionIds?: string[]): Promise<{
    totalErrors: number;
    errorRate: number;
    errorsByType: { [key: string]: number };
  }>;

  getMetricsInTimeRange(
    timeRange: { start: Date; end: Date },
    sessionIds?: string[]
  ): Promise<PerformanceMetrics[]>;

  // Health and status
  getHealthStatus(): Promise<{ healthy: boolean }> | { healthy: boolean };
  getHealthCheck?(): Promise<{ healthy: boolean; details: any }>;
  isReady(): boolean;
  close(): Promise<void> | void;
}