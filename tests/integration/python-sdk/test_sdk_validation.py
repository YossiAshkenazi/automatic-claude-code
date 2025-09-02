#!/usr/bin/env python3
"""
Comprehensive Test Validation for Claude Code SDK
Tests functionality without requiring actual Claude API calls
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import subprocess
import time
from datetime import datetime
from typing import List, Dict, Any

# Import SDK components
from claude_code_sdk.client import ClaudeCodeClient
from claude_code_sdk.session import ClaudeSession, ClaudeSessionOptions, ClaudeMessage
from claude_code_sdk.exceptions import (
    ClaudeCodeError, ClaudeTimeoutError, ClaudeAuthError, ClaudeNotFoundError
)

class TestClaudeCodeClient(unittest.TestCase):
    """Unit tests for ClaudeCodeClient"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.options = ClaudeSessionOptions(
            model='sonnet',
            timeout=30,
            verbose=True
        )
    
    @patch('shutil.which')
    def test_client_initialization(self, mock_which):
        """Test client initialization with CLI detection"""
        mock_which.return_value = '/usr/local/bin/claude'
        
        client = ClaudeCodeClient(self.options)
        
        self.assertEqual(client.options.model, 'sonnet')
        self.assertEqual(client.options.timeout, 30)
        self.assertTrue(client.options.verbose)
    
    @patch('shutil.which')
    def test_claude_cli_not_found(self, mock_which):
        """Test error handling when Claude CLI not found"""
        mock_which.return_value = None
        
        with self.assertRaises(ClaudeNotFoundError) as context:
            ClaudeCodeClient()
        
        self.assertIn('Claude CLI not found', str(context.exception))
    
    @patch('shutil.which')
    @patch('subprocess.Popen')
    def test_basic_task_execution(self, mock_popen, mock_which):
        """Test basic task execution flow"""
        # Setup mocks
        mock_which.return_value = '/usr/local/bin/claude'
        mock_process = Mock()
        mock_process.returncode = 0
        mock_process.communicate.return_value = ('Task completed successfully', '')
        mock_popen.return_value = mock_process
        
        client = ClaudeCodeClient(self.options)
        result = client.execute('Create a simple Python script')
        
        # Verify execution
        self.assertTrue(result.success)
        self.assertEqual(result.total_turns, 1)
        self.assertIn('Task completed', result.final_message)
    
    @patch('shutil.which')
    @patch('subprocess.Popen')
    def test_authentication_error_handling(self, mock_popen, mock_which):
        """Test authentication error handling"""
        mock_which.return_value = '/usr/local/bin/claude'
        mock_process = Mock()
        mock_process.returncode = 1
        mock_process.communicate.return_value = ('', 'Authentication failed: API key required')
        mock_popen.return_value = mock_process
        
        client = ClaudeCodeClient(self.options)
        
        # SDK wraps auth errors in ClaudeCodeError, so check for both
        with self.assertRaises((ClaudeAuthError, ClaudeCodeError)) as context:
            client.execute('Test prompt')
        
        error_str = str(context.exception)
        self.assertTrue('API key' in error_str or 'Authentication' in error_str)
    
    @patch('shutil.which')
    @patch('subprocess.Popen')
    def test_timeout_handling(self, mock_popen, mock_which):
        """Test timeout error handling"""
        mock_which.return_value = '/usr/local/bin/claude'
        mock_process = Mock()
        mock_process.communicate.side_effect = subprocess.TimeoutExpired('claude', 30)
        mock_popen.return_value = mock_process
        
        client = ClaudeCodeClient(self.options)
        
        # SDK wraps timeout errors in ClaudeCodeError, so check for both
        with self.assertRaises((ClaudeTimeoutError, ClaudeCodeError)) as context:
            client.execute('Long running task')
        
        self.assertIn('timed out', str(context.exception))

class TestStreamingOutput(unittest.TestCase):
    """Test real-time output streaming simulation"""
    
    def setUp(self):
        self.streaming_messages = []
        self.progress_updates = []
    
    def message_handler(self, message: ClaudeMessage):
        """Handler for streaming messages"""
        self.streaming_messages.append(message)
    
    def progress_handler(self, progress: str):
        """Handler for progress updates"""
        self.progress_updates.append(progress)
    
    @patch('shutil.which')
    @patch('subprocess.Popen')
    def test_streaming_simulation(self, mock_popen, mock_which):
        """Test streaming output simulation"""
        mock_which.return_value = '/usr/local/bin/claude'
        
        # Mock streaming process
        mock_process = Mock()
        mock_process.returncode = 0
        mock_process.stdin = Mock()
        mock_process.stdout = Mock()
        mock_process.stdout.readline.side_effect = [
            'Tool: Reading files\n',
            'Processing data...\n',
            'Writing output\n',
            ''  # End of stream
        ]
        mock_popen.return_value = mock_process
        
        client = ClaudeCodeClient()
        
        # Test streaming execution
        result = client.execute(
            'Process some files',
            stream=True,
            on_message=self.message_handler,
            on_progress=self.progress_handler
        )
        
        # Verify streaming behavior
        self.assertEqual(len(self.progress_updates), 3)
        self.assertEqual(len(self.streaming_messages), 3)
        self.assertEqual(self.streaming_messages[0].type, 'tool_use')

class TestSessionManagement(unittest.TestCase):
    """Test session management functionality"""
    
    def test_session_creation(self):
        """Test session creation and message handling"""
        session = ClaudeSession(ClaudeSessionOptions())
        
        # Add messages
        session.add_user_message('Hello Claude')
        session.add_assistant_message('Hello! How can I help?')
        session.add_tool_use('file_read', {'path': 'test.py'})
        
        # Verify session state
        self.assertEqual(len(session.messages), 3)
        self.assertEqual(session.messages[0].type, 'user')
        self.assertEqual(session.messages[1].type, 'assistant')
        self.assertEqual(session.messages[2].type, 'tool_use')
    
    def test_session_execution_result(self):
        """Test session execution result generation"""
        session = ClaudeSession()
        session.add_user_message('Test prompt')
        session.add_assistant_message('Test response')
        
        result = session.execute()
        
        self.assertTrue(result.success)
        self.assertEqual(result.total_turns, 1)
        self.assertEqual(result.final_message, 'Test response')
        self.assertIsInstance(result.execution_time, float)

class TestIntegrationScenarios(unittest.TestCase):
    """Integration test structure for complete workflows"""
    
    @patch('shutil.which')
    @patch('subprocess.Popen')
    def test_multi_turn_conversation(self, mock_popen, mock_which):
        """Test multi-turn conversation flow"""
        mock_which.return_value = '/usr/local/bin/claude'
        
        # Mock sequential responses
        responses = [
            ('I\'ll help you create a script', ''),
            ('Here\'s the Python code', ''),
            ('Script is ready for testing', '')
        ]
        
        mock_processes = []
        for response in responses:
            mock_process = Mock()
            mock_process.returncode = 0
            mock_process.communicate.return_value = response
            mock_processes.append(mock_process)
        
        mock_popen.side_effect = mock_processes
        
        client = ClaudeCodeClient()
        session = client.create_session()
        
        prompts = [
            'Create a Python script',
            'Add error handling',
            'Make it production ready'
        ]
        
        result = client.execute_session(session, prompts)
        
        self.assertTrue(result.success)
        self.assertEqual(result.total_turns, 3)
    
    @patch('shutil.which')
    def test_process_management(self, mock_which):
        """Test active process management"""
        mock_which.return_value = '/usr/local/bin/claude'
        
        client = ClaudeCodeClient()
        
        # Initially no active processes
        self.assertEqual(len(client.get_active_processes()), 0)
        
        # Test cleanup
        client.kill_all_processes()
        self.assertEqual(len(client.active_processes), 0)

class TestErrorHandling(unittest.TestCase):
    """Test comprehensive error handling scenarios"""
    
    @patch('shutil.which')
    @patch('subprocess.Popen')
    def test_various_error_conditions(self, mock_popen, mock_which):
        """Test different error conditions"""
        mock_which.return_value = '/usr/local/bin/claude'
        client = ClaudeCodeClient()
        
        # Test file not found
        mock_popen.side_effect = FileNotFoundError('Command not found')
        with self.assertRaises(ClaudeNotFoundError):
            client.execute('Test')
        
        # Test generic execution error
        mock_process = Mock()
        mock_process.returncode = 1
        mock_process.communicate.return_value = ('', 'Unknown error occurred')
        mock_popen.side_effect = None
        mock_popen.return_value = mock_process
        
        with self.assertRaises(ClaudeCodeError) as context:
            client.execute('Test')
        
        self.assertIn('exited with code 1', str(context.exception))

class TestPerformanceScenarios(unittest.TestCase):
    """Test performance-related scenarios"""
    
    def test_message_parsing_performance(self):
        """Test message parsing efficiency"""
        client = ClaudeCodeClient()
        
        # Test large number of messages
        test_lines = [
            'Tool: file_read',
            'Processing file 1',
            'Error: File not found',
            'Regular output line',
        ] * 100
        
        start_time = time.time()
        parsed_messages = []
        
        for line in test_lines:
            message = client._parse_streaming_line(line)
            if message:
                parsed_messages.append(message)
        
        execution_time = time.time() - start_time
        
        # Should parse efficiently
        self.assertLess(execution_time, 1.0)  # Less than 1 second
        self.assertGreater(len(parsed_messages), 200)  # Should parse most lines

def run_validation_suite():
    """Run the complete validation suite"""
    print("Claude Code SDK Validation Suite")
    print("=" * 40)
    
    # Create test suite
    suite = unittest.TestSuite()
    
    # Add test cases
    test_classes = [
        TestClaudeCodeClient,
        TestStreamingOutput, 
        TestSessionManagement,
        TestIntegrationScenarios,
        TestErrorHandling,
        TestPerformanceScenarios
    ]
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        suite.addTests(tests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\nValidation Results:")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    
    return result.wasSuccessful()

if __name__ == '__main__':
    success = run_validation_suite()
    exit(0 if success else 1)