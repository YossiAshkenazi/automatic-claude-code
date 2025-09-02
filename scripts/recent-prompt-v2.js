#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

function getRecentPrompt() {
  try {
    const claudeDir = path.join(os.homedir(), '.claude');
    
    // Try to read from stdin if available (ccstatusline provides transcript path)
    let transcriptPath = null;
    
    // Find most recent conversation
    const projectsDir = path.join(claudeDir, 'projects');
    if (fs.existsSync(projectsDir)) {
      const projects = fs.readdirSync(projectsDir);
      let mostRecentFile = null;
      let mostRecentTime = 0;
      
      for (const project of projects) {
        const projectPath = path.join(projectsDir, project);
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
      
      if (mostRecentFile) {
        const content = fs.readFileSync(mostRecentFile, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l);
        
        // Find last user message
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const data = JSON.parse(lines[i]);
            if (data.message && data.message.role === 'user') {
              let content = data.message.content;
              
              // Handle array content
              if (Array.isArray(content)) {
                content = content.map(item => 
                  typeof item === 'string' ? item : 
                  item.text || JSON.stringify(item)
                ).join(' ');
              }
              
              // Clean and truncate
              if (typeof content === 'string') {
                content = content.replace(/\s+/g, ' ').trim();
                if (content.length > 50) {
                  content = content.substring(0, 47) + '...';
                }
                console.log(`💬 ${content}`);
                return;
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    
    console.log('💬 No recent prompt');
  } catch (error) {
    console.log('💬 No recent prompt');
  }
}

getRecentPrompt();