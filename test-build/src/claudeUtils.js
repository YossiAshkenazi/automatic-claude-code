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
class ClaudeUtils {
    static getClaudeCommand() {
        // For WSL/Linux compatibility, try multiple approaches
        if (process.platform === 'linux' || process.env.WSL_DISTRO_NAME) {
            // First try to find full path to npx
            try {
                const npxPath = (0, child_process_1.execSync)('which npx', { encoding: 'utf-8' }).trim();
                (0, child_process_1.execSync)(`${npxPath} @anthropic-ai/claude-code --version`, { stdio: 'ignore', timeout: 15000 });
                return { command: npxPath, baseArgs: ['@anthropic-ai/claude-code', '--dangerously-skip-permissions'] };
            }
            catch (error) {
                // Silently continue to next approach
            }
            // Fallback to regular npx
            try {
                (0, child_process_1.execSync)('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
                return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code', '--dangerously-skip-permissions'] };
            }
            catch (error) {
                // Silently continue to next approach
            }
        }
        // Try to actually run claude --version to verify it works
        try {
            (0, child_process_1.execSync)('claude --version', { stdio: 'ignore' });
            return { command: 'claude', baseArgs: ['--dangerously-skip-permissions'] };
        }
        catch {
            // Try npx approach as fallback
            try {
                (0, child_process_1.execSync)('npx @anthropic-ai/claude-code --version', { stdio: 'ignore', timeout: 15000 });
                return { command: 'npx', baseArgs: ['@anthropic-ai/claude-code', '--dangerously-skip-permissions'] };
            }
            catch {
                // Try to find claude-code instead of claude
                try {
                    (0, child_process_1.execSync)('claude-code --version', { stdio: 'ignore' });
                    return { command: 'claude-code', baseArgs: ['--dangerously-skip-permissions'] };
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
                        for (const { path: claudePath, name } of possiblePaths) {
                            if (fs.existsSync(claudePath)) {
                                return { command: claudePath, baseArgs: ['--dangerously-skip-permissions'] };
                            }
                        }
                    }
                    catch {
                        // Ignore and fall through to error
                    }
                    throw new Error('Claude CLI not found. Please install with: npm install -g @anthropic-ai/claude-code');
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
