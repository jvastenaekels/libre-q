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
    const searchParams = new URLSearchParams(window.location.search);
    const isTestMode = searchParams.get('mode') === 'test';

    const { data, isLoading, error, refetch } = useGetStudyConfig(
        slug,
        langToRequest,
        // Disable query if we're in test mode and have local data
        { enabled: !!slug && !isTestMode }
    );

    // --- Effect: Handle Test Mode Loading ---
    useEffect(() => {
        if (isTestMode && slug) {
            const draftKey = `open-q-test-config-${slug}`;
            const draftJson = localStorage.getItem(draftKey);
            if (draftJson) {
                try {
                    const draft = JSON.parse(draftJson);
                    setConfig(draft);
                    if (draft.ui_labels) {
                        applyStudyOverrides(draft.language || 'en', draft.ui_labels);
                    }
                    if (
                        !session.language ||
                        (draft.language && session.language !== draft.language)
                    ) {
                        setLanguage(draft.language || 'en');
                    }
                    setConfigError(null);
                    setConfigLoading(false);
                    console.log('Loaded study config from localStorage (Test Mode)');
                } catch (e) {
                    console.error('Failed to parse test config from localStorage', e);
                    setConfigError('common.errors.validation');
                }
            } else {
                // If no local data, we could fallback to API or show error
                // For now, let's just trigger the normal loading if its enabled
            }
        }
    }, [
        isTestMode,
        slug,
        setConfig,
        setLanguage,
        session.language,
        setConfigError,
        setConfigLoading,
    ]);

    // --- Effect: Handle Stale Data (Reset on Slug Change) ---
    useEffect(() => {
        if (slug && config && config.slug !== slug) {
            resetSession();
            resetConfig();
        }
    }, [slug, config, resetSession, resetConfig]);

    // --- Effect: Sync Loading State ---
    useEffect(() => {
        if (!isTestMode) {
            setConfigLoading(isLoading);
        }
    }, [isLoading, setConfigLoading, isTestMode]);

    // --- Effect: Sync Data on Success ---
    useEffect(() => {
        if (data && !isTestMode) {
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
    }, [data, setConfig, setLanguage, session.language, setConfigError, isTestMode]);

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
