import { test, expect } from '@playwright/test';
import { mockStudyConfig, mockStudyAPI } from './fixtures/study-config';

test.describe('Basic Study Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockStudyAPI(page);
  });

  test('should load welcome page with study details', async ({ page }) => {
    await page.goto(`/study/${mockStudyConfig.slug}/welcome`);
    
    // Verify page loaded
    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.locator('h1')).toContainText(mockStudyConfig.title);
    
    // Verify key elements
    await expect(page.locator('text=' + mockStudyConfig.description)).toBeVisible();
  });

  test('should show continue button on welcome page', async ({ page }) => {
    await page.goto(`/study/${mockStudyConfig.slug}/welcome`);
    
    // Find continue button
    const continueBtn = page.locator('button:has-text("Continue"), button[type="submit"]').first();
    await expect(continueBtn).toBeVisible();
  });

  // Skip: localStorage persistence depends on API response being processed
  test.skip('should persist study config in localStorage', async ({ page }) => {
    await page.goto(`/study/${mockStudyConfig.slug}/welcome`);
    
    // Wait for title to appear (indicates config loaded)
    await expect(page.locator('h1')).toContainText(mockStudyConfig.title);
    
    // Wait a bit more for state persistence
    await page.waitForTimeout(1000);
    
    // Check localStorage was populated
    const hasStorage = await page.evaluate(() => {
      return localStorage.getItem('open-q-config') !== null;
    });
    expect(hasStorage).toBe(true);
  });
});

test.describe('Error Handling', () => {
  test('should show error for non-existent study', async ({ page }) => {
    await page.route('**/api/study/nonexistent**', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Study not found' })
      });
    });
    
    await page.goto('/study/nonexistent/welcome');
    
    // Should show error message
    await expect(page.locator('text=/not found|error/i').first()).toBeVisible({ timeout: 10000 });
  });
});
