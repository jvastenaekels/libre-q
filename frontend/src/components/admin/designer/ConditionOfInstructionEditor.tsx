import type { StudyTranslationRead as StudyTranslation } from '@/api/model/studyTranslationRead';
import { useTranslation } from 'react-i18next';
import { useStudyDesigner } from '@/store/useStudyDesigner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Target, Info } from 'lucide-react';
import type React from 'react';
import MarkdownEditor from './MarkdownEditor';

const ConditionOfInstructionEditor = () => {
    const { t } = useTranslation();
    const { draft, activeLocale, updateTranslation } = useStudyDesigner();

    if (!draft) return null;

    const translation = draft.translations?.find((t) => t.language_code === activeLocale);
    const hasPreInstruction =
        translation?.pre_instruction !== null && translation?.pre_instruction !== undefined;

    const handleChange = (field: keyof StudyTranslation, value: string | null) => {
        updateTranslation(activeLocale, (t_trans: any) => {
            (t_trans as any)[field] = value;
        });
    };

    return (
        <div className="space-y-8">
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-lg">
                    <span className="bg-primary/10 p-1 rounded">
                        <Target className="h-5 w-5" />
                    </span>
                    {t('admin.design.condition.title')}
                </div>

                <Card className="shadow-sm border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-sm">
                            {t('admin.design.condition.label')}
                        </CardTitle>
                        <CardDescription>{t('admin.design.condition.desc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label
                                htmlFor="condition_of_instruction"
                                className="text-sm font-semibold"
                            >
                                {t('admin.design.condition.field_label')}
                            </Label>
                            <Input
                                id="condition_of_instruction"
                                value={translation?.condition_of_instruction || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    handleChange('condition_of_instruction', e.target.value)
                                }
                                placeholder={t('admin.design.condition.placeholder')}
                                className="font-semibold text-lg"
                            />
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary font-semibold text-lg">
                        <span className="bg-primary/10 p-1 rounded">
                            <Info className="h-5 w-5" />
                        </span>
                        {t('admin.design.condition.enable_pre')}
                    </div>
                    <Switch
                        id="enable-pre-instruction"
                        checked={hasPreInstruction}
                        onCheckedChange={(checked: boolean) => {
                            if (checked) {
                                handleChange('pre_instruction', '');
                            } else {
                                handleChange('pre_instruction', null);
                            }
                        }}
                    />
                </div>

                {hasPreInstruction && (
                    <Card className="shadow-sm">
                        <CardContent className="pt-6">
                            <div className="grid gap-2">
                                <MarkdownEditor
                                    id="pre_instruction"
                                    label={t('admin.design.condition.pre_label')}
                                    value={translation?.pre_instruction || ''}
                                    onChange={(val: string) => handleChange('pre_instruction', val)}
                                    placeholder={t('admin.design.condition.pre_desc')}
                                    className="min-h-[200px]"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </section>

            <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" /> {t('admin.design.condition.tips.title')}
                </h4>
                <p className="text-sm text-amber-700">{t('admin.design.condition.tips.desc')}</p>
            </section>
        </div>
    );
};

export default ConditionOfInstructionEditor;
