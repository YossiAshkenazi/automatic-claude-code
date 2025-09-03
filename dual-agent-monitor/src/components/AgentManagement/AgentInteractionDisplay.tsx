import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  ArrowRight, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  User, 
  Bot,
  Activity,
  Filter,
  Search,
  Expand,
  Minimize,
  Copy,
  Download
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';
import type { AgentCommunication, Agent } from '../../types/agent';

interface AgentInteractionDisplayProps {
  agents: Agent[];
  communications: AgentCommunication[];
  isRealTime?: boolean;
  className?: string;
}

type MessageTypeFilter = 'all' | 'task_assignment' | 'progress_update' | 'completion_report' | 'error_report' | 'coordination' | 'status_check';
type ViewMode = 'timeline' | 'conversation';

const messageTypeConfig = {
  task_assignment: {
    color: 'text-blue-600 bg-blue-100 border-blue-200',
    icon: MessageSquare,
    label: 'Task Assignment'
  },
  progress_update: {
    color: 'text-green-600 bg-green-100 border-green-200',
    icon: Activity,
    label: 'Progress Update'
  },
  completion_report: {
    color: 'text-purple-600 bg-purple-100 border-purple-200',
    icon: CheckCircle,
    label: 'Completion Report'
  },
  error_report: {
    color: 'text-red-600 bg-red-100 border-red-200',
    icon: AlertCircle,
    label: 'Error Report'
  },
  coordination: {
    color: 'text-orange-600 bg-orange-100 border-orange-200',
    icon: ArrowRight,
    label: 'Coordination'
  },
  status_check: {
    color: 'text-gray-600 bg-gray-100 border-gray-200',
    icon: Clock,
    label: 'Status Check'
  }
};

export function AgentInteractionDisplay({
  agents,
  communications,
  isRealTime = false,
  className
}: AgentInteractionDisplayProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [messageTypeFilter, setMessageTypeFilter] = useState<MessageTypeFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [communications, autoScroll]);

  const filteredCommunications = communications.filter(comm => {
    // Message type filter
    if (messageTypeFilter !== 'all' && comm.messageType !== messageTypeFilter) {
      return false;
    }

    // Agent filter
    if (agentFilter !== 'all' && comm.fromAgent !== agentFilter && comm.toAgent !== agentFilter) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return comm.content.toLowerCase().includes(searchLower) ||
             getAgentName(comm.fromAgent).toLowerCase().includes(searchLower) ||
             getAgentName(comm.toAgent).toLowerCase().includes(searchLower);
    }

    return true;
  });

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || `Agent ${agentId.slice(0, 8)}`;
  };

  const getAgentType = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.type || 'unknown';
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatRelativeTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const exportCommunications = () => {
    const data = filteredCommunications.map(comm => ({
      timestamp: comm.timestamp,
      from: getAgentName(comm.fromAgent),
      to: getAgentName(comm.toAgent),
      type: comm.messageType,
      content: comm.content,
      priority: comm.metadata?.priority || 'medium',
      taskId: comm.metadata?.taskId || ''
    }));

    const csv = [
      'Timestamp,From,To,Type,Content,Priority,Task ID',
      ...data.map(row => 
        `"${row.timestamp}","${row.from}","${row.to}","${row.type}","${row.content}","${row.priority}","${row.taskId}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agent-communications-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderTimelineView = () => (
    <div className="space-y-4">
      {filteredCommunications.map((comm, index) => {
        const config = messageTypeConfig[comm.messageType];
        const Icon = config.icon;
        const fromAgent = getAgentName(comm.fromAgent);
        const toAgent = getAgentName(comm.toAgent);
        const fromType = getAgentType(comm.fromAgent);
        const toType = getAgentType(comm.toAgent);

        return (
          <div
            key={comm.id}
            className={cn(
              'relative flex items-start gap-4 p-4 border rounded-lg transition-all hover:shadow-sm',
              comm.metadata?.responseRequired ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
            )}
          >
            {/* Timeline connector */}
            {index < filteredCommunications.length - 1 && (
              <div className="absolute left-[30px] top-16 w-px h-6 bg-gray-200" />
            )}

            {/* Message type indicator */}
            <div className={cn('flex items-center justify-center w-8 h-8 rounded-full', config.color)}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Message content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={config.color}>
                    {config.label}
                  </Badge>
                  {comm.metadata?.priority && comm.metadata.priority !== 'medium' && (
                    <Badge 
                      variant={comm.metadata.priority === 'urgent' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {comm.metadata.priority}
                    </Badge>
                  )}
                  {comm.metadata?.responseRequired && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      Response Required
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatRelativeTime(comm.timestamp)}</span>
                  <span>•</span>
                  <span>{formatTime(comm.timestamp)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-sm">{fromAgent}</span>
                  <Badge variant="secondary" className="text-xs">{fromType}</Badge>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-sm">{toAgent}</span>
                  <Badge variant="secondary" className="text-xs">{toType}</Badge>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{comm.content}</p>
                
                {comm.metadata?.taskId && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <span className="text-xs text-gray-500">
                      Task: <code className="bg-white px-1 py-0.5 rounded">{comm.metadata.taskId}</code>
                    </span>
                  </div>
                )}
                
                {comm.metadata?.attachments && comm.metadata.attachments.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Attachments:</div>
                    <div className="flex flex-wrap gap-1">
                      {comm.metadata.attachments.map((attachment, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {attachment}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-500">
                  ID: {comm.id.slice(0, 8)}...
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(comm.content)}
                  className="h-6 px-2 text-xs"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      
      {filteredCommunications.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No communications found</h3>
          <p className="text-sm">
            {communications.length === 0 
              ? "Agent communications will appear here when they start interacting."
              : "Try adjusting your filters to see more messages."
            }
          </p>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );

  const renderConversationView = () => {
    // Group messages by conversation threads
    const conversations = filteredCommunications.reduce((acc, comm) => {
      const key = [comm.fromAgent, comm.toAgent].sort().join('-');
      if (!acc[key]) acc[key] = [];
      acc[key].push(comm);
      return acc;
    }, {} as Record<string, AgentCommunication[]>);

    return (
      <div className="space-y-6">
        {Object.entries(conversations).map(([conversationKey, messages]) => {
          const [agent1, agent2] = conversationKey.split('-');
          const agent1Name = getAgentName(agent1);
          const agent2Name = getAgentName(agent2);
          
          return (
            <Card key={conversationKey} className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">
                  {agent1Name} ↔ {agent2Name}
                </h3>
                <Badge variant="outline">
                  {messages.length} messages
                </Badge>
              </div>
              
              <div className="space-y-3">
                {messages.map((comm) => {
                  const config = messageTypeConfig[comm.messageType];
                  const isFromAgent1 = comm.fromAgent === agent1;
                  
                  return (
                    <div
                      key={comm.id}
                      className={cn(
                        'flex gap-3',
                        isFromAgent1 ? 'justify-start' : 'justify-end'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[70%] p-3 rounded-lg',
                          isFromAgent1 
                            ? 'bg-blue-100 text-blue-900' 
                            : 'bg-gray-100 text-gray-900'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={cn('text-xs', config.color)}>
                            {config.label}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatTime(comm.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comm.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
        
        {Object.keys(conversations).length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No conversations found</h3>
            <p className="text-sm">Agent conversations will appear here.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={cn('flex flex-col', isExpanded ? 'h-screen' : 'h-96', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Agent Communications</h3>
          {isRealTime && (
            <Badge variant="outline" className="text-green-600 border-green-300">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
              Live
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className={autoScroll ? 'bg-blue-50 border-blue-300' : ''}
          >
            Auto-scroll
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportCommunications}
            disabled={filteredCommunications.length === 0}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search communications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <select
            value={messageTypeFilter}
            onChange={(e) => setMessageTypeFilter(e.target.value as MessageTypeFilter)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="all">All Types</option>
            {Object.entries(messageTypeConfig).map(([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            ))}
          </select>

          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="all">All Agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>

          <div className="flex border border-gray-300 rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="rounded-none"
            >
              Timeline
            </Button>
            <Button
              variant={viewMode === 'conversation' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('conversation')}
              className="rounded-none"
            >
              Conversation
            </Button>
          </div>
        </div>

        {(messageTypeFilter !== 'all' || agentFilter !== 'all' || searchTerm) && (
          <div className="flex items-center gap-2 mt-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Showing {filteredCommunications.length} of {communications.length} communications
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessageTypeFilter('all');
                setAgentFilter('all');
                setSearchTerm('');
              }}
              className="text-xs"
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'timeline' ? renderTimelineView() : renderConversationView()}
      </div>
    </Card>
  );
}