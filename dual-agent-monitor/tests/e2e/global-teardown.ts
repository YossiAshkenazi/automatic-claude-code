import fs from 'fs';
import path from 'path';

async function globalTeardown() {
  console.log('Cleaning up test environment...');

  // Clean up auth file
  const authPath = path.join(__dirname, 'auth.json');
  if (fs.existsSync(authPath)) {
    fs.unlinkSync(authPath);
  }

  // Clean up any temporary test files
  const testResultsDir = path.join(process.cwd(), 'test-results');
  if (fs.existsSync(testResultsDir)) {
    // Keep test results for CI, but clean up locally in development
    if (!process.env.CI) {
      fs.rmSync(testResultsDir, { recursive: true, force: true });
    }
  }

  console.log('Test environment cleanup complete');
}

export default globalTeardown;