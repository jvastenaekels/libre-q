/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { useAuthStore } from '@/store/useAuthStore';
import type { WorkspaceRole } from '@/api/model/workspaceRole';

type Permission =
    | 'workspace:delete'
    | 'workspace:manage_team'
    | 'workspace:settings'
    | 'study:create'
    | 'study:delete'
    | 'study:edit_design'
    | 'study:edit_settings'
    | 'study:view_data'
    | 'study:launch_recruitment';

/**
 * Permission matrix based on workspace roles
 *
 * Roles:
 * - owner: Full control over workspace and all studies
 * - researcher: Can create and edit studies, but cannot manage workspace team
 * - viewer: Read-only access
 */
const PERMISSION_MATRIX: Record<WorkspaceRole, Set<Permission>> = {
    owner: new Set([
        'workspace:delete',
        'workspace:manage_team',
        'workspace:settings',
        'study:create',
        'study:delete',
        'study:edit_design',
        'study:edit_settings',
        'study:view_data',
        'study:launch_recruitment',
    ]),
    researcher: new Set([
        'study:create',
        'study:delete',
        'study:edit_design',
        'study:edit_settings',
        'study:view_data',
        'study:launch_recruitment',
    ]),
    viewer: new Set(['study:view_data']),
};

/**
 * Hook to check user permissions based on workspace role
 */
export function usePermission() {
    const { currentWorkspace } = useAuthStore();

    const hasPermission = (permission: Permission): boolean => {
        if (!currentWorkspace?.user_role) {
            return false;
        }

        const role = currentWorkspace.user_role as WorkspaceRole;
        const rolePermissions = PERMISSION_MATRIX[role];
        return rolePermissions?.has(permission) || false;
    };

    const can = (permission: Permission): boolean => hasPermission(permission);
    const cannot = (permission: Permission): boolean => !hasPermission(permission);

    return {
        can,
        cannot,
        role: currentWorkspace?.user_role,
        isOwner: currentWorkspace?.user_role === 'owner',
        isResearcher: currentWorkspace?.user_role === 'researcher',
        isViewer: currentWorkspace?.user_role === 'viewer',
    };
}
