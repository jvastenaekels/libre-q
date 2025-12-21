/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface WorkbenchPanelProps {
    card: { id: number; text: string } | null;
    onClose: () => void;
    className?: string;
    height?: number;
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
                bg-gradient-to-b from-white to-slate-50 rounded-t-3xl 
                shadow-[0_-8px_30px_rgba(0,0,0,0.15)]
                z-50 flex flex-col cursor-grab active:cursor-grabbing
                ${className}
            `}
            style={{
                height: height ? `${height}px` : '200px',
            }}
        >
            {/* Slide Handle */}
            <div className="flex-none flex flex-col items-center pt-2 pb-1">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            {/* Instruction (at top) */}
            <div className="flex-none px-4 pb-1 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                    <ChevronUp size={12} className="animate-bounce" />
                    {t('fine.workbench.place_on_grid', 'Tap Grid to Place')}
                    <ChevronUp size={12} className="animate-bounce" />
                </div>
            </div>

            {/* Card Content "The Magnifier" */}
            <div 
                className="flex-1 mx-3 mb-3 overflow-y-auto rounded-2xl bg-white border-2 border-indigo-200 shadow-inner p-4"
                onClick={onClose}
            >
                <div className="h-full flex items-center justify-center">
                    <div className="text-center text-slate-800 text-base sm:text-lg font-medium leading-relaxed">
                        <ReactMarkdown components={{ p: ({ children }) => <span className="block">{children}</span> }}>
                            {card.text}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default WorkbenchPanel;
