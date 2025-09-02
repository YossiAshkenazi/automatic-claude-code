#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

function getSessionPrompt() {
  try {
    // Try to get current session transcript from stdin
    let transcriptPath = null;
    
    if (process.stdin.isTTY === false) {
      try {
        const stdinData = fs.readFileSync(0, 'utf-8');
        const claudeData = JSON.parse(stdinData);
        transcriptPath = claudeData.transcript_path;
      } catch (e) {
        // Fallback to finding most recent
      }
    }
    
    // If no transcript path from stdin, find most recent session
    if (!transcriptPath) {
      const claudeDir = path.join(os.homedir(), '.claude', 'sessions');
      if (fs.existsSync(claudeDir)) {
        const sessions = fs.readdirSync(claudeDir)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => ({
            path: path.join(claudeDir, f),
            mtime: fs.statSync(path.join(claudeDir, f)).mtime
          }))
          .sort((a, b) => b.mtime - a.mtime);
        
        if (sessions.length > 0) {
          transcriptPath = sessions[0].path;
        }
      }
    }
    
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      console.log('💬 No session');
      return;
    }
    
    // Read the session file and get last user prompt
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l);
    
    // Look for the most recent user message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        
        // Check for user message
        if (entry.message && entry.message.role === 'user') {
          let text = '';
          
          if (typeof entry.message.content === 'string') {
            text = entry.message.content;
          } else if (Array.isArray(entry.message.content)) {
            // Find text content in array
            for (const item of entry.message.content) {
              if (item.type === 'text' && item.text) {
                text = item.text;
                break;
              }
            }
          }
          
          if (text) {
            // Clean and truncate
            text = text.replace(/\s+/g, ' ').trim();
            if (text.length > 45) {
              text = text.substring(0, 42) + '...';
            }
            console.log(`💬 ${text}`);
            return;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    console.log('💬 No prompt yet');
  } catch (error) {
    console.log('💬 Session error');
  }
}

getSessionPrompt();