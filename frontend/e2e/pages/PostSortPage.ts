import { type Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class PostSortPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async waitForLoad() {
        await expect(this.page.getByText('Post-Sort Survey', { exact: false })).toBeVisible({ timeout: 10000 });
    }

    async fillExtremeComments(comment: string = 'Because it is important') {
        // Find all extreme comment textareas
        const textareas = this.page.locator('textarea[id^="comment-"]');
        const count = await textareas.count();

        for (let i = 0; i < count; i++) {
            await textareas.nth(i).fill(comment);
        }
    }

    async fillQuestion(label: string, value: string) {
        const input = this.page.getByLabel(label, { exact: false });
        await input.fill(value);
    }

    async toggleConsent(label: string) {
         // Using getByLabel might target the div or the input depending on structure
         await this.page.getByLabel(label).check();
    }

    async submit() {
        await this.page.getByRole('button', { name: 'Submit' }).click();
    }

    async verifySuccess() {
        await expect(this.page.getByText('Thank You!')).toBeVisible();
        await expect(this.page.getByText('Your responses have been successfully submitted.')).toBeVisible();
    }
}
