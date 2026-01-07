import { useStudyDesigner } from '@/store/useStudyDesigner';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Palette, Image as ImageIcon, Info, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const BrandingEditor = () => {
    const { t } = useTranslation();
    const { draft, updateDraft } = useStudyDesigner();

    if (!draft) return null;

    // biome-ignore lint/suspicious/noExplicitAny: branding missing in generated type
    const branding = (draft as any).branding || { logo_url: null, accent_color: null };

    const updateBranding = (field: 'logo_url' | 'accent_color', value: string | null) => {
        updateDraft((d) => {
            // biome-ignore lint/suspicious/noExplicitAny: branding missing in generated type
            if (!(d as any).branding) (d as any).branding = { logo_url: null, accent_color: null };
            // biome-ignore lint/suspicious/noExplicitAny: branding missing in generated type
            (d as any).branding[field] = value;
        });
    };

    return (
        <>
            <section className="space-y-6">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xl tracking-tight">
                    <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 shadow-sm">
                        <Palette className="h-5 w-5 text-indigo-600" />
                    </div>
                    {t('admin.design.theme.title')}
                </div>

                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="px-0 pt-0">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-bold">
                                {t('admin.design.theme.accent.title')}
                            </CardTitle>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3.5 w-3.5 text-slate-400 hover:text-indigo-500 transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                        <p className="text-xs">
                                            {t('admin.design.theme.accent.desc')}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </CardHeader>
                    <CardContent className="px-0 space-y-4">
                        <div className="flex items-center gap-4">
                            <div
                                className="w-14 h-14 rounded-2xl border-2 border-white shadow-xl shrink-0 ring-4 ring-slate-100"
                                style={{ backgroundColor: branding.accent_color || '#4f46e5' }}
                            />
                            <div className="flex-1 space-y-2">
                                <Label
                                    htmlFor="accent-color"
                                    className="text-[10px] font-black uppercase tracking-wider text-slate-500"
                                >
                                    {t('admin.design.theme.accent.pick')}
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="accent-color"
                                        type="color"
                                        value={branding.accent_color || '#4f46e5'}
                                        onChange={(e) =>
                                            updateBranding('accent_color', e.target.value)
                                        }
                                        className="w-10 h-10 p-1 cursor-pointer rounded-lg border-2"
                                    />
                                    <Input
                                        type="text"
                                        value={branding.accent_color || '#4f46e5'}
                                        onChange={(e) =>
                                            updateBranding('accent_color', e.target.value)
                                        }
                                        placeholder="#000000"
                                        className="max-w-[120px] font-bold text-sm h-10 rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => updateBranding('accent_color', null)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors shadow-sm border bg-white"
                                    >
                                        <RotateCcw className="size-3" />
                                        {t('admin.design.theme.accent.reset')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-6 gap-2 pt-2">
                            {['#4f46e5', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a'].map(
                                (color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={cn(
                                            'aspect-square rounded-xl border-2 transition-all flex items-center justify-center shadow-sm',
                                            branding.accent_color === color
                                                ? 'border-indigo-600 scale-110 shadow-indigo-200'
                                                : 'border-transparent hover:border-slate-300'
                                        )}
                                        style={{ backgroundColor: color }}
                                        onClick={() => updateBranding('accent_color', color)}
                                    >
                                        {branding.accent_color === color && (
                                            <div className="w-2 h-2 bg-white rounded-full shadow-inner" />
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="px-0">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <ImageIcon className="h-4 w-4 text-indigo-500" />
                                {t('admin.design.theme.logo.title')}
                            </CardTitle>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3.5 w-3.5 text-slate-400" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p className="text-xs">
                                            {t('admin.design.theme.logo.desc')}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </CardHeader>
                    <CardContent className="px-0 space-y-4">
                        <div className="grid gap-3">
                            <Label
                                htmlFor="logo-url"
                                className="text-[10px] font-black uppercase tracking-wider text-slate-500"
                            >
                                {t('admin.design.theme.logo.label')}
                            </Label>
                            <Input
                                id="logo-url"
                                value={branding.logo_url || ''}
                                onChange={(e) => updateBranding('logo_url', e.target.value)}
                                placeholder="https://example.com/logo.png"
                                className="font-medium text-sm rounded-xl h-10"
                            />
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter">
                                {t('admin.design.theme.logo.hint')}
                            </p>
                        </div>

                        {branding.logo_url && (
                            <div className="p-6 bg-white/50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center transition-all hover:bg-white hover:border-indigo-300 group">
                                <img
                                    src={branding.logo_url}
                                    alt={t('admin.design.theme.logo.preview')}
                                    className="max-h-16 object-contain drop-shadow-sm group-hover:scale-110 transition-transform duration-300"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
                <div className="flex gap-2">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-medium mb-1">{t('admin.design.theme.tip.title')}</p>
                        <p className="text-amber-800">{t('admin.design.theme.tip.desc')}</p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default BrandingEditor;
