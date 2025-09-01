import stripAnsi from 'strip-ansi';

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

export interface JsonParseResult {
  isComplete: boolean;
  data: any;
  error?: string;
}

export interface FileOperations {
  modified: string[];
  created: string[];
  read: string[];
}

export interface SessionMetadata {
  sessionId?: string;
  totalCost?: number;
  timestamp?: string;
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

/**
 * StreamJsonParser - Advanced parser for Claude Code's streaming JSON output
 * Handles partial messages, ANSI stripping, and real-time processing
 */
export class StreamJsonParser {
  private buffer: string = '';
  private completeMessages: any[] = [];
  private completionPatterns: RegExp[] = [
    // Task completion patterns
    /(?:task|implementation|analysis).*(?:complete|finished|done)/i,
    /successfully.*(?:implemented|created|completed|executed)/i,
    /(?:ready|available).*(?:for|to).*(?:review|test|use)/i,
    
    // Error completion patterns
    /error.*(?:occurred|found|detected)/i,
    /failed.*(?:to|at).*(?:execute|process|complete)/i,
    /execution.*(?:terminated|stopped|failed)/i,
    
    // Session completion patterns
    /session.*(?:ended|terminated|completed)/i,
    /total.*cost/i,
    /goodbye|farewell/i,
    
    // Status patterns
    /status.*(?:success|complete|failed)/i,
    /result.*(?:success|complete|error)/i
  ];

  /**
   * Strip ANSI escape codes from text
   */
  stripAnsi(text: string): string {
    return stripAnsi(text);
  }

  /**
   * Parse a JSON chunk and determine if it's complete
   */
  parseJsonChunk(chunk: string): JsonParseResult {
    try {
      const cleanChunk = this.stripAnsi(chunk.trim());
      if (!cleanChunk) {
        return { isComplete: false, data: null };
      }

      const data = JSON.parse(cleanChunk);
      return { isComplete: true, data };
    } catch (error) {
      return { 
        isComplete: false, 
        data: null, 
        error: error instanceof Error ? error.message : 'JSON parse error' 
      };
    }
  }

  /**
   * Add a chunk of streaming data to the buffer
   */
  addChunk(chunk: string): void {
    const cleanChunk = this.stripAnsi(chunk);
    this.buffer += cleanChunk;
    this.processBuffer();
  }

  /**
   * Process the current buffer to extract complete messages
   */
  private processBuffer(): void {
    // First try to parse the entire buffer as JSON
    const parseResult = this.parseJsonChunk(this.buffer);
    if (parseResult.isComplete && parseResult.data) {
      this.completeMessages.push(parseResult.data);
      this.buffer = '';
      return;
    }
    
    // Try to find complete JSON objects within the buffer
    const jsonObjects = this.extractJsonObjects(this.buffer);
    if (jsonObjects.length > 0) {
      this.completeMessages.push(...jsonObjects);
      // Clear buffer after extracting JSON objects
      this.buffer = '';
      return;
    }
    
    // If that fails, try line by line approach
    const lines = this.buffer.split('\n');
    let remainingBuffer = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (i === lines.length - 1) {
        // Last line might be incomplete, keep in buffer
        remainingBuffer = line;
      } else if (line.trim()) {
        const lineParseResult = this.parseJsonChunk(line);
        if (lineParseResult.isComplete && lineParseResult.data) {
          this.completeMessages.push(lineParseResult.data);
        } else if (lineParseResult.error) {
          // If it's an error, try to continue with next line
          continue;
        }
      }
    }
    
    this.buffer = remainingBuffer;
  }

  /**
   * Extract JSON objects from mixed text content
   */
  private extractJsonObjects(text: string): any[] {
    const objects: any[] = [];
    const jsonPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    
    let match;
    while ((match = jsonPattern.exec(text)) !== null) {
      const result = this.parseJsonChunk(match[0]);
      if (result.isComplete && result.data) {
        objects.push(result.data);
      }
    }
    
    return objects;
  }

  /**
   * Check if there's at least one complete message available
   */
  hasCompleteMessage(): boolean {
    return this.completeMessages.length > 0;
  }

  /**
   * Get the next complete message
   */
  getCompleteMessage(): any {
    return this.completeMessages.shift();
  }

  /**
   * Get all complete messages
   */
  getCompleteMessages(): any[] {
    const messages = [...this.completeMessages];
    this.completeMessages = [];
    return messages;
  }

  /**
   * Check if a response is complete based on content analysis
   */
  isResponseComplete(output: string): boolean {
    const cleanOutput = this.stripAnsi(output);
    
    // Try to parse as JSON first
    try {
      const jsonData = JSON.parse(cleanOutput);
      if (jsonData.status === 'complete' || jsonData.status === 'success' || jsonData.status === 'error') {
        return true;
      }
      if (jsonData.result && typeof jsonData.result === 'string') {
        return this.completionPatterns.some(pattern => pattern.test(jsonData.result));
      }
    } catch {
      // Not JSON, continue with text analysis
    }

    // Text-based completion detection
    return this.completionPatterns.some(pattern => pattern.test(cleanOutput));
  }

  /**
   * Extract tool usage from output
   */
  extractToolUsage(output: string): string[] {
    const tools: string[] = [];
    
    try {
      const jsonData = JSON.parse(this.stripAnsi(output));
      
      // Extract from tools_used array
      if (jsonData.tools_used && Array.isArray(jsonData.tools_used)) {
        tools.push(...jsonData.tools_used);
      }
      
      // Extract from tool_calls array
      if (jsonData.tool_calls && Array.isArray(jsonData.tool_calls)) {
        tools.push(...jsonData.tool_calls.map((tc: any) => tc.tool).filter(Boolean));
      }
    } catch {
      // Text-based tool extraction
      const cleanOutput = this.stripAnsi(output);
      const toolPatterns = [
        /(?:using|invoking|running|executing).*?(?:the\s+)?(\w+)\s+tool/gi,
        /(\w+)\s+tool.*(?:to|for)/gi,
        /tool:\s*(\w+)/gi,
        /(?:the\s+)?(\w+)\s+tool/gi,
        /running\s+(\w+)\s+command/gi,
        /executing\s+(\w+)\s+command/gi
      ];

      for (const pattern of toolPatterns) {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(cleanOutput)) !== null) {
          if (match[1] && match[1].length > 1) {
            tools.push(match[1]);
          }
        }
      }
    }

    return [...new Set(tools)]; // Remove duplicates
  }

  /**
   * Extract error messages from output
   */
  extractErrors(output: string): string[] {
    const errors: string[] = [];
    
    try {
      const jsonData = JSON.parse(this.stripAnsi(output));
      if (jsonData.error) {
        errors.push(jsonData.error);
      }
    } catch {
      // Text-based error extraction
      const errorPatterns = [
        /error:.*$/gim,
        /failed.*$/gim,
        /cannot.*$/gim,
        /unable.*$/gim,
        /permission denied.*$/gim,
        /not found.*$/gim,
        /invalid.*$/gim
      ];

      const cleanOutput = this.stripAnsi(output);
      for (const pattern of errorPatterns) {
        const matches = cleanOutput.match(pattern);
        if (matches) {
          errors.push(...matches.map(m => m.trim()));
        }
      }
    }

    return [...new Set(errors)]; // Remove duplicates
  }

  /**
   * Extract file operations from output
   */
  extractFileOperations(output: string): FileOperations {
    const fileOps: FileOperations = {
      modified: [],
      created: [],
      read: []
    };

    try {
      const jsonData = JSON.parse(this.stripAnsi(output));
      
      if (jsonData.files_modified && Array.isArray(jsonData.files_modified)) {
        fileOps.modified.push(...jsonData.files_modified);
      }
      
      if (jsonData.files_created && Array.isArray(jsonData.files_created)) {
        fileOps.created.push(...jsonData.files_created);
      }
      
      if (jsonData.files_read && Array.isArray(jsonData.files_read)) {
        fileOps.read.push(...jsonData.files_read);
      }
    } catch {
      // Text-based file operation extraction
      const filePatterns = {
        modified: /(?:modified|updated|changed).*?file.*?([^\s\n]+)/gi,
        created: /(?:created|added|generated).*?file.*?([^\s\n]+)/gi,
        read: /(?:read|reading|examined).*?file.*?([^\s\n]+)/gi
      };

      const cleanOutput = this.stripAnsi(output);
      
      for (const [operation, pattern] of Object.entries(filePatterns)) {
        const matches = cleanOutput.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            (fileOps as any)[operation].push(match[1]);
          }
        }
      }
    }

    return fileOps;
  }

  /**
   * Extract commands executed from output
   */
  extractCommands(output: string): string[] {
    const commands: string[] = [];

    try {
      const jsonData = JSON.parse(this.stripAnsi(output));
      
      if (jsonData.commands_executed && Array.isArray(jsonData.commands_executed)) {
        commands.push(...jsonData.commands_executed);
      }
      
      if (jsonData.bash_commands && Array.isArray(jsonData.bash_commands)) {
        commands.push(...jsonData.bash_commands);
      }
    } catch {
      // Text-based command extraction
      const commandPatterns = [
        /(?:executing|running).*?command:?\s*(.+)$/gim,
        /^\$\s*(.+)$/gim,
        />\s*(.+)$/gim
      ];

      const cleanOutput = this.stripAnsi(output);
      
      for (const pattern of commandPatterns) {
        const matches = cleanOutput.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            commands.push(match[1].trim());
          }
        }
      }
    }

    return [...new Set(commands)]; // Remove duplicates
  }

  /**
   * Extract session metadata from output
   */
  extractSessionMetadata(output: string): SessionMetadata {
    const metadata: SessionMetadata = {};

    try {
      const jsonData = JSON.parse(this.stripAnsi(output));
      
      metadata.sessionId = jsonData.session_id || jsonData.sessionId;
      metadata.totalCost = jsonData.total_cost_usd || jsonData.totalCost;
      metadata.timestamp = jsonData.timestamp;
    } catch {
      // Text-based metadata extraction
      const cleanOutput = this.stripAnsi(output);
      
      const sessionIdMatch = cleanOutput.match(/session.*?id:?\s*([^\s\n]+)/i);
      if (sessionIdMatch) {
        metadata.sessionId = sessionIdMatch[1];
      }
      
      const costMatch = cleanOutput.match(/(?:total\s+)?cost:?\s*\$?([\d.]+)/i);
      if (costMatch) {
        metadata.totalCost = parseFloat(costMatch[1]);
      }
      
      const timestampMatch = cleanOutput.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/);
      if (timestampMatch) {
        metadata.timestamp = timestampMatch[1];
      }
    }

    return metadata;
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.buffer = '';
    this.completeMessages = [];
  }

  /**
   * Get current buffer state (for debugging)
   */
  getBufferState(): { buffer: string; messageCount: number } {
    return {
      buffer: this.buffer,
      messageCount: this.completeMessages.length
    };
  }
}