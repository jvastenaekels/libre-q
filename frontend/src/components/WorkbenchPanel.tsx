/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { XCircle, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface WorkbenchPanelProps {
    card: { id: number; text: string } | null;
    onClose: () => void;
    className?: string;
    height?: number; // Optional height to match deck
}

const WorkbenchPanel: React.FC<WorkbenchPanelProps> = ({ card, onClose, className = '', height }) => {
    const { t } = useTranslation();

    if (!card) return null;

    return (
        <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.3}
            onDragEnd={(_, info) => {
                if (info.offset.y > 50 || info.velocity.y > 300) {
                    onClose();
                }
            }}
            className={`
                absolute bottom-0 left-0 right-0 
                lg:h-auto lg:relative lg:w-[400px] lg:flex-none lg:border-l lg:border-t-0 border-slate-200
                bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)]
                z-50 flex flex-col cursor-grab active:cursor-grabbing
                ${className}
            `}
            style={{
                height: height ? `${height}px` : '35vh',
            }}
        >
            {/* Slide Handle */}
            <div className="flex-none flex flex-col items-center pt-3 pb-2">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
                <div className="w-6 h-1 bg-slate-200 rounded-full mt-1" />
            </div>

            {/* Instruction Header (Now at top!) */}
            <div className="flex-none px-4 pb-2 text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-wider">
                    <ChevronDown size={14} className="rotate-180 animate-bounce" />
                    {t('fine.workbench.place_on_grid', 'Tap Grid to Place')}
                    <ChevronDown size={14} className="rotate-180 animate-bounce" />
                </div>
            </div>

            {/* Header / Actions */}
            <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md">
                        {t('fine.workbench.active_card', 'Active Card')}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                        #{card.id}
                    </span>
                </div>
                
                <button 
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors touch-manipulation"
                    aria-label={t('common.cancel')}
                >
                    <XCircle size={20} />
                </button>
            </div>

            {/* Content "The Stage" */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar touch-manipulation">
                <div className="max-w-3xl mx-auto">
                    <div className="prose prose-sm prose-indigo text-slate-800 leading-relaxed font-medium">
                        <ReactMarkdown components={{ p: ({ children }) => <span className="block mb-3 last:mb-0">{children}</span> }}>
                            {card.text}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default WorkbenchPanel;
