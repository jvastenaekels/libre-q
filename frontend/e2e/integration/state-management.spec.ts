import { test, expect } from '../../fixtures/db-setup';
import { testDataBuilders } from '../../fixtures/test-data';

/**
 * Integration Testing: State Management Flows
 *
 * Verifies that study state transitions work correctly and
 * affect participant access appropriately.
 */

test.describe('State Management Flow Tests', () => {
    test.describe('Study State Transitions', () => {
        test('Draft → Active → Paused → Active → Closed flow', async ({ page, testDb, authToken }) => {
            // 1. Create study in draft state
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-state-flow-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                state: 'draft',
            }));

            // 2. Verify participant cannot access draft study
            await page.goto(`/study/${study.slug}`);
            await expect(page.locator('text=not available', { hasText: /not.*available|unavailable/i })).toBeVisible();

            // 3. Activate study
            await testDb.updateStudy(authToken, study.slug, { state: 'active' });

            // 4. Verify participant can now access
            await page.goto(`/study/${study.slug}`);
            await expect(page.locator('button:has-text("Accept", "Start")')).toBeVisible();

            // 5. Pause study
            await testDb.updateStudy(authToken, study.slug, { state: 'paused' });

            // 6. Verify participant cannot access paused study
            await page.goto(`/study/${study.slug}`);
            await expect(page.locator('text=paused', {  hasText: /paused|temporarily.*unavailable/i })).toBeVisible();

            // 7. Reactivate
            await testDb.updateStudy(authToken, study.slug, { state: 'active' });
            await page.goto(`/study/${study.slug}`);
            await expect(page.locator('button:has-text("Accept")')).toBeVisible();

            // 8. Close study
            await testDb.updateStudy(authToken, study.slug, { state: 'closed' });

            // 9. Verify participant cannot access closed study
            await page.goto(`/study/${study.slug}`);
            await expect(page.locator('text=closed', { hasText: /closed|ended/i })).toBeVisible();
        });

        test('In-progress participant session persists across page reloads', async ({ page, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-session-persist-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                state: 'active',
            }));

            // Start study
            await page.goto(`/study/${study.slug}`);
            await page.click('button:has-text("Accept")');

            // Navigate to a specific step (e.g., rough sort)
            const currentUrl = page.url();

            // Reload page
            await page.reload();

            // Verify we're still at the same step
            await expect(page).toHaveURL(currentUrl);
        });

        test('Study state change in Admin reflects immediately in participant view', async ({ context, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-state-sync-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                state: 'active',
            }));

            // Open two pages: Admin and Participant
            const adminPage = await context.newPage();
            const participantPage = await context.newPage();

            // Admin: Login and navigate to study
            await adminPage.goto('/admin');
            await adminPage.fill('input[name="username"]', 'test@example.com');
            await adminPage.fill('input[name="password"]', 'testpassword');
            await adminPage.click('button[type="submit"]');
            await adminPage.click(`text=${study.slug}`);

            // Participant: Access study
            await participantPage.goto(`/study/${study.slug}`);
            await expect(participantPage.locator('button:has-text("Accept")')).toBeVisible();

            // Admin: Pause study
            await adminPage.click('button:has-text("Pause Study")');
            await adminPage.click('button:has-text("Confirm")');

            // Participant: Refresh and verify study is now paused
            await participantPage.reload();
            await expect(participantPage.locator('text=paused')).toBeVisible();

            await adminPage.close();
            await participantPage.close();
        });
    });

    test.describe('Configuration Updates', () => {
        test('Configuration changes do not affect ongoing participant sessions', async ({ context, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-config-isolation-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                state: 'active',
            }));

            // Participant starts study
            const participantPage = await context.newPage();
            await participantPage.goto(`/study/${study.slug}`);
            await participantPage.click('button:has-text("Accept")');

            // Capture original UI labels
            const originalLabel = await participantPage.locator('button').first().textContent();

            // Admin updates UI labels
            await testDb.updateStudy(authToken, study.slug, {
                translations: [{
                    language_code: 'en',
                    title: 'Updated Study',
                    ui_labels: {
                        agree: 'UPDATED AGREE',
                        disagree: 'UPDATED DISAGREE',
                    },
                }],
            });

            // Participant session should still show original labels
            // (until page reload or new session)
            const currentLabel = await participantPage.locator('button').first().textContent();
            expect(currentLabel).toBe(originalLabel);

            await participantPage.close();
        });

        test('New participants get updated configuration', async ({ context, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-new-config-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                state: 'active',
            }));

            // Update configuration
            await testDb.updateStudy(authToken, study.slug, {
                translations: [{
                    language_code: 'en',
                    title: 'Updated Study',
                    ui_labels: {
                        agree: 'NEW AGREE LABEL',
                    },
                }],
            });

            // New participant session
            const participantPage = await context.newPage();
            await participantPage.goto(`/study/${study.slug}`);
            await participantPage.click('button:has-text("Accept")');

            // Verify new labels appear
            await expect(participantPage.locator('button:has-text("NEW AGREE LABEL")')).toBeVisible();

            await participantPage.close();
        });
    });

    test.describe('Data Persistence', () => {
        test('Participant progress saved and recoverable', async ({ page, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-progress-save-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                presort_config: testDataBuilders.presortConfig({
                    'name': testDataBuilders.presortField('text', 'Name', { required: true }),
                }),
                state: 'active',
            }));

            // Fill presort
            await page.goto(`/study/${study.slug}`);
            await page.click('button:has-text("Accept")');
            await page.fill('input[name="name"]', 'Test Participant');
            await page.click('button:has-text("Continue")');

            // Verify we're at rough sort
            await expect(page).toHaveURL(/rough-sort/);

            // Reload page
            await page.reload();

            // Should still be at rough sort (progress saved)
            await expect(page).toHaveURL(/rough-sort/);
        });

        test('Study submission creates participant record', async ({ page, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-submission-record-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                state: 'active',
            }));

            // Complete study
            await page.goto(`/study/${study.slug}`);
            // ... complete entire flow ...

            // Verify submission was recorded in database
            // (Implementation-specific: may need to query participants endpoint)
            const participants = await fetch(`${testDb.baseUrl}/api/admin/studies/${study.slug}/participants`, {
                headers: { 'Authorization': `Bearer ${await testDb.login()}` },
            }).then(r => r.json());

            expect(participants.length).toBeGreaterThan(0);
        });
    });
});
