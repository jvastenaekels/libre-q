import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ExportCenter from '@/components/admin/dashboard/ExportCenter';

const DataExportsPage = () => {
    const { slug } = useParams<{ slug: string }>();

    return (
        <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-slate-100">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        {slug}
                        <Badge
                            variant="outline"
                            className="ml-2 bg-indigo-50 text-indigo-700 border-indigo-100 font-bold uppercase tracking-widest text-[10px]"
                        >
                            Data & Exports
                        </Badge>
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Download raw participant data and analysis-ready files.
                    </p>
                </div>
            </header>

            <div className="grid gap-6 md:grid-cols-12 pb-12">
                <div className="col-span-12 md:col-span-8">
                    <ExportCenter slug={slug || ''} />
                </div>

                <div className="col-span-12 md:col-span-4 space-y-6">
                    <Card className="border-none shadow-md bg-indigo-50/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-indigo-900 uppercase tracking-tight">
                                Format Guide
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-indigo-800/70 space-y-3 leading-relaxed">
                            <p>
                                <strong>CSV</strong>: Best for SPSS, Excel, or general spreadsheet
                                analysis. Includes all metadata and scores.
                            </p>
                            <p>
                                <strong>KenQ</strong>: The standard for modern Q-methodological
                                factor analysis. Fully compatible with Web-KenQ.
                            </p>
                            <p>
                                <strong>PQMethod</strong>: Compatibility format for legacy DOS-based
                                analysis tools (.DAT, .STA, .ANS).
                            </p>
                        </CardContent>
                    </Card>

                    <div className="p-4 rounded-xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center gap-2 opacity-60">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            More formats coming soon
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataExportsPage;
