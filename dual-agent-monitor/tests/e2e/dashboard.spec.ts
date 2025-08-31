import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Use pre-authenticated state
    await page.context().storageState({ path: 'tests/e2e/auth.json' });
    await page.goto('/dashboard');
  });

  test('should load dashboard with all main components', async ({ page }) => {
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await expect(page.getByTestId('session-list')).toBeVisible();
    await expect(page.getByTestId('performance-metrics')).toBeVisible();
    await expect(page.getByTestId('agent-comparison')).toBeVisible();
  });

  test('should display session list', async ({ page }) => {
    await expect(page.getByTestId('session-list')).toBeVisible();
    
    // Should show sample sessions
    await expect(page.getByText('Sample Session 1')).toBeVisible();
    await expect(page.getByText('Sample Session 2')).toBeVisible();
    
    // Should show session metadata
    await expect(page.getByText('completed')).toBeVisible();
    await expect(page.getByText('active')).toBeVisible();
  });

  test('should select and view session details', async ({ page }) => {
    // Click on a session
    await page.click('[data-testid="session-card"]:first-child');
    
    // Should show session details
    await expect(page.getByTestId('session-details')).toBeVisible();
    await expect(page.getByTestId('message-list')).toBeVisible();
    
    // Should highlight selected session
    const selectedSession = page.getByTestId('session-card').first();
    await expect(selectedSession).toHaveClass(/ring-2.*ring-blue-500/);
  });

  test('should display performance metrics', async ({ page }) => {
    await expect(page.getByTestId('performance-metrics')).toBeVisible();
    
    // Should show key metrics
    await expect(page.getByText(/response time/i)).toBeVisible();
    await expect(page.getByText(/success rate/i)).toBeVisible();
    await expect(page.getByText(/total messages/i)).toBeVisible();
    
    // Should show charts
    await expect(page.getByTestId('response-time-chart')).toBeVisible();
    await expect(page.getByTestId('success-rate-chart')).toBeVisible();
  });

  test('should display agent comparison', async ({ page }) => {
    await expect(page.getByTestId('agent-comparison')).toBeVisible();
    
    // Should show manager and worker stats
    await expect(page.getByText(/manager/i)).toBeVisible();
    await expect(page.getByText(/worker/i)).toBeVisible();
    
    // Should show comparison chart
    await expect(page.getByTestId('agent-comparison-chart')).toBeVisible();
  });

  test('should handle real-time updates', async ({ page }) => {
    // Mock WebSocket connection
    await page.addInitScript(() => {
      window.mockWebSocket = class {
        constructor() {
          setTimeout(() => {
            if (this.onopen) this.onopen();
          }, 100);
        }
        send() {}
        close() {}
      };
      window.WebSocket = window.mockWebSocket;
    });

    await page.reload();

    // Should show connection status
    await expect(page.getByTestId('connection-status')).toHaveText(/connected/i);

    // Simulate real-time message
    await page.evaluate(() => {
      const event = new CustomEvent('websocket-message', {
        detail: {
          type: 'new-message',
          data: {
            id: 'msg-123',
            agent: 'manager',
            content: 'Test message',
            timestamp: new Date().toISOString()
          }
        }
      });
      window.dispatchEvent(event);
    });

    // Should update message list
    await expect(page.getByText('Test message')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Should show mobile navigation
    await expect(page.getByTestId('mobile-menu-button')).toBeVisible();
    
    // Should stack components vertically
    const dashboard = page.getByTestId('dashboard');
    await expect(dashboard).toHaveClass(/flex-col/);
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Should show modified layout for tablet
    await expect(page.getByTestId('session-list')).toBeVisible();
    await expect(page.getByTestId('performance-metrics')).toBeVisible();
  });

  test('should handle error states', async ({ page }) => {
    // Mock API error
    await page.route('**/api/sessions', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.reload();

    // Should show error message
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByText(/failed to load/i)).toBeVisible();
    
    // Should show retry button
    await expect(page.getByTestId('retry-button')).toBeVisible();
  });

  test('should handle loading states', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/sessions', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sessions: [] })
        });
      }, 2000);
    });

    await page.reload();

    // Should show loading spinner
    await expect(page.getByTestId('loading-spinner')).toBeVisible();
    
    // Should show skeleton placeholders
    await expect(page.getByTestId('session-skeleton')).toBeVisible();
  });

  test('should filter sessions', async ({ page }) => {
    // Use search/filter input
    await page.fill('[data-testid="session-filter"]', 'Sample Session 1');
    
    // Should show filtered results
    await expect(page.getByText('Sample Session 1')).toBeVisible();
    await expect(page.getByText('Sample Session 2')).not.toBeVisible();
    
    // Clear filter
    await page.fill('[data-testid="session-filter"]', '');
    
    // Should show all sessions
    await expect(page.getByText('Sample Session 1')).toBeVisible();
    await expect(page.getByText('Sample Session 2')).toBeVisible();
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('ArrowDown');
    
    // Should navigate to next session
    const firstSession = page.getByTestId('session-card').first();
    await expect(firstSession).toHaveClass(/ring-2/);
    
    // Test refresh shortcut
    await page.keyboard.press('F5');
    
    // Should refresh data (verify by checking for loading state)
    await expect(page.getByTestId('loading-spinner')).toBeVisible({ timeout: 1000 });
  });
});