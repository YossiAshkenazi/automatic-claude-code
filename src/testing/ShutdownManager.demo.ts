#!/usr/bin/env node
/**
 * ShutdownManager Demo Script
 * Epic 3, Story 3.3: Implement Graceful Shutdown Hooks
 * 
 * Interactive demo to showcase the ShutdownManager capabilities.
 * Run with: npx ts-node src/testing/ShutdownManager.demo.ts
 */

import { Logger } from '../logger';
import ShutdownManager from './ShutdownManager';
import ProcessHandleTracker from './ProcessHandleTracker';
import { 
  basicShutdownExample,
  dependencyShutdownExample,
  handleTrackerIntegrationExample,
  testSDKIntegrationExample,
  isolatedTestRunnerExample,
  errorHandlingExample,
  realWorldApplicationExample,
  runAllShutdownExamples
} from './ShutdownManager.examples';

async function interactiveDemo(): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    🛡️  ShutdownManager Demo                       ║
║                                                                  ║
║  Comprehensive Graceful Shutdown Hooks System                   ║
║  Epic 3, Story 3.3: Implement Graceful Shutdown Hooks          ║
╚══════════════════════════════════════════════════════════════════╝

Available demonstrations:

1. 📋 Basic Shutdown Hook Registration
2. 🔗 Dependency-Based Shutdown Order
3. 🔧 ProcessHandleTracker Integration
4. 🧪 TestSDK Integration with Automatic Shutdown
5. 🏃 IsolatedTestRunner with Shutdown Management
6. ❌ Error Handling and Recovery
7. 🌍 Real-World Application Shutdown Pattern
8. 🚀 Run All Examples
9. 🔍 Interactive ShutdownManager Exploration
0. ❌ Exit

Choose an option (0-9): `);

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise((resolve) => {
    process.stdin.on('data', async (key: string) => {
      const choice = key.toString().trim();
      
      // Restore normal input mode
      process.stdin.setRawMode(false);
      process.stdin.pause();

      console.log(`\nSelected: ${choice}\n`);

      try {
        switch (choice) {
          case '1':
            await basicShutdownExample();
            break;
          case '2':
            await dependencyShutdownExample();
            break;
          case '3':
            await handleTrackerIntegrationExample();
            break;
          case '4':
            await testSDKIntegrationExample();
            break;
          case '5':
            await isolatedTestRunnerExample();
            break;
          case '6':
            await errorHandlingExample();
            break;
          case '7':
            await realWorldApplicationExample();
            break;
          case '8':
            await runAllShutdownExamples();
            break;
          case '9':
            await interactiveExploration();
            break;
          case '0':
            console.log('👋 Goodbye!');
            resolve();
            return;
          default:
            console.log('❌ Invalid choice. Please select 0-9.');
            await interactiveDemo();
            return;
        }

        console.log('\n🎯 Demo completed! Press any key to return to menu...');
        await waitForKeyPress();
        await interactiveDemo();
      } catch (error: any) {
        console.error(`\n❌ Demo failed: ${error.message}`);
        console.error(error.stack);
        
        console.log('\n⚠️  Press any key to return to menu...');
        await waitForKeyPress();
        await interactiveDemo();
      }
    });
  });
}

async function interactiveExploration(): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║               🔍 Interactive ShutdownManager Exploration          ║
╚══════════════════════════════════════════════════════════════════╝
`);

  const logger = new Logger('interactive-demo', { 
    essentialMode: false, 
    enableFileLogging: false 
  });

  // Create shutdown manager
  ShutdownManager.destroy();
  const manager = ShutdownManager.getInstance(logger, {
    maxShutdownTime: 5000,
    gracefulTimeout: 3000,
    forceKillTimeout: 1000,
    enableSignalHandlers: false,
    logProgress: true,
    enableEscalation: false,
    hookTimeout: 1000,
    parallelExecution: true
  });

  // Create handle tracker
  const handleTracker = ProcessHandleTracker.getInstance(logger);
  handleTracker.startTracking();
  manager.setHandleTracker(handleTracker);

  console.log('✅ ShutdownManager and ProcessHandleTracker initialized');
  console.log(`📊 Initial state: ${JSON.stringify(manager.getStatus(), null, 2)}`);

  // Register some example hooks
  const hooks = [
    {
      name: 'Critical-Resource-Cleanup',
      priority: 'critical' as const,
      delay: 200,
      description: 'Clean up critical resources'
    },
    {
      name: 'Database-Shutdown',
      priority: 'high' as const,
      delay: 300,
      description: 'Close database connections'
    },
    {
      name: 'Cache-Flush',
      priority: 'normal' as const,
      delay: 150,
      description: 'Flush cache to storage'
    },
    {
      name: 'Log-Cleanup',
      priority: 'cleanup' as const,
      delay: 100,
      description: 'Flush remaining logs'
    }
  ];

  console.log('\n📝 Registering example hooks...');
  const hookIds = hooks.map(hook => {
    const id = manager.registerHook(
      hook.name,
      async () => {
        console.log(`  🔄 Executing: ${hook.name}`);
        await new Promise(resolve => setTimeout(resolve, hook.delay));
        console.log(`  ✅ Completed: ${hook.name}`);
      },
      hook.priority,
      {
        description: hook.description,
        timeoutMs: hook.delay + 500
      }
    );
    console.log(`   • ${hook.name} (${hook.priority}) - ID: ${id.slice(-8)}`);
    return id;
  });

  // Register some handles to track
  console.log('\n🔧 Registering tracked handles...');
  const timer1 = setInterval(() => {}, 1000);
  const timer2 = setTimeout(() => {}, 10000);
  
  const handle1 = handleTracker.registerHandle('custom', {
    cleanup: async () => {
      console.log('  🧹 Custom handle 1 cleaned up');
    }
  }, 'demo-resource-1');

  const handle2 = handleTracker.registerHandle('custom', {
    cleanup: async () => {
      console.log('  🧹 Custom handle 2 cleaned up');
    }
  }, 'demo-resource-2');

  console.log(`   • Timer intervals and custom handles registered`);
  console.log(`   • Total tracked handles: ${handleTracker.getTrackedHandles().length}`);

  // Show current state
  console.log('\n📊 Current ShutdownManager state:');
  const hooks_registered = manager.getHooks();
  console.log(`   • Registered hooks: ${hooks_registered.length}`);
  hooks_registered.forEach(hook => {
    console.log(`     - ${hook.name} (${hook.priority}) - ${hook.enabled ? 'enabled' : 'disabled'}`);
  });

  const stats = manager.getStatistics();
  console.log(`   • Statistics: ${JSON.stringify(stats, null, 4)}`);

  console.log('\n🚀 Press any key to trigger graceful shutdown...');
  await waitForKeyPress();

  console.log('\n🛑 Initiating graceful shutdown...');
  const result = await manager.shutdown('Interactive exploration shutdown');

  console.log(`\n📊 Shutdown Results:`);
  console.log(`   Success: ${result.success ? '✅' : '❌'}`);
  console.log(`   Total time: ${result.totalTime}ms`);
  console.log(`   Completed hooks: ${result.completedHooks}`);
  console.log(`   Failed hooks: ${result.failedHooks}`);
  console.log(`   Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log(`   Error details:`);
    result.errors.forEach((error, index) => {
      console.log(`     ${index + 1}. ${error}`);
    });
  }

  // Show hook execution results
  console.log(`\n🔍 Individual Hook Results:`);
  result.hookResults.forEach((hookResult, hookId) => {
    const hook = hooks_registered.find(h => h.id === hookId);
    const status = hookResult.success ? '✅' : (hookResult.timedOut ? '⏱️' : '❌');
    console.log(`   ${status} ${hook?.name || hookId.slice(-8)}: ${hookResult.executionTime}ms`);
    if (hookResult.error) {
      console.log(`      Error: ${hookResult.error}`);
    }
  });

  // Show final handle state
  console.log(`\n🔧 Final handle tracking state:`);
  console.log(`   Remaining handles: ${handleTracker.getTrackedHandles().length}`);
  
  const handleStats = handleTracker.getStatistics();
  console.log(`   Handle statistics: ${JSON.stringify(handleStats, null, 4)}`);

  // Cleanup
  clearInterval(timer1);
  clearTimeout(timer2);
  handleTracker.stopTracking();
  ProcessHandleTracker.destroy();
  ShutdownManager.destroy();

  console.log('\n✅ Interactive exploration completed successfully!');
}

async function waitForKeyPress(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}

function showQuickStart(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                        🚀 Quick Start Guide                       ║
╚══════════════════════════════════════════════════════════════════╝

Basic Usage:

import ShutdownManager from './src/testing/ShutdownManager';
import ProcessHandleTracker from './src/testing/ProcessHandleTracker';

// Create logger
const logger = new Logger('app', { essentialMode: true });

// Initialize shutdown manager with handle tracker
const manager = ShutdownManager.getInstance(logger);
const handleTracker = ProcessHandleTracker.getInstance(logger);
manager.setHandleTracker(handleTracker);

// Register cleanup hooks
manager.registerHook('DB-Cleanup', async () => {
  await database.close();
}, 'high', { timeoutMs: 5000 });

// Signal handlers are automatically registered
// Shutdown can be triggered by: SIGTERM, SIGINT, SIGQUIT, SIGHUP

// Manual shutdown
await manager.shutdown('Application shutdown');

Key Features:
• ✅ Priority-based hook execution (critical → high → normal → low → cleanup)
• ✅ Dependency management between hooks
• ✅ Automatic signal handler registration (SIGTERM, SIGINT, etc.)
• ✅ Timeout enforcement with SIGKILL escalation
• ✅ ProcessHandleTracker integration for resource cleanup
• ✅ Comprehensive error handling and recovery
• ✅ TestSDK and IsolatedTestRunner integration
• ✅ Cross-platform compatibility (Windows, macOS, Linux)
• ✅ Detailed logging and progress tracking
`);
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showQuickStart();
    return;
  }

  if (args.includes('--all')) {
    console.log('🚀 Running all ShutdownManager examples...\n');
    await runAllShutdownExamples();
    return;
  }

  if (args.includes('--quick')) {
    showQuickStart();
    console.log('\n🎯 Running basic example...\n');
    await basicShutdownExample();
    return;
  }

  // Default to interactive demo
  await interactiveDemo();
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Demo interrupted. Cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Demo terminated. Cleaning up...');
  process.exit(0);
});

// Run main function
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  });
}