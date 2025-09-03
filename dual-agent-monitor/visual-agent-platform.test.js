const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Screenshot utility function
async function takeScreenshot(page, name) {
  const screenshotPath = path.join(__dirname, 'test-results', `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${screenshotPath}`);
}

test.describe('Visual Agent Management Platform Workflow', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    
    // Debug: Log any console messages 
    page.on('console', msg => {
      console.log('Browser console:', msg.text());
    });

    // Capture and log any unhandled errors
    page.on('pageerror', error => {
      console.error('Unhandled page error:', error);
    });
  });

  test('1. Dashboard Loads Correctly', async () => {
    try {
      await page.goto('http://localhost:6011', { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      
      // Verify page title
      await expect(page).toHaveTitle(/Visual Agent/i);
      
      // Check for critical dashboard elements
      await expect(page.locator('[data-testid="multi-agent-dashboard"]')).toBeVisible();
      await expect(page.locator('text=Agent Types')).toBeVisible();

      // Take screenshot of dashboard
      await takeScreenshot(page, '01-dashboard-initial-load');
    } catch (error) {
      console.error('Dashboard load failed:', error);
      await takeScreenshot(page, '01-dashboard-load-error');
      throw error;
    }
  });

  test('2. Agent Management UI Functionality', async () => {
    try {
      // Verify "Create Agent" button is present and clickable
      const createAgentButton = page.locator('[data-testid="create-agent-button"]');
      await expect(createAgentButton).toBeVisible();
      
      // Click "Create Agent" button
      await createAgentButton.click();

      // Verify agent creation modal appears
      const agentCreationModal = page.locator('[data-testid="agent-creation-modal"]');
      await expect(agentCreationModal).toBeVisible();

      // Take screenshot of agent creation modal
      await takeScreenshot(page, '02-agent-creation-modal');
    } catch (error) {
      console.error('Agent Management UI test failed:', error);
      await takeScreenshot(page, '02-agent-management-error');
      throw error;
    }
  });

  test('3. Agent Creation Form Interaction', async () => {
    try {
      // Find and fill out agent creation form
      await page.fill('[data-testid="agent-name-input"]', 'Test Manager Agent');
      await page.selectOption('[data-testid="agent-type-select"]', 'manager');
      await page.selectOption('[data-testid="agent-model-select"]', 'sonnet');

      // Take screenshot of filled form
      await takeScreenshot(page, '03-agent-creation-form-filled');

      // Submit agent creation form
      await page.click('[data-testid="create-agent-submit"]');

      // Wait for agent to appear in dashboard
      const newAgentElement = page.locator('text=Test Manager Agent');
      await expect(newAgentElement).toBeVisible({ timeout: 10000 });

      // Take screenshot of new agent in dashboard
      await takeScreenshot(page, '04-new-agent-created');
    } catch (error) {
      console.error('Agent Creation test failed:', error);
      await takeScreenshot(page, '04-agent-creation-error');
      throw error;
    }
  });

  test('4. Agent Status and WebSocket Verification', async () => {
    try {
      // Check agent status is visible and indicates readiness
      const agentStatusElement = page.locator('[data-testid="agent-status-idle"]');
      await expect(agentStatusElement).toBeVisible();

      // Optional: Check for WebSocket connection indicator
      const wsConnectionElement = page.locator('[data-testid="websocket-connected"]');
      if (await wsConnectionElement.count() > 0) {
        await expect(wsConnectionElement).toBeVisible();
      }

      // Take final dashboard screenshot
      await takeScreenshot(page, '05-agent-status-final');
    } catch (error) {
      console.error('Agent Status Verification failed:', error);
      await takeScreenshot(page, '05-agent-status-error');
      throw error;
    }
  });

  test.afterAll(async () => {
    await page.close();
  });
});
