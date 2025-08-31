---
description: Prompt Claude Code to proactively use multiple parallel agents and subagents
---

**AGENT-FIRST APPROACH ACTIVATED** 🤖

Before proceeding with the user's request, ALWAYS consider using multiple agents for optimal efficiency:

## Quick Decision Framework

**USE SUBAGENTS (Task tool) when:**
- Task involves exploration, search, or analysis (>30K tokens if done sequentially)
- Multiple files need similar updates
- Need specialized expertise (testing, reviewing, debugging)
- Early in conversation to preserve context
- Coordinated workflows required

**USE PARALLEL AGENTS (multiple sessions) when:**
- Completely independent tasks
- Different project areas (frontend/backend/tests)
- No coordination needed between tasks
- Maximum isolation required

**STAY SEQUENTIAL only when:**
- Strong dependencies between steps
- Debugging requiring full context
- Simple single-step tasks

## Performance Targets
- **Context efficiency**: Keep main session <30% throughout
- **Agent returns**: <1K tokens per agent
- **Speedup goal**: >2.8x faster completion
- **Token savings**: >90% context reduction

## Implementation Pattern
```
1. Identify if task can be parallelized/delegated
2. Launch appropriate agents EARLY in conversation
3. Request condensed summaries from agents
4. Integrate results efficiently
5. Preserve main context for coordination
```

**Golden Rule**: If it explores, searches, or repeats → DELEGATE IT

Now proceed with the user's actual request: $ARGUMENTS