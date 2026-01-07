import { useStudyDesigner } from '@/store/useStudyDesigner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { RefreshCcw, MousePointerClick, ArrowRight, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const InterfaceEditor = () => {
    const { draft, activeLocale, updateTranslation, setActiveSubStep } = useStudyDesigner();
    const { t } = useTranslation();

    if (!draft) return null;

    const translation = draft.translations?.find((t) => t.language_code === activeLocale);
    const uiLabels = translation?.ui_labels || {};

    const updateLabel = (key: string, value: string) => {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic labels
        updateTranslation(activeLocale, (t: any) => {
            if (!t.ui_labels) t.ui_labels = {};
            if (!value) {
                delete t.ui_labels[key];
            } else {
                t.ui_labels[key] = value;
            }
        });
    };

    const getLabel = (key: string) => (uiLabels[key] || t(key)) as string;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3 text-slate-900 font-bold text-xl tracking-tight">
                <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 shadow-sm">
                    <MousePointerClick className="h-5 w-5 text-indigo-600" />
                </div>
                {t('admin.design.interface.title')}
            </div>

            {/* Navigation & Actions */}
            <Card className="border border-white/20 shadow-xl bg-white/40 backdrop-blur-xl rounded-2xl overflow-hidden">
                <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-indigo-500" />{' '}
                        {t('admin.design.interface.nav.title')}
                    </CardTitle>
                    <CardDescription className="text-xs font-medium text-slate-400">
                        {t('admin.design.interface.desc')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    {t('admin.design.interface.nav.start')}
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="size-3 text-slate-400" />
                                        </TooltipTrigger>
                                        <TooltipContent className="text-[10px]">
                                            {t('admin.design.interface.nav.tooltips.start')}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Input
                                value={getLabel('welcome.start')}
                                onChange={(e) => updateLabel('welcome.start', e.target.value)}
                                onFocus={() => setActiveSubStep('welcome.start')}
                                placeholder={t('welcome.start')}
                                className="font-bold text-sm h-10 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    {t('admin.design.interface.nav.next')}
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="size-3 text-slate-400" />
                                        </TooltipTrigger>
                                        <TooltipContent className="text-[10px]">
                                            {t('admin.design.interface.nav.tooltips.next')}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Input
                                value={getLabel('common.next')}
                                onChange={(e) => updateLabel('common.next', e.target.value)}
                                onFocus={() => setActiveSubStep('common.next')}
                                placeholder={t('common.next')}
                                className="font-bold text-sm h-10 rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    {t('admin.design.interface.nav.submit')}
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="size-3 text-slate-400" />
                                        </TooltipTrigger>
                                        <TooltipContent className="text-[10px]">
                                            {t('admin.design.interface.nav.tooltips.submit')}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Input
                                value={getLabel('post.submit')}
                                onChange={(e) => updateLabel('post.submit', e.target.value)}
                                onFocus={() => setActiveSubStep('post.submit')}
                                placeholder={t('post.submit')}
                                className="font-bold text-sm h-10 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    {t('admin.design.interface.nav.confirm')}
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="size-3 text-slate-400" />
                                        </TooltipTrigger>
                                        <TooltipContent className="text-[10px]">
                                            {t('admin.design.interface.nav.tooltips.confirm')}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Input
                                value={getLabel('fine.actions.validate')}
                                onChange={(e) =>
                                    updateLabel('fine.actions.validate', e.target.value)
                                }
                                onFocus={() => setActiveSubStep('fine.actions.validate')}
                                placeholder={t('fine.actions.validate')}
                                className="font-bold text-sm h-10 rounded-xl"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sorting Terminology */}
            <Card className="border border-white/20 shadow-xl bg-white/40 backdrop-blur-xl rounded-2xl overflow-hidden">
                <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4 text-indigo-500" />{' '}
                        {t('admin.design.interface.terms.title')}
                    </CardTitle>
                    <CardDescription className="text-xs font-medium text-slate-400">
                        {t('admin.design.interface.terms.desc')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 py-1 px-3 bg-slate-100 rounded-lg w-fit">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                {t('admin.design.interface.terms.rough')}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-500">
                                    {t('admin.design.interface.terms.agree')}
                                </Label>
                                <Input
                                    value={getLabel('common.agree')}
                                    onChange={(e) => updateLabel('common.agree', e.target.value)}
                                    onFocus={() => setActiveSubStep('common.agree')}
                                    placeholder={t('common.agree')}
                                    className="font-bold text-sm h-10 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-500">
                                    {t('admin.design.interface.terms.neutral')}
                                </Label>
                                <Input
                                    value={getLabel('common.neutral')}
                                    onChange={(e) => updateLabel('common.neutral', e.target.value)}
                                    onFocus={() => setActiveSubStep('common.neutral')}
                                    placeholder={t('common.neutral')}
                                    className="font-bold text-sm h-10 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-500">
                                    {t('admin.design.interface.terms.disagree')}
                                </Label>
                                <Input
                                    value={getLabel('common.disagree')}
                                    onChange={(e) => updateLabel('common.disagree', e.target.value)}
                                    onFocus={() => setActiveSubStep('common.disagree')}
                                    placeholder={t('common.disagree')}
                                    className="font-bold text-sm h-10 rounded-xl"
                                />
                            </div>
                        </div>

                        <Separator className="bg-slate-200/50" />

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 py-1 px-3 bg-slate-100 rounded-lg w-fit">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    {t('admin.design.interface.terms.grid')}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500">
                                        {t('admin.design.interface.terms.most_agree')}
                                    </Label>
                                    <Input
                                        value={getLabel('fine.legend.agree')}
                                        onChange={(e) =>
                                            updateLabel('fine.legend.agree', e.target.value)
                                        }
                                        onFocus={() => setActiveSubStep('fine.legend.agree')}
                                        placeholder={t('fine.legend.agree')}
                                        className="font-bold text-sm h-10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500">
                                        {t('admin.design.interface.terms.neutral')}
                                    </Label>
                                    <Input
                                        value={getLabel('fine.legend.neutral')}
                                        onChange={(e) =>
                                            updateLabel('fine.legend.neutral', e.target.value)
                                        }
                                        onFocus={() => setActiveSubStep('fine.legend.neutral')}
                                        placeholder={t('fine.legend.neutral')}
                                        className="font-bold text-sm h-10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500">
                                        {t('admin.design.interface.terms.most_disagree')}
                                    </Label>
                                    <Input
                                        value={getLabel('fine.legend.disagree')}
                                        onChange={(e) =>
                                            updateLabel('fine.legend.disagree', e.target.value)
                                        }
                                        onFocus={() => setActiveSubStep('fine.legend.disagree')}
                                        placeholder={t('fine.legend.disagree')}
                                        className="font-bold text-sm h-10 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default InterfaceEditor;
