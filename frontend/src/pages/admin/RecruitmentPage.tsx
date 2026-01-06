import { useState } from 'react';
import { useParams, useLoaderData, useRevalidator } from 'react-router-dom';
import { QrCode, Plus, Trash2, Copy, CheckCircle2, Users, Globe, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import {
    useCreateRecruitmentLinksApiAdminRecruitmentSlugLinksPost,
    useRevokeRecruitmentLinkApiAdminRecruitmentLinksLinkIdDelete,
} from '@/api/generated';
import type { RecruitmentLinkRead, RecruitmentLinkType } from '@/api/model';

const RecruitmentPage = () => {
    const { slug } = useParams<{ slug: string }>();
    const { links: initialLinks } = useLoaderData() as {
        links: RecruitmentLinkRead[];
        slug: string;
    };
    const revalidator = useRevalidator();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newLinkType, setNewLinkType] = useState<RecruitmentLinkType>('public');
    const [newLinkCount, setNewLinkCount] = useState(1);
    const [newLinkName, setNewLinkName] = useState('');

    const links = initialLinks; // In RR7, useLoaderData remains the source of truth

    const createMutation = useCreateRecruitmentLinksApiAdminRecruitmentSlugLinksPost({
        mutation: {
            onSuccess: () => {
                toast.success('Recruitment links created successfully');
                setIsCreateModalOpen(false);
                revalidator.revalidate(); // Refresh RR7 loader data
                setNewLinkName('');
                setNewLinkCount(1);
            },
            onError: () => {
                toast.error('Failed to create links');
            },
        },
    });

    const revokeMutation = useRevokeRecruitmentLinkApiAdminRecruitmentLinksLinkIdDelete({
        mutation: {
            onSuccess: () => {
                toast.success('Link revoked');
                revalidator.revalidate(); // Refresh RR7 loader data
            },
        },
    });

    const handleCreate = () => {
        createMutation.mutate({
            // biome-ignore lint/style/noNonNullAssertion: guaranteed by loader
            slug: slug!,
            params: { count: newLinkCount },
            data: {
                type: newLinkType,
                name: newLinkName || undefined,
                capacity: newLinkType === 'individual' ? 1 : undefined,
            },
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    const getFullUrl = (token: str) => {
        return `${window.location.origin}/study/${slug}?token=${token}`;
    };

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
                        Manage participant access and recruitment channels.
                    </p>
                </div>

                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
                            <Plus className="h-4 w-4 mr-2" />
                            New Access Link
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Access Links</DialogTitle>
                            <DialogDescription>
                                Generate links for your participants. Individual links are valid for
                                one submission only.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="type">Link Type</Label>
                                <Select
                                    value={newLinkType}
                                    onValueChange={(v) => setNewLinkType(v as RecruitmentLinkType)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="public">
                                            Public (Multiple usage)
                                        </SelectItem>
                                        <SelectItem value="individual">
                                            Individual (Single usage)
                                        </SelectItem>
                                        <SelectItem value="limited">
                                            Limited (Set capacity)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Campaign Name (Optional)</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Social Media, Batch A"
                                    value={newLinkName}
                                    onChange={(e) => setNewLinkName(e.target.value)}
                                />
                            </div>
                            {newLinkType !== 'public' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="count">Number of links to generate</Label>
                                    <Input
                                        id="count"
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={newLinkCount}
                                        onChange={(e) =>
                                            setNewLinkCount(parseInt(e.target.value, 10))
                                        }
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreate}
                                disabled={createMutation.isPending}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {createMutation.isPending ? 'Generating...' : 'Generate Links'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <div className="grid gap-6 md:grid-cols-4">
                <Card className="md:col-span-1 shadow-sm border-slate-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                            Total Links
                            <Users className="h-3.5 w-3.5 ml-2 inline-block text-slate-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">
                            {links?.length || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card className="md:col-span-1 shadow-sm border-slate-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                            Started
                            <Globe className="h-3.5 w-3.5 ml-2 inline-block text-amber-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">
                            {links?.reduce((acc, l) => acc + (l.start_count || 0), 0) || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card className="md:col-span-1 shadow-sm border-slate-200 border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                            Submitted
                            <CheckCircle2 className="h-3.5 w-3.5 ml-2 inline-block text-green-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {links?.reduce((acc, l) => acc + (l.usage_count || 0), 0) || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card className="md:col-span-1 shadow-sm border-slate-200 bg-slate-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                            Success Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-600">
                            {(() => {
                                const started =
                                    links?.reduce((acc, l) => acc + (l.start_count || 0), 0) || 0;
                                const submitted =
                                    links?.reduce((acc, l) => acc + (l.usage_count || 0), 0) || 0;
                                return started > 0
                                    ? `${Math.round((submitted / started) * 100)}%`
                                    : '0%';
                            })()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <CardTitle>Recruitment Links</CardTitle>
                    <CardDescription>
                        Generate unique links to track participant cohorts and control access.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="w-[200px]">Name / Lot</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Token</TableHead>
                                <TableHead>Usage</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {links?.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="text-center py-10 text-slate-400"
                                    >
                                        No recruitment links generated yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                links?.map((link) => (
                                    <TableRow key={link.id}>
                                        <TableCell className="font-medium">
                                            {link.name || (
                                                <span className="text-slate-300 italic">
                                                    Unnamed
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {link.type === 'public' ? (
                                                    <Globe className="h-3.5 w-3.5 text-blue-500" />
                                                ) : link.type === 'individual' ? (
                                                    <Users className="h-3.5 w-3.5 text-indigo-500" />
                                                ) : (
                                                    <Lock className="h-3.5 w-3.5 text-orange-500" />
                                                )}
                                                <span className="capitalize text-xs">
                                                    {link.type}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-600">
                                                {link.token}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold">
                                                    {link.usage_count}
                                                    {link.capacity ? ` / ${link.capacity}` : ''}
                                                </span>
                                                <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500"
                                                        style={{
                                                            width: `${link.capacity ? (link.usage_count / link.capacity) * 100 : 100}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {link.is_active ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-2 shadow-none text-[10px]">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[10px]">
                                                    Revoked
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                                                        >
                                                            <QrCode className="h-4 w-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-md flex flex-col items-center">
                                                        <DialogHeader className="w-full text-center">
                                                            <DialogTitle>
                                                                Scan Access Code
                                                            </DialogTitle>
                                                            <DialogDescription>
                                                                Participants can scan this code to
                                                                access the study directly.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="p-6 bg-white rounded-xl shadow-inner border border-slate-100 my-4">
                                                            <QRCodeSVG
                                                                value={getFullUrl(link.token)}
                                                                size={200}
                                                            />
                                                        </div>
                                                        <div className="flex flex-col items-center gap-2 w-full">
                                                            <p className="text-xs text-slate-400 font-mono break-all text-center px-4">
                                                                {getFullUrl(link.token)}
                                                            </p>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    copyToClipboard(
                                                                        getFullUrl(link.token)
                                                                    )
                                                                }
                                                                className="mt-2"
                                                            >
                                                                <Copy className="h-3 w-3 mr-2" />
                                                                Copy Link
                                                            </Button>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                                                    onClick={() =>
                                                        revokeMutation.mutate({ linkId: link.id })
                                                    }
                                                    disabled={revokeMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default RecruitmentPage;
