"""
Streaming Support Utilities
Advanced streaming message handling and collection
"""

import asyncio
from typing import List, Dict, Any, Callable, Optional, AsyncGenerator
from collections import defaultdict
import time

from ..core.messages import (
    Message, BaseMessage, ResultMessage, ToolUseMessage, 
    ToolResultMessage, ErrorMessage, StreamMessage, StatusMessage
)

class MessageCollector:
    """Collects and organizes streaming messages"""
    
    def __init__(self):
        self.messages: List[Message] = []
        self.messages_by_type: Dict[str, List[Message]] = defaultdict(list)
        self.start_time = time.time()
        self.last_message_time = self.start_time
        
    def add_message(self, message: Message) -> None:
        """Add a message to the collection"""
        self.messages.append(message)
        self.messages_by_type[message.type].append(message)
        self.last_message_time = time.time()
    
    def get_messages(self) -> List[Message]:
        """Get all collected messages"""
        return self.messages.copy()
    
    def get_final_result(self) -> Optional[str]:
        """Get the final result from collected messages"""
        result_messages = self.messages_by_type.get('result', [])
        if result_messages:
            return result_messages[-1].result
        
        # Fallback: concatenate stream messages
        stream_messages = self.messages_by_type.get('stream', [])
        if stream_messages:
            return ''.join(msg.content for msg in stream_messages)
        
        return None
    
    def get_errors(self) -> List[ErrorMessage]:
        """Get all error messages"""
        return self.messages_by_type.get('error', [])
    
    def get_tool_usage(self) -> List[Dict[str, Any]]:
        """Get tool usage information"""
        tool_uses = self.messages_by_type.get('tool_use', [])
        tool_results = self.messages_by_type.get('tool_result', [])
        
        tools_used = []
        for tool_use in tool_uses:
            tool_info = {
                'tool_name': tool_use.tool_name,
                'tool_input': tool_use.tool_input,
                'timestamp': tool_use.timestamp,
                'result': None
            }
            
            # Try to match with result
            for tool_result in tool_results:
                if (tool_result.tool_id == tool_use.tool_id or 
                    tool_result.timestamp > tool_use.timestamp):
                    tool_info['result'] = tool_result.tool_result
                    tool_info['result_timestamp'] = tool_result.timestamp
                    break
            
            tools_used.append(tool_info)
        
        return tools_used
    
    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of collected messages"""
        duration = self.last_message_time - self.start_time
        
        return {
            'total_messages': len(self.messages),
            'messages_by_type': {k: len(v) for k, v in self.messages_by_type.items()},
            'final_result': self.get_final_result(),
            'has_errors': len(self.get_errors()) > 0,
            'tools_used': len(self.messages_by_type.get('tool_use', [])),
            'duration_seconds': duration,
            'messages_per_second': len(self.messages) / duration if duration > 0 else 0
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert collector to dictionary"""
        return {
            'messages': [msg.to_dict() for msg in self.messages],
            'summary': self.get_summary()
        }

class StreamingHandler:
    """Advanced streaming message handler with filtering and processing"""
    
    def __init__(self, 
                 on_message: Optional[Callable[[Message], None]] = None,
                 on_result: Optional[Callable[[str], None]] = None,
                 on_tool_use: Optional[Callable[[ToolUseMessage], None]] = None,
                 on_error: Optional[Callable[[ErrorMessage], None]] = None,
                 on_stream: Optional[Callable[[str], None]] = None,
                 collect_messages: bool = True):
        """
        Initialize streaming handler
        
        Args:
            on_message: Called for every message
            on_result: Called for final results
            on_tool_use: Called when tools are used
            on_error: Called for errors
            on_stream: Called for streaming content
            collect_messages: Whether to collect messages internally
        """
        self.on_message = on_message
        self.on_result = on_result
        self.on_tool_use = on_tool_use
        self.on_error = on_error
        self.on_stream = on_stream
        
        self.collector = MessageCollector() if collect_messages else None
        self._stream_buffer = ""
    
    def handle_message(self, message: Message) -> None:
        """Handle a single message with appropriate callbacks"""
        # Collect if enabled
        if self.collector:
            self.collector.add_message(message)
        
        # Global message callback
        if self.on_message:
            self.on_message(message)
        
        # Type-specific callbacks
        if isinstance(message, ResultMessage) and self.on_result:
            self.on_result(message.result)
        
        elif isinstance(message, ToolUseMessage) and self.on_tool_use:
            self.on_tool_use(message)
        
        elif isinstance(message, ErrorMessage) and self.on_error:
            self.on_error(message)
        
        elif isinstance(message, StreamMessage) and self.on_stream:
            # Buffer streaming content for better handling
            self._stream_buffer += message.content
            if not message.is_partial or '\n' in message.content:
                self.on_stream(self._stream_buffer)
                self._stream_buffer = ""
    
    def get_collector(self) -> Optional[MessageCollector]:
        """Get the message collector if enabled"""
        return self.collector
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of handled messages"""
        if self.collector:
            return self.collector.get_summary()
        return {'messages_handled': 'unknown - collection disabled'}

class StreamProcessor:
    """Process streaming messages with advanced features"""
    
    def __init__(self):
        self._processors: List[Callable[[Message], Message]] = []
        self._filters: List[Callable[[Message], bool]] = []
    
    def add_processor(self, processor: Callable[[Message], Message]) -> None:
        """Add a message processor"""
        self._processors.append(processor)
    
    def add_filter(self, filter_func: Callable[[Message], bool]) -> None:
        """Add a message filter (True = include, False = exclude)"""
        self._filters.append(filter_func)
    
    async def process_stream(self, 
                           message_stream: AsyncGenerator[Message, None]) -> AsyncGenerator[Message, None]:
        """Process a stream of messages through filters and processors"""
        async for message in message_stream:
            # Apply filters
            include_message = True
            for filter_func in self._filters:
                if not filter_func(message):
                    include_message = False
                    break
            
            if not include_message:
                continue
            
            # Apply processors
            processed_message = message
            for processor in self._processors:
                processed_message = processor(processed_message)
            
            yield processed_message

# Pre-built processors and filters
def error_only_filter(message: Message) -> bool:
    """Filter to only include error messages"""
    return isinstance(message, ErrorMessage)

def result_only_filter(message: Message) -> bool:
    """Filter to only include result messages"""
    return isinstance(message, ResultMessage)

def tool_activity_filter(message: Message) -> bool:
    """Filter to include tool-related messages"""
    return isinstance(message, (ToolUseMessage, ToolResultMessage))

def add_timestamp_processor(message: Message) -> Message:
    """Processor that ensures messages have timestamps"""
    if not hasattr(message, 'timestamp') or message.timestamp is None:
        message.timestamp = time.time()
    return message

def content_length_processor(message: Message) -> Message:
    """Processor that adds content length metadata"""
    if hasattr(message, 'result'):
        message.__dict__['content_length'] = len(message.result)
    elif hasattr(message, 'content'):
        message.__dict__['content_length'] = len(message.content)
    return message

async def collect_all_messages(message_stream: AsyncGenerator[Message, None]) -> MessageCollector:
    """Utility function to collect all messages from a stream"""
    collector = MessageCollector()
    async for message in message_stream:
        collector.add_message(message)
    return collector

async def get_final_result(message_stream: AsyncGenerator[Message, None]) -> Optional[str]:
    """Utility function to get just the final result from a stream"""
    collector = await collect_all_messages(message_stream)
    return collector.get_final_result()