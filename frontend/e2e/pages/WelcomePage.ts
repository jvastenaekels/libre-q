import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class WelcomePage extends BasePage {
    readonly startButton = this.page.getByTestId('start-btn');
    readonly loadingSpinner = this.page.locator('[data-testid="loading-spinner"]');

    async visit(slug: string) {
        await this.goto(`/study/${slug}/welcome`);
        await this.waitForLoading();
    }

    async waitForLoading() {
        await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    }

    async startStudy() {
        console.log('Waiting for start button...');
        await expect(this.startButton.first()).toBeVisible({ timeout: 30000 });
        console.log('Start button visible. Clicking...');
        await this.startButton.first().click();
        console.log('Clicked start button.');
    }
}
