import { AppSidebar } from '@/components/admin/AppSidebar';
import { CommandMenu } from '@/components/admin/CommandMenu';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useAdminStore } from '@/store/useAdminStore';
import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function AdminLayout() {
    const location = useLocation();
    const { activeStudyId, setActiveStudy } = useAdminStore();
    const { t } = useTranslation();

    useEffect(() => {
        const match = location.pathname.match(/\/admin\/studies\/([^/]+)/);
        if (match && match[1] !== activeStudyId) {
            setActiveStudy(match[1]);
        }
    }, [location.pathname, activeStudyId, setActiveStudy]);

    // Simple breadcrumb logic
    const _pathSegments = location.pathname.split('/').filter(Boolean);
    // pathSegments: ['admin', 'studies', 'slug', 'design']

    // We want: Admin > [Study Slug] > [Page Name]

    return (
        <SidebarProvider>
            <CommandMenu />
            <AppSidebar />

            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink
                                        href="/admin"
                                        className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {t('admin.layout.title')}
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                {activeStudyId && (
                                    <>
                                        <BreadcrumbItem className="hidden md:block">
                                            <BreadcrumbLink
                                                href={`/admin/studies/${activeStudyId}`}
                                                className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
                                            >
                                                {activeStudyId.replace(/-/g, ' ')}
                                            </BreadcrumbLink>
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator className="hidden md:block" />
                                    </>
                                )}
                                {location.pathname.includes('/workspaces/') && (
                                    <>
                                        <BreadcrumbItem className="hidden md:block">
                                            <BreadcrumbLink
                                                href="#"
                                                className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors pointer-events-none"
                                            >
                                                {location.pathname.split('/')[3].replace(/-/g, ' ')}
                                            </BreadcrumbLink>
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator className="hidden md:block" />
                                    </>
                                )}
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-sm font-black tracking-tight text-slate-900 bg-slate-100/50 px-2 py-0.5 rounded-md border border-slate-200/50 shadow-sm transition-all duration-300">
                                        {(() => {
                                            const segments = location.pathname
                                                .split('/')
                                                .filter(Boolean);
                                            const last = segments[segments.length - 1];
                                            // Map common segments to prettier names
                                            const mapping: Record<string, string> = {
                                                design: t('admin.breadcrumbs.design'),
                                                team: t('admin.breadcrumbs.team'),
                                                recruitment: t('admin.breadcrumbs.recruitment'),
                                                exports: t('admin.breadcrumbs.exports'),
                                                settings: t('admin.breadcrumbs.settings'),
                                            };
                                            if (last === 'admin')
                                                return t('admin.breadcrumbs.dashboard');
                                            if (last === activeStudyId)
                                                return t('admin.breadcrumbs.study_dashboard');
                                            return (
                                                mapping[last] ||
                                                last.charAt(0).toUpperCase() + last.slice(1)
                                            );
                                        })()}
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="flex items-center gap-4 px-4">
                        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shadow-sm animate-pulse-slow">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                {t('admin.layout.beta')}
                            </span>
                        </div>
                    </div>
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
