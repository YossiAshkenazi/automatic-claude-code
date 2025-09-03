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
exports.SessionManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class SessionManager {
    constructor(baseDir = '.claude-sessions') {
        this.sessionsDir = path.resolve(baseDir);
    }
    async createSession(initialPrompt, workDir) {
        await this.ensureSessionsDir();
        const sessionId = this.generateSessionId();
        this.currentSession = {
            id: sessionId,
            startTime: new Date(),
            initialPrompt,
            workDir,
            iterations: [],
            status: 'running',
        };
        this.sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
        await this.saveCurrentSession();
        return sessionId;
    }
    async addIteration(iteration) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        this.currentSession.iterations.push({
            ...iteration,
            timestamp: new Date(),
        });
        await this.saveCurrentSession();
    }
    async completeSession(status = 'completed') {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        this.currentSession.endTime = new Date();
        this.currentSession.status = status;
        await this.saveCurrentSession();
    }
    async saveSession() {
        await this.completeSession();
    }
    async getSummary() {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        const iterations = this.currentSession.iterations;
        const successfulIterations = iterations.filter(i => i.exitCode === 0).length;
        const allFiles = new Set();
        const allCommands = new Set();
        let totalCost = 0;
        let totalDuration = 0;
        for (const iteration of iterations) {
            if (iteration.output.files) {
                iteration.output.files.forEach(f => allFiles.add(f));
            }
            if (iteration.output.commands) {
                iteration.output.commands.forEach(c => allCommands.add(c));
            }
            if (iteration.output.totalCost) {
                totalCost += iteration.output.totalCost;
            }
            totalDuration += iteration.duration;
        }
        return {
            totalIterations: iterations.length,
            totalDuration: Math.round(totalDuration),
            successRate: Math.round((successfulIterations / iterations.length) * 100),
            totalCost: totalCost > 0 ? totalCost : undefined,
            filesModified: Array.from(allFiles),
            commandsExecuted: Array.from(allCommands),
        };
    }
    async loadSession(sessionId) {
        const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
        const content = await fs.readFile(sessionFile, 'utf-8');
        return JSON.parse(content);
    }
    async listSessions() {
        await this.ensureSessionsDir();
        const files = await fs.readdir(this.sessionsDir);
        const sessions = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const session = await this.loadSession(file.replace('.json', ''));
                    sessions.push({
                        id: session.id,
                        date: new Date(session.startTime),
                        status: session.status,
                        prompt: session.initialPrompt.substring(0, 50) + '...',
                    });
                }
                catch (error) {
                    console.error(`Failed to load session ${file}:`, error);
                }
            }
        }
        return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
    async showHistory() {
        const sessions = await this.listSessions();
        if (sessions.length === 0) {
            console.log('No sessions found.');
            return;
        }
        console.log('\nSession History:');
        console.log('================\n');
        for (const session of sessions) {
            const status = session.status === 'completed' ? '✅' :
                session.status === 'failed' ? '❌' : '🔄';
            console.log(`${status} ${session.id}`);
            console.log(`   Date: ${session.date.toLocaleString()}`);
            console.log(`   Task: ${session.prompt}`);
            console.log();
        }
    }
    async getSessionReport(sessionId) {
        const session = await this.loadSession(sessionId);
        const summary = await this.getSummaryForSession(session);
        let report = `# Session Report: ${sessionId}\n\n`;
        report += `**Started:** ${new Date(session.startTime).toLocaleString()}\n`;
        report += `**Status:** ${session.status}\n`;
        report += `**Working Directory:** ${session.workDir}\n`;
        report += `**Initial Task:** ${session.initialPrompt}\n\n`;
        report += `## Summary\n`;
        report += `- Total Iterations: ${summary.totalIterations}\n`;
        report += `- Success Rate: ${summary.successRate}%\n`;
        report += `- Total Duration: ${summary.totalDuration}s\n`;
        if (summary.totalCost) {
            report += `- Estimated Cost: $${summary.totalCost.toFixed(4)}\n`;
        }
        report += `\n## Files Modified\n`;
        if (summary.filesModified.length > 0) {
            summary.filesModified.forEach(file => {
                report += `- ${file}\n`;
            });
        }
        else {
            report += `No files modified.\n`;
        }
        report += `\n## Commands Executed\n`;
        if (summary.commandsExecuted.length > 0) {
            summary.commandsExecuted.forEach(cmd => {
                report += `- \`${cmd}\`\n`;
            });
        }
        else {
            report += `No commands executed.\n`;
        }
        report += `\n## Iteration Details\n`;
        for (const iteration of session.iterations) {
            report += `\n### Iteration ${iteration.iteration}\n`;
            report += `**Prompt:** ${iteration.prompt.substring(0, 100)}...\n`;
            report += `**Duration:** ${iteration.duration}s\n`;
            report += `**Exit Code:** ${iteration.exitCode}\n`;
            if (iteration.output.error) {
                report += `**Error:** ${iteration.output.error}\n`;
            }
        }
        return report;
    }
    async getSummaryForSession(session) {
        const iterations = session.iterations;
        const successfulIterations = iterations.filter(i => i.exitCode === 0).length;
        const allFiles = new Set();
        const allCommands = new Set();
        let totalCost = 0;
        let totalDuration = 0;
        for (const iteration of iterations) {
            if (iteration.output.files) {
                iteration.output.files.forEach(f => allFiles.add(f));
            }
            if (iteration.output.commands) {
                iteration.output.commands.forEach(c => allCommands.add(c));
            }
            if (iteration.output.totalCost) {
                totalCost += iteration.output.totalCost;
            }
            totalDuration += iteration.duration;
        }
        return {
            totalIterations: iterations.length,
            totalDuration: Math.round(totalDuration),
            successRate: Math.round((successfulIterations / iterations.length) * 100),
            totalCost: totalCost > 0 ? totalCost : undefined,
            filesModified: Array.from(allFiles),
            commandsExecuted: Array.from(allCommands),
        };
    }
    async saveCurrentSession() {
        if (!this.currentSession || !this.sessionFile) {
            return;
        }
        await fs.writeFile(this.sessionFile, JSON.stringify(this.currentSession, null, 2), 'utf-8');
    }
    async ensureSessionsDir() {
        try {
            await fs.access(this.sessionsDir);
        }
        catch {
            await fs.mkdir(this.sessionsDir, { recursive: true });
        }
    }
    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 7);
        return `session-${timestamp}-${random}`;
    }
}
exports.SessionManager = SessionManager;
