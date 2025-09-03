/**
 * Enhanced WebSocket service for bi-directional communication
 * with Python agent orchestrator.
 * 
 * Provides:
 * - Type-safe message protocol matching Python API
 * - Agent management operations
 * - Task assignment and tracking
 * - Real-time status updates
 * - Connection recovery and health monitoring
 * - Message correlation for request/response patterns
 */

import { v4 as uuidv4 } from 'uuid';

// Message protocol types matching Python API
export enum MessageType {
  // Agent Management
  AGENT_CREATE = "agent:create",
  AGENT_STATUS = "agent:status",
  AGENT_CREATED = "agent:created",
  AGENT_STOPPED = "agent:stopped",
  AGENT_ERROR = "agent:error",
  AGENT_HEARTBEAT = "agent:heartbeat",
  
  // Command Execution
  COMMAND_EXECUTE = "command:execute",
  COMMAND_RESULT = "command:result",
  COMMAND_ERROR = "command:error",
  COMMAND_PROGRESS = "command:progress",
  
  // Task Management
  TASK_ASSIGN = "task:assign",
  TASK_UPDATE = "task:update",
  TASK_COMPLETE = "task:complete",
  TASK_FAILED = "task:failed",
  
  // Inter-agent Communication
  AGENT_MESSAGE = "agent:message",
  AGENT_COORDINATION = "agent:coordination",
  AGENT_HANDOFF = "agent:handoff",
  
  // System Events
  SYSTEM_STATUS = "system:status",
  SYSTEM_ERROR = "system:error",
  SYSTEM_METRIC = "system:metric",
  
  // Connection Management
  CONNECTION_ACK = "connection:ack",
  CONNECTION_PING = "connection:ping",
  CONNECTION_PONG = "connection:pong",
  CONNECTION_ERROR = "connection:error"
}

export enum AgentType {
  MANAGER = "manager",
  WORKER = "worker",
  COORDINATOR = "coordinator"
}

export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export interface PythonMessage {
  id: string;
  type: MessageType;
  timestamp: string; // ISO format
  payload: Record<string, any>;
  source?: string;
  target?: string;
  correlation_id?: string;
}

export interface AgentInfo {
  id: string;
  type: AgentType;
  status: string;
  created_at: string;
  last_activity: string;
  current_task?: string;
  model: string;
  capabilities: string[];
  metrics: Record<string, any>;
}

export interface TaskInfo {
  id: string;
  title: string;
  description: string;
  assigned_agent?: string;
  status: TaskStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: number;
  result?: any;
  error?: string;
  metadata: Record<string, any>;
}

export interface CommandRequest {
  command: string;
  agent_id: string;
  parameters?: Record<string, any>;
}

export interface CommandResult {
  command: string;
  result: any;
  agent_id: string;
  execution_time?: number;
}

export interface SystemStatus {
  agents: {
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
  };
  tasks: {
    total: number;
    queued: number;
    by_status: Record<string, number>;
  };
  statistics: Record<string, any>;
  running: boolean;
}

interface ResponseHandler {
  resolve: (message: PythonMessage) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export type EventHandler = (message: PythonMessage) => void | Promise<void>;
export type ConnectionHandler = (connected: boolean) => void;

export class PythonAgentWebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private clientId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 2000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private connected = false;
  
  // Message handling
  private eventHandlers: Map<MessageType, EventHandler[]> = new Map();
  private pendingResponses: Map<string, ResponseHandler> = new Map();
  private connectionHandlers: ConnectionHandler[] = [];
  
  // Statistics
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    connectionAttempts: 0,
    lastConnected: null as Date | null,
    totalUptime: 0
  };

  constructor(url: string = 'ws://localhost:8766') {
    this.url = url;
    this.clientId = uuidv4();
  }

  // Connection Management
  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve(true);
        return;
      }

      this.stats.connectionAttempts++;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('Connected to Python agent orchestrator');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.stats.lastConnected = new Date();
          this.startPing();
          this.notifyConnectionHandlers(true);
          resolve(true);
        };

        this.ws.onclose = (event) => {
          console.log('Disconnected from Python agent orchestrator:', event.code, event.reason);
          this.handleDisconnection();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.handleDisconnection();
          if (this.reconnectAttempts === 0) {
            resolve(false);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        // Timeout for connection
        setTimeout(() => {
          if (!this.connected) {
            resolve(false);
          }
        }, 5000);

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        resolve(false);
      }
    });
  }

  public disconnect(): void {
    this.connected = false;
    this.stopPing();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear pending responses
    this.pendingResponses.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    });
    this.pendingResponses.clear();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    this.notifyConnectionHandlers(false);
  }

  public isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  // Event Handling
  public on(messageType: MessageType, handler: EventHandler): void {
    if (!this.eventHandlers.has(messageType)) {
      this.eventHandlers.set(messageType, []);
    }
    this.eventHandlers.get(messageType)!.push(handler);
  }

  public off(messageType: MessageType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  public onConnectionChange(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  // Message Sending
  public async sendMessage(message: PythonMessage): Promise<boolean> {
    if (!this.isConnected()) {
      console.warn('Cannot send message - not connected');
      return false;
    }

    try {
      this.ws!.send(JSON.stringify(message));
      this.stats.messagesSent++;
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  public async sendAndWaitResponse(
    message: PythonMessage, 
    timeoutMs: number = 30000
  ): Promise<PythonMessage> {
    return new Promise((resolve, reject) => {
      if (!message.correlation_id) {
        message.correlation_id = uuidv4();
      }

      // Set up response handler
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(message.correlation_id!);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingResponses.set(message.correlation_id, {
        resolve,
        reject,
        timeout
      });

      // Send message
      this.sendMessage(message).then(sent => {
        if (!sent) {
          this.pendingResponses.delete(message.correlation_id!);
          clearTimeout(timeout);
          reject(new Error('Failed to send message'));
        }
      });
    });
  }

  // Agent Management API
  public async createAgent(
    agentType: AgentType, 
    model: string = 'sonnet',
    capabilities: string[] = []
  ): Promise<AgentInfo> {
    const message: PythonMessage = {
      id: uuidv4(),
      type: MessageType.AGENT_CREATE,
      timestamp: new Date().toISOString(),
      payload: {
        agent_type: agentType,
        model,
        capabilities
      }
    };

    const response = await this.sendAndWaitResponse(message);
    if (response.type === MessageType.COMMAND_RESULT && response.payload.success) {
      return response.payload.agent_info;
    }

    throw new Error(response.payload.error_message || 'Failed to create agent');
  }

  public async executeCommand(
    agentId: string,
    command: string,
    parameters: Record<string, any> = {}
  ): Promise<any> {
    const message: PythonMessage = {
      id: uuidv4(),
      type: MessageType.COMMAND_EXECUTE,
      timestamp: new Date().toISOString(),
      payload: {
        command,
        agent_id: agentId,
        parameters
      }
    };

    const response = await this.sendAndWaitResponse(message);
    if (response.type === MessageType.COMMAND_RESULT) {
      return response.payload.result;
    }

    throw new Error(response.payload.error_message || 'Command execution failed');
  }

  public async assignTask(
    taskData: Partial<TaskInfo>,
    agentId?: string
  ): Promise<TaskInfo> {
    const task: TaskInfo = {
      id: taskData.id || `task-${Date.now()}`,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      status: TaskStatus.PENDING,
      created_at: new Date().toISOString(),
      progress: 0,
      metadata: taskData.metadata || {},
      ...taskData
    };

    const message: PythonMessage = {
      id: uuidv4(),
      type: MessageType.TASK_ASSIGN,
      timestamp: new Date().toISOString(),
      payload: {
        task,
        agent_id: agentId
      }
    };

    const response = await this.sendAndWaitResponse(message);
    if (response.type === MessageType.COMMAND_RESULT && response.payload.assigned) {
      return { ...task, assigned_agent: response.payload.agent_id };
    }

    throw new Error('Failed to assign task');
  }

  public async getSystemStatus(): Promise<SystemStatus> {
    const message: PythonMessage = {
      id: uuidv4(),
      type: MessageType.SYSTEM_STATUS,
      timestamp: new Date().toISOString(),
      payload: {}
    };

    const response = await this.sendAndWaitResponse(message);
    if (response.type === MessageType.COMMAND_RESULT) {
      return response.payload.system;
    }

    throw new Error('Failed to get system status');
  }

  // Utility Methods
  public getStats(): typeof this.stats & { connected: boolean; uptime: number } {
    const now = new Date();
    const uptime = this.stats.lastConnected 
      ? now.getTime() - this.stats.lastConnected.getTime()
      : 0;

    return {
      ...this.stats,
      connected: this.connected,
      uptime: this.connected ? uptime : 0
    };
  }

  // Private Methods
  private handleMessage(data: string): void {
    try {
      this.stats.messagesReceived++;
      const message: PythonMessage = JSON.parse(data);

      // Handle correlated responses
      if (message.correlation_id && this.pendingResponses.has(message.correlation_id)) {
        const handler = this.pendingResponses.get(message.correlation_id)!;
        clearTimeout(handler.timeout);
        this.pendingResponses.delete(message.correlation_id);
        handler.resolve(message);
        return;
      }

      // Handle ping/pong
      if (message.type === MessageType.CONNECTION_PING) {
        this.sendPong(message.payload.timestamp);
        return;
      }

      // Route to event handlers
      const handlers = this.eventHandlers.get(message.type) || [];
      handlers.forEach(async handler => {
        try {
          await handler(message);
        } catch (error) {
          console.error(`Error in event handler for ${message.type}:`, error);
        }
      });

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleDisconnection(): void {
    this.connected = false;
    this.stopPing();
    this.notifyConnectionHandlers(false);

    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(
        this.reconnectInterval * Math.pow(2, this.reconnectAttempts), 
        30000
      );
      
      this.reconnectAttempts++;
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        const pingMessage: PythonMessage = {
          id: uuidv4(),
          type: MessageType.CONNECTION_PING,
          timestamp: new Date().toISOString(),
          payload: { 
            client_id: this.clientId, 
            timestamp: new Date().toISOString() 
          }
        };
        this.sendMessage(pingMessage);
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private sendPong(originalTimestamp: string): void {
    const pongMessage: PythonMessage = {
      id: uuidv4(),
      type: MessageType.CONNECTION_PONG,
      timestamp: new Date().toISOString(),
      payload: {
        client_id: this.clientId,
        original_timestamp: originalTimestamp,
        response_timestamp: new Date().toISOString()
      }
    };
    this.sendMessage(pongMessage);
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }
}

// Singleton instance for global use
export const pythonAgentWebSocket = new PythonAgentWebSocketService();