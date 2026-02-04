import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ZodError } from 'zod';
import { ApiError } from '../api/client';
import type { StudyUpdate } from '../api/model';
import type { StudyConfig } from '../schemas/study';
import { useConfigStore } from '../store/useConfigStore';
import { useResponseStore } from '../store/useResponseStore';
import { useSessionStore } from '../store/useSessionStore';
import { applyStudyOverrides } from '../utils/i18nOverrides';
import { localizeStudy } from '../utils/studyLocalization';
import { useGetStudyConfig } from './useGetStudyConfig';
import { getGetStudyApiStudySlugGetQueryKey } from '@/api/generated';
import { queryClient } from '@/lib/queryClient';
import i18n from '../i18n';

export const useStudyConfig = () => {
    const { slug } = useParams();
    const [password, setPasswordState] = useState<string | undefined>();
    const [passwordError, setPasswordError] = useState<boolean>(false);

    // Store Actions
    const setConfig = useConfigStore((state) => state.setConfig);
    const setConfigLoading = useConfigStore((state) => state.setLoading);
    const setConfigError = useConfigStore((state) => state.setError);
    const config = useConfigStore((state) => state.config);
    const resetConfig = useConfigStore((state) => state.resetConfig);

    // Session Store
    const isPilotMode = useSessionStore((state) => state.isPilotMode);
    const setPilotMode = useSessionStore((state) => state.setPilotMode);
    const sessionLanguage = useSessionStore((state) => state.language);
    const setLanguage = useSessionStore((state) => state.setLanguage);
    const resetSession = useSessionStore((state) => state.resetSession);
    const resetResponses = useResponseStore((state) => state.resetResponses);

    // --- Query Hook ---
    const searchParams = new URLSearchParams(window.location.search);
    const isTestMode = searchParams.get('mode') === 'test';

    // Determine language to request
    // Priority: sessionLanguage (persisted) -> URL parameter -> null (let backend decide)
    const langToRequest = sessionLanguage || searchParams.get('lang') || undefined;

    const { data, isLoading, error, refetch } = useGetStudyConfig(
        slug,
        langToRequest,
        // Disable query if we're in pilot mode (using local draft)
        { enabled: !!slug && !isPilotMode && !isTestMode },
        password
    );

    // --- Effect: Handle Test Mode Loading ---
    useEffect(() => {
        if (slug && isTestMode && !isPilotMode) {
            // Set flag for storage isolation in this tab
            sessionStorage.setItem('libre-q-pilot-mode', 'true');
            setPilotMode(true);
        }
    }, [isTestMode, slug, isPilotMode, setPilotMode]);

    // --- Effect: Handle Test Mode Loading (Config) ---
    useEffect(() => {
        if (!isTestMode || !slug) return;

        const loadFromStorage = async () => {
            resetConfig(); // Clear previous study config
            setConfigLoading(true);

            // Check if we need a fresh start (set by StudyDesignPage)
            const resetKey = `libre-q-pilot-reset-${slug}`;
            if (localStorage.getItem(resetKey)) {
                resetSession();
                resetResponses();
                localStorage.removeItem(resetKey);
            }

            const draftKey = `libre-q-test-draft-${slug}`;
            const legacyKey = `libre-q-test-config-${slug}`;

            const draftJson = localStorage.getItem(draftKey);
            const legacyJson = localStorage.getItem(legacyKey);

            if (draftJson || legacyJson) {
                try {
                    let config: StudyConfig;
                    if (draftJson) {
                        const fullDraft = JSON.parse(draftJson) as StudyUpdate;
                    } else {
                        config = JSON.parse(legacyJson as string);
                    }
                    if (config.language) {
                        if (i18n.language !== config.language) {
                            await i18n.changeLanguage(config.language);
                        }
                        if (sessionLanguage !== config.language) {
                            setLanguage(config.language);
                        }
                    }

                    if (config.ui_labels) {
                        applyStudyOverrides(config.language || 'en', config.ui_labels);
                    }

                    setConfig(config);
                    setConfigError(null);
                    setConfigLoading(false);
                } catch (e) {
                    console.error('Failed to parse test config from localStorage', e);
                    setConfigError('common.errors.validation');
                    setConfigLoading(false);
                }
            } else {
                console.warn(
                    `[useStudyConfig] No draft found in localStorage for ${slug}. Attempting server fallback.`
                );
                try {
                    // Fallback to server data (Collaborative Pilot Mode)
                    // This allows colleagues to test the "last saved" version without a local draft
                    const { data: serverData } = await refetch();

                    if (serverData) {

                        if (serverData.ui_labels) {
                            applyStudyOverrides(serverData.language || 'en', serverData.ui_labels);
                        }

                        if (
                            !sessionLanguage ||
                            (serverData.language && sessionLanguage !== serverData.language)
                        ) {
                            await i18n.changeLanguage(serverData.language || 'en');
                            setLanguage(serverData.language || 'en');
                        }

                        setConfig(serverData);
                        setConfigError(null);
                    } else {
                        throw new Error('Server returned no data');
                    }
                } catch (err) {
                    console.error('[useStudyConfig] Server fallback failed', err);
                    setConfigError('common.errors.not_found');
                } finally {
                    setConfigLoading(false);
                }
            }
        };

        // Initial load
        loadFromStorage();

        // Listen for changes from other tabs (Designer)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === `libre-q-test-draft-${slug}` || e.key === `libre-q-pilot-reset-${slug}`) {
                loadFromStorage();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [
        isTestMode,
        slug,
        setConfig,
        setLanguage,
        sessionLanguage,
        setConfigError,
        setConfigLoading,
        resetSession,
        resetResponses,
        resetConfig,
        refetch,
    ]);

    // --- Effect: Handle Stale Data (Reset on Slug Change) ---
    // This is the "Slug Guard" - it ensures clean slate when switching studies
    useEffect(() => {
        if (slug && config && config.slug !== slug) {
            resetSession();
            resetConfig();
            resetResponses();
            // Force a hard query reset to avoid mixing data
            queryClient.clear();
        }
    }, [slug, config, resetSession, resetConfig, resetResponses]);

    // --- Effect: Sync Loading State ---
    useEffect(() => {
        if (!isTestMode) {
            setConfigLoading(isLoading);
        }
    }, [isLoading, setConfigLoading, isTestMode]);

    // --- Effect: Reset Pilot Language on Mode Change ---
    useEffect(() => {
        if (isTestMode && !sessionLanguage && config?.language) {
            if (sessionLanguage !== config.language) {
                setLanguage(config.language);
            }
        }
    }, [isTestMode, sessionLanguage, config?.language, setLanguage]);

    // --- Effect: Handle Stale Language (Show loader while switching) ---
    useEffect(() => {
        if (!isTestMode && sessionLanguage && config && config.language !== sessionLanguage) {
            setConfigLoading(true);
        }
    }, [sessionLanguage, config, setConfigLoading, isTestMode]);

    // --- Effect: Sync Data on Success ---
    useEffect(() => {
        if (data && !isTestMode) {
            setConfig(data);

            if (data.ui_labels) {
                applyStudyOverrides(data.language || 'en', data.ui_labels);
            }

            if (!sessionLanguage || (data.language && sessionLanguage !== data.language)) {
                const newLang = data.language || 'en';

                // Seed the cache for the resolved language to prevent double-fetch on first visit
                // Only if the current sessionLanguage is null (first detection)
                if (!sessionLanguage && slug) {
                    const searchParams = new URLSearchParams(window.location.search);
                    const linkToken = searchParams.get('token') || undefined;
                    const queryParams = {
                        lang: newLang,
                        link_token: linkToken,
                        password: password,
                    };
                    queryClient.setQueryData(
                        getGetStudyApiStudySlugGetQueryKey(slug, queryParams),
                        data
                    );
                }

                if (sessionLanguage !== newLang) {
                    setLanguage(newLang);
                }
                if (i18n.language !== newLang) {
                    i18n.changeLanguage(newLang);
                }
            }
            // Clear error on success
            setConfigError(null);

            // Handle password error
            if (data.requires_password && password) {
                setPasswordError(true);
            } else {
                setPasswordError(false);
            }
        }
    }, [data, setConfig, setLanguage, sessionLanguage, setConfigError, isTestMode, password, slug]);

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
        unlock: (pw: string) => {
            setPasswordState(pw);
        },
        passwordError,
    };
};
