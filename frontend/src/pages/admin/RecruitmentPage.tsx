import { useParams } from 'react-router-dom';
import { Mail, QrCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const RecruitmentPage = () => {
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
                            Recruitment
                        </Badge>
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Manage participant invitations and public access settings.
                    </p>
                </div>
            </header>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl">
                <div className="col-span-1 border rounded-xl p-8 bg-white shadow-sm flex flex-col items-center justify-center text-center gap-4 border-slate-200">
                    <div className="p-4 rounded-full bg-slate-50 text-slate-400">
                        <Mail className="h-10 w-10 text-slate-300" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">Email Campaigns</h3>
                        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                            Automate invitations and follow-ups with customizable templates.
                        </p>
                    </div>
                    <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-500 uppercase font-bold tracking-tighter text-[9px]"
                    >
                        Feature in development
                    </Badge>
                </div>

                <div className="col-span-1 border rounded-xl p-8 bg-white shadow-sm flex flex-col items-center justify-center text-center gap-4 border-slate-200">
                    <div className="p-4 rounded-full bg-slate-50 text-slate-400">
                        <QrCode className="h-10 w-10 text-slate-300" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">Smart QR Access</h3>
                        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                            Generate unique codes for offline recruitment or physical events.
                        </p>
                    </div>
                    <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-500 uppercase font-bold tracking-tighter text-[9px]"
                    >
                        Feature in development
                    </Badge>
                </div>

                <div className="col-span-1 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 border-slate-100 opacity-60">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                        More channels coming soon
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RecruitmentPage;
