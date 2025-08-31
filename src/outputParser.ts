export interface ParsedOutput {
  result?: string;
  sessionId?: string;
  totalCost?: number;
  error?: string;
  tools?: string[];
  files?: string[];
  commands?: string[];
  // Dual-agent handoff detection fields
  needsHandoff?: boolean;
  handoffReason?: string;
  taskBreakdown?: string[];
  readyForWorker?: boolean;
  managerAnalysisComplete?: boolean;
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

  /**
   * Analyze agent output to detect handoff conditions
   */
  analyzeAgentOutput(output: ParsedOutput, agentRole: 'manager' | 'worker'): {
    needsHandoff: boolean;
    handoffReason?: string;
    readyForExecution?: boolean;
    taskBreakdown?: string[];
    analysisComplete?: boolean;
  } {
    const result = output.result || '';
    
    if (agentRole === 'manager') {
      return this.analyzeManagerOutput(result, output);
    } else {
      return this.analyzeWorkerOutput(result, output);
    }
  }

  /**
   * Analyze Manager agent output for delegation triggers
   */
  private analyzeManagerOutput(result: string, output: ParsedOutput): {
    needsHandoff: boolean;
    handoffReason?: string;
    readyForExecution?: boolean;
    taskBreakdown?: string[];
    analysisComplete?: boolean;
  } {
    const needsHandoff = this.detectManagerHandoffTriggers(result);
    const taskBreakdown = this.extractTaskBreakdown(result);
    const analysisComplete = this.isAnalysisComplete(result);
    
    if (needsHandoff && taskBreakdown.length > 0) {
      return {
        needsHandoff: true,
        handoffReason: 'task_analysis_complete',
        readyForExecution: true,
        taskBreakdown,
        analysisComplete: true
      };
    }

    if (analysisComplete && !needsHandoff) {
      // Manager finished analysis but didn't explicitly hand off
      return {
        needsHandoff: true,
        handoffReason: 'analysis_complete_implicit',
        readyForExecution: true,
        taskBreakdown: taskBreakdown.length > 0 ? taskBreakdown : ['Implement user request'],
        analysisComplete: true
      };
    }

    return {
      needsHandoff: false,
      analysisComplete
    };
  }

  /**
   * Analyze Worker agent output for completion or escalation
   */
  private analyzeWorkerOutput(result: string, output: ParsedOutput): {
    needsHandoff: boolean;
    handoffReason?: string;
    readyForExecution?: boolean;
  } {
    const hasErrors = this.extractErrors(output).length > 0;
    const hasSuccesses = this.extractSuccesses(output).length > 0;
    const isComplete = this.isTaskComplete(result);
    
    if (hasErrors && !hasSuccesses) {
      return {
        needsHandoff: true,
        handoffReason: 'worker_needs_help'
      };
    }

    if (isComplete) {
      return {
        needsHandoff: true,
        handoffReason: 'task_completed'
      };
    }

    return { needsHandoff: false };
  }

  /**
   * Detect Manager handoff trigger patterns
   */
  private detectManagerHandoffTriggers(result: string): boolean {
    const handoffPatterns = [
      /(?:work items?|tasks?).*(?:created|identified|defined)/i,
      /(?:analysis|breakdown).*(?:complete|finished|done)/i,
      /(?:ready|time).*(?:implement|execute|work)/i,
      /(?:worker|implementation).*(?:should|needs to|can)/i,
      /(?:next step|proceed).*(?:implement|code|build)/i,
      /implementation.*(?:plan|strategy).*(?:ready|complete)/i,
      /work item.*assigned/i,
      /task.*(?:delegat|assign)/i
    ];

    return handoffPatterns.some(pattern => pattern.test(result));
  }

  /**
   * Extract task breakdown from manager output
   */
  private extractTaskBreakdown(result: string): string[] {
    const tasks: string[] = [];
    
    // Look for numbered lists
    const numberedMatches = result.match(/\d+\.\s*([^\n]+)/g);
    if (numberedMatches) {
      tasks.push(...numberedMatches.map(m => m.replace(/^\d+\.\s*/, '').trim()));
    }
    
    // Look for bullet points
    const bulletMatches = result.match(/[*\-]\s*([^\n]+)/g);
    if (bulletMatches) {
      tasks.push(...bulletMatches.map(m => m.replace(/^[*\-]\s*/, '').trim()));
    }
    
    // Look for "Work Item" sections
    const workItemMatches = result.match(/(?:Work Item|Task).*?:\s*([^\n]+)/gi);
    if (workItemMatches) {
      tasks.push(...workItemMatches.map(m => m.replace(/(?:Work Item|Task).*?:\s*/i, '').trim()));
    }
    
    return tasks.filter(task => task.length > 10).slice(0, 10); // Filter meaningful tasks
  }

  /**
   * Check if manager analysis is complete
   */
  private isAnalysisComplete(result: string): boolean {
    const completionPatterns = [
      /analysis.*(?:complete|finished|done)/i,
      /breakdown.*(?:complete|finished|ready)/i,
      /(?:ready|prepared).*(?:for|to).*(?:implement|execute)/i,
      /strategy.*(?:defined|complete|ready)/i,
      /plan.*(?:finalized|complete|ready)/i
    ];

    return completionPatterns.some(pattern => pattern.test(result));
  }

  /**
   * Check if worker task is complete
   */
  private isTaskComplete(result: string): boolean {
    const completionPatterns = [
      /(?:task|implementation).*(?:complete|finished|done)/i,
      /successfully.*(?:implemented|created|completed)/i,
      /all.*(?:requirements|criteria).*(?:met|satisfied)/i,
      /(?:ready|available).*(?:for|to).*(?:review|test)/i
    ];

    return completionPatterns.some(pattern => pattern.test(result));
  }
}