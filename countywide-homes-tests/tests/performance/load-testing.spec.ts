import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';

test.describe('Performance and Load Testing', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.loginAsAdmin();
  });

  test('Dashboard load time', async ({ page }) => {
    const startTime = Date.now();
    
    await test.step('Navigate to dashboard', async () => {
      await page.goto('/admin/dashboard');
      await page.waitForLoadState('networkidle');
    });

    const loadTime = Date.now() - startTime;
    
    await test.step('Verify load time is acceptable', async () => {
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
      console.log(`Dashboard load time: ${loadTime}ms`);
    });

    await test.step('Verify all dashboard widgets loaded', async () => {
      await expect(page.locator('[data-testid="stats-widget"]')).toBeVisible();
      await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
      await expect(page.locator('[data-testid="charts-widget"]')).toBeVisible();
    });
  });

  test('Large dataset pagination performance', async ({ page }) => {
    await page.goto('/admin/tenants');

    await test.step('Measure initial load', async () => {
      const startTime = Date.now();
      await page.waitForSelector('tbody tr');
      const initialLoadTime = Date.now() - startTime;
      
      expect(initialLoadTime).toBeLessThan(2000);
      console.log(`Initial table load: ${initialLoadTime}ms`);
    });

    await test.step('Test pagination performance', async () => {
      const paginationTimes: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await page.click('[data-testid="next-page"]');
        await page.waitForSelector('tbody tr');
        const pageLoadTime = Date.now() - startTime;
        
        paginationTimes.push(pageLoadTime);
        expect(pageLoadTime).toBeLessThan(1000); // Each page should load within 1 second
      }
      
      const avgTime = paginationTimes.reduce((a, b) => a + b, 0) / paginationTimes.length;
      console.log(`Average pagination time: ${avgTime}ms`);
    });
  });

  test('Search performance with large dataset', async ({ page }) => {
    await page.goto('/admin/buildings');

    await test.step('Test search responsiveness', async () => {
      const searchInput = page.locator('[data-testid="search-buildings"]');
      
      const searchTerms = ['Building A', 'Test', '123 Main', 'California'];
      const searchTimes: number[] = [];
      
      for (const term of searchTerms) {
        const startTime = Date.now();
        await searchInput.fill(term);
        await page.waitForTimeout(300); // Debounce delay
        await page.waitForSelector('tbody tr', { state: 'attached' });
        const searchTime = Date.now() - startTime;
        
        searchTimes.push(searchTime);
        expect(searchTime).toBeLessThan(1500);
      }
      
      const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      console.log(`Average search time: ${avgSearchTime}ms`);
    });
  });

  test('Concurrent form submissions', async ({ browser }) => {
    const context = await browser.newContext();
    const promises: Promise<void>[] = [];
    
    await test.step('Create multiple concurrent sessions', async () => {
      for (let i = 0; i < 5; i++) {
        promises.push(
          (async () => {
            const page = await context.newPage();
            const auth = new AuthHelper(page);
            await auth.loginAsAdmin();
            
            await page.goto('/admin/service-requests/new');
            await page.fill('[data-testid="request-title"]', `Concurrent Request ${i}`);
            await page.fill('[data-testid="request-description"]', `Test description ${i}`);
            await page.selectOption('[data-testid="request-priority"]', 'high');
            
            const startTime = Date.now();
            await page.click('[data-testid="submit-request"]');
            await page.waitForSelector('.toast-success');
            const submitTime = Date.now() - startTime;
            
            console.log(`Request ${i} submit time: ${submitTime}ms`);
            expect(submitTime).toBeLessThan(3000);
            
            await page.close();
          })()
        );
      }
      
      await Promise.all(promises);
    });
    
    await context.close();
  });

  test('API response times', async ({ page }) => {
    const apiCalls: { endpoint: string; time: number }[] = [];
    
    // Monitor API calls
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const timing = response.timing();
        if (timing) {
          apiCalls.push({
            endpoint: response.url(),
            time: timing.responseEnd
          });
        }
      }
    });
    
    await test.step('Navigate through application', async () => {
      await page.goto('/admin/dashboard');
      await page.goto('/admin/buildings');
      await page.goto('/admin/units');
      await page.goto('/admin/tenants');
    });
    
    await test.step('Analyze API performance', async () => {
      const avgResponseTime = apiCalls.reduce((sum, call) => sum + call.time, 0) / apiCalls.length;
      const slowCalls = apiCalls.filter(call => call.time > 1000);
      
      console.log(`Total API calls: ${apiCalls.length}`);
      console.log(`Average response time: ${avgResponseTime}ms`);
      console.log(`Slow calls (>1s): ${slowCalls.length}`);
      
      expect(avgResponseTime).toBeLessThan(500);
      expect(slowCalls.length / apiCalls.length).toBeLessThan(0.1); // Less than 10% slow calls
    });
  });

  test('Memory usage during extended session', async ({ page }) => {
    const memoryReadings: number[] = [];
    
    await test.step('Perform extended navigation', async () => {
      for (let i = 0; i < 10; i++) {
        await page.goto('/admin/dashboard');
        await page.goto('/admin/buildings');
        await page.goto('/admin/units');
        await page.goto('/admin/tenants');
        
        // Get memory usage if available
        const metrics = await page.metrics();
        if (metrics.JSHeapUsedSize) {
          memoryReadings.push(metrics.JSHeapUsedSize);
        }
      }
    });
    
    await test.step('Check for memory leaks', async () => {
      if (memoryReadings.length > 2) {
        const initialMemory = memoryReadings[0];
        const finalMemory = memoryReadings[memoryReadings.length - 1];
        const memoryIncrease = ((finalMemory - initialMemory) / initialMemory) * 100;
        
        console.log(`Memory increase: ${memoryIncrease.toFixed(2)}%`);
        expect(memoryIncrease).toBeLessThan(50); // Memory shouldn't increase by more than 50%
      }
    });
  });

  test('File upload performance', async ({ page }) => {
    await page.goto('/admin/documents');
    
    await test.step('Upload multiple files', async () => {
      const uploadTimes: number[] = [];
      
      // Create test files
      const files = [
        { name: 'test1.pdf', size: 1024 * 1024 }, // 1MB
        { name: 'test2.pdf', size: 2 * 1024 * 1024 }, // 2MB
        { name: 'test3.pdf', size: 5 * 1024 * 1024 }, // 5MB
      ];
      
      for (const file of files) {
        const startTime = Date.now();
        
        // Note: In real implementation, you'd use actual file uploads
        await page.setInputFiles('[data-testid="file-upload"]', {
          name: file.name,
          mimeType: 'application/pdf',
          buffer: Buffer.alloc(file.size)
        });
        
        await page.waitForSelector('.upload-success');
        const uploadTime = Date.now() - startTime;
        
        uploadTimes.push(uploadTime);
        console.log(`${file.name} (${file.size / 1024 / 1024}MB) upload time: ${uploadTime}ms`);
        
        // Expected: ~1 second per MB
        const expectedTime = (file.size / 1024 / 1024) * 1000 + 500; // +500ms overhead
        expect(uploadTime).toBeLessThan(expectedTime);
      }
    });
  });
});