import { useEffect } from 'react';
import { useStudyDesigner } from '@/store/useStudyDesigner';
import { useParams } from 'react-router-dom';

/**
 * useDesignerPreviewSync
 *
 * Broadcasts the current study draft and active state to the Live Preview window
 * via BroadcastChannel. This allows researchers to see their changes in real-time
 * without needing to save or manually refresh the preview.
 */
export function useDesignerPreviewSync() {
    const { studySlug, workspaceSlug } = useParams<{
        studySlug: string;
        workspaceSlug: string;
    }>();
    const effectiveSlug = studySlug || workspaceSlug;
    const { draft, activeStep, activeLocale } = useStudyDesigner();

    useEffect(() => {
        if (!effectiveSlug || !draft) return;

        const bc = new BroadcastChannel(`open-q-designer-${effectiveSlug}`);

        // Broadcast current state to any listening preview tabs
        bc.postMessage({
            type: 'SYNC_DRAFT',
            payload: {
                config: draft,
                activeStep,
                activeLocale,
            },
        });

        // Also update the local storage "source of truth" for new tabs opening
        localStorage.setItem(
            `open-q-designer-sync-${effectiveSlug}`,
            JSON.stringify({
                config: draft,
                activeStep,
                activeLocale,
            })
        );

        return () => {
            bc.close();
        };
    }, [effectiveSlug, draft, activeStep, activeLocale]);
}
