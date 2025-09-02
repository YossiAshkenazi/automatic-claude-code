#!/usr/bin/env python3
"""
MCP Tool Integration Example - ClaudeSDKClient
=============================================

This example demonstrates integration with Model Context Protocol (MCP) tools,
including file system operations, web browsing, GitHub integration, and 
custom tool development.

Requirements:
    - Python 3.10+
    - Claude Code CLI installed and configured
    - MCP servers configured (github, playwright, etc.)
    - claude-code-sdk package installed

Usage:
    python mcp_tool_integration.py
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
from claude_code_sdk import ClaudeSDKClient
from claude_code_sdk.core.options import create_production_options
from claude_code_sdk.exceptions import ClaudeCodeError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MCPToolResult:
    """Result from an MCP tool operation."""
    tool_name: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    duration: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class MCPToolManager:
    """
    Manager for MCP tool integrations and operations.
    """
    
    def __init__(self):
        self.available_tools: Dict[str, Dict[str, Any]] = {}
        self.tool_results: List[MCPToolResult] = []
        
    async def discover_available_tools(self, client: ClaudeSDKClient) -> Dict[str, List[str]]:
        """
        Discover what MCP tools are available through Claude.
        """
        discovery_prompt = """
        List all available MCP tools and their capabilities. 
        Include file system tools, web browsing tools, GitHub tools, 
        and any other integrated tools.
        
        Format the response as a structured list with tool names and descriptions.
        """
        
        try:
            response = await client.execute(discovery_prompt)
            
            if response.success:
                # Parse response to extract tool information
                # This is a simplified example - actual implementation would parse the response
                tools = {
                    'file_system': ['read_file', 'write_file', 'list_directory', 'create_directory'],
                    'web_browsing': ['navigate', 'screenshot', 'click', 'fill_form', 'extract_text'],
                    'github': ['list_repos', 'create_repo', 'get_file', 'create_pull_request'],
                    'memory': ['create_entities', 'search_nodes', 'add_observations'],
                    'archon': ['create_project', 'list_tasks', 'perform_rag_query']
                }
                
                self.available_tools = tools
                return tools
            else:
                logger.error(f"Failed to discover tools: {response.error}")
                return {}
                
        except Exception as e:
            logger.error(f"Error discovering MCP tools: {e}")
            return {}
            
    def log_tool_result(self, result: MCPToolResult):
        """Log the result of a tool operation."""
        self.tool_results.append(result)
        
        status_icon = "[OK]" if result.success else "[FAIL]"
        duration_str = f" ({result.duration:.1f}s)" if result.duration else ""
        
        print(f"   {status_icon} {result.tool_name}{duration_str}")
        
        if result.error:
            print(f"      Error: {result.error}")
        elif result.result:
            result_preview = str(result.result)[:100] + "..." if len(str(result.result)) > 100 else str(result.result)
            print(f"      Result: {result_preview}")


async def file_system_integration_example():
    """
    Demonstrates file system operations through MCP tools.
    """
    print("🔵 File System Integration Example")
    print("=" * 38)
    
    tool_manager = MCPToolManager()
    options = create_production_options(timeout=60)
    
    try:
        async with ClaudeSDKClient(options) as client:
            
            # File system operations
            file_operations = [
                {
                    'name': 'create_temp_file',
                    'prompt': '''
                    Create a temporary Python file called "temp_example.py" with a simple 
                    "Hello World" function. Use MCP file system tools to create the file.
                    '''
                },
                {
                    'name': 'read_file_content',
                    'prompt': '''
                    Read the content of the temp_example.py file we just created using 
                    MCP file system tools and show me its contents.
                    '''
                },
                {
                    'name': 'modify_file',
                    'prompt': '''
                    Modify the temp_example.py file to add a second function that calculates
                    the fibonacci sequence. Use MCP tools to update the file.
                    '''
                },
                {
                    'name': 'list_directory',
                    'prompt': '''
                    List the contents of the current directory to verify our file operations
                    using MCP directory listing tools.
                    '''
                }
            ]
            
            print("[FILE] Executing file system operations...")
            
            for operation in file_operations:
                print(f"\n[TOOL] {operation['name']}:")
                start_time = time.time()
                
                try:
                    response = await client.execute(operation['prompt'])
                    duration = time.time() - start_time
                    
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=response.success,
                        result=response.result if response.success else None,
                        error=response.error if not response.success else None,
                        duration=duration
                    )
                    
                    tool_manager.log_tool_result(result)
                    
                except Exception as e:
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=False,
                        error=str(e),
                        duration=time.time() - start_time
                    )
                    tool_manager.log_tool_result(result)
                    
    except Exception as e:
        print(f"[FAIL] File system integration error: {e}")
        
    print()


async def web_browsing_integration_example():
    """
    Demonstrates web browsing capabilities through MCP tools.
    """
    print("🔵 Web Browsing Integration Example")
    print("=" * 36)
    
    tool_manager = MCPToolManager()
    options = create_production_options(timeout=90)
    
    try:
        async with ClaudeSDKClient(options) as client:
            
            # Web browsing operations
            web_operations = [
                {
                    'name': 'navigate_to_site',
                    'prompt': '''
                    Navigate to https://example.com using MCP web browsing tools.
                    Take a screenshot of the page.
                    '''
                },
                {
                    'name': 'extract_page_info',
                    'prompt': '''
                    Extract the main heading and first paragraph of text from the current page
                    using MCP web browsing text extraction tools.
                    '''
                },
                {
                    'name': 'search_documentation',
                    'prompt': '''
                    Navigate to https://docs.python.org and search for information about
                    async/await using the site's search functionality through MCP tools.
                    '''
                }
            ]
            
            print("🌐 Executing web browsing operations...")
            
            for operation in web_operations:
                print(f"\n[TOOL] {operation['name']}:")
                start_time = time.time()
                
                try:
                    response = await client.execute(operation['prompt'])
                    duration = time.time() - start_time
                    
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=response.success,
                        result=response.result[:200] + "..." if response.success and len(str(response.result)) > 200 else response.result,
                        error=response.error if not response.success else None,
                        duration=duration
                    )
                    
                    tool_manager.log_tool_result(result)
                    
                except Exception as e:
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=False,
                        error=str(e),
                        duration=time.time() - start_time
                    )
                    tool_manager.log_tool_result(result)
                    
    except Exception as e:
        print(f"[FAIL] Web browsing integration error: {e}")
        
    print()


async def github_integration_example():
    """
    Demonstrates GitHub operations through MCP tools.
    """
    print("🔵 GitHub Integration Example")
    print("=" * 30)
    
    tool_manager = MCPToolManager()
    options = create_production_options(timeout=120)
    
    try:
        async with ClaudeSDKClient(options) as client:
            
            # GitHub operations
            github_operations = [
                {
                    'name': 'list_repositories',
                    'prompt': '''
                    List my GitHub repositories using MCP GitHub tools.
                    Show the name, description, and last updated date for each repo.
                    '''
                },
                {
                    'name': 'search_code',
                    'prompt': '''
                    Search for Python files containing "async def" in my repositories
                    using MCP GitHub code search tools.
                    '''
                },
                {
                    'name': 'get_repository_info',
                    'prompt': '''
                    Get detailed information about one of my repositories including
                    README content, main programming languages, and recent commits
                    using MCP GitHub tools.
                    '''
                },
                {
                    'name': 'create_issue',
                    'prompt': '''
                    Create a test issue in one of my repositories with the title
                    "Example issue from MCP integration" and appropriate description
                    using MCP GitHub tools.
                    '''
                }
            ]
            
            print("🐙 Executing GitHub operations...")
            
            for operation in github_operations:
                print(f"\n[TOOL] {operation['name']}:")
                start_time = time.time()
                
                try:
                    response = await client.execute(operation['prompt'])
                    duration = time.time() - start_time
                    
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=response.success,
                        result=response.result[:300] + "..." if response.success and len(str(response.result)) > 300 else response.result,
                        error=response.error if not response.success else None,
                        duration=duration,
                        metadata={'operation_type': 'github_api'}
                    )
                    
                    tool_manager.log_tool_result(result)
                    
                except Exception as e:
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=False,
                        error=str(e),
                        duration=time.time() - start_time
                    )
                    tool_manager.log_tool_result(result)
                    
    except Exception as e:
        print(f"[FAIL] GitHub integration error: {e}")
        
    print()


async def memory_and_knowledge_integration_example():
    """
    Demonstrates memory system and knowledge base integration.
    """
    print("🔵 Memory and Knowledge Integration Example")
    print("=" * 44)
    
    tool_manager = MCPToolManager()
    options = create_production_options(timeout=90)
    
    try:
        async with ClaudeSDKClient(options) as client:
            
            # Memory and knowledge operations
            knowledge_operations = [
                {
                    'name': 'create_project_entities',
                    'prompt': '''
                    Create memory entities for a new project using MCP memory tools:
                    - Project: "Python SDK Examples"
                    - Technology: "Python 3.10+"
                    - Framework: "asyncio"
                    - Status: "Active Development"
                    
                    Create relationships between these entities.
                    '''
                },
                {
                    'name': 'search_knowledge_base',
                    'prompt': '''
                    Search the Archon knowledge base for information about
                    "Python async programming patterns" using MCP RAG query tools.
                    '''
                },
                {
                    'name': 'find_code_examples',
                    'prompt': '''
                    Find code examples related to "error handling in async Python"
                    using MCP code search tools from the knowledge base.
                    '''
                },
                {
                    'name': 'add_project_observations',
                    'prompt': '''
                    Add observations to our project entities using MCP memory tools:
                    - The Python SDK examples are progressing well
                    - Async patterns are being implemented correctly
                    - Error handling has been thoroughly tested
                    '''
                }
            ]
            
            print("🧠 Executing memory and knowledge operations...")
            
            for operation in knowledge_operations:
                print(f"\n[TOOL] {operation['name']}:")
                start_time = time.time()
                
                try:
                    response = await client.execute(operation['prompt'])
                    duration = time.time() - start_time
                    
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=response.success,
                        result=response.result[:250] + "..." if response.success and len(str(response.result)) > 250 else response.result,
                        error=response.error if not response.success else None,
                        duration=duration,
                        metadata={'operation_type': 'knowledge_management'}
                    )
                    
                    tool_manager.log_tool_result(result)
                    
                except Exception as e:
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=False,
                        error=str(e),
                        duration=time.time() - start_time
                    )
                    tool_manager.log_tool_result(result)
                    
    except Exception as e:
        print(f"[FAIL] Memory and knowledge integration error: {e}")
        
    print()


async def archon_integration_example():
    """
    Demonstrates Archon MCP server integration for project management.
    """
    print("🔵 Archon Integration Example")
    print("=" * 30)
    
    tool_manager = MCPToolManager()
    options = create_production_options(timeout=120)
    
    try:
        async with ClaudeSDKClient(options) as client:
            
            # Archon project management operations
            archon_operations = [
                {
                    'name': 'list_projects',
                    'prompt': '''
                    List all projects in the Archon system using MCP Archon tools.
                    Show project titles, descriptions, and current status.
                    '''
                },
                {
                    'name': 'create_new_task',
                    'prompt': '''
                    Create a new task in the Archon system using MCP tools:
                    - Title: "Implement MCP tool integration examples"
                    - Description: "Create comprehensive examples showing MCP tool usage"
                    - Assignee: "AI IDE Agent"
                    - Priority: "High"
                    '''
                },
                {
                    'name': 'search_documentation',
                    'prompt': '''
                    Search the Archon knowledge base for documentation about
                    "MCP server integration patterns" using RAG query tools.
                    '''
                },
                {
                    'name': 'update_task_status',
                    'prompt': '''
                    Find the task we just created and update its status to "doing"
                    using Archon MCP task management tools.
                    '''
                }
            ]
            
            print("🏛️ Executing Archon operations...")
            
            for operation in archon_operations:
                print(f"\n[TOOL] {operation['name']}:")
                start_time = time.time()
                
                try:
                    response = await client.execute(operation['prompt'])
                    duration = time.time() - start_time
                    
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=response.success,
                        result=response.result[:200] + "..." if response.success and len(str(response.result)) > 200 else response.result,
                        error=response.error if not response.success else None,
                        duration=duration,
                        metadata={'operation_type': 'project_management'}
                    )
                    
                    tool_manager.log_tool_result(result)
                    
                except Exception as e:
                    result = MCPToolResult(
                        tool_name=operation['name'],
                        success=False,
                        error=str(e),
                        duration=time.time() - start_time
                    )
                    tool_manager.log_tool_result(result)
                    
    except Exception as e:
        print(f"[FAIL] Archon integration error: {e}")
        
    print()


async def complex_workflow_integration_example():
    """
    Demonstrates a complex workflow using multiple MCP tools together.
    """
    print("🔵 Complex Workflow Integration Example")
    print("=" * 39)
    
    tool_manager = MCPToolManager()
    options = create_production_options(timeout=180)
    
    try:
        async with ClaudeSDKClient(options) as client:
            
            workflow_prompt = '''
            Execute a complex workflow using multiple MCP tools:
            
            1. Create a new project in Archon called "MCP Integration Demo"
            2. Create a Python file called "demo_project.py" with a simple web scraper
            3. Use web browsing tools to visit a website and extract some information
            4. Store the extracted information in the Python file
            5. Create a GitHub repository for this demo project
            6. Create a task in Archon to track the completion of this workflow
            7. Add observations to memory about this successful integration
            
            Use the appropriate MCP tools for each step and provide detailed feedback
            about what tools were used and their results.
            '''
            
            print("[RETRY] Executing complex multi-tool workflow...")
            start_time = time.time()
            
            try:
                response = await client.execute(workflow_prompt)
                duration = time.time() - start_time
                
                result = MCPToolResult(
                    tool_name="complex_workflow",
                    success=response.success,
                    result=response.result if response.success else None,
                    error=response.error if not response.success else None,
                    duration=duration,
                    metadata={
                        'operation_type': 'complex_workflow',
                        'tools_involved': ['archon', 'file_system', 'web_browsing', 'github', 'memory']
                    }
                )
                
                tool_manager.log_tool_result(result)
                
                if result.success:
                    print(f"\n[OK] Complex workflow completed successfully in {duration:.1f}s")
                    print(f"   Multiple MCP tools coordinated seamlessly")
                else:
                    print(f"\n[FAIL] Complex workflow failed after {duration:.1f}s")
                    print(f"   Error: {result.error}")
                    
            except Exception as e:
                result = MCPToolResult(
                    tool_name="complex_workflow",
                    success=False,
                    error=str(e),
                    duration=time.time() - start_time
                )
                tool_manager.log_tool_result(result)
                
    except Exception as e:
        print(f"[FAIL] Complex workflow error: {e}")
        
    print()


async def generate_mcp_integration_report(tool_manager: MCPToolManager):
    """
    Generate a comprehensive report of MCP tool integration results.
    """
    print("🔵 MCP Integration Report")
    print("=" * 26)
    
    if not tool_manager.tool_results:
        print("No tool results to analyze.")
        return
        
    # Analyze results
    successful_operations = [r for r in tool_manager.tool_results if r.success]
    failed_operations = [r for r in tool_manager.tool_results if not r.success]
    
    total_duration = sum(r.duration or 0 for r in tool_manager.tool_results if r.duration)
    avg_duration = total_duration / len(tool_manager.tool_results) if tool_manager.tool_results else 0
    
    # Group by operation type
    operation_types = {}
    for result in tool_manager.tool_results:
        op_type = result.metadata.get('operation_type', 'general') if result.metadata else 'general'
        if op_type not in operation_types:
            operation_types[op_type] = []
        operation_types[op_type].append(result)
    
    print(f"[STATS] Overall Statistics:")
    print(f"   Total operations: {len(tool_manager.tool_results)}")
    print(f"   Successful: {len(successful_operations)} ({len(successful_operations)/len(tool_manager.tool_results)*100:.1f}%)")
    print(f"   Failed: {len(failed_operations)}")
    print(f"   Total duration: {total_duration:.1f}s")
    print(f"   Average duration: {avg_duration:.1f}s per operation")
    
    print(f"\n📋 Operations by Type:")
    for op_type, results in operation_types.items():
        successful = len([r for r in results if r.success])
        total = len(results)
        print(f"   {op_type}: {successful}/{total} successful")
        
    print(f"\n🛠️ Tool Performance:")
    tool_performance = {}
    for result in tool_manager.tool_results:
        if result.tool_name not in tool_performance:
            tool_performance[result.tool_name] = {'success': 0, 'total': 0, 'total_time': 0}
        
        tool_performance[result.tool_name]['total'] += 1
        if result.success:
            tool_performance[result.tool_name]['success'] += 1
        if result.duration:
            tool_performance[result.tool_name]['total_time'] += result.duration
    
    for tool, stats in tool_performance.items():
        success_rate = stats['success'] / stats['total'] * 100 if stats['total'] > 0 else 0
        avg_time = stats['total_time'] / stats['total'] if stats['total'] > 0 else 0
        print(f"   {tool}: {success_rate:.1f}% success rate, {avg_time:.1f}s avg")
        
    if failed_operations:
        print(f"\n[FAIL] Failed Operations:")
        for result in failed_operations:
            print(f"   {result.tool_name}: {result.error}")
            
    print(f"\n[RESULT] Integration Assessment:")
    overall_success_rate = len(successful_operations) / len(tool_manager.tool_results) * 100
    
    if overall_success_rate >= 90:
        assessment = "Excellent - MCP integration is working very well"
    elif overall_success_rate >= 75:
        assessment = "Good - MCP integration is mostly functional with minor issues"
    elif overall_success_rate >= 50:
        assessment = "Fair - MCP integration has some significant issues to address"
    else:
        assessment = "Poor - MCP integration needs substantial debugging"
        
    print(f"   {assessment}")
    print(f"   Recommendation: {'Continue with current setup' if overall_success_rate >= 75 else 'Review MCP server configurations'}")


async def main():
    """
    Main function demonstrating all MCP tool integration patterns.
    """
    print("[START] Claude SDK Client - MCP Tool Integration Examples")
    print("=" * 55)
    print()
    
    tool_manager = MCPToolManager()
    
    print("ℹ️  Prerequisites:")
    print("   - Claude Code CLI with MCP servers configured")
    print("   - GitHub MCP server (for GitHub operations)")
    print("   - Playwright MCP server (for web browsing)")
    print("   - Memory MCP server (for knowledge management)")
    print("   - Archon MCP server (for project management)")
    print()
    
    # Run all integration examples
    await file_system_integration_example()
    await web_browsing_integration_example() 
    await github_integration_example()
    await memory_and_knowledge_integration_example()
    await archon_integration_example()
    await complex_workflow_integration_example()
    
    # Generate comprehensive report
    await generate_mcp_integration_report(tool_manager)
    
    print("\n[OK] All MCP tool integration examples completed!")
    print()
    print("MCP integration capabilities demonstrated:")
    print("- File system operations (read, write, directory management)")
    print("- Web browsing and data extraction")
    print("- GitHub API integration and repository management")
    print("- Memory system and knowledge base operations")
    print("- Archon project management integration")
    print("- Complex multi-tool workflows")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 MCP integration examples interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error running MCP integration examples: {e}")
        logger.exception("Error running MCP tool integration examples")