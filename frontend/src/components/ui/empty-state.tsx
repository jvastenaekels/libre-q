/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Wave E (E2) — design-system primitive for empty states.
 *
 * Replaces the family of ad-hoc empty messages the audit identified
 * as following ≥4 different copy/layout patterns (REPORT.md C2).
 * Three slots: icon (optional), title (required), body (optional),
 * cta (optional). Three variants for the three contexts where empty
 * states appear in the admin UI:
 *
 * - `card`: bordered card with prominent icon + title + body + CTA.
 *   Use for whole-page or whole-section empty states (e.g.
 *   `<EmptyStateContract>` from Wave A wraps this).
 * - `inline`: centered, no border. Used inside an existing panel
 *   (e.g. inside an empty list card on Recruitment).
 * - `compact`: terse italic gray text. Used for inline contexts
 *   like "no matches" inside a populated table.
 */

interface EmptyStateProps {
    /**
     * Icon shown above the title. Optional. Skipped automatically in
     * `compact` variant.
     */
    icon?: LucideIcon;
    /** Required short headline. */
    title: string;
    /** Optional one-paragraph explanation. */
    body?: string;
    /**
     * Optional call-to-action. Supply `to` for an internal route link,
     * `onClick` for an in-page action.
     */
    cta?: {
        label: string;
        to?: string;
        onClick?: () => void;
    };
    /** Visual variant — see component docstring. */
    variant?: 'card' | 'inline' | 'compact';
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    body,
    cta,
    variant = 'card',
    className,
}: EmptyStateProps) {
    if (variant === 'compact') {
        return (
            <p className={cn('text-sm text-slate-400 italic', className)}>
                {title}
                {body && <span className="ml-1">{body}</span>}
            </p>
        );
    }

    const containerClass =
        variant === 'card'
            ? cn(
                  'max-w-2xl rounded-2xl border border-slate-100 bg-white px-8 py-10 shadow-sm flex flex-col items-start gap-5',
                  className
              )
            : cn(
                  'flex flex-col items-center justify-center gap-4 py-10 px-4 text-center',
                  className
              );

    const iconWrapperClass =
        variant === 'card' ? 'rounded-xl bg-indigo-50 p-3' : 'rounded-full bg-slate-50 p-4';

    const iconClass = variant === 'card' ? 'size-6 text-indigo-500' : 'size-8 text-slate-300';

    const titleClass =
        variant === 'card'
            ? 'text-lg font-black text-slate-900 tracking-tight'
            : 'text-base font-bold text-slate-600';

    const bodyClass =
        variant === 'card'
            ? 'text-sm text-slate-600 leading-relaxed'
            : 'text-sm text-slate-400 max-w-xs';

    const wrapperAlign = variant === 'card' ? '' : 'items-center';

    return (
        <div className={containerClass}>
            {Icon && (
                <div className={iconWrapperClass}>
                    <Icon className={iconClass} aria-hidden="true" />
                </div>
            )}
            <div className={cn('space-y-2', wrapperAlign)}>
                <h2 className={titleClass}>{title}</h2>
                {body && <p className={bodyClass}>{body}</p>}
            </div>
            {cta && (
                <Button asChild={!!cta.to} onClick={cta.onClick} className="rounded-xl">
                    {cta.to ? <Link to={cta.to}>{cta.label}</Link> : cta.label}
                </Button>
            )}
        </div>
    );
}
