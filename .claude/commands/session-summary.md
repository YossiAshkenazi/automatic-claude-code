---
description: Generate session summary prompt for new chat session
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git status:*)
---

Generate a concise prompt summarizing what was accomplished in this session and what should be done next. Output only the prompt text without any additional commentary.

Based on recent git commits, current git status, and recent file changes, create a prompt that includes:

1. Brief context of what was worked on
2. What was completed/implemented  
3. Current state of the project
4. Next steps that should be taken

Format as a clear, actionable prompt ready to paste into a new Claude Code session.