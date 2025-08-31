"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentIntegrationService = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class AgentIntegrationService extends events_1.EventEmitter {
    constructor() {
        super();
        this.managerProcess = null;
        this.workerProcess = null;
        this.sessions = new Map();
        this.currentSessionId = null;
        this.isRunning = false;
        this.messageBuffer = [];
        this.claudeSessionsPath = path.join(process.cwd(), '.claude-sessions');
        this.accPath = path.join(process.cwd(), 'acc');
        this.setupDirectories();
    }
    setupDirectories() {
        if (!fs.existsSync(this.claudeSessionsPath)) {
            fs.mkdirSync(this.claudeSessionsPath, { recursive: true });
        }
    }
    async startAgents(task, options = {}) {
        if (this.isRunning) {
            throw new Error('Agents are already running');
        }
        const sessionId = this.generateSessionId();
        this.currentSessionId = sessionId;
        const session = {
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
        }
        catch (error) {
            this.isRunning = false;
            session.status = 'failed';
            this.emit('agents:error', { sessionId, error });
            throw error;
        }
    }
    async startManagerAgent(task, options) {
        const args = [
            'run',
            task,
            '--dual-agent',
            '--manager-model', options.managerModel || 'opus',
            '--max-iterations', String(options.maxIterations || 10),
            '--json-output'
        ];
        if (options.verbose) {
            args.push('-v');
        }
        this.managerProcess = (0, child_process_1.spawn)(this.accPath, args, {
            cwd: process.cwd(),
            shell: true
        });
        this.managerProcess.stdout?.on('data', (data) => {
            this.handleAgentOutput('manager', data.toString());
        });
        this.managerProcess.stderr?.on('data', (data) => {
            this.handleAgentError('manager', data.toString());
        });
        this.managerProcess.on('close', (code) => {
            this.handleAgentClose('manager', code);
        });
    }
    async startWorkerAgent(options) {
        const args = [
            '--worker-mode',
            '--model', options.workerModel || 'sonnet',
            '--json-output'
        ];
        this.workerProcess = (0, child_process_1.spawn)('claude', args, {
            cwd: process.cwd(),
            shell: true
        });
        this.workerProcess.stdout?.on('data', (data) => {
            this.handleAgentOutput('worker', data.toString());
        });
        this.workerProcess.stderr?.on('data', (data) => {
            this.handleAgentError('worker', data.toString());
        });
        this.workerProcess.on('close', (code) => {
            this.handleAgentClose('worker', code);
        });
    }
    handleAgentOutput(agent, output) {
        try {
            // Parse Claude Code output format
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
                // Try to parse as JSON (structured output)
                if (line.startsWith('{')) {
                    try {
                        const data = JSON.parse(line);
                        this.processStructuredOutput(agent, data);
                    }
                    catch {
                        // Not JSON, process as text
                        this.processTextOutput(agent, line);
                    }
                }
                else {
                    this.processTextOutput(agent, line);
                }
            }
        }
        catch (error) {
            console.error(`Error processing ${agent} output:`, error);
        }
    }
    processStructuredOutput(agent, data) {
        const session = this.sessions.get(this.currentSessionId);
        if (!session)
            return;
        // Handle different types of structured output
        if (data.type === 'tool_use') {
            const message = {
                id: this.generateMessageId(),
                from: agent,
                to: 'monitor',
                type: 'progress_update',
                timestamp: new Date(),
                content: `Tool used: ${data.tool_name}`,
                metadata: {
                    toolsUsed: [data.tool_name],
                    sessionId: this.currentSessionId
                }
            };
            session.messages.push(message);
            this.emit('agent:message', message);
        }
        else if (data.type === 'task_assignment' && agent === 'manager') {
            const message = {
                id: this.generateMessageId(),
                from: 'manager',
                to: 'worker',
                type: 'task_assignment',
                timestamp: new Date(),
                content: data.task_description || 'New task assigned',
                metadata: {
                    taskId: data.task_id,
                    sessionId: this.currentSessionId
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
        }
        else if (data.type === 'completion' && agent === 'worker') {
            const message = {
                id: this.generateMessageId(),
                from: 'worker',
                to: 'manager',
                type: 'completion_report',
                timestamp: new Date(),
                content: data.result || 'Task completed',
                metadata: {
                    taskId: data.task_id,
                    sessionId: this.currentSessionId,
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
    processTextOutput(agent, text) {
        const session = this.sessions.get(this.currentSessionId);
        if (!session)
            return;
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
                const message = {
                    id: this.generateMessageId(),
                    from: agent,
                    to: 'monitor',
                    type: key === 'error' ? 'error_report' : 'progress_update',
                    timestamp: new Date(),
                    content: match[1] || text,
                    metadata: {
                        sessionId: this.currentSessionId
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
    handleAgentError(agent, error) {
        const session = this.sessions.get(this.currentSessionId);
        if (!session)
            return;
        const message = {
            id: this.generateMessageId(),
            from: agent,
            to: 'monitor',
            type: 'error_report',
            timestamp: new Date(),
            content: `Error: ${error}`,
            metadata: {
                sessionId: this.currentSessionId,
                errorDetails: { stderr: error }
            }
        };
        session.messages.push(message);
        const agentStatus = agent === 'manager' ? session.managerAgent : session.workerAgent;
        agentStatus.status = 'error';
        agentStatus.metrics.errorCount++;
        this.emit('agent:error', { agent, error, message });
    }
    handleAgentClose(agent, code) {
        const session = this.sessions.get(this.currentSessionId);
        if (!session)
            return;
        const agentStatus = agent === 'manager' ? session.managerAgent : session.workerAgent;
        agentStatus.status = 'offline';
        const message = {
            id: this.generateMessageId(),
            from: 'system',
            to: 'monitor',
            type: 'system_event',
            timestamp: new Date(),
            content: `${agent} agent stopped with code ${code}`,
            metadata: {
                sessionId: this.currentSessionId
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
    startResourceMonitoring() {
        const monitoringInterval = setInterval(() => {
            if (!this.isRunning) {
                clearInterval(monitoringInterval);
                return;
            }
            const session = this.sessions.get(this.currentSessionId);
            if (!session)
                return;
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
    async getProcessMetrics(pid) {
        // Implementation depends on platform
        // This is a simplified version
        try {
            if (process.platform === 'win32') {
                // Windows: Use wmic command
                const { exec } = require('child_process');
                return new Promise((resolve) => {
                    exec(`wmic process where ProcessId=${pid} get WorkingSetSize,PageFileUsage`, (error, stdout) => {
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
                        }
                        else {
                            resolve({ cpu: 0, memory: 0 });
                        }
                    });
                });
            }
            else {
                // Unix/Linux: Use ps command
                const { exec } = require('child_process');
                return new Promise((resolve) => {
                    exec(`ps -p ${pid} -o %cpu,rss`, (error, stdout) => {
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
                        }
                        else {
                            resolve({ cpu: 0, memory: 0 });
                        }
                    });
                });
            }
        }
        catch (error) {
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
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    getCurrentSession() {
        return this.currentSessionId ? this.sessions.get(this.currentSessionId) : undefined;
    }
    sendMessageToAgent(agent, message) {
        const process = agent === 'manager' ? this.managerProcess : this.workerProcess;
        if (process && process.stdin) {
            process.stdin.write(message + '\n');
            const session = this.sessions.get(this.currentSessionId);
            if (session) {
                const agentMessage = {
                    id: this.generateMessageId(),
                    from: 'system',
                    to: agent,
                    type: 'system_event',
                    timestamp: new Date(),
                    content: message,
                    metadata: {
                        sessionId: this.currentSessionId
                    }
                };
                session.messages.push(agentMessage);
                this.emit('agent:message', agentMessage);
            }
        }
    }
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    exportSessionData(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        return JSON.stringify(session, null, 2);
    }
    async loadHistoricalSessions() {
        const sessions = [];
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
        }
        catch (error) {
            console.error('Error loading historical sessions:', error);
        }
        return sessions;
    }
    parseClaudeSession(claudeSession) {
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
exports.AgentIntegrationService = AgentIntegrationService;
//# sourceMappingURL=AgentIntegrationService.js.map