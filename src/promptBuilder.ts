import { ParsedOutput } from './outputParser';

export interface AnalysisResult {
  isComplete: boolean;
  hasError: boolean;
  needsMoreWork: boolean;
  suggestions?: string[];
}

export class PromptBuilder {
  buildNextPrompt(
    lastOutput: ParsedOutput,
    sessionHistory: string[],
    analysis: AnalysisResult
  ): string {
    const prompts: string[] = [];

    if (analysis.hasError) {
      prompts.push(this.buildErrorRecoveryPrompt(lastOutput));
    } else if (analysis.needsMoreWork) {
      prompts.push(this.buildContinuationPrompt(lastOutput, sessionHistory));
    } else {
      prompts.push(this.buildRefinementPrompt(lastOutput));
    }

    if (analysis.suggestions && analysis.suggestions.length > 0) {
      prompts.push(`Consider: ${analysis.suggestions.join(', ')}`);
    }

    return prompts.join(' ');
  }

  private buildErrorRecoveryPrompt(output: ParsedOutput): string {
    const errors = this.extractErrorDetails(output);
    
    if (errors.length === 0) {
      return 'The previous attempt encountered an issue. Please diagnose and fix the problem.';
    }

    const errorList = errors.map(e => `- ${e}`).join('\n');
    
    return `The previous attempt failed with the following errors:\n${errorList}\n\nPlease fix these errors and continue with the task.`;
  }

  private buildContinuationPrompt(output: ParsedOutput, history: string[]): string {
    const recentProgress = this.summarizeProgress(output);
    const nextSteps = this.inferNextSteps(output, history);
    
    const prompts: string[] = [];
    
    if (recentProgress) {
      prompts.push(`Progress so far: ${recentProgress}`);
    }
    
    if (nextSteps.length > 0) {
      prompts.push(`Continue with: ${nextSteps.join(', ')}`);
    } else {
      prompts.push('Continue with the next logical step in the implementation.');
    }
    
    if (output.files && output.files.length > 0) {
      prompts.push(`Recently modified files: ${output.files.slice(-3).join(', ')}`);
    }
    
    return prompts.join(' ');
  }

  private buildRefinementPrompt(output: ParsedOutput): string {
    const improvements = this.suggestImprovements(output);
    
    if (improvements.length === 0) {
      return 'Review the implementation and make any necessary optimizations or improvements.';
    }
    
    return `Please refine the implementation by: ${improvements.join(', ')}`;
  }

  private extractErrorDetails(output: ParsedOutput): string[] {
    const errors: string[] = [];
    
    if (output.error) {
      errors.push(output.error);
    }
    
    const result = output.result || '';
    
    const errorPatterns = [
      /TypeError:.*$/gm,
      /SyntaxError:.*$/gm,
      /ReferenceError:.*$/gm,
      /Error:.*$/gm,
      /failed.*$/gmi,
      /cannot.*$/gmi,
    ];
    
    for (const pattern of errorPatterns) {
      const matches = result.match(pattern);
      if (matches) {
        errors.push(...matches.slice(0, 3));
      }
    }
    
    return [...new Set(errors)];
  }

  private summarizeProgress(output: ParsedOutput): string {
    const summaries: string[] = [];
    
    if (output.files && output.files.length > 0) {
      summaries.push(`${output.files.length} files modified`);
    }
    
    if (output.commands && output.commands.length > 0) {
      summaries.push(`${output.commands.length} commands executed`);
    }
    
    if (output.tools && output.tools.length > 0) {
      const toolList = output.tools.slice(0, 3).join(', ');
      summaries.push(`used ${toolList}`);
    }
    
    return summaries.join(', ');
  }

  private inferNextSteps(output: ParsedOutput, history: string[]): string[] {
    const steps: string[] = [];
    const lastResult = output.result || '';
    const recentHistory = history.slice(-2).join(' ');
    
    if (lastResult.includes('TODO') || lastResult.includes('todo')) {
      steps.push('complete remaining TODO items');
    }
    
    if (lastResult.includes('test') && !lastResult.includes('tests pass')) {
      steps.push('run and fix tests');
    }
    
    if (lastResult.includes('implement') && !lastResult.includes('implemented')) {
      steps.push('complete implementation');
    }
    
    if (output.files?.some(f => f.endsWith('.ts') || f.endsWith('.js'))) {
      if (!recentHistory.includes('lint') && !recentHistory.includes('build')) {
        steps.push('run linting and build checks');
      }
    }
    
    if (lastResult.includes('error') || lastResult.includes('warning')) {
      steps.push('resolve errors and warnings');
    }
    
    if (steps.length === 0) {
      if (!recentHistory.includes('document')) {
        steps.push('add documentation if needed');
      }
      
      if (!recentHistory.includes('test')) {
        steps.push('add tests if applicable');
      }
    }
    
    return steps.slice(0, 3);
  }

  private suggestImprovements(output: ParsedOutput): string[] {
    const improvements: string[] = [];
    const result = output.result || '';
    
    if (!result.includes('optimiz')) {
      improvements.push('optimizing performance');
    }
    
    if (!result.includes('error handling')) {
      improvements.push('adding error handling');
    }
    
    if (!result.includes('validation')) {
      improvements.push('adding input validation');
    }
    
    if (output.files?.some(f => f.includes('test'))) {
      improvements.push('ensuring test coverage');
    }
    
    return improvements.slice(0, 2);
  }

  buildInitialSystemPrompt(projectPath: string, requirements?: string): string {
    const prompts: string[] = [
      `You are working on a project at: ${projectPath}`,
      'Your goal is to iteratively develop and improve the codebase.',
      'After each task, provide a clear summary of what was accomplished.',
      'If you encounter errors, fix them before proceeding.',
      'Follow best practices and maintain code quality.',
    ];
    
    if (requirements) {
      prompts.push(`Project requirements: ${requirements}`);
    }
    
    return prompts.join(' ');
  }
}