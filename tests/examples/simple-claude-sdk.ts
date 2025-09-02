#!/usr/bin/env tsx

import Anthropic from '@anthropic-ai/sdk';

// Simple Claude SDK implementation
async function runClaudeTask(prompt: string) {
  console.log('🚀 Starting Claude SDK task...');
  
  // Initialize the Anthropic client
  const anthropic = new Anthropic({
    // API key should be set in environment variable ANTHROPIC_API_KEY
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    console.log('💭 Sending prompt to Claude...');
    
    // Create a message stream for real-time output
    const stream = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    console.log('📝 Response (streaming):');
    console.log('---');

    // Process the stream as it arrives
    let fullResponse = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text') {
        const text = chunk.delta.text;
        process.stdout.write(text); // Stream output immediately
        fullResponse += text;
      }
    }

    console.log('\n---');
    console.log('✅ Task completed successfully!');
    return fullResponse;

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const prompt = process.argv[2] || 'Hello! Please write a simple "Hello World" program in TypeScript.';
  
  console.log(`📋 Task: ${prompt}\n`);
  
  try {
    await runClaudeTask(prompt);
  } catch (error) {
    console.error('Failed to run Claude task:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { runClaudeTask };