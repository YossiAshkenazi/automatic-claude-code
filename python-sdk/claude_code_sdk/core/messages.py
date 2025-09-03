"""
Claude Code SDK - Message Types
Defines the message hierarchy for Claude Code interactions
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, Union, List
from datetime import datetime
from abc import ABC, abstractmethod
import json

@dataclass
class BaseMessage(ABC):
    """Base class for all Claude Code messages"""
    type: str
    timestamp: datetime = field(default_factory=lambda: datetime.now())
    
    def __post_init__(self):
        # timestamp is now always set by default_factory
        pass
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary for serialization"""
        return {
            'type': self.type,
            'timestamp': self.timestamp.isoformat(),
            **self._to_dict_extra()
        }
    
    @abstractmethod
    def _to_dict_extra(self) -> Dict[str, Any]:
        """Subclass-specific dictionary content"""
        pass
    
    def to_json(self) -> str:
        """Convert message to JSON string"""
        return json.dumps(self.to_dict(), default=str)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BaseMessage':
        """Create message from dictionary"""
        msg_type = data.get('type')
        timestamp = datetime.fromisoformat(data.get('timestamp', datetime.now().isoformat()))
        
        # Message type mapping
        type_map = {
            'result': ResultMessage,
            'tool_use': ToolUseMessage, 
            'tool_result': ToolResultMessage,
            'error': ErrorMessage,
            'stream': StreamMessage,
            'status': StatusMessage
        }
        
        message_class = type_map.get(msg_type, BaseMessage)
        return message_class._from_dict_data(data, timestamp)
    
    @classmethod
    def _from_dict_data(cls, data: Dict[str, Any], timestamp: datetime) -> 'BaseMessage':
        """Create instance from dict data - override in subclasses"""
        return cls(type=data['type'], timestamp=timestamp)

@dataclass
class ResultMessage(BaseMessage):
    """Message containing Claude's final result/response"""
    type: str = field(default="result", init=False)
    result: str = ""
    token_count: Optional[int] = None
    model_used: Optional[str] = None
    
    def _to_dict_extra(self) -> Dict[str, Any]:
        return {
            'result': self.result,
            'token_count': self.token_count,
            'model_used': self.model_used
        }
    
    @classmethod
    def _from_dict_data(cls, data: Dict[str, Any], timestamp: datetime) -> 'ResultMessage':
        return cls(
            result=data.get('result', ''),
            token_count=data.get('token_count'),
            model_used=data.get('model_used'),
            timestamp=timestamp
        )

@dataclass
class ToolUseMessage(BaseMessage):
    """Message indicating Claude is using a tool"""
    type: str = field(default="tool_use", init=False)
    tool_name: str = ""
    tool_input: Dict[str, Any] = field(default_factory=dict)
    tool_id: Optional[str] = None
    
    def _to_dict_extra(self) -> Dict[str, Any]:
        return {
            'tool_name': self.tool_name,
            'tool_input': self.tool_input,
            'tool_id': self.tool_id
        }
    
    @classmethod
    def _from_dict_data(cls, data: Dict[str, Any], timestamp: datetime) -> 'ToolUseMessage':
        return cls(
            tool_name=data.get('tool_name', ''),
            tool_input=data.get('tool_input', {}),
            tool_id=data.get('tool_id'),
            timestamp=timestamp
        )

@dataclass
class ToolResultMessage(BaseMessage):
    """Message containing the result of a tool execution"""
    type: str = field(default="tool_result", init=False)
    tool_result: Any = None
    tool_id: Optional[str] = None
    is_error: bool = False
    
    def _to_dict_extra(self) -> Dict[str, Any]:
        return {
            'tool_result': self.tool_result,
            'tool_id': self.tool_id,
            'is_error': self.is_error
        }
    
    @classmethod
    def _from_dict_data(cls, data: Dict[str, Any], timestamp: datetime) -> 'ToolResultMessage':
        return cls(
            tool_result=data.get('tool_result'),
            tool_id=data.get('tool_id'),
            is_error=data.get('is_error', False),
            timestamp=timestamp
        )

@dataclass
class ErrorMessage(BaseMessage):
    """Message indicating an error occurred"""
    type: str = field(default="error", init=False)
    error: str = ""
    error_code: Optional[str] = None
    error_type: Optional[str] = None
    recoverable: bool = False
    
    def _to_dict_extra(self) -> Dict[str, Any]:
        return {
            'error': self.error,
            'error_code': self.error_code,
            'error_type': self.error_type,
            'recoverable': self.recoverable
        }
    
    @classmethod
    def _from_dict_data(cls, data: Dict[str, Any], timestamp: datetime) -> 'ErrorMessage':
        return cls(
            error=data.get('error', ''),
            error_code=data.get('error_code'),
            error_type=data.get('error_type'),
            recoverable=data.get('recoverable', False),
            timestamp=timestamp
        )

@dataclass
class StreamMessage(BaseMessage):
    """Message containing streaming content"""
    content: str = ""
    is_partial: bool = True
    chunk_id: Optional[int] = None
    type: str = field(default="stream", init=False)
    
    def _to_dict_extra(self) -> Dict[str, Any]:
        return {
            'content': self.content,
            'is_partial': self.is_partial,
            'chunk_id': self.chunk_id
        }
    
    @classmethod
    def _from_dict_data(cls, data: Dict[str, Any], timestamp: datetime) -> 'StreamMessage':
        return cls(
            content=data.get('content', ''),
            is_partial=data.get('is_partial', True),
            chunk_id=data.get('chunk_id'),
            timestamp=timestamp
        )

@dataclass
class StatusMessage(BaseMessage):
    """Message containing status/progress information"""
    status: str = ""
    progress: Optional[float] = None  # 0.0 to 1.0
    details: Optional[Dict[str, Any]] = None
    type: str = field(default="status", init=False)
    
    def _to_dict_extra(self) -> Dict[str, Any]:
        return {
            'status': self.status,
            'progress': self.progress,
            'details': self.details or {}
        }
    
    @classmethod
    def _from_dict_data(cls, data: Dict[str, Any], timestamp: datetime) -> 'StatusMessage':
        return cls(
            status=data.get('status', ''),
            progress=data.get('progress'),
            details=data.get('details'),
            timestamp=timestamp
        )

# Type aliases for convenience
Message = Union[ResultMessage, ToolUseMessage, ToolResultMessage, ErrorMessage, StreamMessage, StatusMessage]
MessageList = List[Message]

def parse_message(text: str) -> Optional[BaseMessage]:
    """Parse a raw text message into appropriate message type"""
    text = text.strip()
    if not text:
        return None
    
    # Simple heuristic parsing - in production, you'd parse actual Claude output format
    if text.startswith('Tool:') or 'using tool' in text.lower():
        # Extract tool name and input (simplified)
        parts = text.split(':', 1)
        tool_name = parts[0].replace('Tool', '').strip() if len(parts) > 1 else 'unknown'
        return ToolUseMessage(tool_name=tool_name, tool_input={})
    
    elif text.startswith('Error:') or 'error' in text.lower():
        error_text = text.replace('Error:', '').strip()
        return ErrorMessage(error=error_text)
    
    elif text.startswith('Status:') or 'progress' in text.lower():
        status_text = text.replace('Status:', '').strip()
        return StatusMessage(status=status_text)
    
    else:
        # Assume it's content
        return StreamMessage(content=text)

def create_result_message(content: str, **kwargs) -> ResultMessage:
    """Convenience function to create result message"""
    return ResultMessage(result=content, **kwargs)

def create_error_message(error: str, **kwargs) -> ErrorMessage:
    """Convenience function to create error message"""
    return ErrorMessage(error=error, **kwargs)