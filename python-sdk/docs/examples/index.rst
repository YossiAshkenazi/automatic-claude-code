Examples
========

This section provides comprehensive examples of using the Claude Code SDK in various scenarios.

.. toctree::
   :maxdepth: 2

   basic-usage
   streaming
   async-operations
   error-handling
   ci-cd-integration
   development-automation

Quick Examples
--------------

Basic Command Execution
~~~~~~~~~~~~~~~~~~~~~~~

.. literalinclude:: ../../examples/basic_usage.py
   :language: python
   :caption: Basic usage example

Real-time Streaming
~~~~~~~~~~~~~~~~~~~

.. literalinclude:: ../../examples/streaming_example.py
   :language: python
   :caption: Streaming output example

Async Operations
~~~~~~~~~~~~~~~~

.. literalinclude:: ../../examples/async_example.py
   :language: python
   :caption: Asynchronous execution example

Error Handling
~~~~~~~~~~~~~~

.. literalinclude:: ../../examples/error_handling.py
   :language: python
   :caption: Robust error handling

Common Patterns
---------------

File Operations
~~~~~~~~~~~~~~~

.. code-block:: python

   from claude_code_sdk import ClaudeCodeSDK

   sdk = ClaudeCodeSDK()

   # Create a new Python module
   result = sdk.execute("run 'create a utils.py module with helper functions'")
   
   # Refactor existing code
   result = sdk.execute("run 'refactor main.py to use classes instead of functions'")

Code Analysis
~~~~~~~~~~~~~

.. code-block:: python

   # Analyze code quality
   result = sdk.execute("run 'analyze this codebase for potential improvements'")
   
   # Generate documentation
   result = sdk.execute("run 'add docstrings to all functions in src/ directory'")

Testing Integration
~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   # Generate tests
   result = sdk.execute("run 'create comprehensive tests for the auth module'")
   
   # Run test suite
   result = sdk.execute("run 'run all tests and generate coverage report'")

Advanced Use Cases
------------------

Development Workflow Automation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. literalinclude:: ../../examples/dev_workflow.py
   :language: python
   :caption: Complete development workflow automation

CI/CD Pipeline Integration
~~~~~~~~~~~~~~~~~~~~~~~~~~

.. literalinclude:: ../../examples/ci_cd_pipeline.py
   :language: python
   :caption: CI/CD pipeline integration

Code Review Automation
~~~~~~~~~~~~~~~~~~~~~~~

.. literalinclude:: ../../examples/code_review.py
   :language: python
   :caption: Automated code review system

Performance Examples
--------------------

Batch Operations
~~~~~~~~~~~~~~~~

.. code-block:: python

   import asyncio
   from claude_code_sdk import AsyncClaudeCodeSDK

   async def process_files(file_list):
       sdk = AsyncClaudeCodeSDK()
       
       tasks = [
           sdk.execute(f"run 'optimize {file} for performance'")
           for file in file_list
       ]
       
       results = await asyncio.gather(*tasks)
       return results

Concurrent Analysis
~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   async def analyze_codebase():
       sdk = AsyncClaudeCodeSDK()
       
       analysis_tasks = [
           sdk.execute("run 'analyze security vulnerabilities'"),
           sdk.execute("run 'check code style and formatting'"),
           sdk.execute("run 'identify performance bottlenecks'"),
           sdk.execute("run 'generate test coverage report'")
       ]
       
       results = await asyncio.gather(*analysis_tasks)
       return results

Integration Examples
--------------------

Flask Web Application
~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   from flask import Flask, request, jsonify
   from claude_code_sdk import ClaudeCodeSDK

   app = Flask(__name__)
   sdk = ClaudeCodeSDK()

   @app.route('/analyze', methods=['POST'])
   def analyze_code():
       code = request.json.get('code')
       
       # Save code to temporary file and analyze
       result = sdk.execute(f"run 'analyze this code: {code}'")
       
       return jsonify({
           'success': result.success,
           'analysis': result.output,
           'suggestions': result.metadata.get('suggestions', [])
       })

Discord Bot Integration
~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   import discord
   from claude_code_sdk import ClaudeCodeSDK

   class CodeBot(discord.Client):
       def __init__(self):
           super().__init__()
           self.sdk = ClaudeCodeSDK()

       async def on_message(self, message):
           if message.content.startswith('!analyze'):
               code_snippet = message.content[9:]  # Remove '!analyze '
               
               result = self.sdk.execute(f"run 'review this code: {code_snippet}'")
               
               await message.channel.send(f"Code Analysis: {result.output[:2000]}")

Testing Examples
----------------

Unit Test Integration
~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   import unittest
   from claude_code_sdk import ClaudeCodeSDK

   class TestSDKIntegration(unittest.TestCase):
       def setUp(self):
           self.sdk = ClaudeCodeSDK()

       def test_code_generation(self):
           result = self.sdk.execute("run 'create a simple calculator function'")
           self.assertTrue(result.success)
           self.assertIn('def', result.output)

       def test_error_handling(self):
           result = self.sdk.execute("invalid command that should fail")
           self.assertFalse(result.success)
           self.assertIsNotNone(result.error)

Pytest Integration
~~~~~~~~~~~~~~~~~~

.. code-block:: python

   import pytest
   from claude_code_sdk import ClaudeCodeSDK

   @pytest.fixture
   def sdk():
       return ClaudeCodeSDK()

   def test_file_creation(sdk):
       result = sdk.execute("run 'create a hello world script'")
       assert result.success
       assert 'hello' in result.output.lower()

   @pytest.mark.asyncio
   async def test_async_operations():
       from claude_code_sdk import AsyncClaudeCodeSDK
       
       sdk = AsyncClaudeCodeSDK()
       result = await sdk.execute("run 'create a simple API endpoint'")
       assert result.success