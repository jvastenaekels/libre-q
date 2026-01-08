import { Button } from '@/components/ui/button';
import { Users, Copy, Sparkles, UserPlus, FileText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
    type: 'participants' | 'team' | 'designer';
    studySlug?: string;
    onAction?: () => void;
}

export const EmptyState = ({ type, studySlug, onAction }: EmptyStateProps) => {
    const { t } = useTranslation();
    const studyUrl = studySlug ? `${window.location.origin}/study/${studySlug}/welcome` : '';

    const handleCopyLink = () => {
        navigator.clipboard.writeText(studyUrl);
        toast.success(t('admin.empty_states.participants.copy_success'));
    };

    if (type === 'participants') {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-sky-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <Users className="w-10 h-10 text-indigo-400" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">
                    {t('admin.empty_states.participants.title')}
                </h3>
                <p className="text-slate-500 font-medium max-w-sm mb-8">
                    {t('admin.empty_states.participants.desc')}
                </p>
                <div className="flex items-center gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                    {studySlug && (
                        <div className="p-3 bg-white rounded-xl shadow-sm border">
                            <QRCodeSVG value={studyUrl} size={100} level="M" />
                        </div>
                    )}
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleCopyLink}
                            className="gap-2 bg-indigo-600 hover:bg-indigo-700 font-bold"
                        >
                            <Copy className="h-4 w-4" />
                            {t('admin.empty_states.participants.action')}
                        </Button>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {t('admin.empty_states.participants.hint')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'team') {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <UserPlus className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">
                    {t('admin.empty_states.team.title')}
                </h3>
                <p className="text-slate-500 font-medium max-w-sm mb-8">
                    {t('admin.empty_states.team.desc')}
                </p>
                <Button onClick={onAction} className="gap-2 font-bold px-6 bg-slate-900">
                    <UserPlus className="h-4 w-4" />
                    {t('admin.empty_states.team.action')}
                </Button>
            </div>
        );
    }

    if (type === 'designer') {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <FileText className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">
                    {t('admin.empty_states.designer.title')}
                </h3>
                <p className="text-slate-500 font-medium max-w-sm mb-8">
                    {t('admin.empty_states.designer.desc')}
                </p>
                <Button
                    onClick={onAction}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 font-bold px-6"
                >
                    <Sparkles className="h-4 w-4" />
                    {t('admin.empty_states.designer.action')}
                </Button>
            </div>
        );
    }

    return null;
};
