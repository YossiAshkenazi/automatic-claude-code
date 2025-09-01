const { execSync } = require('child_process');

console.log('Debug test for StreamJsonParser...\n');

try {
  // Compile TypeScript first
  console.log('Building project...');
  execSync('npx tsc', { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ Build successful\n');
  
  const { StreamJsonParser } = require('./dist/outputParser');

  // Debug tool extraction
  console.log('=== Debugging tool extraction ===');
  const parser = new StreamJsonParser();
  const textOutput = `
    Using the Read tool to examine file.ts
    Invoking Edit tool to modify content
    Running Bash command: npm install
  `;
  
  console.log('Input text:', textOutput);
  const tools = parser.extractToolUsage(textOutput);
  console.log('Extracted tools:', tools);
  console.log('Expected: Read, Edit, Bash');
  console.log();
  
  // Debug error recovery
  console.log('=== Debugging error recovery ===');
  const parser2 = new StreamJsonParser();
  console.log('Adding malformed chunk: {"malformed": json}');
  parser2.addChunk('{"malformed": json}');
  console.log('Buffer state after malformed:', parser2.getBufferState());
  
  console.log('Adding valid chunk: {"valid": "json"}');
  parser2.addChunk('{"valid": "json"}');
  console.log('Buffer state after valid:', parser2.getBufferState());
  
  const messages = parser2.getCompleteMessages();
  console.log('Retrieved messages:', messages);
  console.log('Expected: [{"valid": "json"}]');
  console.log();
  
  // Debug buffer integrity
  console.log('=== Debugging buffer integrity ===');
  const parser3 = new StreamJsonParser();
  console.log('Adding: {"partial":');
  parser3.addChunk('{"partial":');
  console.log('Buffer state:', parser3.getBufferState());
  
  console.log('Adding: invalid}');
  parser3.addChunk('invalid}');
  console.log('Buffer state:', parser3.getBufferState());
  
  console.log('Adding: {"valid": "complete"}');
  parser3.addChunk('{"valid": "complete"}');
  console.log('Buffer state:', parser3.getBufferState());
  
  const messages2 = parser3.getCompleteMessages();
  console.log('Retrieved messages:', messages2);
  console.log('Expected: [{"valid": "complete"}]');
  
} catch (error) {
  console.error('❌ Debug test failed:', error.message);
}