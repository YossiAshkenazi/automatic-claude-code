"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputParser = void 0;
class OutputParser {
    parse(output) {
        try {
            const jsonOutput = JSON.parse(output);
            return {
                result: jsonOutput.result || jsonOutput.output || '',
                sessionId: jsonOutput.session_id || jsonOutput.sessionId,
                totalCost: jsonOutput.total_cost_usd || jsonOutput.totalCost,
                error: jsonOutput.error,
                tools: this.extractTools(jsonOutput),
                files: this.extractFiles(jsonOutput),
                commands: this.extractCommands(jsonOutput),
            };
        }
        catch (error) {
            return this.parseTextOutput(output);
        }
    }
    parseTextOutput(output) {
        const lines = output.split('\n');
        const result = {
            result: output,
            files: [],
            commands: [],
            tools: [],
        };
        for (const line of lines) {
            if (line.includes('Session ID:')) {
                result.sessionId = line.split('Session ID:')[1]?.trim();
            }
            if (line.includes('Error:') || line.includes('ERROR:')) {
                result.error = line;
            }
            if (line.includes('File created:') || line.includes('File modified:')) {
                const match = line.match(/['"](.*?)['"]/);
                if (match) {
                    result.files.push(match[1]);
                }
            }
            if (line.startsWith('$') || line.startsWith('>')) {
                result.commands.push(line.substring(1).trim());
            }
        }
        return result;
    }
    extractTools(jsonOutput) {
        const tools = [];
        if (jsonOutput.tools_used) {
            tools.push(...jsonOutput.tools_used);
        }
        if (jsonOutput.tool_calls) {
            tools.push(...jsonOutput.tool_calls.map((tc) => tc.tool));
        }
        return [...new Set(tools)];
    }
    extractFiles(jsonOutput) {
        const files = [];
        if (jsonOutput.files_modified) {
            files.push(...jsonOutput.files_modified);
        }
        if (jsonOutput.files_created) {
            files.push(...jsonOutput.files_created);
        }
        if (jsonOutput.files_read) {
            files.push(...jsonOutput.files_read);
        }
        return [...new Set(files)];
    }
    extractCommands(jsonOutput) {
        const commands = [];
        if (jsonOutput.commands_executed) {
            commands.push(...jsonOutput.commands_executed);
        }
        if (jsonOutput.bash_commands) {
            commands.push(...jsonOutput.bash_commands);
        }
        return commands;
    }
    extractErrors(output) {
        const errors = [];
        if (output.error) {
            errors.push(output.error);
        }
        const result = output.result || '';
        const errorPatterns = [
            /Error:.*$/gm,
            /ERROR:.*$/gm,
            /Failed to.*$/gm,
            /Cannot.*$/gm,
            /Unable to.*$/gm,
        ];
        for (const pattern of errorPatterns) {
            const matches = result.match(pattern);
            if (matches) {
                errors.push(...matches);
            }
        }
        return errors;
    }
    extractSuccesses(output) {
        const successes = [];
        const result = output.result || '';
        const successPatterns = [
            /Successfully.*$/gm,
            /Completed.*$/gm,
            /Created.*$/gm,
            /Fixed.*$/gm,
            /Implemented.*$/gm,
            /Added.*$/gm,
            /Updated.*$/gm,
        ];
        for (const pattern of successPatterns) {
            const matches = result.match(pattern);
            if (matches) {
                successes.push(...matches);
            }
        }
        return successes;
    }
}
exports.OutputParser = OutputParser;
