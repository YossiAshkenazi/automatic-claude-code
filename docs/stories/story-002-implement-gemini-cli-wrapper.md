# User Story: Implement Gemini CLI Wrapper

## Story ID: STORY-002
**Epic**: Multi-Model CLI Integration
**Sprint**: Next
**Priority**: P1 (High)
**Story Points**: 8

## User Story
**As a** developer who wants to use multiple AI models  
**I want to** execute Gemini commands through a CLI wrapper similar to Claude  
**So that** I can leverage Google's Gemini models without complex SDK setup

## Background & Context
Following the successful pattern from Dan Disler's agentic-drop-zones and our Claude CLI wrapper, we need to implement a similar wrapper for Gemini CLI. This will provide a unified interface for multiple AI models through CLI execution.

## Acceptance Criteria
- [ ] Gemini CLI wrapper implemented with same interface as Claude wrapper
- [ ] Support for gemini-2.5-pro and gemini-2.5-flash models
- [ ] Yolo mode (--yolo) and sandbox mode (--sandbox) properly configured
- [ ] Real-time streaming of Gemini responses works
- [ ] MCP server support integrated (if available)
- [ ] Unified interface allows easy switching between Claude and Gemini
- [ ] Error handling for Gemini-specific issues implemented
- [ ] Documentation includes Gemini setup instructions

## Technical Requirements

### Core Implementation
1. **Create GeminiCliWrapper Class**
   ```python
   class GeminiCliWrapper:
       def __init__(self, options: GeminiCliOptions):
           self.model = options.model  # gemini-2.5-pro, gemini-2.5-flash
           self.yolo_mode = options.yolo_mode  # Auto-approve actions
           self.sandbox = options.sandbox  # Sandboxing enabled
   ```

2. **Implement Gemini-Specific Options**
   ```python
   @dataclass
   class GeminiCliOptions:
       model: str = "gemini-2.5-pro"
       yolo_mode: bool = True  # --yolo flag
       sandbox: bool = True    # --sandbox flag
       timeout: int = 300
       cli_path: Optional[str] = None
   ```

3. **Port Subprocess Execution Logic**
   - Adapt from Dan's implementation in `sfs_agentic_drop_zone.py`
   - Handle Gemini's line-by-line output format
   - Parse Gemini-specific response patterns

4. **Output Parsing for Gemini**
   ```python
   def _parse_gemini_line(self, line: str) -> CliMessage:
       # Parse Gemini CLI output patterns
       # Handle tool calls differently than Claude
       # Detect Gemini-specific errors
   ```

### Integration Features
1. **Unified Interface Design**
   ```python
   class UnifiedCliWrapper:
       def __init__(self, provider: str = "claude"):
           if provider == "claude":
               self.wrapper = ClaudeCliWrapper()
           elif provider == "gemini":
               self.wrapper = GeminiCliWrapper()
       
       async def execute(self, prompt: str):
           return await self.wrapper.execute(prompt)
   ```

2. **MCP Server Integration**
   - Check if Gemini supports MCP servers
   - Copy `.gemini/settings.json.sample` pattern from Dan's repo
   - Implement MCP configuration if supported

3. **Gemini-Specific Features**
   - Implement sandbox directory management
   - Handle Gemini's approval flow (with --yolo)
   - Support Gemini's specific tool patterns

### Testing Requirements
1. **Create Gemini Test Suite**
   ```python
   # test_gemini_cli_wrapper.py
   - test_gemini_installation()
   - test_model_selection()
   - test_yolo_mode()
   - test_sandbox_constraints()
   - test_gemini_streaming()
   - test_gemini_tools()
   ```

2. **Comparison Tests**
   ```python
   # test_unified_wrapper.py
   - test_claude_vs_gemini_simple()
   - test_response_format_consistency()
   - test_error_handling_both()
   - test_performance_comparison()
   ```

3. **Integration Examples**
   ```python
   # examples/multi_model_demo.py
   - Run same prompt on both models
   - Compare responses
   - Demonstrate model switching
   - Show unified error handling
   ```

## Definition of Done
- [ ] GeminiCliWrapper class fully implemented
- [ ] All Gemini-specific tests pass
- [ ] Unified interface works with both Claude and Gemini
- [ ] Installation guide for Gemini CLI included
- [ ] Performance benchmarks documented
- [ ] Code follows same patterns as Claude wrapper
- [ ] PR reviewed and approved
- [ ] Merged to main branch

## Dependencies
- Gemini CLI must be installed (`npm install -g @google/gemini-cli`)
- Google account with Gemini access
- Existing Claude CLI wrapper as reference
- Dan's agentic-drop-zones repository for patterns

## Implementation Steps
1. **Setup Phase**
   - Install Gemini CLI
   - Test manual Gemini CLI commands
   - Document output format differences

2. **Core Development**
   - Copy ClaudeCliWrapper as starting point
   - Adapt for Gemini-specific flags and options
   - Implement Gemini output parsing

3. **Integration Phase**
   - Create unified wrapper interface
   - Test both models side-by-side
   - Ensure consistent message format

4. **Testing & Documentation**
   - Write comprehensive tests
   - Create usage examples
   - Document setup process

## Risk Mitigation
- **Risk**: Gemini CLI has different output format
  - **Mitigation**: Study Dan's implementation carefully
- **Risk**: No SDK means relying on CLI stability
  - **Mitigation**: Version-lock Gemini CLI, document tested version
- **Risk**: Authentication differs from Claude
  - **Mitigation**: Document Gemini-specific auth process

## Competitive Advantage
- First to provide unified CLI wrapper for both Claude and Gemini
- No API keys or complex SDK setup required
- Leverages subscription/free tiers effectively
- Based on proven pattern from agentic-drop-zones

## Notes
- Reference Dan's `prompt_gemini_cli` method for implementation
- Consider adding Codex CLI support in future (STORY-003)
- Maintain consistent interface with Claude wrapper

## References
- [Gemini CLI Documentation](https://github.com/google-gemini/gemini-cli)
- [Dan's Implementation](https://github.com/disler/agentic-drop-zones/blob/main/sfs_agentic_drop_zone.py#L344-L433)
- Claude wrapper: `python-sdk/claude_cli_wrapper.py`
- Unified wrapper design: To be created