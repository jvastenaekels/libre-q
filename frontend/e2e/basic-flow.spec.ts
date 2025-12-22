import { test, expect } from '@playwright/test';

test.describe('Basic Study Flow', () => {
  test('should complete the study flow from welcome to fine sort', async ({ page }) => {
    // 0. Mock API response for Study Config
    await page.route('**/api/study/demo*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slug: 'demo',
          title: 'Demo Study',
          description: 'A demo study for E2E testing',
          instructions: 'Please follow the instructions.',
          statements: [
            { id: 1, text: 'Statement 1' },
            { id: 2, text: 'Statement 2' },
            { id: 3, text: 'Statement 3' },
          ],
          grid_config: [
            { score: -1, capacity: 1 },
            { score: 0, capacity: 1 },
            { score: 1, capacity: 1 },
          ]
        })
      });
    });

    await page.route('**/api/studies/demo', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slug: 'demo',
          title: 'Demo Study',
          description: 'A demo study for E2E testing',
          instructions: 'Please follow the instructions.',
          statements: [
            { id: 1, text: 'Statement 1' },
            { id: 2, text: 'Statement 2' },
            { id: 3, text: 'Statement 3' },
          ],
          grid_config: [
            { score: -1, capacity: 1 },
            { score: 0, capacity: 1 },
            { score: 1, capacity: 1 },
          ]
        })
      });
    });

    // 1. Go directly to Study Welcome
    await page.goto('/study/demo/welcome');

    // 3. Welcome Page
    await expect(page).toHaveURL(/\/study\/demo\/welcome/);
    await page.waitForSelector('h1');
    await expect(page.locator('h1')).toContainText('Demo Study');
    
    // Check consent and start
    await page.check('#consent');
    await page.click('button:has-text("Start")');

    // 4. Pre-Sort Page (Step 2)
    await expect(page).toHaveURL(/\/study\/demo\/presort/);
    // Wait for content (mock might be needed for other endpoints if they are called)
    // For now, let's assume it works or mock as we go.
    // In our app, PreSort might call other APIs.
    await page.click('button:has-text("Next")');

    // 5. Rough Sort (Step 3)
    await expect(page).toHaveURL(/\/study\/demo\/sort\/rough/);
    
    // Sort all 3 statements
    // We can click the buttons
    for (let i = 0; i < 3; i++) {
        await page.click('button[aria-label="Agree"]');
        // Wait a bit for transition?
        await page.waitForTimeout(500); 
    }

    // Rough Sort Complete
    await expect(page.locator('h2')).toContainText('Rough sorting complete');
    await page.click('button:has-text("Next")');

    // 6. Fine Sort (Step 4)
    await expect(page).toHaveURL(/\/study\/demo\/sort\/fine/);
    
    // Verify Card 1 is in the deck
    await expect(page.locator('text=Statement 1')).toBeVisible();

    // Interaction Performance check? No, just functional for now.
    // Place Card 1 into Slot 0,0
    await page.click('text=Statement 1');
    await page.click('[data-testid="slot_0_0"]');

    // Verify Card 1 moved to Grid
    await expect(page.locator('[data-testid="card-1"]')).toBeVisible();
  });
});
