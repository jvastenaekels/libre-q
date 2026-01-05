import { useGetStudyApiStudySlugGet } from '../api/generated';
import type { StudyConfig } from '../schemas/study';

// biome-ignore lint/suspicious/noExplicitAny: query options
export const useGetStudyConfig = (slug?: string, language?: string, options: any = {}) => {
    return useGetStudyApiStudySlugGet<StudyConfig>(
        slug || '',
        { lang: language },
        {
            query: {
                enabled: !!slug,
                staleTime: 1000 * 60 * 30, // 30 minutes
                retry: 1,
                ...options,
            },
        }
    );
};
