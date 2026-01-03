import { type Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class FineSortPage extends BasePage {
    readonly deckContainer = this.page.getByTestId('deck-cards-container');
    readonly footerInstruction = this.page.locator('#footer-instruction, .footer-instruction, [class*="footer"]'); // Adjust selector as needed based on actual implementation or text

    constructor(page: Page) {
        super(page);
    }

    async waitForLoad() {
        await expect(this.page).toHaveURL(/.*\/fine-sort/, { timeout: 20000 });
    }

    async verifyLayout() {
        await expect(this.page.getByText(/DISAGREE|DÉSACCORD/i).first()).toBeVisible();
        await expect(this.page.getByText(/AGREE|ACCORD/i).last()).toBeVisible();
        await expect(this.page.getByRole('button', { name: /zoom/i })).toHaveCount(2);
        await expect(this.page.getByRole('tab')).toHaveCount(3);
    }

    async checkFooter(instructionRegex: RegExp) {
        await expect(this.page.getByText(instructionRegex)).toBeVisible();
    }

    async getDeckCount() {
        return await this.deckContainer.locator('[data-testid^="card-"]').count();
    }

    async selectPile(pileIndex: number) {
        // 0=Disagree, 1=Neutral, 2=Agree
        const tab = this.page.getByRole('tab').nth(pileIndex);
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(this.deckContainer).toBeVisible();
    }

    async dragFirstCardToSlot() {
        const deckCard = this.deckContainer.locator('[data-testid^="card-"]').first();
        const targetSlot = this.page.locator('[data-testid="droppable-slot"]').first();
        await deckCard.dragTo(targetSlot);
        await expect(targetSlot.locator('[data-testid^="card-"]')).toBeVisible();
    }

    async tapFirstCard() {
        const deckCard = this.deckContainer.locator('[data-testid^="card-"]').first();
        await expect(deckCard).toBeVisible();
        await deckCard.click({ force: true });
    }

    async verifyWorkbenchActive() {
        await expect(this.page.getByText(/tap grid to place|place on grid/i).first()).toBeVisible();
    }
}
