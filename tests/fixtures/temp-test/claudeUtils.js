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
exports.ClaudeUtils = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const config_1 = require("./config");
class ClaudeUtils {
    static getClaudeCommand() {
        const debugLogging = process.env.DEBUG_CLAUDE_PATH === 'true';
        if (debugLogging) {
            console.log('[DEBUG] Starting Claude CLI path detection...');
            console.log(`[DEBUG] Environment: ${process.platform}`);
            console.log(`[DEBUG] APPDATA: ${process.env.APPDATA}`);
            console.log(`[DEBUG] LOCALAPPDATA: ${process.env.LOCALAPPDATA}`);
        }
        // First try the authenticated 'claude' command (browser-based auth)
        try {
            (0, child_process_1.execSync)('claude --version', { stdio: 'ignore', timeout: 5000 });
            if (debugLogging)
                console.log('[DEBUG] Found claude command in PATH');
            return { command: 'claude', baseArgs: [] };
        }
        catch {
            if (debugLogging)
                console.log('[DEBUG] claude command not found in PATH, trying alternatives...');
        }
        // Try NPX as fallback - for users who prefer API key authentication
        try {
            (0, child_process_1.execSync)('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 10000 });
            return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code'] };
        }
        catch {
            // Continue to other fallback methods
        }
        // First check if a specific claude path is configured
        const configuredPath = config_1.config.get('claudePath');
        if (configuredPath && fs.existsSync(configuredPath)) {
            try {
                (0, child_process_1.execSync)(`"${configuredPath}" --version`, { stdio: 'ignore', timeout: 5000 });
                return { command: configuredPath, baseArgs: [] };
            }
            catch {
                // Continue to other methods if configured path doesn't work
            }
        }
        // For WSL/Linux compatibility, try multiple approaches
        if (process.platform === 'linux' || process.env.WSL_DISTRO_NAME) {
            // First try to find full path to npx
            try {
                const npxPath = (0, child_process_1.execSync)('which npx', { encoding: 'utf-8' }).trim();
                (0, child_process_1.execSync)(`${npxPath} @anthropic-ai/claude-code --version`, { stdio: 'ignore', timeout: 15000 });
                return { command: npxPath, baseArgs: ['@anthropic-ai/claude-code'] };
            }
            catch (error) {
                // Silently continue to next approach
            }
            // Fallback to regular npx
            try {
                (0, child_process_1.execSync)('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
                return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code'] }; // Remove problematic flag
            }
            catch (error) {
                // Silently continue to next approach
            }
        }
        // Try direct node execution with multiple path detection strategies
        try {
            // Strategy 1: Try multiple common Claude CLI installation paths
            const possibleCliPaths = [
                // NPM global installations
                path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude'),
                path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
                path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'dist', 'cli.js'),
                // PNPM global installations  
                path.join(process.env.LOCALAPPDATA || '', 'pnpm', 'global', '5', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude'),
                path.join(process.env.LOCALAPPDATA || '', 'pnpm', 'global', '5', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
                path.join(process.env.LOCALAPPDATA || '', 'pnpm', 'global', '5', 'node_modules', '@anthropic-ai', 'claude-code', 'dist', 'cli.js'),
                // Standard Node.js paths
                path.join(require.resolve('npm'), '..', '..', '..', '..', 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
                path.join(require.resolve('npm'), '..', '..', '..', '..', 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude'),
                // Unix-style installations
                '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
                '/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js',
            ];
            for (const claudeCliPath of possibleCliPaths) {
                if (claudeCliPath && fs.existsSync(claudeCliPath)) {
                    try {
                        (0, child_process_1.execSync)(`node "${claudeCliPath}" --version`, { stdio: 'ignore', timeout: 5000 });
                        console.log(`[DEBUG] Found Claude CLI at: ${claudeCliPath}`);
                        return { command: 'node', baseArgs: [claudeCliPath] };
                    }
                    catch (testError) {
                        // Continue to next path if this one doesn't work
                        continue;
                    }
                }
            }
        }
        catch {
            // Continue to other methods
        }
        // Try detecting Claude binaries dynamically
        try {
            const possibleBinaries = [
                // Current user specific paths (based on error message paths)
                `${process.env.LOCALAPPDATA}\\pnpm\\claude`,
                `${process.env.LOCALAPPDATA}\\pnpm\\claude.cmd`,
                `${process.env.APPDATA}\\npm\\claude`,
                `${process.env.APPDATA}\\npm\\claude.cmd`,
                // Dynamic user path detection
                ...(() => {
                    const currentUser = process.env.USERNAME || process.env.USER || 'DefaultUser';
                    return [
                        `C:\\Users\\${currentUser}\\AppData\\Local\\pnpm\\claude`,
                        `C:\\Users\\${currentUser}\\AppData\\Roaming\\npm\\claude`,
                        `C:\\Users\\${currentUser}\\AppData\\Roaming\\npm\\claude.cmd`,
                    ];
                })()
            ];
            for (const claudePath of possibleBinaries) {
                if (debugLogging)
                    console.log(`[DEBUG] Checking binary path: ${claudePath}`);
                if (claudePath && fs.existsSync(claudePath)) {
                    try {
                        (0, child_process_1.execSync)(`"${claudePath}" --version`, { stdio: 'ignore', timeout: 5000 });
                        console.log(`[INFO] Found Claude binary at: ${claudePath}`);
                        return { command: claudePath, baseArgs: [] };
                    }
                    catch (testError) {
                        if (debugLogging)
                            console.log(`[DEBUG] Binary exists but failed test: ${claudePath}`);
                        continue;
                    }
                }
            }
        }
        catch {
            // Continue to other methods
        }
        // Try npm/pnpm prefix detection
        try {
            const commands = ['npm config get prefix', 'pnpm config get global-dir'];
            for (const cmd of commands) {
                try {
                    const prefixPath = (0, child_process_1.execSync)(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
                    if (debugLogging)
                        console.log(`[DEBUG] ${cmd} returned: ${prefixPath}`);
                    const possiblePaths = [
                        path.join(prefixPath, 'bin', 'claude'),
                        path.join(prefixPath, 'claude'),
                        path.join(prefixPath, 'claude.cmd'),
                        path.join(prefixPath, 'node_modules', '.bin', 'claude'),
                        path.join(prefixPath, 'node_modules', '.bin', 'claude.cmd'),
                    ];
                    for (const claudePath of possiblePaths) {
                        if (debugLogging)
                            console.log(`[DEBUG] Checking prefix path: ${claudePath}`);
                        if (fs.existsSync(claudePath)) {
                            try {
                                (0, child_process_1.execSync)(`"${claudePath}" --version`, { stdio: 'ignore', timeout: 5000 });
                                console.log(`[INFO] Found Claude via ${cmd.split(' ')[0]} at: ${claudePath}`);
                                return { command: claudePath, baseArgs: [] };
                            }
                            catch (testError) {
                                if (debugLogging)
                                    console.log(`[DEBUG] Prefix path exists but failed test: ${claudePath}`);
                                continue;
                            }
                        }
                    }
                }
                catch (prefixError) {
                    if (debugLogging)
                        console.log(`[DEBUG] Command failed: ${cmd} - ${prefixError}`);
                    continue;
                }
            }
        }
        catch {
            // Continue to other methods
        }
        // Try basic claude command again as last resort
        try {
            (0, child_process_1.execSync)('claude --version', { stdio: 'ignore', timeout: 5000 });
            return { command: 'claude', baseArgs: [] };
        }
        catch {
            // Try npx approach as fallback
            try {
                (0, child_process_1.execSync)('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
                return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code'] }; // Remove problematic flag
            }
            catch {
                // Try to find claude-code instead of claude
                try {
                    (0, child_process_1.execSync)('claude-code --version', { stdio: 'ignore' });
                    return { command: 'claude-code', baseArgs: [] };
                }
                catch {
                    // Last resort - try direct npm global path
                    try {
                        const npmPrefix = (0, child_process_1.execSync)('npm config get prefix', { encoding: 'utf-8' }).trim();
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
                    }
                    catch {
                        // Ignore and fall through to error
                    }
                    // Provide detailed error message with debugging info
                    let errorMessage = 'Claude CLI not found after exhaustive search.\n\n';
                    errorMessage += 'Installation options:\n';
                    errorMessage += '  1. npm install -g @anthropic-ai/claude-code\n';
                    errorMessage += '  2. pnpm install -g @anthropic-ai/claude-code\n';
                    errorMessage += '  3. curl -sL https://claude.ai/install.sh | sh\n\n';
                    errorMessage += 'If you have Claude installed, try:\n';
                    errorMessage += '  - Set DEBUG_CLAUDE_PATH=true to see detailed detection logs\n';
                    errorMessage += '  - Check that claude command is in your PATH\n';
                    errorMessage += `  - Verify installation in: ${process.env.APPDATA}\\npm or ${process.env.LOCALAPPDATA}\\pnpm\n`;
                    throw new Error(errorMessage);
                }
            }
        }
    }
    static validateClaudeInstallation() {
        try {
            ClaudeUtils.getClaudeCommand();
            return true;
        }
        catch {
            return false;
        }
    }
    static async testClaudeConnection(model = 'sonnet', timeout = 15000) {
        try {
            const { command, baseArgs } = ClaudeUtils.getClaudeCommand();
            const args = [...baseArgs, '-p', 'Hello, respond with just "OK" to confirm connection', '--model', model];
            const result = (0, child_process_1.execSync)(`${command} ${args.join(' ')}`, {
                timeout,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'] // Suppress stderr
            });
            return result.toLowerCase().includes('ok');
        }
        catch {
            return false;
        }
    }
}
exports.ClaudeUtils = ClaudeUtils;
