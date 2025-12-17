import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useStudyStore } from '../store/useStudyStore';
import { ArrowRight } from 'lucide-react';

const PreSortPage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { config, setPresortResponse, setStep } = useStudyStore();
    const { t } = useTranslation();
    
    // Remove LayoutAction hook

    const { register, handleSubmit, formState: { errors, isValid } } = useForm({
        mode: 'onChange'
    });

    // Removed hoisted action effect

    if (!config) return <div>Loading...</div>;

    const onSubmit = (data: any) => {
        setPresortResponse(data);
        setStep(3); // Setup Q-Sort (Next Step)
        navigate(`/study/${slug}/rough-sort`); // Placeholder next route
    };

    const renderField = (key: string, fieldConfig: any) => {
        const commonClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 min-h-[44px] text-base"; // Mobile-first sizing
        
            switch (fieldConfig.type) {
            case 'number':
                return (
                    <input
                        id={key}
                        type="number"
                        {...register(key, { 
                            required: fieldConfig.required,
                            min: { value: fieldConfig.min, message: `Min ${fieldConfig.min}` },
                            max: { value: fieldConfig.max, message: `Max ${fieldConfig.max}` }
                        })}
                        className={commonClasses}
                        placeholder={fieldConfig.label} // Dynamic label
                    />
                );
            case 'select':
                return (
                    <select
                        id={key}
                        {...register(key, { required: fieldConfig.required })}
                        className={commonClasses}
                    >
                        <option value="">{t('presort.select_placeholder')}</option>
                        {fieldConfig.options.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                );
            default: // text
                return (
                    <input
                        id={key}
                        type="text"
                        {...register(key, { required: fieldConfig.required })}
                        className={commonClasses}
                        placeholder={fieldConfig.label}
                    />
                );
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-12 px-4 space-y-6 animate-in slide-in-from-right duration-500">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('presort.title')}</h1>
                <p className="text-gray-600">{t('presort.description')}</p>
            </div>

            <form id="presort-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                {Object.entries(config.presort_config || {}).map(([key, fieldConfig]: [string, any]) => (
                    <div key={key}>
                        <label htmlFor={key} className="block text-sm font-medium text-gray-700">
                            {fieldConfig.label}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {renderField(key, fieldConfig)}
                        {errors[key] && <p className="text-red-500 text-sm mt-1">{t('presort.error_required')}</p>}
                    </div>
                ))}

                <div className="pt-4 flex justify-end w-full">
                    <button
                        type="submit"
                        disabled={!isValid}
                        className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md font-bold text-sm hover:bg-blue-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {t('presort.submit')} <ArrowRight size={16} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PreSortPage;
