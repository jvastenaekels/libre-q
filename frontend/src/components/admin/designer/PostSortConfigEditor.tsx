import { useStudyDesigner } from '@/store/useStudyDesigner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Info, Plus, X } from 'lucide-react';
import { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import QuestionBuilder from './QuestionBuilder';

const PostSortConfigEditor = () => {
    const { draft, activeLocale, updateDraft } = useStudyDesigner();
    const [selectedScore, setSelectedScore] = useState<number | null>(null);

    if (!draft) return null;

    // biome-ignore lint/suspicious/noExplicitAny: complex config object
    const config = draft.postsort_config as any;

    const extremeColumns = config?.extreme_columns || [];
    const askMissing = config?.ask_missing ?? false;
    const askGeneralComment = config?.ask_general_comment ?? true;
    const allowRandomComments = config?.allow_random_comments ?? true;
    const prompts = config?.prompts || {};

    const gridConfig = draft.grid_config as Array<{ score: number; capacity: number }> | undefined;
    const availableScores = gridConfig?.map((col) => col.score) || [];

    const getPromptText = (key: 'extreme' | 'missing' | 'general'): string => {
        const prompt = prompts[key];
        if (!prompt) return '';
        if (typeof prompt === 'string') return prompt;
        return prompt[activeLocale] || prompt.en || '';
    };

    const setPromptText = (key: 'extreme' | 'missing' | 'general', value: string) => {
        updateDraft((d) => {
            if (!d.postsort_config) d.postsort_config = {};
            // biome-ignore lint/suspicious/noExplicitAny: cast to any
            const ps = d.postsort_config as any;
            if (!ps.prompts) ps.prompts = {};
            const current = ps.prompts[key];

            if (!current) {
                ps.prompts[key] = { [activeLocale]: value };
            } else if (typeof current === 'string') {
                ps.prompts[key] = { en: current, [activeLocale]: value };
            } else {
                ps.prompts[key] = { ...current, [activeLocale]: value };
            }
        });
    };

    const addExtremeColumn = (score: number) => {
        updateDraft((d) => {
            if (!d.postsort_config) d.postsort_config = {};
            // biome-ignore lint/suspicious/noExplicitAny: cast to any
            const ps = d.postsort_config as any;
            const current = ps.extreme_columns || [];
            if (!current.includes(score)) {
                ps.extreme_columns = [...current, score].sort((a: number, b: number) => a - b);
            }
        });
        setSelectedScore(null);
    };

    const removeExtremeColumn = (score: number) => {
        updateDraft((d) => {
            // biome-ignore lint/suspicious/noExplicitAny: cast to any
            const ps = d.postsort_config as any;
            if (ps) {
                ps.extreme_columns = (ps.extreme_columns || []).filter((s: number) => s !== score);
            }
        });
    };

    const toggleAskMissing = (checked: boolean) => {
        updateDraft((d) => {
            if (!d.postsort_config) d.postsort_config = {};
            // biome-ignore lint/suspicious/noExplicitAny: cast to any
            const ps = d.postsort_config as any;
            ps.ask_missing = checked;
            if (checked && !ps.prompts?.missing) {
                if (!ps.prompts) ps.prompts = {};
                ps.prompts.missing = {
                    en: 'Were there any statements you wish had been included in this study?',
                    fr: 'Y avait-il des affirmations que vous auriez aimé voir incluses ?',
                };
            }
        });
    };

    const toggleAskGeneralComment = (checked: boolean) => {
        updateDraft((d) => {
            if (!d.postsort_config) d.postsort_config = {};
            // biome-ignore lint/suspicious/noExplicitAny: cast to any
            const ps = d.postsort_config as any;
            ps.ask_general_comment = checked;
            if (checked && !ps.prompts?.general) {
                if (!ps.prompts) ps.prompts = {};
                ps.prompts.general = {
                    en: 'Do you have any additional comments or feedback?',
                    fr: 'Avez-vous des commentaires ou remarques supplémentaires ?',
                };
            }
        });
    };

    const toggleAllowRandomComments = (checked: boolean) => {
        updateDraft((d) => {
            if (!d.postsort_config) d.postsort_config = {};
            // biome-ignore lint/suspicious/noExplicitAny: cast to any
            const ps = d.postsort_config as any;
            ps.allow_random_comments = checked;
        });
    };

    const unselectedScores = availableScores.filter((s) => !extremeColumns.includes(s));

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <span className="bg-primary/10 p-1 rounded">
                            <Info className="h-5 w-5 text-primary" />
                        </span>
                        Extreme columns
                    </CardTitle>
                    <CardDescription>
                        Select columns that trigger follow-up questions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {extremeColumns.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">
                                No columns selected.
                            </p>
                        ) : (
                            extremeColumns.map((score: number) => (
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

                    {extremeColumns.length > 0 && (
                        <div className="pt-4 border-t space-y-2">
                            <Label htmlFor="extreme-prompt">Prompt for extreme cards</Label>
                            <Textarea
                                id="extreme-prompt"
                                value={getPromptText('extreme')}
                                onChange={(e) => setPromptText('extreme', e.target.value)}
                                placeholder="Why did you place this statement here?"
                                className="min-h-[80px]"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base">Allow random comments</CardTitle>
                            <CardDescription className="text-sm">
                                Allow participants to add comments to any statement in the grid.
                            </CardDescription>
                        </div>
                        <Switch
                            checked={allowRandomComments}
                            onCheckedChange={toggleAllowRandomComments}
                        />
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <div className="space-y-1">
                        <CardTitle className="text-base">Custom questions</CardTitle>
                        <CardDescription className="text-sm">
                            Add custom questions to the post-sort survey.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <QuestionBuilder type="post" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base">
                                Ask about missing statements
                            </CardTitle>
                            <CardDescription className="text-sm">
                                Ask if there were missing topics.
                            </CardDescription>
                        </div>
                        <Switch checked={askMissing} onCheckedChange={toggleAskMissing} />
                    </div>
                </CardHeader>
                {askMissing && (
                    <CardContent className="space-y-2">
                        <Label htmlFor="missing-prompt">Missing statements prompt</Label>
                        <Input
                            id="missing-prompt"
                            value={getPromptText('missing')}
                            onChange={(e) => setPromptText('missing', e.target.value)}
                            placeholder="Were there any statements you wish had been included?"
                        />
                    </CardContent>
                )}
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base">Ask for general feedback</CardTitle>
                            <CardDescription className="text-sm">
                                General comments at the end.
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
                        <Label htmlFor="general-prompt">General feedback prompt</Label>
                        <Textarea
                            id="general-prompt"
                            value={getPromptText('general')}
                            onChange={(e) => setPromptText('general', e.target.value)}
                            placeholder="Do you have any additional comments or feedback?"
                            className="min-h-[80px]"
                        />
                    </CardContent>
                )}
            </Card>
        </div>
    );
};

export default PostSortConfigEditor;
