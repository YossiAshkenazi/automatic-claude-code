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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const events_1 = require("events");
const cli_progress_1 = __importDefault(require("cli-progress"));
const boxen_1 = __importDefault(require("boxen"));
const ora_1 = __importDefault(require("ora"));
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["PROGRESS"] = "PROGRESS";
    LogLevel["SUCCESS"] = "SUCCESS";
    LogLevel["WARNING"] = "WARNING";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger extends events_1.EventEmitter {
    constructor(repoName) {
        super();
        this.currentLogFile = null;
        this.currentWorkLogFile = null;
        this.sessionId = null;
        this.iteration = 0;
        this.writeStream = null;
        this.workWriteStream = null;
        this.consoleEnabled = true;
        this.fileEnabled = true;
        this.maxIterations = 10;
        this.progressBar = null;
        this.spinner = null;
        this.showJsonDetails = false;
        this.repoName = repoName || this.extractRepoName();
        this.logDir = this.initializeLogDirectory();
        this.initializeLogFile();
    }
    extractRepoName() {
        // Extract repo name from current working directory
        const cwd = process.cwd();
        const repoName = path.basename(cwd);
        return repoName || 'unknown-repo';
    }
    initializeLogDirectory() {
        const baseLogDir = path.join(os.homedir(), '.automatic-claude-code', 'logs');
        const repoLogDir = path.join(baseLogDir, this.repoName);
        // Create directories if they don't exist
        if (!fs.existsSync(repoLogDir)) {
            fs.mkdirSync(repoLogDir, { recursive: true });
        }
        return repoLogDir;
    }
    initializeLogFile() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        // System/session log file
        this.currentLogFile = path.join(this.logDir, `session-${timestamp}.log`);
        this.writeStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
        // Work output log file (Claude's actual work)
        this.currentWorkLogFile = path.join(this.logDir, `work-${timestamp}.log`);
        this.workWriteStream = fs.createWriteStream(this.currentWorkLogFile, { flags: 'a' });
        // Write headers to both files
        this.writeToFile({
            timestamp: new Date(),
            level: LogLevel.INFO,
            message: `=== Session started for repo: ${this.repoName} ===`,
            repoName: this.repoName
        });
        this.writeToWorkFile({
            timestamp: new Date(),
            level: LogLevel.INFO,
            message: `=== Claude Work Output - ${this.repoName} ===`,
            repoName: this.repoName
        });
    }
    setSessionInfo(sessionId, iteration) {
        this.sessionId = sessionId;
        if (iteration !== undefined) {
            this.iteration = iteration;
        }
    }
    setIteration(iteration) {
        this.iteration = iteration;
        this.updateProgressBar();
    }
    setMaxIterations(maxIterations) {
        this.maxIterations = maxIterations;
        this.initializeProgressBar();
    }
    setShowJsonDetails(show) {
        this.showJsonDetails = show;
    }
    formatLogEntry(entry) {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.padEnd(8);
        const iteration = entry.iteration !== undefined ? `[Iter ${entry.iteration}]` : '';
        const session = entry.sessionId ? `[${entry.sessionId.slice(0, 8)}]` : '';
        let formatted = `[${timestamp}] ${level} ${iteration}${session} ${entry.message}`;
        if (entry.details) {
            formatted += '\n' + JSON.stringify(entry.details, null, 2);
        }
        return formatted;
    }
    writeToFile(entry) {
        if (!this.fileEnabled || !this.writeStream)
            return;
        const formatted = this.formatLogEntry(entry);
        this.writeStream.write(formatted + '\n');
    }
    writeToWorkFile(entry) {
        if (!this.fileEnabled || !this.workWriteStream)
            return;
        const formatted = this.formatLogEntry(entry);
        this.workWriteStream.write(formatted + '\n');
    }
    initializeProgressBar() {
        if (this.progressBar) {
            this.progressBar.stop();
        }
        this.progressBar = new cli_progress_1.default.SingleBar({
            format: chalk_1.default.cyan('Progress') + ' |' + chalk_1.default.cyan('{bar}') + '| {percentage}% | Iteration {value}/{total}',
            barCompleteChar: '█',
            barIncompleteChar: '░',
            hideCursor: true
        }, cli_progress_1.default.Presets.shades_classic);
        this.progressBar.start(this.maxIterations, 0);
    }
    updateProgressBar() {
        if (this.progressBar) {
            this.progressBar.update(this.iteration);
        }
    }
    startSpinner(text) {
        if (this.spinner) {
            this.spinner.stop();
        }
        this.spinner = (0, ora_1.default)(text || 'Processing...').start();
    }
    updateSpinner(text) {
        if (this.spinner) {
            this.spinner.text = text;
        }
    }
    stopSpinner(success = true) {
        if (this.spinner) {
            if (success) {
                this.spinner.succeed();
            }
            else {
                this.spinner.fail();
            }
            this.spinner = null;
        }
    }
    displayIterationSeparator(iteration) {
        if (iteration !== undefined) {
            const separator = '═'.repeat(60);
            const title = ` ITERATION ${iteration} `;
            const padding = Math.max(0, Math.floor((separator.length - title.length) / 2));
            const centeredTitle = '═'.repeat(padding) + chalk_1.default.bold.yellow(title) + '═'.repeat(separator.length - padding - title.length);
            console.log(chalk_1.default.yellow(centeredTitle));
        }
    }
    formatJsonDetails(details) {
        if (!details)
            return '';
        const jsonStr = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
        if (!this.showJsonDetails) {
            // Show collapsed version
            const lines = jsonStr.split('\n');
            if (lines.length > 3) {
                return chalk_1.default.dim(`    [JSON Details - ${lines.length} lines] (use --show-json to expand)`);
            }
        }
        // Show expanded version with syntax highlighting
        return jsonStr.split('\n')
            .map(line => chalk_1.default.dim(`    ${line}`))
            .join('\n');
    }
    logToConsole(entry) {
        if (!this.consoleEnabled)
            return;
        // Show iteration separator when iteration changes
        if (entry.iteration !== undefined && entry.iteration !== this.iteration - 1) {
            this.displayIterationSeparator(entry.iteration);
        }
        const timestamp = new Date().toTimeString().split(' ')[0];
        const iteration = entry.iteration !== undefined ? chalk_1.default.cyan(`[${entry.iteration}]`) : '';
        let prefix = '';
        let color = chalk_1.default.white;
        let bgBox = false;
        switch (entry.level) {
            case LogLevel.DEBUG:
                prefix = chalk_1.default.gray('🐛 DEBUG');
                color = chalk_1.default.gray;
                break;
            case LogLevel.INFO:
                prefix = chalk_1.default.blue('ℹ️  INFO');
                color = chalk_1.default.white;
                break;
            case LogLevel.PROGRESS:
                prefix = chalk_1.default.yellow('⏳ PROGRESS');
                color = chalk_1.default.yellow;
                break;
            case LogLevel.SUCCESS:
                prefix = chalk_1.default.green('✅ SUCCESS');
                color = chalk_1.default.green;
                bgBox = true;
                break;
            case LogLevel.WARNING:
                prefix = chalk_1.default.yellow('⚠️  WARNING');
                color = chalk_1.default.yellow;
                bgBox = true;
                break;
            case LogLevel.ERROR:
                prefix = chalk_1.default.red('❌ ERROR');
                color = chalk_1.default.red;
                bgBox = true;
                break;
        }
        const logMessage = `${chalk_1.default.gray(timestamp)} ${prefix} ${iteration} ${color(entry.message)}`;
        if (bgBox && (entry.level === LogLevel.SUCCESS || entry.level === LogLevel.ERROR || entry.level === LogLevel.WARNING)) {
            const borderColor = entry.level === LogLevel.SUCCESS ? 'green' :
                entry.level === LogLevel.ERROR ? 'red' : 'yellow';
            console.log((0, boxen_1.default)(color(entry.message), {
                padding: 0,
                margin: { top: 0, bottom: 0, left: 2, right: 0 },
                borderStyle: 'round',
                borderColor: borderColor
            }));
        }
        else {
            console.log(logMessage);
        }
        if (entry.details) {
            const formattedDetails = this.formatJsonDetails(entry.details);
            if (formattedDetails) {
                console.log(formattedDetails);
            }
        }
    }
    log(level, message, details) {
        const entry = {
            timestamp: new Date(),
            level,
            message,
            details,
            repoName: this.repoName,
            sessionId: this.sessionId ?? undefined,
            iteration: this.iteration
        };
        this.writeToFile(entry);
        this.logToConsole(entry);
        // Emit event for real-time monitoring
        this.emit('log', entry);
    }
    debug(message, details) {
        this.log(LogLevel.DEBUG, message, details);
    }
    info(message, details) {
        this.log(LogLevel.INFO, message, details);
    }
    progress(message, details) {
        this.log(LogLevel.PROGRESS, message, details);
    }
    success(message, details) {
        this.log(LogLevel.SUCCESS, message, details);
    }
    warning(message, details) {
        this.log(LogLevel.WARNING, message, details);
    }
    error(message, details) {
        this.log(LogLevel.ERROR, message, details);
    }
    // Special method for logging Claude's actual work output
    logClaudeWork(message, details) {
        const entry = {
            timestamp: new Date(),
            level: LogLevel.INFO,
            message,
            details,
            repoName: this.repoName,
            sessionId: this.sessionId ?? undefined,
            iteration: this.iteration
        };
        // Write to work file only
        this.writeToWorkFile(entry);
        // Also display in console with special formatting
        if (this.consoleEnabled) {
            const timestamp = new Date().toTimeString().split(' ')[0];
            console.log(chalk_1.default.cyan('📝 Claude:'), chalk_1.default.white(message));
            if (details && this.showJsonDetails) {
                console.log(chalk_1.default.gray(JSON.stringify(details, null, 2)));
            }
        }
        // Emit event for real-time monitoring
        this.emit('claude-work', entry);
    }
    // Method to log Claude's response/output separately
    logClaudeResponse(output) {
        // Split by lines and log each meaningful line
        const lines = output.split('\n').filter(line => line.trim());
        lines.forEach(line => {
            // Skip system messages and focus on actual work
            if (!line.includes('DEBUG') && !line.includes('PROGRESS') &&
                !line.includes('Using Claude command') && line.trim()) {
                this.logClaudeWork(line);
            }
        });
    }
    setConsoleEnabled(enabled) {
        this.consoleEnabled = enabled;
    }
    setFileEnabled(enabled) {
        this.fileEnabled = enabled;
    }
    getLogFilePath() {
        return this.currentLogFile;
    }
    getWorkLogFilePath() {
        return this.currentWorkLogFile;
    }
    getLogDirectory() {
        return this.logDir;
    }
    close() {
        // Clean up progress bar
        if (this.progressBar) {
            this.progressBar.stop();
            this.progressBar = null;
        }
        // Clean up spinner
        this.stopSpinner();
        // Close session log stream
        if (this.writeStream) {
            this.writeToFile({
                timestamp: new Date(),
                level: LogLevel.INFO,
                message: '=== Session ended ===',
                repoName: this.repoName
            });
            this.writeStream.end();
            this.writeStream = null;
        }
        // Close work log stream
        if (this.workWriteStream) {
            this.writeToWorkFile({
                timestamp: new Date(),
                level: LogLevel.INFO,
                message: '=== Work output ended ===',
                repoName: this.repoName
            });
            this.workWriteStream.end();
            this.workWriteStream = null;
        }
    }
    // Method to get all logs for current repo
    static getRepoLogs(repoName) {
        const logDir = path.join(os.homedir(), '.automatic-claude-code', 'logs', repoName);
        if (!fs.existsSync(logDir)) {
            return [];
        }
        return fs.readdirSync(logDir)
            .filter(file => file.endsWith('.log'))
            .sort()
            .reverse();
    }
    // Method to tail a log file in real-time
    static tailLog(logPath, callback) {
        fs.watchFile(logPath, { interval: 100 }, () => {
            const content = fs.readFileSync(logPath, 'utf-8');
            const lines = content.split('\n');
            // Process new lines
            lines.forEach(line => {
                if (line.trim()) {
                    callback(line);
                }
            });
        });
    }
}
exports.Logger = Logger;
exports.default = Logger;
