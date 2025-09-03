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
exports.config = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class ConfigManager {
    constructor() {
        this.defaultConfig = {
            defaultModel: 'sonnet',
            maxIterations: 10,
            continueOnError: false,
            verbose: false,
            allowedTools: [
                'Read',
                'Write',
                'Edit',
                'MultiEdit',
                'Bash',
                'Glob',
                'Grep',
                'LS',
                'WebFetch',
                'WebSearch',
                'TodoWrite',
            ],
            sessionHistoryLimit: 100,
            autoSaveInterval: 60000,
            monitoring: {
                enabled: true,
                serverUrl: 'http://localhost:4001',
                webSocketUrl: 'ws://localhost:4001',
                uiUrl: 'http://localhost:8091',
                autoStartServer: true,
            },
            dualAgent: {
                enabled: false,
                managerModel: 'opus',
                workerModel: 'sonnet',
                coordinationInterval: 3,
                qualityGateThreshold: 0.8,
                maxConcurrentTasks: 2,
                enableCrossValidation: true,
                usePTY: true, // Default to PTY-based execution for better authentication
            },
        };
        this.configPath = this.getConfigPath();
        this.config = this.loadConfig();
    }
    getConfigPath() {
        const configDir = process.env.ACC_CONFIG_DIR ||
            path.join(os.homedir(), '.automatic-claude-code');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        return path.join(configDir, 'config.json');
    }
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                const userConfig = JSON.parse(content);
                return { ...this.defaultConfig, ...userConfig };
            }
        }
        catch (error) {
            console.error('Failed to load config:', error);
        }
        this.saveConfig(this.defaultConfig);
        return this.defaultConfig;
    }
    saveConfig(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Failed to save config:', error);
        }
    }
    get(key) {
        return this.config[key];
    }
    set(key, value) {
        this.config[key] = value;
        this.saveConfig(this.config);
    }
    getAll() {
        return { ...this.config };
    }
    reset() {
        this.config = { ...this.defaultConfig };
        this.saveConfig(this.config);
    }
    merge(partialConfig) {
        this.config = { ...this.config, ...partialConfig };
        this.saveConfig(this.config);
    }
    // Helper methods for monitoring
    isMonitoringEnabled() {
        return this.config.monitoring.enabled;
    }
    getMonitoringUrls() {
        return {
            server: this.config.monitoring.serverUrl,
            webSocket: this.config.monitoring.webSocketUrl,
            ui: this.config.monitoring.uiUrl,
        };
    }
    isDualAgentEnabled() {
        return this.config.dualAgent.enabled;
    }
    getDualAgentModels() {
        return {
            manager: this.config.dualAgent.managerModel,
            worker: this.config.dualAgent.workerModel,
        };
    }
    // Auto-detect monitoring server path
    findMonitoringServerPath() {
        if (this.config.monitoring.serverPath && fs.existsSync(this.config.monitoring.serverPath)) {
            return this.config.monitoring.serverPath;
        }
        // Common paths to search
        const possiblePaths = [
            // Current directory
            path.join(process.cwd(), 'dual-agent-monitor'),
            // Parent directory
            path.join(process.cwd(), '..', 'dual-agent-monitor'),
            // Same directory as ACC
            path.join(__dirname, '..', '..', 'dual-agent-monitor'),
            // Home directory
            path.join(os.homedir(), 'dual-agent-monitor'),
            path.join(os.homedir(), 'automatic-claude-code', 'dual-agent-monitor'),
        ];
        for (const checkPath of possiblePaths) {
            const serverPath = path.join(checkPath, 'server', 'websocket-server.ts');
            if (fs.existsSync(serverPath)) {
                // Update config with found path
                this.merge({
                    monitoring: {
                        ...this.config.monitoring,
                        serverPath: checkPath,
                    },
                });
                return checkPath;
            }
        }
        return null;
    }
}
exports.config = new ConfigManager();
