import type { StudyTranslationRead as StudyTranslation } from '@/api/model/studyTranslationRead';
import { useStudyDesigner } from '@/store/useStudyDesigner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Info } from 'lucide-react';
import type React from 'react';

const IntroductionEditor = () => {
    const { draft, activeLocale, updateTranslation, updateDraft } = useStudyDesigner();

    if (!draft) return null;

    const translation = draft.translations?.find((t) => t.language_code === activeLocale);
    const hasConsent = !!translation?.consent_title;

    const handleChange = (field: keyof StudyTranslation, value: string) => {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic translation update
        updateTranslation(activeLocale, (t: any) => {
            // biome-ignore lint/suspicious/noExplicitAny: complex state update
            (t as any)[field] = value;
        });
    };

    const toggleConsent = (checked: boolean) => {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic translation update
        updateTranslation(activeLocale, (t: any) => {
            if (checked) {
                t.consent_title = t.consent_title || 'Consent to participate';
                t.consent_description =
                    t.consent_description ||
                    'By continuing, you agree to participate in this study. Your data will be anonymized.';
                t.consent_accept = t.consent_accept || 'I agree';
                t.consent_decline = t.consent_decline || 'I decline';
            } else {
                t.consent_title = null;
                t.consent_description = null;
                t.consent_accept = null;
                t.consent_decline = null;
            }
        });
    };

    return (
        <div className="space-y-8">
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-lg">
                    <Info className="h-5 w-5" />
                    Welcome Message
                </div>

                <Card className="shadow-sm">
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Study Title</Label>
                            <Input
                                id="title"
                                value={translation?.title || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    handleChange('title', e.target.value)
                                }
                                placeholder="Enter public title..."
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="subtitle">Subtitle (Optional)</Label>
                            <Input
                                id="subtitle"
                                value={translation?.subtitle || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    handleChange('subtitle', e.target.value)
                                }
                                placeholder="A brief catchphrase..."
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Short Description</Label>
                            <Textarea
                                id="description"
                                value={translation?.description || ''}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                    handleChange('description', e.target.value)
                                }
                                placeholder="What is this study about?"
                            />
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-lg">
                    <Info className="h-5 w-5" />
                    Instructions
                </div>
                <Card className="shadow-sm">
                    <CardContent className="pt-6">
                        <div className="grid gap-2">
                            <Label htmlFor="instructions">
                                Task Instructions (Markdown supported)
                            </Label>
                            <Textarea
                                id="instructions"
                                className="min-h-[200px] font-serif"
                                value={translation?.instructions || ''}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                    handleChange('instructions', e.target.value)
                                }
                                placeholder="# Instructions&#10;&#10;1. Phase 1...&#10;2. Phase 2..."
                            />
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-lg">
                    <Info className="h-5 w-5" />
                    Research Settings
                </div>

                <Card className="shadow-sm">
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center justify-between py-2">
                            <div className="space-y-1">
                                <Label htmlFor="randomize-statements" className="text-sm font-medium">
                                    Randomize Statement Order
                                </Label>
                                <p className="text-xs text-muted-foreground max-w-md">
                                    Present statements in random order for each participant to prevent order
                                    effects. This is a Q methodology best practice for scientific validity.
                                    Each participant sees a unique but reproducible order.
                                </p>
                            </div>
                            <Switch
                                id="randomize-statements"
                                checked={draft.randomize_statements ?? false}
                                onCheckedChange={(checked: boolean) => {
                                    updateDraft((d) => {
                                        d.randomize_statements = checked;
                                    });
                                }}
                            />
                        </div>

                        <div className="flex items-center justify-between py-2 border-t">
                            <div className="space-y-1">
                                <Label htmlFor="show-codes" className="text-sm font-medium">
                                    Show Statement Codes
                                </Label>
                                <p className="text-xs text-muted-foreground max-w-md">
                                    Display statement codes (e.g., "S1", "S2") alongside the text.
                                    Useful for referencing specific statements in follow-up interviews.
                                </p>
                            </div>
                            <Switch
                                id="show-codes"
                                checked={draft.show_statement_codes ?? false}
                                onCheckedChange={(checked: boolean) => {
                                    updateDraft((d) => {
                                        d.show_statement_codes = checked;
                                    });
                                }}
                            />
                        </div>

                        {draft.randomize_statements && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mt-4">
                                <div className="flex gap-2">
                                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <p>
                                        <strong>Q Methodology Best Practice:</strong> Randomization uses each
                                        participant's unique session ID as a seed, ensuring they always see
                                        the same order across page refreshes while preventing systematic
                                        position biases in factor analysis.
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>

            <section className="space-y-4 pb-12">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary font-semibold text-lg">
                        <Info className="h-5 w-5" />
                        Consent Builder
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            id="require-consent"
                            checked={hasConsent}
                            onCheckedChange={toggleConsent}
                        />
                        <Label htmlFor="require-consent" className="cursor-pointer">
                            Enable Consent Step
                        </Label>
                    </div>
                </div>

                {hasConsent && (
                    <Card className="shadow-sm border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-sm">Consent Form Details</CardTitle>
                            <CardDescription>
                                Participants must agree to these terms before starting.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="consent-title">Consent Title</Label>
                                <Input
                                    id="consent-title"
                                    value={translation?.consent_title || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        handleChange('consent_title', e.target.value)
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="consent-description">Legal Text / Agreement</Label>
                                <Textarea
                                    id="consent-description"
                                    className="min-h-[150px]"
                                    value={translation?.consent_description || ''}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                        handleChange('consent_description', e.target.value)
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    );
};

export default IntroductionEditor;
