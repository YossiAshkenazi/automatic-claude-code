import React, { memo, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  NodeTypes,
  EdgeTypes,
  BackgroundVariant,
  Panel,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';

import { AgentNode } from './AgentNode';
import { TaskFlow } from './TaskFlow';
import { ConnectionLine } from './ConnectionLine';
import { WorkflowNode, WorkflowEdge, FlowCanvasProps } from './types';

// Custom node types
const nodeTypes: NodeTypes = {
  agent: AgentNode,
  task: TaskFlow,
};

// Custom edge types
const edgeTypes: EdgeTypes = {
  'task-flow': ConnectionLine,
  communication: ConnectionLine,
  default: ConnectionLine,
};

const FlowCanvas = memo<FlowCanvasProps>(({ 
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onSelectionChange,
  showMinimap = true,
  showControls = true,
  enableInteraction = true,
  height = '100%',
  className = ''
}) => {
  // Handle connection between nodes
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (onConnect) {
        // Add custom styling and animation to new connections
        const newEdge: WorkflowEdge = {
          ...connection,
          id: `${connection.source}-${connection.target}-${Date.now()}`,
          type: 'default',
          animated: true,
          data: {
            status: 'pending',
            animated: true,
            color: '#8b5cf6' // purple-500
          }
        } as WorkflowEdge;
        
        onConnect(newEdge);
      }
    },
    [onConnect]
  );

  // Handle node selection
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      onNodeClick?.(event, node as WorkflowNode);
    },
    [onNodeClick]
  );

  // Handle edge selection
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      onEdgeClick?.(event, edge as WorkflowEdge);
    },
    [onEdgeClick]
  );

  // Handle selection changes
  const handleSelectionChange = useCallback(
    (selection: { nodes: Node[]; edges: Edge[] }) => {
      onSelectionChange?.({
        nodes: selection.nodes as WorkflowNode[],
        edges: selection.edges as WorkflowEdge[]
      });
    },
    [onSelectionChange]
  );

  // MiniMap node colors
  const minimapNodeColor = useCallback((node: Node) => {
    const workflowNode = node as WorkflowNode;
    
    switch (workflowNode.type) {
      case 'agent': {
        const agentData = workflowNode.data as any;
        return agentData.agentType === 'manager' ? '#8b5cf6' : '#3b82f6'; // purple or blue
      }
      case 'task': {
        const taskData = workflowNode.data as any;
        switch (taskData.status) {
          case 'completed':
            return '#10b981'; // green
          case 'failed':
            return '#ef4444'; // red
          case 'in-progress':
            return '#f59e0b'; // amber
          default:
            return '#6b7280'; // gray
        }
      }
      default:
        return '#9ca3af';
    }
  }, []);

  // Default viewport settings
  const defaultViewport = useMemo(() => ({
    x: 0,
    y: 0,
    zoom: 0.8
  }), []);

  // Connection line style
  const connectionLineStyle = useMemo(() => ({
    strokeWidth: 2,
    stroke: '#8b5cf6',
    strokeDasharray: '5,5'
  }), []);

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineStyle={connectionLineStyle}
        defaultViewport={defaultViewport}
        attributionPosition="bottom-left"
        nodesDraggable={enableInteraction}
        nodesConnectable={enableInteraction}
        elementsSelectable={enableInteraction}
        selectNodesOnDrag={enableInteraction}
        panOnDrag={enableInteraction}
        zoomOnScroll={enableInteraction}
        zoomOnPinch={enableInteraction}
        zoomOnDoubleClick={enableInteraction}
        preventScrolling={true}
        minZoom={0.1}
        maxZoom={4}
        snapToGrid={true}
        snapGrid={[20, 20]}
        fitView
        fitViewOptions={{
          padding: 0.1,
          includeHiddenNodes: false,
          minZoom: 0.1,
          maxZoom: 1.5
        }}
      >
        {/* Background with grid pattern */}
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="#e5e7eb"
          style={{ opacity: 0.3 }}
        />
        
        {/* Controls panel */}
        {showControls && (
          <Controls 
            position="bottom-right"
            showZoom={true}
            showFitView={true}
            showInteractive={true}
            fitViewOptions={{
              padding: 0.1,
              includeHiddenNodes: false
            }}
          />
        )}
        
        {/* MiniMap */}
        {showMinimap && (
          <MiniMap
            position="bottom-left"
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={3}
            zoomable
            pannable
            style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
        )}
        
        {/* Status Panel */}
        <Panel position="top-left">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="text-sm text-gray-600">
              <div className="flex items-center gap-4">
                <span>{nodes.length} nodes</span>
                <span>{edges.length} connections</span>
              </div>
            </div>
          </div>
        </Panel>
        
        {/* Legend Panel */}
        <Panel position="top-right">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Legend</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span>Manager Agent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Worker Agent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span>Completed Task</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-500"></div>
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gray-400"></div>
                <span>Pending</span>
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
});

FlowCanvas.displayName = 'FlowCanvas';

// Wrapper component with ReactFlowProvider
const FlowCanvasWrapper = (props: FlowCanvasProps) => {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
};

FlowCanvasWrapper.displayName = 'FlowCanvasWrapper';

export { FlowCanvasWrapper as FlowCanvas };