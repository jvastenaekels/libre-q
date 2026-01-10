import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PostSortConfigEditor from './PostSortConfigEditor';
import { renderWithStore } from '@/test-utils/renderWithStore';
import { useStudyDesigner } from '@/store/useStudyDesigner';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'admin.design.postsort.extreme.title': 'Extreme columns',
                'admin.design.postsort.extreme.desc': 'Select columns for follow-up',
                'admin.design.postsort.random_comments.title': 'Allow random comments',
                'admin.design.postsort.random_comments.desc': 'Let participants comment',
                'admin.design.postsort.custom.title': 'Custom questions',
                'admin.design.postsort.custom.desc': 'Add custom questions',
                'admin.design.postsort.missing.title': 'Ask about missing statements',
                'admin.design.postsort.missing.desc': 'Ask if topics were missing',
                'admin.design.postsort.general.title': 'Ask for general feedback',
                'admin.design.postsort.general.desc': 'General comments at the end',
                'admin.design.postsort.email.title': 'Email Collection',
                'admin.design.postsort.email.desc': 'Collect emails',
                'admin.design.postsort.email.interview': 'Interview Consent',
                'admin.design.postsort.email.results': 'Results Consent',
            };
            return translations[key] || key;
        },
    }),
}));

describe('PostSortConfigEditor - Email Collection Feature', () => {
    // biome-ignore lint/suspicious/noExplicitAny: weak typing
    const renderEditor = (initialStateOverrides: any = {}) => {
        const mergedDraft = {
            slug: 'test',
            state: 'draft',
            postsort_config: {},
            ...(initialStateOverrides.draft || {}),
        };

        return renderWithStore(<PostSortConfigEditor />, {
            initialState: {
                ...initialStateOverrides,
                draft: mergedDraft,
                activeLocale: 'en',
            },
        });
    };

    it('renders email collection toggle', () => {
        renderEditor({ draft: { postsort_config: {}, grid_config: [] } });

        expect(screen.getByText('Email Collection')).toBeInTheDocument();
    });

    it('shows sub-toggles when email collection is enabled', () => {
        renderEditor({
            draft: {
                postsort_config: { email_collection_enabled: true },
                grid_config: [],
            },
        });

        expect(screen.getByText('Interview Consent')).toBeInTheDocument();
        expect(screen.getByText('Results Consent')).toBeInTheDocument();
    });

    it('hides sub-toggles when email collection is disabled', () => {
        renderEditor({
            draft: {
                postsort_config: { email_collection_enabled: false },
                grid_config: [],
            },
        });

        expect(screen.queryByText('Interview Consent')).not.toBeInTheDocument();
        expect(screen.queryByText('Results Consent')).not.toBeInTheDocument();
    });

    it('toggles email_collection_enabled with defensive check', () => {
        renderEditor({
            draft: {
                postsort_config: { email_collection_enabled: false },
                grid_config: [],
            },
        });

        const switches = screen.getAllByRole('switch');
        const emailToggle = switches.find((s) =>
            s.closest('.flex')?.textContent?.includes('Email Collection')
        );

        expect(emailToggle).toBeDefined();

        if (emailToggle) {
            fireEvent.click(emailToggle);

            // Access store to verify
            // biome-ignore lint/suspicious/noExplicitAny: access internal structure
            const currentDraft: any = useStudyDesigner.getState().draft;
            expect(currentDraft.postsort_config.email_collection_enabled).toBe(true);
        }
    });

    it('defaults interview_consent_enabled to true when undefined', () => {
        renderEditor({
            draft: {
                postsort_config: {
                    email_collection_enabled: true,
                    // undefined interview_consent_enabled
                },
                grid_config: [],
            },
        });

        const switches = screen.getAllByRole('switch');
        const interviewSwitch = switches.find((s) =>
            s.closest('.flex')?.textContent?.includes('Interview Consent')
        );

        expect(interviewSwitch).toHaveAttribute('data-state', 'checked');
    });

    it('defaults newsletter_consent_enabled to true when undefined', () => {
        renderEditor({
            draft: {
                postsort_config: {
                    email_collection_enabled: true,
                    // undefined newsletter_consent_enabled
                },
                grid_config: [],
            },
        });

        const switches = screen.getAllByRole('switch');
        const newsletterSwitch = switches.find((s) =>
            s.closest('.flex')?.textContent?.includes('Results Consent')
        );

        expect(newsletterSwitch).toHaveAttribute('data-state', 'checked');
    });

    it('toggles interview_consent_enabled correctly', () => {
        renderEditor({
            draft: {
                postsort_config: {
                    email_collection_enabled: true,
                    interview_consent_enabled: true,
                },
                grid_config: [],
            },
        });

        const switches = screen.getAllByRole('switch');
        const interviewSwitch = switches.find((s) =>
            s.closest('.flex')?.textContent?.includes('Interview Consent')
        );

        if (interviewSwitch) {
            fireEvent.click(interviewSwitch);

            // Check store
            // biome-ignore lint/suspicious/noExplicitAny: access internal structure
            const currentDraft: any = useStudyDesigner.getState().draft;
            expect(currentDraft.postsort_config.interview_consent_enabled).toBe(false);
        }
    });
});
