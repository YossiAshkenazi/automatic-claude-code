import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page).toHaveTitle(/Dual Agent Monitor/);
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('username-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByTestId('login-button')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    
    await page.click('[data-testid="login-button"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByTestId('dashboard')).toBeVisible();
    
    // Should show user info in header
    await expect(page.getByTestId('user-menu')).toBeVisible();
    await expect(page.getByText('testuser')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    
    await page.click('[data-testid="login-button"]');
    
    // Should show error message
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    
    // Should stay on login page
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');
    
    await page.click('[data-testid="login-button"]');
    
    // Should show validation errors
    await expect(page.getByText(/username.*required/i)).toBeVisible();
    await expect(page.getByText(/password.*required/i)).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Then logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByTestId('login-form')).toBeVisible();
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByTestId('login-form')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    
    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('username-input')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('password-input')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('login-button')).toBeFocused();
    
    // Enter credentials using keyboard
    await page.focus('[data-testid="username-input"]');
    await page.keyboard.type('testuser');
    
    await page.keyboard.press('Tab');
    await page.keyboard.type('testpass123');
    
    // Submit with Enter
    await page.keyboard.press('Enter');
    
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('should remember me functionality', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    
    // Check remember me
    await page.check('[data-testid="remember-me-checkbox"]');
    
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Verify persistent session (would need to check cookies/storage)
    const cookies = await page.context().cookies();
    expect(cookies.some(cookie => cookie.name.includes('session'))).toBeTruthy();
  });
});