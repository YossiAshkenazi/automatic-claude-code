#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

function getRecentPrompt() {
  try {
    // First try to use stdin data from ccstatusline for current session
    if (process.stdin.isTTY === false) {
      try {
        const stdinData = fs.readFileSync(0, 'utf-8');
        const claudeData = JSON.parse(stdinData);
        
        if (claudeData.transcript_path && fs.existsSync(claudeData.transcript_path)) {
          const result = getLastPromptFromFile(claudeData.transcript_path);
          if (result) {
            console.log(result);
            return;
          }
        }
      } catch (e) {
        // Fall through to current session search
      }
    }
    
    // If no stdin data, show fallback
    console.log('💬 Current session');
    
  } catch (error) {
    console.log('💬 Error');
  }
}

function getLastPromptFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l);
    
    // Find the most recent user message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        
        if (entry.message && entry.message.role === 'user') {
          let text = '';
          
          // Handle different content formats
          if (typeof entry.message.content === 'string') {
            text = entry.message.content;
          } else if (Array.isArray(entry.message.content)) {
            // Find text in array format
            for (const item of entry.message.content) {
              if (item.type === 'text' && item.text) {
                text = item.text;
                break;
              }
            }
          }
          
          if (text && text.length > 0) {
            // Clean and truncate
            text = text.replace(/\s+/g, ' ').trim();
            
            // Skip system messages or tool calls
            if (text.includes('tool_use_id') || text.includes('system_prompt')) {
              continue;
            }
            
            if (text.length > 40) {
              text = text.substring(0, 37) + '...';
            }
            
            return `💬 ${text}`;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

getRecentPrompt();