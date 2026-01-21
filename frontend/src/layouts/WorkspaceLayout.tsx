/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { Outlet, useParams, Navigate } from 'react-router-dom';
import { useGetWorkspaceApiAdminWorkspacesSlugGet } from '@/api/generated';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/api/client';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAdminStore } from '@/store/useAdminStore';

/**
 * WorkspaceLayout
 *
 * Fetches and validates workspace context based on URL slug.
 * Provides workspace data to all nested routes via context.
 */
export default function WorkspaceLayout() {
    const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
    const { setCurrentWorkspace } = useAuthStore();
    const { setActiveWorkspace } = useAdminStore();

    const {
        data: workspace,
        isLoading,
        error,
    } = useGetWorkspaceApiAdminWorkspacesSlugGet(workspaceSlug ?? '', {
        query: {
            enabled: !!workspaceSlug,
        },
    });

    // Sync store state when workspace is fetched
    useEffect(() => {
        if (workspace) {
            // biome-ignore lint/suspicious/noExplicitAny: casting for store compatibility
            setCurrentWorkspace(workspace as any);
            setActiveWorkspace(workspace.id);
        }
    }, [workspace, setCurrentWorkspace, setActiveWorkspace]);

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Skeleton className="h-[600px] w-full max-w-5xl" />
            </div>
        );
    }

    // Error state - 403 means no access
    if (error) {
        const status = (error as { status?: number })?.status || 500;
        if (status === 403) {
            return <Navigate to="/hub" replace />;
        }
        return <ErrorPage error={new ApiError(status, 'Workspace not found or access denied')} />;
    }

    // No workspace found
    if (!workspace) {
        return <ErrorPage error={new ApiError(404, 'Workspace not found')} />;
    }

    // Render nested routes with workspace context
    return <Outlet context={{ workspace }} />;
}
