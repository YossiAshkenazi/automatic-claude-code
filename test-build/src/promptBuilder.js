"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptBuilder = void 0;
class PromptBuilder {
    buildNextPrompt(lastOutput, sessionHistory, analysis) {
        const prompts = [];
        if (analysis.hasError) {
            prompts.push(this.buildErrorRecoveryPrompt(lastOutput));
        }
        else if (analysis.needsMoreWork) {
            prompts.push(this.buildContinuationPrompt(lastOutput, sessionHistory));
        }
        else {
            prompts.push(this.buildRefinementPrompt(lastOutput));
        }
        if (analysis.suggestions && analysis.suggestions.length > 0) {
            prompts.push(`Consider: ${analysis.suggestions.join(', ')}`);
        }
        return prompts.join(' ');
    }
    buildErrorRecoveryPrompt(output) {
        const errors = this.extractErrorDetails(output);
        if (errors.length === 0) {
            return 'The previous attempt encountered an issue. Please diagnose and fix the problem.';
        }
        const errorList = errors.map(e => `- ${e}`).join('\n');
        return `The previous attempt failed with the following errors:\n${errorList}\n\nPlease fix these errors and continue with the task.`;
    }
    buildContinuationPrompt(output, history) {
        const recentProgress = this.summarizeProgress(output);
        const nextSteps = this.inferNextSteps(output, history);
        const prompts = [];
        if (recentProgress) {
            prompts.push(`Progress so far: ${recentProgress}`);
        }
        if (nextSteps.length > 0) {
            prompts.push(`Continue with: ${nextSteps.join(', ')}`);
        }
        else {
            prompts.push('Continue with the next logical step in the implementation.');
        }
        if (output.files && output.files.length > 0) {
            prompts.push(`Recently modified files: ${output.files.slice(-3).join(', ')}`);
        }
        return prompts.join(' ');
    }
    buildRefinementPrompt(output) {
        const improvements = this.suggestImprovements(output);
        if (improvements.length === 0) {
            return 'Review the implementation and make any necessary optimizations or improvements.';
        }
        return `Please refine the implementation by: ${improvements.join(', ')}`;
    }
    extractErrorDetails(output) {
        const errors = [];
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
    summarizeProgress(output) {
        const summaries = [];
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
    inferNextSteps(output, history) {
        const steps = [];
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
    suggestImprovements(output) {
        const improvements = [];
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
    buildInitialSystemPrompt(projectPath, requirements) {
        const prompts = [
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
exports.PromptBuilder = PromptBuilder;
