import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ZodError } from 'zod';
import { ApiError } from '../api/client';
import { useConfigStore } from '../store/useConfigStore';
import { useSessionStore } from '../store/useSessionStore';
import { applyStudyOverrides } from '../utils/i18nOverrides';
import { useGetStudyConfig } from './useGetStudyConfig';

export const useStudyConfig = () => {
    const { slug } = useParams();

    // Store Actions
    const setConfig = useConfigStore((state) => state.setConfig);
    const setConfigLoading = useConfigStore((state) => state.setLoading);
    const setConfigError = useConfigStore((state) => state.setError);
    const config = useConfigStore((state) => state.config);
    const resetConfig = useConfigStore((state) => state.resetConfig);

    // Session Store
    const session = useSessionStore();
    const setLanguage = useSessionStore((state) => state.setLanguage);
    const resetSession = useSessionStore((state) => state.resetSession);

    // Determine language to request
    const langToRequest = session.language ?? window.navigator.language.substring(0, 2);

    // --- Query Hook ---
    const { data, isLoading, error, refetch } = useGetStudyConfig(slug, langToRequest);

    // --- Effect: Handle Stale Data (Reset on Slug Change) ---
    useEffect(() => {
        if (slug && config && config.slug !== slug) {
            resetSession();
            resetConfig();
        }
    }, [slug, config, resetSession, resetConfig]);

    // --- Effect: Sync Loading State ---
    useEffect(() => {
        setConfigLoading(isLoading);
    }, [isLoading, setConfigLoading]);

    // --- Effect: Sync Data on Success ---
    useEffect(() => {
        if (data) {
            setConfig(data);

            if (data.ui_labels) {
                applyStudyOverrides(data.language || 'en', data.ui_labels);
            }

            if (!session.language || (data.language && session.language !== data.language)) {
                setLanguage(data.language || 'en');
            }
            // Clear error on success
            setConfigError(null);
        }
    }, [data, setConfig, setLanguage, session.language, setConfigError]);

    // --- Effect: Sync Error ---
    useEffect(() => {
        if (error) {
            console.error('Failed to fetch or validate study:', error);
            let errorKey = 'common.errors.unknown';

            if (error instanceof ApiError) {
                if (error.status === 404 || error.status === 422)
                    errorKey = 'common.errors.not_found';
                if (error.status === 429) errorKey = 'common.errors.rate_limited';
            } else if (error instanceof ZodError) {
                errorKey = 'common.errors.validation';
            } else if (
                error instanceof TypeError ||
                (error instanceof Error && error.name === 'TypeError')
            ) {
                errorKey = 'common.errors.network';
            }

            setConfigError(errorKey);
        }
    }, [error, setConfigError]);

    return {
        retry: refetch,
    };
};
