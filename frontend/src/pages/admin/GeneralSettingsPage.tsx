import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudyPageHeader } from '@/components/admin/layout/StudyPageHeader';
import { useTranslation } from 'react-i18next';
import { useLoaderData, useNavigate } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { StudyRead, StudyUpdate } from '@/api/model';
import * as z from 'zod';
import { AdminService } from '@/api/admin';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
// Removing useAdminStudy as we use loader now

const studyFormSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    slug: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    start_date: z.date().optional().nullable(),
    end_date: z.date().optional().nullable(),
});

type StudyFormValues = z.infer<typeof studyFormSchema>;

export default function GeneralSettingsPage() {
    const navigate = useNavigate();
    const { study: initialStudy, slug: initialSlug } = useLoaderData() as {
        study: StudyRead;
        slug: string;
    };
    const { user } = useAuthStore();
    const { t } = useTranslation();

    const study = initialStudy;
    const slug = initialSlug;

    const form = useForm<StudyFormValues>({
        resolver: zodResolver(studyFormSchema),
        defaultValues: {
            // biome-ignore lint/suspicious/noExplicitAny: API type definition stale
            title: (study as any)?.title || '',
            slug: study?.slug || '',
            // biome-ignore lint/suspicious/noExplicitAny: API type definition stale
            start_date: (study as any).start_date ? new Date((study as any).start_date) : null,
            // biome-ignore lint/suspicious/noExplicitAny: API type definition stale
            end_date: (study as any).end_date ? new Date((study as any).end_date) : null,
        },
    });

    // Initial reset is handled by defaultValues from loader data
    // but we keep keep it for when study updates via mutation if needed (though RR7 usually handles it)
    useEffect(() => {
        if (study) {
            form.reset({
                // biome-ignore lint/suspicious/noExplicitAny: API type definition stale
                title: (study as any).title || '',
                slug: study.slug || '',
                // biome-ignore lint/suspicious/noExplicitAny: API type definition stale
                start_date: (study as any).start_date ? new Date((study as any).start_date) : null,
                // biome-ignore lint/suspicious/noExplicitAny: API type definition stale
                end_date: (study as any).end_date ? new Date((study as any).end_date) : null,
            });
        }
    }, [study, form]);

    async function onSubmit(data: StudyFormValues) {
        if (!slug) return;
        try {
            await AdminService.updateStudy(slug, {
                title: data.title,
                slug: data.slug,
                start_date: data.start_date?.toISOString(),
                end_date: data.end_date?.toISOString(),
            } as unknown as StudyUpdate);

            toast.success('Settings updated', { description: 'Study settings have been saved.' });

            if (data.slug !== slug) {
                // Redirect if slug changed
                navigate(`/admin/studies/${data.slug}/settings`);
            } else {
                // RR7 automatically revalidates loaders on submission if using Form,
                // but since we use AdminService directly, we might need manual revalidation
                navigate('.', { replace: true });
            }
        } catch (_error) {
            toast.error('Error', {
                description: 'Failed to update settings. Slug might be taken.',
            });
        }
    }

    const handleArchive = async () => {
        if (!study || !slug) return;
        try {
            await AdminService.updateStudyState(slug, 'archived');
            toast.success('Study Archived', {
                description: 'The study is now archived and read-only.',
            });
            navigate('.', { replace: true });
        } catch (_error) {
            toast.error('Error', {
                description: 'Failed to archive study. Is it closed?',
            });
        }
    };

    const handleDelete = async () => {
        if (!study || !slug) return;
        if (!confirm('Are you sure? This action is IRREVERSIBLE.')) return;
        try {
            await AdminService.deleteStudy(slug);
            toast.success('Study Deleted', {
                description: 'The study has been permanently removed.',
            });
            navigate('/admin');
        } catch (_error) {
            toast.error('Error', {
                description: 'Failed to delete study.',
            });
        }
    };

    const isClosed = study.state === 'closed';
    const isArchived = study.state === 'archived';

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 pt-2">
            <StudyPageHeader
                title={t('admin.settings.title', 'General Settings')}
                description={t(
                    'admin.settings.description',
                    'Manage basic study configuration, URL slug, and lifecycle states.'
                )}
                icon={Settings}
            />

            <div className="space-y-6 max-w-4xl">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Basic Information</CardTitle>
                                <CardDescription>
                                    Configure the study identity and availability window.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Slug */}
                                <FormField
                                    control={form.control}
                                    name="slug"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>URL Slug</FormLabel>
                                            <FormControl>
                                                <Input {...field} disabled={isArchived} />
                                            </FormControl>
                                            <FormDescription>
                                                The unique identifier used in the URL.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Dates */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="start_date"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Start Date (Optional)</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant={'outline'}
                                                                className={cn(
                                                                    'w-full pl-3 text-left font-normal',
                                                                    !field.value &&
                                                                        'text-muted-foreground'
                                                                )}
                                                                disabled={isArchived}
                                                            >
                                                                {field.value ? (
                                                                    format(field.value, 'PPP')
                                                                ) : (
                                                                    <span>Pick a date</span>
                                                                )}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        className="w-auto p-0"
                                                        align="start"
                                                    >
                                                        <Calendar
                                                            mode="single"
                                                            selected={field.value || undefined}
                                                            onSelect={field.onChange}
                                                            disabled={(date) =>
                                                                date < new Date('1900-01-01')
                                                            }
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormDescription>
                                                    Automatically opens the study on this date.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="end_date"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>End Date (Optional)</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant={'outline'}
                                                                className={cn(
                                                                    'w-full pl-3 text-left font-normal',
                                                                    !field.value &&
                                                                        'text-muted-foreground'
                                                                )}
                                                                disabled={isArchived}
                                                            >
                                                                {field.value ? (
                                                                    format(field.value, 'PPP')
                                                                ) : (
                                                                    <span>Pick a date</span>
                                                                )}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        className="w-auto p-0"
                                                        align="start"
                                                    >
                                                        <Calendar
                                                            mode="single"
                                                            selected={field.value || undefined}
                                                            onSelect={field.onChange}
                                                            disabled={(date) =>
                                                                date < new Date('1900-01-01')
                                                            }
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormDescription>
                                                    Automatically closes the study on this date.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between border-t px-6 py-4">
                                <div className="text-sm text-slate-500">
                                    Current State:{' '}
                                    <Badge variant={isArchived ? 'secondary' : 'default'}>
                                        {study.state}
                                    </Badge>
                                </div>
                                <Button type="submit" disabled={isArchived}>
                                    Save Changes
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </Form>

                {/* Archiving Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Archiving</CardTitle>
                        <CardDescription>
                            Archive the study to make it read-only for everyone.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-amber-50 p-4 rounded-md border border-amber-200 text-sm text-amber-800">
                            <p>
                                To archive a study, it must first be <strong>Closed</strong>. Once
                                archived, no further changes can be made.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        {isArchived ? (
                            <Button disabled variant="outline" className="w-full sm:w-auto">
                                Study is Archived
                            </Button>
                        ) : (
                            <Button
                                variant="secondary"
                                disabled={!isClosed}
                                onClick={handleArchive}
                                className="w-full sm:w-auto"
                            >
                                Archive Study
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                {/* Danger Zone (Superuser Only) */}
                {user?.is_superuser && (
                    <Card className="border-red-200">
                        <CardHeader>
                            <CardTitle className="text-red-600">Danger Zone</CardTitle>
                            <CardDescription>Actions here are irreversible.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-red-50 p-4 rounded-md border border-red-200 text-sm text-red-800 mb-4">
                                Deleting a study removes ALL data (participants, answers, config)
                                permanently. Study must be <strong>Archived</strong> before
                                deletion.
                            </div>
                            <Button
                                variant="destructive"
                                disabled={!isArchived}
                                onClick={handleDelete}
                                className="w-full sm:w-auto flex items-center gap-2"
                            >
                                <Trash2 size={16} />
                                Delete Study
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
