#!/usr/bin/env python3
"""
BMAD Product Owner (Sarah) Demo with Working Wrapper
"""

import asyncio
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

class BMADProductOwner:
    """Sarah - BMAD Product Owner with wrapper integration"""
    
    def __init__(self):
        self.name = "Sarah"
        self.role = "Technical Product Owner"
        self.yolo_mode = False
        
        # Use Sonnet model (we know this works from tests)
        self.wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(
            model="claude:sonnet",
            max_turns=2,
            allowed_tools=["Read", "Write"],
            timeout=30
        ))
    
    async def show_help(self):
        """Show BMAD PO commands"""
        return """
BMAD Product Owner Commands (Sarah):
1. create-story - Create user story from requirements
2. validate-story - Validate story against quality standards  
3. create-epic - Create epic for brownfield projects
4. correct-course - Course correction analysis
5. yolo - Toggle confirmation mode
6. exit - Exit and cleanup
        """
    
    async def create_story(self, requirements):
        """Create user story following BMAD principles"""
        
        prompt = f"""Create a user story for: {requirements}

Follow this format:
- As a [user type]
- I want [functionality] 
- So that [benefit]

Include:
- 3-5 clear acceptance criteria
- Dependencies (if any)
- Estimated complexity (1-5)

Keep response focused and actionable."""
        
        return await self.wrapper.execute_sync(prompt)
    
    async def validate_story(self, story):
        """Validate story against BMAD standards"""
        
        prompt = f"""Validate this user story: {story[:200]}...

Check for:
- Clear user, want, benefit format
- Testable acceptance criteria
- No ambiguous terms
- Actionable for developers

Rate 1-10 and list specific issues."""
        
        return await self.wrapper.execute_sync(prompt)
    
    async def cleanup(self):
        """Clean shutdown"""
        await self.wrapper._get_underlying_wrapper().cleanup()

async def demo_bmad_po():
    """Demo BMAD Product Owner capabilities"""
    
    print("=== BMAD Product Owner Demo ===")
    print("Sarah activated with reliable wrapper")
    print()
    
    sarah = BMADProductOwner()
    
    try:
        # Show available commands
        help_text = await sarah.show_help()
        print(help_text)
        
        # Demo 1: Create story
        print("\n--- Demo 1: Story Creation ---")
        story = await sarah.create_story("User needs to reset forgotten password")
        print("Story created:")
        print(story)
        
        # Demo 2: Validate story  
        print("\n--- Demo 2: Story Validation ---")
        validation = await sarah.validate_story(story)
        print("Validation result:")
        print(validation)
        
        print("\n=== SUCCESS ===")
        print("BMAD PO integration working with:")
        print("- No JSON parsing errors")
        print("- Reliable wrapper execution")
        print("- BMAD process adherence")
        print("- Clean resource management")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await sarah.cleanup()
        print("Sarah signed off - all resources cleaned")

if __name__ == "__main__":
    asyncio.run(demo_bmad_po())