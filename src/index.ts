#!/usr/bin/env node

// Re-export the CLI main function and core classes for backward compatibility
export { main } from './cli/index';
export { AutomaticClaudeCodeCore } from './core/application';
export { CommandCoordinator } from './core/coordinator';

// Import and run the CLI if this is the main module
if (require.main === module) {
  import('./cli/index').then(({ main }) => {
    main().catch(console.error);
  });
}