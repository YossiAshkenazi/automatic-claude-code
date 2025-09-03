  import asyncio
  from claude_cli_wrapper import ClaudeCliWrapper

  async def test_different_tools():
      wrapper = ClaudeCliWrapper()

      # Test cases that previously failed
      tests = [
          "Create a file called test.txt with 'Hello World'",
          "Read the contents of test.txt",
          "List the files in current directory",
          "What is 5 + 7?"
      ]

      for i, test in enumerate(tests, 1):
          print(f"\n--- Test {i}: {test} ---")
          try:
              result = await wrapper.execute_sync(test)
              print(f"? SUCCESS: {len(result)} characters received")
              print(f"Preview: {result[:100]}...")
          except Exception as e:
              print(f"? FAILED: {e}")

      await wrapper.cleanup()

  if __name__ == "__main__":
      asyncio.run(test_different_tools())
