/**
 * Demo component showcasing bi-directional communication
 * with Python agent orchestrator.
 * 
 * Features demonstrated:
 * - Connection management
 * - Agent creation and management
 * - Real-time command execution
 * - Task assignment and tracking
 * - System status monitoring
 * - Inter-agent communication
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Clock, PlayCircle, StopCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePythonAgentWebSocket } from '../hooks/usePythonAgentWebSocket';
import { AgentType, AgentInfo, TaskInfo, TaskStatus } from '../services/PythonAgentWebSocketService';

interface CommandExecution {
  id: string;
  agentId: string;
  command: string;
  result?: any;
  error?: string;
  executing: boolean;
  timestamp: Date;
}

export function PythonAgentDemo() {
  const {
    connectionState,
    connect,
    disconnect,
    agentState,
    createAgent,
    executeCommand,
    taskState,
    assignTask,
    systemState,
    refreshSystemStatus,
    getServiceStats
  } = usePythonAgentWebSocket({
    autoConnect: true,
    enableToasts: true,
    statusRefreshInterval: 15000
  });

  // Local state
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>(AgentType.WORKER);
  const [selectedModel, setSelectedModel] = useState('sonnet');
  const [agentCapabilities, setAgentCapabilities] = useState('');
  
  const [commandText, setCommandText] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [commandHistory, setCommandHistory] = useState<CommandExecution[]>([]);
  
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAgentId, setTaskAgentId] = useState('');

  const [serviceStats, setServiceStats] = useState<any>(null);

  // Update service stats periodically
  useEffect(() => {
    const updateStats = () => setServiceStats(getServiceStats());
    updateStats();
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, [getServiceStats]);

  // Handlers
  const handleCreateAgent = async () => {
    const capabilities = agentCapabilities
      .split(',')
      .map(cap => cap.trim())
      .filter(cap => cap.length > 0);

    await createAgent(selectedAgentType, selectedModel, capabilities);
  };

  const handleExecuteCommand = async () => {
    if (!selectedAgentId || !commandText.trim()) {
      toast.error('Please select an agent and enter a command');
      return;
    }

    const execution: CommandExecution = {
      id: Date.now().toString(),
      agentId: selectedAgentId,
      command: commandText,
      executing: true,
      timestamp: new Date()
    };

    setCommandHistory(prev => [execution, ...prev]);
    
    try {
      const result = await executeCommand(selectedAgentId, commandText);
      
      setCommandHistory(prev => 
        prev.map(cmd => 
          cmd.id === execution.id 
            ? { ...cmd, result, executing: false }
            : cmd
        )
      );
      
      setCommandText('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command failed';
      
      setCommandHistory(prev => 
        prev.map(cmd => 
          cmd.id === execution.id 
            ? { ...cmd, error: errorMessage, executing: false }
            : cmd
        )
      );
    }
  };

  const handleAssignTask = async () => {
    if (!taskTitle.trim() || !taskDescription.trim()) {
      toast.error('Please enter task title and description');
      return;
    }

    const taskData = {
      title: taskTitle,
      description: taskDescription,
      metadata: {
        created_via: 'demo_ui',
        priority: 'normal'
      }
    };

    const agentId = taskAgentId || undefined;
    await assignTask(taskData, agentId);
    
    setTaskTitle('');
    setTaskDescription('');
    setTaskAgentId('');
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return 'bg-green-500';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-500';
      case TaskStatus.FAILED: return 'bg-red-500';
      case TaskStatus.CANCELLED: return 'bg-gray-500';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Python Agent Orchestrator Demo</h1>
          <p className="text-muted-foreground">
            Bi-directional WebSocket communication with real-time agent management
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {connectionState.connected ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="w-4 h-4 mr-1" />
              Connected
            </Badge>
          ) : connectionState.connecting ? (
            <Badge variant="secondary">
              <Clock className="w-4 h-4 mr-1" />
              Connecting...
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="w-4 h-4 mr-1" />
              Disconnected
            </Badge>
          )}
          
          {connectionState.connected ? (
            <Button onClick={disconnect} variant="outline" size="sm">
              <StopCircle className="w-4 h-4 mr-1" />
              Disconnect
            </Button>
          ) : (
            <Button onClick={connect} size="sm">
              <PlayCircle className="w-4 h-4 mr-1" />
              Connect
            </Button>
          )}
        </div>
      </div>

      {connectionState.error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span>Connection Error: {connectionState.error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Management */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Management</CardTitle>
            <CardDescription>Create and manage Python-orchestrated agents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="agentType">Agent Type</Label>
                <Select 
                  value={selectedAgentType} 
                  onValueChange={(value) => setSelectedAgentType(value as AgentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AgentType.MANAGER}>Manager</SelectItem>
                    <SelectItem value={AgentType.WORKER}>Worker</SelectItem>
                    <SelectItem value={AgentType.COORDINATOR}>Coordinator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="model">Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sonnet">Sonnet</SelectItem>
                    <SelectItem value="opus">Opus</SelectItem>
                    <SelectItem value="haiku">Haiku</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="capabilities">Capabilities (comma-separated)</Label>
              <Input
                id="capabilities"
                placeholder="coding, analysis, documentation"
                value={agentCapabilities}
                onChange={(e) => setAgentCapabilities(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleCreateAgent} 
              className="w-full"
              disabled={agentState.loading || !connectionState.connected}
            >
              {agentState.loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Create Agent
            </Button>
            
            {agentState.error && (
              <div className="text-red-600 text-sm">{agentState.error}</div>
            )}
            
            <Separator />
            
            <div>
              <h4 className="font-semibold mb-2">Active Agents ({Object.keys(agentState.agents).length})</h4>
              <div className="space-y-2">
                {Object.values(agentState.agents).map((agent: AgentInfo) => (
                  <div key={agent.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getStatusBadgeColor(agent.status)}`}>
                          {agent.status}
                        </Badge>
                        <span className="text-sm font-medium">{agent.type}</span>
                        <span className="text-xs text-muted-foreground">{agent.model}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">ID: {agent.id}</div>
                    </div>
                    {agent.current_task && (
                      <Badge variant="outline" className="text-xs">
                        {agent.current_task}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Command Execution */}
        <Card>
          <CardHeader>
            <CardTitle>Command Execution</CardTitle>
            <CardDescription>Execute commands on agents with real-time results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="selectedAgent">Select Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(agentState.agents).map((agent: AgentInfo) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.type} - {agent.id} ({agent.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="command">Command</Label>
              <Textarea
                id="command"
                placeholder="Write a simple Python hello world function"
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                rows={3}
              />
            </div>
            
            <Button 
              onClick={handleExecuteCommand} 
              className="w-full"
              disabled={!connectionState.connected || !selectedAgentId || !commandText.trim()}
            >
              Execute Command
            </Button>
            
            <Separator />
            
            <div>
              <h4 className="font-semibold mb-2">Command History</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {commandHistory.map((execution) => (
                  <div key={execution.id} className="p-3 border rounded text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Agent: {execution.agentId}</span>
                      <span className="text-xs text-muted-foreground">
                        {execution.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="text-gray-600 mb-2">
                      <strong>Command:</strong> {execution.command}
                    </div>
                    
                    {execution.executing ? (
                      <div className="flex items-center gap-2 text-blue-600">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Executing...</span>
                      </div>
                    ) : execution.error ? (
                      <div className="text-red-600">
                        <strong>Error:</strong> {execution.error}
                      </div>
                    ) : (
                      <div className="text-green-600">
                        <strong>Result:</strong> 
                        <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                          {typeof execution.result === 'string' 
                            ? execution.result 
                            : JSON.stringify(execution.result, null, 2)
                          }
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Management */}
        <Card>
          <CardHeader>
            <CardTitle>Task Assignment</CardTitle>
            <CardDescription>Assign tasks to agents with progress tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="taskTitle">Task Title</Label>
              <Input
                id="taskTitle"
                placeholder="Implement authentication system"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="taskDescription">Task Description</Label>
              <Textarea
                id="taskDescription"
                placeholder="Create a secure authentication system with JWT tokens..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="taskAgent">Assign to Agent (optional)</Label>
              <Select value={taskAgentId} onValueChange={setTaskAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-assign to available agent" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(agentState.agents).map((agent: AgentInfo) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.type} - {agent.id} ({agent.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleAssignTask} 
              className="w-full"
              disabled={taskState.loading || !connectionState.connected || !taskTitle.trim()}
            >
              {taskState.loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Assign Task
            </Button>
            
            {taskState.error && (
              <div className="text-red-600 text-sm">{taskState.error}</div>
            )}
            
            <Separator />
            
            <div>
              <h4 className="font-semibold mb-2">Active Tasks ({Object.keys(taskState.tasks).length})</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {Object.values(taskState.tasks).map((task: TaskInfo) => (
                  <div key={task.id} className="p-2 border rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{task.title}</span>
                      <Badge className={`text-xs ${getTaskStatusColor(task.status)}`}>
                        {task.status}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground mb-1">
                      {task.assigned_agent && `Assigned to: ${task.assigned_agent}`}
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Real-time system and connection metrics</CardDescription>
            </div>
            <Button onClick={refreshSystemStatus} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemState.loading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
            ) : systemState.status ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {systemState.status.agents.total}
                  </div>
                  <div className="text-sm text-blue-600">Total Agents</div>
                </div>
                
                <div className="p-3 bg-green-50 rounded">
                  <div className="text-2xl font-bold text-green-600">
                    {systemState.status.tasks.total}
                  </div>
                  <div className="text-sm text-green-600">Total Tasks</div>
                </div>
                
                <div className="p-3 bg-yellow-50 rounded">
                  <div className="text-2xl font-bold text-yellow-600">
                    {systemState.status.tasks.queued}
                  </div>
                  <div className="text-sm text-yellow-600">Queued Tasks</div>
                </div>
                
                <div className="p-3 bg-purple-50 rounded">
                  <div className="text-2xl font-bold text-purple-600">
                    {systemState.status.running ? 'Running' : 'Stopped'}
                  </div>
                  <div className="text-sm text-purple-600">System Status</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No system data available
              </div>
            )}
            
            <Separator />
            
            {serviceStats && (
              <div>
                <h4 className="font-semibold mb-2">Connection Stats</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Messages Sent: {serviceStats.messagesSent}</div>
                  <div>Messages Received: {serviceStats.messagesReceived}</div>
                  <div>Connection Attempts: {serviceStats.connectionAttempts}</div>
                  <div>Uptime: {Math.round(serviceStats.uptime / 1000)}s</div>
                </div>
              </div>
            )}
            
            {systemState.lastUpdated && (
              <div className="text-xs text-muted-foreground">
                Last updated: {systemState.lastUpdated.toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}