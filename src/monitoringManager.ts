import { spawn, ChildProcess, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { config } from './config';

export class MonitoringManager {
  private serverProcess: ChildProcess | null = null;
  private isStarting = false;
  
  // Rate limiting for monitoring data
  private lastSentTime: number = 0;
  private sendCooldown: number = 2000; // 2 seconds minimum between sends
  private eventBuffer: any[] = [];
  private maxBufferSize: number = 10;
  private flushInterval: NodeJS.Timeout | null = null;

  async startServer(): Promise<boolean> {
    if (!config.isMonitoringEnabled()) {
      console.log(chalk.gray('ℹ️  Monitoring disabled - use --enable-monitoring to enable dashboard'));
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
    
    // Clean up rate limiting timers
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get monitoring status
  async getStatus(): Promise<{ 
    serverRunning: boolean; 
    serverPath: string | null; 
    urls: { server: string; ui: string } 
  }> {
    return {
      serverRunning: await this.isServerRunning(),
      serverPath: config.findMonitoringServerPath(),
      urls: config.getMonitoringUrls()
    };
  }

  // Send data to monitoring server with rate limiting
  async sendMonitoringData(data: any): Promise<boolean> {
    if (!config.isMonitoringEnabled()) {
      // Silently ignore if monitoring is disabled
      return false;
    }

    const now = Date.now();
    
    // Rate limit sends to prevent spam
    if (now - this.lastSentTime < this.sendCooldown) {
      // Add to buffer for later processing
      this.addToBuffer(data);
      return false;
    }

    this.lastSentTime = now;
    console.log(chalk.blue('🔍 Sending monitoring data:', data.messageType));

    return new Promise((resolve) => {
      try {
        const { server } = config.getMonitoringUrls();
        const url = new URL(`${server}/api/monitoring`);
        const postData = JSON.stringify(data);

        const request = require('http').request({
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 5000
        }, (res: any) => {
          let responseData = '';
          res.on('data', (chunk: any) => {
            responseData += chunk;
          });
          res.on('end', () => {
            const success = res.statusCode >= 200 && res.statusCode < 300;
            if (success) {
              console.log(chalk.green('✅ Monitoring data sent successfully'));
            } else {
              console.warn(chalk.yellow('⚠️  Monitoring data sent but got status:'), res.statusCode);
            }
            resolve(success);
          });
        });

        request.on('error', (error: any) => {
          console.warn(chalk.red('❌ Failed to send monitoring data:'), error.message);
          resolve(false);
        });

        request.on('timeout', () => {
          request.destroy();
          resolve(false);
        });

        request.write(postData);
        request.end();
      } catch (error) {
        console.warn(chalk.yellow('Failed to send monitoring data:'), error);
        resolve(false);
      }
    });
  }

  private addToBuffer(data: any): void {
    // Add data to buffer, maintaining max size
    this.eventBuffer.push(data);
    
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift(); // Remove oldest event
    }

    // Start flush timer if not already running
    if (!this.flushInterval) {
      this.flushInterval = setInterval(() => {
        this.flushBuffer();
      }, 10000); // Flush every 10 seconds
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
        this.flushInterval = null;
      }
      return;
    }

    // Send the most recent buffered event
    const data = this.eventBuffer.shift();
    if (data) {
      await this.sendMonitoringData(data);
    }
  }

  // WebSocket functionality placeholder (implement when needed)
  connectWebSocket(): null {
    console.log(chalk.gray('WebSocket monitoring not implemented yet'));
    return null;
  }
}

export const monitoringManager = new MonitoringManager();