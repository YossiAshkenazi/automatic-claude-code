import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AgentMessage, DualAgentSession } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter,
  MessageSquare, 
  Play,
  Pause,
  RotateCcw,
  Search,
  Settings,
  Zap,
  ZoomIn,
  ZoomOut,
  Users,
  Cpu,
  Database,
  Code,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { format, formatDistanceToNow, isSameMinute, differenceInMilliseconds } from 'date-fns';
import * as d3 from 'd3';

interface CommunicationTimelineProps {
  session: DualAgentSession;
  messages: AgentMessage[];
  isRealTime?: boolean;
  onMessageSelect?: (messageId: string) => void;
  height?: number;
}

interface TimelineGroup {
  timestamp: Date;
  messages: AgentMessage[];
  isExpanded: boolean;
}

interface MessageThread {
  id: string;
  messages: AgentMessage[];
  startTime: Date;
  endTime: Date;
  agentSwitches: number;
  avgResponseTime: number;
  hasErrors: boolean;
}

const MessageTypeIcons: Record<string, React.ReactNode> = {
  'prompt': <MessageSquare size={14} className="text-blue-500" />,
  'response': <ArrowRight size={14} className="text-green-500" />,
  'tool_call': <Settings size={14} className="text-purple-500" />,
  'tool_use': <Code size={14} className="text-orange-500" />,
  'tool_result': <Database size={14} className="text-yellow-500" />,
  'error': <AlertTriangle size={14} className="text-red-500" />,
  'system': <Activity size={14} className="text-gray-500" />,
};

export const CommunicationTimeline: React.FC<CommunicationTimelineProps> = ({
  session,
  messages,
  isRealTime = false,
  onMessageSelect,
  height = 600,
}) => {
  const [selectedMessageTypes, setSelectedMessageTypes] = useState<string[]>(['prompt', 'response', 'tool_call', 'tool_result']);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(['manager', 'worker']);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [showThreads, setShowThreads] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackInterval = useRef<NodeJS.Timeout>();

  // Filter and process messages
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (!selectedMessageTypes.includes(msg.messageType)) return false;
      if (!selectedAgents.includes(msg.agentType)) return false;
      if (searchQuery && !msg.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [messages, selectedMessageTypes, selectedAgents, searchQuery]);

  // Group messages by time intervals for better visualization
  const messageGroups = useMemo<TimelineGroup[]>(() => {
    const groups: TimelineGroup[] = [];
    const groupedByMinute = new Map<string, AgentMessage[]>();

    filteredMessages.forEach(msg => {
      const key = format(msg.timestamp, 'yyyy-MM-dd HH:mm');
      if (!groupedByMinute.has(key)) {
        groupedByMinute.set(key, []);
      }
      groupedByMinute.get(key)!.push(msg);
    });

    Array.from(groupedByMinute.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, msgs]) => {
        groups.push({
          timestamp: new Date(msgs[0].timestamp),
          messages: msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
          isExpanded: true,
        });
      });

    return groups;
  }, [filteredMessages]);

  // Identify message threads (conversation sequences)
  const messageThreads = useMemo<MessageThread[]>(() => {
    if (!showThreads) return [];
    
    const threads: MessageThread[] = [];
    let currentThread: AgentMessage[] = [];
    let threadId = 0;

    filteredMessages.forEach((msg, index) => {
      currentThread.push(msg);
      
      // End thread if there's a significant time gap (>5 minutes) or it's the last message
      const nextMsg = filteredMessages[index + 1];
      const shouldEndThread = !nextMsg || 
        differenceInMilliseconds(new Date(nextMsg.timestamp), new Date(msg.timestamp)) > 5 * 60 * 1000;

      if (shouldEndThread && currentThread.length > 1) {
        const agentSwitches = currentThread.reduce((count, curr, idx) => {
          if (idx > 0 && curr.agentType !== currentThread[idx - 1].agentType) {
            return count + 1;
          }
          return count;
        }, 0);

        const responseTimes: number[] = [];
        for (let i = 1; i < currentThread.length; i++) {
          if (currentThread[i].agentType !== currentThread[i - 1].agentType) {
            responseTimes.push(
              differenceInMilliseconds(
                new Date(currentThread[i].timestamp),
                new Date(currentThread[i - 1].timestamp)
              )
            );
          }
        }

        threads.push({
          id: `thread-${threadId++}`,
          messages: [...currentThread],
          startTime: new Date(currentThread[0].timestamp),
          endTime: new Date(currentThread[currentThread.length - 1].timestamp),
          agentSwitches,
          avgResponseTime: responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
          hasErrors: currentThread.some(m => m.messageType === 'error'),
        });

        currentThread = [];
      }
    });

    return threads;
  }, [filteredMessages, showThreads]);

  // Timeline visualization using D3
  useEffect(() => {
    if (!svgRef.current || filteredMessages.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 80 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const timelineHeight = height - margin.top - margin.bottom;

    const timeExtent = d3.extent(filteredMessages, d => new Date(d.timestamp)) as [Date, Date];
    if (!timeExtent[0] || !timeExtent[1]) return;

    const xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, width * zoomLevel]);

    const yScale = d3.scaleBand()
      .domain(['manager', 'worker'])
      .range([0, timelineHeight])
      .paddingInner(0.2);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add zoom behavior
    const zoom = d3.zoom<SVGGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { transform } = event;
        setZoomLevel(transform.k);
        g.attr('transform', `translate(${margin.left + transform.x},${margin.top}) scale(${transform.k}, 1)`);
      });

    svg.call(zoom);

    // Draw timeline lanes
    g.selectAll('.lane')
      .data(['manager', 'worker'])
      .enter().append('rect')
      .attr('class', 'lane')
      .attr('x', 0)
      .attr('y', d => yScale(d)!)
      .attr('width', width * zoomLevel)
      .attr('height', yScale.bandwidth())
      .attr('fill', (d, i) => i % 2 === 0 ? '#f8fafc' : '#f1f5f9')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);

    // Draw lane labels
    g.selectAll('.lane-label')
      .data(['manager', 'worker'])
      .enter().append('text')
      .attr('class', 'lane-label')
      .attr('x', -10)
      .attr('y', d => yScale(d)! + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text(d => d.charAt(0).toUpperCase() + d.slice(1));

    // Draw messages as circles
    const messageSelection = g.selectAll('.message-point')
      .data(filteredMessages.slice(0, playbackPosition || filteredMessages.length))
      .enter().append('g')
      .attr('class', 'message-point')
      .attr('transform', d => `translate(${xScale(new Date(d.timestamp))}, ${yScale(d.agentType)! + yScale.bandwidth() / 2})`);

    messageSelection.append('circle')
      .attr('r', d => d.messageType === 'error' ? 6 : 4)
      .attr('fill', d => {
        switch (d.messageType) {
          case 'prompt': return '#3b82f6';
          case 'response': return '#10b981';
          case 'tool_call': return '#8b5cf6';
          case 'tool_use': return '#f59e0b';
          case 'tool_result': return '#eab308';
          case 'error': return '#ef4444';
          default: return '#6b7280';
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (onMessageSelect) onMessageSelect(d.id);
      })
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', d.messageType === 'error' ? 8 : 6);
        
        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');

        tooltip.html(`
          <div><strong>${d.agentType.toUpperCase()}</strong> • ${d.messageType}</div>
          <div>${format(d.timestamp, 'HH:mm:ss')}</div>
          <div>${d.content.substring(0, 100)}${d.content.length > 100 ? '...' : ''}</div>
          ${d.metadata?.tools ? `<div>Tools: ${d.metadata.tools.join(', ')}</div>` : ''}
          ${d.metadata?.duration ? `<div>Duration: ${d.metadata.duration}ms</div>` : ''}
        `);

        const [mouseX, mouseY] = d3.pointer(event, document.body);
        tooltip.style('left', `${mouseX + 10}px`)
               .style('top', `${mouseY - 10}px`);
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('r', d.messageType === 'error' ? 6 : 4);
        d3.selectAll('.tooltip').remove();
      });

    // Draw connection lines between agent switches
    const connectionLines: Array<[AgentMessage, AgentMessage]> = [];
    for (let i = 1; i < filteredMessages.length; i++) {
      const current = filteredMessages[i];
      const previous = filteredMessages[i - 1];
      if (current.agentType !== previous.agentType) {
        connectionLines.push([previous, current]);
      }
    }

    g.selectAll('.connection-line')
      .data(connectionLines.slice(0, Math.floor((playbackPosition || filteredMessages.length) / 2)))
      .enter().append('path')
      .attr('class', 'connection-line')
      .attr('d', ([prev, curr]) => {
        const x1 = xScale(new Date(prev.timestamp));
        const y1 = yScale(prev.agentType)! + yScale.bandwidth() / 2;
        const x2 = xScale(new Date(curr.timestamp));
        const y2 = yScale(curr.agentType)! + yScale.bandwidth() / 2;
        
        return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + (y1 < y2 ? -20 : 20)} ${x2} ${y2}`;
      })
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2')
      .attr('opacity', 0.6);

    // Draw time axis
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.timeFormat('%H:%M'));
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${timelineHeight})`)
      .call(xAxis);

  }, [filteredMessages, zoomLevel, playbackPosition, height, onMessageSelect]);

  // Playback controls
  useEffect(() => {
    if (isPlaying) {
      playbackInterval.current = setInterval(() => {
        setPlaybackPosition(prev => {
          if (prev >= filteredMessages.length) {
            setIsPlaying(false);
            return filteredMessages.length;
          }
          return prev + 1;
        });
      }, 500); // Show one new message every 500ms
    } else {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
    }

    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
    };
  }, [isPlaying, filteredMessages.length]);

  // Auto-scroll to latest messages in real-time mode
  useEffect(() => {
    if (isRealTime && timelineRef.current) {
      timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
    }
  }, [messages.length, isRealTime]);

  const messageTypeOptions = [
    { id: 'prompt', label: 'Prompts', color: 'blue' },
    { id: 'response', label: 'Responses', color: 'green' },
    { id: 'tool_call', label: 'Tool Calls', color: 'purple' },
    { id: 'tool_use', label: 'Tool Use', color: 'orange' },
    { id: 'tool_result', label: 'Tool Results', color: 'yellow' },
    { id: 'error', label: 'Errors', color: 'red' },
    { id: 'system', label: 'System', color: 'gray' },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Statistics Panel */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{filteredMessages.length}</div>
            <div className="text-sm text-gray-600">Total Messages</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{messageThreads.length}</div>
            <div className="text-sm text-gray-600">Conversations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {messageThreads.reduce((sum, thread) => sum + thread.agentSwitches, 0)}
            </div>
            <div className="text-sm text-gray-600">Agent Switches</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(messageThreads.reduce((sum, thread) => sum + thread.avgResponseTime, 0) / messageThreads.length || 0)}ms
            </div>
            <div className="text-sm text-gray-600">Avg Response</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {filteredMessages.filter(m => m.messageType === 'error').length}
            </div>
            <div className="text-sm text-gray-600">Errors</div>
          </div>
        </div>
      </Card>

      {/* Controls Panel */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => {
                setPlaybackPosition(0);
                setIsPlaying(false);
              }}
              className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RotateCcw size={16} />
              Reset
            </button>
            <div className="text-sm text-gray-600">
              {playbackPosition || filteredMessages.length} / {filteredMessages.length}
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.1, prev - 0.2))}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-sm text-gray-600 min-w-[4rem] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(5, prev + 0.2))}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <Search size={16} className="text-gray-500" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48"
            />
          </div>

          {/* Thread View Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showThreads}
              onChange={(e) => setShowThreads(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show Threads</span>
          </label>
        </div>

        {/* Filters Row */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Message Types:</span>
            {messageTypeOptions.map(option => (
              <label key={option.id} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMessageTypes.includes(option.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMessageTypes(prev => [...prev, option.id]);
                    } else {
                      setSelectedMessageTypes(prev => prev.filter(t => t !== option.id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Agents:</span>
            {['manager', 'worker'].map(agent => (
              <label key={agent} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAgents.includes(agent)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAgents(prev => [...prev, agent]);
                    } else {
                      setSelectedAgents(prev => prev.filter(a => a !== agent));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm capitalize">{agent}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* Timeline Visualization */}
      <Card className="flex-1 p-4">
        <div 
          ref={timelineRef}
          className="w-full overflow-x-auto"
          style={{ height: height - 200 }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height={height}
            className="border border-gray-200 rounded"
          />
        </div>

        {/* Real-time indicator */}
        {isRealTime && (
          <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-600">Live Updates</span>
            </div>
          </div>
        )}
      </Card>

      {/* Message Threads Panel */}
      {showThreads && messageThreads.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <MessageSquare size={16} />
            Message Threads ({messageThreads.length})
          </h3>
          <div className="space-y-3">
            {messageThreads.slice(0, 5).map(thread => (
              <div key={thread.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <div className="font-medium">
                      {format(thread.startTime, 'HH:mm')} - {format(thread.endTime, 'HH:mm')}
                    </div>
                    <div className="text-gray-600">
                      {thread.messages.length} messages, {thread.agentSwitches} switches
                    </div>
                  </div>
                  {thread.hasErrors && (
                    <AlertTriangle size={16} className="text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div>Avg: {Math.round(thread.avgResponseTime)}ms</div>
                  <Badge variant={thread.hasErrors ? 'destructive' : 'secondary'}>
                    {thread.hasErrors ? 'Has Errors' : 'Clean'}
                  </Badge>
                </div>
              </div>
            ))}
            {messageThreads.length > 5 && (
              <div className="text-sm text-gray-500 text-center">
                ... and {messageThreads.length - 5} more threads
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};