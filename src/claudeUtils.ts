import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { config } from './config';

export interface ClaudeCommandInfo {
  command: string;
  baseArgs: string[];
}

export class ClaudeUtils {
  static getClaudeCommand(): ClaudeCommandInfo {
    // FORCE NPX USAGE - most reliable, always gets latest version
    // This bypasses .CMD files and shell scripts that may have issues
    try {
      execSync('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 10000 });
      return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code'] };
    } catch {
      // Only fall back if npx completely fails
    }
    
    // First check if a specific claude path is configured
    const configuredPath = config.get('claudePath');
    if (configuredPath && fs.existsSync(configuredPath)) {
      try {
        execSync(`"${configuredPath}" --version`, { stdio: 'ignore', timeout: 5000 });
        return { command: configuredPath, baseArgs: [] };
      } catch {
        // Continue to other methods if configured path doesn't work
      }
    }

    // For WSL/Linux compatibility, try multiple approaches
    if (process.platform === 'linux' || process.env.WSL_DISTRO_NAME) {
      // First try to find full path to npx
      try {
        const npxPath = execSync('which npx', { encoding: 'utf-8' }).trim();
        execSync(`${npxPath} @anthropic-ai/claude-code --version`, { stdio: 'ignore', timeout: 15000 });
        return { command: npxPath, baseArgs: ['@anthropic-ai/claude-code'] };
      } catch (error) {
        // Silently continue to next approach
      }
      
      // Fallback to regular npx
      try {
        execSync('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
        return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code'] }; // Remove problematic flag
      } catch (error) {
        // Silently continue to next approach
      }
    }

    // Try direct node execution (bypasses shell scripts and .CMD files)
    try {
      // Find the actual CLI script path
      const globalNodeModules = path.join(require.resolve('npm'), '..', '..', '..', '..', 'lib', 'node_modules');
      const claudeCliPath = path.join(globalNodeModules, '@anthropic-ai', 'claude-code', 'cli.js');
      if (fs.existsSync(claudeCliPath)) {
        execSync(`node "${claudeCliPath}" --version`, { stdio: 'ignore', timeout: 5000 });
        return { command: 'node', baseArgs: [claudeCliPath] };
      }
    } catch {
      // Continue to other methods
    }

    // Try shell script version (POSIX, usually more reliable than .CMD)
    try {
      const claudeShellScript = 'C:\\Users\\yossi\\AppData\\Local\\pnpm\\claude'; // No extension
      if (fs.existsSync(claudeShellScript)) {
        execSync(`"${claudeShellScript}" --version`, { stdio: 'ignore', timeout: 5000 });
        return { command: claudeShellScript, baseArgs: [] };
      }
    } catch {
      // Continue to other methods
    }

    // Last resort: try basic claude command (could be shell script or .CMD)
    try {
      execSync('claude --version', { stdio: 'ignore', timeout: 5000 });
      return { command: 'claude', baseArgs: [] };
    } catch {
      // Try npx approach as fallback
      try {
        execSync('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
        return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code'] }; // Remove problematic flag
      } catch {
        // Try to find claude-code instead of claude
        try {
          execSync('claude-code --version', { stdio: 'ignore' });
          return { command: 'claude-code', baseArgs: [] };
        } catch {
          // Last resort - try direct npm global path
          try {
            const npmPrefix = execSync('npm config get prefix', { encoding: 'utf-8' }).trim();
            const possiblePaths = [
              { path: path.join(npmPrefix, 'bin', 'claude'), name: 'claude' },
              { path: path.join(npmPrefix, 'bin', 'claude-code'), name: 'claude-code' },
              { path: path.join(process.env.HOME || '', '.npm-global', 'bin', 'claude'), name: 'claude' },
              { path: path.join(process.env.HOME || '', '.npm-global', 'bin', 'claude-code'), name: 'claude-code' }
            ];
            
            for (const { path: claudePath } of possiblePaths) {
              if (fs.existsSync(claudePath)) {
                return { command: claudePath, baseArgs: [] };
              }
            }
          } catch {
            // Ignore and fall through to error
          }
          
          throw new Error('Claude CLI not found. Please install with: npm install -g @anthropic-ai/claude-code');
        }
      }
    }
  }

  static validateClaudeInstallation(): boolean {
    try {
      ClaudeUtils.getClaudeCommand();
      return true;
    } catch {
      return false;
    }
  }

  static async testClaudeConnection(model: 'sonnet' | 'opus' = 'sonnet', timeout: number = 15000): Promise<boolean> {
    try {
      const { command, baseArgs } = ClaudeUtils.getClaudeCommand();
      const args = [...baseArgs, '-p', 'Hello, respond with just "OK" to confirm connection', '--model', model];
      
      const result = execSync(`${command} ${args.join(' ')}`, { 
        timeout,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'] // Suppress stderr
      });
      
      return result.toLowerCase().includes('ok');
      
    } catch {
      return false;
    }
  }
}