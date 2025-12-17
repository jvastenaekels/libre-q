import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useStudyStore } from '../store/useStudyStore';
import { useStudyConfig } from '../hooks/useStudyConfig';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const consentSchema = z.object({
    consent: z.boolean().refine(val => val === true, { 
        message: "You must consent to participate." 
    }),
});

type ConsentForm = z.infer<typeof consentSchema>;

const WelcomePage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { session, setConsent, setToken, setStep, config } = useStudyStore();
    const { t } = useTranslation();
    
    // Fetch Data
    const { isLoading, error } = useStudyConfig();

    const { register, handleSubmit, formState: { errors, isValid } } = useForm<ConsentForm>({
        resolver: zodResolver(consentSchema),
        defaultValues: { consent: session.hasConsented }
    });

    if (isLoading) return <div className="text-center p-8">{t('common.loading')}</div>;
    if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;
    if (!config) return null; // Should be handled by loading or error
    
    // Note: We use config from store directly
    const study = config;

    const onSubmit = (data: ConsentForm) => {
        if (data.consent) {
            setConsent(true);
            if (!session.token) {
                setToken(crypto.randomUUID());
            }
            setStep(2); // Move to Pre-Sort
            navigate(`/study/${slug}/presort`);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-12 space-y-8 animate-in fade-in duration-500 px-4">
            <div className="prose prose-blue max-w-none">
                <h1 className="text-3xl font-bold text-gray-900">{study.title}</h1>
                <p className="lead text-xl text-gray-600">{study.description}</p>
                
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 my-8">
                    <Markdown>{study.instructions}</Markdown>
                </div>
            </div>

            <form id="consent-form" onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-6 items-center">
                        <input
                            id="consent"
                            type="checkbox"
                            {...register("consent")}
                            className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer" // 24px (~44px touch area handled by padding usually, but explicitly large here)
                        />
                    </div>
                    <div className="text-sm">
                        <label htmlFor="consent" className="font-medium text-gray-900 cursor-pointer block py-1">
                             {t('welcome.consent.label')}
                        </label>
                        <p className="text-gray-500">{t('welcome.consent.description')}</p>
                        {errors.consent && <p className="text-red-600 mt-1">{t('welcome.consent.error')}</p>}
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={!isValid && !session.hasConsented}
                        className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-md font-bold text-base hover:bg-blue-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                         {t('welcome.start')} <ArrowRight size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default WelcomePage;
