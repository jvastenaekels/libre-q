import {
    User,
    Zap,
    Scale,
    MessageSquareText,
    ClipboardList,
    CheckCircle,
    Flag,
    Info,
    HelpCircle,
    FileText,
    LayoutGrid,
    Rocket,
    Target,
    Brain,
    Lightbulb,
    ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
    User,
    Zap,
    Scale,
    MessageSquareText,
    ClipboardList,
    CheckCircle,
    Flag,
    Info,
    HelpCircle,
    FileText,
    LayoutGrid,
    Rocket,
    Target,
    Brain,
    Lightbulb,
    ListChecks,
};

type IconName = keyof typeof ICONS;

interface IconPickerProps {
    selectedIcon: string;
    onChange: (icon: IconName) => void;
    disabled?: boolean;
}

export function IconPicker({ selectedIcon, onChange, disabled }: IconPickerProps) {
    return (
        <div className={cn('grid grid-cols-4 gap-2', disabled && 'opacity-50 pointer-events-none')}>
            {Object.entries(ICONS).map(([name, Icon]) => (
                <button
                    key={name}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(name as IconName)}
                    className={cn(
                        'flex aspect-square items-center justify-center rounded-lg border p-2 transition-all hover:bg-accent hover:text-accent-foreground',
                        selectedIcon === name
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted bg-background text-muted-foreground'
                    )}
                    title={name}
                >
                    <Icon size={20} strokeWidth={selectedIcon === name ? 2.5 : 2} />
                </button>
            ))}
        </div>
    );
}
