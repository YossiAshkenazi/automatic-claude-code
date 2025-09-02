const { execSync } = require('child_process');
const path = require('path');

// Simple test runner for our StreamJsonParser
console.log('Running StreamJsonParser tests...\n');

try {
  // Compile TypeScript first
  console.log('Building project...');
  execSync('npx tsc', { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ Build successful\n');
  
  // Import and test the StreamJsonParser
  const { StreamJsonParser } = require('./dist/outputParser');
  
  let passed = 0;
  let failed = 0;
  
  function test(description, testFn) {
    try {
      testFn();
      console.log(`✅ ${description}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${description}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }
  
  // Basic ANSI stripping test
  test('ANSI stripping works', () => {
    const parser = new StreamJsonParser();
    const input = '\x1b[31mError:\x1b[0m Something went wrong';
    const result = parser.stripAnsi(input);
    if (result !== 'Error: Something went wrong') {
      throw new Error(`Expected "Error: Something went wrong", got "${result}"`);
    }
  });
  
  // JSON parsing test
  test('JSON chunk parsing works', () => {
    const parser = new StreamJsonParser();
    const jsonStr = '{"result": "success", "sessionId": "abc123"}';
    const result = parser.parseJsonChunk(jsonStr);
    if (!result.isComplete || !result.data || result.data.result !== 'success') {
      throw new Error('JSON parsing failed');
    }
  });
  
  // Stream buffering test
  test('Stream buffering works', () => {
    const parser = new StreamJsonParser();
    parser.addChunk('{"result": "suc');
    if (parser.hasCompleteMessage()) {
      throw new Error('Should not have complete message yet');
    }
    parser.addChunk('cess", "sessionId": "abc123"}');
    if (!parser.hasCompleteMessage()) {
      throw new Error('Should have complete message now');
    }
    const message = parser.getCompleteMessage();
    if (!message || message.result !== 'success') {
      throw new Error('Message reassembly failed');
    }
  });
  
  // Response completion detection test
  test('Response completion detection works', () => {
    const parser = new StreamJsonParser();
    if (!parser.isResponseComplete('Task completed successfully')) {
      throw new Error('Should detect completion');
    }
    if (parser.isResponseComplete('Working on task...')) {
      throw new Error('Should not detect completion for partial response');
    }
  });
  
  // Tool extraction test
  test('Tool usage extraction works', () => {
    const parser = new StreamJsonParser();
    const jsonOutput = '{"tools_used": ["Read", "Write", "Edit"]}';
    const tools = parser.extractToolUsage(jsonOutput);
    if (!tools.includes('Read') || !tools.includes('Write') || !tools.includes('Edit')) {
      throw new Error('Tool extraction failed');
    }
  });
  
  // Error extraction test
  test('Error message extraction works', () => {
    const parser = new StreamJsonParser();
    const output = 'Error: Something went wrong\nFailed to execute command';
    const errors = parser.extractErrors(output);
    if (errors.length === 0) {
      throw new Error('Should extract errors');
    }
  });
  
  // File operations test
  test('File operations extraction works', () => {
    const parser = new StreamJsonParser();
    const jsonOutput = '{"files_modified": ["src/test.ts"], "files_created": ["src/new.ts"]}';
    const fileOps = parser.extractFileOperations(jsonOutput);
    if (!fileOps.modified.includes('src/test.ts') || !fileOps.created.includes('src/new.ts')) {
      throw new Error('File operations extraction failed');
    }
  });
  
  // Commands extraction test
  test('Commands extraction works', () => {
    const parser = new StreamJsonParser();
    const jsonOutput = '{"commands_executed": ["npm install", "git add ."]}';
    const commands = parser.extractCommands(jsonOutput);
    if (!commands.includes('npm install') || !commands.includes('git add .')) {
      throw new Error('Commands extraction failed');
    }
  });
  
  // Session metadata test
  test('Session metadata extraction works', () => {
    const parser = new StreamJsonParser();
    const jsonOutput = '{"session_id": "test-123", "total_cost_usd": 0.05}';
    const metadata = parser.extractSessionMetadata(jsonOutput);
    if (metadata.sessionId !== 'test-123' || metadata.totalCost !== 0.05) {
      throw new Error('Session metadata extraction failed');
    }
  });
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!');
  }
  
} catch (error) {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
}