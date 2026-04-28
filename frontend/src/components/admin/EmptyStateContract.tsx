import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface EmptyStateContractProps {
    icon: LucideIcon;
    title: string;
    body: string;
    ctaLabel: string;
    ctaTo: string;
}

export function EmptyStateContract({
    icon: Icon,
    title,
    body,
    ctaLabel,
    ctaTo,
}: EmptyStateContractProps) {
    return (
        <div className="max-w-2xl rounded-2xl border border-slate-100 bg-white px-8 py-10 shadow-sm flex flex-col items-start gap-5">
            <div className="rounded-xl bg-indigo-50 p-3">
                <Icon className="size-6 text-indigo-500" aria-hidden="true" />
            </div>
            <div className="space-y-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">{title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
            <Button asChild className="rounded-xl">
                <Link to={ctaTo}>{ctaLabel}</Link>
            </Button>
        </div>
    );
}
