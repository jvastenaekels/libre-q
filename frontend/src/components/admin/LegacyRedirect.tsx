/*
 * Libre-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useListStudiesApiAdminStudiesGet } from '@/api/generated';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/useAuthStore';
import { useAdminStore } from '@/store/useAdminStore';

/**
 * LegacyRedirect
 *
 * Handles redirection from old /admin/* paths to the new /app/:workspaceSlug/* modular architecture.
 * This ensures that bookmarks and old links continue to work seamlessly.
 */
export const LegacyRedirect = () => {
    const location = useLocation();
    const { workspaces } = useAuthStore();
    const { setActiveStudy, setActiveWorkspace, lastVisitedStudySlug } = useAdminStore();
    const { data: allStudies, isLoading } = useListStudiesApiAdminStudiesGet();

    useEffect(() => {
        // Redirection effect
    }, []);

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center p-8">
                <div className="w-full max-w-md space-y-4">
                    <Skeleton className="h-12 w-3/4 mx-auto rounded-xl" />
                    <Skeleton className="h-4 w-1/2 mx-auto rounded-lg" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
            </div>
        );
    }

    // Extract slug from path parts since this is a catch-all route (useParams has no :slug)
    const pathParts = location.pathname.split('/').filter(Boolean);
    const slug = pathParts[2]; // Third segment is typically the slug

    // /admin
    if (pathParts.length === 1 && pathParts[0] === 'admin') {
        // If we have a last visited study, redirect to it in its workspace
        if (lastVisitedStudySlug && allStudies) {
            const study = allStudies.find((s) => s.slug === lastVisitedStudySlug);
            if (study?.workspace) {
                return (
                    <Navigate to={`/app/${study.workspace.slug}/studies/${study.slug}`} replace />
                );
            }
        }

        // Otherwise try last visited workspace
        const lastWs = workspaces?.[0]; // Fallback to first workspace for now
        if (lastWs) {
            return <Navigate to={`/app/${lastWs.slug}/dashboard`} replace />;
        }

        return <Navigate to="/hub" replace />;
    }

    // /admin/studies/:slug/...
    if (pathParts[0] === 'admin' && pathParts[1] === 'studies' && slug) {
        const study = allStudies?.find((s) => s.slug === slug);
        if (study?.workspace) {
            const wsSlug = study.workspace.slug;
            const subPathArray = pathParts.slice(3);
            let subPath = subPathArray.join('/');

            // Map legacy subpaths to new structure
            if (subPath === 'exports') subPath = 'data';
            if (subPath === 'team') {
                // Individual study team management is decommissioned; redirect to workspace team
                return <Navigate to={`/app/${wsSlug}/team`} replace />;
            }

            const target = `/app/${wsSlug}/studies/${slug}${subPath ? `/${subPath}` : ''}`;

            // Update state
            setActiveStudy(slug);
            setActiveWorkspace(study.workspace.id);

            return <Navigate to={target} replace />;
        }
    }

    // /admin/w/:slug
    if (pathParts[0] === 'admin' && pathParts[1] === 'w' && slug) {
        const ws = workspaces?.find((w) => w.slug === slug);
        if (ws) {
            setActiveWorkspace(ws.id);
        }
        return <Navigate to={`/app/${slug}/dashboard`} replace />;
    }

    // /admin/workspaces/:slug/settings
    if (
        pathParts[0] === 'admin' &&
        pathParts[1] === 'workspaces' &&
        pathParts[3] === 'settings' &&
        slug
    ) {
        const ws = workspaces?.find((w) => w.slug === slug);
        if (ws) {
            setActiveWorkspace(ws.id);
        }
        return <Navigate to={`/app/${slug}/settings`} replace />;
    }

    // /admin/profile
    if (pathParts[0] === 'admin' && pathParts[1] === 'profile') {
        const firstWs = workspaces?.[0];
        if (firstWs) {
            return <Navigate to={`/app/${firstWs.slug}/profile`} replace />;
        }
        return <Navigate to="/hub" replace />;
    }

    // Default fallback to hub
    return <Navigate to="/hub" replace />;
};
