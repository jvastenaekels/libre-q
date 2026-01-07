import type React from 'react';
import { Lightbulb, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuidanceCardProps {
    title: string;
    description: string;
    type?: 'info' | 'tip' | 'warning';
    className?: string;
}

export const GuidanceCard: React.FC<GuidanceCardProps> = ({
    title,
    description,
    type = 'tip',
    className,
}) => {
    const icons = {
        info: <Info className="h-5 w-5 text-blue-500" />,
        tip: <Lightbulb className="h-5 w-5 text-amber-500" />,
        warning: <AlertTriangle className="h-5 w-5 text-orange-500" />,
    };

    const styles = {
        info: 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/10',
        tip: 'bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/10',
        warning:
            'bg-orange-50/50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/10',
    };

    return (
        <div
            className={cn(
                'flex gap-4 p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-500',
                styles[type],
                className
            )}
        >
            <div className="shrink-0 mt-0.5">{icons[type]}</div>
            <div className="space-y-1">
                <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
        </div>
    );
};
