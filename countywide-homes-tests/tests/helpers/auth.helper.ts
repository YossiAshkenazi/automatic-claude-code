import { Page } from '@playwright/test';
import { TestData } from './test-data';

export class AuthHelper {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email-input"], input[type="email"]', email);
    await this.page.fill('[data-testid="password-input"], input[type="password"]', password);
    await this.page.click('[data-testid="login-button"], button[type="submit"]');
    await this.page.waitForLoadState('networkidle');
  }

  async loginAsAdmin() {
    await this.page.goto('/admin/login');
    await this.login(TestData.adminUser.email, TestData.adminUser.password);
    await this.page.waitForURL('/admin/dashboard');
  }

  async loginAsCaseWorker() {
    await this.page.goto('/case-worker/login');
    await this.login(TestData.caseWorkerUser.email, TestData.caseWorkerUser.password);
    await this.page.waitForURL('/case-worker/dashboard');
  }

  async loginAsTenant() {
    await this.page.goto('/tenant/login');
    await this.login(TestData.tenantUser.email, TestData.tenantUser.password);
    await this.page.waitForURL('/tenant/dashboard');
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('text=Logout');
    await this.page.waitForURL('/');
  }

  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    });
  }

  async setAuthToken(token: string) {
    await this.page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, token);
  }

  async clearAuth() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    return token !== null;
  }

  async waitForAuthentication() {
    await this.page.waitForFunction(() => {
      return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    });
  }
}