/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import { useConfigStore } from '../store/useConfigStore';
import { useSessionStore } from '../store/useSessionStore';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SortingAnimation from '../components/SortingAnimation';

const WelcomePage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    
    const config = useConfigStore((state) => state.config);
    const setStep = useSessionStore((state) => state.setStep);

    // Set Step 1 on mount
    React.useEffect(() => {
        setStep(1);
    }, [setStep]);

    if (!config) return null; 
    
    const study = config;

    const handleContinue = () => {
        navigate(`/study/${slug}/consent`);
    };

    return (
        <div className="max-w-3xl mx-auto py-12 space-y-8 animate-in fade-in duration-500 px-4">
            <div className="prose prose-blue max-w-none">
                <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">{study.title}</h1>
                <p className="lead text-xl text-gray-600">{study.description}</p>
                
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 prose prose-blue max-w-none text-sm leading-relaxed my-8">
                    <Markdown>{study.instructions}</Markdown>
                </div>

                {/* Animated Sorting Example */}
                <div className="mb-12 pt-8">
                     <h3 className="text-center text-lg font-medium text-slate-600 mb-6 font-handwriting">
                        {t('welcome.preview_title', "It's child's play!")}
                    </h3>
                    <div className="bg-slate-50/50 p-8 rounded-xl border border-gray-100 shadow-inner overflow-hidden w-full max-w-4xl mx-auto">
                            <SortingAnimation />
                    </div>
                </div>
            </div>

            {/* Continue Button */}
            <div className="flex justify-center pt-8">
                 <button
                    onClick={handleContinue}
                    className="w-full sm:w-auto px-12 py-3 bg-blue-600 text-white rounded-md font-bold text-lg hover:bg-blue-700 shadow-md flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]"
                >
                    {t('common.continue', 'Continue')} <ArrowRight size={20} />
                </button>
            </div>
    </div>
);
};

export default WelcomePage;
