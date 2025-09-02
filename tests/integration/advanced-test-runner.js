const { execSync } = require('child_process');
const path = require('path');

// Advanced test runner for StreamJsonParser with edge cases
console.log('Running Advanced StreamJsonParser tests...\n');

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
  
  // Edge case tests
  test('Handles empty string input', () => {
    const parser = new StreamJsonParser();
    const result = parser.stripAnsi('');
    if (result !== '') {
      throw new Error('Empty string handling failed');
    }
  });
  
  test('Handles malformed JSON gracefully', () => {
    const parser = new StreamJsonParser();
    const malformedJson = '{"result": "success", "sessionId": abc123}';
    const result = parser.parseJsonChunk(malformedJson);
    if (result.isComplete || !result.error) {
      throw new Error('Should detect malformed JSON');
    }
  });
  
  test('Handles multiple JSON objects in stream', () => {
    const parser = new StreamJsonParser();
    parser.addChunk('{"id": 1}\n{"id": 2}\n');
    const messages = parser.getCompleteMessages();
    if (messages.length !== 2 || messages[0].id !== 1 || messages[1].id !== 2) {
      throw new Error('Multiple JSON objects handling failed');
    }
  });
  
  test('Handles mixed text and JSON output', () => {
    const parser = new StreamJsonParser();
    parser.addChunk('Some text output\n');
    parser.addChunk('{"json_data": "value"}\n');
    parser.addChunk('More text\n');
    
    const messages = parser.getCompleteMessages();
    if (messages.length !== 1 || messages[0].json_data !== 'value') {
      throw new Error('Mixed content handling failed');
    }
  });
  
  test('Recovers from malformed chunks', () => {
    const parser = new StreamJsonParser();
    parser.addChunk('{"malformed": json}');
    parser.addChunk('{"valid": "json"}');
    
    const messages = parser.getCompleteMessages();
    if (messages.length !== 1 || messages[0].valid !== 'json') {
      throw new Error('Error recovery failed');
    }
  });
  
  test('Handles complex ANSI sequences', () => {
    const parser = new StreamJsonParser();
    const input = '\x1b[1;31;40mBold red text on black background\x1b[0m';
    const result = parser.stripAnsi(input);
    if (result !== 'Bold red text on black background') {
      throw new Error('Complex ANSI handling failed');
    }
  });
  
  test('Handles broken JSON across multiple chunks', () => {
    const parser = new StreamJsonParser();
    const chunks = ['{"tools_u', 'sed": ["Read", "Wri', 'te"], "result": "File', 's processed"}'];
    
    chunks.forEach(chunk => parser.addChunk(chunk));
    
    if (!parser.hasCompleteMessage()) {
      throw new Error('Should have complete message after all chunks');
    }
    
    const message = parser.getCompleteMessage();
    if (!message || !message.tools_used || !message.tools_used.includes('Read')) {
      throw new Error('Broken JSON reassembly failed');
    }
  });
  
  test('Detects session termination patterns', () => {
    const parser = new StreamJsonParser();
    if (!parser.isResponseComplete('Session ended. Total cost: $0.05')) {
      throw new Error('Should detect session termination');
    }
  });
  
  test('Extracts tools from text output', () => {
    const parser = new StreamJsonParser();
    const textOutput = `
      Using the Read tool to examine file.ts
      Invoking Edit tool to modify content
      Running Bash command: npm install
    `;
    
    const tools = parser.extractToolUsage(textOutput);
    if (!tools.includes('Read') || !tools.includes('Edit') || !tools.includes('Bash')) {
      throw new Error('Text-based tool extraction failed');
    }
  });
  
  test('Maintains buffer integrity after errors', () => {
    const parser = new StreamJsonParser();
    parser.addChunk('{"partial":');
    parser.addChunk('invalid}');
    parser.addChunk('{"valid": "complete"}');
    
    const messages = parser.getCompleteMessages();
    if (messages.length !== 1 || messages[0].valid !== 'complete') {
      throw new Error('Buffer integrity after errors failed');
    }
  });
  
  test('Parser state reset works', () => {
    const parser = new StreamJsonParser();
    parser.addChunk('{"test": "data"}');
    parser.reset();
    
    const state = parser.getBufferState();
    if (state.buffer !== '' || state.messageCount !== 0) {
      throw new Error('Parser reset failed');
    }
  });
  
  test('Real-time Claude Code output simulation', () => {
    const parser = new StreamJsonParser();
    const chunks = [
      '\x1b[32m✓\x1b[0m Reading file: src/test.ts\n',
      '{"tools_used": ["Read"], "files_read": ["src/test.ts"]}\n',
      'Analyzing file content...\n',
      '\x1b[33m⚠\x1b[0m Warning: Deprecated function found\n',
      '{"result": "Analysis complete", "status": "success"}\n'
    ];

    chunks.forEach(chunk => parser.addChunk(chunk));
    
    const completeMessages = parser.getCompleteMessages();
    if (completeMessages.length < 1) {
      throw new Error('Should have at least one complete message');
    }
    
    const lastMessage = completeMessages[completeMessages.length - 1];
    if (lastMessage.result !== 'Analysis complete') {
      throw new Error('Real-time simulation failed');
    }
  });
  
  test('File operations extraction from text', () => {
    const parser = new StreamJsonParser();
    const textOutput = 'Created file: src/new.ts\nModified file: package.json\nRead file: README.md';
    const fileOps = parser.extractFileOperations(textOutput);
    
    if (fileOps.created.length === 0 || fileOps.modified.length === 0 || fileOps.read.length === 0) {
      throw new Error('Text-based file operations extraction failed');
    }
  });
  
  test('Commands extraction from text', () => {
    const parser = new StreamJsonParser();
    const textOutput = 'Executing command: npm install\n$ git add .\n> pwd';
    const commands = parser.extractCommands(textOutput);
    
    if (commands.length === 0) {
      throw new Error('Text-based commands extraction failed');
    }
  });
  
  test('Session metadata from text', () => {
    const parser = new StreamJsonParser();
    const textOutput = 'Session ID: test-session-123\nTotal cost: $0.05';
    const metadata = parser.extractSessionMetadata(textOutput);
    
    if (!metadata.sessionId || !metadata.totalCost) {
      throw new Error('Text-based metadata extraction failed');
    }
  });
  
  console.log(`\n📊 Advanced Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All advanced tests passed!');
  }
  
} catch (error) {
  console.error('❌ Advanced test runner failed:', error.message);
  process.exit(1);
}