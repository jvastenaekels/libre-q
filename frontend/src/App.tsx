/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

/**
 * Root Application Component
 *
 * Sets up routing, global error handling, and lazy loading of pages.
 */

import { lazy, useEffect } from 'react';
import {
    createBrowserRouter,
    RouterProvider,
    Navigate,
    useParams,
    useLocation,
} from 'react-router-dom';
import { ApiError } from './api/client';
import ErrorBoundary from './components/ErrorBoundary';

import { useAuthStore } from './store/useAuthStore';
import { useAdminStore } from './store/useAdminStore';
import StudyLayout from './layouts/StudyLayout';
import ConsentPage from './pages/ConsentPage';
import ErrorPage from './pages/ErrorPage';
import LandingPage from './pages/LandingPage';
import PostSortPage from './pages/PostSortPage';
import PreSortPage from './pages/PreSortPage';
import ResetPage from './pages/ResetPage';
import RoughSortPage from './pages/RoughSortPage';
import WelcomePage from './pages/WelcomePage';
import { Toaster } from 'sonner';
import GeneralSettingsPage from '@/pages/admin/GeneralSettingsPage'; // Added import
import RouteErrorBoundary from './components/RouteErrorBoundary';

// Lazy load heavy interactive components
const FineSortPage = lazy(() => import('./pages/FineSortPage'));
const RegistrationPage = lazy(() => import('./pages/RegistrationPage'));
import LoginPage from './pages/LoginPage';

// Admin imports
// Admins imports
import RequireAdmin from './components/auth/RequireAdmin';
// const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
import AdminLayout from './layouts/AdminLayout';
const StudyOverviewPage = lazy(() => import('./pages/admin/StudyOverviewPage'));
const StudyDesignPage = lazy(() => import('./pages/admin/StudyDesignPage'));
const TeamManagementPage = lazy(() => import('./pages/admin/TeamManagementPage'));
const RecruitmentPage = lazy(() => import('./pages/admin/RecruitmentPage'));

// const DataExportsPage = lazy(() => import('./pages/admin/DataExportsPage'));
import DataExportsPage from './pages/admin/DataExportsPage';
const ParticipantDetailsPage = lazy(() => import('./pages/admin/ParticipantDetailsPage'));
const DesignerPreviewPage = lazy(() => import('./pages/admin/DesignerPreviewPage'));
const ProfilePage = lazy(() => import('./pages/admin/ProfilePage'));
const WorkspaceSettingsPage = lazy(() => import('./pages/admin/WorkspaceSettingsPage'));
const CreateWorkspacePage = lazy(() => import('./pages/admin/CreateWorkspacePage'));
import { recruitmentPageLoader } from './pages/admin/RecruitmentPage.loader';

import { studyLayoutLoader } from './layouts/StudyLayout.loader';
import { studyOverviewPageLoader } from './pages/admin/StudyOverviewPage.loader';
import { teamManagementPageLoader } from './pages/admin/TeamManagementPage.loader';
import { dataExportsPageLoader } from './pages/admin/DataExportsPage.loader';
import { generalSettingsPageLoader } from './pages/admin/GeneralSettingsPage.loader';
import { workspaceSettingsPageLoader } from './pages/admin/WorkspaceSettingsPage.loader';

// Lazy load Admin Dashboard to prevent heavy libs leak
const AdminDashboard = lazy(() =>
    import('@/components/admin/AdminDashboard').then((module) => ({
        default: module.AdminDashboard,
    }))
);

const AdminIndex = () => {
    const { user, workspaces } = useAuthStore();
    const { lastVisitedStudySlug } = useAdminStore();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);

    // If superuser has no workspaces, redirect to create workspace page
    if (user?.is_superuser && (!workspaces || workspaces.length === 0)) {
        return <Navigate to="/admin/workspaces/new" replace />;
    }

    // Auto-redirect to last study if available, unless forced to dashboard
    if (lastVisitedStudySlug && !searchParams.has('dashboard')) {
        return <Navigate to={`/admin/studies/${lastVisitedStudySlug}`} replace />;
    }

    return <AdminDashboard />;
};

const AdminWorkspaceRoute = () => {
    const { slug } = useParams();
    const { workspaces, setCurrentWorkspace, currentWorkspace } = useAuthStore();

    // biome-ignore lint/correctness/useExhaustiveDependencies: updates on mount or slug change
    useEffect(() => {
        if (slug && workspaces) {
            const ws = workspaces.find((w) => w.slug === slug);
            if (ws && ws.id !== currentWorkspace?.id) {
                setCurrentWorkspace(ws);
            }
        }
    }, [slug, workspaces]);

    return <AdminDashboard />;
};

const router = createBrowserRouter([
    {
        path: '/',
        element: <LandingPage />,
    },
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        path: '/register',
        element: <RegistrationPage />,
    },
    {
        path: '/admin',
        element: <RequireAdmin />,
        children: [
            {
                element: <AdminLayout />,
                children: [
                    {
                        index: true,
                        element: <AdminIndex />,
                    },
                    {
                        path: 'w/:slug',
                        element: <AdminWorkspaceRoute />,
                    },
                    {
                        path: 'studies/:slug',
                        element: <StudyOverviewPage />,
                        loader: studyOverviewPageLoader,
                    },
                    {
                        path: 'studies/:slug/participants/:participantId',
                        element: <ParticipantDetailsPage />,
                    },
                    {
                        path: 'studies/:slug/design',
                        element: <StudyDesignPage />,
                    },
                    {
                        path: 'studies/:slug/settings',
                        element: <GeneralSettingsPage />,
                        loader: generalSettingsPageLoader,
                    },
                    {
                        path: 'studies/:slug/team',
                        element: <TeamManagementPage />,
                        loader: teamManagementPageLoader,
                    },
                    {
                        path: 'studies/:slug/recruitment',
                        element: <RecruitmentPage />,
                        loader: recruitmentPageLoader,
                    },

                    {
                        path: 'studies/:slug/exports',
                        element: <DataExportsPage />,
                        loader: dataExportsPageLoader,
                    },
                    {
                        path: 'workspaces/:slug/settings',
                        element: <WorkspaceSettingsPage />,
                        loader: workspaceSettingsPageLoader,
                    },
                    {
                        path: 'workspaces/new',
                        element: <CreateWorkspacePage />,
                    },
                    {
                        path: 'profile',
                        element: <ProfilePage />,
                    },
                ],
            },
            {
                path: 'studies/:slug/design/preview',
                element: <DesignerPreviewPage />,
            },
        ],
    },
    {
        path: '/study/:slug',
        element: <StudyLayout />,
        loader: studyLayoutLoader,
        errorElement: <RouteErrorBoundary />,
        children: [
            { path: 'welcome', element: <WelcomePage /> },
            { path: 'consent', element: <ConsentPage /> },
            { path: 'presort', element: <PreSortPage /> },
            { path: 'rough-sort', element: <RoughSortPage /> },
            { path: 'fine-sort', element: <FineSortPage /> },
            { path: 'post-sort', element: <PostSortPage /> },
            { path: 'reset', element: <ResetPage /> },
            {
                path: '*',
                element: <ErrorPage error={new ApiError(404, 'Page not found')} />,
            },
        ],
    },
]);

import { ViewportProvider } from '@/contexts/ViewportContext';

const App = () => {
    return (
        <ErrorBoundary>
            <ViewportProvider>
                <RouterProvider router={router} />
            </ViewportProvider>
            <Toaster richColors position="top-center" closeButton />
        </ErrorBoundary>
    );
};

export default App;
