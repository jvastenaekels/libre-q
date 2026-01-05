import { useState } from 'react';
import { Plus, Layout, Activity, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useListStudiesApiAdminStudiesGet } from '@/api/generated';
import { CreateStudyDialog } from '@/components/admin/CreateStudyDialog';
import { useAdminStore } from '@/store/useAdminStore';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { setActiveStudy, activeWorkspaceId } = useAdminStore();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const { data: allStudies, isLoading } = useListStudiesApiAdminStudiesGet();

    const studies = allStudies?.filter((s) => s.workspace_id === activeWorkspaceId);

    const activeStudiesCount = studies?.filter((s) => s.state === 'active').length || 0;
    const totalStudies = studies?.length || 0;

    const handleOpenStudy = (slug: string) => {
        setActiveStudy(slug);
        navigate(`/admin/studies/${slug}`);
    };

    if (isLoading) {
        return (
            <div className="p-8">
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-6 md:gap-10 p-4 md:p-8 max-w-[1600px] mx-auto animate-in fade-in-50 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-500 bg-clip-text text-transparent">
                        Workspace Dashboard
                    </h1>
                    <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
                        Welcome back,{' '}
                        <span className="text-slate-900 font-semibold">
                            {user?.email.split('@')[0]}
                        </span>
                        . Here's a snapshot of your research activity.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setShowCreateDialog(true)}
                        className="w-full md:w-auto shadow-md hover:shadow-lg transition-all"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Create Study
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="hover:shadow-md transition-shadow border-none shadow-sm bg-white/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">
                            Total Studies
                        </CardTitle>
                        <Layout className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalStudies}</div>
                        <p className="text-xs text-muted-foreground">Across all statuses</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-lg transition-shadow border-none shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50/50">
                        <CardTitle className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                            Active Data Collection
                        </CardTitle>
                        <Activity className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-slate-900">
                            {activeStudiesCount}
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase">
                            Studies receiving responses
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Studies */}
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Recent Studies</CardTitle>
                    <CardDescription>A list of your most recently updated studies.</CardDescription>
                </CardHeader>
                <CardContent>
                    {studies && studies.length > 0 ? (
                        <div className="space-y-4">
                            {studies.slice(0, 5).map((study) => (
                                <div
                                    key={study.id}
                                    role="button"
                                    tabIndex={0}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                                    onClick={() => handleOpenStudy(study.slug)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            handleOpenStudy(study.slug);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {study.slug.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium group-hover:text-primary transition-colors">
                                                {study.slug}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Created{' '}
                                                {formatDistanceToNow(new Date(study.created_at), {
                                                    addSuffix: true,
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                study.state === 'active'
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                                            }`}
                                        >
                                            {study.state}
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            No studies found. Create your first study to get started!
                        </div>
                    )}
                </CardContent>
            </Card>

            <CreateStudyDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
        </div>
    );
}
