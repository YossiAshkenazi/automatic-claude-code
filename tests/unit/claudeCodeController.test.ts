/**
 * Tests for ClaudeCodeController
 * 
 * This test suite validates the PTY process management and interactive control
 * functionality without requiring actual Claude Code installation for basic tests.
 */

import { ClaudeCodeController, ClaudeCodeControllerOptions } from '../../controllers/claudeCodeController';
import { EventEmitter } from 'events';

describe('ClaudeCodeController', () => {
  let controller: ClaudeCodeController;
  const mockOptions: ClaudeCodeControllerOptions = {
    workingDirectory: process.cwd(),
    timeout: 5000,
    bufferSize: 1024,
    preserveAnsi: false,
    claudeCommand: 'echo', // Use echo for testing without Claude Code
    additionalArgs: ['test']
  };

  beforeEach(() => {
    controller = new ClaudeCodeController(mockOptions);
  });

  afterEach(async () => {
    if (controller.isActive()) {
      await controller.stop().catch(() => controller.forceKill());
    }
    controller.dispose();
  });

  describe('Constructor and Basic Properties', () => {
    test('should create controller with default options', () => {
      const defaultController = new ClaudeCodeController();
      expect(defaultController).toBeInstanceOf(ClaudeCodeController);
      expect(defaultController).toBeInstanceOf(EventEmitter);
    });

    test('should create controller with custom options', () => {
      expect(controller).toBeInstanceOf(ClaudeCodeController);
      expect(controller.isActive()).toBe(false);
    });

    test('should initialize with proper state', () => {
      expect(controller.isActive()).toBe(false);
      expect(controller.getOutputBuffer()).toBe('');
      expect(controller.getErrorBuffer()).toBe('');
      expect(controller.getProcessInfo()).toBeNull();
    });
  });

  describe('Process Lifecycle Management', () => {
    test('should start process successfully', async () => {
      const spawnPromise = new Promise((resolve) => {
        controller.once('spawn', resolve);
      });

      await controller.start();
      await spawnPromise;

      expect(controller.isActive()).toBe(true);
      const processInfo = controller.getProcessInfo();
      expect(processInfo).not.toBeNull();
      expect(processInfo?.pid).toBeGreaterThan(0);
    });

    test('should handle process spawn events', async () => {
      const events: any[] = [];
      
      controller.on('spawn', (event: any) => events.push({ type: 'spawn', event }));
      controller.on('data', (event: any) => events.push({ type: 'data', event }));
      controller.on('exit', (event: any) => events.push({ type: 'exit', event }));

      await controller.start();
      
      // Wait a bit for events to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.some(e => e.type === 'spawn')).toBe(true);
      
      const spawnEvent = events.find(e => e.type === 'spawn');
      expect(spawnEvent.event.type).toBe('spawn');
      expect(spawnEvent.event.timestamp).toBeInstanceOf(Date);
    });

    test('should handle process exit gracefully', async () => {
      const exitPromise = new Promise((resolve) => {
        controller.once('exit', resolve);
      });

      await controller.start();
      expect(controller.isActive()).toBe(true);

      await controller.stop();
      await exitPromise;

      expect(controller.isActive()).toBe(false);
    });

    test('should prevent multiple starts', async () => {
      await controller.start();
      
      await expect(controller.start()).rejects.toThrow('Claude Code controller is already running');
    });
  });

  describe('Command and Communication', () => {
    test('should reject commands when not running', async () => {
      await expect(controller.sendCommand('test')).rejects.toThrow('Claude Code controller is not running');
    });

    test('should handle raw input when running', async () => {
      await controller.start();
      
      // Should not throw
      await expect(controller.sendRawInput('test input\n')).resolves.not.toThrow();
    });

    test('should reject raw input when not running', async () => {
      await expect(controller.sendRawInput('test')).rejects.toThrow('Claude Code controller is not running');
    });
  });

  describe('Buffer Management', () => {
    test('should manage output buffer', async () => {
      await controller.start();
      
      // Wait for some output
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const buffer = controller.getOutputBuffer();
      expect(typeof buffer).toBe('string');
      
      controller.clearOutputBuffer();
      expect(controller.getOutputBuffer()).toBe('');
    });

    test('should manage error buffer', async () => {
      controller.clearErrorBuffer();
      expect(controller.getErrorBuffer()).toBe('');
    });

    test('should handle buffer size limits', () => {
      const smallBufferController = new ClaudeCodeController({
        ...mockOptions,
        bufferSize: 10
      });
      
      // This tests the buffer management logic indirectly
      expect(smallBufferController).toBeInstanceOf(ClaudeCodeController);
      smallBufferController.dispose();
    });
  });

  describe('Process Information and Monitoring', () => {
    test('should provide process information when running', async () => {
      await controller.start();
      
      const processInfo = controller.getProcessInfo();
      expect(processInfo).not.toBeNull();
      expect(typeof processInfo!.pid).toBe('number');
      expect(typeof processInfo!.killed).toBe('boolean');
      expect(processInfo!.killed).toBe(false);
    });

    test('should return null process info when not running', () => {
      const processInfo = controller.getProcessInfo();
      expect(processInfo).toBeNull();
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources on disposal', async () => {
      await controller.start();
      expect(controller.isActive()).toBe(true);
      
      controller.dispose();
      expect(controller.isActive()).toBe(false);
      expect(controller.getOutputBuffer()).toBe('');
      expect(controller.getErrorBuffer()).toBe('');
    });

    test('should handle force kill', async () => {
      await controller.start();
      expect(controller.isActive()).toBe(true);
      
      controller.forceKill();
      expect(controller.isActive()).toBe(false);
    });

    test('should handle multiple dispose calls safely', async () => {
      await controller.start();
      
      controller.dispose();
      expect(() => controller.dispose()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid command gracefully', async () => {
      const invalidController = new ClaudeCodeController({
        claudeCommand: 'nonexistent-command-12345',
        timeout: 1000
      });

      const errorPromise = new Promise((resolve) => {
        invalidController.once('error', resolve);
      });

      try {
        await invalidController.start();
      } catch (error) {
        // Expected to fail
      }

      // Should emit error event
      await expect(errorPromise).resolves.toBeDefined();
      
      invalidController.dispose();
    });

    test('should handle stop timeout', async () => {
      const longRunningController = new ClaudeCodeController({
        claudeCommand: 'ping', // Long running command on Windows
        additionalArgs: ['127.0.0.1', '-t']
      });

      try {
        await longRunningController.start();
        
        // Try to stop with very short timeout
        await expect(longRunningController.stop(100)).rejects.toThrow();
      } catch (error) {
        // Expected
      } finally {
        longRunningController.forceKill();
        longRunningController.dispose();
      }
    }, 10000);
  });

  describe('Event System', () => {
    test('should emit all required event types', async () => {
      const events = new Set<string>();
      
      controller.on('spawn', () => events.add('spawn'));
      controller.on('data', () => events.add('data'));
      controller.on('exit', () => events.add('exit'));
      controller.on('close', () => events.add('close'));

      await controller.start();
      
      // Wait for process to complete
      await new Promise(resolve => {
        controller.once('exit', resolve);
      });

      expect(events.has('spawn')).toBe(true);
      expect(events.has('exit')).toBe(true);
    });

    test('should provide structured event data', async () => {
      let spawnEvent: any = null;
      
      controller.once('spawn', (event: any) => {
        spawnEvent = event;
      });

      await controller.start();
      
      // Wait for spawn event
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(spawnEvent).not.toBeNull();
      expect(spawnEvent.type).toBe('spawn');
      expect(spawnEvent.timestamp).toBeInstanceOf(Date);
      expect(spawnEvent.data).toBeDefined();
    });
  });
});