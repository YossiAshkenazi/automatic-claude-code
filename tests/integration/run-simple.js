#!/usr/bin/env node

// Simple JavaScript runner (no TypeScript compilation needed)
const Anthropic = require('@anthropic-ai/sdk');

async function runClaudeTask(prompt) {
  console.log('🚀 Starting Claude SDK task...');
  
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    console.log('💭 Sending prompt to Claude...');
    
    const stream = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    console.log('📝 Response (streaming):');
    console.log('---');

    let fullResponse = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text') {
        const text = chunk.delta.text;
        process.stdout.write(text);
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

main();