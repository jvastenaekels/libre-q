import { test, expect } from '@playwright/test';

test.describe('Study Completion Flow', () => {
    test('complete study from landing to submission', async ({ page }) => {
        // 1. Landing Page
        await page.goto('/');
        await expect(page.getByText('Q-Method')).toBeVisible();
        
        await page.getByLabel('Study Code').fill('complex-study');
        await page.getByRole('button', { name: 'Go to Study' }).click();

        // 2. Welcome Page
        await expect(page).toHaveURL(/\/study\/complex-study\/welcome/);
        
        // 3. Consent
        // The Welcome page has a consent checkbox that must be clicked.
        await page.getByRole('checkbox', { name: /consent/i }).check();
        
        // Click Start Study (button is enabled after consent)
        // Text is likely "Start Study" or "Get Started" based on locale
        await page.getByRole('button', { name: /start study/i }).click();
        
        // 4. Pre-Sort
        await expect(page).toHaveURL(/\/study\/complex-study\/presort/);
        
        // Form should be rendered now. Fill required fields.
        await page.getByLabel('Age').fill('30');
        await page.getByLabel('Gender').selectOption('Male'); // Value in seed is "Male"
        
        // Button text is "Continue to sorting" (en.json)
        // Use exact match to avoid matching "Rough sort" in stepper
        await page.getByRole('button', { name: 'Continue to sorting' }).click();

        // 5. Rough Sort
        await expect(page).toHaveURL(/\/study\/complex-study\/rough-sort/);
        
        // Programmatically sort to save time (40 cards)
        await page.evaluate(() => {
            const store = (window as any).useStudyStore.getState();
            const statementIds = store.config.statements.map((s: any) => s.id);
            
            // Put all in 'neutral' for simplicity of rough sort
            // categorizeCard pushes to array.
            // But we can just set state directly for speed if actions are slow.
            // Using actions is safer.
            statementIds.forEach((id: number) => {
                store.categorizeCard(id, 'neutral');
            });
        });
        
        // Verify UI updated (Advance to next step is enabled?)
        // Verify UI updated (Advance to next step is enabled?)
        // Or manually click Next.
        // Check if "Next step" button is enabled.
        await expect(page.getByRole('button', { name: 'Next step' })).toBeEnabled();
        await page.getByRole('button', { name: 'Next step' }).click();

        // 6. Fine Sort
        await expect(page).toHaveURL(/\/study\/complex-study\/sort/);
        
        // Programmatically place cards to match grid capacity
        await page.evaluate(() => {
            const store = (window as any).useStudyStore.getState();
            const config = store.config;
            const roughIds = store.responses.rough.neutral; // Array of IDs
            const statements = roughIds.map((id: number) => config.statements.find((s: any) => s.id === id)).filter(Boolean);
            
            let cardIndex = 0;
            // Fill grid column by column
            // We must respect capacity.
            const gridConfig = config.grid_config;
            
            // Handle if grid_config is Array (now fixed in seed)
            if (Array.isArray(gridConfig)) {
                 gridConfig.forEach((colDef: any, colIndex: number) => {
                     for (let r = 0; r < colDef.capacity; r++) {
                         if (cardIndex < statements.length) {
                             store.placeCardInGrid(statements[cardIndex], colIndex, r);
                             cardIndex++;
                         }
                     }
                 });
            } else {
                console.error('Grid config is not an array!');
            }
        });
        
        // Actually, let's fix the selector first.
        // If the App is broken, test will fail differently.
        
        // Updating Selectors:
        await expect(page.getByTitle('Ready to review')).toBeVisible();
        await page.getByRole('button', { name: 'Validate' }).click();

        // 7. Post Sort
        await expect(page).toHaveURL(/\/study\/complex-study\/post-sort/);
        
        // Fill required comments for extreme cards (-4, +4).
        // We placed cards linearly. 
        // We need to identify which cards are in extreme columns.
        // We can just find the textareas and fill them.
        
        const textareas = page.locator('textarea');
        const count = await textareas.count();
        for (let i = 0; i < count; i++) {
             await textareas.nth(i).fill('This is a test comment with sufficient length.');
        }
        
        // Submit
        await page.getByRole('button', { name: 'Submit' }).click();

        // 8. Success
        await expect(page.getByText('Thank You!')).toBeVisible();
        await expect(page.getByText('Confirmation Code')).toBeVisible();
    });
});
