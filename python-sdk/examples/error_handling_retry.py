#!/usr/bin/env python3
"""
Error Handling and Retry Example - ClaudeSDKClient
================================================

This example demonstrates comprehensive error handling, retry strategies,
fallback mechanisms, and resilient integration patterns for the ClaudeSDKClient.

Requirements:
    - Python 3.10+
    - Claude Code CLI installed and configured
    - claude-code-sdk package installed

Usage:
    python error_handling_retry.py
"""

import asyncio
import time
import random
from typing import Optional, Dict, Any, List, Callable, Awaitable
from dataclasses import dataclass
from enum import Enum
from claude_code_sdk import ClaudeSDKClient
from claude_code_sdk.core.options import ClaudeCodeOptions, create_production_options
from claude_code_sdk.exceptions import (
    ClaudeCodeError, ClaudeTimeoutError, ClaudeAuthError, 
    ClaudeNotFoundError, RateLimitError, NetworkError,
    classify_error, is_recoverable_error
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RetryStrategy(Enum):
    """Different retry strategies."""
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff" 
    FIXED_DELAY = "fixed_delay"
    IMMEDIATE = "immediate"


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF
    base_delay: float = 1.0
    max_delay: float = 60.0
    jitter: bool = True
    recoverable_only: bool = True


@dataclass
class ErrorContext:
    """Context information for error handling."""
    operation: str
    attempt: int
    error: Exception
    timestamp: float
    retry_after: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class ResilientClaudeClient:
    """
    Wrapper around ClaudeSDKClient with advanced error handling and retry logic.
    """
    
    def __init__(self, options: ClaudeCodeOptions, retry_config: Optional[RetryConfig] = None):
        self.options = options
        self.retry_config = retry_config or RetryConfig()
        self.error_history: List[ErrorContext] = []
        self.client: Optional[ClaudeSDKClient] = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        await self._ensure_client()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.client:
            await self.client.close()
            self.client = None
            
    async def _ensure_client(self):
        """Ensure client is initialized."""
        if not self.client:
            self.client = ClaudeSDKClient(self.options)
            await self.client.__aenter__()
            
    def _calculate_retry_delay(self, attempt: int) -> float:
        """Calculate delay before next retry attempt."""
        base_delay = self.retry_config.base_delay
        
        if self.retry_config.strategy == RetryStrategy.EXPONENTIAL_BACKOFF:
            delay = base_delay * (2 ** attempt)
        elif self.retry_config.strategy == RetryStrategy.LINEAR_BACKOFF:
            delay = base_delay * attempt
        elif self.retry_config.strategy == RetryStrategy.FIXED_DELAY:
            delay = base_delay
        else:  # IMMEDIATE
            delay = 0.0
            
        # Apply jitter to avoid thundering herd
        if self.retry_config.jitter:
            delay *= (0.5 + random.random() * 0.5)
            
        return min(delay, self.retry_config.max_delay)
        
    def _should_retry(self, error: Exception, attempt: int) -> bool:
        """Determine if error should trigger a retry."""
        if attempt >= self.retry_config.max_attempts:
            return False
            
        if self.retry_config.recoverable_only and not is_recoverable_error(error):
            return False
            
        # Special handling for different error types
        if isinstance(error, RateLimitError):
            return True  # Always retry rate limits
        elif isinstance(error, ClaudeAuthError):
            return False  # Don't retry auth errors
        elif isinstance(error, ClaudeTimeoutError):
            return attempt < 2  # Limited retries for timeouts
        elif isinstance(error, NetworkError):
            return True  # Retry network errors
            
        return is_recoverable_error(error)
        
    async def _log_error(self, context: ErrorContext):
        """Log error context for debugging."""
        error_type = type(context.error).__name__
        logger.warning(
            f"Operation '{context.operation}' failed on attempt {context.attempt}: "
            f"{error_type} - {str(context.error)[:100]}"
        )
        
        # Store in history
        self.error_history.append(context)
        
    async def execute_with_retry(
        self, 
        prompt: str, 
        operation_name: str = "execute",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a prompt with comprehensive retry logic.
        """
        await self._ensure_client()
        
        for attempt in range(1, self.retry_config.max_attempts + 1):
            try:
                start_time = time.time()
                response = await self.client.execute(prompt)
                duration = time.time() - start_time
                
                if response.success:
                    return {
                        'success': True,
                        'result': response.result,
                        'attempt': attempt,
                        'duration': duration,
                        'metadata': metadata
                    }
                else:
                    # Treat failed response as error
                    raise ClaudeCodeError(f"Execution failed: {response.error}")
                    
            except Exception as error:
                context = ErrorContext(
                    operation=operation_name,
                    attempt=attempt,
                    error=error,
                    timestamp=time.time(),
                    metadata=metadata
                )
                
                await self._log_error(context)
                
                if not self._should_retry(error, attempt):
                    return {
                        'success': False,
                        'error': str(error),
                        'error_type': type(error).__name__,
                        'attempt': attempt,
                        'error_history': [asdict(ctx) for ctx in self.error_history[-3:]],  # Last 3 errors
                        'metadata': metadata
                    }
                    
                if attempt < self.retry_config.max_attempts:
                    delay = self._calculate_retry_delay(attempt)
                    logger.info(f"Retrying {operation_name} in {delay:.1f}s (attempt {attempt + 1})")
                    await asyncio.sleep(delay)
                    
        # All retries exhausted
        return {
            'success': False,
            'error': f"All {self.retry_config.max_attempts} retry attempts failed",
            'error_history': [asdict(ctx) for ctx in self.error_history],
            'metadata': metadata
        }


async def basic_error_handling_example():
    """
    Demonstrates basic error handling patterns.
    """
    print("🔵 Basic Error Handling Example")
    print("=" * 40)
    
    # Test with different error scenarios
    test_cases = [
        {
            'name': 'Valid Request',
            'options': create_production_options(timeout=30),
            'prompt': 'Write a simple Python function to add two numbers',
            'should_succeed': True
        },
        {
            'name': 'Timeout Scenario', 
            'options': ClaudeCodeOptions(timeout=0.1),  # Very short timeout
            'prompt': 'Write a complex application with many features',
            'should_succeed': False
        },
        {
            'name': 'Invalid Model',
            'options': ClaudeCodeOptions(model="invalid-model-12345"),
            'prompt': 'Simple task',
            'should_succeed': False
        }
    ]
    
    for test_case in test_cases:
        print(f"\n🧪 Testing: {test_case['name']}")
        
        try:
            async with ClaudeSDKClient(test_case['options']) as client:
                response = await client.execute(test_case['prompt'])
                
                if response.success:
                    print(f"  [OK] Success: {response.result[:50]}...")
                else:
                    print(f"  [FAIL] Failed: {response.error}")
                    
        except ClaudeTimeoutError as e:
            print(f"  ⏰ Timeout: {e}")
        except ClaudeAuthError as e:
            print(f"  🔐 Auth Error: {e}")
        except ClaudeCodeError as e:
            error_classification = classify_error(e)
            print(f"  🚨 Claude Error ({error_classification}): {e}")
        except Exception as e:
            print(f"  💥 Unexpected Error: {type(e).__name__} - {e}")
            
    print()


async def retry_strategies_example():
    """
    Demonstrates different retry strategies.
    """
    print("🔵 Retry Strategies Example")
    print("=" * 40)
    
    # Create problematic options to trigger retries
    problematic_options = ClaudeCodeOptions(
        timeout=5,  # Short timeout to potentially trigger failures
        model="claude-3-sonnet-20241022"
    )
    
    retry_configs = [
        RetryConfig(
            max_attempts=3,
            strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
            base_delay=0.5
        ),
        RetryConfig(
            max_attempts=3,
            strategy=RetryStrategy.LINEAR_BACKOFF,
            base_delay=1.0
        ),
        RetryConfig(
            max_attempts=2,
            strategy=RetryStrategy.FIXED_DELAY,
            base_delay=2.0
        )
    ]
    
    test_prompt = "Create a Python function to validate email addresses with regex"
    
    for i, config in enumerate(retry_configs, 1):
        print(f"\n[RETRY] Strategy {i}: {config.strategy.value}")
        print(f"   Max attempts: {config.max_attempts}, Base delay: {config.base_delay}s")
        
        start_time = time.time()
        
        try:
            async with ResilientClaudeClient(problematic_options, config) as client:
                result = await client.execute_with_retry(
                    test_prompt,
                    operation_name=f"strategy_test_{i}"
                )
                
                duration = time.time() - start_time
                
                if result['success']:
                    print(f"  [OK] Succeeded on attempt {result['attempt']} ({duration:.1f}s total)")
                else:
                    print(f"  [FAIL] Failed after {result.get('attempt', 'unknown')} attempts ({duration:.1f}s total)")
                    print(f"     Error: {result.get('error', 'Unknown')[:60]}...")
                    
        except Exception as e:
            duration = time.time() - start_time
            print(f"  💥 Exception after {duration:.1f}s: {e}")
            
    print()


async def error_classification_example():
    """
    Demonstrates error classification and handling strategies.
    """
    print("🔵 Error Classification Example") 
    print("=" * 40)
    
    # Simulate different types of errors
    error_scenarios = [
        (ClaudeTimeoutError("Request timed out after 30s"), "Timeout"),
        (ClaudeAuthError("Invalid API key"), "Authentication"),
        (RateLimitError("Rate limit exceeded"), "Rate Limit"),
        (NetworkError("Connection refused"), "Network"),
        (ClaudeCodeError("Generic error"), "Generic")
    ]
    
    for error, scenario_name in error_scenarios:
        print(f"\n🧪 Scenario: {scenario_name}")
        
        # Classify the error
        classification = classify_error(error)
        recoverable = is_recoverable_error(error)
        
        print(f"   Error Type: {type(error).__name__}")
        print(f"   Classification: {classification}")
        print(f"   Recoverable: {'[OK]' if recoverable else '[FAIL]'}")
        
        # Suggest handling strategy
        if isinstance(error, RateLimitError):
            print(f"   [RETRY] Strategy: Wait and retry with exponential backoff")
        elif isinstance(error, ClaudeAuthError):
            print(f"   🔐 Strategy: Check authentication, don't retry")
        elif isinstance(error, NetworkError):
            print(f"   🌐 Strategy: Retry with circuit breaker pattern")
        elif isinstance(error, ClaudeTimeoutError):
            print(f"   ⏰ Strategy: Retry with increased timeout")
        else:
            print(f"   🤔 Strategy: Generic retry with backoff")
            
    print()


async def circuit_breaker_example():
    """
    Demonstrates circuit breaker pattern for fault tolerance.
    """
    print("🔵 Circuit Breaker Example")
    print("=" * 40)
    
    class CircuitBreaker:
        """Simple circuit breaker implementation."""
        
        def __init__(self, failure_threshold: int = 3, timeout: float = 60.0):
            self.failure_threshold = failure_threshold
            self.timeout = timeout
            self.failure_count = 0
            self.last_failure_time = 0
            self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
            
        def can_execute(self) -> bool:
            """Check if execution is allowed."""
            if self.state == "CLOSED":
                return True
            elif self.state == "OPEN":
                if time.time() - self.last_failure_time > self.timeout:
                    self.state = "HALF_OPEN"
                    return True
                return False
            else:  # HALF_OPEN
                return True
                
        def record_success(self):
            """Record successful execution."""
            self.failure_count = 0
            self.state = "CLOSED"
            
        def record_failure(self):
            """Record failed execution."""
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
                
        def get_state(self) -> Dict[str, Any]:
            """Get current circuit breaker state."""
            return {
                'state': self.state,
                'failure_count': self.failure_count,
                'last_failure_time': self.last_failure_time,
                'can_execute': self.can_execute()
            }
    
    # Create circuit breaker
    circuit_breaker = CircuitBreaker(failure_threshold=2, timeout=5.0)
    
    # Simulate operations that might fail
    operations = [
        ("Operation 1", True),   # Success
        ("Operation 2", False),  # Failure  
        ("Operation 3", False),  # Failure - should open circuit
        ("Operation 4", False),  # Blocked by circuit breaker
        ("Operation 5", True),   # After timeout, should succeed
    ]
    
    problematic_options = ClaudeCodeOptions(timeout=1)  # Very short timeout
    
    for operation_name, should_simulate_success in operations:
        print(f"\n[TOOL] {operation_name}")
        
        state = circuit_breaker.get_state()
        print(f"   Circuit State: {state['state']} (failures: {state['failure_count']})")
        
        if not circuit_breaker.can_execute():
            print("   🚫 Circuit breaker OPEN - operation blocked")
            continue
            
        # Simulate operation
        try:
            if should_simulate_success:
                # Simulate successful operation
                print("   [OK] Operation succeeded")
                circuit_breaker.record_success()
            else:
                # Simulate failure
                raise ClaudeTimeoutError("Simulated timeout")
                
        except Exception as e:
            print(f"   [FAIL] Operation failed: {e}")
            circuit_breaker.record_failure()
            
        # Brief pause to simulate time passing
        await asyncio.sleep(0.5)
        
    print(f"\n[SEARCH] Final Circuit Breaker State: {circuit_breaker.get_state()}")
    print()


async def fallback_mechanisms_example():
    """
    Demonstrates fallback mechanisms when primary operations fail.
    """
    print("🔵 Fallback Mechanisms Example")
    print("=" * 40)
    
    class FallbackClaudeClient:
        """Client with fallback strategies."""
        
        def __init__(self):
            self.primary_options = create_production_options(
                timeout=30,
                model="claude-3-opus-20240229"
            )
            self.fallback_options = create_production_options(
                timeout=60,
                model="claude-3-sonnet-20241022"
            )
            self.last_resort_options = ClaudeCodeOptions(
                timeout=120,
                model="claude-3-haiku-20240307"
            )
            
        async def execute_with_fallbacks(self, prompt: str) -> Dict[str, Any]:
            """Execute with multiple fallback strategies."""
            
            strategies = [
                ("primary", self.primary_options, "High-performance model"),
                ("fallback", self.fallback_options, "Balanced model"), 
                ("last_resort", self.last_resort_options, "Fast model")
            ]
            
            for strategy_name, options, description in strategies:
                print(f"   [RESULT] Trying {strategy_name} strategy: {description}")
                
                try:
                    async with ClaudeSDKClient(options) as client:
                        response = await client.execute(prompt)
                        
                        if response.success:
                            return {
                                'success': True,
                                'result': response.result,
                                'strategy_used': strategy_name,
                                'description': description
                            }
                        else:
                            print(f"      [FAIL] {strategy_name} failed: {response.error}")
                            
                except Exception as e:
                    print(f"      💥 {strategy_name} exception: {type(e).__name__}")
                    
            return {
                'success': False,
                'error': 'All fallback strategies failed',
                'strategies_attempted': [s[0] for s in strategies]
            }
    
    # Test fallback mechanisms
    fallback_client = FallbackClaudeClient()
    
    test_prompts = [
        "Create a simple Python function to reverse a string",
        "Write a complex distributed system architecture",
    ]
    
    for i, prompt in enumerate(test_prompts, 1):
        print(f"\n[NOTE] Test {i}: {prompt[:50]}...")
        
        result = await fallback_client.execute_with_fallbacks(prompt)
        
        if result['success']:
            print(f"   [OK] Success using {result['strategy_used']} strategy")
            print(f"      Result preview: {result['result'][:100]}...")
        else:
            print(f"   [FAIL] All strategies failed")
            print(f"      Attempted: {', '.join(result.get('strategies_attempted', []))}")
            
    print()


async def main():
    """
    Main function demonstrating all error handling and retry patterns.
    """
    print("[START] Claude SDK Client - Error Handling & Retry Examples")
    print("=" * 60)
    print()
    
    # Run all examples
    await basic_error_handling_example()
    await retry_strategies_example()
    await error_classification_example()
    await circuit_breaker_example()
    await fallback_mechanisms_example()
    
    print("[OK] All error handling examples completed!")
    print()
    print("Key patterns demonstrated:")
    print("- Basic error classification and handling")
    print("- Multiple retry strategies with backoff")
    print("- Circuit breaker pattern for fault tolerance")
    print("- Fallback mechanisms for reliability")
    print("- Comprehensive error context tracking")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Error handling examples interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error running error handling examples: {e}")
        logger.exception("Error running error handling examples")