#!/usr/bin/env python3
"""
Multi-Turn Conversation Example - ClaudeSDKClient
===============================================

This example demonstrates how to maintain context and state across multiple
interactions with Claude, creating sophisticated conversational workflows
and session management.

Requirements:
    - Python 3.10+
    - Claude Code CLI installed and configured
    - claude-code-sdk package installed

Usage:
    python multi_turn_conversation.py
"""

import asyncio
import json
import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from claude_code_sdk import ClaudeSDKClient, conversation
from claude_code_sdk.core.options import create_development_options
from claude_code_sdk.core.messages import BaseMessage, ResultMessage
from claude_code_sdk.exceptions import ClaudeCodeError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ConversationState(Enum):
    """States of a conversation."""
    INITIALIZING = "initializing"
    ACTIVE = "active" 
    WAITING_FOR_INPUT = "waiting_for_input"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class ConversationTurn:
    """Represents a single turn in a conversation."""
    turn_id: int
    timestamp: float
    user_input: str
    assistant_response: str
    context: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None
    duration: Optional[float] = None


@dataclass
class ConversationSession:
    """Manages an entire conversation session."""
    session_id: str
    title: str
    created_at: float
    state: ConversationState
    turns: List[ConversationTurn]
    context: Dict[str, Any]
    total_duration: float = 0.0
    
    def add_turn(self, turn: ConversationTurn):
        """Add a turn to the conversation."""
        self.turns.append(turn)
        if turn.duration:
            self.total_duration += turn.duration
            
    def get_context_summary(self) -> str:
        """Get a summary of conversation context for Claude."""
        if not self.turns:
            return "No previous conversation."
            
        recent_turns = self.turns[-3:]  # Last 3 turns for context
        context_parts = []
        
        for turn in recent_turns:
            context_parts.append(f"User: {turn.user_input}")
            context_parts.append(f"Assistant: {turn.assistant_response[:200]}...")
            
        return "\n".join(context_parts)


class ConversationManager:
    """
    Manages multi-turn conversations with Claude, maintaining context and state.
    """
    
    def __init__(self, session_title: str = "Conversation Session"):
        self.session = ConversationSession(
            session_id=f"session_{int(time.time())}",
            title=session_title,
            created_at=time.time(),
            state=ConversationState.INITIALIZING,
            turns=[],
            context={}
        )
        self.client: Optional[ClaudeSDKClient] = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        options = create_development_options(timeout=60)
        self.client = ClaudeSDKClient(options)
        await self.client.__aenter__()
        self.session.state = ConversationState.ACTIVE
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.client:
            await self.client.__aexit__(exc_type, exc_val, exc_tb)
        self.session.state = ConversationState.COMPLETED
        
    def _build_contextual_prompt(self, user_input: str) -> str:
        """Build a prompt that includes conversation context."""
        if not self.session.turns:
            return user_input
            
        context_summary = self.session.get_context_summary()
        
        contextual_prompt = f"""
Previous conversation context:
{context_summary}

Current request:
{user_input}

Please respond considering the previous conversation context.
"""
        return contextual_prompt.strip()
        
    async def send_message(self, user_input: str, include_context: bool = True) -> ConversationTurn:
        """
        Send a message and get a response, maintaining conversation context.
        """
        if not self.client:
            raise RuntimeError("Conversation manager not properly initialized")
            
        self.session.state = ConversationState.PROCESSING
        start_time = time.time()
        
        try:
            # Build prompt with or without context
            prompt = self._build_contextual_prompt(user_input) if include_context else user_input
            
            # Execute with Claude
            response = await self.client.execute(prompt)
            
            duration = time.time() - start_time
            
            if response.success:
                # Create conversation turn
                turn = ConversationTurn(
                    turn_id=len(self.session.turns) + 1,
                    timestamp=time.time(),
                    user_input=user_input,
                    assistant_response=response.result or "",
                    context=self.session.context.copy(),
                    duration=duration,
                    metadata={
                        'model_used': getattr(response, 'model', 'unknown'),
                        'tokens_used': getattr(response, 'tokens', 0),
                        'context_included': include_context
                    }
                )
                
                self.session.add_turn(turn)
                self.session.state = ConversationState.WAITING_FOR_INPUT
                
                return turn
            else:
                self.session.state = ConversationState.ERROR
                raise ClaudeCodeError(f"Claude execution failed: {response.error}")
                
        except Exception as e:
            self.session.state = ConversationState.ERROR
            logger.error(f"Error in conversation turn: {e}")
            raise
            
    def update_context(self, key: str, value: Any):
        """Update conversation context."""
        self.session.context[key] = value
        
    def get_conversation_summary(self) -> Dict[str, Any]:
        """Get a summary of the entire conversation."""
        return {
            'session_id': self.session.session_id,
            'title': self.session.title,
            'turns_count': len(self.session.turns),
            'total_duration': self.session.total_duration,
            'state': self.session.state.value,
            'context': self.session.context,
            'created_at': self.session.created_at,
            'last_turn': asdict(self.session.turns[-1]) if self.session.turns else None
        }


async def basic_conversation_example():
    """
    Demonstrates a basic multi-turn conversation.
    """
    print("🔵 Basic Multi-Turn Conversation Example")
    print("=" * 45)
    
    try:
        async with ConversationManager("Code Review Session") as conversation:
            
            # Turn 1: Initial request
            print("\n👤 Turn 1: Initial code request")
            turn1 = await conversation.send_message(
                "Create a Python function to calculate fibonacci numbers"
            )
            print(f"🤖 Claude: {turn1.assistant_response[:150]}...")
            print(f"   Duration: {turn1.duration:.1f}s")
            
            # Turn 2: Follow-up modification
            print("\n👤 Turn 2: Request optimization")
            turn2 = await conversation.send_message(
                "Now optimize that function using memoization"
            )
            print(f"🤖 Claude: {turn2.assistant_response[:150]}...")
            print(f"   Duration: {turn2.duration:.1f}s")
            
            # Turn 3: Testing request
            print("\n👤 Turn 3: Request tests")
            turn3 = await conversation.send_message(
                "Create unit tests for the optimized fibonacci function"
            )
            print(f"🤖 Claude: {turn3.assistant_response[:150]}...")
            print(f"   Duration: {turn3.duration:.1f}s")
            
            # Show conversation summary
            summary = conversation.get_conversation_summary()
            print(f"\n📊 Conversation Summary:")
            print(f"   Session ID: {summary['session_id']}")
            print(f"   Turns: {summary['turns_count']}")
            print(f"   Total Duration: {summary['total_duration']:.1f}s")
            print(f"   State: {summary['state']}")
            
    except Exception as e:
        print(f"❌ Conversation error: {e}")
        
    print()


async def context_aware_conversation_example():
    """
    Demonstrates context-aware conversation with state management.
    """
    print("🔵 Context-Aware Conversation Example")
    print("=" * 42)
    
    try:
        async with ConversationManager("Project Development Session") as conversation:
            
            # Set initial context
            conversation.update_context("project_type", "web_application")
            conversation.update_context("tech_stack", ["Python", "FastAPI", "SQLite"])
            conversation.update_context("current_feature", "user_authentication")
            
            print("📝 Initial context set:")
            print(f"   Project: {conversation.session.context['project_type']}")
            print(f"   Stack: {conversation.session.context['tech_stack']}")
            print(f"   Feature: {conversation.session.context['current_feature']}")
            
            # Series of contextual interactions
            interactions = [
                "Create database models for user authentication",
                "Now create the FastAPI endpoints for login and registration", 
                "Add password hashing and JWT token generation",
                "Create middleware for token validation",
                "Add comprehensive error handling for all auth endpoints"
            ]
            
            for i, message in enumerate(interactions, 1):
                print(f"\n👤 Turn {i}: {message}")
                
                turn = await conversation.send_message(message)
                
                # Update context based on progress
                if i == 2:
                    conversation.update_context("endpoints_created", True)
                elif i == 3:
                    conversation.update_context("security_implemented", True)
                elif i == 4:
                    conversation.update_context("middleware_added", True)
                    
                print(f"🤖 Response length: {len(turn.assistant_response)} characters")
                print(f"   Context included: {turn.metadata.get('context_included', False)}")
                print(f"   Duration: {turn.duration:.1f}s")
                
                # Brief pause between requests
                await asyncio.sleep(0.5)
                
            # Final context state
            print(f"\n📊 Final Context State:")
            for key, value in conversation.session.context.items():
                print(f"   {key}: {value}")
                
    except Exception as e:
        print(f"❌ Context conversation error: {e}")
        
    print()


async def branching_conversation_example():
    """
    Demonstrates branching conversations with different paths.
    """
    print("🔵 Branching Conversation Example")
    print("=" * 35)
    
    async def explore_branch(manager: ConversationManager, branch_name: str, messages: List[str]) -> List[ConversationTurn]:
        """Explore a conversation branch."""
        print(f"\n🌿 Exploring {branch_name} branch:")
        branch_turns = []
        
        for i, message in enumerate(messages, 1):
            print(f"   {i}. {message}")
            turn = await manager.send_message(message)
            branch_turns.append(turn)
            print(f"      ✅ Response: {len(turn.assistant_response)} chars in {turn.duration:.1f}s")
            
        return branch_turns
    
    try:
        async with ConversationManager("Algorithm Comparison") as conversation:
            
            # Initial common question
            print("👤 Starting question:")
            initial_turn = await conversation.send_message(
                "I need to sort a large dataset. What are my options?"
            )
            print(f"🤖 Initial response: {len(initial_turn.assistant_response)} characters")
            
            # Branch 1: Performance focus
            performance_branch = [
                "What's the fastest sorting algorithm for my use case?",
                "Show me how to implement quicksort in Python",
                "How can I optimize it for large datasets?"
            ]
            
            perf_turns = await explore_branch(conversation, "Performance", performance_branch)
            
            # Branch 2: Memory focus (continuing from initial context)
            memory_branch = [
                "What if memory usage is my main concern?", 
                "Show me a memory-efficient sorting implementation",
                "How do I handle datasets that don't fit in memory?"
            ]
            
            memory_turns = await explore_branch(conversation, "Memory Efficiency", memory_branch)
            
            # Synthesis
            print("\n🔄 Synthesizing branches:")
            synthesis_turn = await conversation.send_message(
                "Based on our discussion of both performance and memory considerations, "
                "what would be the best balanced approach for sorting a 10GB dataset?"
            )
            print(f"🤖 Synthesis: {len(synthesis_turn.assistant_response)} chars in {synthesis_turn.duration:.1f}s")
            
            # Summary
            summary = conversation.get_conversation_summary()
            print(f"\n📊 Branching Conversation Summary:")
            print(f"   Total turns: {summary['turns_count']}")
            print(f"   Performance branch: {len(perf_turns)} turns")
            print(f"   Memory branch: {len(memory_turns)} turns")
            print(f"   Total duration: {summary['total_duration']:.1f}s")
            
    except Exception as e:
        print(f"❌ Branching conversation error: {e}")
        
    print()


async def conversation_with_state_persistence_example():
    """
    Demonstrates conversation state persistence and restoration.
    """
    print("🔵 Conversation State Persistence Example")
    print("=" * 43)
    
    class PersistentConversationManager(ConversationManager):
        """Extended conversation manager with persistence."""
        
        def save_session(self, filepath: str):
            """Save conversation session to file."""
            session_data = {
                'session_id': self.session.session_id,
                'title': self.session.title,
                'created_at': self.session.created_at,
                'state': self.session.state.value,
                'context': self.session.context,
                'turns': [asdict(turn) for turn in self.session.turns],
                'total_duration': self.session.total_duration
            }
            
            with open(filepath, 'w') as f:
                json.dump(session_data, f, indent=2)
                
        @classmethod
        def load_session(cls, filepath: str) -> 'PersistentConversationManager':
            """Load conversation session from file."""
            with open(filepath, 'r') as f:
                session_data = json.load(f)
                
            manager = cls(session_data['title'])
            manager.session.session_id = session_data['session_id']
            manager.session.created_at = session_data['created_at']
            manager.session.state = ConversationState(session_data['state'])
            manager.session.context = session_data['context']
            manager.session.total_duration = session_data['total_duration']
            
            # Restore turns
            for turn_data in session_data['turns']:
                turn = ConversationTurn(**turn_data)
                manager.session.turns.append(turn)
                
            return manager
    
    try:
        # Create and save a conversation
        print("💾 Creating and saving conversation...")
        
        session_file = "conversation_session.json"
        
        async with PersistentConversationManager("Persistent Chat") as conversation:
            
            # Have a few turns
            turn1 = await conversation.send_message("Create a Python class for a simple cache")
            conversation.update_context("cache_implemented", True)
            
            turn2 = await conversation.send_message("Add LRU eviction policy to the cache")
            conversation.update_context("lru_added", True)
            
            print(f"   Turn 1: {len(turn1.assistant_response)} chars")
            print(f"   Turn 2: {len(turn2.assistant_response)} chars")
            
            # Save session
            conversation.save_session(session_file)
            print(f"   Session saved to {session_file}")
            
        # Load and continue conversation
        print(f"\n📂 Loading and continuing conversation...")
        
        loaded_conversation = PersistentConversationManager.load_session(session_file)
        
        print(f"   Loaded session: {loaded_conversation.session.session_id}")
        print(f"   Previous turns: {len(loaded_conversation.session.turns)}")
        print(f"   Context: {loaded_conversation.session.context}")
        
        async with loaded_conversation:
            # Continue the conversation
            turn3 = await loaded_conversation.send_message(
                "Now add thread safety to the cache implementation"
            )
            
            print(f"   Continued turn 3: {len(turn3.assistant_response)} chars")
            print(f"   Total turns now: {len(loaded_conversation.session.turns)}")
            
        # Cleanup
        import os
        if os.path.exists(session_file):
            os.remove(session_file)
            print(f"   Cleaned up {session_file}")
            
    except Exception as e:
        print(f"❌ Persistence example error: {e}")
        
    print()


async def concurrent_conversations_example():
    """
    Demonstrates managing multiple concurrent conversations.
    """
    print("🔵 Concurrent Conversations Example")
    print("=" * 37)
    
    async def run_focused_conversation(topic: str, messages: List[str]) -> Dict[str, Any]:
        """Run a focused conversation on a specific topic."""
        try:
            async with ConversationManager(f"{topic} Discussion") as conversation:
                turns = []
                
                for message in messages:
                    turn = await conversation.send_message(message)
                    turns.append(turn)
                    
                summary = conversation.get_conversation_summary()
                summary['topic'] = topic
                summary['turns_data'] = turns
                
                return summary
                
        except Exception as e:
            return {
                'topic': topic,
                'error': str(e),
                'success': False
            }
    
    # Define concurrent conversation topics
    conversation_topics = {
        'Database Design': [
            "Design a database schema for an e-commerce platform",
            "Add indexes for optimal query performance",
            "Design the order processing workflow"
        ],
        'API Development': [
            "Create REST API endpoints for user management",
            "Add authentication middleware", 
            "Implement rate limiting and caching"
        ],
        'Frontend Architecture': [
            "Design a React component architecture",
            "Implement state management with Redux",
            "Add responsive design patterns"
        ]
    }
    
    try:
        print(f"🚀 Starting {len(conversation_topics)} concurrent conversations...")
        
        # Run all conversations concurrently
        start_time = time.time()
        
        tasks = [
            run_focused_conversation(topic, messages)
            for topic, messages in conversation_topics.items()
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        total_duration = time.time() - start_time
        
        # Analyze results
        print(f"\n📊 Concurrent Conversations Results ({total_duration:.1f}s total):")
        
        successful_conversations = 0
        total_turns = 0
        total_conversation_time = 0
        
        for result in results:
            if isinstance(result, Exception):
                print(f"   ❌ Exception: {result}")
            elif result.get('error'):
                print(f"   ❌ {result['topic']}: {result['error']}")
            else:
                successful_conversations += 1
                total_turns += result['turns_count']
                total_conversation_time += result['total_duration']
                
                print(f"   ✅ {result['topic']}: {result['turns_count']} turns in {result['total_duration']:.1f}s")
                
        print(f"\n📈 Summary:")
        print(f"   Successful conversations: {successful_conversations}/{len(conversation_topics)}")
        print(f"   Total turns across all conversations: {total_turns}")
        print(f"   Total conversation time: {total_conversation_time:.1f}s")
        print(f"   Concurrency benefit: {total_conversation_time/total_duration:.1f}x faster")
        
    except Exception as e:
        print(f"❌ Concurrent conversations error: {e}")
        
    print()


async def main():
    """
    Main function demonstrating all multi-turn conversation patterns.
    """
    print("🚀 Claude SDK Client - Multi-Turn Conversation Examples")
    print("=" * 60)
    print()
    
    # Run all examples
    await basic_conversation_example()
    await context_aware_conversation_example()
    await branching_conversation_example()
    await conversation_with_state_persistence_example()
    await concurrent_conversations_example()
    
    print("✅ All multi-turn conversation examples completed!")
    print()
    print("Conversation patterns demonstrated:")
    print("- Basic multi-turn context maintenance")
    print("- Context-aware state management")
    print("- Branching conversation paths")
    print("- Session persistence and restoration")
    print("- Concurrent conversation management")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Conversation examples interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error running conversation examples: {e}")
        logger.exception("Error running multi-turn conversation examples")