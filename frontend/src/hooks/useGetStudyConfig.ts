import { useGetStudyApiStudySlugGet } from '../api/generated';

interface StudyPublicConfig {
    slug: string;
    title: string;
    description: string;
    instructions: string;
    subtitle?: string;
    objective?: string;
    consent_title?: string;
    consent_description?: string;
    consent_accept?: string;
    consent_decline?: string;
    statements: any[];
    grid_config: any[];
    presort_config: any;
    postsort_config?: any;
    show_statement_codes: boolean;
    language: string;
    ui_labels?: Record<string, string>;
}

export const useGetStudyConfig = (slug?: string, language?: string) => {
    return useGetStudyApiStudySlugGet<StudyPublicConfig>(
        slug!,
        { lang: language },
        {
            query: {
                enabled: !!slug,
                staleTime: 1000 * 60 * 30, // 30 minutes
                retry: 1,
            },
        }
    );
};
