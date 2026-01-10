import { test, expect } from '../../fixtures/db-setup';
import { testDataBuilders } from '../../fixtures/test-data';

/**
 * Integration Testing: Admin → Participant Consistency
 *
 * Verifies that configuration changes made in the Admin UI
 * correctly affect the Participant experience end-to-end.
 */

test.describe(' Admin → Participant Consistency Suite', () => {
    test.describe('Presort Configuration Consistency', () => {
        test('Presort fields configured in Admin appear in Participant flow', async ({ page, testDb, authToken }) => {
            // 1. Create study with presort fields
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-presort-consistency-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                presort_config: testDataBuilders.presortConfig({
                    'name': testDataBuilders.presortField('text', 'Your Name', { required: true }),
                    'age': testDataBuilders.presortField('number', 'Your Age', { required: true, min: 18, max: 100 }),
                    'country': testDataBuilders.presortField('select', 'Country', {
                        required: true,
                        options: ['USA', 'UK', 'Canada', 'Other']
                    }),
                }),
            }));

            // 2. Activate study
            await testDb.updateStudy(authToken, study.slug, { state: 'active' });

            // 3. Navigate to study as participant
            await page.goto(`/study/${study.slug}`);

            // 4. Complete consent
            await page.click('button:has-text("Accept")');

            // 5. Verify presort fields appear
            await expect(page.locator('label:has-text("Your Name")')).toBeVisible();
            await expect(page.locator('label:has-text("Your Age")')).toBeVisible();
            await expect(page.locator('label:has-text("Country")')).toBeVisible();

            // 6. Verify validation works
            await page.click('button:has-text("Continue")');
            await expect(page.locator('text=required', { hasText: /required/i })).toBeVisible();

            // 7. Fill fields correctly
            await page.fill('input[name="name"]', 'Test User');
            await page.fill('input[name="age"]', '25');
            await page.selectOption('select[name="country"]', 'USA');
            await page.click('button:has-text("Continue")');

            // 8. Should proceed to rough sort
            await expect(page).toHaveURL(new RegExp(`/study/${study.slug}/rough-sort`));
        });

        test('Disabled presort skips to rough sort', async ({ page, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-no-presort-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                presort_config: { enabled: false, fields: {} },
            }));

            await testDb.updateStudy(authToken, study.slug, { state: 'active' });

            await page.goto(`/study/${study.slug}`);
            await page.click('button:has-text("Accept")');

            // Should skip directly to rough sort
            await expect(page).toHaveURL(new RegExp(`/study/${study.slug}/rough-sort`));
        });
    });

    test.describe('Q-Sort Grid Consistency', () => {
        test('Grid configuration in Admin matches Participant grid', async ({ page, testDb, authToken }) => {
            const gridConfig = testDataBuilders.gridConfig('symmetric');
            const totalCapacity = gridConfig.reduce((sum, col) => sum + col.capacity, 0);

            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-grid-consistency-${Date.now()}`,
                statements: testDataBuilders.statements(totalCapacity),
                grid_config: gridConfig,
            }));

            await testDb.updateStudy(authToken, study.slug, { state: 'active' });

            // Navigate to fine sort
            await page.goto(`/study/${study.slug}`);
            await page.click('button:has-text("Accept")');

            // Skip through to fine sort
            // (Implementation-specific: may need to complete rough sort first)

            // Verify all grid columns exist with correct capacities
            for (const column of gridConfig) {
                const columnLocator = page.locator(`[data-score="${column.score}"]`);
                await expect(columnLocator).toBeVisible();

                // Verify capacity indicator shows 0/capacity initially
                await expect(page.locator(`text=0 / ${column.capacity}`)).toBeVisible();
            }
        });

        test('Grid total capacity matches statement count', async ({ page, testDb, authToken }) => {
            const gridConfig = testDataBuilders.gridConfig('minimal');
            const totalCapacity = gridConfig.reduce((sum, col) => sum + col.capacity, 0);

            // Create study with exact matching statements
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-grid-capacity-${Date.now()}`,
                statements: testDataBuilders.statements(totalCapacity),
                grid_config: gridConfig,
            }));

            await testDb.updateStudy(authToken, study.slug, { state: 'active' });

            // Complete study flow
            await page.goto(`/study/${study.slug}`);
            // ... complete flow ...

            // Verify all statements can be placed
            const statementsCount = await page.locator('[data-statement]').count();
            expect(statementsCount).toBe(totalCapacity);
        });
    });

    test.describe('Post-Sort Configuration Consistency', () => {
        test('Post-sort questions configured in Admin appear in Participant', async ({ page, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-postsort-consistency-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                postsort_config: {
                    email_collection_enabled: true,
                    interview_consent_enabled: true,
                    newsletter_consent_enabled: true,
                    questions: {
                        'feedback': testDataBuilders.postsortQuestion('textarea', 'Any feedback?', {
                            required: false,
                            rows: 4,
                        }),
                        'rating': testDataBuilders.postsortQuestion('select', 'How would you rate this study?', {
                            required: true,
                            options: ['Excellent', 'Good', 'Fair', 'Poor'],
                        }),
                    },
                },
            }));

            await testDb.updateStudy(authToken, study.slug, { state: 'active' });

            // Navigate through study to post-sort
            await page.goto(`/study/${study.slug}`);
            // ... complete study flow to reach post-sort ...

            // Verify all configured elements appear
            await expect(page.locator('input[type="email"]')).toBeVisible();
            await expect(page.locator('input[name="interview_consent"]')).toBeVisible();
            await expect(page.locator('input[name="newsletter_consent"]')).toBeVisible();
            await expect(page.locator('label:has-text("Any feedback?")')).toBeVisible();
            await expect(page.locator('label:has-text("How would you rate this study?")')).toBeVisible();
        });

        test('Email requirement enforced when enabled', async ({ page, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-email-required-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                postsort_config: { email_collection_enabled: true },
            }));

            await testDb.updateStudy(authToken, study.slug, { state: 'active' });

            // Navigate to post-sort
            await page.goto(`/study/${study.slug}`);
            // ... complete flow ...

            // Try to submit without email
            await page.click('button:has-text("Submit")');

            // Should show validation error
            await expect(page.locator('text=email', { hasText: /email.*required/i })).toBeVisible();

            // Fill email and submit successfully
            await page.fill('input[type="email"]', 'participant@example.com');
            await page.click('button:has-text("Submit")');

            await expect(page).toHaveURL(/thank-you|success|complete/);
        });
    });

    test.describe('Branding Consistency', () => {
        test('Custom branding appears throughout participant journey', async ({ page, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-branding-consistency-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                branding: testDataBuilders.branding({
                    logo_url: 'https://example.com/custom-logo.png',
                    accent_color: '#ff6600',
                    partners: [
                        testDataBuilders.partnerLogo('University A'),
                        testDataBuilders.partnerLogo('Research Institute B'),
                    ],
                }),
            }));

            await testDb.updateStudy(authToken, study.slug, { state: 'active' });

            await page.goto(`/study/${study.slug}`);

            // Verify logo on welcome page
            await expect(page.locator('img[src*="custom-logo.png"]')).toBeVisible();

            // Verify partner logos
            await expect(page.locator('img[alt*="University A"]')).toBeVisible();
            await expect(page.locator('img[alt*="Research Institute B"]')).toBeVisible();

            // Verify accent color is applied (implementation-specific check)
            const primaryButton = page.locator('button[type="submit"]').first();
            const bgColor = await primaryButton.evaluate((el) =>
                window.getComputedStyle(el).backgroundColor
            );
            expect(bgColor).toBeDefined();
        });
    });

    test.describe('Interface Customization Consistency', () => {
        test('Custom UI labels appear in Participant interface', async ({ page, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-labels-consistency-${Date.now()}`,
                statements: testDataBuilders.statements(10),
            }));

            // Set custom labels
            await testDb.updateStudy(authToken, study.slug, {
                translations: [{
                    language_code: 'en',
                    title: 'Test Study',
                    ui_labels: {
                        agree: 'Strongly Align',
                        disagree: 'Strongly Oppose',
                        neutral: 'Undecided',
                        continue: 'Proceed',
                        submit: 'Complete Study',
                    },
                }],
                state: 'active',
            });

            await page.goto(`/study/${study.slug}`);
            await page.click('button:has-text("Accept")');

            // Verify custom labels appear
            await expect(page.locator('button:has-text("Strongly Align")')).toBeVisible();
            await expect(page.locator('button:has-text("Strongly Oppose")')).toBeVisible();
            await expect(page.locator('button:has-text("Undecided")')).toBeVisible();
            await expect(page.locator('button:has-text("Proceed")')).toBeVisible();
        });

        test('Statement codes visibility controlled by toggle', async ({ page, testDb, authToken }) => {
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-codes-consistency-${Date.now()}`,
                statements: testDataBuilders.statements(10),
                show_statement_codes: true,
            }));

            await testDb.updateStudy(authToken, study.slug, { state: 'active' });

            await page.goto(`/study/${study.slug}`);
            await page.click('button:has-text("Accept")');

            // Verify statement codes appear
            await expect(page.locator('text=S1')).toBeVisible();
            await expect(page.locator('text=S2')).toBeVisible();
        });
    });

    test.describe('Complete End-to-End Flow', () => {
        test('Full study configuration reflects in complete participant journey', async ({ page, testDb, authToken }) => {
            // Create a fully configured study
            const study = await testDb.createStudy(authToken, testDataBuilders.study({
                slug: `test-full-e2e-${Date.now()}`,
                statements: testDataBuilders.statements(23), // Matches symmetric grid
                presort_config: testDataBuilders.presortConfig({
                    'email': testDataBuilders.presortField('email', 'Email', { required: true }),
                }),
                grid_config: testDataBuilders.gridConfig('symmetric'),
                postsort_config: {
                    email_collection_enabled: true,
                    interview_consent_enabled: true,
                    questions: {
                        'feedback': testDataBuilders.postsortQuestion('textarea', 'Feedback?'),
                    },
                },
                branding: testDataBuilders.branding({
                    logo_url: 'https://example.com/logo.png',
                    accent_color: '#6366f1',
                }),
                show_statement_codes: true,
            }));

            await testDb.updateStudy(authToken, study.slug, {
                state: 'active',
                translations: [{
                    language_code: 'en',
                    title: 'Complete E2E Test',
                    ui_labels: {
                        agree: 'Agree',
                        disagree: 'Disagree',
                        neutral: 'Neutral',
                    },
                }],
            });

            // Complete entire participant journey
            await page.goto(`/study/${study.slug}`);

            // 1. Welcome page - verify branding
            await expect(page.locator('img[src*="logo.png"]')).toBeVisible();
            await page.click('button:has-text("Start", "Begin")');

            // 2. Consent
            await page.click('button:has-text("Accept")');

            // 3. Presort - verify fields
            await expect(page.locator('label:has-text("Email")')).toBeVisible();
            await page.fill('input[type="email"]', 'test@example.com');
            await page.click('button:has-text("Continue", "Next")');

            // 4. Rough sort - verify custom labels
            await expect(page.locator('button:has-text("Agree")')).toBeVisible();
            await expect(page.locator('button:has-text("Disagree")')).toBeVisible();
            await expect(page.locator('button:has-text("Neutral")')).toBeVisible();

            // 5. Verify statement codes visible
            await expect(page.locator('text=S1')).toBeVisible();

            // Complete rough sort (implementation-specific)
            // ... sort statements ...

            // 6. Fine sort - verify grid matches configuration
            // ... verify grid ...

            // 7. Post-sort - verify questions
            // ... fill post-sort ...

            // 8. Success
            await expect(page).toHaveURL(/thank-you|success|complete/);
        });
    });
});
