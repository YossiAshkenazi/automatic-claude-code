#!/usr/bin/env python3
"""
Multi-Model Comparison Example - Compare responses from different models
Demonstrates: Model selection, response comparison, unified interface
"""

import asyncio
import sys
from pathlib import Path
import time

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from unified_cli_wrapper import UnifiedCliWrapper, UnifiedCliOptions


async def model_comparison_example():
    """Compare responses from different available models"""
    
    print("🤖 Multi-Model Comparison Example")
    print("=" * 50)
    
    # Test query
    test_prompt = "Explain the singleton design pattern in Python with a practical example"
    
    # Models to test (will automatically detect which are available)
    models_to_test = [
        ("claude:sonnet", "Claude 3.5 Sonnet"),
        ("claude:opus", "Claude 3 Opus"), 
        ("claude:haiku", "Claude 3 Haiku"),
        ("gemini:gemini-2.0-flash", "Gemini 2.0 Flash")
    ]
    
    print(f"📝 Test Query: {test_prompt}")
    print("\n🔍 Testing available models...")
    
    results = []
    
    for model_id, model_name in models_to_test:
        print(f"\n{'='*60}")
        print(f"🎯 Testing {model_name} ({model_id})")
        print("="*60)
        
        options = UnifiedCliOptions(
            model=model_id,
            max_turns=3,
            timeout=60,
            verbose=False
        )
        
        wrapper = UnifiedCliWrapper(options)
        
        try:
            if not wrapper.is_available():
                print(f"⚠️  {model_name} not available (CLI not installed)")
                continue
            
            start_time = time.time()
            
            # Get response
            response = await wrapper.execute_sync(test_prompt)
            
            elapsed = time.time() - start_time
            
            # Store results
            results.append({
                'model': model_name,
                'response': response,
                'time': elapsed,
                'length': len(response)
            })
            
            print(f"⏱️  Response time: {elapsed:.2f}s")
            print(f"📏 Response length: {len(response)} characters")
            print(f"🤖 Response:\n{response}\n")
            
        except Exception as e:
            print(f"❌ Error with {model_name}: {e}")
        
        finally:
            await wrapper.cleanup()
            
        # Brief pause between models
        await asyncio.sleep(1)
    
    # Summary comparison
    if results:
        print("\n📊 COMPARISON SUMMARY")
        print("=" * 60)
        
        for result in results:
            print(f"🤖 {result['model']}:")
            print(f"   ⏱️  Time: {result['time']:.2f}s")
            print(f"   📏 Length: {result['length']} chars")
            print(f"   🎯 Preview: {result['response'][:100]}...")
            print()
        
        # Find fastest and longest
        fastest = min(results, key=lambda x: x['time'])
        longest = max(results, key=lambda x: x['length'])
        
        print(f"🏆 Fastest: {fastest['model']} ({fastest['time']:.2f}s)")
        print(f"📝 Most detailed: {longest['model']} ({longest['length']} chars)")
    else:
        print("\n⚠️  No models were available for testing")


async def side_by_side_comparison():
    """Run same query on multiple models simultaneously"""
    
    print("\n🔄 Side-by-Side Comparison (Async)")
    print("=" * 50)
    
    prompt = "What are the top 3 benefits of using Python for data science?"
    
    # Available models
    models = [
        ("claude:sonnet", "Claude Sonnet"),
        ("gemini:gemini-2.0-flash", "Gemini Flash")
    ]
    
    print(f"📝 Query: {prompt}")
    print("\n🚀 Running queries simultaneously...")
    
    async def query_model(model_id: str, model_name: str):
        """Query a single model"""
        options = UnifiedCliOptions(
            model=model_id,
            max_turns=2,
            timeout=45
        )
        
        wrapper = UnifiedCliWrapper(options)
        
        try:
            if not wrapper.is_available():
                return {"model": model_name, "error": "Not available"}
            
            start_time = time.time()
            response = await wrapper.execute_sync(prompt)
            elapsed = time.time() - start_time
            
            return {
                "model": model_name,
                "response": response,
                "time": elapsed,
                "success": True
            }
            
        except Exception as e:
            return {"model": model_name, "error": str(e), "success": False}
        
        finally:
            await wrapper.cleanup()
    
    # Run all queries concurrently
    tasks = [query_model(model_id, name) for model_id, name in models]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Display results
    print(f"\n📊 SIDE-BY-SIDE RESULTS")
    print("=" * 60)
    
    for result in results:
        if isinstance(result, Exception):
            print(f"❌ Exception: {result}")
            continue
            
        if result.get("success"):
            print(f"🤖 {result['model']} ({result['time']:.2f}s):")
            print(f"   {result['response']}")
            print()
        else:
            print(f"❌ {result['model']}: {result.get('error', 'Unknown error')}")
            print()


async def interactive_model_selection():
    """Let user select model interactively"""
    
    print("\n🎮 Interactive Model Selection")
    print("=" * 50)
    
    available_models = [
        ("claude:sonnet", "Claude 3.5 Sonnet - Balanced performance"),
        ("claude:opus", "Claude 3 Opus - Most capable"),
        ("claude:haiku", "Claude 3 Haiku - Fastest"),
        ("gemini:gemini-2.0-flash", "Gemini 2.0 Flash - Google's latest")
    ]
    
    print("Available models:")
    for i, (model_id, description) in enumerate(available_models, 1):
        print(f"  {i}. {description}")
    
    try:
        choice = input("\nSelect model (1-4): ").strip()
        if not choice.isdigit() or not (1 <= int(choice) <= len(available_models)):
            print("❌ Invalid choice")
            return
        
        selected_model, description = available_models[int(choice) - 1]
        print(f"\n🎯 Selected: {description}")
        
        query = input("Enter your question: ").strip()
        if not query:
            print("❌ No query provided")
            return
        
        options = UnifiedCliOptions(
            model=selected_model,
            max_turns=5,
            verbose=True
        )
        
        wrapper = UnifiedCliWrapper(options)
        
        if not wrapper.is_available():
            print(f"❌ {description} not available")
            return
        
        print(f"\n🤖 {description} response:")
        print("-" * 40)
        
        response = await wrapper.execute_sync(query)
        print(response)
        
        await wrapper.cleanup()
        
    except KeyboardInterrupt:
        print("\n👋 Cancelled")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    print("🤖 Claude CLI Wrapper - Multi-Model Comparison")
    
    # Run model comparison
    asyncio.run(model_comparison_example())
    
    input("\n⏸️  Press Enter for side-by-side comparison...")
    asyncio.run(side_by_side_comparison())
    
    try:
        choice = input("\n🎮 Try interactive model selection? (y/N): ").strip().lower()
        if choice in ['y', 'yes']:
            asyncio.run(interactive_model_selection())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")