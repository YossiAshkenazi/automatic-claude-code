#!/usr/bin/env node

import { createCLIParser } from './parser';

async function main() {
  try {
    const program = createCLIParser();
    
    // Parse command line arguments
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('CLI Error:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}

export { main };