#!/usr/bin/env python3
"""
Unified CLI Wrapper - Multi-model interface supporting Claude and Gemini
Factory pattern with auto-detection and consistent streaming interface
"""

import asyncio
import shutil
import logging
from abc import ABC, abstractmethod
from typing import Optional, AsyncGenerator, Dict, Any, List, Union, Type
from dataclasses import dataclass, field
from pathlib import Path

# Import existing wrappers
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions, CliMessage
from gemini_cli_wrapper import GeminiCliWrapper, GeminiCliOptions

logger = logging.getLogger(__name__)

@dataclass
class UnifiedCliOptions:
    """Unified options that adapt to different models"""
    model: str = "auto"  # auto, claude:sonnet, gemini:gemini-2.5-pro
    max_turns: int = 10
    allowed_tools: List[str] = field(default_factory=lambda: ["Read", "Write", "Edit", "Bash"])
    verbose: bool = False
    working_directory: Optional[Path] = None
    timeout: int = 300
    
    # Model-specific options
    extra_options: Dict[str, Any] = field(default_factory=dict)

class BaseCliWrapper(ABC):
    """Abstract base for CLI wrappers"""
    
    @abstractmethod
    async def execute(self, prompt: str) -> AsyncGenerator[CliMessage, None]:
        """Execute prompt with streaming response"""
        pass
    
    @abstractmethod
    async def execute_sync(self, prompt: str) -> str:
        """Execute prompt with synchronous response"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if CLI is available"""
        pass

class ProviderDetector:
    """Detects available CLI providers"""
    
    @staticmethod
    def detect_available_providers() -> Dict[str, bool]:
        """Detect which CLI tools are available"""
        return {
            'claude': shutil.which('claude') is not None,
            'gemini': shutil.which('gemini') is not None,
        }
    
    @staticmethod
    def get_default_provider() -> Optional[str]:
        """Get the default provider based on availability"""
        available = ProviderDetector.detect_available_providers()
        
        # Priority: Claude > Gemini
        if available.get('claude'):
            return 'claude'
        elif available.get('gemini'):
            return 'gemini'
        
        return None

class UnifiedClaudeWrapper(BaseCliWrapper):
    """Unified wrapper for Claude CLI"""
    
    def __init__(self, options: UnifiedCliOptions):
        # Convert unified options to Claude-specific
        claude_model = options.model.split(':')[1] if ':' in options.model else "sonnet"
        
        claude_options = ClaudeCliOptions(
            model=claude_model,
            max_turns=options.max_turns,
            allowed_tools=options.allowed_tools,
            verbose=options.verbose,
            working_directory=options.working_directory,
            timeout=options.timeout,
            **options.extra_options.get('claude', {})
        )
        
        self.wrapper = ClaudeCliWrapper(claude_options)
    
    async def execute(self, prompt: str) -> AsyncGenerator[CliMessage, None]:
        """Execute with streaming"""
        async for message in self.wrapper.execute(prompt):
            yield message
    
    async def execute_sync(self, prompt: str) -> str:
        """Execute synchronously"""
        return await self.wrapper.execute_sync(prompt)
    
    def is_available(self) -> bool:
        """Check if Claude CLI is available"""
        return shutil.which('claude') is not None

class UnifiedGeminiWrapper(BaseCliWrapper):
    """Unified wrapper for Gemini CLI"""
    
    def __init__(self, options: UnifiedCliOptions):
        # Convert unified options to Gemini-specific
        gemini_model = options.model.split(':')[1] if ':' in options.model else "gemini-2.5-pro"
        
        gemini_options = GeminiCliOptions(
            model=gemini_model,
            max_turns=options.max_turns,
            allowed_tools=options.allowed_tools,
            verbose=options.verbose,
            working_directory=options.working_directory,
            timeout=options.timeout,
            **options.extra_options.get('gemini', {})
        )
        
        self.wrapper = GeminiCliWrapper(gemini_options)
    
    async def execute(self, prompt: str) -> AsyncGenerator[CliMessage, None]:
        """Execute with streaming"""
        async for message in self.wrapper.execute(prompt):
            yield message
    
    async def execute_sync(self, prompt: str) -> str:
        """Execute synchronously"""
        return await self.wrapper.execute_sync(prompt)
    
    def is_available(self) -> bool:
        """Check if Gemini CLI is available"""
        return shutil.which('gemini') is not None

class UnifiedCliWrapper:
    """
    Unified interface for multiple AI CLI providers
    
    Usage:
        # Auto-detect and use default provider
        wrapper = UnifiedCliWrapper.create()
        
        # Force specific provider
        wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(model="claude:sonnet"))
        
        # Stream responses
        async for message in wrapper.execute("Hello!"):
            print(message.content)
    """
    
    def __init__(self, provider: BaseCliWrapper):
        self.provider = provider
        self._provider_name = self._get_provider_name()
    
    def _get_provider_name(self) -> str:
        """Get provider name from wrapper type"""
        if isinstance(self.provider, UnifiedClaudeWrapper):
            return "claude"
        elif isinstance(self.provider, UnifiedGeminiWrapper):
            return "gemini"
        return "unknown"
    
    @classmethod
    def create(cls, options: Optional[UnifiedCliOptions] = None) -> 'UnifiedCliWrapper':
        """Factory method to create unified wrapper with auto-detection"""
        if options is None:
            options = UnifiedCliOptions()
        
        provider_name, model_name = cls._parse_model_string(options.model)
        
        # Auto-detect if needed
        if provider_name == "auto":
            provider_name = ProviderDetector.get_default_provider()
            if not provider_name:
                raise RuntimeError("No supported CLI providers found. Install 'claude' or 'gemini' CLI tools.")
        
        # Create provider-specific wrapper
        if provider_name == "claude":
            if model_name:
                options.model = f"claude:{model_name}"
            provider = UnifiedClaudeWrapper(options)
        elif provider_name == "gemini":
            if model_name:
                options.model = f"gemini:{model_name}"
            provider = UnifiedGeminiWrapper(options)
        else:
            raise ValueError(f"Unsupported provider: {provider_name}")
        
        # Verify availability
        if not provider.is_available():
            raise RuntimeError(f"{provider_name.title()} CLI not found. Please install it first.")
        
        return cls(provider)
    
    @staticmethod
    def _parse_model_string(model: str) -> tuple[str, Optional[str]]:
        """Parse model string like 'claude:sonnet' into provider and model"""
        if ':' in model:
            return model.split(':', 1)
        elif model == "auto":
            return "auto", None
        else:
            # Assume it's a model name, detect provider
            return "auto", model
    
    @staticmethod
    def list_available_providers() -> Dict[str, Dict[str, Any]]:
        """List all available providers with their status"""
        available = ProviderDetector.detect_available_providers()
        
        return {
            "claude": {
                "available": available.get('claude', False),
                "models": ["sonnet", "opus", "haiku"],
                "install_cmd": "Install Claude Code CLI"
            },
            "gemini": {
                "available": available.get('gemini', False), 
                "models": ["gemini-2.5-pro", "gemini-exp-1206"],
                "install_cmd": "pip install gemini-cli"
            }
        }
    
    async def execute(self, prompt: str) -> AsyncGenerator[CliMessage, None]:
        """Execute prompt with streaming response"""
        logger.info(f"Executing with {self._provider_name}: {prompt[:50]}...")
        
        async for message in self.provider.execute(prompt):
            # Add provider metadata
            message.metadata = {**message.metadata, "provider": self._provider_name}
            yield message
    
    async def execute_sync(self, prompt: str) -> str:
        """Execute prompt synchronously"""
        logger.info(f"Executing sync with {self._provider_name}: {prompt[:50]}...")
        return await self.provider.execute_sync(prompt)
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get information about current provider"""
        return {
            "provider": self._provider_name,
            "available": self.provider.is_available(),
            "wrapper_type": type(self.provider).__name__
        }

# Convenience functions
async def quick_query(prompt: str, model: str = "auto") -> str:
    """Quick synchronous query with auto-detection"""
    wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(model=model))
    return await wrapper.execute_sync(prompt)

async def stream_query(prompt: str, model: str = "auto") -> AsyncGenerator[CliMessage, None]:
    """Quick streaming query with auto-detection"""
    wrapper = UnifiedCliWrapper.create(UnifiedCliOptions(model=model))
    async for message in wrapper.execute(prompt):
        yield message

# Example usage
async def main():
    """Example usage of the unified wrapper"""
    print("=== Unified CLI Wrapper Demo ===")
    
    # List available providers
    providers = UnifiedCliWrapper.list_available_providers()
    print(f"Available providers: {providers}")
    
    try:
        # Auto-detect and create wrapper
        wrapper = UnifiedCliWrapper.create()
        print(f"Using provider: {wrapper.get_provider_info()}")
        
        # Quick sync query
        result = await wrapper.execute_sync("What is 2+2?")
        print(f"Sync result: {result[:100]}...")
        
        # Streaming query
        print("\nStreaming result:")
        async for message in wrapper.execute("Write a short poem about code"):
            if message.type == "stream":
                print(message.content, end="")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())