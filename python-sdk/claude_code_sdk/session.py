"""
Claude Code Session Management
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import uuid

@dataclass
class ClaudeMessage:
    """Represents a message in a Claude Code session"""
    type: str  # 'user', 'assistant', 'tool_use', 'tool_result', 'error'
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    tool: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_result: Optional[Any] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary"""
        data = {
            'type': self.type,
            'content': self.content,
            'timestamp': self.timestamp.isoformat()
        }
        if self.tool:
            data['tool'] = self.tool
        if self.tool_input:
            data['tool_input'] = self.tool_input
        if self.tool_result:
            data['tool_result'] = self.tool_result
        if self.error:
            data['error'] = self.error
        return data

@dataclass
class ClaudeSessionOptions:
    """Options for Claude Code session"""
    model: str = 'sonnet'  # 'sonnet', 'opus', 'haiku'
    max_turns: int = 10
    timeout: int = 300  # seconds
    working_directory: Optional[str] = None
    allow_tools: List[str] = field(default_factory=list)
    verbose: bool = False
    claude_cli_path: Optional[str] = None
    environment: Dict[str, str] = field(default_factory=dict)

@dataclass
class ClaudeSessionResult:
    """Result of a Claude Code session execution"""
    messages: List[ClaudeMessage]
    final_message: str
    session_id: str
    total_turns: int
    success: bool
    execution_time: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return {
            'messages': [msg.to_dict() for msg in self.messages],
            'final_message': self.final_message,
            'session_id': self.session_id,
            'total_turns': self.total_turns,
            'success': self.success,
            'execution_time': self.execution_time
        }

class ClaudeSession:
    """Manages a Claude Code conversation session"""
    
    def __init__(self, options: Optional[ClaudeSessionOptions] = None):
        self.session_id = f"session-{uuid.uuid4().hex[:16]}"
        self.messages: List[ClaudeMessage] = []
        self.options = options or ClaudeSessionOptions()
        self.start_time = datetime.now()
        
    def add_user_message(self, content: str) -> None:
        """Add a user message to the session"""
        message = ClaudeMessage(type='user', content=content)
        self.messages.append(message)
        
    def add_assistant_message(self, content: str) -> None:
        """Add an assistant message to the session"""
        message = ClaudeMessage(type='assistant', content=content)
        self.messages.append(message)
        
    def add_tool_use(self, tool: str, tool_input: Dict[str, Any]) -> None:
        """Add a tool use message"""
        message = ClaudeMessage(
            type='tool_use',
            content=f"Using tool: {tool}",
            tool=tool,
            tool_input=tool_input
        )
        self.messages.append(message)
        
    def add_tool_result(self, tool_result: Any) -> None:
        """Add a tool result message"""
        message = ClaudeMessage(
            type='tool_result',
            content="Tool execution completed",
            tool_result=tool_result
        )
        self.messages.append(message)
        
    def add_error(self, error: str) -> None:
        """Add an error message"""
        message = ClaudeMessage(
            type='error',
            content=error,
            error=error
        )
        self.messages.append(message)
        
    def get_messages(self) -> List[ClaudeMessage]:
        """Get all messages in the session"""
        return self.messages.copy()
        
    def get_last_message(self) -> Optional[ClaudeMessage]:
        """Get the last message in the session"""
        return self.messages[-1] if self.messages else None
        
    def get_session_info(self) -> Dict[str, Any]:
        """Get session metadata"""
        return {
            'session_id': self.session_id,
            'message_count': len(self.messages),
            'start_time': self.start_time.isoformat(),
            'duration': (datetime.now() - self.start_time).total_seconds(),
            'options': self.options.__dict__
        }
        
    def execute(self) -> ClaudeSessionResult:
        """Execute the session and return results"""
        execution_time = (datetime.now() - self.start_time).total_seconds()
        final_message = self.get_last_message()
        
        return ClaudeSessionResult(
            messages=self.get_messages(),
            final_message=final_message.content if final_message else '',
            session_id=self.session_id,
            total_turns=len([m for m in self.messages if m.type == 'assistant']),
            success=not any(m.type == 'error' for m in self.messages),
            execution_time=execution_time
        )
        
    def clear(self) -> None:
        """Clear all messages from the session"""
        self.messages.clear()
        self.start_time = datetime.now()