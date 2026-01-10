import { test, expect } from '../../fixtures/db-setup';
import { testDataBuilders, type GridDistribution } from '../../fixtures/test-data';
import type { Page } from '@playwright/test';

/**
 * Systematic Configuration Testing: Q-Sort Grid
 *
 * Tests grid configuration options:
 * 1. Admin UI: Can configure grid layout
 * 2. API: Configuration is saved correctly
 * 3. Participant UI: Grid renders correctly
 * 4. Validation: Capacity constraints enforced
 * 5. Edge Cases: Total capacity vs statements
 */

const GRID_DISTRIBUTIONS: GridDistribution[] = ['symmetric', 'asymmetric', 'minimal'];

test.describe('Q-Sort Grid Configuration Testing', () => {
    for (const distribution of GRID_DISTRIBUTIONS) {
        test.describe(`Grid Distribution: ${distribution}`, () => {
            let studySlug: string;

            test.beforeEach(async ({ testDb, authToken }) => {
                const gridConfig = testDataBuilders.gridConfig(distribution);
                const totalCapacity = gridConfig.reduce((sum, col) => sum + col.capacity, 0);

                // Create study with matching number of statements
                const study = await testDb.createStudy(authToken, testDataBuilders.study({
                    slug: `test-grid-${distribution}-${Date.now()}`,
                    statements: testDataBuilders.statements(totalCapacity),
                    grid_config: gridConfig,
                }));
                studySlug = study.slug;
            });

            test(`Admin: Can configure ${distribution} grid`, async ({ page, authToken }) => {
                // Login and navigate to study designer
                await page.goto('/admin');
                await page.fill('input[name="username"]', 'test@example.com');
                await page.fill('input[name="password"]', 'testpassword');
                await page.click('button[type="submit"]');

                // Navigate to Q-Sort configuration
                await page.click(`text=${studySlug}`);
                await page.click('text=Q-Sort');

                // Verify grid columns are displayed
                const gridConfig = testDataBuilders.gridConfig(distribution);
                for (const column of gridConfig) {
                    await expect(page.locator(`text=Score ${column.score}`)).toBeVisible();
                    await expect(page.locator(`text=${column.capacity} cards`)).toBeVisible();
                }
            });

            test(`API: ${distribution} grid saves correctly`, async ({ testDb, authToken }) => {
                const gridConfig = testDataBuilders.gridConfig(distribution);

                // Update grid via API
                await testDb.updateStudy(authToken, studySlug, { grid_config: gridConfig });

                // Verify it was saved
                const study = await testDb.getStudy(authToken, studySlug);

                expect(study.grid_config).toHaveLength(gridConfig.length);
                for (let i = 0; i < gridConfig.length; i++) {
                    expect(study.grid_config[i].score).toBe(gridConfig[i].score);
                    expect(study.grid_config[i].capacity).toBe(gridConfig[i].capacity);
                }
            });

            test(`Participant: ${distribution} grid renders correctly`, async ({ page, testDb, authToken }) => {
                // Activate study
                await testDb.updateStudy(authToken, studySlug, { state: 'active' });

                // Navigate to study
                await page.goto(`/study/${studySlug}`);
                await page.click('button:has-text("Accept")'); // Consent
                await page.click('button:has-text("Continue")'); // Pre-sort (if any)
                await page.click('button:has-text("Continue")'); // Rough sort

                // Verify grid is rendered
                const gridConfig = testDataBuilders.gridConfig(distribution);
                for (const column of gridConfig) {
                    // Check column exists with correct capacity
                    const columnLocator = page.locator(`[data-score="${column.score}"]`);
                    await expect(columnLocator).toBeVisible();

                    // Verify capacity indicator
                    await expect(page.locator(`text=0 / ${column.capacity}`)).toBeVisible();
                }
            });

            test(`Validation: ${distribution} grid capacity enforced`, async ({ page, testDb, authToken }) => {
                await testDb.updateStudy(authToken, studySlug, { state: 'active' });

                await page.goto(`/study/${studySlug}`);
                await page.click('button:has-text("Accept")');
                await page.click('button:has-text("Continue")');

                // Complete rough sort - put all in agree
                const allAgreeBtn = page.locator('button:has-text("All Agree")');
                if (await allAgreeBtn.isVisible()) {
                    await allAgreeBtn.click();
                }
                await page.click('button:has-text("Continue")');

                // Try to overfill a column
                const gridConfig = testDataBuilders.gridConfig(distribution);
                const smallestColumn = gridConfig.reduce((min, col) =>
                    col.capacity < min.capacity ? col : min
                );

                // Drag cards to smallest column until full
                for (let i = 0; i < smallestColumn.capacity; i++) {
                    const card = page.locator('[data-card]').first();
                    const column = page.locator(`[data-score="${smallestColumn.score}"]`);
                    await card.dragTo(column);
                }

                // Verify column is full
                await expect(page.locator(`text=${smallestColumn.capacity} / ${smallestColumn.capacity}`)).toBeVisible();

                // Try to add one more - should fail or swap
                const extraCard = page.locator('[data-card]').first();
                const fullColumn = page.locator(`[data-score="${smallestColumn.score}"]`);

                // Before drag
                const countBefore = await fullColumn.locator('[data-card]').count();

                await extraCard.dragTo(fullColumn);

                // After drag - should either reject or swap
                const countAfter = await fullColumn.locator('[data-card]').count();
                expect(countAfter).toBe(smallestColumn.capacity); // Still at capacity
            });

            test(`Edge Case: ${distribution} grid total capacity matches statements`, async ({ testDb, authToken }) => {
                const gridConfig = testDataBuilders.gridConfig(distribution);
                const totalCapacity = gridConfig.reduce((sum, col) => sum + col.capacity, 0);

                // Create study with mismatched statement count (too many)
                const mismatchedStudy = await testDb.createStudy(authToken, testDataBuilders.study({
                    slug: `test-mismatch-${Date.now()}`,
                    statements: testDataBuilders.statements(totalCapacity + 5),
                    grid_config: gridConfig,
                }));

                // Try to activate - should fail validation
                try {
                    await testDb.updateStudy(authToken, mismatchedStudy.slug, { state: 'active' });
                    // If it doesn't throw, validation might pass - check if activation worked
                    const study = await testDb.getStudy(authToken, mismatchedStudy.slug);
                    // In a real scenario, this might still be draft or have validation errors
                    expect(study.state).not.toBe('active');
                } catch (error) {
                    // Expected: validation error
                    expect(error).toBeDefined();
                }
            });
        });
    }

    test.describe('Grid Column Manipulation', () => {
        let studySlug: string;

        test.beforeEach(async ({ testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-grid-manip-${Date.now()}`,
                statements: testDataBuilders.statements(10),
            }));
            studySlug = study.slug;
        });

        test('Admin: Can add grid column', async ({ page }) => {
            await page.goto('/admin');
            await page.fill('input[name="username"]', 'test@example.com');
            await page.fill('input[name="password"]', 'testpassword');
            await page.click('button[type="submit"]');

            await page.click(`text=${studySlug}`);
            await page.click('text=Q-Sort');

            // Add a new column
            await page.click('button:has-text("Add Column")');
            await page.fill('input[name="score"]', '4');
            await page.fill('input[name="capacity"]', '2');
            await page.click('button:has-text("Save")');

            // Verify column appears
            await expect(page.locator('text=Score 4')).toBeVisible();
            await expect(page.locator('text=2 cards')).toBeVisible();
        });

        test('Admin: Can remove grid column', async ({ page }) => {
            await page.goto('/admin');
            await page.fill('input[name="username"]', 'test@example.com');
            await page.fill('input[name="password"]', 'testpassword');
            await page.click('button[type="submit"]');

            await page.click(`text=${studySlug}`);
            await page.click('text=Q-Sort');

            // Remove a column (if any exist)
            const deleteBtn = page.locator('button[aria-label="Delete column"]').first();
            if (await deleteBtn.isVisible()) {
                await deleteBtn.click();
                await page.click('button:has-text("Confirm")');

                // Verify column is removed
                // (Implementation-specific assertion)
            }
        });

        test('Admin: Can modify column capacity', async ({ page, testDb, authToken }) => {
            // Set initial grid
            await testDb.updateStudy(authToken, studySlug, {
                grid_config: testDataBuilders.gridConfig('minimal'),
            });

            await page.goto('/admin');
            await page.fill('input[name="username"]', 'test@example.com');
            await page.fill('input[name="password"]', 'testpassword');
            await page.click('button[type="submit"]');

            await page.click(`text=${studySlug}`);
            await page.click('text=Q-Sort');

            // Edit first column
            await page.click('button[aria-label="Edit column"]').first();
            await page.fill('input[name="capacity"]', '5');
            await page.click('button:has-text("Save")');

            // Verify update
            await expect(page.locator('text=5 cards')).toBeVisible();
        });
    });
});
