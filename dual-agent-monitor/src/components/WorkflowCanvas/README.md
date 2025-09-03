# WorkflowCanvas - Interactive Real-time Agent Visualization

The WorkflowCanvas is a comprehensive interactive visualization system for dual-agent Claude Code workflows, providing real-time visual representation of agent interactions, task flows, and system communications.

## Overview

This component suite transforms complex multi-agent workflows into intuitive, interactive visualizations that make agent coordination visible and manageable. Built with React Flow, it provides smooth animations, real-time updates, and interactive controls for workflow management.

## Features

### 🎯 Core Capabilities
- **Real-time Visualization**: Live updates of agent status and task progress
- **Interactive Canvas**: Drag-and-drop task management and workflow editing
- **Agent Representation**: Visual nodes for Manager and Worker agents with live status
- **Task Flow Visualization**: Animated connections showing task handoffs
- **Progress Tracking**: Real-time progress indicators and completion status
- **Communication Lines**: Visual representation of inter-agent messaging

### 🎨 Visual Features
- **Responsive Design**: Adapts to different screen sizes and zoom levels
- **Smooth Animations**: Task handoffs and communication with fluid motion
- **Status Indicators**: Color-coded visual feedback for all workflow states
- **Interactive Controls**: Comprehensive control panel with filters and settings
- **Minimap Navigation**: Bird's eye view for large workflow navigation
- **Grid Background**: Optional alignment grid for precise positioning

### ⚡ Performance Features
- **WebSocket Integration**: Real-time updates with <100ms latency
- **Optimized Rendering**: Efficient React Flow integration with minimal re-renders
- **Memory Management**: Automatic cleanup and resource management
- **Scalable Architecture**: Handles complex workflows with hundreds of nodes

## Component Architecture

```
WorkflowCanvas/
├── WorkflowCanvas.tsx      # Main orchestrator component
├── FlowCanvas.tsx          # React Flow integration layer
├── AgentNode.tsx           # Agent visualization component
├── TaskFlow.tsx            # Task representation component  
├── ConnectionLine.tsx      # Inter-component connections
├── ProgressIndicator.tsx   # Progress visualization
├── WorkflowControls.tsx    # Control panel and settings
├── types.ts                # TypeScript definitions
└── index.ts                # Exports
```

## Usage

### Basic Implementation

```tsx
import { WorkflowCanvas } from './components/WorkflowCanvas';

function MyWorkflowView() {
  return (
    <WorkflowCanvas
      session={currentSession}
      messages={sessionMessages}
      isRealTime={true}
      showControls={true}
      showMinimap={true}
      enableInteraction={true}
      height="600px"
      onNodeSelect={(nodeId, nodeType) => {
        console.log('Selected:', nodeId, nodeType);
      }}
      onTaskAssign={(taskId, agentType) => {
        // Handle task assignment
      }}
    />
  );
}
```

### Advanced Configuration

```tsx
<WorkflowCanvas
  session={session}
  messages={messages}
  isRealTime={isConnected}
  onNodeSelect={handleNodeSelection}
  onEdgeSelect={handleConnectionSelection}
  onTaskAssign={handleTaskAssignment}
  onTaskCreate={handleTaskCreation}
  showControls={true}
  showMinimap={true}
  enableInteraction={true}
  height="calc(100vh - 200px)"
  className="custom-workflow-canvas"
/>
```

## Component Details

### WorkflowCanvas (Main Component)

**Props:**
- `session: DualAgentSession` - Current agent session data
- `messages: AgentMessage[]` - Message history for visualization
- `isRealTime?: boolean` - Enable real-time updates
- `onNodeSelect?: (nodeId: string, nodeType: string) => void` - Node selection handler
- `onEdgeSelect?: (edgeId: string) => void` - Connection selection handler
- `onTaskAssign?: (taskId: string, agentType: 'manager' | 'worker') => void` - Task assignment handler
- `onTaskCreate?: (task: Partial<TaskFlowData>) => void` - New task creation handler
- `showControls?: boolean` - Show/hide control panel
- `showMinimap?: boolean` - Show/hide minimap navigation
- `enableInteraction?: boolean` - Enable/disable user interaction
- `height?: string | number` - Canvas height
- `className?: string` - Custom CSS classes

### AgentNode

Represents Manager and Worker agents with:
- **Real-time Status**: Idle, Busy, Error, Offline states
- **Performance Metrics**: Task completion, response times, success rates
- **Current Activity**: Display of current task or last activity
- **Interactive Controls**: Start, pause, stop agent operations
- **Connection Points**: Handles for task and communication connections

### TaskFlow

Visualizes individual tasks with:
- **Progress Tracking**: Animated progress bars and percentage indicators
- **Status Visualization**: Color-coded status (pending, in-progress, completed, failed)
- **Assignment Display**: Shows which agent is handling the task
- **Metadata Information**: Files involved, tools used, timing data
- **Interactive Actions**: Drag-and-drop reassignment, status changes

### ConnectionLine

Animated connections between nodes:
- **Communication Lines**: Real-time message flow between agents
- **Task Handoffs**: Animated task transfers with progress indicators
- **Status Colors**: Dynamic coloring based on connection type and status
- **Interactive Labels**: Clickable labels with message details
- **Flow Animations**: Directional animations showing data flow

### ProgressIndicator

Comprehensive progress visualization:
- **Circular Progress**: Animated circular progress with percentage
- **Status Icons**: Visual indicators for different states
- **Trend Analysis**: Up/down/stable trend indicators
- **Time Estimates**: Estimated completion times
- **Interactive Details**: Click for detailed progress information

### WorkflowControls

Comprehensive control panel:
- **View Controls**: Zoom, pan, fit-to-view, reset
- **Playback Controls**: Play, pause, stop workflow execution
- **Display Options**: Toggle minimap, grid, filters
- **Filter Panel**: Status, agent, and time range filtering
- **Advanced Settings**: Animation speed, node spacing, layout options
- **Export Options**: Save workflow as image or data

## Real-time Features

### WebSocket Integration

```tsx
// Automatic WebSocket updates
const { isConnected, sendMessage } = useWebSocket('ws://localhost:4005');

// Real-time agent status updates
useEffect(() => {
  if (isRealTime && isPlaying) {
    const interval = setInterval(() => {
      // Update agent nodes based on recent activity
      updateAgentStatus();
    }, 5000);
    return () => clearInterval(interval);
  }
}, [isRealTime, isPlaying]);
```

### Animation System

- **Task Flow Animations**: Smooth transitions when tasks move between agents
- **Status Change Effects**: Pulse animations when agent status changes
- **Communication Pulses**: Visual pulses for real-time message flow
- **Progress Animations**: Smooth progress bar updates
- **Connection Animations**: Animated lines for active communications

## Styling and Theming

### CSS Classes

```css
/* Main canvas container */
.workflow-canvas {
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

/* Agent nodes */
.agent-node-manager {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.agent-node-worker {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

/* Task nodes */
.task-node-completed {
  background: linear-gradient(135deg, #10b981, #059669);
}

.task-node-in-progress {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

/* Connection lines */
.connection-communication {
  stroke: #3b82f6;
  stroke-width: 2;
  animation: pulse 2s infinite;
}

.connection-task-flow {
  stroke: #8b5cf6;
  stroke-width: 2.5;
  stroke-dasharray: 5,5;
  animation: dash 1s linear infinite;
}
```

### Customization

```tsx
// Custom node colors
const customTheme = {
  agents: {
    manager: '#8b5cf6',
    worker: '#3b82f6'
  },
  tasks: {
    pending: '#6b7280',
    inProgress: '#f59e0b',
    completed: '#10b981',
    failed: '#ef4444'
  },
  connections: {
    communication: '#3b82f6',
    taskFlow: '#8b5cf6'
  }
};
```

## Event Handling

### Node Events

```tsx
const handleNodeSelect = (nodeId: string, nodeType: string) => {
  switch (nodeType) {
    case 'agent':
      // Show agent details panel
      showAgentDetails(nodeId);
      break;
    case 'task':
      // Show task details modal
      showTaskDetails(nodeId);
      break;
  }
};

const handleTaskAssign = (taskId: string, agentType: 'manager' | 'worker') => {
  // Send task assignment via WebSocket
  sendMessage({
    type: 'task_assign',
    taskId,
    agentType
  });
};
```

### Drag and Drop

```tsx
// Enable drag-and-drop task reassignment
const onConnect = useCallback((connection) => {
  // Handle new connections between nodes
  if (connection.source.includes('task') && connection.target.includes('agent')) {
    handleTaskReassignment(connection.source, connection.target);
  }
}, []);
```

## Performance Optimization

### Rendering Optimization

- **React.memo**: All components are memoized to prevent unnecessary re-renders
- **Selective Updates**: Only update nodes/edges that have changed
- **Viewport Culling**: Only render visible nodes and connections
- **Animation Throttling**: Smooth animations without performance impact

### Memory Management

```tsx
useEffect(() => {
  // Cleanup interval timers
  return () => {
    clearInterval(animationInterval);
    clearTimeout(updateTimeout);
  };
}, []);
```

### Bundle Size

- **Tree Shaking**: Only imports used React Flow components
- **Dynamic Imports**: Lazy load non-essential features
- **Icon Optimization**: Selective icon imports from Lucide React

## Integration with Existing System

### WebSocket Events

```typescript
// Listen for real-time updates
interface WorkflowEvent {
  type: 'agent_status_change' | 'task_update' | 'message_flow';
  data: {
    agentId?: string;
    taskId?: string;
    messageId?: string;
    status?: string;
    progress?: number;
  };
}
```

### API Integration

```typescript
// Sync with backend API
const syncWorkflowState = async () => {
  const response = await fetch('/api/workflow/state');
  const workflowData = await response.json();
  updateWorkflowCanvas(workflowData);
};
```

## Accessibility Features

- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader Support**: Semantic HTML and ARIA labels
- **High Contrast Mode**: Support for accessibility themes
- **Focus Management**: Proper focus handling for complex interactions
- **Alternative Text**: Descriptive text for all visual elements

## Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **WebSocket Support**: Required for real-time features
- **Canvas Rendering**: Hardware acceleration recommended
- **Touch Devices**: Full touch support for mobile/tablet interaction

## Testing

### Unit Tests

```tsx
import { render, screen } from '@testing-library/react';
import { WorkflowCanvas } from './WorkflowCanvas';

test('renders workflow canvas with agents', () => {
  render(
    <WorkflowCanvas 
      session={mockSession} 
      messages={mockMessages} 
    />
  );
  
  expect(screen.getByText('Manager Agent')).toBeInTheDocument();
  expect(screen.getByText('Worker Agent')).toBeInTheDocument();
});
```

### Integration Tests

- **WebSocket Communication**: Test real-time updates
- **Drag and Drop**: Test interactive task management
- **Animation Performance**: Test smooth animations under load
- **Responsive Design**: Test across different screen sizes

## Troubleshooting

### Common Issues

1. **Nodes not appearing**: Check that session and messages data is properly formatted
2. **Animations not smooth**: Ensure hardware acceleration is enabled
3. **WebSocket not connecting**: Verify WebSocket server is running on correct port
4. **Performance issues**: Check for memory leaks in useEffect cleanup
5. **Layout problems**: Verify React Flow CSS is properly imported

### Debug Mode

```tsx
<WorkflowCanvas
  {...props}
  debug={true} // Enable debug logging
/>
```

### Performance Monitoring

```tsx
// Monitor render performance
const [renderTime, setRenderTime] = useState(0);

useEffect(() => {
  const start = performance.now();
  // ... component logic
  setRenderTime(performance.now() - start);
}, [nodes, edges]);
```

## Future Enhancements

- **3D Visualization**: Three-dimensional workflow representation
- **Time Travel**: Replay workflow history with timeline scrubbing
- **Advanced Analytics**: Built-in performance analytics and insights
- **Custom Node Types**: Plugin system for custom workflow components
- **Collaborative Editing**: Multi-user workflow editing capabilities
- **Export Formats**: Additional export options (SVG, PDF, video)
- **Voice Integration**: Voice commands for accessibility
- **AI Insights**: Machine learning-powered workflow optimization suggestions

---

**Created**: 2024-09-03  
**Version**: 1.0.0  
**Compatibility**: React 18+, TypeScript 5+, React Flow 11+  
**License**: MIT
