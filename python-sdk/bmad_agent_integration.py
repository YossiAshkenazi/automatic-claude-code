#!/usr/bin/env python3
"""
BMAD Agent Integration with Tested Wrapper System
Demonstrates how Sarah (Product Owner) uses the reliable wrapper
"""

import asyncio
import yaml
from pathlib import Path
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

class BMADProductOwnerAgent:
    """Sarah - Technical Product Owner with wrapper integration"""
    
    def __init__(self):
        self.name = "Sarah"
        self.role = "Technical Product Owner & Process Steward"
        self.yolo_mode = False
        
        # Use the tested wrapper for reliable AI execution
        self.wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(
            model="claude:opus",  # Strategic thinking for PO work
            max_turns=20,
            allowed_tools=["Read", "Write", "Edit"],
            timeout=600,
            verbose=True
        ))
        
        # BMAD core configuration
        self.core_config = self.load_core_config()
        
        print(f"📝 {self.name} ({self.role}) activated with reliable wrapper integration!")

    def load_core_config(self):
        """Load BMAD core configuration"""
        try:
            with open('.bmad-core/core-config.yaml', 'r') as f:
                return yaml.safe_load(f)
        except:
            return {
                'devStoryLocation': 'docs/stories',
                'prdFile': 'docs/prd.md',
                'architectureFile': 'docs/architecture.md'
            }

    async def execute_command(self, command, args=None):
        """Execute BMAD PO commands using reliable wrapper"""
        
        if command == "help":
            return self.show_help()
        elif command == "create-story":
            return await self.create_user_story(args)
        elif command == "create-epic":
            return await self.create_epic(args)
        elif command == "validate-story-draft":
            return await self.validate_story(args)
        elif command == "correct-course":
            return await self.correct_course()
        elif command == "yolo":
            self.yolo_mode = not self.yolo_mode
            return f"YOLO mode: {'ON' if self.yolo_mode else 'OFF'}"
        elif command == "exit":
            await self.wrapper._get_underlying_wrapper().cleanup()
            return "Sarah signing off. All resources cleaned up!"
        else:
            return f"Unknown command: {command}. Use *help for available commands."

    def show_help(self):
        """Show numbered command list for user selection"""
        return """
BMAD Product Owner Commands:
1. correct-course - Execute course correction analysis  
2. create-epic - Create epic for brownfield projects
3. create-story - Create user story from requirements
4. doc-out - Output full document to current destination
5. execute-checklist-po - Run PO master checklist
6. validate-story-draft - Validate story against criteria  
7. yolo - Toggle confirmation mode (currently: {})
8. exit - Exit agent mode

Type the number or command name to execute.
        """.format("ON" if self.yolo_mode else "OFF")

    async def create_user_story(self, requirements):
        """Create user story using wrapper + BMAD templates"""
        
        print("🔨 Creating user story using BMAD process...")
        
        # Load BMAD story template
        story_template = await self.load_bmad_template("story-tmpl.yaml")
        
        # Use reliable wrapper (no JSON parsing errors!)
        prompt = f"""
        As Sarah, the Technical Product Owner, create a comprehensive user story following BMAD principles:
        
        TEMPLATE TO FOLLOW:
        {story_template}
        
        REQUIREMENTS:
        {requirements}
        
        CORE PRINCIPLES:
        - Guardian of Quality & Completeness
        - Clarity & Actionability for Development  
        - Process Adherence & Systemization
        - Dependency & Sequence Vigilance
        - Meticulous Detail Orientation
        
        OUTPUT: Complete user story with acceptance criteria, dependencies, and sequence validation.
        """
        
        story_draft = await self.wrapper.execute_sync(prompt)
        
        if not self.yolo_mode:
            print("\n📋 Story Draft Created:")
            print("=" * 50)
            print(story_draft[:500] + "..." if len(story_draft) > 500 else story_draft)
            print("=" * 50)
            
            confirm = input("\n✅ Approve this story? (y/n/edit): ").strip().lower()
            if confirm == 'n':
                return "Story creation cancelled."
            elif confirm == 'edit':
                return await self.refine_story(story_draft, requirements)
        
        # Save to BMAD location
        story_location = self.core_config.get('devStoryLocation', 'docs/stories')
        print(f"💾 Story ready for {story_location}")
        
        return story_draft

    async def create_epic(self, epic_requirements):
        """Create epic using BMAD brownfield process"""
        
        print("🏗️ Creating epic using BMAD brownfield process...")
        
        prompt = f"""
        As Sarah, create a comprehensive epic for brownfield project:
        
        REQUIREMENTS:
        {epic_requirements}
        
        BROWNFIELD CONSIDERATIONS:
        - Existing system analysis
        - Integration points identification
        - Legacy code impact assessment
        - Migration strategy if needed
        - Risk mitigation for existing functionality
        
        CREATE:
        1. Epic title and description
        2. User story breakdown
        3. Dependencies and sequence
        4. Acceptance criteria for epic completion
        5. Risk assessment and mitigation
        
        Follow BMAD process rigor and quality standards.
        """
        
        epic_draft = await self.wrapper.execute_sync(prompt)
        
        print("🎯 Epic created with BMAD quality standards!")
        return epic_draft

    async def validate_story(self, story_content):
        """Validate story against BMAD criteria"""
        
        print("🔍 Validating story against BMAD quality standards...")
        
        validation_prompt = f"""
        As Sarah, validate this user story against BMAD quality standards:
        
        STORY TO VALIDATE:
        {story_content}
        
        VALIDATION CRITERIA:
        ✅ Quality & Completeness - All sections comprehensive?
        ✅ Clarity & Actionability - Requirements unambiguous?
        ✅ Process Adherence - Follows BMAD templates?
        ✅ Dependencies - Logical sequencing identified?
        ✅ Detail Orientation - Prevents downstream errors?
        ✅ Testability - Acceptance criteria testable?
        
        PROVIDE:
        1. Overall quality score (1-10)
        2. Specific issues found
        3. Recommended improvements
        4. Approval/rejection recommendation
        """
        
        validation_result = await self.wrapper.execute_sync(validation_prompt)
        
        print("📊 Story validation completed!")
        return validation_result

    async def correct_course(self):
        """Execute course correction analysis"""
        
        print("🎯 Executing course correction analysis...")
        
        prompt = """
        As Sarah, perform comprehensive course correction analysis:
        
        ANALYZE:
        1. Current project trajectory vs. original goals
        2. Requirement drift identification
        3. Process adherence gaps
        4. Quality standard deviations
        5. Timeline and scope alignment
        
        RECOMMEND:
        1. Specific corrective actions
        2. Process improvements
        3. Quality gate reinforcements
        4. Communication adjustments
        5. Timeline realignment if needed
        
        Provide actionable recommendations with priority levels.
        """
        
        correction_analysis = await self.wrapper.execute_sync(prompt)
        
        print("🔄 Course correction analysis completed!")
        return correction_analysis

    async def load_bmad_template(self, template_name):
        """Load BMAD template reliably using wrapper"""
        try:
            template_path = f".bmad-core/templates/{template_name}"
            # Use wrapper for reliable file operations
            template_content = await self.wrapper.execute_sync(f"Read the file {template_path}")
            return template_content
        except:
            return "# Default BMAD Story Template\nuser_story:\ntitle: \ndescription: \nacceptance_criteria: []"

    async def refine_story(self, original_story, requirements):
        """Refine story based on user feedback"""
        feedback = input("What would you like to change about the story? ")
        
        refinement_prompt = f"""
        Refine this user story based on feedback:
        
        ORIGINAL STORY:
        {original_story}
        
        ORIGINAL REQUIREMENTS:
        {requirements}
        
        USER FEEDBACK:
        {feedback}
        
        Maintain BMAD quality standards while incorporating the requested changes.
        """
        
        refined_story = await self.wrapper.execute_sync(refinement_prompt)
        return refined_story

async def demo_bmad_integration():
    """Demonstrate BMAD + Wrapper integration"""
    
    print("🚀 BMAD + Wrapper Integration Demo")
    print("=" * 50)
    
    # Initialize Sarah with wrapper integration
    sarah = BMADProductOwnerAgent()
    
    try:
        # Demo 1: Create user story
        print("\n📝 Demo 1: Create User Story")
        story = await sarah.create_user_story(
            "User needs to reset password via email with secure token validation"
        )
        
        # Demo 2: Validate story
        print("\n🔍 Demo 2: Validate Story")  
        validation = await sarah.validate_story(story[:200] + "...")
        print("Validation:", validation[:200] + "...")
        
        # Demo 3: Course correction
        print("\n🎯 Demo 3: Course Correction")
        correction = await sarah.correct_course()
        print("Course correction:", correction[:200] + "...")
        
        print("\n✅ BMAD + Wrapper integration successful!")
        print("Key benefits:")
        print("- No JSON parsing errors")
        print("- Reliable AI execution")
        print("- Clean resource management")
        print("- BMAD process adherence")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        # Clean shutdown
        await sarah.execute_command("exit")

if __name__ == "__main__":
    asyncio.run(demo_bmad_integration())