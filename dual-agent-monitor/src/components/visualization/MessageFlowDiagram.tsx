import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AgentMessage, DualAgentSession } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  Settings, 
  Zap,
  ArrowRight,
  Users,
  Database,
  Cpu
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MessageFlowDiagramProps {
  session: DualAgentSession;
  messages: AgentMessage[];
  isRealTime?: boolean;
  onMessageSelect?: (messageId: string) => void;
  showFilters?: boolean;
}

interface FlowNode extends Node {
  data: {
    message: AgentMessage;
    label: string;
    type: 'manager' | 'worker' | 'system';
    messageType: string;
    duration?: number;
    tools?: string[];
    status?: 'success' | 'error' | 'pending';
  };
}

interface CommunicationStats {
  totalMessages: number;
  managerMessages: number;
  workerMessages: number;
  avgResponseTime: number;
  bottlenecks: string[];
  communicationPatterns: {
    managerToWorker: number;
    workerToManager: number;
    errors: number;
  };
}

const nodeTypes = {
  messageNode: ({ data }: { data: FlowNode['data'] }) => (
    <div 
      className={`px-3 py-2 rounded-lg border-2 min-w-[180px] max-w-[280px] transition-all duration-200 hover:shadow-lg ${
        data.type === 'manager' 
          ? 'bg-blue-50 border-blue-200 hover:border-blue-400' 
          : data.type === 'worker'
          ? 'bg-green-50 border-green-200 hover:border-green-400'
          : 'bg-gray-50 border-gray-200 hover:border-gray-400'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {data.type === 'manager' ? (
          <Users size={16} className="text-blue-600" />
        ) : data.type === 'worker' ? (
          <Cpu size={16} className="text-green-600" />
        ) : (
          <Settings size={16} className="text-gray-600" />
        )}
        <div className="font-medium text-sm capitalize">
          {data.type} • {data.messageType}
        </div>
        {data.status === 'error' && <AlertTriangle size={14} className="text-red-500" />}
        {data.status === 'success' && <CheckCircle size={14} className="text-green-500" />}
      </div>
      
      <div className="text-xs text-gray-600 mb-2 line-clamp-3">
        {data.message.content.length > 120 
          ? `${data.message.content.substring(0, 120)}...` 
          : data.message.content}
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {formatDistanceToNow(data.message.timestamp, { addSuffix: true })}
        </div>
        {data.duration && (
          <Badge variant="secondary" className="text-xs">
            {data.duration}ms
          </Badge>
        )}
      </div>
      
      {data.tools && data.tools.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.tools.slice(0, 3).map(tool => (
            <Badge key={tool} variant="outline" className="text-xs">
              {tool}
            </Badge>
          ))}
          {data.tools.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{data.tools.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  ),
};

const MessageFlowDiagramInternal: React.FC<MessageFlowDiagramProps> = ({
  session,
  messages,
  isRealTime = false,
  onMessageSelect,
  showFilters = true,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedMessageTypes, setSelectedMessageTypes] = useState<string[]>(['prompt', 'response', 'tool_call', 'tool_result']);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('vertical');
  const { fitView } = useReactFlow();
  const prevMessagesLength = useRef(messages.length);

  // Calculate communication statistics
  const communicationStats = useMemo<CommunicationStats>(() => {
    const managerMessages = messages.filter(m => m.agentType === 'manager');
    const workerMessages = messages.filter(m => m.agentType === 'worker');
    
    // Calculate response times
    const responseTimes: number[] = [];
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      if (current.agentType !== previous.agentType) {
        const timeDiff = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
        responseTimes.push(timeDiff);
      }
    }

    // Identify bottlenecks (messages with unusually long response times)
    const avgResponseTime = responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    const threshold = avgResponseTime * 2; // 2x average is considered a bottleneck
    const bottlenecks: string[] = [];
    
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      if (current.agentType !== previous.agentType) {
        const timeDiff = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
        if (timeDiff > threshold && timeDiff > 5000) { // Also more than 5 seconds
          bottlenecks.push(`${previous.agentType} → ${current.agentType}: ${Math.round(timeDiff)}ms`);
        }
      }
    }

    return {
      totalMessages: messages.length,
      managerMessages: managerMessages.length,
      workerMessages: workerMessages.length,
      avgResponseTime: Math.round(avgResponseTime),
      bottlenecks: bottlenecks.slice(0, 5), // Limit to 5 biggest bottlenecks
      communicationPatterns: {
        managerToWorker: messages.filter(m => 
          messages.find(n => n.timestamp > m.timestamp && n.agentType !== m.agentType) &&
          m.agentType === 'manager'
        ).length,
        workerToManager: messages.filter(m => 
          messages.find(n => n.timestamp > m.timestamp && n.agentType !== m.agentType) &&
          m.agentType === 'worker'
        ).length,
        errors: messages.filter(m => m.messageType === 'error').length,
      },
    };
  }, [messages]);

  // Generate nodes and edges from messages
  useEffect(() => {
    const filteredMessages = messages.filter(msg => {
      if (showOnlyErrors && msg.messageType !== 'error') return false;
      return selectedMessageTypes.includes(msg.messageType);
    });

    // Create nodes
    const newNodes: FlowNode[] = filteredMessages.map((message, index) => {
      const isHorizontal = layoutDirection === 'horizontal';
      const position = isHorizontal 
        ? { x: index * 300, y: message.agentType === 'manager' ? 0 : 200 }
        : { x: message.agentType === 'manager' ? 0 : 300, y: index * 150 };

      return {
        id: message.id,
        type: 'messageNode',
        position,
        data: {
          message,
          label: message.content.substring(0, 50),
          type: message.agentType,
          messageType: message.messageType,
          duration: message.metadata?.duration,
          tools: message.metadata?.tools,
          status: message.messageType === 'error' ? 'error' : 
                   message.metadata?.exitCode === 0 ? 'success' : 'pending',
        },
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
      };
    });

    // Create edges representing message flow and agent interactions
    const newEdges: Edge[] = [];
    
    for (let i = 1; i < filteredMessages.length; i++) {
      const current = filteredMessages[i];
      const previous = filteredMessages[i - 1];
      
      // Calculate response time for coloring
      const responseTime = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
      const isSlowResponse = responseTime > communicationStats.avgResponseTime * 1.5;
      
      newEdges.push({
        id: `${previous.id}-${current.id}`,
        source: previous.id,
        target: current.id,
        type: 'smoothstep',
        animated: isRealTime && i === filteredMessages.length - 1,
        style: { 
          stroke: isSlowResponse ? '#ef4444' : current.agentType !== previous.agentType ? '#3b82f6' : '#6b7280',
          strokeWidth: current.agentType !== previous.agentType ? 3 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isSlowResponse ? '#ef4444' : current.agentType !== previous.agentType ? '#3b82f6' : '#6b7280',
        },
        label: responseTime > 1000 ? `${Math.round(responseTime / 1000)}s` : undefined,
        labelStyle: { fontSize: 10, fill: '#666' },
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);

    // Auto-fit view when messages are added
    if (messages.length > prevMessagesLength.current && isRealTime) {
      setTimeout(() => fitView(), 100);
    }
    prevMessagesLength.current = messages.length;
  }, [messages, selectedMessageTypes, showOnlyErrors, layoutDirection, communicationStats.avgResponseTime, isRealTime, fitView]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: FlowNode) => {
    if (onMessageSelect) {
      onMessageSelect(node.data.message.id);
    }
  }, [onMessageSelect]);

  const messageTypeOptions = [
    { id: 'prompt', label: 'Prompts', color: 'blue' },
    { id: 'response', label: 'Responses', color: 'green' },
    { id: 'tool_call', label: 'Tool Calls', color: 'purple' },
    { id: 'tool_result', label: 'Tool Results', color: 'orange' },
    { id: 'error', label: 'Errors', color: 'red' },
    { id: 'system', label: 'System', color: 'gray' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Statistics Panel */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{communicationStats.managerMessages}</div>
            <div className="text-sm text-gray-600">Manager Messages</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{communicationStats.workerMessages}</div>
            <div className="text-sm text-gray-600">Worker Messages</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{communicationStats.avgResponseTime}ms</div>
            <div className="text-sm text-gray-600">Avg Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{communicationStats.communicationPatterns.errors}</div>
            <div className="text-sm text-gray-600">Errors</div>
          </div>
        </div>
        
        {communicationStats.bottlenecks.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-yellow-500" />
              <span className="font-medium text-sm">Communication Bottlenecks</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {communicationStats.bottlenecks.map((bottleneck, index) => (
                <Badge key={index} variant="destructive" className="text-xs">
                  {bottleneck}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-center gap-4">
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
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyErrors}
                  onChange={(e) => setShowOnlyErrors(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Errors Only</span>
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Layout:</span>
              <select
                value={layoutDirection}
                onChange={(e) => setLayoutDirection(e.target.value as 'horizontal' | 'vertical')}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Flow Diagram */}
      <Card className="flex-1 relative overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          className="bg-gray-50"
        >
          <Background />
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              const nodeData = node.data as FlowNode['data'];
              return nodeData.type === 'manager' ? '#3b82f6' : 
                     nodeData.type === 'worker' ? '#10b981' : '#6b7280';
            }}
            className="!bg-white !border-2 !border-gray-200"
          />
          
          {/* Real-time indicator */}
          {isRealTime && (
            <Panel position="top-right">
              <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-600">Live Updates</span>
                </div>
              </div>
            </Panel>
          )}
          
          {/* Legend */}
          <Panel position="bottom-right">
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="text-xs font-medium mb-2">Legend</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-100 border-2 border-blue-200 rounded"></div>
                  <span>Manager</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-100 border-2 border-green-200 rounded"></div>
                  <span>Worker</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight size={12} className="text-blue-500" />
                  <span>Agent Switch</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight size={12} className="text-red-500" />
                  <span>Slow Response</span>
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </Card>
    </div>
  );
};

export const MessageFlowDiagram: React.FC<MessageFlowDiagramProps> = (props) => {
  return (
    <ReactFlowProvider>
      <MessageFlowDiagramInternal {...props} />
    </ReactFlowProvider>
  );
};