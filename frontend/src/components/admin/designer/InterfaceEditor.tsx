import { useStudyDesigner } from '@/store/useStudyDesigner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { RefreshCcw, MousePointerClick, ArrowRight, Check } from 'lucide-react';

const InterfaceEditor = () => {
    const { draft, activeLocale, updateTranslation } = useStudyDesigner();

    if (!draft) return null;

    const translation = draft.translations?.find((t) => t.language_code === activeLocale);
    const uiLabels = translation?.ui_labels || {};

    const updateLabel = (key: string, value: string) => {
        updateTranslation(activeLocale, (t: any) => {
            if (!t.ui_labels) t.ui_labels = {};
            if (!value) {
                delete t.ui_labels[key];
            } else {
                t.ui_labels[key] = value;
            }
        });
    };

    const getLabel = (key: string) => uiLabels[key] || '';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-primary font-semibold text-lg">
                <MousePointerClick className="h-5 w-5" />
                Interface Customization
            </div>

            <p className="text-sm text-muted-foreground">
                Customize the buttons and labels of the interface to match your study's tone (e.g.,
                changing "Agree/Disagree" to "Like/Dislike").
            </p>

            {/* Navigation & Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" /> Navigation Buttons
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Button</Label>
                            <Input
                                placeholder="Default: Get Started"
                                value={getLabel('welcome.start')}
                                onChange={(e) => updateLabel('welcome.start', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Next Step Button</Label>
                            <Input
                                placeholder="Default: Next step"
                                value={getLabel('common.next')}
                                onChange={(e) => updateLabel('common.next', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Submit Button</Label>
                            <Input
                                placeholder="Default: Share my perspective"
                                value={getLabel('common.submit')}
                                onChange={(e) => updateLabel('common.submit', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Continue Button</Label>
                            <Input
                                placeholder="Default: Continue"
                                value={getLabel('common.continue')}
                                onChange={(e) => updateLabel('common.continue', e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sorting Terminology */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4" /> Sorting Terminology
                    </CardTitle>
                    <CardDescription>
                        Define the poles of your sorting scale (Reference for Rough Sort & Grid).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Positive Pole */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-emerald-600 flex items-center gap-2">
                            <Check className="h-4 w-4" /> Positive Pole (Right)
                        </h4>
                        <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-emerald-100">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                    Rough Sort Label
                                </Label>
                                <Input
                                    placeholder="Default: Somewhat agree"
                                    value={getLabel('common.agree')}
                                    onChange={(e) => updateLabel('common.agree', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                    Fine Sort Legend
                                </Label>
                                <Input
                                    placeholder="Default: Most Agree"
                                    value={getLabel('fine.legend.agree')}
                                    onChange={(e) =>
                                        updateLabel('fine.legend.agree', e.target.value)
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Negative Pole */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-red-600 flex items-center gap-2">
                            <Check className="h-4 w-4" /> Negative Pole (Left)
                        </h4>
                        <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-red-100">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                    Rough Sort Label
                                </Label>
                                <Input
                                    placeholder="Default: Somewhat disagree"
                                    value={getLabel('common.disagree')}
                                    onChange={(e) => updateLabel('common.disagree', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                    Fine Sort Legend
                                </Label>
                                <Input
                                    placeholder="Default: Most Disagree"
                                    value={getLabel('fine.legend.disagree')}
                                    onChange={(e) =>
                                        updateLabel('fine.legend.disagree', e.target.value)
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Neutral */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-slate-600">Neutral / Middle</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                    Rough Sort Label
                                </Label>
                                <Input
                                    placeholder="Default: Neutral"
                                    value={getLabel('common.neutral')}
                                    onChange={(e) => updateLabel('common.neutral', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                    Fine Sort Legend
                                </Label>
                                <Input
                                    placeholder="Default: Neutral"
                                    value={getLabel('fine.legend.neutral')}
                                    onChange={(e) =>
                                        updateLabel('fine.legend.neutral', e.target.value)
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default InterfaceEditor;
