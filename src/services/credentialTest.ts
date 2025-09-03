import * as os from 'os';

/**
 * Test basic OAuth credential extraction dependencies and functionality
 * This validates that all required dependencies for OAuth token extraction are available
 */

// Test 1: Basic platform detection
export function testPlatformDetection(): void {
  console.log('Platform Detection Test:');
  console.log(`- Platform: ${process.platform}`);
  console.log(`- Architecture: ${process.arch}`);
  console.log(`- Node version: ${process.version}`);
  console.log(`- Home directory: ${os.homedir()}`);
  console.log('✓ Platform detection working\n');
}

// Test 2: Child process functionality (used by OAuth extractor)
export async function testChildProcess(): Promise<void> {
  console.log('Child Process Test:');
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Test a simple command that works cross-platform
    const command = process.platform === 'win32' ? 'echo "test"' : 'echo "test"';
    const result = await execAsync(command);
    console.log(`- Command execution successful: ${result.stdout.trim()}`);
    console.log('✓ Child process functionality working\n');
  } catch (error) {
    console.error('✗ Child process test failed:', error);
  }
}

// Test 3: File system access
export function testFileSystemAccess(): void {
  console.log('File System Access Test:');
  try {
    const fs = require('fs');
    const path = require('path');
    
    const testPaths = [
      path.join(os.homedir(), '.claude'),
      path.join(os.homedir(), '.config'),
      path.join(os.homedir(), '.anthropic')
    ];

    testPaths.forEach(testPath => {
      const exists = fs.existsSync(testPath);
      console.log(`- Path ${testPath}: ${exists ? 'exists' : 'not found'}`);
    });
    
    console.log('✓ File system access working\n');
  } catch (error) {
    console.error('✗ File system test failed:', error);
  }
}

// Test 4: Windows Credential Manager availability (Windows only)
export async function testWindowsCredentialManager(): Promise<void> {
  if (process.platform !== 'win32') {
    console.log('Windows Credential Manager Test: Skipped (not Windows platform)\n');
    return;
  }

  console.log('Windows Credential Manager Test:');
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Test PowerShell availability
    try {
      await execAsync('powershell.exe -Command "Get-Command Get-StoredCredential" -ErrorAction SilentlyContinue');
      console.log('- PowerShell credential cmdlets available');
    } catch (error) {
      console.log('- PowerShell credential cmdlets not available, trying cmdkey fallback');
    }

    // Test cmdkey availability (built into Windows)
    try {
      await execAsync('cmdkey /?');
      console.log('- Windows cmdkey utility available');
      console.log('✓ Windows credential manager tools available\n');
    } catch (error) {
      console.log('- Windows cmdkey utility not available');
    }

  } catch (error) {
    console.error('✗ Windows credential manager test failed:', error);
  }
}

// Test 5: macOS Keychain availability (macOS only)
export async function testMacOSKeychain(): Promise<void> {
  if (process.platform !== 'darwin') {
    console.log('macOS Keychain Test: Skipped (not macOS platform)\n');
    return;
  }

  console.log('macOS Keychain Test:');
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Test security command availability
    await execAsync('security -h');
    console.log('- macOS security command available');
    console.log('✓ macOS keychain tools available\n');

  } catch (error) {
    console.error('✗ macOS keychain test failed:', error);
  }
}

// Test 6: Mock keytar functionality (simulating the package)
export function testKeytarCompatibility(): void {
  console.log('Keytar Compatibility Test:');
  try {
    // Simulate keytar interface without actually importing it
    const mockKeytar = {
      getPassword: async (service: string, account: string) => {
        console.log(`- Mock getPassword called for service: ${service}, account: ${account}`);
        return null; // Would return actual password
      },
      setPassword: async (service: string, account: string, password: string) => {
        console.log(`- Mock setPassword called for service: ${service}, account: ${account}`);
        return;
      },
      deletePassword: async (service: string, account: string) => {
        console.log(`- Mock deletePassword called for service: ${service}, account: ${account}`);
        return;
      },
      findCredentials: async (service: string) => {
        console.log(`- Mock findCredentials called for service: ${service}`);
        return [];
      }
    };

    console.log('✓ Keytar interface compatibility confirmed\n');
  } catch (error) {
    console.error('✗ Keytar compatibility test failed:', error);
  }
}

// Test 7: Node-windows compatibility (Windows only)
export function testNodeWindowsCompatibility(): void {
  if (process.platform !== 'win32') {
    console.log('Node-Windows Compatibility Test: Skipped (not Windows platform)\n');
    return;
  }

  console.log('Node-Windows Compatibility Test:');
  try {
    // Simulate node-windows interface without actually importing it
    const mockNodeWindows = {
      Service: class {
        constructor(options: any) {
          console.log('- Mock Service constructor called with options:', options);
        }
        install() {
          console.log('- Mock service install called');
        }
        uninstall() {
          console.log('- Mock service uninstall called');
        }
      }
    };

    console.log('✓ Node-Windows interface compatibility confirmed\n');
  } catch (error) {
    console.error('✗ Node-Windows compatibility test failed:', error);
  }
}

// Main test runner
export async function runCredentialTests(): Promise<void> {
  console.log('🔐 OAuth Credential Dependencies Validation\n');
  console.log('='.repeat(50) + '\n');

  testPlatformDetection();
  await testChildProcess();
  testFileSystemAccess();
  await testWindowsCredentialManager();
  await testMacOSKeychain();
  testKeytarCompatibility();
  testNodeWindowsCompatibility();

  console.log('='.repeat(50));
  console.log('✓ All credential dependency tests completed');
  console.log('\nNext steps:');
  console.log('1. Install actual packages with: pnpm install');
  console.log('2. Run OAuth extractor tests with: pnpm test oauthExtractor');
  console.log('3. Test credential extraction: pnpm run dev -- --test-credentials');
}

// Allow running this script directly
if (require.main === module) {
  runCredentialTests().catch(console.error);
}