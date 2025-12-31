import { useGetStudyApiStudySlugGet } from '../api/generated';

export const useGetStudyConfig = (slug?: string, language?: string) => {
    return useGetStudyApiStudySlugGet(
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
