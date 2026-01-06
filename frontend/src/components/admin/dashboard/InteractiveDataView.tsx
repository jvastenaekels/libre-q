import type { ParticipantRead } from '@/api/model';
import { useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper,
    type SortingState,
} from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, Search, Eye, Clock, Globe, ChevronRight } from 'lucide-react';
import { useGetStudyDumpApiAdminStudiesSlugDumpGet } from '@/api/generated';

// Types representing the backend dump response structure
interface DumpStatement {
    id: number;
    code?: string;
    translations: { lang: string; text: string }[];
}

interface DumpParticipant {
    id: string;
    duration_seconds: number | null;
    scores: (number | null)[]; // Array index matches study.statements index
    placements: Record<string, number>;
    presort: Record<string, string>;
    postsort: Record<string, string>;
    language: string;
}

interface DumpResponse {
    study: {
        slug: string;
        statements: DumpStatement[];
        translations: { lang: string; title: string }[];
        grid_config?: Record<string, number> | { score: number; capacity: number }[];
    };
    participants: DumpParticipant[];
    statement_id_to_index: Record<string, number>;
}

interface InteractiveDataViewProps {
    slug: string;
    participants?: ParticipantRead[]; // Optional: can be provided from loader
}

export default function InteractiveDataView({
    slug,
    participants: _providedParticipants,
}: InteractiveDataViewProps) {
    // Determine type usage for useGetStudyDumpApiAdminStudiesSlugDumpGet
    // Casting broadly as we validated the structure manually
    const { data: rawData, isLoading, error } = useGetStudyDumpApiAdminStudiesSlugDumpGet(slug);
    const data = rawData as unknown as DumpResponse;

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState<DumpParticipant | null>(null);

    // --- Table Configuration ---
    const columnHelper = createColumnHelper<DumpParticipant>();

    const columns = useMemo(
        () => [
            columnHelper.accessor('id', {
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                            className="-ml-4 hover:bg-transparent hover:text-indigo-600"
                        >
                            ID / Token
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: (info) => (
                    <div className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded w-fit">
                        {info.getValue()}
                    </div>
                ),
            }),
            columnHelper.accessor('language', {
                header: 'Lang',
                cell: (info) => (
                    <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3 text-slate-400" />
                        <span className="uppercase text-xs font-medium text-slate-600">
                            {info.getValue()}
                        </span>
                    </div>
                ),
            }),
            columnHelper.accessor('duration_seconds', {
                header: ({ column }) => (
                    <div className="flex justify-end">
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                            className="hover:bg-transparent hover:text-indigo-600 pr-0"
                        >
                            Duration
                            <Clock className="ml-2 h-3 w-3" />
                        </Button>
                    </div>
                ),
                cell: (info) => {
                    const seconds = info.getValue();
                    if (seconds === null) return <span className="text-slate-300">-</span>;
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.round(seconds % 60);
                    return (
                        <div className="text-right font-mono text-xs text-slate-600">
                            {mins}m {secs.toString().padStart(2, '0')}s
                        </div>
                    );
                },
            }),
            columnHelper.display({
                id: 'actions',
                cell: ({ row }) => (
                    <div className="flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedParticipant(row.original)}
                            className="h-8 w-8 p-0 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                ),
            }),
        ],
        [columnHelper]
    );

    const table = useReactTable({
        data: data?.participants || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            globalFilter,
        },
    });

    // --- Detail View Logic ---
    const getReconstructedQSort = (participant: DumpParticipant) => {
        if (!data?.study?.statements) return [];

        // Group statements by score
        const piles: Record<number, DumpStatement[]> = {};

        participant.scores.forEach((score, index) => {
            if (score !== null) {
                if (!piles[score]) piles[score] = [];
                // data.study.statements is sorted by ID, matching scores array index
                piles[score].push(data.study.statements[index]);
            }
        });

        // Sort piles by score from high to low (Agree -> Disagree)
        return Object.entries(piles)
            .sort(([a], [b]) => Number(b) - Number(a)) // Descending score
            .map(([score, statements]) => ({
                score: Number(score),
                statements,
            }));
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-9 w-24" />
                </div>
                <div className="rounded-md border border-slate-100">
                    <div className="p-4 space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex gap-4">
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
                Failed to load dataset. Please try refreshing the page.
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                        placeholder="Search IDs..."
                        value={globalFilter ?? ''}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-9 bg-white border-slate-200 focus-visible:ring-indigo-500 rounded-lg shadow-sm font-mono text-sm"
                    />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
                    <span className="font-semibold text-slate-700">
                        {table.getFilteredRowModel().rows.length}
                    </span>
                    <span>records found</span>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow
                                key={headerGroup.id}
                                className="hover:bg-transparent border-slate-100"
                            >
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className="h-10 text-xs font-bold uppercase tracking-wider text-slate-500"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className="cursor-pointer hover:bg-indigo-50/30 transition-colors border-slate-50 group"
                                    onClick={() => setSelectedParticipant(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="py-2.5">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-32 text-center text-slate-400 text-sm"
                                >
                                    No results found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Participant Detail Sheet */}
            <Sheet
                open={!!selectedParticipant}
                onOpenChange={(open) => !open && setSelectedParticipant(null)}
            >
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto bg-slate-50/50 p-6">
                    <SheetHeader className="mb-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <SheetTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                                    Participant
                                    <span className="font-mono bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-lg">
                                        {selectedParticipant?.id}
                                    </span>
                                </SheetTitle>
                                <SheetDescription className="text-slate-500">
                                    Submitted Q-Sort and metadata.
                                </SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>

                    {selectedParticipant && (
                        <div className="space-y-8">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-1">
                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" /> Duration
                                    </div>
                                    <div className="text-2xl font-bold text-slate-700 font-mono">
                                        {selectedParticipant.duration_seconds
                                            ? `${Math.round(selectedParticipant.duration_seconds / 60)}m`
                                            : '-'}
                                        <span className="text-sm text-slate-400 font-normal ml-1">
                                            {selectedParticipant.duration_seconds
                                                ? `${Math.round(selectedParticipant.duration_seconds % 60)}s`
                                                : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-1">
                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5" /> Language
                                    </div>
                                    <div className="text-2xl font-bold text-slate-700 uppercase">
                                        {selectedParticipant.language}
                                    </div>
                                </div>
                            </div>

                            {/* Q-Sort Reconstruction */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-indigo-500" />
                                    Sort Configuration
                                </h3>
                                <div className="space-y-6 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 before:-z-10">
                                    {getReconstructedQSort(selectedParticipant).map((pile) => (
                                        <div key={pile.score} className="relative pl-10 group">
                                            {/* Score Indicator */}
                                            <div
                                                className={`
                                                absolute left-0 top-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border-2 z-10
                                                ${
                                                    pile.score > 0
                                                        ? 'bg-green-100 text-green-700 border-green-200'
                                                        : pile.score < 0
                                                          ? 'bg-red-100 text-red-700 border-red-200'
                                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                                }
                                              `}
                                            >
                                                {pile.score > 0 ? `+${pile.score}` : pile.score}
                                            </div>

                                            {/* Cards in this pile */}
                                            <div className="space-y-2">
                                                {pile.statements.map((stmt) => (
                                                    <div
                                                        key={stmt.id}
                                                        className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed hover:border-indigo-200 transition-colors"
                                                    >
                                                        {stmt.translations.find(
                                                            (t) =>
                                                                t.lang ===
                                                                selectedParticipant.language
                                                        )?.text ||
                                                            stmt.translations.find(
                                                                (t) => t.lang === 'en'
                                                            )?.text ||
                                                            stmt.translations[0]?.text}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Survey Answers (Future / Basic implementation) */}
                            {(Object.keys(selectedParticipant.presort).length > 0 ||
                                Object.keys(selectedParticipant.postsort).length > 0) && (
                                <div className="space-y-3 pt-6 border-t border-slate-200">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                        Survey Responses
                                    </h3>
                                    <div className="bg-slate-100/50 rounded-lg p-4 text-xs text-slate-500 italic">
                                        Full survey answers available in CSV export.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
