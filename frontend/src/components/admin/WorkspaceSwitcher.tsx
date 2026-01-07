import * as React from 'react';
import { ChevronsUpDown, Plus, Briefcase, Layout, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import {
    useListWorkspacesApiAdminWorkspacesGet,
    useListStudiesApiAdminStudiesGet,
} from '@/api/generated';
import { useAdminStore } from '@/store/useAdminStore';
import { Skeleton } from '@/components/ui/skeleton';

export function WorkspaceSwitcher() {
    const { isMobile } = useSidebar();
    const { t } = useTranslation();
    const { data: workspaces, isLoading: isWorkspacesLoading } =
        useListWorkspacesApiAdminWorkspacesGet();
    const { data: studies, isLoading: isStudiesLoading } = useListStudiesApiAdminStudiesGet();
    const { activeWorkspaceId, setActiveWorkspace } = useAdminStore();

    const isLoading = isWorkspacesLoading || isStudiesLoading;

    const activeWorkspace = workspaces?.find((w) => w.id === activeWorkspaceId);

    // Auto-select first workspace if none selected and data loaded
    React.useEffect(() => {
        if (!activeWorkspaceId && workspaces && workspaces.length > 0) {
            setActiveWorkspace(workspaces[0].id);
        }
    }, [activeWorkspaceId, workspaces, setActiveWorkspace]);

    if (isLoading) {
        return (
            <SidebarMenu>
                <SidebarMenuItem>
                    <Skeleton className="h-12 w-full" />
                </SidebarMenuItem>
            </SidebarMenu>
        );
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-300 hover:bg-sidebar-accent/50"
                        >
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-500/20">
                                <Briefcase className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                                <span className="truncate font-bold tracking-tight text-slate-900">
                                    {activeWorkspace ? activeWorkspace.title : 'Select Workspace'}
                                </span>
                                {activeWorkspace && (
                                    <span className="truncate text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        {studies?.filter(
                                            (s) => s.workspace_id === activeWorkspace.id
                                        ).length || 0}{' '}
                                        {studies?.filter(
                                            (s) => s.workspace_id === activeWorkspace.id
                                        ).length === 1
                                            ? t
                                                ? t('admin.sidebar.study', 'Study')
                                                : 'Study'
                                            : t
                                              ? t('admin.sidebar.studies', 'Studies')
                                              : 'Studies'}
                                    </span>
                                )}
                            </div>
                            <ChevronsUpDown className="ml-auto size-4 text-slate-400" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl border-white/20 bg-white/80 backdrop-blur-xl shadow-2xl p-2 animate-in fade-in-0 zoom-in-95"
                        align="start"
                        side={isMobile ? 'bottom' : 'right'}
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
                            Workspaces
                        </DropdownMenuLabel>
                        <div className="space-y-1 my-1">
                            {workspaces?.map((workspace) => {
                                const studyCount =
                                    studies?.filter((s) => s.workspace_id === workspace.id)
                                        .length || 0;
                                const isActive = workspace.id === activeWorkspaceId;
                                return (
                                    <DropdownMenuItem
                                        key={workspace.id}
                                        onClick={() => setActiveWorkspace(workspace.id)}
                                        className={cn(
                                            'flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-all duration-200 outline-none',
                                            isActive
                                                ? 'bg-indigo-50 text-indigo-700 shadow-sm border-indigo-100'
                                                : 'hover:bg-slate-50 text-slate-600'
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'flex size-7 items-center justify-center rounded-md border shadow-sm transition-transform duration-300',
                                                isActive
                                                    ? 'bg-indigo-600 text-white border-indigo-700 scale-105'
                                                    : 'bg-white border-slate-200'
                                            )}
                                        >
                                            <Briefcase className="size-3.5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold">
                                                {workspace.title}
                                            </span>
                                            <span className="text-[10px] font-medium opacity-60 flex items-center gap-1">
                                                <Layout className="size-2.5" /> {studyCount}
                                            </span>
                                        </div>
                                        {isActive && (
                                            <div className="ml-auto flex items-center gap-1 bg-indigo-100/50 px-1.5 py-0.5 rounded-full ring-1 ring-indigo-500/20">
                                                <div className="size-1 rounded-full bg-indigo-500 animate-pulse" />
                                                <span className="text-[9px] font-black uppercase tracking-tighter">
                                                    Active
                                                </span>
                                            </div>
                                        )}
                                    </DropdownMenuItem>
                                );
                            })}
                        </div>
                        <DropdownMenuSeparator className="bg-slate-100 my-1" />
                        {activeWorkspace && (
                            <DropdownMenuItem
                                className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-slate-50 text-slate-600 transition-all duration-200"
                                onClick={() => {
                                    window.location.href = `/admin/workspaces/${activeWorkspace.slug}/settings`;
                                }}
                            >
                                <div className="flex size-7 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm">
                                    <Settings className="size-3.5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold">Workspace Settings</span>
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                        Members & Profiles
                                    </span>
                                </div>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                            className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-not-allowed opacity-60 text-slate-400 group"
                            disabled
                        >
                            <div className="flex size-7 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 transition-colors group-hover:border-slate-300">
                                <Plus className="size-3.5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">New Workspace</span>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Coming Soon
                                </span>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
