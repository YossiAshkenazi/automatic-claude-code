#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

function getRecentPrompt() {
  try {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects');
    
    if (!fs.existsSync(claudeDir)) {
      console.log('💬 No prompt yet');
      return;
    }
    
    // Find most recent JSONL file
    let mostRecentFile = null;
    let mostRecentTime = 0;
    
    const projects = fs.readdirSync(claudeDir);
    for (const project of projects) {
      const projectPath = path.join(claudeDir, project);
      if (fs.statSync(projectPath).isDirectory()) {
        const files = fs.readdirSync(projectPath);
        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            const filePath = path.join(projectPath, file);
            const stat = fs.statSync(filePath);
            if (stat.mtime > mostRecentTime) {
              mostRecentTime = stat.mtime;
              mostRecentFile = filePath;
            }
          }
        }
      }
    }
    
    if (!mostRecentFile) {
      console.log('💬 No prompt yet');
      return;
    }
    
    // Read file and find last actual user text message
    const content = fs.readFileSync(mostRecentFile, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l);
    
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const data = JSON.parse(lines[i]);
        
        // Look for user messages
        if (data.message && data.message.role === 'user') {
          const content = data.message.content;
          
          // Skip tool responses and find actual user text
          if (typeof content === 'string' && !content.includes('tool_use_id')) {
            let text = content.replace(/\s+/g, ' ').trim();
            if (text.length > 50) {
              text = text.substring(0, 47) + '...';
            }
            console.log(`💬 ${text}`);
            return;
          }
          
          // Handle array format (newer Claude format)
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === 'text' && item.text) {
                let text = item.text.replace(/\s+/g, ' ').trim();
                if (text.length > 50) {
                  text = text.substring(0, 47) + '...';
                }
                console.log(`💬 ${text}`);
                return;
              }
            }
          }
        }
      } catch (e) {
        // Skip invalid lines
      }
    }
    
    console.log('💬 No prompt yet');
  } catch (error) {
    console.log('💬 No prompt yet');
  }
}

getRecentPrompt();