import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resetBaseLocales } from '../utils/i18nOverrides';

interface SessionState {
    token: string | null;
    hasConsented: boolean;
    currentStep: number;
    maxReachedStep: number;
    language: string | null;
    isCompleted: boolean;
    confirmationCode: string | null;
    isSaving: boolean;

    setToken: (token: string) => void;
    setConsent: (hasConsented: boolean) => void;
    setStep: (step: number) => void;
    setLanguage: (lang: string) => void;
    completeSession: (code: string) => void;
    setSaving: (isSaving: boolean) => void;
    resetSession: () => void;
}

export const useSessionStore = create<SessionState>()(
    persist(
        (set) => ({
            token: null,
            hasConsented: false,
            currentStep: 1,
            maxReachedStep: 1,
            language: null,
            isCompleted: false,
            confirmationCode: null,
            isSaving: false,

            setToken: (token) => set({ token }),
            setConsent: (hasConsented) => set({ hasConsented }),
            setStep: (step) => set((state) => ({
                currentStep: step,
                maxReachedStep: Math.max(state.maxReachedStep, step)
            })),
            setLanguage: (language) => set({ language }),
            completeSession: (confirmationCode) => set({ isCompleted: true, confirmationCode }),
            setSaving: (isSaving) => set({ isSaving }),
            resetSession: () => {
                resetBaseLocales();
                set({
                    token: null,
                    hasConsented: false,
                    currentStep: 1,
                    maxReachedStep: 1,
                    language: null,
                    isCompleted: false,
                    confirmationCode: null,
                    isSaving: false
                });
            }
        }),
        {
            name: 'open-q-session',
            version: 1,
        }
    )
);
