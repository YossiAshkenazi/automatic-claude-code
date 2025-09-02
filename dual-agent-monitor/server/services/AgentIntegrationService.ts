import { EventEmitter } from 'events';
import { spawn, ChildProcess, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface AgentMessage {
  id: string;
  from: 'manager' | 'worker' | 'system';
  to: 'manager' | 'worker' | 'system' | 'monitor';
  type: 'task_assignment' | 'progress_update' | 'completion_report' | 'error_report' | 'quality_check' | 'system_event';
  timestamp: Date;
  content: string;
  metadata?: {
    taskId?: string;
    sessionId?: string;
    toolsUsed?: string[];
    errorDetails?: any;
    metrics?: {
      duration?: number;
      tokens?: number;
      apiCalls?: number;
    };
  };
}

export interface AgentStatus {
  agent: 'manager' | 'worker';
  status: 'idle' | 'working' | 'error' | 'offline';
  currentTask?: string;
  lastActivity: Date;
  metrics: {
    tasksCompleted: number;
    tasksInProgress: number;
    errorCount: number;
    averageResponseTime: number;
    cpuUsage?: number;
    memoryUsage?: number;
  };
}

export interface SessionData {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed';
  managerAgent: AgentStatus;
  workerAgent: AgentStatus;
  messages: AgentMessage[];
  taskQueue: Array<{
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    assignedTo?: 'manager' | 'worker';
    startTime?: Date;
    endTime?: Date;
  }>;
}

export class AgentIntegrationService extends EventEmitter {
  private managerProcess: ChildProcess | null = null;
  private workerProcess: ChildProcess | null = null;
  private sessions: Map<string, SessionData> = new Map();
  private currentSessionId: string | null = null;
  private isRunning = false;
  private messageBuffer: AgentMessage[] = [];
  private claudeSessionsPath: string;
  private accPath: string;

  constructor() {
    super();
    this.claudeSessionsPath = path.join(process.cwd(), '.claude-sessions');
    // Check if we're on Windows and adjust the acc path accordingly
    this.accPath = this.findAccExecutable();
    this.setupDirectories();
  }
  
  private findAccExecutable(): string {
    // For now, just return 'acc' and assume it's available globally
    // This will be improved later to handle different installation scenarios
    return 'acc';
  }

  private setupDirectories() {
    if (!fs.existsSync(this.claudeSessionsPath)) {
      fs.mkdirSync(this.claudeSessionsPath, { recursive: true });
    }
  }

  async startAgents(task: string, options: {
    managerModel?: string;
    workerModel?: string;
    maxIterations?: number;
    verbose?: boolean;
  } = {}) {
    if (this.isRunning) {
      throw new Error('Agents are already running');
    }

    const sessionId = this.generateSessionId();
    this.currentSessionId = sessionId;
    
    const session: SessionData = {
      id: sessionId,
      startTime: new Date(),
      status: 'active',
      managerAgent: {
        agent: 'manager',
        status: 'idle',
        lastActivity: new Date(),
        metrics: {
          tasksCompleted: 0,
          tasksInProgress: 0,
          errorCount: 0,
          averageResponseTime: 0
        }
      },
      workerAgent: {
        agent: 'worker',
        status: 'idle',
        lastActivity: new Date(),
        metrics: {
          tasksCompleted: 0,
          tasksInProgress: 0,
          errorCount: 0,
          averageResponseTime: 0
        }
      },
      messages: [],
      taskQueue: []
    };

    this.sessions.set(sessionId, session);
    this.isRunning = true;

    try {
      // Start Manager Agent
      await this.startManagerAgent(task, options);
      
      // Start Worker Agent
      await this.startWorkerAgent(options);
      
      // Monitor system resources
      this.startResourceMonitoring();
      
      this.emit('agents:started', { sessionId, task });
      
    } catch (error) {
      this.isRunning = false;
      session.status = 'failed';
      this.emit('agents:error', { sessionId, error });
      throw error;
    }
  }

  private async startManagerAgent(task: string, options: any) {
    console.log(`Starting manager agent with acc path: ${this.accPath}`);
    
    const args = [
      'run',
      `"${task}"`, // Quote the task to handle spaces
      '--dual-agent',
      '--manager-model', options.managerModel || 'opus',
      '--worker-model', options.workerModel || 'sonnet',
      '-i', String(options.maxIterations || 10)
    ];

    if (options.verbose) {
      args.push('-v');
    }

    console.log(`Manager agent command: ${this.accPath} ${args.join(' ')}`);

    this.managerProcess = spawn(this.accPath, args, {
      cwd: process.cwd(),
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' } // Disable color output for cleaner parsing
    });

    this.managerProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`Manager stdout: ${output}`);
      this.handleAgentOutput('manager', output);
    });

    this.managerProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      console.log(`Manager stderr: ${error}`);
      this.handleAgentError('manager', error);
    });

    this.managerProcess.on('close', (code) => {
      console.log(`Manager agent process closed with code: ${code}`);
      this.handleAgentClose('manager', code);
    });

    this.managerProcess.on('error', (error) => {
      console.error('Manager process error:', error);
      this.handleAgentError('manager', error.toString());
    });
  }

  private async startWorkerAgent(options: any) {
    // For now, we'll simulate the worker agent as part of the dual-agent system
    // In a real implementation, this might be a separate Claude CLI instance 
    // or handled within the same process
    console.log(`Starting worker agent with model: ${options.workerModel || 'sonnet'}`);
    
    // Create a mock process for the worker since dual-agent mode 
    // typically handles both agents in a single process
    this.workerProcess = {
      pid: process.pid + 1,
      stdout: null,
      stderr: null,
      stdin: null,
      kill: () => true,
      killed: false
    } as any;

    // Update worker status to active
    const session = this.sessions.get(this.currentSessionId!);
    if (session) {
      session.workerAgent.status = 'idle';
      session.workerAgent.lastActivity = new Date();
      
      // Send initial worker agent message
      const message: AgentMessage = {
        id: this.generateMessageId(),
        from: 'system',
        to: 'monitor',
        type: 'system_event',
        timestamp: new Date(),
        content: `Worker agent initialized with model: ${options.workerModel || 'sonnet'}`,
        metadata: {
          sessionId: this.currentSessionId!
        }
      };
      
      session.messages.push(message);
      this.emit('agent:message', message);
    }
    
    console.log('Worker agent initialized (managed by dual-agent system)');
  }

  private handleAgentOutput(agent: 'manager' | 'worker', output: string) {
    try {
      // Parse Claude Code output format
      const lines = output.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        // Try to parse as JSON (structured output)
        if (line.startsWith('{')) {
          try {
            const data = JSON.parse(line);
            this.processStructuredOutput(agent, data);
          } catch {
            // Not JSON, process as text
            this.processTextOutput(agent, line);
          }
        } else {
          this.processTextOutput(agent, line);
        }
      }
    } catch (error) {
      console.error(`Error processing ${agent} output:`, error);
    }
  }

  private processStructuredOutput(agent: 'manager' | 'worker', data: any) {
    const session = this.sessions.get(this.currentSessionId!);
    if (!session) return;

    // Handle different types of structured output
    if (data.type === 'tool_use') {
      const message: AgentMessage = {
        id: this.generateMessageId(),
        from: agent,
        to: 'monitor',
        type: 'progress_update',
        timestamp: new Date(),
        content: `Tool used: ${data.tool_name}`,
        metadata: {
          toolsUsed: [data.tool_name],
          sessionId: this.currentSessionId!
        }
      };
      
      session.messages.push(message);
      this.emit('agent:message', message);
      
    } else if (data.type === 'task_assignment' && agent === 'manager') {
      const message: AgentMessage = {
        id: this.generateMessageId(),
        from: 'manager',
        to: 'worker',
        type: 'task_assignment',
        timestamp: new Date(),
        content: data.task_description || 'New task assigned',
        metadata: {
          taskId: data.task_id,
          sessionId: this.currentSessionId!
        }
      };
      
      session.messages.push(message);
      session.taskQueue.push({
        id: data.task_id,
        title: data.task_description,
        status: 'in_progress',
        assignedTo: 'worker',
        startTime: new Date()
      });
      
      this.emit('agent:message', message);
      this.emit('task:assigned', { taskId: data.task_id, agent: 'worker' });
      
    } else if (data.type === 'completion' && agent === 'worker') {
      const message: AgentMessage = {
        id: this.generateMessageId(),
        from: 'worker',
        to: 'manager',
        type: 'completion_report',
        timestamp: new Date(),
        content: data.result || 'Task completed',
        metadata: {
          taskId: data.task_id,
          sessionId: this.currentSessionId!,
          metrics: {
            duration: data.duration,
            tokens: data.tokens_used,
            apiCalls: data.api_calls
          }
        }
      };
      
      session.messages.push(message);
      
      // Update task status
      const task = session.taskQueue.find(t => t.id === data.task_id);
      if (task) {
        task.status = 'completed';
        task.endTime = new Date();
      }
      
      // Update agent metrics
      if (agent === 'worker') {
        session.workerAgent.metrics.tasksCompleted++;
        session.workerAgent.metrics.tasksInProgress--;
      }
      
      this.emit('agent:message', message);
      this.emit('task:completed', { taskId: data.task_id, agent: 'worker' });
    }
  }

  private processTextOutput(agent: 'manager' | 'worker', text: string) {
    const session = this.sessions.get(this.currentSessionId!);
    if (!session) return;

    // Parse common patterns in text output
    const patterns = {
      taskStart: /Starting task: (.+)/i,
      taskComplete: /Task completed: (.+)/i,
      error: /Error: (.+)/i,
      toolUse: /Using tool: (.+)/i,
      progress: /Progress: (.+)/i
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        const message: AgentMessage = {
          id: this.generateMessageId(),
          from: agent,
          to: 'monitor',
          type: key === 'error' ? 'error_report' : 'progress_update',
          timestamp: new Date(),
          content: match[1] || text,
          metadata: {
            sessionId: this.currentSessionId!
          }
        };
        
        session.messages.push(message);
        this.emit('agent:message', message);
        
        // Update agent status
        const agentStatus = agent === 'manager' ? session.managerAgent : session.workerAgent;
        agentStatus.lastActivity = new Date();
        agentStatus.status = key === 'error' ? 'error' : 'working';
        
        break;
      }
    }
  }

  private handleAgentError(agent: 'manager' | 'worker', error: string) {
    const session = this.sessions.get(this.currentSessionId!);
    if (!session) return;

    const message: AgentMessage = {
      id: this.generateMessageId(),
      from: agent,
      to: 'monitor',
      type: 'error_report',
      timestamp: new Date(),
      content: `Error: ${error}`,
      metadata: {
        sessionId: this.currentSessionId!,
        errorDetails: { stderr: error }
      }
    };

    session.messages.push(message);
    
    const agentStatus = agent === 'manager' ? session.managerAgent : session.workerAgent;
    agentStatus.status = 'error';
    agentStatus.metrics.errorCount++;
    
    this.emit('agent:error', { agent, error, message });
  }

  private handleAgentClose(agent: 'manager' | 'worker', code: number | null) {
    const session = this.sessions.get(this.currentSessionId!);
    if (!session) return;

    const agentStatus = agent === 'manager' ? session.managerAgent : session.workerAgent;
    agentStatus.status = 'offline';
    
    const message: AgentMessage = {
      id: this.generateMessageId(),
      from: 'system',
      to: 'monitor',
      type: 'system_event',
      timestamp: new Date(),
      content: `${agent} agent stopped with code ${code}`,
      metadata: {
        sessionId: this.currentSessionId!
      }
    };
    
    session.messages.push(message);
    this.emit('agent:stopped', { agent, code });
    
    // If both agents are offline, end the session
    if (session.managerAgent.status === 'offline' && session.workerAgent.status === 'offline') {
      session.status = 'completed';
      session.endTime = new Date();
      this.isRunning = false;
      this.emit('session:ended', { sessionId: this.currentSessionId });
    }
  }

  private startResourceMonitoring() {
    const monitoringInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(monitoringInterval);
        return;
      }

      const session = this.sessions.get(this.currentSessionId!);
      if (!session) return;

      // Monitor process resources
      if (this.managerProcess?.pid) {
        this.getProcessMetrics(this.managerProcess.pid).then(metrics => {
          session.managerAgent.metrics.cpuUsage = metrics.cpu;
          session.managerAgent.metrics.memoryUsage = metrics.memory;
        });
      }

      if (this.workerProcess?.pid) {
        this.getProcessMetrics(this.workerProcess.pid).then(metrics => {
          session.workerAgent.metrics.cpuUsage = metrics.cpu;
          session.workerAgent.metrics.memoryUsage = metrics.memory;
        });
      }

      this.emit('metrics:updated', {
        sessionId: this.currentSessionId,
        manager: session.managerAgent.metrics,
        worker: session.workerAgent.metrics
      });
    }, 5000); // Update every 5 seconds
  }

  private async getProcessMetrics(pid: number): Promise<{ cpu: number; memory: number }> {
    // Implementation depends on platform
    // This is a simplified version
    try {
      if (process.platform === 'win32') {
        // Windows: Use wmic command
        return new Promise((resolve) => {
          exec(`wmic process where ProcessId=${pid} get WorkingSetSize,PageFileUsage`, (error: any, stdout: string) => {
            if (error) {
              resolve({ cpu: 0, memory: 0 });
              return;
            }
            // Parse output
            const lines = stdout.split('\n').filter(line => line.trim());
            if (lines.length > 1) {
              const values = lines[1].trim().split(/\s+/);
              const memory = parseInt(values[0]) / 1024 / 1024; // Convert to MB
              resolve({ cpu: 0, memory }); // CPU monitoring requires more complex implementation
            } else {
              resolve({ cpu: 0, memory: 0 });
            }
          });
        });
      } else {
        // Unix/Linux: Use ps command
        return new Promise((resolve) => {
          exec(`ps -p ${pid} -o %cpu,rss`, (error: any, stdout: string) => {
            if (error) {
              resolve({ cpu: 0, memory: 0 });
              return;
            }
            const lines = stdout.split('\n').filter(line => line.trim());
            if (lines.length > 1) {
              const values = lines[1].trim().split(/\s+/);
              const cpu = parseFloat(values[0]);
              const memory = parseInt(values[1]) / 1024; // Convert KB to MB
              resolve({ cpu, memory });
            } else {
              resolve({ cpu: 0, memory: 0 });
            }
          });
        });
      }
    } catch (error) {
      console.error('Error getting process metrics:', error);
      return { cpu: 0, memory: 0 };
    }
  }

  async stopAgents() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Gracefully stop agents
    if (this.managerProcess) {
      this.managerProcess.kill('SIGTERM');
    }
    if (this.workerProcess) {
      this.workerProcess.kill('SIGTERM');
    }

    // Wait for processes to close
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Force kill if still running
    if (this.managerProcess?.killed === false) {
      this.managerProcess.kill('SIGKILL');
    }
    if (this.workerProcess?.killed === false) {
      this.workerProcess.kill('SIGKILL');
    }

    this.emit('agents:stopped', { sessionId: this.currentSessionId });
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }

  getCurrentSession(): SessionData | undefined {
    return this.currentSessionId ? this.sessions.get(this.currentSessionId) : undefined;
  }

  sendMessageToAgent(agent: 'manager' | 'worker', message: string) {
    const process = agent === 'manager' ? this.managerProcess : this.workerProcess;
    if (process && process.stdin) {
      process.stdin.write(message + '\n');
      
      const session = this.sessions.get(this.currentSessionId!);
      if (session) {
        const agentMessage: AgentMessage = {
          id: this.generateMessageId(),
          from: 'system',
          to: agent,
          type: 'system_event',
          timestamp: new Date(),
          content: message,
          metadata: {
            sessionId: this.currentSessionId!
          }
        };
        session.messages.push(agentMessage);
        this.emit('agent:message', agentMessage);
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  exportSessionData(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return JSON.stringify(session, null, 2);
  }

  async loadHistoricalSessions(): Promise<SessionData[]> {
    const sessions: SessionData[] = [];
    
    try {
      const files = fs.readdirSync(this.claudeSessionsPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.claudeSessionsPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const sessionData = JSON.parse(content);
          sessions.push(this.parseClaudeSession(sessionData));
        }
      }
    } catch (error) {
      console.error('Error loading historical sessions:', error);
    }

    return sessions;
  }

  private parseClaudeSession(claudeSession: any): SessionData {
    // Parse Claude session format to our SessionData format
    return {
      id: claudeSession.id || this.generateSessionId(),
      startTime: new Date(claudeSession.created_at || Date.now()),
      endTime: claudeSession.completed_at ? new Date(claudeSession.completed_at) : undefined,
      status: claudeSession.status === 'completed' ? 'completed' : 'active',
      managerAgent: {
        agent: 'manager',
        status: 'offline',
        lastActivity: new Date(claudeSession.last_activity || Date.now()),
        metrics: {
          tasksCompleted: 0,
          tasksInProgress: 0,
          errorCount: 0,
          averageResponseTime: 0
        }
      },
      workerAgent: {
        agent: 'worker',
        status: 'offline',
        lastActivity: new Date(claudeSession.last_activity || Date.now()),
        metrics: {
          tasksCompleted: 0,
          tasksInProgress: 0,
          errorCount: 0,
          averageResponseTime: 0
        }
      },
      messages: [],
      taskQueue: []
    };
  }
}