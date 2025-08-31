import React, { useState, useEffect } from 'react';
import { Users, Clock, Activity, TrendingUp, AlertTriangle, CheckCircle, Zap, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { DualAgentSession, AgentMessage } from '../../types';
import { formatDate, formatDuration } from '../../utils/formatters';
import { cn } from '../../lib/utils';

interface MobileDashboardProps {
  sessions: DualAgentSession[];
  selectedSession?: DualAgentSession | null;
  isConnected: boolean;
  onSessionSelect: (sessionId: string) => void;
}

interface MetricCard {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: 'easeOut'
    }
  })
};

export function MobileDashboard({ sessions, selectedSession, isConnected, onSessionSelect }: MobileDashboardProps) {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<AgentMessage[]>([]);

  useEffect(() => {
    calculateMetrics();
    getRecentActivity();
  }, [sessions, selectedSession]);

  const calculateMetrics = () => {
    const activeSessions = sessions.filter(s => s.status === 'running').length;
    const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);
    const avgMessagesPerSession = sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0;
    
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const completionRate = sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0;

    const recentSessions = sessions.filter(s => {
      const sessionDate = new Date(s.startTime);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return sessionDate > dayAgo;
    }).length;

    const newMetrics: MetricCard[] = [
      {
        title: 'Active Sessions',
        value: activeSessions,
        icon: <Activity size={18} />,
        color: 'blue',
        change: recentSessions > 0 ? `+${recentSessions} today` : undefined
      },
      {
        title: 'Total Messages',
        value: totalMessages.toLocaleString(),
        icon: <BarChart3 size={18} />,
        color: 'green',
        trend: totalMessages > 0 ? 'up' : 'stable'
      },
      {
        title: 'Avg Messages/Session',
        value: avgMessagesPerSession,
        icon: <TrendingUp size={18} />,
        color: 'purple',
        trend: avgMessagesPerSession > 10 ? 'up' : 'stable'
      },
      {
        title: 'Completion Rate',
        value: `${completionRate}%`,
        icon: <CheckCircle size={18} />,
        color: completionRate > 70 ? 'green' : completionRate > 40 ? 'orange' : 'red',
        trend: completionRate > 50 ? 'up' : 'down'
      }
    ];

    setMetrics(newMetrics);
  };

  const getRecentActivity = () => {
    const allMessages = sessions.flatMap(session => 
      session.messages.map(msg => ({ ...msg, sessionTitle: session.initialTask }))
    );
    
    const recent = allMessages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
    
    setRecentActivity(recent);
  };

  const getColorClasses = (color: MetricCard['color']) => {
    const classes = {
      blue: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        iconBg: 'bg-blue-100',
        iconText: 'text-blue-600'
      },
      green: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        iconBg: 'bg-green-100',
        iconText: 'text-green-600'
      },
      orange: {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        iconBg: 'bg-orange-100',
        iconText: 'text-orange-600'
      },
      red: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        iconBg: 'bg-red-100',
        iconText: 'text-red-600'
      },
      purple: {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        iconBg: 'bg-purple-100',
        iconText: 'text-purple-600'
      }
    };
    return classes[color];
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp size={12} className="text-green-500" />;
    if (trend === 'down') return <AlertTriangle size={12} className="text-red-500" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      {/* Status Banner */}
      <div className={cn(
        'px-4 py-2 text-center text-sm font-medium',
        isConnected
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      )}>
        <div className="flex items-center justify-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-red-500'
          )} />
          {isConnected ? 'Live monitoring active' : 'Monitoring offline'}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Quick Metrics Grid */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((metric, index) => {
              const colorClasses = getColorClasses(metric.color);
              return (
                <motion.div
                  key={metric.title}
                  custom={index}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  className={cn(
                    'rounded-xl p-4 border border-gray-100 shadow-sm',
                    colorClasses.bg
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={cn(
                      'p-2 rounded-lg',
                      colorClasses.iconBg
                    )}>
                      <div className={colorClasses.iconText}>
                        {metric.icon}
                      </div>
                    </div>
                    {getTrendIcon(metric.trend)}
                  </div>
                  
                  <div>
                    <div className={cn('text-2xl font-bold', colorClasses.text)}>
                      {metric.value}
                    </div>
                    <div className="text-xs text-gray-600 font-medium mb-1">
                      {metric.title}
                    </div>
                    {metric.change && (
                      <div className="text-xs text-gray-500">
                        {metric.change}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Active Session Card */}
        {selectedSession && (
          <motion.section
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Session</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate text-sm mb-1">
                    {selectedSession.initialTask}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>ID: {selectedSession.id.slice(0, 8)}</span>
                    <span>•</span>
                    <span>{formatDate(selectedSession.startTime)}</span>
                  </div>
                </div>
                <div className={cn(
                  'px-2 py-1 rounded-full text-xs font-medium',
                  selectedSession.status === 'running'
                    ? 'bg-green-100 text-green-700'
                    : selectedSession.status === 'paused'
                    ? 'bg-orange-100 text-orange-700'
                    : selectedSession.status === 'completed'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                )}>
                  {selectedSession.status}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {selectedSession.messages.length}
                  </div>
                  <div className="text-xs text-gray-500">Messages</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {selectedSession.messages.filter(m => m.agentType === 'manager').length}
                  </div>
                  <div className="text-xs text-gray-500">Manager</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {selectedSession.messages.filter(m => m.agentType === 'worker').length}
                  </div>
                  <div className="text-xs text-gray-500">Worker</div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Recent Activity */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={`${activity.sessionId}-${activity.timestamp}-${index}`} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                      activity.agentType === 'manager'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-green-100 text-green-600'
                    )}>
                      {activity.agentType === 'manager' ? 'M' : 'W'}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {activity.agentType === 'manager' ? 'Manager' : 'Worker'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(activity.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {activity.content.slice(0, 100)}{activity.content.length > 100 ? '...' : ''}
                      </p>
                      
                      {(activity as any).sessionTitle && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          Session: {(activity as any).sessionTitle}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock size={20} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </motion.section>

        {/* Quick Actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.8 }}
          className="pb-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <Users size={16} className="text-blue-600" />
              </div>
              <div className="text-sm font-medium text-gray-900">View All Sessions</div>
              <div className="text-xs text-gray-500">Manage and monitor</div>
            </button>
            
            <button className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                <Zap size={16} className="text-green-600" />
              </div>
              <div className="text-sm font-medium text-gray-900">Performance</div>
              <div className="text-xs text-gray-500">View metrics</div>
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}