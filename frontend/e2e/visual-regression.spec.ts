import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Study Config for consistent layout
    await page.route('**/api/studies/visual-test', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slug: 'visual-test',
          title: 'Visual Test Study',
          statements: [
            { id: 1, text: 'Short Statement' },
            { id: 2, text: 'Longer statement that might wrap across multiple lines to test the card height and rendering.' },
          ],
          grid_config: [
            { score: -1, capacity: 2 },
            { score: 0, capacity: 4 },
            { score: 1, capacity: 2 },
          ]
        })
      });
    });
  });

  test('Rough Sort Card Screenshot', async ({ page }) => {
    await page.goto('/study/visual-test/welcome');
    await page.check('#consent');
    await page.click('button:has-text("Start")');
    await page.waitForURL(/\/study\/visual-test\/presort/);
    await page.click('button:has-text("Next")');
    await page.waitForURL(/\/study\/visual-test\/sort\/rough/);

    // Wait for card stack to be stable
    await page.waitForSelector('.framer-motion-card', { state: 'visible' });
    
    // Take a snapshot of the card stack area
    const cardStack = page.locator('#card-stack-container');
    if (await cardStack.count() > 0) {
        await expect(cardStack).toHaveScreenshot('rough-sort-card.png');
    } else {
        // Fallback to whole page if id not found
        await expect(page).toHaveScreenshot('rough-sort-page.png');
    }
  });

  test('Fine Sort Grid Screenshot', async ({ page }) => {
    await page.goto('/study/visual-test/welcome');
    await page.check('#consent');
    await page.click('button:has-text("Start")');
    // Fast track to fine sort
    await page.goto('/study/visual-test/sort/fine');
    
    // Wait for grid
    await page.waitForSelector('[data-testid="grid-container"]');
    
    // Take a snapshot of the grid
    await expect(page.locator('[data-testid="grid-container"]')).toHaveScreenshot('fine-sort-grid.png');
  });
});
