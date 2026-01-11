import { test, expect } from '../fixtures/db-setup';
import { AdminPage } from '../pages/AdminPage';
import { testDataBuilders } from '../fixtures/test-data';

test.describe('Admin Flow (Real Backend)', () => {
    let adminPage: AdminPage;

    test.beforeEach(async ({ page }) => {
        adminPage = new AdminPage(page);
    });

    test('Zero to Hero: Full Lifecycle', async ({ page, testDb, authToken }) => {
        // 1. LOGIN (Handled by authToken/testDb mostly, but we can do UI login if needed)
        // For "Zero to Hero" we usually want to test the UI flow from scratch.
        // But authToken helper helps us get a valid user created.
        // Let's use the UI login with the user created by testDb.

        // testDb.createStudy is not needed if we create via UI, but we need a user.
        // The fixture `auth_token` creates a user and workspace.
        await testDb.loginToAdminUI(page);

        // 2. CREATE STUDY
        await adminPage.createStudy('Zero Hero Study', 'zero-hero');

        // 3. CONFIGURE
        await adminPage.configureQSort(['S1', 'S2', 'S3']);

        // 4. ACTIVATE
        await adminPage.launchStudy();
        await adminPage.verifyStatus('Active');

        // 5. DATA SIMULATION
        // We need to inject a participant via API/DB because we can't easily simulate a separate browser user here efficiently
        // (though we could open a context, but let's use testDb for speed)
        await testDb.createParticipant(authToken, 'zero-hero', testDataBuilders.participantResult());

        await page.reload();
        // Verify participant visible
        // Wait for table
        await expect(page.locator('table')).toBeVisible();
        await expect(page.locator('text=Completed')).toBeVisible();

        // 6. EXPORT
        await adminPage.exportCSV();

        // 7. CLOSE
        await adminPage.closeStudy('zero-hero');

        // 8. LOGOUT
        await adminPage.logout();
    });
});
