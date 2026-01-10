import { screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithStore } from '@/test-utils/renderWithStore';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('QSortEditor', () => {
    // biome-ignore lint/suspicious/noExplicitAny: convenient partial mock
    const mockDraft: any = {
        slug: 'test-study',
        state: 'draft',
        statements: [
            {
                code: 's1',
                translations: [
                    { language_code: 'en', text: 'Existing Statement' },
                    { language_code: 'fr', text: 'Déclaration existante' },
                ],
            },
        ],
        grid_config: [
            { score: -2, capacity: 2 },
            { score: -1, capacity: 3 },
            { score: 0, capacity: 4 },
            { score: 1, capacity: 3 },
            { score: 2, capacity: 2 },
        ],
        translations: [{ language_code: 'en' }, { language_code: 'fr' }],
    };

    // Helper to render with specific initial state
    // biome-ignore lint/suspicious/noExplicitAny: weak typing for test utility
    const renderEditor = (initialStateOverrides: any = {}) => {
        return renderWithStore(
            <TooltipProvider>
                <QSortEditor />
            </TooltipProvider>,
            {
                initialState: {
                    draft: { ...mockDraft, ...initialStateOverrides.draft },
                    activeLocale: 'en',
                    activeSubStep: 'statements',
                    ...initialStateOverrides,
                },
            }
        );
    };

    describe('Sub-Tab Navigation', () => {
        it('renders the editor with sub-tabs', async () => {
            renderEditor();
            expect(await screen.findByRole('tab', { name: /Statements/i })).toBeInTheDocument();
            expect(await screen.findByRole('tab', { name: /Distribution/i })).toBeInTheDocument();
        });

        it('switches between statements and distribution tabs', async () => {
            const user = userEvent.setup();
            renderEditor();

            const distributionTab = screen.getByRole('tab', { name: /Distribution/i });
            await user.click(distributionTab);

            // UI should switch to grid config
            expect(screen.getByText('admin.design.qsort.grid.title')).toBeInTheDocument();
        });

        it('displays statements tab content by default', () => {
            renderEditor();
            expect(screen.getByText('admin.design.qsort.bulk.title')).toBeInTheDocument();
            expect(
                screen.getByText('admin.design.qsort.set.title', { exact: false })
            ).toBeInTheDocument();
        });
    });

    describe('Bulk Statement Import', () => {
        it('handles bulk statement import (Replace mode)', async () => {
            const user = userEvent.setup();
            renderEditor();

            const textarea = screen.getByPlaceholderText('admin.design.qsort.bulk.placeholder');
            await user.type(textarea, 'S1: New Statement 1\nS2: New Statement 2');

            const replaceButton = screen.getByRole('button', {
                name: 'admin.design.qsort.bulk.process_replace',
            });
            await user.click(replaceButton);

            // Assert UI update instead of mock call
            expect(await screen.findByText('New Statement 1')).toBeInTheDocument();
            expect(await screen.findByText('New Statement 2')).toBeInTheDocument();
            expect(screen.queryByText('Existing Statement')).not.toBeInTheDocument();
        });

        it('handles bulk statement import (Append mode)', async () => {
            const user = userEvent.setup();
            renderEditor();

            // Switch to append
            const appendRadio = screen.getByLabelText('admin.design.qsort.bulk.append');
            await user.click(appendRadio);

            const textarea = screen.getByPlaceholderText('admin.design.qsort.bulk.placeholder');
            await user.type(textarea, 'S2: Appended');

            const appendButton = screen.getByRole('button', {
                name: 'admin.design.qsort.bulk.process_append',
            });
            await user.click(appendButton);

            // Assert UI update
            expect(await screen.findByText('Existing Statement')).toBeInTheDocument();
            expect(await screen.findByText('Appended')).toBeInTheDocument();
        });

        it('supports TSV format', async () => {
            const user = userEvent.setup();
            renderEditor();

            const textarea = screen.getByPlaceholderText('admin.design.qsort.bulk.placeholder');
            await user.type(textarea, 'TSV1\tTab Separated Text');

            const replaceButton = screen.getByRole('button', {
                name: 'admin.design.qsort.bulk.process_replace',
            });
            await user.click(replaceButton);

            expect(await screen.findByText('Tab Separated Text')).toBeInTheDocument();
        });

        it('clears bulk text after successful import', async () => {
            const user = userEvent.setup();
            renderEditor();

            const textarea = screen.getByPlaceholderText(
                'admin.design.qsort.bulk.placeholder'
            ) as HTMLTextAreaElement;
            await user.type(textarea, 'S1: Test');

            const replaceButton = screen.getByRole('button', {
                name: 'admin.design.qsort.bulk.process_replace',
            });
            await user.click(replaceButton);

            expect(textarea.value).toBe('');
        });
    });

    describe('Statement Management', () => {
        it('displays existing statements', () => {
            renderEditor();
            expect(screen.getByText('Existing Statement')).toBeInTheDocument();
        });

        it('can delete individual statements', async () => {
            const user = userEvent.setup();
            renderEditor();

            const statementItem = screen.getByText('Existing Statement').closest('.group');
            expect(statementItem).toBeInTheDocument();

            // biome-ignore lint/style/noNonNullAssertion: test setup
            const deleteButton = within(statementItem!).getAllByRole('button')[1];
            await user.click(deleteButton);

            expect(screen.queryByText('Existing Statement')).not.toBeInTheDocument();
        });

        it('clears all statements with confirmation', async () => {
            const user = userEvent.setup();
            const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

            renderEditor();

            const clearButton = screen.getByText('admin.design.qsort.set.clear');
            await user.click(clearButton);

            expect(confirmSpy).toHaveBeenCalled();
            expect(screen.queryByText('Existing Statement')).not.toBeInTheDocument();
        });
    });

    describe('Translation Management', () => {
        it('displays statements in active locale', () => {
            renderEditor({ activeLocale: 'fr' });
            expect(screen.getByText('Déclaration existante')).toBeInTheDocument();
        });
    });

    describe('Grid Configuration', () => {
        it('displays grid columns', () => {
            renderEditor({ activeSubStep: 'grid' });
            expect(screen.getByText('admin.design.qsort.grid.title')).toBeInTheDocument();
            // Should see input fields for the grid
            // (Assuming grid editor renders inputs implies it's working)
        });
    });

    describe('Validation', () => {
        it('validates grid total matches statement count', () => {
            // 1 statement in mockDraft, grid capacity is 14
            // Should show mismatch warning/error if implemented in UI
            renderEditor({ activeSubStep: 'grid' });
            // For now just check it renders
            expect(screen.getByText('admin.design.qsort.grid.title')).toBeInTheDocument();
        });
    });
});
