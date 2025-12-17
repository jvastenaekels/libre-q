import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Outlet, useParams, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useStudyStore } from '../store/useStudyStore';
import { Languages, ChevronDown } from 'lucide-react';
import { LayoutProvider, useLayoutAction } from '../contexts/LayoutContext';

const steps = [
  { id: 1, labelKey: 'layout.steps.welcome' },
  { id: 2, labelKey: 'layout.steps.presort' },
  { id: 3, labelKey: 'layout.steps.rough' },
  { id: 4, labelKey: 'layout.steps.fine' },
  { id: 5, labelKey: 'layout.steps.review' },
];

const StudyLayoutContent: React.FC = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { session } = useStudyStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { headerAction } = useLayoutAction();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const changeLanguage = (lng: string) => {
      i18n.changeLanguage(lng);
      // Sync store
      useStudyStore.getState().setLanguage(lng);
      setIsLangMenuOpen(false);
  };

  // Basic Protection Check
  const isProtected = ['presort', 'sort', 'review'].some(path => location.pathname.includes(path));
  if (isProtected && !session.hasConsented) {
    return <Navigate to={`/study/${slug}/welcome`} replace />;
  }

  // Enforce One-Time Submission
  // If completed, redirect everything to post-sort (Thank You page)
  if (session.isCompleted && !location.pathname.includes('post-sort')) {
      return <Navigate to={`/study/${slug}/post-sort`} replace />;
  }

  // Determine if we should show the mobile footer (only if headerAction exists)
  // This effectively acts as the bottom bar for mobile when an action is present
  const showMobileFooter = !!headerAction;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 flex-none relative">
        <div className="w-full max-w-[1920px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4 relative">
          
          {/* LEFT: Branding */}
          <div className="font-bold text-gray-900 flex-shrink-0 z-10 bg-white pr-4">
              Q-Method App
          </div>

          {/* CENTER: Stepper (Desktop) - Absolute Centered */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            
            {/* XL+ Screens: Full Stepper */}
            <div className="hidden xl:flex items-center space-x-8">
               {steps.map((step, index) => {
                  const isActive = session.currentStep === step.id;
                  const isCompleted = session.currentStep > step.id; // Visual completion of step
                  
                  // Disable navigation if global session is completed (except step 5 maybe, but redundant if redirect)
                  // Or just disable everything if completed to prevent confusion
                  const isDisabled = session.isCompleted || step.id > session.maxReachedStep;

                  return (
                    <div key={step.id} className="flex items-center">
                        {/* Connecting Line (except first) */}
                        {index > 0 && (
                            <div className={`w-12 h-0.5 mx-2 ${isCompleted || isActive ? 'bg-blue-600' : 'bg-gray-200'}`} />
                        )}
                        
                        <button
                            onClick={() => {
                                // Only allow navigation if step is reachable and not globally completed
                                if (!isDisabled) {
                                    useStudyStore.getState().setStep(step.id);
                                    // Also navigate to the correct URL
                                    // slug is available from hook logic above
                                    // We need to map step ID to path segment manually or via a helper
                                    const paths: Record<number, string> = {
                                        1: 'welcome',
                                        2: 'presort',
                                        3: 'rough-sort',
                                        4: 'sort', 
                                        5: 'post-sort'
                                    };
                                    navigate(`/study/${slug}/${paths[step.id]}`);
                                }
                            }}
                            disabled={isDisabled}
                            className={`flex items-center gap-2 text-sm transition-colors ${
                                !isDisabled ? 'cursor-pointer hover:text-blue-800' : 'cursor-not-allowed text-gray-400'
                            } ${isActive ? 'text-blue-600 font-bold' : isCompleted ? 'text-gray-900' : ''}`}
                        >
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-xs border transition-colors duration-300
                                ${isActive ? 'border-blue-600 bg-blue-50 text-blue-600' : isCompleted ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-400'}
                            `}>
                                {step.id}
                            </div>
                            <span className="whitespace-nowrap">{t(step.labelKey)}</span>
                        </button>
                    </div>
                  );
               })}
            </div>

            {/* MD-XL Screens: Compact Stepper */}
            <div className="flex xl:hidden flex-col items-center">
                <span className="text-xs uppercase tracking-wider text-gray-500 font-bold">{t('layout.mobile_step')} {session.currentStep} / {steps.length}</span>
                <span className="text-sm font-semibold text-gray-900">
                    {t(steps.find(s => s.id === session.currentStep)?.labelKey || '')}
                </span>
            </div>
          </div>


          {/* RIGHT: Actions + Language */}
          <div className="flex items-center gap-3 z-10 bg-white pl-4">
             {/* Language Dropdown */}
            <div className="relative" ref={langMenuRef}>
                <button 
                    onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                    className={`
                        p-2 rounded-full flex items-center gap-2 transition-all duration-200 border
                        ${isLangMenuOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-transparent hover:bg-gray-100 text-gray-600'}
                    `}
                    title="Select Language"
                >
                    <Languages size={20} />
                    <span className="hidden 2xl:inline text-sm font-medium">
                        {i18n.language.startsWith('fr') ? 'Français' : i18n.language.startsWith('fi') ? 'Suomi' : 'English'}
                    </span>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isLangMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2">
                        <div className="px-3 py-2 border-b border-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Select Language
                        </div>
                        <button 
                            onClick={() => changeLanguage('en')}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${i18n.language.startsWith('en') ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-gray-700'}`}
                        >
                            <span>English</span>
                            {i18n.language.startsWith('en') && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                        </button>
                        <button 
                            onClick={() => changeLanguage('fr')}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${i18n.language.startsWith('fr') ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-gray-700'}`}
                        >
                            <span>Français</span>
                            {i18n.language.startsWith('fr') && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                        </button>
                        <button 
                            onClick={() => changeLanguage('fi')}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${i18n.language.startsWith('fi') ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-gray-700'}`}
                        >
                            <span>Suomi</span>
                            {i18n.language.startsWith('fi') && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                        </button>
                    </div>
                )}
            </div>

            {/* PRIMARY ACTION (Desktop) */}
            <div className="hidden md:block">
                {headerAction}
            </div>
          </div>
        </div>
        
        {/* Stepper (Mobile) - Keep independent below */}
        <div className="md:hidden border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600 text-center flex items-center justify-center gap-2">
            <span className="bg-gray-200 text-gray-700 px-1.5 rounded text-[10px]">{session.currentStep}/{steps.length}</span>
            <span>{t(steps.find(s => s.id === session.currentStep)?.labelKey || '')}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto overflow-y-auto relative flex flex-col">
        <Outlet />
      </main>

      {/* Mobile Footer for Action (Validation Gate) */}
      {showMobileFooter && (
          <div className="md:hidden flex-none bg-white border-t border-gray-200 p-4 sticky bottom-0 z-50 pb-safe">
              {headerAction}
          </div>
      )}
    </div>
  );
};

const StudyLayout: React.FC = () => {
    return (
        <LayoutProvider>
            <StudyLayoutContent />
        </LayoutProvider>
    );
};

export default StudyLayout;
