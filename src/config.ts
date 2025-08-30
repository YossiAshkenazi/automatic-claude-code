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
}

export const config = new ConfigManager();