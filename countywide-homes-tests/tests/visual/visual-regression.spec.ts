import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';

test.describe('Visual Regression Testing', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    // Set consistent viewport for visual tests
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Login page visual consistency', async ({ page }) => {
    await page.goto('/admin/login');
    
    await test.step('Capture login page screenshot', async () => {
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot('login-page.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    await test.step('Test form validation visuals', async () => {
      await page.click('[data-testid="login-button"]');
      await page.waitForSelector('.field-error');
      await expect(page).toHaveScreenshot('login-validation.png', {
        fullPage: false,
        clip: { x: 0, y: 0, width: 600, height: 400 }
      });
    });
  });

  test('Dashboard visual consistency', async ({ page }) => {
    await authHelper.loginAsAdmin();
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    await test.step('Full dashboard screenshot', async () => {
      await expect(page).toHaveScreenshot('dashboard-full.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    await test.step('Individual widget screenshots', async () => {
      const widgets = [
        { selector: '[data-testid="stats-widget"]', name: 'stats-widget' },
        { selector: '[data-testid="recent-activity"]', name: 'recent-activity' },
        { selector: '[data-testid="charts-widget"]', name: 'charts-widget' }
      ];

      for (const widget of widgets) {
        const element = page.locator(widget.selector);
        await expect(element).toHaveScreenshot(`${widget.name}.png`);
      }
    });
  });

  test('Table component visual tests', async ({ page }) => {
    await authHelper.loginAsAdmin();
    await page.goto('/admin/buildings');
    await page.waitForSelector('tbody tr');

    await test.step('Default table view', async () => {
      await expect(page.locator('.data-table')).toHaveScreenshot('table-default.png');
    });

    await test.step('Table with selected rows', async () => {
      await page.check('tr:nth-child(1) >> input[type="checkbox"]');
      await page.check('tr:nth-child(2) >> input[type="checkbox"]');
      await expect(page.locator('.data-table')).toHaveScreenshot('table-selected.png');
    });

    await test.step('Table with hover state', async () => {
      await page.hover('tr:nth-child(3)');
      await expect(page.locator('.data-table')).toHaveScreenshot('table-hover.png');
    });
  });

  test('Form components visual tests', async ({ page }) => {
    await authHelper.loginAsAdmin();
    await page.goto('/admin/buildings');
    await page.click('[data-testid="add-building-button"]');

    await test.step('Empty form', async () => {
      await expect(page.locator('.modal-content')).toHaveScreenshot('form-empty.png');
    });

    await test.step('Form with validation errors', async () => {
      await page.click('[data-testid="save-building-button"]');
      await page.waitForSelector('.field-error');
      await expect(page.locator('.modal-content')).toHaveScreenshot('form-errors.png');
    });

    await test.step('Form with filled data', async () => {
      await page.fill('[data-testid="building-name"]', 'Test Building');
      await page.fill('[data-testid="building-address"]', '123 Test Street');
      await page.selectOption('[data-testid="building-state"]', 'CA');
      await expect(page.locator('.modal-content')).toHaveScreenshot('form-filled.png');
    });
  });

  test('Responsive design breakpoints', async ({ page }) => {
    const breakpoints = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'wide', width: 2560, height: 1440 }
    ];

    await authHelper.loginAsAdmin();
    await page.goto('/admin/dashboard');

    for (const breakpoint of breakpoints) {
      await test.step(`${breakpoint.name} view (${breakpoint.width}x${breakpoint.height})`, async () => {
        await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
        await page.waitForTimeout(500); // Allow layout to settle
        await expect(page).toHaveScreenshot(`responsive-${breakpoint.name}.png`, {
          fullPage: false,
          animations: 'disabled'
        });
      });
    }
  });

  test('Theme consistency', async ({ page }) => {
    await authHelper.loginAsAdmin();
    await page.goto('/admin/dashboard');

    await test.step('Light theme', async () => {
      await expect(page).toHaveScreenshot('theme-light.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    await test.step('Dark theme', async () => {
      // Toggle dark mode if available
      const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
      if (await darkModeToggle.isVisible()) {
        await darkModeToggle.click();
        await page.waitForTimeout(500); // Allow theme transition
        await expect(page).toHaveScreenshot('theme-dark.png', {
          fullPage: true,
          animations: 'disabled'
        });
      }
    });
  });

  test('Chart and graph visuals', async ({ page }) => {
    await authHelper.loginAsAdmin();
    await page.goto('/admin/reports');
    await page.waitForSelector('.chart-container');

    await test.step('Occupancy chart', async () => {
      await expect(page.locator('[data-testid="occupancy-chart"]')).toHaveScreenshot('chart-occupancy.png');
    });

    await test.step('Revenue chart', async () => {
      await expect(page.locator('[data-testid="revenue-chart"]')).toHaveScreenshot('chart-revenue.png');
    });

    await test.step('Maintenance chart', async () => {
      await expect(page.locator('[data-testid="maintenance-chart"]')).toHaveScreenshot('chart-maintenance.png');
    });
  });

  test('Modal dialogs visual consistency', async ({ page }) => {
    await authHelper.loginAsAdmin();
    await page.goto('/admin/tenants');

    const modals = [
      { trigger: '[data-testid="add-tenant-button"]', name: 'add-tenant-modal' },
      { trigger: '[data-testid="import-button"]', name: 'import-modal' },
      { trigger: '[data-testid="export-button"]', name: 'export-modal' }
    ];

    for (const modal of modals) {
      await test.step(`${modal.name} screenshot`, async () => {
        if (await page.locator(modal.trigger).isVisible()) {
          await page.click(modal.trigger);
          await page.waitForSelector('.modal-content');
          await expect(page.locator('.modal-overlay')).toHaveScreenshot(`${modal.name}.png`);
          await page.keyboard.press('Escape');
        }
      });
    }
  });

  test('Print view styles', async ({ page }) => {
    await authHelper.loginAsAdmin();
    await page.goto('/admin/reports/monthly');

    await test.step('Emulate print media', async () => {
      await page.emulateMedia({ media: 'print' });
      await expect(page).toHaveScreenshot('print-view.png', {
        fullPage: true
      });
    });
  });

  test('Error states visual tests', async ({ page }) => {
    await authHelper.loginAsAdmin();

    await test.step('404 page', async () => {
      await page.goto('/admin/non-existent-page');
      await expect(page).toHaveScreenshot('error-404.png', {
        fullPage: true
      });
    });

    await test.step('Network error state', async () => {
      await page.route('**/api/**', route => route.abort());
      await page.goto('/admin/buildings');
      await page.waitForSelector('.error-message');
      await expect(page).toHaveScreenshot('error-network.png', {
        fullPage: true
      });
    });
  });
});