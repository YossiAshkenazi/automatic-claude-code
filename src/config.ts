import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Config {
  defaultModel: 'sonnet' | 'opus';
  maxIterations: number;
  continueOnError: boolean;
  verbose: boolean;
  allowedTools: string[];
  sessionHistoryLimit: number;
  autoSaveInterval: number;
  claudePath?: string;
  defaultWorkDir?: string;
  systemPrompts?: string[];
  
  // Dual-agent monitoring settings
  monitoring: {
    enabled: boolean;
    serverUrl: string;
    webSocketUrl: string;
    uiUrl: string;
    serverPath?: string; // Path to dual-agent-monitor
    autoStartServer: boolean;
  };
  
  // Dual-agent settings
  dualAgent: {
    enabled: boolean;
    managerModel: 'sonnet' | 'opus';
    workerModel: 'sonnet' | 'opus';
    coordinationInterval: number;
    qualityGateThreshold: number;
    maxConcurrentTasks: number;
    enableCrossValidation: boolean;
    usePTY: boolean; // Enable PTY-based execution by default
  };
}

class ConfigManager {
  private configPath: string;
  private config: Config;
  private defaultConfig: Config = {
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

  constructor() {
    this.configPath = this.getConfigPath();
    this.config = this.loadConfig();
  }

  private getConfigPath(): string {
    const configDir = process.env.ACC_CONFIG_DIR || 
                     path.join(os.homedir(), '.automatic-claude-code');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    return path.join(configDir, 'config.json');
  }

  private loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const userConfig = JSON.parse(content);
        return { ...this.defaultConfig, ...userConfig };
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    
    this.saveConfig(this.defaultConfig);
    return this.defaultConfig;
  }

  private saveConfig(config: Config): void {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.saveConfig(this.config);
  }

  getAll(): Config {
    return { ...this.config };
  }

  reset(): void {
    this.config = { ...this.defaultConfig };
    this.saveConfig(this.config);
  }

  merge(partialConfig: Partial<Config>): void {
    this.config = { ...this.config, ...partialConfig };
    this.saveConfig(this.config);
  }

  // Helper methods for monitoring
  isMonitoringEnabled(): boolean {
    return this.config.monitoring.enabled;
  }
  
  getMonitoringUrls(): { server: string; webSocket: string; ui: string } {
    return {
      server: this.config.monitoring.serverUrl,
      webSocket: this.config.monitoring.webSocketUrl,
      ui: this.config.monitoring.uiUrl,
    };
  }
  
  isDualAgentEnabled(): boolean {
    return this.config.dualAgent.enabled;
  }
  
  getDualAgentModels(): { manager: string; worker: string } {
    return {
      manager: this.config.dualAgent.managerModel,
      worker: this.config.dualAgent.workerModel,
    };
  }
  
  // Auto-detect monitoring server path
  findMonitoringServerPath(): string | null {
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

export const config = new ConfigManager();