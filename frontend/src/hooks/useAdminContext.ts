import { useOutletContext } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import type { WorkspaceWithRole } from '@/types/backend';
import type { StudyRead } from '@/api/model';

interface AdminContext {
    workspace?: WorkspaceWithRole;
    study?: StudyRead;
}

/**
 * useAdminContext
 *
 * Safely consumes routing context with fallbacks to global stores.
 * Prevents crashes during hydration or deep-linking if React Router context is temporarily undefined.
 */
export function useAdminContext() {
    const context = useOutletContext<AdminContext>() || {};
    const { currentWorkspace: storeWorkspace } = useAuthStore();

    return {
        workspace: context.workspace || (storeWorkspace as WorkspaceWithRole | undefined),
        study: context.study,
    };
}
