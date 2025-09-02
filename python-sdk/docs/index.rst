Claude Code SDK Documentation
==============================

Welcome to the official Python SDK for Claude Code CLI with dual-agent support.

.. toctree::
   :maxdepth: 2
   :caption: Contents:

   getting-started
   quickstart
   api-reference
   examples/index
   architecture
   troubleshooting
   changelog
   migration

Quick Start
-----------

Install the SDK:

.. code-block:: bash

   pip install claude-code-sdk

Basic usage:

.. code-block:: python

   from claude_code_sdk import ClaudeCodeSDK

   # Initialize SDK
   sdk = ClaudeCodeSDK()

   # Execute a command
   result = sdk.execute("help")
   print(result.output)

Features
--------

* **Zero Dependencies**: Uses only Python standard library
* **Dual-Agent Support**: Manager-Worker architecture for complex tasks
* **Streaming Output**: Real-time command output streaming
* **Cross-Platform**: Windows, macOS, and Linux support
* **Type-Safe**: Full type hints and mypy compatibility
* **Async Support**: Both sync and async APIs

GitHub Integration
------------------

* **Repository**: `automatic-claude-code <https://github.com/YossiAshkenazi/automatic-claude-code>`_
* **Issues**: `Bug Reports <https://github.com/YossiAshkenazi/automatic-claude-code/issues>`_
* **License**: MIT

Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`