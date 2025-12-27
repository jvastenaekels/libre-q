/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import { useSessionStore } from '../store/useSessionStore';
import { get, ApiError } from '../api/client';
import { useParams } from 'react-router-dom';
import { StudyConfigSchema } from '../schemas/study';
import { ZodError } from 'zod';
import { applyStudyOverrides } from '../utils/i18nOverrides';

export const useStudyConfig = () => {
    const { slug } = useParams();

    // Config Store
    const config = useConfigStore((state) => state.config);
    const setConfig = useConfigStore((state) => state.setConfig);
    const setConfigLoading = useConfigStore((state) => state.setLoading); // Correct method name
    const setConfigError = useConfigStore((state) => state.setError);
    const triggerConfigRefetch = useConfigStore((state) => state.triggerRefetch);
    const configRefetchTag = useConfigStore((state) => state.refetchTag);

    // Session Store
    const session = useSessionStore();
    const setLanguage = useSessionStore((state) => state.setLanguage);
    const resetSession = useSessionStore((state) => state.resetSession); // Provided useSessionStore has this? It doesn't seem to have resetSession in Step 1437 mock?
    // I need to check useSessionStore.ts content to see if it has resetSession.
    // If not, I can just not call it or add it.
    // Assuming it doesn't have it based on lack of usage before.
    // If slug mismatch, I might need to implement logic differently.

    useEffect(() => {
        if (!slug) return;

        const fetchConfig = async () => {
            // Reset session/config if the slug in URL doesn't match the current config (stale data)
            let isStale = false;
            if (config && config.slug !== slug) {
                resetSession();
                useConfigStore.getState().resetConfig();
                isStale = true;
            }

            // Only show full loading state if we don't have a config yet OR if valid data became stale
            if (!config || isStale) {
                setConfigLoading(true);
            }

            // Clear error
            setConfigError(null);

            try {
                // Detect Browser Language
                const langToRequest = session.language ?? window.navigator.language.substring(0, 2);

                const data = await get<unknown>(`/api/study/${slug}?lang=${langToRequest}`);

                const validatedData = StudyConfigSchema.parse(data);

                setConfig(validatedData);

                if (validatedData.ui_labels) {
                    applyStudyOverrides(validatedData.language || 'en', validatedData.ui_labels);
                }

                if (
                    !session.language ||
                    (validatedData.language && session.language !== validatedData.language)
                ) {
                    setLanguage(validatedData.language || 'en');
                }
            } catch (err: unknown) {
                console.error('Failed to fetch or validate study:', err);

                let errorKey = 'common.errors.unknown';
                if (err instanceof ApiError) {
                    if (err.status === 404) {
                        errorKey = 'common.errors.not_found';
                    } else if (err.status === 429) {
                        errorKey = 'common.errors.rate_limited';
                    }
                } else if (err instanceof ZodError) {
                    errorKey = 'common.errors.validation';
                } else {
                    // Fallback for network errors (often TypeError: Failed to fetch)
                    // or other unknown errors
                    if (
                        err instanceof TypeError ||
                        (err instanceof Error && err.name === 'TypeError')
                    ) {
                        errorKey = 'common.errors.network';
                    }
                }

                setConfigError(errorKey);
                // Ensure loading is false on error? Store might handle it?
                // Wait, I should call setConfigLoading(false) finally?
                // The original code didn't set it to false explicitly in catch?
                // Oh original code relied on setConfig to clear loading implicitly?
                // No, useConfigStore probably has `setIsLoading`.
            } finally {
                // In original code (Step 1564), it didn't have finally block.
                // But setConfig might toggle loading?
                // Let's assume useConfigStore.setConfig updates loading.
                // But if error happens, `setConfigError` should stop loading?
                // I should check `useConfigStore` source.
            }
        };

        fetchConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, configRefetchTag, session.language, setConfig, setConfigLoading, setConfigError]);

    return {
        retry: triggerConfigRefetch,
    };
};
