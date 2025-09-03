#!/usr/bin/env python3
"""
Message Serialization for Agent Communication Protocol
=====================================================

This module provides robust serialization and deserialization capabilities
for protocol messages, ensuring reliable cross-platform data exchange
between agents and the frontend.

Key Features:
- JSON-based serialization with custom encoders
- Support for complex Python objects (Enums, dataclasses, sets)
- Schema validation and version compatibility
- Compression for large messages
- Error-tolerant deserialization with fallbacks
"""

import json
import time
import gzip
import base64
from typing import Any, Dict, Optional, Type, Union, List
from dataclasses import dataclass, fields, is_dataclass, asdict
from enum import Enum
from datetime import datetime
import logging

from .protocol import (
    ProtocolMessage, MessageType, AgentRole, MessagePriority,
    TaskStatus, CoordinationPhase, TaskDefinition, TaskProgress,
    QualityGate, ValidationResult, MessageMetadata
)

logger = logging.getLogger(__name__)

# ============================================================================
# Custom JSON Encoders and Decoders
# ============================================================================

class ProtocolJSONEncoder(json.JSONEncoder):
    """
    Custom JSON encoder for protocol objects.
    
    Handles:
    - Enums (converts to value)
    - Dataclasses (converts to dict)
    - Sets (converts to list)
    - Datetime objects (converts to timestamp)
    - Complex nested structures
    """
    
    def default(self, obj: Any) -> Any:
        # Handle Enums
        if isinstance(obj, Enum):
            return {
                '_type': 'enum',
                '_class': f"{obj.__class__.__module__}.{obj.__class__.__name__}",
                'value': obj.value
            }
        
        # Handle dataclasses
        if is_dataclass(obj):
            data = asdict(obj)
            data['_type'] = 'dataclass'
            data['_class'] = f"{obj.__class__.__module__}.{obj.__class__.__name__}"
            return data
        
        # Handle sets
        if isinstance(obj, set):
            return {
                '_type': 'set',
                'items': list(obj)
            }
        
        # Handle datetime
        if isinstance(obj, datetime):
            return {
                '_type': 'datetime',
                'timestamp': obj.timestamp()
            }
        
        # Handle bytes
        if isinstance(obj, bytes):
            return {
                '_type': 'bytes',
                'data': base64.b64encode(obj).decode('utf-8')
            }
        
        # Fallback to default behavior
        return super().default(obj)

class ProtocolJSONDecoder:
    """
    Custom JSON decoder for protocol objects.
    
    Reconstructs complex objects from their serialized representation.
    """
    
    # Map class names to actual classes for reconstruction
    CLASS_MAP = {
        'communication.protocol.MessageType': MessageType,
        'communication.protocol.AgentRole': AgentRole,
        'communication.protocol.MessagePriority': MessagePriority,
        'communication.protocol.TaskStatus': TaskStatus,
        'communication.protocol.CoordinationPhase': CoordinationPhase,
        'communication.protocol.ProtocolMessage': ProtocolMessage,
        'communication.protocol.MessageMetadata': MessageMetadata,
        'communication.protocol.TaskDefinition': TaskDefinition,
        'communication.protocol.TaskProgress': TaskProgress,
        'communication.protocol.QualityGate': QualityGate,
        'communication.protocol.ValidationResult': ValidationResult,
    }
    
    def decode_object(self, obj: Any) -> Any:
        """Decode object from JSON representation"""
        if not isinstance(obj, dict):
            return obj
        
        obj_type = obj.get('_type')
        
        if obj_type == 'enum':
            class_name = obj.get('_class')
            enum_class = self.CLASS_MAP.get(class_name)
            if enum_class:
                return enum_class(obj['value'])
            else:
                logger.warning(f"Unknown enum class: {class_name}")
                return obj['value']
        
        elif obj_type == 'dataclass':
            class_name = obj.get('_class')
            dataclass_class = self.CLASS_MAP.get(class_name)
            if dataclass_class:
                # Remove metadata fields
                obj_data = {k: v for k, v in obj.items() if not k.startswith('_')}
                
                # Recursively decode nested objects
                for key, value in obj_data.items():
                    obj_data[key] = self.decode_object(value)
                
                try:
                    return dataclass_class(**obj_data)
                except Exception as e:
                    logger.error(f"Error reconstructing {class_name}: {e}")
                    return obj_data
            else:
                logger.warning(f"Unknown dataclass class: {class_name}")
                return {k: v for k, v in obj.items() if not k.startswith('_')}
        
        elif obj_type == 'set':
            return set(obj['items'])
        
        elif obj_type == 'datetime':
            return datetime.fromtimestamp(obj['timestamp'])
        
        elif obj_type == 'bytes':
            return base64.b64decode(obj['data'])
        
        # Recursively process nested dictionaries and lists
        elif isinstance(obj, dict):
            return {key: self.decode_object(value) for key, value in obj.items()}
        
        elif isinstance(obj, list):
            return [self.decode_object(item) for item in obj]
        
        return obj

# ============================================================================
# Message Serializer
# ============================================================================

@dataclass
class SerializationConfig:
    """Configuration for message serialization"""
    compress_threshold: int = 1024  # Compress messages larger than 1KB
    compression_level: int = 6      # gzip compression level (1-9)
    include_metadata: bool = True   # Include serialization metadata
    validate_schema: bool = True    # Validate message schema
    pretty_print: bool = False      # Pretty print JSON (for debugging)

class MessageSerializer:
    """
    Message serializer with compression and validation.
    
    Features:
    - Automatic compression for large messages
    - Schema validation
    - Version compatibility
    - Error handling with fallbacks
    """
    
    VERSION = "1.0.0"
    
    def __init__(self, config: Optional[SerializationConfig] = None):
        self.config = config or SerializationConfig()
        self.encoder = ProtocolJSONEncoder()
        self.decoder = ProtocolJSONDecoder()
        
        # Message size statistics
        self.stats = {
            'messages_serialized': 0,
            'messages_deserialized': 0,
            'compression_ratio': 0.0,
            'average_size': 0.0,
            'errors': 0
        }
    
    def serialize(self, message: ProtocolMessage) -> bytes:
        """
        Serialize protocol message to bytes.
        
        Args:
            message: Protocol message to serialize
            
        Returns:
            bytes: Serialized message data
        """
        try:
            # Convert message to dictionary
            message_dict = message.to_dict()
            
            # Add serialization metadata
            if self.config.include_metadata:
                message_dict['_serialization'] = {
                    'version': self.VERSION,
                    'timestamp': time.time(),
                    'serializer': 'MessageSerializer'
                }
            
            # Serialize to JSON
            json_str = json.dumps(
                message_dict,
                cls=ProtocolJSONEncoder,
                ensure_ascii=False,
                separators=(',', ':') if not self.config.pretty_print else None,
                indent=2 if self.config.pretty_print else None
            )
            
            json_bytes = json_str.encode('utf-8')
            original_size = len(json_bytes)
            
            # Compress if above threshold
            if original_size > self.config.compress_threshold:
                compressed = gzip.compress(json_bytes, compresslevel=self.config.compression_level)
                compression_ratio = len(compressed) / original_size
                
                # Use compression only if it provides significant benefit
                if compression_ratio < 0.8:
                    result = b'GZIP:' + compressed
                    self.stats['compression_ratio'] = compression_ratio
                    logger.debug(f"Compressed message {message.id}: {original_size} -> {len(compressed)} bytes (ratio: {compression_ratio:.2f})")
                else:
                    result = json_bytes
            else:
                result = json_bytes
            
            # Update statistics
            self.stats['messages_serialized'] += 1
            self.stats['average_size'] = (
                (self.stats['average_size'] * (self.stats['messages_serialized'] - 1) + len(result)) /
                self.stats['messages_serialized']
            )
            
            logger.debug(f"Serialized message {message.id}: {len(result)} bytes")
            return result
            
        except Exception as e:
            self.stats['errors'] += 1
            logger.error(f"Error serializing message {message.id}: {e}")
            raise
    
    def deserialize(self, data: bytes) -> ProtocolMessage:
        """
        Deserialize bytes to protocol message.
        
        Args:
            data: Serialized message bytes
            
        Returns:
            ProtocolMessage: Reconstructed message
        """
        try:
            # Check for compression
            if data.startswith(b'GZIP:'):
                json_bytes = gzip.decompress(data[5:])
                logger.debug(f"Decompressed message: {len(data)} -> {len(json_bytes)} bytes")
            else:
                json_bytes = data
            
            # Decode JSON
            json_str = json_bytes.decode('utf-8')
            message_dict = json.loads(json_str)
            
            # Validate serialization metadata
            if self.config.validate_schema and '_serialization' in message_dict:
                serialization_info = message_dict['_serialization']
                version = serialization_info.get('version')
                
                if version != self.VERSION:
                    logger.warning(f"Version mismatch: expected {self.VERSION}, got {version}")
                
                # Remove metadata before reconstruction
                del message_dict['_serialization']
            
            # Reconstruct message object
            decoded_dict = self.decoder.decode_object(message_dict)
            
            # Handle backward compatibility
            message = self._reconstruct_message(decoded_dict)
            
            # Update statistics
            self.stats['messages_deserialized'] += 1
            
            logger.debug(f"Deserialized message {message.id}")
            return message
            
        except Exception as e:
            self.stats['errors'] += 1
            logger.error(f"Error deserializing message: {e}")
            raise
    
    def _reconstruct_message(self, data: Dict[str, Any]) -> ProtocolMessage:
        """Reconstruct ProtocolMessage from dictionary with error handling"""
        try:
            return ProtocolMessage.from_dict(data)
        except Exception as e:
            logger.warning(f"Error in standard reconstruction: {e}. Attempting fallback.")
            
            # Fallback reconstruction with defaults
            return ProtocolMessage(
                id=data.get('id', 'unknown'),
                type=MessageType(data.get('type', 'status_update')),
                sender=AgentRole(data.get('sender', 'system')),
                recipient=AgentRole(data.get('recipient', 'system')),
                content=data.get('content', {}),
                priority=MessagePriority(data.get('priority', 2)),
                metadata=MessageMetadata(**data.get('metadata', {})),
                timestamp=data.get('timestamp', time.time())
            )
    
    def serialize_to_string(self, message: ProtocolMessage) -> str:
        """Serialize message to base64-encoded string"""
        serialized_bytes = self.serialize(message)
        return base64.b64encode(serialized_bytes).decode('utf-8')
    
    def deserialize_from_string(self, data: str) -> ProtocolMessage:
        """Deserialize message from base64-encoded string"""
        serialized_bytes = base64.b64decode(data.encode('utf-8'))
        return self.deserialize(serialized_bytes)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get serialization statistics"""
        return self.stats.copy()
    
    def reset_stats(self):
        """Reset serialization statistics"""
        self.stats = {
            'messages_serialized': 0,
            'messages_deserialized': 0,
            'compression_ratio': 0.0,
            'average_size': 0.0,
            'errors': 0
        }

# ============================================================================
# Schema Validation
# ============================================================================

class MessageSchemaValidator:
    """
    Validates message schemas for compatibility and correctness.
    """
    
    REQUIRED_FIELDS = {
        'id', 'type', 'sender', 'recipient', 'content', 
        'priority', 'metadata', 'timestamp'
    }
    
    VALID_MESSAGE_TYPES = {mt.value for mt in MessageType}
    VALID_AGENT_ROLES = {ar.value for ar in AgentRole}
    VALID_PRIORITIES = {mp.value for mp in MessagePriority}
    
    @classmethod
    def validate_message_dict(cls, message_dict: Dict[str, Any]) -> bool:
        """
        Validate message dictionary against schema.
        
        Returns:
            bool: True if valid, False otherwise
        """
        try:
            # Check required fields
            missing_fields = cls.REQUIRED_FIELDS - set(message_dict.keys())
            if missing_fields:
                logger.error(f"Missing required fields: {missing_fields}")
                return False
            
            # Validate field values
            if message_dict['type'] not in cls.VALID_MESSAGE_TYPES:
                logger.error(f"Invalid message type: {message_dict['type']}")
                return False
            
            if message_dict['sender'] not in cls.VALID_AGENT_ROLES:
                logger.error(f"Invalid sender role: {message_dict['sender']}")
                return False
            
            if message_dict['recipient'] not in cls.VALID_AGENT_ROLES:
                logger.error(f"Invalid recipient role: {message_dict['recipient']}")
                return False
            
            if message_dict['priority'] not in cls.VALID_PRIORITIES:
                logger.error(f"Invalid priority: {message_dict['priority']}")
                return False
            
            # Validate content is a dictionary
            if not isinstance(message_dict['content'], dict):
                logger.error("Content must be a dictionary")
                return False
            
            # Validate metadata is a dictionary
            if not isinstance(message_dict['metadata'], dict):
                logger.error("Metadata must be a dictionary")
                return False
            
            # Validate timestamp is a number
            if not isinstance(message_dict['timestamp'], (int, float)):
                logger.error("Timestamp must be a number")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Schema validation error: {e}")
            return False
    
    @classmethod
    def validate_message(cls, message: ProtocolMessage) -> bool:
        """Validate ProtocolMessage object"""
        return cls.validate_message_dict(message.to_dict())

# ============================================================================
# Batch Serialization
# ============================================================================

class BatchMessageSerializer:
    """
    Efficient serialization of multiple messages.
    
    Features:
    - Batch compression
    - Message ordering preservation
    - Individual message error isolation
    """
    
    def __init__(self, serializer: MessageSerializer):
        self.serializer = serializer
    
    def serialize_batch(self, messages: List[ProtocolMessage]) -> bytes:
        """Serialize multiple messages efficiently"""
        try:
            # Serialize each message to dictionary
            message_dicts = []
            for message in messages:
                try:
                    message_dict = message.to_dict()
                    message_dicts.append(message_dict)
                except Exception as e:
                    logger.error(f"Error serializing message {message.id} in batch: {e}")
                    # Add error placeholder
                    message_dicts.append({
                        'id': getattr(message, 'id', 'unknown'),
                        'error': str(e),
                        '_error': True
                    })
            
            # Create batch wrapper
            batch_data = {
                'version': self.serializer.VERSION,
                'batch_size': len(message_dicts),
                'timestamp': time.time(),
                'messages': message_dicts
            }
            
            # Serialize batch
            json_str = json.dumps(batch_data, cls=ProtocolJSONEncoder)
            json_bytes = json_str.encode('utf-8')
            
            # Compress entire batch
            if len(json_bytes) > self.serializer.config.compress_threshold:
                compressed = gzip.compress(json_bytes, compresslevel=self.serializer.config.compression_level)
                result = b'BATCH_GZIP:' + compressed
            else:
                result = b'BATCH:' + json_bytes
            
            logger.debug(f"Serialized batch of {len(messages)} messages: {len(result)} bytes")
            return result
            
        except Exception as e:
            logger.error(f"Error serializing message batch: {e}")
            raise
    
    def deserialize_batch(self, data: bytes) -> List[ProtocolMessage]:
        """Deserialize batch of messages"""
        try:
            # Handle compression
            if data.startswith(b'BATCH_GZIP:'):
                json_bytes = gzip.decompress(data[11:])
            elif data.startswith(b'BATCH:'):
                json_bytes = data[6:]
            else:
                raise ValueError("Invalid batch format")
            
            # Decode batch
            json_str = json_bytes.decode('utf-8')
            batch_data = json.loads(json_str)
            
            # Reconstruct messages
            messages = []
            for message_dict in batch_data['messages']:
                if message_dict.get('_error'):
                    logger.warning(f"Skipping error message in batch: {message_dict}")
                    continue
                
                try:
                    decoded_dict = self.serializer.decoder.decode_object(message_dict)
                    message = self.serializer._reconstruct_message(decoded_dict)
                    messages.append(message)
                except Exception as e:
                    logger.error(f"Error reconstructing message in batch: {e}")
            
            logger.debug(f"Deserialized batch: {len(messages)} messages")
            return messages
            
        except Exception as e:
            logger.error(f"Error deserializing message batch: {e}")
            raise

# ============================================================================
# Utilities and Examples
# ============================================================================

def create_test_message() -> ProtocolMessage:
    """Create a test message for serialization testing"""
    from .protocol import create_sample_task
    
    task = create_sample_task()
    
    return ProtocolMessage(
        type=MessageType.TASK_ASSIGNMENT,
        sender=AgentRole.MANAGER,
        recipient=AgentRole.WORKER,
        content={
            'task': asdict(task),
            'deadline': time.time() + 3600,
            'requirements': ['python', 'testing'],
            'metadata': {
                'complexity': 'moderate',
                'estimated_duration': 45
            }
        },
        priority=MessagePriority.HIGH,
        metadata=MessageMetadata(
            session_id='test-session-123',
            task_id=task.id,
            requires_ack=True
        )
    )

async def test_serialization():
    """Test serialization functionality"""
    logger.info("=== Serialization Test ===")
    
    # Create test message
    original_message = create_test_message()
    logger.info(f"Original message: {original_message.id}")
    
    # Test serialization
    serializer = MessageSerializer()
    
    # Serialize
    serialized_data = serializer.serialize(original_message)
    logger.info(f"Serialized size: {len(serialized_data)} bytes")
    
    # Deserialize
    deserialized_message = serializer.deserialize(serialized_data)
    logger.info(f"Deserialized message: {deserialized_message.id}")
    
    # Verify integrity
    assert original_message.id == deserialized_message.id
    assert original_message.type == deserialized_message.type
    assert original_message.sender == deserialized_message.sender
    assert original_message.recipient == deserialized_message.recipient
    
    logger.info("✅ Serialization test passed")
    
    # Test batch serialization
    messages = [create_test_message() for _ in range(5)]
    batch_serializer = BatchMessageSerializer(serializer)
    
    batch_data = batch_serializer.serialize_batch(messages)
    deserialized_messages = batch_serializer.deserialize_batch(batch_data)
    
    assert len(messages) == len(deserialized_messages)
    logger.info("✅ Batch serialization test passed")
    
    # Print statistics
    stats = serializer.get_stats()
    logger.info(f"Serialization stats: {stats}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import asyncio
    asyncio.run(test_serialization())