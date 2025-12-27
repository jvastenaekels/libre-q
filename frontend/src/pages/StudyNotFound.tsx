import React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchX, Home } from 'lucide-react';

const StudyNotFound: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full flex flex-col items-center space-y-6">
                {/* Illustration Icon */}
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                    <SearchX size={40} className="text-slate-400" />
                </div>

                {/* Text Content */}
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-slate-800">
                        {t('errors.study_not_found.title', 'Study Not Found')}
                    </h1>
                    <p className="text-slate-600">
                        {t(
                            'errors.study_not_found.message',
                            "We couldn't find a study with that name. Please check the URL or contact the researcher."
                        )}
                    </p>
                </div>

                {/* Action */}
                <a
                    href="/"
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transition-colors duration-200"
                >
                    <Home size={18} />
                    {t('errors.study_not_found.action', 'Go to Home')}
                </a>
            </div>

            {/* Footer Help */}
            <p className="mt-8 text-sm text-slate-400">Open-Q Platform</p>
        </div>
    );
};

export default StudyNotFound;
