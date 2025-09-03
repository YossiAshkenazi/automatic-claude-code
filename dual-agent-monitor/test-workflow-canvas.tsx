// Test file to verify WorkflowCanvas components compile correctly
import React from 'react';
import { WorkflowCanvas } from './src/components/WorkflowCanvas';
import type { DualAgentSession, AgentMessage } from './src/types';

// Mock data for testing
const mockSession: DualAgentSession = {
  id: 'test-session',
  startTime: new Date(),
  status: 'running',
  initialTask: 'Test task',
  workDir: '/test',
  messages: []
};

const mockMessages: AgentMessage[] = [
  {
    id: 'msg-1',
    sessionId: 'test-session',
    agentType: 'manager',
    messageType: 'prompt',
    content: 'Test message',
    timestamp: new Date()
  }
];

// Test component
function TestWorkflowCanvas() {
  return (
    <div style={{ width: '100%', height: '600px' }}>
      <WorkflowCanvas
        session={mockSession}
        messages={mockMessages}
        isRealTime={true}
        showControls={true}
        showMinimap={true}
        enableInteraction={true}
      />
    </div>
  );
}

export default TestWorkflowCanvas;

// Test that all components can be imported
export {
  WorkflowCanvas,
  FlowCanvas,
  AgentNode,
  TaskFlow,
  ConnectionLine,
  ProgressIndicator,
  WorkflowControls
} from './src/components/WorkflowCanvas';

console.log('WorkflowCanvas components test: All imports successful!');

// Type check test
const testProps = {
  session: mockSession,
  messages: mockMessages,
  isRealTime: true as boolean,
  showControls: true as boolean,
  showMinimap: true as boolean,
  enableInteraction: true as boolean,
  height: '600px' as string,
  className: 'test-class' as string
};

// This will be caught by TypeScript if our types are incorrect
const workflowCanvasElement = React.createElement(WorkflowCanvas, testProps);

console.log('TypeScript compilation test: Passed!');
