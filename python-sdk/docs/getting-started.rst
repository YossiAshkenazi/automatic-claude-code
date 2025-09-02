Getting Started
===============

Installation
------------

From PyPI (Recommended)
~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   pip install claude-code-sdk

From Source
~~~~~~~~~~~

.. code-block:: bash

   git clone https://github.com/YossiAshkenazi/automatic-claude-code.git
   cd automatic-claude-code/python-sdk
   pip install -e .

Prerequisites
-------------

1. **Claude Code CLI**: The SDK requires Claude Code CLI to be installed:

   .. code-block:: bash

      npm install -g @anthropic-ai/claude-code

2. **Python 3.10+**: The SDK requires Python 3.10 or higher.

3. **Authentication**: Ensure Claude CLI is authenticated:

   .. code-block:: bash

      claude auth login

Quick Verification
------------------

Test your installation:

.. code-block:: python

   from claude_code_sdk import ClaudeCodeSDK

   sdk = ClaudeCodeSDK()
   result = sdk.execute("--version")
   print(f"Claude CLI Version: {result.output}")

If you see version output, you're ready to go!

Basic Usage Patterns
--------------------

Simple Command Execution
~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   from claude_code_sdk import ClaudeCodeSDK

   sdk = ClaudeCodeSDK()
   
   # Execute a simple command
   result = sdk.execute("help")
   
   if result.success:
       print("Output:", result.output)
   else:
       print("Error:", result.error)

Streaming Output
~~~~~~~~~~~~~~~~

.. code-block:: python

   sdk = ClaudeCodeSDK(streaming=True)
   
   def output_handler(line):
       print(f">> {line}")
   
   result = sdk.execute("run 'analyze codebase'", output_callback=output_handler)

Configuration
-------------

SDK Configuration
~~~~~~~~~~~~~~~~~

.. code-block:: python

   sdk = ClaudeCodeSDK(
       claude_executable="claude",  # Custom Claude CLI path
       timeout=300,                 # 5-minute timeout
       streaming=True,              # Enable streaming
       debug=True                   # Enable debug logging
   )

Environment Variables
~~~~~~~~~~~~~~~~~~~~~

* ``CLAUDE_CODE_SDK_DEBUG``: Enable debug logging
* ``CLAUDE_CODE_SDK_TIMEOUT``: Default timeout in seconds
* ``CLAUDE_CODE_SDK_EXECUTABLE``: Path to Claude CLI executable

Next Steps
----------

* Read the :doc:`quickstart` guide for common patterns
* Check out :doc:`examples/index` for real-world usage
* Review the :doc:`api-reference` for detailed API documentation