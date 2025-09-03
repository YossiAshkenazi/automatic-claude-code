import { EventEmitter } from 'events';
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
export declare class AgentIntegrationService extends EventEmitter {
    private managerProcess;
    private workerProcess;
    private sessions;
    private currentSessionId;
    private isRunning;
    private messageBuffer;
    private claudeSessionsPath;
    private accPath;
    constructor();
    private findAccExecutable;
    private setupDirectories;
    startAgents(task: string, options?: {
        managerModel?: string;
        workerModel?: string;
        maxIterations?: number;
        verbose?: boolean;
    }): Promise<void>;
    private startManagerAgent;
    private startWorkerAgent;
    private handleAgentOutput;
    private processStructuredOutput;
    private processTextOutput;
    private handleAgentError;
    private handleAgentClose;
    private startResourceMonitoring;
    private getProcessMetrics;
    stopAgents(): Promise<void>;
    getSession(sessionId: string): SessionData | undefined;
    getAllSessions(): SessionData[];
    getCurrentSession(): SessionData | undefined;
    sendMessageToAgent(agent: 'manager' | 'worker', message: string): void;
    private generateSessionId;
    private generateMessageId;
    exportSessionData(sessionId: string): string;
    loadHistoricalSessions(): Promise<SessionData[]>;
    private parseClaudeSession;
}
