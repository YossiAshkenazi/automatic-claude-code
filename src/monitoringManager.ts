import { spawn, ChildProcess, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { config } from './config';

export class MonitoringManager {
  private serverProcess: ChildProcess | null = null;
  private isStarting = false;

  async startServer(): Promise<boolean> {
    if (!config.isMonitoringEnabled()) {
      return false;
    }

    if (this.serverProcess || this.isStarting) {
      return true; // Already running or starting
    }

    const serverPath = config.findMonitoringServerPath();
    if (!serverPath) {
      console.log(chalk.yellow('⚠️  Monitoring server not found. Run from the project directory containing dual-agent-monitor/'));
      return false;
    }

    this.isStarting = true;

    try {
      // Check if server is already running
      if (await this.isServerRunning()) {
        console.log(chalk.green('✓ Monitoring server already running'));
        this.isStarting = false;
        return true;
      }

      console.log(chalk.blue('🚀 Starting monitoring server...'));
      
      // Start the server using pnpm run dev
      this.serverProcess = spawn('pnpm', ['run', 'dev'], {
        cwd: serverPath,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' }
      });

      // Handle server output
      if (this.serverProcess.stdout) {
        this.serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Server listening') || output.includes('localhost:')) {
            console.log(chalk.green('✓ Monitoring server started'));
            console.log(chalk.cyan(`  UI: ${config.getMonitoringUrls().ui}`));
            console.log(chalk.cyan(`  API: ${config.getMonitoringUrls().server}`));
          }
        });
      }

      if (this.serverProcess.stderr) {
        this.serverProcess.stderr.on('data', (data) => {
          const error = data.toString();
          if (!error.includes('ExperimentalWarning')) {
            console.error(chalk.red('Monitoring server error:'), error);
          }
        });
      }

      this.serverProcess.on('close', (code) => {
        console.log(chalk.yellow(`Monitoring server exited with code ${code}`));
        this.serverProcess = null;
      });

      this.serverProcess.on('error', (error) => {
        console.error(chalk.red('Failed to start monitoring server:'), error);
        this.serverProcess = null;
      });

      // Wait a moment for server to start
      await this.delay(3000);
      this.isStarting = false;
      
      return await this.isServerRunning();
    } catch (error) {
      console.error(chalk.red('Error starting monitoring server:'), error);
      this.isStarting = false;
      return false;
    }
  }

  async isServerRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const { server } = config.getMonitoringUrls();
      const url = new URL(server);
      
      const request = require('http').get({
        hostname: url.hostname,
        port: url.port,
        path: '/api/health',
        timeout: 2000
      }, (res: any) => {
        resolve(res.statusCode === 200);
      });

      request.on('error', () => {
        resolve(false);
      });

      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
    });
  }

  stopServer(): void {
    if (this.serverProcess) {
      console.log(chalk.yellow('Stopping monitoring server...'));
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get monitoring status
  async getStatus(): Promise<{ 
    serverRunning: boolean; 
    serverPath: string | null; 
    urls: { server: string; webSocket: string; ui: string } 
  }> {
    return {
      serverRunning: await this.isServerRunning(),
      serverPath: config.findMonitoringServerPath(),
      urls: config.getMonitoringUrls()
    };
  }

  // Send data to monitoring server
  async sendMonitoringData(data: any): Promise<boolean> {
    if (!config.isMonitoringEnabled()) {
      return false;
    }

    try {
      const { server } = config.getMonitoringUrls();
      const response = await fetch(`${server}/api/monitoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      return response.ok;
    } catch (error) {
      console.warn(chalk.yellow('Failed to send monitoring data:'), error);
      return false;
    }
  }

  // WebSocket functionality placeholder (implement when needed)
  connectWebSocket(): null {
    console.log(chalk.gray('WebSocket monitoring not implemented yet'));
    return null;
  }
}

export const monitoringManager = new MonitoringManager();