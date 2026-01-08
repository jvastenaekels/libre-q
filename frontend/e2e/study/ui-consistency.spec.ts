/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockSubmitAPI } from '../fixtures/study-config';
import { WelcomePage } from '../pages/WelcomePage';
import { ConsentPage } from '../pages/ConsentPage';
import { PreSortPage } from '../pages/PreSortPage';
import { RoughSortPage } from '../pages/RoughSortPage';
import { FineSortPage } from '../pages/FineSortPage';
import { PostSortPage } from '../pages/PostSortPage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load base example study
const studyJsonPath = path.resolve(__dirname, '../../../backend/data/example-study.json');
const rawStudy = JSON.parse(fs.readFileSync(studyJsonPath, 'utf-8'));

// Helper to synthesize frontend-ready config
const createMockConfig = (overrides: any = {}) => {
    const statements = rawStudy.statements.map((s: any, index: number) => ({
        id: index + 1,
        text: s.translations.en,
        code: s.code,
    }));

    return {
        ...rawStudy,
        title: rawStudy.translations.en.title,
        subtitle: rawStudy.translations.en.subtitle,
        description: rawStudy.translations.en.description || '',
        objective: rawStudy.translations.en.objective,
        instructions: rawStudy.translations.en.instructions,
        ui_labels: rawStudy.translations.en.ui_labels,
        statements: statements,
        state: 'active',
        ...overrides,
        // Ensure translations exist for the active locale if not overridden
        translations: overrides.translations || rawStudy.translations
    };
};

// Helper: Bypass Fine Sort via Store Injection
// Distributes cards into valid slots to satisfy the "Complete" check
const performInstantFineSort = async (page: any, config: any) => {
    await page.waitForFunction(() => (window as any).useResponseStore?.getState()?.rough?.history?.length > 0);

    await page.evaluate(({ statements, grid }: any) => {
        const placements: any[] = [];
        let cardIndex = 0;

        // Simple linear fill (ignoring actual logic/meaning)
        grid.forEach((col: any, colIndex: number) => {
            for (let i = 0; i < col.capacity; i++) {
                if (cardIndex < statements.length) {
                    placements.push({
                        statementId: statements[cardIndex].id,
                        col: colIndex,
                        row: i
                    });
                    cardIndex++;
                }
            }
        });

        // Inject into store
        // @ts-ignore
        const store = (window as any).useResponseStore.getState();
        store.setQSortResponse(placements);

        // Also ensure rough sort is marked fully complete if needed (though usually independent)
        // Set step to 5 (PostSort) to trigger router check?
        // No, router checks placement count.

    }, { statements: config.statements, grid: config.grid_config || rawStudy.grid_config });

    // Trigger navigation by visiting next step explicitly or relying on auto-redirect?
    // The PostSortPage has a check that redirects BACK to FineSort if incomplete.
    // So if we are complete, we can navigate forward.
    await page.evaluate(() => {
         (window as any).useSessionStore.getState().setStep(5);
         // Force navigate
         // window.location.href ... Playwright handles this better
    });
};


test.describe('UI Consistency & Logic Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/logs', async (route) => route.fulfill({ status: 200, body: '{}' }));

        // Expose store for injection
        await page.addInitScript(() => {
            // This relies on the app attaching store to window, which is often done for debugging "useResponseStore"
            // If not, we might need a workaround. For now assuming typical dev patterns or we add it.
            // Actually, in production code, stores aren't usually on window.
            // Let's rely on standard interaction for RoughSort, but maybe inject for FineSort if possible.
            // If we can't inject, use a smaller statement set for testing?
        });
    });

    test('Case A: Maximal Study (Pre-Sort + Pre-Instruction + Post-Questions)', async ({ page }) => {
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

        const mockConfig = createMockConfig({
            presort_config: {
                enabled: true,
                fields: {
                    age: { type: 'number', label: { en: 'Age' }, required: true, min: 18 },
                    gender: {
                        type: 'select',
                        label: { en: 'Gender' },
                        options: [
                            { value: 'm', label: { en: 'Male' } },
                            { value: 'f', label: { en: 'Female' } },
                            { value: 'o', label: { en: 'Other' } }
                        ]
                    },
                    education: {
                        type: 'select',
                        label: { en: 'Education' },
                        options: [
                            { value: 'hs', label: { en: 'High School' } },
                            { value: 'ba', label: { en: 'Bachelor' } }
                        ]
                    }
                }
            },
            pre_instruction: '# Attention\n\nPlease read this carefully.',
             postsort_config: {
                extreme_columns: [-4, 4],
                questions: {
                    feedback: { type: 'textarea', label: { en: 'Feedback' }, required: true }
                },
                email_collection_enabled: true
            }
        });

        // Mock API
        await page.route(`**/api/study/${mockConfig.slug}*`, async route => {
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockConfig) });
        });
        await mockSubmitAPI(page);

        const welcomePage = new WelcomePage(page);
        const consentPage = new ConsentPage(page);
        const preSortPage = new PreSortPage(page);
        const roughSortPage = new RoughSortPage(page);
        const postSortPage = new PostSortPage(page);

        // 1. Welcome
        await welcomePage.visit(mockConfig.slug);
        await welcomePage.startStudy();

        // 2. Consent
        await consentPage.acceptConsent();

        // 3. Pre-Sort (Should appear)
        await expect(page).toHaveURL(/.*\/presort/);

        // Check if page rendered
        try {
            await expect(page.getByText('About You')).toBeVisible({ timeout: 5000 });
        } catch (e) {
            console.log('PreSort Page Content:', await page.content());
            throw e;
        }

        // Verify inputs
        try {
            await preSortPage.completePreSort();
        } catch (e) {
             console.log('PreSort Input Failure Content:', await page.content());
             throw e;
        }

        // 4. Pre-Instruction (Should appear)
        await expect(page.getByText('Attention')).toBeVisible();
        await expect(page.getByText('Please read this carefully')).toBeVisible();
        await page.getByRole('button', { name: 'Start' }).click();

        // 5. Rough Sort
        await roughSortPage.waitForLoad();
        // Skip actual sorting by cheat: navigate
        // If we can't inject, we just verify we landed here correctly.
        // For Case A (Maximal), verifying logic up to here proves Pre-Sort and Pre-Instruction worked.
        // We really want to verify Post-Sort custom questions too.
        // Let's try to bypass FineSort by using a "Test Mode" URL if applicable, or just forcing navigation?
        // If we force navigation to post-sort, the "Completeness Guard" in PostSortPage will kick us back.
        // We MUST verify Post-Questions exist.

        // HACK: Reduce statement count for THIS test case to make sorting trivial?
        // Requires changing grid config too.
        // Keeping it verified up to RoughSort is "Good Enough" for flow logic A.
        // BUT we want to verify PostSort fields.

        // Let's try Application Action:
        // We can evaluate code in the browser context to update the Zustand store?
        // The app likely doesn't expose the store globally.
        // However, we can use the "Test Mode" or verify components in isolation?
        // No, let's verify PostSort in a separate unit/integration test if E2E is too hard?
        // Actually, we can just navigate to PostSort and if it redirects, we know guard works.
        // To verify the fields, maybe we disable the guard in config? No.

        // OK, I'll rely on the fact we reached RoughSort.
        // I will add a check for the customized Post-Sort by mocking the "isCompleted" state in session?
        // If session.isCompleted is true, PostSortPage allows access.

        await page.evaluate(() => {
            localStorage.setItem('open-q-session-storage', JSON.stringify({
                state: {
                    isCompleted: true, // Cheat to see Post-Sort
                    hasConsented: true,
                    maxReachedStep: 5,
                    currentStep: 5
                },
                version: 0
            }));
        });
        await page.reload();
        await page.goto(`/study/${mockConfig.slug}/post-sort`);

        // Now checks PostSort fields
         await expect(page.getByLabel('Feedback')).toBeVisible();
         await expect(page.getByText('Age')).toBeHidden(); // Ensure it's not PreSort
    });

    test('Case B: Minimal (No Pre-Sort, No Pre-Instruction)', async ({ page }) => {
        const mockConfig = createMockConfig({
            presort_config: { enabled: false }, // Explicitly disabled
            pre_instruction: null, // explicit null
            postsort_config: { questions: {} }
        });

         // Mock API
        await page.route(`**/api/study/${mockConfig.slug}*`, async route => {
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockConfig) });
        });
        await mockSubmitAPI(page);

        const welcomePage = new WelcomePage(page);
        const consentPage = new ConsentPage(page);
        const roughSortPage = new RoughSortPage(page);

        // 1. Welcome
        await welcomePage.visit(mockConfig.slug);
        await welcomePage.startStudy();

        // 2. Consent
        await consentPage.acceptConsent();

        // 3. Should SKIP Pre-Sort and Go Straight to RoughSort
        // Pre-Instruction is also null, so skip that too.

        // Wait for potential navigation
        await page.waitForTimeout(1000);

        const url = page.url();
        expect(url).not.toContain('presort');
        expect(url).toContain('rough-sort');

        await expect(page.getByText('Condition of Instruction')).toBeHidden();
        await roughSortPage.waitForLoad();
    });
});
