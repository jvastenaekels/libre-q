import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExportCenter from '@/components/admin/dashboard/ExportCenter';
import InteractiveDataView from '@/components/admin/dashboard/InteractiveDataView';
import { Database, Download, Table as TableIcon } from 'lucide-react';

const DataExportsPage = () => {
    const { slug } = useParams<{ slug: string }>();

    return (
        <div className="flex flex-1 flex-col gap-6 p-6 pt-2 h-[calc(100vh-4rem)] overflow-hidden">
            <header className="flex-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-slate-100">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        {slug}
                        <Badge
                            variant="outline"
                            className="ml-2 bg-indigo-50 text-indigo-700 border-indigo-100 font-bold uppercase tracking-widest text-[10px]"
                        >
                            Analytics & data
                        </Badge>
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Inspect participant data and export datasets.
                    </p>
                </div>
            </header>

            <Tabs defaultValue="browse" className="flex-1 flex flex-col min-h-0">
                <div className="flex-none pb-4">
                    <TabsList className="bg-slate-100/50 border border-slate-200 p-1 rounded-xl w-full sm:w-auto grid grid-cols-2 sm:flex sm:inline-flex">
                        <TabsTrigger
                            value="browse"
                            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-4 py-2 gap-2 transition-all"
                        >
                            <TableIcon className="w-4 h-4" />
                            Interactive view
                        </TabsTrigger>
                        <TabsTrigger
                            value="export"
                            className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-4 py-2 gap-2 transition-all"
                        >
                            <Download className="w-4 h-4" />
                            File downloads
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent
                    value="browse"
                    className="flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden"
                >
                    <div className="flex-1 relative">
                        <div className="absolute inset-0 overflow-y-auto pr-2 pb-10">
                            <InteractiveDataView slug={slug || ''} />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent
                    value="export"
                    className="flex-1 overflow-y-auto data-[state=inactive]:hidden"
                >
                    <div className="grid gap-6 md:grid-cols-12 max-w-6xl">
                        <div className="col-span-12 md:col-span-8">
                            <ExportCenter slug={slug || ''} />
                        </div>

                        <div className="col-span-12 md:col-span-4 space-y-6">
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 shadow-sm">
                                <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                                    <Database className="w-4 h-4" /> Format guide
                                </h3>
                                <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-indigo-700">
                                            Universal CSV
                                        </div>
                                        <p>
                                            Raw rectangular data. Best for R, Python, SPSS, or Excel
                                            analysis. Includes all metadata.
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-semibold text-indigo-700">
                                            KenQ JSON
                                        </div>
                                        <p>
                                            Optimized for the Web-KenQ analysis tool. Contains study
                                            definition and sorts.
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-semibold text-indigo-700">
                                            PQMethod Bundle (ZIP)
                                        </div>
                                        <p>
                                            Contains legacy .DAT and .STA files for DOS PQMethod
                                            software.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default DataExportsPage;
