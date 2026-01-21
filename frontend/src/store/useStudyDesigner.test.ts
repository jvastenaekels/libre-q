import { describe, it, expect, beforeEach } from 'vitest';
import { useStudyDesigner } from './useStudyDesigner';
import type { StudyRead } from '@/api/model';

const MOCK_STUDY: StudyRead = {
    id: 1,
    slug: 'test-study',
    state: 'draft',
    default_language: 'en',
    grid_config: [{ score: 0, capacity: 1 }],
    statements: [
        { id: 1, code: 'S1', translations: [{ language_code: 'en', text: 'Statement 1' }] },
    ],
    translations: [
        {
            language_code: 'en',
            title: 'Test Study',
            description: 'A study for testing',
            instructions: 'Original instructions',
            condition_of_instruction: 'Original COI',
            consent_title: 'Original Consent',
            consent_description: 'Original Consent Desc',
        },
    ],
    updated_at: '2025-01-01T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    workspace_id: 1,
    show_statement_codes: false,
    randomize_statement_order: false,
};

describe('useStudyDesigner - importConfig', () => {
    beforeEach(() => {
        useStudyDesigner.getState().setStudy(MOCK_STUDY);
    });

    it('should correctly merge top-level simple fields', () => {
        const partialConfig = {
            default_language: 'fr',
            show_statement_codes: true,
            randomize_statement_order: true,
        };

        useStudyDesigner.getState().importConfig(partialConfig);
        const draft = useStudyDesigner.getState().draft;

        expect(draft?.default_language).toBe('fr');
        expect(draft?.show_statement_codes).toBe(true);
        expect(draft?.randomize_statement_order).toBe(true);
    });

    it('should replace structural fields (grid and statements) entirely', () => {
        const structuralUpdate = {
            grid_config: [{ score: 1, capacity: 2 }],
            statements: [{ code: 'S-NEW', translations: [{ language_code: 'en', text: 'New S' }] }],
        };

        useStudyDesigner.getState().importConfig(structuralUpdate);
        const draft = useStudyDesigner.getState().draft;

        expect(draft?.grid_config).toEqual([{ score: 1, capacity: 2 }]);
        expect(draft?.statements).toHaveLength(1);
        expect(draft?.statements?.[0].code).toBe('S-NEW');
    });

    it('should merge translations by language code', () => {
        const translationUpdate = {
            translations: [
                {
                    language_code: 'en',
                    title: 'Updated English Title',
                },
                {
                    language_code: 'fr',
                    title: 'Nouveau Titre Français',
                },
            ],
        };

        useStudyDesigner.getState().importConfig(translationUpdate);
        const draft = useStudyDesigner.getState().draft;

        const enTrans = draft?.translations?.find((t) => t.language_code === 'en');
        const frTrans = draft?.translations?.find((t) => t.language_code === 'fr');

        // English should be merged (description preserved)
        expect(enTrans?.title).toBe('Updated English Title');
        expect(enTrans?.instructions).toBe('Original instructions');

        // French should be added
        expect(frTrans?.title).toBe('Nouveau Titre Français');
        expect(frTrans?.language_code).toBe('fr');
    });

    it('should handle wrapped configuration format (exported format)', () => {
        const wrappedConfig = {
            version: '1.0',
            study: {
                title: 'Wrapped Update',
                branding: { accent_color: '#ff0000' },
            },
        };

        useStudyDesigner.getState().importConfig(wrappedConfig);
        const draft = useStudyDesigner.getState().draft;

        // Note: 'title' is usually inside translations, but if it's at top level of StudyUpdate it depends on how projectStudyToUpdate handles it.
        // In useStudyDesigner, draft is StudyUpdate which doesn't have a top-level 'title' (it's in translations).
        // Our importConfig logic handles branding merge.
        expect(draft?.branding?.accent_color).toBe('#ff0000');
    });

    it('should set syncStatus to modified after import', () => {
        useStudyDesigner.getState().setSyncStatus('synced');
        useStudyDesigner.getState().importConfig({ default_language: 'fi' });
        expect(useStudyDesigner.getState().syncStatus).toBe('modified');
    });
});
