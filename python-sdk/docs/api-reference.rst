API Reference
=============

This section contains the complete API reference for the Claude Code SDK.

Overview
--------

The Claude Code SDK provides a comprehensive Python interface to the Claude Code CLI. The main entry points are:

- **High-level functions**: ``query()``, ``query_stream()``, ``conversation()``
- **Client classes**: ``ClaudeCodeClient``, ``ClaudeSDKClient`` 
- **Message types**: ``ResultMessage``, ``ErrorMessage``, ``ToolUseMessage``
- **Exception handling**: ``ClaudeCodeError`` and subclasses

Quick Reference
---------------

.. code-block:: python

   from claude_code_sdk import query, ClaudeCodeClient, ClaudeCodeError
   
   # Simple async query
   async for message in query("Create a Python function"):
       print(message.result)
   
   # Client-based approach
   async with ClaudeCodeClient() as client:
       async for message in client.query("Complex task"):
           if isinstance(message, ResultMessage):
               print(message.result)

Core Module
-----------

.. automodule:: claude_code_sdk
   :members: query, query_stream, conversation, quick_query, quick_check
   :show-inheritance:

Client Classes
--------------

.. automodule:: claude_code_sdk.core.client
   :members:
   :undoc-members:
   :show-inheritance:

Options and Configuration
-------------------------

.. automodule:: claude_code_sdk.core.options
   :members:
   :undoc-members:
   :show-inheritance:

Message Types
-------------

.. automodule:: claude_code_sdk.core.messages
   :members:
   :undoc-members:
   :show-inheritance:

Query Interface
---------------

.. automodule:: claude_code_sdk.interfaces.query
   :members:
   :undoc-members:
   :show-inheritance:

Streaming Interface
-------------------

.. automodule:: claude_code_sdk.interfaces.streaming
   :members:
   :undoc-members:
   :show-inheritance:

Exception Classes
-----------------

.. automodule:: claude_code_sdk.exceptions
   :members:
   :undoc-members:
   :show-inheritance:

Error Classification
~~~~~~~~~~~~~~~~~~~~

.. autofunction:: claude_code_sdk.exceptions.classify_error

.. autofunction:: claude_code_sdk.exceptions.is_recoverable_error

Integrations
------------

Automatic Claude Integration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. automodule:: claude_code_sdk.integrations.automatic_claude
   :members:
   :undoc-members:
   :show-inheritance:

Monitoring Integration
~~~~~~~~~~~~~~~~~~~~~~

.. automodule:: claude_code_sdk.integrations.monitoring
   :members:
   :undoc-members:
   :show-inheritance:

Utilities
---------

CLI Detection
~~~~~~~~~~~~~

.. automodule:: claude_code_sdk.utils.cli_detector
   :members:
   :undoc-members:
   :show-inheritance:

Process Management
~~~~~~~~~~~~~~~~~~

.. automodule:: claude_code_sdk.utils.process_manager
   :members:
   :undoc-members:
   :show-inheritance:

Version Information
-------------------

.. autofunction:: claude_code_sdk.get_sdk_info

.. autofunction:: claude_code_sdk.get_version_info

.. autofunction:: claude_code_sdk.check_version_compatibility

Constants and Metadata
----------------------

.. autodata:: claude_code_sdk.__version__
   :annotation: = "0.1.0"

.. autodata:: claude_code_sdk.SDK_INFO
   :annotation: = {...}