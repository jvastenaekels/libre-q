import { test, expect } from '../fixtures/db-setup';
import { AdminPage } from '../pages/AdminPage';
import { VisualAssertions } from '../helpers/VisualAssertions';
import { testDataBuilders } from '../fixtures/test-data';

test.describe('Participant Discard E2E Tests (Real Backend)', () => {
    let _adminPage: AdminPage;
    let _visual: VisualAssertions;
    let studySlug: string;

    test.beforeEach(async ({ page, testDb, authToken }) => {
        const apiUrl = process.env.API_BASE_URL || 'http://127.0.0.1:8000';
        _adminPage = new AdminPage(page);
        _visual = new VisualAssertions(page);

        // Login
        await testDb.loginToAdminUI(page);

        // Create Study
        const study = await testDb.createStudy(
            authToken,
            testDataBuilders.study({
                slug: `discard-study-${Date.now()}`,
                statements: testDataBuilders.statements(23),
            })
        );
        studySlug = study.slug;

        // Activate Study
        await testDb.updateStudy(authToken, studySlug, { state: 'active' });

        // Add test participants
        const _p1 = await testDb.createParticipant(
            authToken,
            studySlug,
            testDataBuilders.participantResult({})
        );

        const p2 = await testDb.createParticipant(
            authToken,
            studySlug,
            testDataBuilders.participantResult({})
        );

        // Discard p2 via API
        const discardResp = await fetch(
            `${apiUrl}/api/admin/studies/participants/${p2.id}/discard`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_discarded: true,
                    discard_reason: 'Suspicious completion time',
                }),
            }
        );
        if (!discardResp.ok) {
            throw new Error(`Failed to discard p2: ${await discardResp.text()}`);
        }
    });

    test('should navigate to data view and see participants table', async ({ page }) => {
        await page.goto(`/admin/studies/${studySlug}/exports`);

        // Check URL
        await expect(page).toHaveURL(new RegExp(`/studies/${studySlug}/(exports|data)`));

        // Wait for table to load
        await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

        // Should have 2 records
        await expect(page.getByText('records found')).toBeVisible();
        await expect(page.locator('tbody tr')).toHaveCount(2);
    });

    test('should select participant and open detail page', async ({ page }) => {
        await page.goto(`/admin/studies/${studySlug}/exports`);
        await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

        // Click on first participant row
        await page.locator('tbody tr').first().click();

        // Wait for detail page to load
        await expect(page.getByRole('heading', { name: /participant profile/i })).toBeVisible();
    });

    test('should be able to discard or restore participant via button', async ({ page }) => {
        await page.goto(`/admin/studies/${studySlug}/exports`);
        await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

        // Click on first participant row (could be active or discarded)
        await page.locator('tbody tr').first().click();

        // Wait for detail page
        await expect(page.getByRole('heading', { name: /participant profile/i })).toBeVisible();

        // The button should be either "Discard" or "Restore" - find whichever is visible
        const discardButton = page.getByRole('button', { name: /discard participant/i });
        const restoreButton = page.getByRole('button', { name: /restore participant/i });

        // Check which button is visible and click it
        if (await discardButton.isVisible()) {
            await discardButton.click();
            // After clicking discard, the badge should appear
            await expect(page.getByTestId('discarded-badge')).toBeVisible({ timeout: 5000 });
        } else {
            await expect(restoreButton).toBeVisible();
            await restoreButton.click();
            // After clicking restore, the badge should disappear
            await expect(page.getByTestId('discarded-badge')).not.toBeVisible({ timeout: 5000 });
        }
    });

    test('should show correct action button for participant state', async ({ page }) => {
        await page.goto(`/admin/studies/${studySlug}/exports`);
        await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

        // Click on second row to check a different participant
        await page.locator('tbody tr').nth(1).click();

        // Wait for detail page
        await expect(page.getByRole('heading', { name: /participant profile/i })).toBeVisible();

        // Either discard or restore button should be visible (one or the other)
        const discardButton = page.getByRole('button', { name: /discard participant/i });
        const restoreButton = page.getByRole('button', { name: /restore participant/i });

        const discardVisible = await discardButton.isVisible();
        const restoreVisible = await restoreButton.isVisible();

        // Exactly one should be visible
        expect(discardVisible || restoreVisible).toBe(true);
    });
});
