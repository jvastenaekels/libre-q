/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useStudyStore } from '../store/useStudyStore';

const CardZoomOverlay: React.FC = () => {
    const zoomedCard = useStudyStore((state) => state.zoomedCard);
    
    return createPortal(
        <AnimatePresence>
            {zoomedCard && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed bottom-8 left-8 z-[9999] pointer-events-none flex items-end justify-start max-w-sm"
                >
                    <motion.div 
                        initial={{ scale: 0.9, x: -20, opacity: 0 }}
                        animate={{ scale: 1, x: 0, opacity: 1 }}
                        exit={{ scale: 0.9, x: -20, opacity: 0 }}
                        className="relative bg-white p-6 rounded-2xl shadow-2xl border-2 border-indigo-500 flex flex-col pointer-events-auto"
                    >
                        <div className="text-lg font-medium text-slate-800 leading-relaxed font-sans">
                            <ReactMarkdown components={{ p: ({ children }) => <span>{children}</span> }}>
                                {zoomedCard.text}
                            </ReactMarkdown>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default CardZoomOverlay;
