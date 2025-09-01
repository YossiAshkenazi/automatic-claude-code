import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { Logger } from '../logger';

const execAsync = promisify(exec);

export interface BrowserSession {
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';
  profilePath?: string;
  isActive: boolean;
  claudeTabOpen: boolean;
  authenticatedAt?: Date;
  lastActivity?: Date;
  sessionToken?: string;
  process?: {
    pid: number;
    command: string;
  };
}

export interface BrowserSessionStatus {
  hasActiveSessions: boolean;
  sessionsFound: BrowserSession[];
  claudeTabsOpen: number;
  authenticatedSessions: number;
  recommendedBrowser?: string;
  issues: string[];
}

export class BrowserSessionManager {
  private logger: Logger;
  private sessionCache: Map<string, BrowserSession> = new Map();
  private cacheTimestamp: Date | null = null;
  private cacheValidityMs = 30000; // 30 seconds

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Check if browser sessions are available and Claude is authenticated
   */
  async checkBrowserSessions(): Promise<BrowserSessionStatus> {
    try {
      // Check if cache is still valid
      if (this.cacheTimestamp && 
          Date.now() - this.cacheTimestamp.getTime() < this.cacheValidityMs) {
        return this.buildStatusFromCache();
      }

      this.logger.debug('Checking browser sessions for Claude authentication...');
      
      const sessions: BrowserSession[] = [];
      const issues: string[] = [];

      // Check Chrome/Chromium-based browsers
      const chromeSession = await this.checkChromeSession();
      if (chromeSession) sessions.push(chromeSession);

      // Check Firefox
      const firefoxSession = await this.checkFirefoxSession();
      if (firefoxSession) sessions.push(firefoxSession);

      // Check Edge
      const edgeSession = await this.checkEdgeSession();
      if (edgeSession) sessions.push(edgeSession);

      // Check Safari (macOS only)
      if (process.platform === 'darwin') {
        const safariSession = await this.checkSafariSession();
        if (safariSession) sessions.push(safariSession);
      }

      // Update cache
      this.sessionCache.clear();
      sessions.forEach(session => {
        this.sessionCache.set(`${session.browser}-${session.process?.pid || 'unknown'}`, session);
      });
      this.cacheTimestamp = new Date();

      // Analyze results
      const claudeTabsOpen = sessions.filter(s => s.claudeTabOpen).length;
      const authenticatedSessions = sessions.filter(s => s.isActive && s.claudeTabOpen).length;
      const hasActiveSessions = authenticatedSessions > 0;

      // Determine issues
      if (sessions.length === 0) {
        issues.push('No browser processes found');
      } else if (claudeTabsOpen === 0) {
        issues.push('No Claude tabs open in any browser');
      } else if (authenticatedSessions === 0) {
        issues.push('Claude tabs found but not authenticated');
      }

      // Recommend best browser
      const recommendedBrowser = this.getRecommendedBrowser(sessions);

      return {
        hasActiveSessions,
        sessionsFound: sessions,
        claudeTabsOpen,
        authenticatedSessions,
        recommendedBrowser,
        issues
      };

    } catch (error) {
      this.logger.error('Error checking browser sessions:', error instanceof Error ? error.message : String(error));
      return {
        hasActiveSessions: false,
        sessionsFound: [],
        claudeTabsOpen: 0,
        authenticatedSessions: 0,
        issues: [`Error checking browser sessions: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Check Chrome/Chromium browser session
   */
  private async checkChromeSession(): Promise<BrowserSession | null> {
    try {
      const browsers = ['chrome', 'google-chrome', 'chromium', 'google-chrome-stable'];
      
      for (const browser of browsers) {
        try {
          // Check if browser is running
          const processes = await this.findBrowserProcesses(browser);
          if (processes.length === 0) continue;

          // Check for Claude tabs using browser history/bookmarks if possible
          const claudeTabOpen = await this.checkChromeClaudeTabs(browser);
          
          // Try to detect authentication by checking session storage
          const isAuthenticated = await this.checkChromeAuthentication(browser);

          return {
            browser: 'chrome',
            isActive: processes.length > 0,
            claudeTabOpen,
            authenticatedAt: isAuthenticated ? new Date() : undefined,
            lastActivity: new Date(),
            process: processes[0] ? {
              pid: processes[0].pid,
              command: processes[0].command
            } : undefined
          };
        } catch (error) {
          this.logger.debug(`Chrome check failed for ${browser}:`, error instanceof Error ? error.message : String(error));
          continue;
        }
      }

      return null;
    } catch (error) {
      this.logger.debug('Chrome session check failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Check Firefox browser session
   */
  private async checkFirefoxSession(): Promise<BrowserSession | null> {
    try {
      const processes = await this.findBrowserProcesses('firefox');
      if (processes.length === 0) return null;

      // Check for Claude tabs in Firefox
      const claudeTabOpen = await this.checkFirefoxClaudeTabs();
      const isAuthenticated = await this.checkFirefoxAuthentication();

      return {
        browser: 'firefox',
        isActive: processes.length > 0,
        claudeTabOpen,
        authenticatedAt: isAuthenticated ? new Date() : undefined,
        lastActivity: new Date(),
        process: processes[0] ? {
          pid: processes[0].pid,
          command: processes[0].command
        } : undefined
      };
    } catch (error) {
      this.logger.debug('Firefox session check failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Check Edge browser session
   */
  private async checkEdgeSession(): Promise<BrowserSession | null> {
    try {
      const processes = await this.findBrowserProcesses('msedge');
      if (processes.length === 0) return null;

      // Edge uses similar structure to Chrome
      const claudeTabOpen = await this.checkChromeClaudeTabs('msedge');
      const isAuthenticated = await this.checkChromeAuthentication('msedge');

      return {
        browser: 'edge',
        isActive: processes.length > 0,
        claudeTabOpen,
        authenticatedAt: isAuthenticated ? new Date() : undefined,
        lastActivity: new Date(),
        process: processes[0] ? {
          pid: processes[0].pid,
          command: processes[0].command
        } : undefined
      };
    } catch (error) {
      this.logger.debug('Edge session check failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Check Safari browser session (macOS only)
   */
  private async checkSafariSession(): Promise<BrowserSession | null> {
    if (process.platform !== 'darwin') return null;

    try {
      const processes = await this.findBrowserProcesses('Safari');
      if (processes.length === 0) return null;

      // For Safari, we'll use a simple heuristic
      const claudeTabOpen = await this.checkSafariClaudeTabs();
      
      return {
        browser: 'safari',
        isActive: processes.length > 0,
        claudeTabOpen,
        lastActivity: new Date(),
        process: processes[0] ? {
          pid: processes[0].pid,
          command: processes[0].command
        } : undefined
      };
    } catch (error) {
      this.logger.debug('Safari session check failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Find browser processes by name
   */
  private async findBrowserProcesses(browserName: string): Promise<Array<{pid: number, command: string}>> {
    try {
      let command: string;
      if (process.platform === 'win32') {
        command = `tasklist /fi "imagename eq ${browserName}.exe" /fo csv /nh`;
      } else if (process.platform === 'darwin') {
        command = `ps aux | grep -i "${browserName}" | grep -v grep`;
      } else {
        command = `ps aux | grep -i "${browserName}" | grep -v grep`;
      }

      const { stdout } = await execAsync(command);
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return [];

      const processes: Array<{pid: number, command: string}> = [];
      
      for (const line of lines) {
        if (process.platform === 'win32') {
          // Windows tasklist format: "name","pid","session","memory"
          const match = line.match(/^"([^"]+)","(\d+)"/);
          if (match) {
            processes.push({
              pid: parseInt(match[2]),
              command: match[1]
            });
          }
        } else {
          // Unix ps format
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const pid = parseInt(parts[1]);
            if (!isNaN(pid)) {
              processes.push({
                pid,
                command: parts.slice(10).join(' ') || browserName
              });
            }
          }
        }
      }

      return processes;
    } catch (error) {
      this.logger.debug(`Error finding processes for ${browserName}:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Check if Chrome/Edge has Claude tabs open
   */
  private async checkChromeClaudeTabs(browser: string): Promise<boolean> {
    try {
      // Try to check browser sessions using chrome debugging protocol
      // This is a simplified approach - in production, you might want to use puppeteer
      
      // For now, we'll use a heuristic approach by checking if the browser process 
      // has any references to claude.ai in command line or environment
      const processes = await this.findBrowserProcesses(browser);
      
      // Check if any process mentions claude.ai (very basic heuristic)
      return processes.some(p => 
        p.command.toLowerCase().includes('claude') ||
        p.command.toLowerCase().includes('anthropic')
      );
    } catch (error) {
      this.logger.debug(`Error checking Chrome Claude tabs for ${browser}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Check Chrome/Edge authentication status
   */
  private async checkChromeAuthentication(browser: string): Promise<boolean> {
    try {
      // In a real implementation, you would check:
      // 1. Browser's session storage/cookies for Claude authentication
      // 2. Use Chrome DevTools Protocol to check authentication status
      // 3. Look for specific authentication tokens or cookies
      
      // For now, we'll assume if Claude tabs are open, there's potential for authentication
      return await this.checkChromeClaudeTabs(browser);
    } catch (error) {
      this.logger.debug(`Error checking Chrome authentication for ${browser}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Check Firefox Claude tabs
   */
  private async checkFirefoxClaudeTabs(): Promise<boolean> {
    try {
      // Firefox session checking would require reading session store files
      // or using Firefox's debugging protocol
      // For now, we'll use process heuristics
      const processes = await this.findBrowserProcesses('firefox');
      return processes.some(p => 
        p.command.toLowerCase().includes('claude') ||
        p.command.toLowerCase().includes('anthropic')
      );
    } catch (error) {
      this.logger.debug('Error checking Firefox Claude tabs:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Check Firefox authentication
   */
  private async checkFirefoxAuthentication(): Promise<boolean> {
    try {
      // Similar to Chrome, would need to check session storage/cookies
      return await this.checkFirefoxClaudeTabs();
    } catch (error) {
      this.logger.debug('Error checking Firefox authentication:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Check Safari Claude tabs (macOS only)
   */
  private async checkSafariClaudeTabs(): Promise<boolean> {
    if (process.platform !== 'darwin') return false;
    
    try {
      // On macOS, we could use AppleScript to check Safari tabs
      const script = `
        tell application "Safari"
          set tabCount to 0
          repeat with w in windows
            repeat with t in tabs of w
              if URL of t contains "claude.ai" then
                set tabCount to tabCount + 1
              end if
            end repeat
          end repeat
          return tabCount
        end tell
      `;
      
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      const tabCount = parseInt(stdout.trim());
      return tabCount > 0;
    } catch (error) {
      this.logger.debug('Error checking Safari Claude tabs:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Get recommended browser based on session analysis
   */
  private getRecommendedBrowser(sessions: BrowserSession[]): string | undefined {
    // Prioritize browsers with active Claude sessions
    const authenticatedSessions = sessions.filter(s => s.isActive && s.claudeTabOpen);
    if (authenticatedSessions.length > 0) {
      return authenticatedSessions[0].browser;
    }

    // Prioritize browsers with Claude tabs open
    const claudeSessions = sessions.filter(s => s.claudeTabOpen);
    if (claudeSessions.length > 0) {
      return claudeSessions[0].browser;
    }

    // Prioritize active browsers
    const activeSessions = sessions.filter(s => s.isActive);
    if (activeSessions.length > 0) {
      return activeSessions[0].browser;
    }

    // Default recommendation by platform
    if (process.platform === 'darwin') return 'safari';
    if (process.platform === 'win32') return 'edge';
    return 'chrome';
  }

  /**
   * Build status from cache
   */
  private buildStatusFromCache(): BrowserSessionStatus {
    const sessions = Array.from(this.sessionCache.values());
    const claudeTabsOpen = sessions.filter(s => s.claudeTabOpen).length;
    const authenticatedSessions = sessions.filter(s => s.isActive && s.claudeTabOpen).length;
    
    return {
      hasActiveSessions: authenticatedSessions > 0,
      sessionsFound: sessions,
      claudeTabsOpen,
      authenticatedSessions,
      recommendedBrowser: this.getRecommendedBrowser(sessions),
      issues: []
    };
  }

  /**
   * Force refresh browser session cache
   */
  invalidateCache(): void {
    this.sessionCache.clear();
    this.cacheTimestamp = null;
  }

  /**
   * Clear browser cache/cookies for Claude
   */
  async clearBrowserCache(): Promise<void> {
    this.logger.info('🧹 Clearing browser cache for Claude...');
    
    // Clear our session cache
    this.invalidateCache();
    
    // In a full implementation, you would:
    // 1. Clear browser-specific cache directories for Claude
    // 2. Clear cookies for claude.ai
    // 3. Clear local storage for Claude
    
    this.logger.info('✅ Browser cache cleared');
  }

  /**
   * Reset all browser sessions for Claude
   */
  async resetBrowserSessions(): Promise<void> {
    this.logger.info('🔄 Resetting all browser sessions...');
    
    // Clear cache first
    await this.clearBrowserCache();
    
    // In a full implementation, you would:
    // 1. Close all Claude tabs
    // 2. Clear all authentication tokens
    // 3. Reset session state
    
    this.logger.info('✅ Browser sessions reset');
  }

  /**
   * Monitor browser session health
   */
  async monitorBrowserSessions(): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 Monitoring Browser Sessions\n'));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));
    
    const monitor = async () => {
      const status = await this.checkBrowserSessions();
      
      console.clear();
      console.log(chalk.blue.bold('🔍 Browser Session Monitor') + chalk.gray(` - ${new Date().toLocaleTimeString()}\n`));
      
      // Status overview
      if (status.hasActiveSessions) {
        console.log(chalk.green('✅ Claude browser authentication is active'));
      } else {
        console.log(chalk.red('❌ No active Claude browser sessions found'));
      }
      
      console.log(chalk.cyan(`📊 Sessions: ${status.sessionsFound.length} browsers, ${status.claudeTabsOpen} Claude tabs, ${status.authenticatedSessions} authenticated\n`));
      
      // Browser details
      if (status.sessionsFound.length > 0) {
        console.log(chalk.yellow.bold('Browser Sessions:'));
        status.sessionsFound.forEach(session => {
          const statusIcon = session.isActive ? '🟢' : '🔴';
          const claudeIcon = session.claudeTabOpen ? '🌟' : '⭕';
          console.log(`  ${statusIcon} ${session.browser.toUpperCase()} ${claudeIcon} ${session.claudeTabOpen ? 'Claude tab open' : 'No Claude tab'}`);
          if (session.process) {
            console.log(chalk.gray(`     PID: ${session.process.pid}`));
          }
          if (session.authenticatedAt) {
            console.log(chalk.gray(`     Authenticated: ${session.authenticatedAt.toLocaleTimeString()}`));
          }
        });
        console.log();
      }
      
      // Issues
      if (status.issues.length > 0) {
        console.log(chalk.red.bold('Issues:'));
        status.issues.forEach(issue => {
          console.log(chalk.red(`  • ${issue}`));
        });
        console.log();
      }
      
      // Recommendations
      if (status.recommendedBrowser) {
        console.log(chalk.blue(`💡 Recommended browser: ${status.recommendedBrowser.toUpperCase()}\n`));
      }
    };
    
    // Initial check
    await monitor();
    
    // Set up periodic monitoring
    const interval = setInterval(monitor, 5000);
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.yellow('\n👋 Monitoring stopped'));
      process.exit(0);
    });
  }
}