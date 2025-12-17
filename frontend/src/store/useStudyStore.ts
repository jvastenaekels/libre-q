import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Basic Types for State (Expand as models grow)
export interface StudyConfig {
  slug: string;
  title: string;
  description: string;
  instructions: string;
  presort_config: Record<string, any>;
  grid_config?: { score: number; capacity: number }[];
  postsort_config?: {
      extreme_columns?: number[];
  };
  statements: { id: number; text: string }[];
}

interface SessionState {
  token: string | null;
  hasConsented: boolean;
  currentStep: number;
  maxReachedStep: number;
  language: string;
  isCompleted: boolean;
  confirmationCode: string | null;
}

interface ResponsesState {
  presort: Record<string, any>;
  rough: {
    agree: number[];
    disagree: number[];
    neutral: number[];
    history: number[];
  };
  qsort: { statementId: number; col: number; row: number }[];
  postsort: {
      card_comments: Record<number, string>;
      missing_statement: string;
      general_comment: string;
  };
}

interface StudyStore {
  // Data
  config: StudyConfig | null;
  session: SessionState;
  responses: ResponsesState;

  // Actions
  setConfig: (config: StudyConfig) => void;
  setConsent: (consented: boolean) => void;
  setToken: (token: string) => void;
  setStep: (step: number) => void;
  setPresortResponse: (data: Record<string, any>) => void;
  setPostSortResponse: (field: keyof ResponsesState['postsort'], value: any) => void;
  
  categorizeCard: (statementId: number, category: 'agree' | 'disagree' | 'neutral') => void;
  undoRoughSort: () => void;
  
  // Fine Sort Actions
  placeCardInGrid: (statementId: number, col: number, row: number) => void;
  moveCardInGrid: (statementId: number, col: number, row: number) => void;
  swapCardsInGrid: (id1: number, id2: number) => void;
  unplaceCard: (statementId: number) => void;
  resetFineSort: () => void;

  completeSession: (code: string) => void;
  resetSession: () => void;
  setLanguage: (lang: string) => void;
}

export const useStudyStore = create<StudyStore>()(
  persist(
    (set) => ({
      config: null,
      session: {
        token: null,
        hasConsented: false,
        currentStep: 1, // 1: Welcome
        maxReachedStep: 1,
        language: 'en',
        isCompleted: false,
        confirmationCode: null
      },
      responses: {
        presort: {},
        rough: { agree: [], disagree: [], neutral: [], history: [] },
        qsort: [],
        postsort: { card_comments: {}, missing_statement: '', general_comment: '' },
      },

      setConfig: (config) => set({ config }),
      setConsent: (hasConsented) =>
        set((state) => ({ session: { ...state.session, hasConsented } })),
      setToken: (token) =>
        set((state) => ({ session: { ...state.session, token } })),
      setStep: (step) =>
        set((state) => ({
             session: { 
                 ...state.session, 
                 currentStep: step,
                 maxReachedStep: Math.max(state.session.maxReachedStep, step) 
             }
        })),
      setPresortResponse: (data) =>
        set((state) => ({ responses: { ...state.responses, presort: data } })),

      setPostSortResponse: (field, value) => 
        set((state) => ({
            responses: {
                ...state.responses,
                postsort: {
                    ...state.responses.postsort,
                    [field]: value
                }
            }
        })),
      
      // Rough Sort Actions
      categorizeCard: (statementId, category) =>
        set((state) => {
          const { rough } = state.responses;
          return {
            responses: {
              ...state.responses,
              rough: {
                ...rough,
                [category]: [...rough[category], statementId],
                history: [...rough.history, statementId]
              },
              qsort: [] // Reset Fine Sort if Rough Sort is modified
            },
            session: {
                ...state.session,
                maxReachedStep: Math.min(state.session.maxReachedStep, 3) // Downgrade to Rough Sort (3)
            }
          };
        }),

      undoRoughSort: () =>
        set((state) => {
          const { rough } = state.responses;
          if (rough.history.length === 0) return state;

          const lastCardId = rough.history[rough.history.length - 1];
          const newHistory = rough.history.slice(0, -1);

          // Remove from the specific bucket
          return {
            responses: {
              ...state.responses,
              rough: {
                agree: rough.agree.filter(id => id !== lastCardId),
                disagree: rough.disagree.filter(id => id !== lastCardId),
                neutral: rough.neutral.filter(id => id !== lastCardId),
                history: newHistory
              },
              qsort: [] // Reset Fine Sort if Rough Sort is modified
            },
            session: {
                ...state.session,
                maxReachedStep: Math.min(state.session.maxReachedStep, 3) // Downgrade to Rough Sort (3)
            }
          };
        }),

      // Fine Sort Actions
      placeCardInGrid: (statementId, col, row) => set((state) => {
          // Validation: Check Capacity
          const colConfig = state.config?.grid_config?.[col];
          if (!colConfig) return state; // Invalid column

          const cardsInCol = state.responses.qsort.filter(c => c.col === col && c.statementId !== statementId);
          if (cardsInCol.length >= colConfig.capacity) {
              console.warn(`Column ${col} is full. Capacity: ${colConfig.capacity}`);
              return state; // Prevent overfilling
          }

          // Remove if exists, then add
          const filtered = state.responses.qsort.filter(p => p.statementId !== statementId);
          return {
              responses: {
                  ...state.responses,
                  qsort: [...filtered, { statementId, col, row }]
              }
          };
      }),
      
      moveCardInGrid: (statementId, col, row) => set((state) => {
           // Validation: Check Capacity
           const colConfig = state.config?.grid_config?.[col];
           if (!colConfig) return state;

           const cardsInCol = state.responses.qsort.filter(c => c.col === col && c.statementId !== statementId);
           if (cardsInCol.length >= colConfig.capacity) {
              console.warn(`Column ${col} is full. Capacity: ${colConfig.capacity}`);
              return state; 
           }

           const filtered = state.responses.qsort.filter(p => p.statementId !== statementId);
          return {
              responses: {
                  ...state.responses,
                  qsort: [...filtered, { statementId, col, row }]
              }
          };
      }),

      swapCardsInGrid: (id1, id2) => set((state) => {
           const card1 = state.responses.qsort.find(p => p.statementId === id1);
           const card2 = state.responses.qsort.find(p => p.statementId === id2);

           if (!card1 || !card2) return state; // Safety

           // Create new placements with swapped coords
           // Swapping guarantees respecting capacity since 1 out, 1 in for each column
           const newCard1 = { ...card1, col: card2.col, row: card2.row };
           const newCard2 = { ...card2, col: card1.col, row: card1.row };

           const others = state.responses.qsort.filter(p => p.statementId !== id1 && p.statementId !== id2);
           
           return {
               responses: {
                   ...state.responses,
                   qsort: [...others, newCard1, newCard2]
               }
           };
      }),

      unplaceCard: (statementId) => set((state) => ({
          responses: {
              ...state.responses,
              qsort: state.responses.qsort.filter(p => p.statementId !== statementId)
          }
      })),

      resetFineSort: () => set((state) => ({
          responses: {
              ...state.responses,
              qsort: []
          }
      })),

      completeSession: (code) => set((state) => ({
          session: {
              ...state.session,
              isCompleted: true,
              confirmationCode: code
          }
      })),
      
      resetSession: () => set({
        session: { token: null, hasConsented: false, currentStep: 1, maxReachedStep: 1, language: 'en', isCompleted: false, confirmationCode: null },
        responses: { presort: {}, rough: { agree: [], disagree: [], neutral: [], history: [] }, qsort: [], postsort: { card_comments: {}, missing_statement: '', general_comment: '' } }
      }),

      setLanguage: (lang) => set((state) => ({
          session: { ...state.session, language: lang }
      })),
    }),
    {
      name: 'q-method-storage',
      version: 3, // Bump version
      migrate: (persistedState: any, version: number) => {
        if (version < 3) {
           return {
             ...persistedState,
             session: {
                 ...persistedState.session,
                 isCompleted: false,
                 confirmationCode: null
             }
           };
        }
        return persistedState;
      },
    }
  )
);
// Expose store for E2E testing
if (import.meta.env.DEV) {
  (window as any).useStudyStore = useStudyStore;
}
