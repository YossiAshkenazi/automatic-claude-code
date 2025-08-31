import React, { useMemo } from 'react';
import { ArrowRight, MessageCircle, Wrench, AlertCircle, Settings } from 'lucide-react';
import { DualAgentSession, AgentMessage } from '../types';
import { formatTimestamp, getAgentColor } from '../utils/formatters';

interface TimelineProps {
  session: DualAgentSession;
}

interface TimelineEvent {
  id: string;
  timestamp: Date;
  agentType: 'manager' | 'worker';
  type: AgentMessage['messageType'];
  content: string;
  isInteraction?: boolean;
  relatedMessageId?: string;
}

export function Timeline({ session }: TimelineProps) {
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];
    
    // Convert messages to timeline events
    session.messages.forEach((message) => {
      events.push({
        id: message.id,
        timestamp: new Date(message.timestamp),
        agentType: message.agentType,
        type: message.messageType,
        content: message.content,
      });
    });
    
    // Sort by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Identify agent interactions (consecutive messages from different agents)
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];
      
      if (prev.agentType !== curr.agentType && 
          Math.abs(curr.timestamp.getTime() - prev.timestamp.getTime()) < 30000) { // Within 30 seconds
        curr.isInteraction = true;
        curr.relatedMessageId = prev.id;
      }
    }
    
    return events;
  }, [session.messages]);

  const getEventIcon = (type: AgentMessage['messageType']) => {
    switch (type) {
      case 'prompt':
        return <MessageCircle size={16} />;
      case 'response':
        return <MessageCircle size={16} className="rotate-180" />;
      case 'tool_call':
        return <Tool size={16} />;
      case 'error':
        return <AlertCircle size={16} />;
      case 'system':
        return <Settings size={16} />;
      default:
        return <MessageCircle size={16} />;
    }
  };

  const truncateContent = (content: string, maxLength: number = 60) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (timelineEvents.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No timeline events yet
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        Communication Timeline
      </h3>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        {timelineEvents.map((event, index) => (
          <div key={event.id} className="relative flex items-start gap-4 pb-6">
            {/* Timeline dot */}
            <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
              event.agentType === 'manager' ? 'bg-purple-100' : 'bg-blue-100'
            }`}>
              {getEventIcon(event.type)}
            </div>
            
            {/* Event content */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${getAgentColor(event.agentType)}`}>
                      {event.agentType === 'manager' ? 'Manager' : 'Worker'}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      {event.type.replace('_', ' ')}
                    </span>
                    {event.isInteraction && (
                      <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                        <ArrowRight size={12} />
                        Interaction
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                
                <div className="text-sm text-gray-700">
                  {truncateContent(event.content)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Summary statistics */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Timeline Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
          <div>
            <span className="text-purple-600 font-medium">Manager:</span>
            {' ' + timelineEvents.filter(e => e.agentType === 'manager').length} events
          </div>
          <div>
            <span className="text-blue-600 font-medium">Worker:</span>
            {' ' + timelineEvents.filter(e => e.agentType === 'worker').length} events
          </div>
          <div>
            <span className="font-medium">Interactions:</span>
            {' ' + timelineEvents.filter(e => e.isInteraction).length}
          </div>
          <div>
            <span className="font-medium">Duration:</span>
            {' ' + (session.endTime 
              ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000) + 's'
              : 'Ongoing'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}