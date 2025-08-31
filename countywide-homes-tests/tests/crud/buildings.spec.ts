import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { TestData } from '../helpers/test-data';

test.describe('Building CRUD Operations', () => {
  let authHelper: AuthHelper;
  let buildingId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.loginAsAdmin();
    await page.goto('/admin/buildings');
  });

  test('Create new building', async ({ page }) => {
    await test.step('Open create building modal', async () => {
      await page.click('[data-testid="add-building-button"]');
      await expect(page.locator('.modal-title')).toContainText('Add New Building');
    });

    await test.step('Fill building details', async () => {
      await page.fill('[data-testid="building-name"]', TestData.testBuilding.name);
      await page.fill('[data-testid="building-address"]', TestData.testBuilding.address);
      await page.fill('[data-testid="building-city"]', TestData.testBuilding.city);
      await page.selectOption('[data-testid="building-state"]', TestData.testBuilding.state);
      await page.fill('[data-testid="building-zip"]', TestData.testBuilding.zipCode);
      await page.fill('[data-testid="building-units"]', TestData.testBuilding.units.toString());
    });

    await test.step('Save building', async () => {
      await page.click('[data-testid="save-building-button"]');
      await expect(page.locator('.toast-success')).toContainText('Building created successfully');
    });

    await test.step('Verify building in list', async () => {
      await page.waitForSelector(`text=${TestData.testBuilding.name}`);
      const buildingRow = page.locator(`tr:has-text("${TestData.testBuilding.name}")`);
      await expect(buildingRow).toBeVisible();
      buildingId = await buildingRow.getAttribute('data-building-id') || '';
    });
  });

  test('Read building details', async ({ page }) => {
    await test.step('Search for building', async () => {
      await page.fill('[data-testid="search-buildings"]', TestData.testBuilding.name);
      await page.press('[data-testid="search-buildings"]', 'Enter');
    });

    await test.step('View building details', async () => {
      await page.click(`text=${TestData.testBuilding.name}`);
      await expect(page).toHaveURL(/\/admin\/buildings\/\d+/);
    });

    await test.step('Verify building information', async () => {
      await expect(page.locator('[data-testid="building-name-display"]')).toContainText(TestData.testBuilding.name);
      await expect(page.locator('[data-testid="building-address-display"]')).toContainText(TestData.testBuilding.address);
      await expect(page.locator('[data-testid="building-units-display"]')).toContainText(TestData.testBuilding.units.toString());
    });
  });

  test('Update building information', async ({ page }) => {
    await page.click(`tr:has-text("${TestData.testBuilding.name}") >> [data-testid="edit-button"]`);

    await test.step('Modify building details', async () => {
      await page.fill('[data-testid="building-name"]', 'Updated Building Name');
      await page.fill('[data-testid="building-units"]', '15');
    });

    await test.step('Save changes', async () => {
      await page.click('[data-testid="save-building-button"]');
      await expect(page.locator('.toast-success')).toContainText('Building updated successfully');
    });

    await test.step('Verify updates', async () => {
      await expect(page.locator('text=Updated Building Name')).toBeVisible();
      await expect(page.locator('tr:has-text("Updated Building Name") >> text=15')).toBeVisible();
    });
  });

  test('Delete building', async ({ page }) => {
    await test.step('Initiate deletion', async () => {
      await page.click(`tr:has-text("${TestData.testBuilding.name}") >> [data-testid="delete-button"]`);
      await expect(page.locator('.modal-title')).toContainText('Confirm Deletion');
    });

    await test.step('Confirm deletion', async () => {
      await page.click('[data-testid="confirm-delete-button"]');
      await expect(page.locator('.toast-success')).toContainText('Building deleted successfully');
    });

    await test.step('Verify building removed', async () => {
      await page.waitForTimeout(1000);
      await expect(page.locator(`text=${TestData.testBuilding.name}`)).not.toBeVisible();
    });
  });

  test('Bulk operations on buildings', async ({ page }) => {
    await test.step('Select multiple buildings', async () => {
      await page.check('tr:nth-child(1) >> input[type="checkbox"]');
      await page.check('tr:nth-child(2) >> input[type="checkbox"]');
      await page.check('tr:nth-child(3) >> input[type="checkbox"]');
    });

    await test.step('Perform bulk action', async () => {
      await page.click('[data-testid="bulk-actions-dropdown"]');
      await page.click('text=Export Selected');
      await expect(page.locator('.toast-success')).toContainText('3 buildings exported');
    });
  });

  test('Filter and sort buildings', async ({ page }) => {
    await test.step('Apply filters', async () => {
      await page.selectOption('[data-testid="filter-state"]', 'CA');
      await page.selectOption('[data-testid="filter-status"]', 'active');
      await page.click('[data-testid="apply-filters-button"]');
    });

    await test.step('Verify filtered results', async () => {
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('text=CA')).toBeVisible();
      }
    });

    await test.step('Sort by name', async () => {
      await page.click('th:has-text("Name")');
      await page.waitForTimeout(500);
      
      const names = await page.locator('tbody tr td:first-child').allTextContents();
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  test('Validation errors on building form', async ({ page }) => {
    await page.click('[data-testid="add-building-button"]');

    await test.step('Submit empty form', async () => {
      await page.click('[data-testid="save-building-button"]');
      await expect(page.locator('.field-error')).toContainText('Building name is required');
    });

    await test.step('Invalid zip code', async () => {
      await page.fill('[data-testid="building-name"]', 'Test Building');
      await page.fill('[data-testid="building-zip"]', 'invalid');
      await page.click('[data-testid="save-building-button"]');
      await expect(page.locator('.field-error')).toContainText('Invalid zip code');
    });

    await test.step('Negative unit count', async () => {
      await page.fill('[data-testid="building-units"]', '-5');
      await page.click('[data-testid="save-building-button"]');
      await expect(page.locator('.field-error')).toContainText('Units must be greater than 0');
    });
  });
});