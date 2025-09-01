import { useMemo } from 'react';
import { useSessionStore } from '../store/useSessionStore';
import { DualAgentSession, AgentMessage } from '../types';

interface AnalyticsData {
  // Session metrics
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  errorSessions: number;
  pausedSessions: number;
  
  // Activity metrics
  recentActivityCount: number;
  hourlyActivityCount: number;
  dailyActivityCount: number;
  
  // Message metrics
  totalMessages: number;
  recentMessages: number;
  
  // Alert metrics
  alertsCount: number;
  criticalAlertsCount: number;
  
  // Insights metrics
  insightsCount: number;
  completedWithInsights: number;
  
  // Performance metrics
  averageSessionDuration: number;
  averageMessagesPerSession: number;
  successRate: number;
  
  // Project metrics
  uniqueWorkDirs: number;
  
  // Real-time metrics
  isRealTimeActive: boolean;
  connectionHealth: 'healthy' | 'warning' | 'critical' | 'offline';
}

export function useAnalytics(customSessions?: DualAgentSession[]): AnalyticsData {
  const { sessions: storeSessions, isConnected, lastConnectionTime } = useSessionStore();
  const sessions = customSessions || storeSessions || [];

  return useMemo(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Session counts by status
    const activeSessions = sessions.filter(s => s.status === 'running').length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const errorSessions = sessions.filter(s => s.status === 'error').length;
    const pausedSessions = sessions.filter(s => s.status === 'paused').length;

    // Activity metrics
    const recentActivityCount = sessions.filter(session => {
      if (!session.lastActivity) return false;
      const lastActivity = new Date(session.lastActivity);
      return lastActivity > oneHourAgo;
    }).length;

    const hourlyActivityCount = sessions.filter(session => {
      if (!session.messages) return false;
      const recentMessages = session.messages.filter(msg => {
        const msgTime = new Date(msg.timestamp);
        return msgTime > oneHourAgo;
      });
      return recentMessages.length > 0;
    }).length;

    const dailyActivityCount = sessions.filter(session => {
      if (!session.lastActivity) return false;
      const lastActivity = new Date(session.lastActivity);
      return lastActivity > oneDayAgo;
    }).length;

    // Message metrics
    const totalMessages = sessions.reduce((acc, session) => 
      acc + (session.messages?.length || 0), 0
    );

    const recentMessages = sessions.reduce((acc, session) => {
      if (!session.messages) return acc;
      const recentMsgs = session.messages.filter(msg => {
        const msgTime = new Date(msg.timestamp);
        return msgTime > oneHourAgo;
      });
      return acc + recentMsgs.length;
    }, 0);

    // Alert metrics (sessions with errors or recent issues)
    const alertsCount = sessions.filter(session => 
      session.status === 'error' || 
      (session.messages && session.messages.some(msg => 
        msg.messageType === 'error' && 
        new Date(msg.timestamp) > oneDayAgo
      ))
    ).length;

    const criticalAlertsCount = sessions.filter(session =>
      session.status === 'error' &&
      session.lastActivity &&
      new Date(session.lastActivity) > oneHourAgo
    ).length;

    // Insights metrics (completed sessions with substantial activity)
    const insightsCount = sessions.filter(session => 
      session.status === 'completed' && 
      session.messages && 
      session.messages.length > 10
    ).length;

    const completedWithInsights = sessions.filter(session =>
      session.status === 'completed' &&
      session.messages &&
      session.messages.length > 5 &&
      session.messages.some(msg => 
        msg.agentType === 'manager' && 
        msg.messageType === 'response'
      )
    ).length;

    // Performance metrics
    const completedSessionsData = sessions.filter(s => 
      s.status === 'completed' && s.lastActivity
    );

    const averageSessionDuration = completedSessionsData.length > 0
      ? completedSessionsData.reduce((acc, session) => {
          const start = new Date(session.startTime);
          const end = new Date(session.lastActivity!);
          return acc + (end.getTime() - start.getTime());
        }, 0) / completedSessionsData.length / (1000 * 60) // Convert to minutes
      : 0;

    const averageMessagesPerSession = sessions.length > 0
      ? totalMessages / sessions.length
      : 0;

    const successRate = sessions.length > 0
      ? (completedSessions / sessions.length) * 100
      : 0;

    // Project metrics
    const uniqueWorkDirs = new Set(
      sessions
        .map(s => s.workDir)
        .filter(dir => dir && dir.trim().length > 0)
    ).size;

    // Real-time metrics
    const isRealTimeActive = activeSessions > 0 || recentActivityCount > 0;
    
    let connectionHealth: 'healthy' | 'warning' | 'critical' | 'offline' = 'offline';
    if (isConnected) {
      if (activeSessions > 0) {
        connectionHealth = 'healthy';
      } else if (lastConnectionTime && (now.getTime() - new Date(lastConnectionTime).getTime()) < 5 * 60 * 1000) {
        connectionHealth = 'healthy';
      } else {
        connectionHealth = 'warning';
      }
    } else if (criticalAlertsCount > 0) {
      connectionHealth = 'critical';
    }

    return {
      totalSessions: sessions.length,
      activeSessions,
      completedSessions,
      errorSessions,
      pausedSessions,
      recentActivityCount,
      hourlyActivityCount,
      dailyActivityCount,
      totalMessages,
      recentMessages,
      alertsCount,
      criticalAlertsCount,
      insightsCount,
      completedWithInsights,
      averageSessionDuration,
      averageMessagesPerSession,
      successRate,
      uniqueWorkDirs,
      isRealTimeActive,
      connectionHealth
    };
  }, [sessions, isConnected, lastConnectionTime]);
}

// Hook for mobile-specific badge calculations
export function useMobileBadges(customSessions?: DualAgentSession[], customEvents?: any[], activeProjects?: string[]) {
  const analytics = useAnalytics(customSessions);
  
  return useMemo(() => {
    // Calculate recent activity from events if available
    const recentActivityCount = customEvents ? customEvents.filter(event => {
      const eventTime = new Date(event.timestamp || event.createdAt || Date.now());
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return eventTime > oneHourAgo;
    }).length : analytics.recentActivityCount;
    
    // Use provided activeProjects or calculated uniqueWorkDirs
    const projectCount = activeProjects ? activeProjects.length : analytics.uniqueWorkDirs;
    
    return {
      dashboard: recentActivityCount,
      sessions: analytics.activeSessions,
      metrics: analytics.alertsCount,
      analytics: analytics.insightsCount,
      projects: projectCount,
    };
  }, [analytics, customEvents, activeProjects]);
}

// Hook for sidebar badge calculations  
export function useSidebarBadges(customSessions?: DualAgentSession[]) {
  const analytics = useAnalytics(customSessions);
  
  return useMemo(() => ({
    sessions: analytics.totalSessions,
    agents: analytics.activeSessions,
    analytics: analytics.insightsCount > 0 ? analytics.insightsCount : undefined,
    alerts: analytics.criticalAlertsCount > 0 ? analytics.criticalAlertsCount : undefined,
  }), [analytics]);
}