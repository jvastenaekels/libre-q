import { useStudyDesigner } from '@/store/useStudyDesigner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, Plus, X } from 'lucide-react';
import { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

/**
 * PostSortConfigEditor
 *
 * Dedicated editor for postsort_config which has a special structure:
 * {
 *   extreme_columns: number[],           // Which grid scores are "extreme" (e.g., [-4, 4])
 *   ask_missing: boolean,                // Ask about statements they wish were included
 *   ask_general_comment: boolean,        // Ask for general feedback
 *   prompts: {
 *     extreme: string | Record<lang, string>,   // Prompt for extreme cards
 *     missing: string | Record<lang, string>,   // Prompt for missing statements
 *     general: string | Record<lang, string>    // Prompt for general comment
 *   }
 * }
 */

const PostSortConfigEditor = () => {
    const { draft, activeLocale, updateDraft } = useStudyDesigner();
    const [selectedScore, setSelectedScore] = useState<number | null>(null);

    if (!draft) return null;

    // Extract postsort_config with proper typing
    const config = draft.postsort_config as
        | {
              extreme_columns?: number[];
              ask_missing?: boolean;
              ask_general_comment?: boolean;
              prompts?: {
                  extreme?: string | Record<string, string>;
                  missing?: string | Record<string, string>;
                  general?: string | Record<string, string>;
              };
          }
        | undefined;

    const extremeColumns = config?.extreme_columns || [];
    const askMissing = config?.ask_missing ?? false;
    const askGeneralComment = config?.ask_general_comment ?? true;
    const prompts = config?.prompts || {};

    // Get available scores from grid_config
    const gridConfig = draft.grid_config as Array<{ score: number; capacity: number }> | undefined;
    const availableScores = gridConfig?.map((col) => col.score) || [];

    // Helper to get prompt text for current locale
    const getPromptText = (key: 'extreme' | 'missing' | 'general'): string => {
        const prompt = prompts[key];
        if (!prompt) return '';
        if (typeof prompt === 'string') return prompt;
        return prompt[activeLocale] || prompt.en || '';
    };

    // Helper to set prompt text for current locale
    const setPromptText = (key: 'extreme' | 'missing' | 'general', value: string) => {
        updateDraft((d) => {
            if (!d.postsort_config) {
                d.postsort_config = {};
            }
            const postsortConfig = d.postsort_config as typeof config;
            if (!postsortConfig.prompts) {
                postsortConfig.prompts = {};
            }

            const currentPrompt = postsortConfig.prompts[key];

            if (!currentPrompt) {
                // Create new multilingual prompt
                postsortConfig.prompts[key] = { [activeLocale]: value };
            } else if (typeof currentPrompt === 'string') {
                // Convert string to multilingual
                postsortConfig.prompts[key] = {
                    en: currentPrompt,
                    [activeLocale]: value,
                };
            } else {
                // Update existing multilingual
                postsortConfig.prompts[key] = {
                    ...currentPrompt,
                    [activeLocale]: value,
                };
            }
        });
    };

    // Add extreme column
    const addExtremeColumn = (score: number) => {
        updateDraft((d) => {
            if (!d.postsort_config) {
                d.postsort_config = {};
            }
            const postsortConfig = d.postsort_config as typeof config;
            const current = postsortConfig.extreme_columns || [];
            if (!current.includes(score)) {
                postsortConfig.extreme_columns = [...current, score].sort((a, b) => a - b);
            }
        });
        setSelectedScore(null);
    };

    // Remove extreme column
    const removeExtremeColumn = (score: number) => {
        updateDraft((d) => {
            if (!d.postsort_config) return;
            const postsortConfig = d.postsort_config as typeof config;
            postsortConfig.extreme_columns = (postsortConfig.extreme_columns || []).filter(
                (s) => s !== score
            );
        });
    };

    // Toggle ask_missing
    const toggleAskMissing = (checked: boolean) => {
        updateDraft((d) => {
            if (!d.postsort_config) {
                d.postsort_config = {};
            }
            const postsortConfig = d.postsort_config as typeof config;
            postsortConfig.ask_missing = checked;

            // Set default prompt if enabling
            if (checked && !postsortConfig.prompts?.missing) {
                if (!postsortConfig.prompts) postsortConfig.prompts = {};
                postsortConfig.prompts.missing = {
                    en: 'Were there any statements you wish had been included in this study? If so, please describe them.',
                    fr: 'Y avait-il des affirmations que vous auriez aimé voir incluses dans cette étude ? Si oui, veuillez les décrire.',
                };
            }
        });
    };

    // Toggle ask_general_comment
    const toggleAskGeneralComment = (checked: boolean) => {
        updateDraft((d) => {
            if (!d.postsort_config) {
                d.postsort_config = {};
            }
            const postsortConfig = d.postsort_config as typeof config;
            postsortConfig.ask_general_comment = checked;

            // Set default prompt if enabling
            if (checked && !postsortConfig.prompts?.general) {
                if (!postsortConfig.prompts) postsortConfig.prompts = {};
                postsortConfig.prompts.general = {
                    en: 'Do you have any additional comments or feedback about this study?',
                    fr: 'Avez-vous des commentaires ou remarques supplémentaires sur cette étude ?',
                };
            }
        });
    };

    const unselectedScores = availableScores.filter((s) => !extremeColumns.includes(s));

    return (
        <div className="space-y-6">
            {/* Extreme Columns Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" />
                        Extreme Columns
                    </CardTitle>
                    <CardDescription>
                        Select which grid scores are considered "extreme" and will trigger follow-up
                        questions. Typically the most positive and most negative columns (e.g., -4
                        and +4).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {extremeColumns.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">
                                No extreme columns selected. Participants won't be asked to comment
                                on extreme cards.
                            </p>
                        ) : (
                            extremeColumns.map((score) => (
                                <Badge
                                    key={score}
                                    variant="secondary"
                                    className="px-3 py-1.5 text-sm font-mono flex items-center gap-2"
                                >
                                    {score > 0 ? '+' : ''}
                                    {score}
                                    <button
                                        type="button"
                                        onClick={() => removeExtremeColumn(score)}
                                        className="ml-1 hover:text-destructive transition-colors"
                                        aria-label={`Remove ${score}`}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))
                        )}
                    </div>

                    {unselectedScores.length > 0 && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                            <Label className="text-xs text-muted-foreground">Add column:</Label>
                            <Select
                                value={selectedScore?.toString() || ''}
                                onValueChange={(val) => setSelectedScore(Number(val))}
                            >
                                <SelectTrigger className="w-32 h-8">
                                    <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {unselectedScores.map((score) => (
                                        <SelectItem key={score} value={score.toString()}>
                                            {score > 0 ? '+' : ''}
                                            {score}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    selectedScore !== null && addExtremeColumn(selectedScore)
                                }
                                disabled={selectedScore === null}
                                className="h-8"
                            >
                                <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                        </div>
                    )}

                    {/* Prompt for extreme cards */}
                    {extremeColumns.length > 0 && (
                        <div className="pt-4 border-t space-y-2">
                            <Label htmlFor="extreme-prompt" className="text-sm font-medium">
                                Prompt for Extreme Cards
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                This question will be asked for each card placed in the extreme
                                columns.
                            </p>
                            <Textarea
                                id="extreme-prompt"
                                value={getPromptText('extreme')}
                                onChange={(e) => setPromptText('extreme', e.target.value)}
                                placeholder="Why did you place this statement here?"
                                rows={3}
                                className="text-sm"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Ask Missing Statements */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base">
                                Ask About Missing Statements
                            </CardTitle>
                            <CardDescription className="text-sm">
                                Ask participants if there were statements they wish had been
                                included in the study.
                            </CardDescription>
                        </div>
                        <Switch checked={askMissing} onCheckedChange={toggleAskMissing} />
                    </div>
                </CardHeader>
                {askMissing && (
                    <CardContent className="space-y-2">
                        <Label htmlFor="missing-prompt" className="text-sm font-medium">
                            Missing Statements Prompt
                        </Label>
                        <Textarea
                            id="missing-prompt"
                            value={getPromptText('missing')}
                            onChange={(e) => setPromptText('missing', e.target.value)}
                            placeholder="Were there any statements you wish had been included?"
                            rows={3}
                            className="text-sm"
                        />
                    </CardContent>
                )}
            </Card>

            {/* Ask General Comment */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base">Ask for General Feedback</CardTitle>
                            <CardDescription className="text-sm">
                                Ask participants for any additional comments or feedback about the
                                study.
                            </CardDescription>
                        </div>
                        <Switch
                            checked={askGeneralComment}
                            onCheckedChange={toggleAskGeneralComment}
                        />
                    </div>
                </CardHeader>
                {askGeneralComment && (
                    <CardContent className="space-y-2">
                        <Label htmlFor="general-prompt" className="text-sm font-medium">
                            General Feedback Prompt
                        </Label>
                        <Textarea
                            id="general-prompt"
                            value={getPromptText('general')}
                            onChange={(e) => setPromptText('general', e.target.value)}
                            placeholder="Do you have any additional comments or feedback?"
                            rows={3}
                            className="text-sm"
                        />
                    </CardContent>
                )}
            </Card>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                <div className="flex gap-2">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-medium mb-1">Q Methodology Best Practices</p>
                        <p className="text-blue-800">
                            Post-sort interviews help understand the reasoning behind participant
                            choices. Asking about extreme placements reveals the subjective meaning
                            and emotional significance of statements. This qualitative data enriches
                            the factor interpretation phase.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostSortConfigEditor;
