import { useEffect, useRef } from 'react';
import { useStudyDesigner, projectStudyToUpdate, areStudiesEqual } from '@/store/useStudyDesigner';
import { useUpdateStudyApiAdminStudiesSlugPatch } from '@/api/generated';
import { useParams } from 'react-router-dom';

/**
 * Custom hook that monitors the study designer draft and automatically
 * persists changes to the backend with a debounce.
 */
export function useAutoSave(debounceMs = 2000) {
    const { slug } = useParams<{ slug: string }>();
    const { draft, original, syncStatus, setSyncStatus, setLastSavedAt, updateOriginal } =
        useStudyDesigner();

    const updateMutation = useUpdateStudyApiAdminStudiesSlugPatch();
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Track the last draft we successfully sent to avoid redundant saves
    const lastSavedDraftRef = useRef<string | null>(null);
    const retryCountRef = useRef(0);

    // 1. Immediate Persistence Layer: LocalStorage Backup (zero debounce)
    useEffect(() => {
        if (!draft || !slug) return;
        localStorage.setItem(`open-q-draft-backup-${slug}`, JSON.stringify(draft));
    }, [draft, slug]);

    // 2. BeforeUnload Guard
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (syncStatus === 'modified' || syncStatus === 'saving') {
                e.preventDefault();
                e.returnValue = ''; // Required for some browsers
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [syncStatus]);

    useEffect(() => {
        if (!draft || !slug) return;

        // 1. Detect if something actually changed relative to what's on server or last saved
        const draftJson = JSON.stringify(draft);

        // Normalize original study to same schema as draft/backup
        const originalDraft = original ? projectStudyToUpdate(original) : null;

        // If draft content matches original content or last saved content
        const isSyncedWithOriginal = areStudiesEqual(draft, originalDraft);
        const isSyncedWithLastSave =
            lastSavedDraftRef.current &&
            areStudiesEqual(draft, JSON.parse(lastSavedDraftRef.current));

        if (isSyncedWithOriginal || isSyncedWithLastSave) {
            if (syncStatus !== 'synced' && syncStatus !== 'saving') {
                setSyncStatus('synced');
            }
            return;
        }

        // 2. Mark as modified (only if not already modified or saving)
        if (syncStatus !== 'modified' && syncStatus !== 'saving') {
            setSyncStatus('modified');
        }

        // 3. Clear existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // 4. Set new timer for auto-save
        timerRef.current = setTimeout(async () => {
            // Cancel any in-flight requests
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            setSyncStatus('saving');

            const attemptSave = async (retry = 0) => {
                try {
                    const result = await updateMutation.mutateAsync({
                        slug,
                        // biome-ignore lint/suspicious/noExplicitAny: schema cast
                        data: draft as any,
                    });

                    // Success
                    lastSavedDraftRef.current = draftJson;
                    setSyncStatus('synced');
                    setLastSavedAt(new Date());
                    retryCountRef.current = 0;

                    // Sync original and backup immediately to reflect server state
                    updateOriginal(result);
                    localStorage.setItem(`open-q-draft-backup-${slug}`, draftJson);
                } catch (error) {
                    // If it was cancelled, don't show error
                    if (error instanceof Error && error.name === 'AbortError') {
                        return;
                    }

                    console.error(`Auto-save attempt ${retry + 1} failed:`, error);

                    if (retry < 3 && navigator.onLine) {
                        const delay = 2 ** retry * 1000;
                        setTimeout(() => attemptSave(retry + 1), delay);
                    } else {
                        setSyncStatus('error');
                    }
                }
            };

            await attemptSave();
        }, debounceMs);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [
        draft,
        slug,
        original,
        syncStatus,
        setSyncStatus,
        setLastSavedAt,
        updateOriginal,
        updateMutation,
        debounceMs,
    ]);

    return {
        syncStatus,
        lastSavedAt: useStudyDesigner.getState().lastSavedAt,
    };
}
