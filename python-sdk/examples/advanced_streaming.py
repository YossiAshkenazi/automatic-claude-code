#!/usr/bin/env python3
"""
Advanced Streaming Examples for Claude Code SDK
Demonstrates real-time message processing and stream handling
"""

import asyncio
import time
from typing import List, Dict, Any
from claude_code_sdk import (
    ClaudeSDKClient, ClaudeCodeOptions, query,
    ResultMessage, ToolUseMessage, ToolResultMessage, 
    StreamMessage, ErrorMessage, StatusMessage
)
from claude_code_sdk.interfaces.streaming import (
    MessageCollector, StreamingHandler, collect_all_messages,
    get_final_result, result_only_filter, error_only_filter
)

class CustomStreamHandler(StreamingHandler):
    """Custom streaming handler for real-time processing"""
    
    def __init__(self):
        self.messages: List[Dict[str, Any]] = []
        self.start_time = time.time()
        self.tool_usage = {}
    
    async def handle_result(self, message: ResultMessage):
        """Handle final results"""
        elapsed = time.time() - self.start_time
        print(f"\n🎯 Final Result (after {elapsed:.1f}s):")
        print(f"📝 Content: {message.result[:200]}...")
        if message.token_count:
            print(f"🎲 Tokens: {message.token_count}")
    
    async def handle_tool_use(self, message: ToolUseMessage):
        """Handle tool usage"""
        tool_name = message.tool_name
        self.tool_usage[tool_name] = self.tool_usage.get(tool_name, 0) + 1
        print(f"\n🔧 Tool: {tool_name} (used {self.tool_usage[tool_name]} times)")
        if message.tool_input:
            print(f"   Input: {str(message.tool_input)[:100]}...")
    
    async def handle_stream(self, message: StreamMessage):
        """Handle streaming content"""
        if message.content:
            print(".", end="", flush=True)  # Progress dots
    
    async def handle_error(self, message: ErrorMessage):
        """Handle errors"""
        print(f"\n❌ Error: {message.error}")
        if message.error_code:
            print(f"   Code: {message.error_code}")
    
    async def handle_status(self, message: StatusMessage):
        """Handle status updates"""
        print(f"\n📊 Status: {message.status}")

async def example_1_custom_handler():
    """Example 1: Custom streaming handler"""
    print("🔹 Example 1: Custom Streaming Handler")
    
    handler = CustomStreamHandler()
    
    options = ClaudeCodeOptions(
        verbose=True,
        stream_response=True,
        allowed_tools=["Read", "Write", "Edit"]
    )
    
    try:
        async with ClaudeSDKClient(options) as client:
            print("📡 Starting streaming with custom handler...")
            
            async for message in client.query("Create a Python web scraper using requests and BeautifulSoup"):
                # Route message to appropriate handler method
                if isinstance(message, ResultMessage):
                    await handler.handle_result(message)
                elif isinstance(message, ToolUseMessage):
                    await handler.handle_tool_use(message)
                elif isinstance(message, StreamMessage):
                    await handler.handle_stream(message)
                elif isinstance(message, ErrorMessage):
                    await handler.handle_error(message)
                elif isinstance(message, StatusMessage):
                    await handler.handle_status(message)
        
        print(f"\n✅ Streaming completed!")
        print(f"📊 Tool usage summary: {handler.tool_usage}")
        
    except Exception as e:
        print(f"❌ Streaming failed: {e}")

async def example_2_message_collector():
    """Example 2: Message collector for post-processing"""
    print("\n🔹 Example 2: Message Collector")
    
    collector = MessageCollector()
    
    try:
        print("📡 Collecting all messages...")
        
        async for message in query("Write a simple REST API with error handling"):
            collector.add(message)
            print(".", end="", flush=True)
        
        print(f"\n📊 Collection complete!")
        
        # Analyze collected messages
        results = collector.get_results()
        errors = collector.get_errors()
        tool_uses = collector.get_tool_uses()
        
        print(f"📝 Results: {len(results)}")
        print(f"❌ Errors: {len(errors)}")
        print(f"🔧 Tool uses: {len(tool_uses)}")
        
        if results:
            print(f"🎯 Final result preview: {results[-1].result[:150]}...")
        
        if tool_uses:
            tools_used = [tool.tool_name for tool in tool_uses]
            print(f"🛠️  Tools used: {set(tools_used)}")
    
    except Exception as e:
        print(f"❌ Collection failed: {e}")

async def example_3_filtered_streaming():
    """Example 3: Filtered streaming for specific message types"""
    print("\n🔹 Example 3: Filtered Streaming")
    
    try:
        print("📡 Filtering for results only...")
        
        # Only collect result messages
        results = []
        async for result_message in result_only_filter(
            query("Explain Python async/await with practical examples")
        ):
            results.append(result_message)
            print(f"✅ Got result: {len(result_message.result)} characters")
        
        print(f"📊 Collected {len(results)} result messages")
        
        print("\n📡 Filtering for errors only...")
        
        # Intentionally cause an error for demonstration
        error_count = 0
        async for error_message in error_only_filter(
            query("Use a non-existent tool to cause an error", timeout=5)
        ):
            error_count += 1
            print(f"❌ Error {error_count}: {error_message.error}")
        
        if error_count == 0:
            print("✅ No errors detected (this is good!)")
    
    except Exception as e:
        print(f"❌ Filtering failed: {e}")

async def example_4_real_time_processing():
    """Example 4: Real-time processing with immediate responses"""
    print("\n🔹 Example 4: Real-Time Processing")
    
    class RealTimeProcessor:
        def __init__(self):
            self.buffer = ""
            self.word_count = 0
            self.start_time = time.time()
        
        async def process_stream(self, message):
            if isinstance(message, StreamMessage) and message.content:
                self.buffer += message.content
                words = self.buffer.split()
                
                # Update word count
                new_word_count = len(words)
                if new_word_count > self.word_count:
                    self.word_count = new_word_count
                    elapsed = time.time() - self.start_time
                    wps = self.word_count / elapsed if elapsed > 0 else 0
                    print(f"\r📈 Words: {self.word_count}, Speed: {wps:.1f} WPS", end="", flush=True)
            
            elif isinstance(message, ResultMessage):
                elapsed = time.time() - self.start_time
                print(f"\n🎯 Final: {self.word_count} words in {elapsed:.1f}s")
                return message.result
    
    processor = RealTimeProcessor()
    
    try:
        print("📡 Starting real-time processing...")
        
        result = None
        async for message in query("Write a detailed explanation of Python generators with multiple examples"):
            result = await processor.process_stream(message)
            if result:
                break
        
        print(f"\n✅ Processing complete!")
        if result:
            print(f"📝 Result length: {len(result)} characters")
    
    except Exception as e:
        print(f"❌ Real-time processing failed: {e}")

async def example_5_performance_monitoring():
    """Example 5: Performance monitoring during streaming"""
    print("\n🔹 Example 5: Performance Monitoring")
    
    class PerformanceMonitor:
        def __init__(self):
            self.message_count = 0
            self.message_times = []
            self.first_message_time = None
            self.last_message_time = None
        
        def record_message(self, message):
            current_time = time.time()
            
            if self.first_message_time is None:
                self.first_message_time = current_time
            
            self.last_message_time = current_time
            self.message_count += 1
            self.message_times.append(current_time)
        
        def get_stats(self) -> Dict[str, Any]:
            if not self.message_times:
                return {}
            
            total_time = self.last_message_time - self.first_message_time
            avg_interval = total_time / (len(self.message_times) - 1) if len(self.message_times) > 1 else 0
            
            return {
                'message_count': self.message_count,
                'total_time': total_time,
                'messages_per_second': self.message_count / total_time if total_time > 0 else 0,
                'average_interval': avg_interval,
                'first_message_delay': self.first_message_time - time.time() if self.first_message_time else 0
            }
    
    monitor = PerformanceMonitor()
    start_time = time.time()
    
    try:
        print("📡 Starting performance monitoring...")
        
        async for message in query("Create a Python class for managing a simple database connection"):
            monitor.record_message(message)
            
            # Show progress
            if monitor.message_count % 5 == 0:
                elapsed = time.time() - start_time
                print(f"\r📊 Messages: {monitor.message_count}, Time: {elapsed:.1f}s", end="", flush=True)
            
            if isinstance(message, ResultMessage):
                break
        
        # Show final stats
        stats = monitor.get_stats()
        print(f"\n📈 Performance Statistics:")
        print(f"   Messages: {stats.get('message_count', 0)}")
        print(f"   Total time: {stats.get('total_time', 0):.2f}s")
        print(f"   Messages/sec: {stats.get('messages_per_second', 0):.2f}")
        print(f"   Avg interval: {stats.get('average_interval', 0):.3f}s")
    
    except Exception as e:
        print(f"❌ Performance monitoring failed: {e}")

async def example_6_utility_functions():
    """Example 6: Using utility functions for common patterns"""
    print("\n🔹 Example 6: Utility Functions")
    
    try:
        # Collect all messages utility
        print("📡 Using collect_all_messages...")
        messages = await collect_all_messages(
            query("Write a simple Python calculator class")
        )
        print(f"📊 Collected {len(messages)} total messages")
        
        message_types = {}
        for msg in messages:
            msg_type = type(msg).__name__
            message_types[msg_type] = message_types.get(msg_type, 0) + 1
        
        print("📋 Message type breakdown:")
        for msg_type, count in message_types.items():
            print(f"   {msg_type}: {count}")
        
        # Get final result utility
        print("\n📡 Using get_final_result...")
        result = await get_final_result(
            query("Write a one-line Python lambda function to square numbers")
        )
        
        if result:
            print(f"🎯 Final result: {result[:200]}...")
        else:
            print("❌ No result received")
    
    except Exception as e:
        print(f"❌ Utility functions failed: {e}")

async def main():
    """Run all advanced streaming examples"""
    print("🌊 Claude Code SDK - Advanced Streaming Examples")
    print("=" * 60)
    
    examples = [
        ("Custom Handler", example_1_custom_handler),
        ("Message Collector", example_2_message_collector),
        ("Filtered Streaming", example_3_filtered_streaming),
        ("Real-Time Processing", example_4_real_time_processing),
        ("Performance Monitoring", example_5_performance_monitoring),
        ("Utility Functions", example_6_utility_functions)
    ]
    
    successful = 0
    
    for name, example_func in examples:
        try:
            print(f"\n🚀 Running: {name}")
            await example_func()
            print(f"✅ Completed: {name}")
            successful += 1
        except Exception as e:
            print(f"❌ Failed: {name} - {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Advanced Streaming Examples Summary")
    print("=" * 60)
    print(f"🎯 Success rate: {successful}/{len(examples)} examples")
    
    if successful == len(examples):
        print("🎉 All advanced streaming examples completed!")
        print("🌟 You're ready for production streaming applications!")
    elif successful > len(examples) // 2:
        print("⚠️ Most examples completed. Check any error messages above.")
    else:
        print("🚨 Multiple examples failed. Verify Claude CLI setup and authentication.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️ Advanced streaming examples interrupted")
    except Exception as e:
        print(f"💥 Examples crashed: {e}")