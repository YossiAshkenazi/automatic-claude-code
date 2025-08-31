export interface ParsedOutput {
  result?: string;
  sessionId?: string;
  totalCost?: number;
  error?: string;
  tools?: string[];
  files?: string[];
  commands?: string[];
}

interface ToolCall {
  tool: string;
  parameters?: Record<string, unknown>;
}

interface ClaudeJsonOutput {
  result?: string;
  output?: string;
  session_id?: string;
  sessionId?: string;
  total_cost_usd?: number;
  totalCost?: number;
  error?: string;
  tools_used?: string[];
  tool_calls?: ToolCall[];
  files_modified?: string[];
  files_created?: string[];
  files_read?: string[];
  commands_executed?: string[];
  bash_commands?: string[];
}

export class OutputParser {
  parse(output: string): ParsedOutput {
    try {
      const jsonOutput: ClaudeJsonOutput = JSON.parse(output);
      
      return {
        result: jsonOutput.result || jsonOutput.output || '',
        sessionId: jsonOutput.session_id || jsonOutput.sessionId,
        totalCost: jsonOutput.total_cost_usd || jsonOutput.totalCost,
        error: jsonOutput.error,
        tools: this.extractTools(jsonOutput),
        files: this.extractFiles(jsonOutput),
        commands: this.extractCommands(jsonOutput),
      };
    } catch (error) {
      return this.parseTextOutput(output);
    }
  }

  private parseTextOutput(output: string): ParsedOutput {
    const lines = output.split('\n');
    const result: ParsedOutput = {
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
          result.files!.push(match[1]);
        }
      }
      
      if (line.startsWith('$') || line.startsWith('>')) {
        result.commands!.push(line.substring(1).trim());
      }
    }

    return result;
  }

  private extractTools(jsonOutput: ClaudeJsonOutput): string[] {
    const tools: string[] = [];
    
    if (jsonOutput.tools_used) {
      tools.push(...jsonOutput.tools_used);
    }
    
    if (jsonOutput.tool_calls) {
      tools.push(...jsonOutput.tool_calls.map((tc) => tc.tool));
    }
    
    return [...new Set(tools)];
  }

  private extractFiles(jsonOutput: ClaudeJsonOutput): string[] {
    const files: string[] = [];
    
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

  private extractCommands(jsonOutput: ClaudeJsonOutput): string[] {
    const commands: string[] = [];
    
    if (jsonOutput.commands_executed) {
      commands.push(...jsonOutput.commands_executed);
    }
    
    if (jsonOutput.bash_commands) {
      commands.push(...jsonOutput.bash_commands);
    }
    
    return commands;
  }

  extractErrors(output: ParsedOutput): string[] {
    const errors: string[] = [];
    
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

  extractSuccesses(output: ParsedOutput): string[] {
    const successes: string[] = [];
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