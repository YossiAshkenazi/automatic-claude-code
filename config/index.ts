/**
 * Centralized Configuration Loader
 * 
 * Provides environment-specific configuration resolution and standardized
 * loading patterns for all configuration files.
 */

import * as path from 'path';
import * as fs from 'fs';

export type Environment = 'development' | 'production' | 'testing' | 'staging';

export interface ConfigPaths {
  base: string;
  development: string;
  production: string;
  testing: string;
  monitoring: string;
  root: string;
}

export interface AppConfig {
  environment: Environment;
  monitoring: {
    port: number;
    host: string;
    websocketEnabled: boolean;
  };
  pm2: {
    configPath: string;
  };
  mcp: {
    configPath: string;
  };
  jest: {
    defaultConfigPath: string;
    sdkConfigPath: string;
  };
  logging: {
    directory: string;
    level: string;
  };
}

/**
 * Configuration manager for the automatic-claude-code project
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private readonly configPaths: ConfigPaths;
  private readonly environment: Environment;

  private constructor() {
    const rootDir = path.resolve(__dirname, '..');
    this.environment = this.determineEnvironment();
    
    this.configPaths = {
      base: path.join(__dirname, 'base'),
      development: path.join(__dirname, 'development'),
      production: path.join(__dirname, 'production'),
      testing: path.join(__dirname, 'testing'),
      monitoring: path.join(__dirname, 'monitoring'),
      root: rootDir
    };
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Determine the current environment
   */
  private determineEnvironment(): Environment {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    
    switch (nodeEnv) {
      case 'production':
        return 'production';
      case 'test':
      case 'testing':
        return 'testing';
      case 'staging':
        return 'staging';
      case 'development':
      default:
        return 'development';
    }
  }

  /**
   * Get configuration paths
   */
  public getPaths(): ConfigPaths {
    return { ...this.configPaths };
  }

  /**
   * Get current environment
   */
  public getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Load configuration file from appropriate directory
   */
  public loadConfig<T = any>(filename: string, fallbackToBase = true): T | null {
    const environmentPath = path.join(this.configPaths[this.environment], filename);
    const basePath = path.join(this.configPaths.base, filename);

    // Try environment-specific config first
    if (fs.existsSync(environmentPath)) {
      return this.readConfigFile<T>(environmentPath);
    }

    // Fallback to base config if requested
    if (fallbackToBase && fs.existsSync(basePath)) {
      return this.readConfigFile<T>(basePath);
    }

    return null;
  }

  /**
   * Load JSON configuration file
   */
  public loadJsonConfig<T = any>(filename: string, fallbackToBase = true): T | null {
    if (!filename.endsWith('.json')) {
      filename = `${filename}.json`;
    }
    return this.loadConfig<T>(filename, fallbackToBase);
  }

  /**
   * Load JavaScript configuration file
   */
  public loadJsConfig<T = any>(filename: string, fallbackToBase = true): T | null {
    if (!filename.endsWith('.js')) {
      filename = `${filename}.js`;
    }
    
    const config = this.loadConfig(filename, fallbackToBase);
    return config;
  }

  /**
   * Get application configuration
   */
  public getAppConfig(): AppConfig {
    return {
      environment: this.environment,
      monitoring: {
        port: parseInt(process.env.MONITORING_PORT || '6007', 10),
        host: process.env.MONITORING_HOST || 'localhost',
        websocketEnabled: process.env.WEBSOCKET_ENABLED !== 'false'
      },
      pm2: {
        configPath: path.join(this.configPaths.production, 'ecosystem.config.js')
      },
      mcp: {
        configPath: path.join(this.configPaths.base, 'mcp_config.json')
      },
      jest: {
        defaultConfigPath: path.join(this.configPaths.testing, 'jest.config.js'),
        sdkConfigPath: path.join(this.configPaths.testing, 'jest.config.sdk.js')
      },
      logging: {
        directory: path.join(this.configPaths.root, 'logs'),
        level: process.env.LOG_LEVEL || 'info'
      }
    };
  }

  /**
   * Get PM2 ecosystem configuration
   */
  public getPM2Config(): any {
    return this.loadJsConfig('ecosystem.config', false) || 
           require(path.join(this.configPaths.production, 'ecosystem.config.js'));
  }

  /**
   * Get MCP server configuration
   */
  public getMCPConfig(): any {
    return this.loadJsonConfig('mcp_config', true) || {};
  }

  /**
   * Get Jest configuration
   */
  public getJestConfig(sdk = false): any {
    const filename = sdk ? 'jest.config.sdk.js' : 'jest.config.js';
    return require(path.join(this.configPaths.testing, filename));
  }

  /**
   * Get monitoring server configuration
   */
  public getMonitoringConfig(): any {
    const config = this.getAppConfig();
    return {
      port: config.monitoring.port,
      host: config.monitoring.host,
      websocketEnabled: config.monitoring.websocketEnabled,
      scriptPath: path.join(this.configPaths.monitoring, 'monitoring-server.js')
    };
  }

  /**
   * Create environment-specific config directory if it doesn't exist
   */
  public ensureEnvironmentDirectory(env?: Environment): void {
    const targetEnv = env || this.environment;
    const envDir = this.configPaths[targetEnv];
    
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true });
    }
  }

  /**
   * Read and parse configuration file
   */
  private readConfigFile<T>(filePath: string): T | null {
    try {
      if (filePath.endsWith('.json')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as T;
      } else if (filePath.endsWith('.js')) {
        delete require.cache[require.resolve(filePath)];
        return require(filePath) as T;
      } else {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content as unknown as T;
      }
    } catch (error) {
      console.error(`Failed to load config file ${filePath}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();

// Export utility functions for common use cases
export function getConfig(): AppConfig {
  return configManager.getAppConfig();
}

export function getPaths(): ConfigPaths {
  return configManager.getPaths();
}

export function getEnvironment(): Environment {
  return configManager.getEnvironment();
}

export function loadConfig<T = any>(filename: string, fallbackToBase = true): T | null {
  return configManager.loadConfig<T>(filename, fallbackToBase);
}

// Specific configuration loaders
export function getPM2Config(): any {
  return configManager.getPM2Config();
}

export function getMCPConfig(): any {
  return configManager.getMCPConfig();
}

export function getJestConfig(sdk = false): any {
  return configManager.getJestConfig(sdk);
}

export function getMonitoringConfig(): any {
  return configManager.getMonitoringConfig();
}

// Development helper
export function listAvailableConfigs(): Record<string, string[]> {
  const paths = configManager.getPaths();
  const result: Record<string, string[]> = {};

  Object.entries(paths).forEach(([env, dir]) => {
    if (env !== 'root' && fs.existsSync(dir)) {
      result[env] = fs.readdirSync(dir)
        .filter(file => file.endsWith('.json') || file.endsWith('.js'))
        .sort();
    }
  });

  return result;
}