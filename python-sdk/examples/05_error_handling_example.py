#!/usr/bin/env python3
"""
Error Handling Example - Comprehensive error handling and recovery strategies
Demonstrates: Exception handling, retry logic, graceful degradation, logging
"""

import asyncio
import sys
from pathlib import Path
import logging
import time
from typing import Optional

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions
from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def basic_error_handling():
    """Demonstrate basic error handling patterns"""
    
    print("🚨 Error Handling Example - Basic Patterns")
    print("=" * 50)
    
    options = ClaudeCliOptions(
        model="sonnet",
        max_turns=3,
        timeout=30,  # Short timeout to trigger timeout errors
        verbose=True
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    # Test 1: CLI availability check
    print("\n[SEARCH] Test 1: CLI Availability Check")
    try:
        if wrapper.is_available():
            print("[OK] Claude CLI is available")
        else:
            print("[FAIL] Claude CLI not found")
            print("[TIP] Solution: Install with 'npm install -g @anthropic-ai/claude-code'")
            return
    except Exception as e:
        print(f"[FAIL] Error checking CLI availability: {e}")
        return
    
    # Test 2: Invalid model handling
    print("\n[SEARCH] Test 2: Invalid Model Handling")
    try:
        invalid_options = ClaudeCliOptions(model="invalid-model")
        invalid_wrapper = ClaudeCliWrapper(invalid_options)
        
        response = await invalid_wrapper.execute_sync("Hello")
        print(f"Unexpected success: {response}")
    except Exception as e:
        print(f"[FAIL] Expected error with invalid model: {type(e).__name__}: {e}")
        print("[OK] Error handled gracefully")
    
    # Test 3: Timeout handling
    print("\n[SEARCH] Test 3: Timeout Handling")
    try:
        timeout_options = ClaudeCliOptions(
            model="sonnet",
            timeout=1  # Very short timeout
        )
        timeout_wrapper = ClaudeCliWrapper(timeout_options)
        
        # This should timeout
        response = await timeout_wrapper.execute_sync(
            "Write a very long and detailed explanation of quantum computing"
        )
        print(f"Unexpected success: {response[:100]}...")
        
    except asyncio.TimeoutError:
        print("[FAIL] Timeout error occurred (expected)")
        print("[OK] Timeout handled gracefully")
    except Exception as e:
        print(f"[FAIL] Other error: {type(e).__name__}: {e}")
    finally:
        await wrapper.cleanup()


async def retry_logic_example():
    """Demonstrate retry logic with exponential backoff"""
    
    print("\n[RETRY] Error Handling Example - Retry Logic")
    print("=" * 50)
    
    async def execute_with_retry(
        wrapper: ClaudeCliWrapper,
        prompt: str,
        max_retries: int = 3,
        base_delay: float = 1.0
    ) -> Optional[str]:
        """Execute with exponential backoff retry logic"""
        
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Attempt {attempt + 1}/{max_retries + 1}")
                
                response = await wrapper.execute_sync(prompt)
                logger.info("[OK] Success!")
                return response
                
            except asyncio.TimeoutError:
                logger.warning(f"⏰ Timeout on attempt {attempt + 1}")
                
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff
                    logger.info(f"[RETRY] Retrying in {delay:.1f}s...")
                    await asyncio.sleep(delay)
                else:
                    logger.error("[FAIL] All retry attempts exhausted")
                    raise
                    
            except Exception as e:
                logger.error(f"[FAIL] Unexpected error on attempt {attempt + 1}: {e}")
                
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    logger.info(f"[RETRY] Retrying in {delay:.1f}s...")
                    await asyncio.sleep(delay)
                else:
                    logger.error("[FAIL] All retry attempts exhausted")
                    raise
        
        return None
    
    # Test retry logic
    options = ClaudeCliOptions(
        model="sonnet",
        timeout=45,  # Reasonable timeout
        verbose=False
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("[FAIL] Claude CLI not available")
        return
    
    try:
        print("[RESULT] Testing retry logic with a complex query...")
        
        prompt = "Explain the concept of machine learning in simple terms"
        
        start_time = time.time()
        result = await execute_with_retry(wrapper, prompt, max_retries=2)
        elapsed = time.time() - start_time
        
        if result:
            print(f"[OK] Success after {elapsed:.2f}s")
            print(f"[NOTE] Response: {result[:200]}...")
        else:
            print("[FAIL] Failed after all retries")
            
    except Exception as e:
        print(f"[FAIL] Final error: {type(e).__name__}: {e}")
    
    finally:
        await wrapper.cleanup()


async def graceful_degradation_example():
    """Demonstrate graceful degradation with fallback models"""
    
    print("\n📉 Error Handling Example - Graceful Degradation")
    print("=" * 50)
    
    # Model preference order (from most to least preferred)
    model_fallbacks = [
        ("claude:opus", "Claude 3 Opus"),
        ("claude:sonnet", "Claude 3.5 Sonnet"),
        ("claude:haiku", "Claude 3 Haiku"),
        ("gemini:gemini-2.0-flash", "Gemini 2.0 Flash")
    ]
    
    prompt = "What is the capital of France?"
    
    async def try_model(model_id: str, model_name: str) -> Optional[str]:
        """Try a specific model"""
        try:
            options = UnifiedCliOptions(
                model=model_id,
                timeout=30,
                max_turns=2
            )
            
            wrapper = UnifiedCliWrapper(options)
            
            if not wrapper.is_available():
                logger.warning(f"[WARN]  {model_name} not available")
                return None
            
            logger.info(f"🤖 Trying {model_name}...")
            response = await wrapper.execute_sync(prompt)
            
            await wrapper.cleanup()
            return response
            
        except Exception as e:
            logger.error(f"[FAIL] {model_name} failed: {e}")
            return None
    
    print(f"[RESULT] Query: {prompt}")
    print("[RETRY] Trying models in preference order...")
    
    for model_id, model_name in model_fallbacks:
        result = await try_model(model_id, model_name)
        
        if result:
            print(f"\n[OK] Success with {model_name}!")
            print(f"[NOTE] Response: {result}")
            break
    else:
        print("\n[FAIL] All models failed - no fallback available")
        print("[TIP] Consider checking network connectivity or CLI installations")


async def comprehensive_error_scenarios():
    """Test various error scenarios comprehensively"""
    
    print("\n🧪 Error Handling Example - Comprehensive Scenarios")
    print("=" * 50)
    
    error_tests = [
        ("Empty prompt", ""),
        ("Very long prompt", "x" * 10000),
        ("Special characters", "Hello 🌍 测试 [START]"),
        ("Code injection attempt", "'; rm -rf /; echo 'hello'"),
        ("JSON breaking characters", '{"key": "value with "quotes" and \n newlines"}')
    ]
    
    options = ClaudeCliOptions(
        model="sonnet",
        timeout=60,
        max_turns=2,
        verbose=False
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    if not wrapper.is_available():
        print("[FAIL] Claude CLI not available")
        return
    
    results = []
    
    for test_name, test_prompt in error_tests:
        print(f"\n[SEARCH] Testing: {test_name}")
        
        try:
            start_time = time.time()
            
            if test_prompt:  # Skip empty prompt test
                response = await wrapper.execute_sync(test_prompt)
                elapsed = time.time() - start_time
                
                success = len(response) > 0
                results.append({
                    'test': test_name,
                    'success': success,
                    'time': elapsed,
                    'response_length': len(response)
                })
                
                print(f"[OK] Success - {len(response)} chars in {elapsed:.2f}s")
            else:
                print("[WARN]  Skipped empty prompt test")
                
        except Exception as e:
            print(f"[FAIL] Failed: {type(e).__name__}: {str(e)[:100]}")
            results.append({
                'test': test_name,
                'success': False,
                'error': str(e)[:100]
            })
    
    # Summary
    print(f"\n[STATS] Test Results Summary:")
    print("=" * 40)
    
    successes = sum(1 for r in results if r.get('success', False))
    total = len(results)
    
    print(f"[OK] Successful: {successes}/{total}")
    print(f"[FAIL] Failed: {total - successes}/{total}")
    
    for result in results:
        status = "[OK]" if result.get('success') else "[FAIL]"
        print(f"  {status} {result['test']}")
    
    await wrapper.cleanup()


async def logging_and_monitoring_example():
    """Demonstrate proper logging and monitoring"""
    
    print("\n[STATS] Error Handling Example - Logging & Monitoring")
    print("=" * 50)
    
    # Custom logger for this example
    example_logger = logging.getLogger("claude_wrapper_example")
    
    # Add file handler
    log_file = Path("claude_wrapper_errors.log")
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    example_logger.addHandler(file_handler)
    
    class MonitoredClaudeWrapper(ClaudeCliWrapper):
        """Wrapper with enhanced logging and monitoring"""
        
        def __init__(self, options: ClaudeCliOptions):
            super().__init__(options)
            self.query_count = 0
            self.error_count = 0
            self.total_response_time = 0
        
        async def execute_sync(self, prompt: str) -> str:
            self.query_count += 1
            start_time = time.time()
            
            try:
                example_logger.info(f"Query #{self.query_count} started")
                response = await super().execute_sync(prompt)
                
                elapsed = time.time() - start_time
                self.total_response_time += elapsed
                
                example_logger.info(
                    f"Query #{self.query_count} completed in {elapsed:.2f}s "
                    f"({len(response)} chars)"
                )
                
                return response
                
            except Exception as e:
                self.error_count += 1
                elapsed = time.time() - start_time
                
                example_logger.error(
                    f"Query #{self.query_count} failed after {elapsed:.2f}s: "
                    f"{type(e).__name__}: {e}"
                )
                raise
        
        def get_stats(self) -> dict:
            """Get wrapper statistics"""
            avg_response_time = (
                self.total_response_time / max(self.query_count - self.error_count, 1)
            )
            
            return {
                'total_queries': self.query_count,
                'successful_queries': self.query_count - self.error_count,
                'error_count': self.error_count,
                'error_rate': self.error_count / max(self.query_count, 1) * 100,
                'avg_response_time': avg_response_time
            }
    
    # Test monitored wrapper
    options = ClaudeCliOptions(model="sonnet", timeout=45)
    monitored_wrapper = MonitoredClaudeWrapper(options)
    
    if not monitored_wrapper.is_available():
        print("[FAIL] Claude CLI not available")
        return
    
    test_queries = [
        "What is Python?",
        "Explain async/await",
        "",  # This will cause an error
        "Write a haiku about programming"
    ]
    
    print("[SEARCH] Running monitored queries...")
    
    for i, query in enumerate(test_queries, 1):
        try:
            if query:
                response = await monitored_wrapper.execute_sync(query)
                print(f"[OK] Query {i}: Success ({len(response)} chars)")
            else:
                print(f"[WARN]  Query {i}: Skipped (empty)")
        except Exception as e:
            print(f"[FAIL] Query {i}: Failed - {e}")
    
    # Show statistics
    stats = monitored_wrapper.get_stats()
    print(f"\n📈 Wrapper Statistics:")
    print(f"  Total queries: {stats['total_queries']}")
    print(f"  Successful: {stats['successful_queries']}")
    print(f"  Error rate: {stats['error_rate']:.1f}%")
    print(f"  Avg response time: {stats['avg_response_time']:.2f}s")
    
    print(f"\n📄 Log file created: {log_file}")
    
    await monitored_wrapper.cleanup()


if __name__ == "__main__":
    print("🚨 Claude CLI Wrapper - Error Handling Examples")
    
    # Run all error handling examples
    asyncio.run(basic_error_handling())
    
    input("\n⏸️  Press Enter for retry logic example...")
    asyncio.run(retry_logic_example())
    
    input("\n⏸️  Press Enter for graceful degradation example...")
    asyncio.run(graceful_degradation_example())
    
    input("\n⏸️  Press Enter for comprehensive error scenarios...")
    asyncio.run(comprehensive_error_scenarios())
    
    input("\n⏸️  Press Enter for logging and monitoring example...")
    asyncio.run(logging_and_monitoring_example())
    
    print("\n[OK] All error handling examples completed!")
    print("[TIP] Check 'claude_wrapper_errors.log' for detailed logging output")