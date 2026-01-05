import { useParams } from 'react-router-dom';
import {
    useGetStudyStatsApiAdminStudiesSlugStatsGet,
    useListStudyParticipantsApiAdminStudiesSlugParticipantsGet,
    useDiscardParticipantApiAdminStudiesParticipantsParticipantIdDiscardPatch,
    useGetStudyApiAdminStudiesSlugGet,
} from '@/api/generated';
import ParticipantTable from '@/components/admin/dashboard/ParticipantTable';
import ParticipantDetailSheet from '@/components/admin/dashboard/ParticipantDetailSheet';
import ExportCenter from '@/components/admin/dashboard/ExportCenter';
import RecruitmentModule from '@/components/admin/dashboard/RecruitmentModule';
import { DashboardSkeleton } from '@/components/admin/DashboardSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, Users, PencilRuler, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ParticipantRead as Participant } from '@/api/model';
import { toast } from 'sonner';
import StudyStatusControl from '@/components/admin/dashboard/StudyStatusControl';
import { cn } from '@/lib/utils';

const StudyOverviewPage = () => {
    const { slug } = useParams();
    const { data: stats, isLoading: statsLoading } = useGetStudyStatsApiAdminStudiesSlugStatsGet(
        slug || ''
    );
    const { data: study, refetch: refetchStudy } = useGetStudyApiAdminStudiesSlugGet(slug || '');
    const {
        data: participants,
        isLoading: participantsLoading,
        refetch: refetchParticipants,
    } = useListStudyParticipantsApiAdminStudiesSlugParticipantsGet(slug || '');
    const { refetch: refetchStats } = useGetStudyStatsApiAdminStudiesSlugStatsGet(slug || '');
    const discardMutation =
        useDiscardParticipantApiAdminStudiesParticipantsParticipantIdDiscardPatch();

    const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const handleViewDetail = (p: Participant) => {
        setSelectedParticipantId(p.id);
        setDetailOpen(true);
    };

    const handleToggleDiscard = async (id: number, isDiscarded: boolean) => {
        try {
            await discardMutation.mutateAsync({
                participantId: id,
                data: {
                    is_discarded: isDiscarded,
                    discard_reason: isDiscarded ? 'Manual review' : null,
                },
            });
            toast.success(isDiscarded ? 'Participant flagged' : 'Participant restored');
            refetchParticipants();
        } catch (_err) {
            toast.error('Failed to update participant status');
        }
    };

    if (statsLoading || participantsLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-slate-100">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        {slug}
                        {stats && (
                            <Badge
                                variant="outline"
                                role="status"
                                className={cn(
                                    'ml-2 font-bold uppercase tracking-widest text-[10px]',
                                    study?.state === 'active'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : study?.state === 'closed'
                                          ? 'bg-slate-50 text-slate-700 border-slate-100'
                                          : 'bg-amber-50 text-amber-700 border-amber-100'
                                )}
                            >
                                {study?.state === 'active'
                                    ? 'Active'
                                    : study?.state === 'closed'
                                      ? 'Closed'
                                      : 'Draft'}
                            </Badge>
                        )}
                        {study?.state === 'draft' && (
                            <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="ml-4 gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                            >
                                <Link to={`/admin/studies/${slug}/design`}>
                                    <PencilRuler className="h-4 w-4" />
                                    Edit Study Design
                                </Link>
                            </Button>
                        )}
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Real-time analytics and participant overview for this study.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {study?.translations?.map((t) => (
                        <Badge key={t.language_code} variant="secondary" className="text-xs">
                            {t.language_code.toUpperCase()}
                        </Badge>
                    ))}
                    {study?.state === 'active' && (
                        <div className="bg-white shadow-sm border rounded-lg px-4 py-2 flex items-center gap-3">
                            <div className="relative">
                                <Activity className="h-4 w-4 text-emerald-500" />
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            </div>
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Receiving Data
                            </span>
                        </div>
                    )}
                </div>
            </header>

            {/* Key Metrics Dashboard + Study Status */}
            {stats && (
                <div className="-mx-4 md:-mx-6 lg:-mx-0 bg-gradient-to-br from-slate-50 to-white px-4 md:px-6 lg:px-6 py-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-4">
                        {/* Study Status - Most Important (2 columns) */}
                        <div className="md:col-span-1">
                            <StudyStatusControl
                                slug={slug || ''}
                                currentState={study?.state || 'draft'}
                                onStateChange={() => {
                                    refetchStudy();
                                    refetchParticipants();
                                    refetchStats();
                                }}
                            />
                        </div>

                        {/* Key Metrics (3 columns) */}
                        <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
                            {/* Sample Size */}
                            <Card className="overflow-hidden border-2 border-indigo-100 shadow-md bg-gradient-to-br from-indigo-50/50 to-white">
                                <CardContent className="pt-4 pb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="h-4 w-4 text-indigo-600" />
                                        <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                                            Sample Size (N)
                                        </div>
                                    </div>
                                    <div className="text-5xl font-black text-indigo-900 mb-1">
                                        {stats.started_count}
                                    </div>
                                    <p className="text-xs text-indigo-600/70 font-medium">
                                        {stats.completed_count} completed
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Completion Rate */}
                            <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white">
                                <CardContent className="pt-4 pb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Completion Rate
                                        </div>
                                    </div>
                                    <div className="text-4xl font-bold text-emerald-600 mb-2">
                                        {Math.round(
                                            (stats.completed_count / stats.started_count) * 100
                                        ) || 0}
                                        %
                                    </div>
                                    <Progress
                                        value={
                                            Math.round(
                                                (stats.completed_count / stats.started_count) * 100
                                            ) || 0
                                        }
                                        className="h-1.5 bg-emerald-50 mb-1.5"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400">
                                        <span>
                                            {stats.started_count - stats.completed_count} active
                                        </span>
                                        <span>
                                            {Math.round(
                                                ((stats.device_breakdown?.mobile || 0) /
                                                    ((stats.device_breakdown?.mobile || 0) +
                                                        (stats.device_breakdown?.desktop || 0))) *
                                                    100
                                            ) || 0}
                                            % mobile
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Median Duration */}
                            <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white">
                                <CardContent className="pt-4 pb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="h-4 w-4 text-amber-500" />
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Median Duration
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <div className="text-4xl font-bold text-slate-900">
                                            {stats.median_duration_seconds
                                                ? `${Math.floor(stats.median_duration_seconds / 60)}m ${stats.median_duration_seconds % 60}s`
                                                : '--'}
                                        </div>
                                        {stats.median_duration_seconds &&
                                            stats.median_duration_seconds < 120 && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold uppercase ring-1 ring-amber-200">
                                                    <AlertTriangle size={9} /> Suspect
                                                </span>
                                            )}
                                    </div>
                                    <p className="text-[10px] text-slate-400">Time to complete</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-12 pb-12">
                <Card className="col-span-12 md:col-span-8 shadow-md border-none bg-slate-50/30">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-white/50">
                        <div className="space-y-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="h-5 w-5 text-indigo-500" />
                                Collected Data Overview
                            </CardTitle>
                            <CardDescription>
                                Showing {Math.min((participants || []).length, 10)} most recent
                                responses
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <ParticipantTable
                            data={(participants || []).slice(0, 10)}
                            onViewDetail={handleViewDetail}
                            onToggleDiscard={handleToggleDiscard}
                        />
                    </CardContent>
                </Card>

                <div className="col-span-12 md:col-span-4 space-y-6">
                    <RecruitmentModule slug={slug || ''} />
                    <ExportCenter slug={slug || ''} />
                </div>
            </div>

            <ParticipantDetailSheet
                participantId={selectedParticipantId}
                open={detailOpen}
                onOpenChange={setDetailOpen}
            />
        </div>
    );
};

export default StudyOverviewPage;
