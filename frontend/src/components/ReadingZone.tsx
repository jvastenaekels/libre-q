/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import MethodologyTips from './MethodologyTips';

interface ReadingZoneProps {
    variant: 'mobile' | 'desktop';
}

const ReadingZone: React.FC<ReadingZoneProps> = ({ variant }) => {
    const { t } = useTranslation();
    const hoveredCard = useUIStore((state) => state.hoveredCard);
    const activeCard = useUIStore((state) => state.activeCard);
    const selectedCard = useUIStore((state) => state.selectedCard);

    const displayCard = activeCard || hoveredCard || selectedCard;
    const labelKey = activeCard
        ? 'fine.workbench.active_card'
        : hoveredCard
          ? 'fine.toolbar.preview'
          : 'fine.workbench.active_card';

    if (variant === 'mobile') {
        return (
            <div className="sticky top-0 z-30 flex-none bg-indigo-50/50 backdrop-blur-md border-b border-indigo-100 shadow-sm">
                <div className="p-3 h-20 overflow-y-auto custom-scrollbar">
                    {displayCard ? (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                            <div className="text-[10px] font-bold text-indigo-400 mb-0.5 uppercase tracking-wider flex items-center gap-1.5">
                                <Eye size={12} strokeWidth={2.5} />
                                {t(labelKey)}{' '}
                                {displayCard.code && (
                                    <span className="text-indigo-300 mx-1">•</span>
                                )}{' '}
                                {displayCard.code}
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-slate-800 text-sm font-medium leading-relaxed">
                                    {displayCard.text}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <MethodologyTips variant="mobile" />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 h-40 overflow-y-auto relative transition-all duration-300 custom-scrollbar group">
            {displayCard ? (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-xs font-bold text-indigo-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                        <Eye size={14} strokeWidth={2.5} />
                        {t(labelKey)}{' '}
                        {displayCard.code && <span className="text-indigo-300 mx-1">•</span>}{' '}
                        {displayCard.code}
                    </div>
                    <p className="text-slate-800 text-base sm:text-lg font-medium leading-relaxed">
                        {displayCard.text}
                    </p>
                </div>
            ) : (
                <MethodologyTips variant="desktop" />
            )}
        </div>
    );
};

export default React.memo(ReadingZone);
