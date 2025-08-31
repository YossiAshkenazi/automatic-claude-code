import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { TestData } from '../helpers/test-data';

test.describe('Authentication Flow Tests', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await page.goto('/');
  });

  test('Admin login flow', async ({ page }) => {
    await test.step('Navigate to admin login', async () => {
      await page.click('text=Admin Login');
      await expect(page).toHaveURL('/admin/login');
    });

    await test.step('Enter admin credentials', async () => {
      await authHelper.login(TestData.adminUser.email, TestData.adminUser.password);
    });

    await test.step('Verify admin dashboard access', async () => {
      await expect(page).toHaveURL('/admin/dashboard');
      await expect(page.locator('h1')).toContainText('Admin Dashboard');
      await expect(page.locator('[data-testid="user-role"]')).toContainText('Administrator');
    });

    await test.step('Verify admin menu items', async () => {
      const menuItems = ['Buildings', 'Units', 'Tenants', 'Service Requests', 'Reports'];
      for (const item of menuItems) {
        await expect(page.locator(`nav >> text=${item}`)).toBeVisible();
      }
    });
  });

  test('Case worker login flow', async ({ page }) => {
    await test.step('Navigate to case worker login', async () => {
      await page.click('text=Case Worker Login');
      await expect(page).toHaveURL('/case-worker/login');
    });

    await test.step('Enter case worker credentials', async () => {
      await authHelper.login(TestData.caseWorkerUser.email, TestData.caseWorkerUser.password);
    });

    await test.step('Verify case worker dashboard access', async () => {
      await expect(page).toHaveURL('/case-worker/dashboard');
      await expect(page.locator('h1')).toContainText('Case Worker Dashboard');
      await expect(page.locator('[data-testid="user-role"]')).toContainText('Case Worker');
    });

    await test.step('Verify restricted access', async () => {
      // Attempt to access admin-only route
      await page.goto('/admin/settings');
      await expect(page).toHaveURL('/case-worker/dashboard');
      await expect(page.locator('.toast-error')).toContainText('Unauthorized access');
    });
  });

  test('Tenant login flow', async ({ page }) => {
    await test.step('Navigate to tenant portal', async () => {
      await page.click('text=Tenant Portal');
      await expect(page).toHaveURL('/tenant/login');
    });

    await test.step('Enter tenant credentials', async () => {
      await authHelper.login(TestData.tenantUser.email, TestData.tenantUser.password);
    });

    await test.step('Verify tenant dashboard access', async () => {
      await expect(page).toHaveURL('/tenant/dashboard');
      await expect(page.locator('h1')).toContainText('Tenant Dashboard');
      await expect(page.locator('[data-testid="user-role"]')).toContainText('Tenant');
    });

    await test.step('Verify tenant-specific features', async () => {
      await expect(page.locator('[data-testid="pay-rent-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="service-request-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="lease-info"]')).toBeVisible();
    });
  });

  test('Invalid login attempts', async ({ page }) => {
    await page.click('text=Admin Login');

    await test.step('Test invalid email', async () => {
      await authHelper.login('invalid@email.com', 'password123');
      await expect(page.locator('.error-message')).toContainText('Invalid credentials');
    });

    await test.step('Test invalid password', async () => {
      await authHelper.login(TestData.adminUser.email, 'wrongpassword');
      await expect(page.locator('.error-message')).toContainText('Invalid credentials');
    });

    await test.step('Test empty fields', async () => {
      await page.click('[data-testid="login-button"]');
      await expect(page.locator('.field-error')).toContainText('Email is required');
    });
  });

  test('Session timeout handling', async ({ page }) => {
    await authHelper.loginAsAdmin();
    
    await test.step('Simulate session timeout', async () => {
      // Force session expiration
      await page.evaluate(() => {
        localStorage.removeItem('auth_token');
        sessionStorage.clear();
      });
      
      await page.reload();
      await expect(page).toHaveURL('/admin/login');
      await expect(page.locator('.info-message')).toContainText('Session expired');
    });
  });

  test('Logout flow', async ({ page }) => {
    await authHelper.loginAsAdmin();

    await test.step('Perform logout', async () => {
      await page.click('[data-testid="user-menu"]');
      await page.click('text=Logout');
      
      await expect(page).toHaveURL('/');
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    });

    await test.step('Verify session cleared', async () => {
      await page.goto('/admin/dashboard');
      await expect(page).toHaveURL('/admin/login');
    });
  });

  test('Remember me functionality', async ({ page }) => {
    await page.goto('/admin/login');

    await test.step('Login with remember me', async () => {
      await page.fill('[data-testid="email-input"]', TestData.adminUser.email);
      await page.fill('[data-testid="password-input"]', TestData.adminUser.password);
      await page.check('[data-testid="remember-me"]');
      await page.click('[data-testid="login-button"]');
      
      await expect(page).toHaveURL('/admin/dashboard');
    });

    await test.step('Verify persistent session', async () => {
      // Check that auth token is in localStorage instead of sessionStorage
      const hasPersistedAuth = await page.evaluate(() => {
        return localStorage.getItem('auth_token') !== null;
      });
      expect(hasPersistedAuth).toBeTruthy();
    });
  });

  test('Password reset flow', async ({ page }) => {
    await page.goto('/admin/login');

    await test.step('Initiate password reset', async () => {
      await page.click('text=Forgot password?');
      await expect(page).toHaveURL('/auth/reset-password');
      
      await page.fill('[data-testid="email-input"]', TestData.adminUser.email);
      await page.click('[data-testid="reset-button"]');
      
      await expect(page.locator('.success-message')).toContainText('Reset email sent');
    });
  });

  test('Multi-factor authentication', async ({ page }) => {
    await page.goto('/admin/login');

    await test.step('Login with MFA enabled account', async () => {
      await authHelper.login(TestData.mfaUser.email, TestData.mfaUser.password);
      
      await expect(page).toHaveURL('/auth/mfa');
      await expect(page.locator('h2')).toContainText('Two-Factor Authentication');
    });

    await test.step('Enter MFA code', async () => {
      await page.fill('[data-testid="mfa-code"]', '123456');
      await page.click('[data-testid="verify-button"]');
      
      await expect(page).toHaveURL('/admin/dashboard');
    });
  });

  test('Cross-tab session synchronization', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await test.step('Login in first tab', async () => {
      await page1.goto('/admin/login');
      const auth1 = new AuthHelper(page1);
      await auth1.loginAsAdmin();
      await expect(page1).toHaveURL('/admin/dashboard');
    });

    await test.step('Verify session in second tab', async () => {
      await page2.goto('/admin/dashboard');
      await expect(page2).toHaveURL('/admin/dashboard');
      await expect(page2.locator('[data-testid="user-role"]')).toContainText('Administrator');
    });

    await test.step('Logout from first tab affects second tab', async () => {
      await page1.click('[data-testid="user-menu"]');
      await page1.click('text=Logout');
      
      await page2.reload();
      await expect(page2).toHaveURL('/admin/login');
    });

    await context.close();
  });
});