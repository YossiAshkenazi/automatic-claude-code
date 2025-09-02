#!/usr/bin/env node

const fs = require('fs');

function getCurrentSessionPrompt() {
  try {
    let input = '';
    
    // Check if we have stdin data (ccstatusline provides transcript path via stdin)
    if (process.stdin.isTTY === false) {
      // We have stdin data from ccstatusline
      const stdinData = require('fs').readFileSync(0, 'utf-8');
      
      try {
        const claudeData = JSON.parse(stdinData);
        
        // Use the transcript path from current session
        if (claudeData.transcript_path && fs.existsSync(claudeData.transcript_path)) {
          const content = fs.readFileSync(claudeData.transcript_path, 'utf-8');
          const lines = content.trim().split('\n').filter(l => l);
          
          // Find the last user message in THIS session
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const data = JSON.parse(lines[i]);
              
              if (data.message && data.message.role === 'user') {
                const content = data.message.content;
                
                // Handle string content
                if (typeof content === 'string' && !content.includes('tool_use_id')) {
                  let text = content.replace(/\s+/g, ' ').trim();
                  if (text.length > 45) {
                    text = text.substring(0, 42) + '...';
                  }
                  console.log(`💬 ${text}`);
                  return;
                }
                
                // Handle array format (newer Claude format)
                if (Array.isArray(content)) {
                  for (const item of content) {
                    if (item.type === 'text' && item.text) {
                      let text = item.text.replace(/\s+/g, ' ').trim();
                      if (text.length > 45) {
                        text = text.substring(0, 42) + '...';
                      }
                      console.log(`💬 ${text}`);
                      return;
                    }
                  }
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      } catch (e) {
        // Fall back to showing session ID or other info
        console.log('💬 Current session');
        return;
      }
    }
    
    // Fallback if no stdin data
    console.log('💬 Current session');
    
  } catch (error) {
    console.log('💬 No prompt');
  }
}

getCurrentSessionPrompt();