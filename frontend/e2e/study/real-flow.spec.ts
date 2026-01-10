import { test, expect } from '../fixtures/db-setup';
import { testDataBuilders } from '../fixtures/test-data';
import { WelcomePage } from '../pages/WelcomePage';
import { ConsentPage } from '../pages/ConsentPage';
import { PreSortPage } from '../pages/PreSortPage';
import { RoughSortPage } from '../pages/RoughSortPage';
import { FineSortPage } from '../pages/FineSortPage';
import { PostSortPage } from '../pages/PostSortPage';

test.describe('Participant Flow (Real Backend)', () => {
    test('should complete the full study lifecycle and save data', async ({
        page,
        testDb,
        authToken
    }) => {
        // 1. Setup: Create a study with known configuration
        const studyData = testDataBuilders.study({
            title: 'Real Integration Study',
            statements: testDataBuilders.statements(6), // Small number for speed
            // Minimal grid for 6 statements: -1(2), 0(2), 1(2)
            grid_config: [
                { score: -1, capacity: 2 },
                { score: 0, capacity: 2 },
                { score: 1, capacity: 2 },
            ],
            presort_config: testDataBuilders.presortConfig({
                'age': testDataBuilders.presortField('number', 'Age', { required: true }),
                'gender': testDataBuilders.presortField('select', 'Gender', {
                    required: true,
                    options: ['Male', 'Female', 'Non-binary', 'Prefer not to say']
                }),
                'education': testDataBuilders.presortField('select', 'Education', {
                    required: true,
                    options: ['High School', 'Bachelor', 'Master', 'PhD']
                })
            }),
            state: 'active', // Ensure study is active for participant flow
            translations: [{
                language_code: 'en',
                title: 'Real Integration Study',
                description: 'A real integration study for E2E testing',
                instructions: 'Please follow the instructions.',
            }],
        });

        const study = await testDb.createStudy(authToken, studyData);
        expect(study.slug).toBeDefined();

        const welcomePage = new WelcomePage(page);
        const consentPage = new ConsentPage(page);
        const preSortPage = new PreSortPage(page);
        const roughSortPage = new RoughSortPage(page);
        const fineSortPage = new FineSortPage(page);
        const postSortPage = new PostSortPage(page);

        // 2. WELCOME
        // 2. WELCOME
        await welcomePage.visit(study.slug);
        await expect(page.getByRole('heading', { name: studyData.title, level: 1 })).toBeVisible();
        await welcomePage.startButton.first().click(); // Direct click instead of wait method for now to isolate issue

        // 3. CONSENT
        await consentPage.waitForLoad();
        await consentPage.acceptConsent();

        // 4. PRE-SORT
        await preSortPage.waitForLoad();
        // preSortPage.completePreSort() handles filling the fields (Age, Gender, Education)
        await preSortPage.completePreSort();

        // 5. ROUGH SORT
        await roughSortPage.waitForLoad();
        await roughSortPage.completeRoughSort(studyData.statements.length);

        // 6. FINE SORT
        await fineSortPage.waitForLoad();
        // Since we didn't mock Drag & Drop logic, we rely on the Page Object's logical sorting
        // Check if verifyLayout handles the drag and drop simulation or if we need to do it manually
        // For now, assuming page object helpers work or we might need to implement a robust sorter here
        // But for a "Smoke" test of infrastructure, let's try to complete it.
        // NOTE: FineSortPage.verifyLayout() checks elements. We need completeFineSort() logic.
        // If the Page Object doesn't support "Do the sort", we might need to extend it.
        // Checking existing FineSortPage... it seems to have verifyLayout but maybe not "performSort".
        // Use a simple filler strategy if needed.

        // Let's implement a simple "move all to grid" loop if the page object doesn't have one
        // Inspecting FineSortPage in next step if this fails. For now, assuming verifyLayout is a check, not an action.

        await fineSortPage.completeFineSort(studyData.statements.length); // Assuming this method exists or we create it

        // 7. M Post-Sort (if any)
        // Default study has no post-sort questions, so we should land on "Thank You" or similar
        // Or if there is a PostSortPage for feedback
        await expect(page).toHaveURL(/.*\/post-sort/);

        // 8. VERIFICATION: Check DB
        // We need to fetch submissions from the API using the admin token
        const submissions = await testDb.getSubmissions(authToken, study.id);
        expect(submissions).toHaveLength(1);
        expect(submissions[0].presort_data).toEqual({ 'age': 25 });
        expect(submissions[0].is_complete).toBe(true);
    });
});
