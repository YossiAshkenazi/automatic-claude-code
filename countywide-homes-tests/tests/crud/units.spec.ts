import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { TestData } from '../helpers/test-data';

test.describe('Unit CRUD Operations', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.loginAsAdmin();
    await page.goto('/admin/units');
  });

  test('Create new unit', async ({ page }) => {
    await test.step('Open create unit modal', async () => {
      await page.click('[data-testid="add-unit-button"]');
      await expect(page.locator('.modal-title')).toContainText('Add New Unit');
    });

    await test.step('Fill unit details', async () => {
      await page.selectOption('[data-testid="unit-building"]', { index: 1 });
      await page.fill('[data-testid="unit-number"]', TestData.testUnit.unitNumber);
      await page.fill('[data-testid="unit-bedrooms"]', TestData.testUnit.bedrooms.toString());
      await page.fill('[data-testid="unit-bathrooms"]', TestData.testUnit.bathrooms.toString());
      await page.fill('[data-testid="unit-rent"]', TestData.testUnit.rentAmount.toString());
      await page.fill('[data-testid="unit-sqft"]', TestData.testUnit.squareFeet.toString());
      await page.selectOption('[data-testid="unit-status"]', TestData.testUnit.status);
    });

    await test.step('Save unit', async () => {
      await page.click('[data-testid="save-unit-button"]');
      await expect(page.locator('.toast-success')).toContainText('Unit created successfully');
    });

    await test.step('Verify unit in list', async () => {
      await page.waitForSelector(`text=${TestData.testUnit.unitNumber}`);
      const unitRow = page.locator(`tr:has-text("${TestData.testUnit.unitNumber}")`);
      await expect(unitRow).toBeVisible();
      await expect(unitRow.locator('text=Available')).toBeVisible();
    });
  });

  test('Update unit status', async ({ page }) => {
    await page.click(`tr:has-text("${TestData.testUnit.unitNumber}") >> [data-testid="edit-button"]`);

    await test.step('Change unit status', async () => {
      await page.selectOption('[data-testid="unit-status"]', 'occupied');
      await page.fill('[data-testid="unit-rent"]', '1600');
    });

    await test.step('Save changes', async () => {
      await page.click('[data-testid="save-unit-button"]');
      await expect(page.locator('.toast-success')).toContainText('Unit updated successfully');
    });

    await test.step('Verify updates', async () => {
      const unitRow = page.locator(`tr:has-text("${TestData.testUnit.unitNumber}")`);
      await expect(unitRow.locator('text=Occupied')).toBeVisible();
      await expect(unitRow.locator('text=$1,600')).toBeVisible();
    });
  });

  test('Delete unit', async ({ page }) => {
    await test.step('Check unit is vacant', async () => {
      const unitRow = page.locator(`tr:has-text("${TestData.testUnit.unitNumber}")`);
      const status = await unitRow.locator('[data-testid="unit-status"]').textContent();
      
      if (status !== 'Available') {
        await page.click(`tr:has-text("${TestData.testUnit.unitNumber}") >> [data-testid="edit-button"]`);
        await page.selectOption('[data-testid="unit-status"]', 'available');
        await page.click('[data-testid="save-unit-button"]');
        await page.waitForSelector('.toast-success');
      }
    });

    await test.step('Delete unit', async () => {
      await page.click(`tr:has-text("${TestData.testUnit.unitNumber}") >> [data-testid="delete-button"]`);
      await page.click('[data-testid="confirm-delete-button"]');
      await expect(page.locator('.toast-success')).toContainText('Unit deleted successfully');
    });
  });

  test('Filter units by status', async ({ page }) => {
    await test.step('Filter available units', async () => {
      await page.selectOption('[data-testid="filter-status"]', 'available');
      await page.click('[data-testid="apply-filters-button"]');
    });

    await test.step('Verify filtered results', async () => {
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('[data-testid="unit-status"]')).toContainText('Available');
      }
    });

    await test.step('Filter occupied units', async () => {
      await page.selectOption('[data-testid="filter-status"]', 'occupied');
      await page.click('[data-testid="apply-filters-button"]');
      
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('[data-testid="unit-status"]')).toContainText('Occupied');
      }
    });
  });

  test('Bulk update unit prices', async ({ page }) => {
    await test.step('Select multiple units', async () => {
      await page.check('tr:nth-child(1) >> input[type="checkbox"]');
      await page.check('tr:nth-child(2) >> input[type="checkbox"]');
      await page.check('tr:nth-child(3) >> input[type="checkbox"]');
    });

    await test.step('Open bulk edit modal', async () => {
      await page.click('[data-testid="bulk-actions-dropdown"]');
      await page.click('text=Bulk Edit');
      await expect(page.locator('.modal-title')).toContainText('Bulk Edit Units');
    });

    await test.step('Apply price increase', async () => {
      await page.fill('[data-testid="bulk-rent-increase"]', '50');
      await page.click('[data-testid="apply-bulk-changes-button"]');
      await expect(page.locator('.toast-success')).toContainText('3 units updated successfully');
    });
  });
});