import { useState } from 'react';
import { useStudyStore } from '../store/useStudyStore';

export const useSubmitStudy = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmationCode, setConfirmationCode] = useState<string | null>(null);

    const { config, session, responses } = useStudyStore();

    const submit = async (status: 'started' | 'completed' = 'completed', options?: { silent?: boolean }) => {
        if (!options?.silent) {
            setIsLoading(true);
        }
        setError(null);

        try {
            if (!config) throw new Error("Study config is missing");
            // ... (rest of validation)
            if (!config) throw new Error('No configuration loaded');
            if (!session.token) throw new Error('No session token');

            // Transform Q-Sort data to match backend schema
            // Frontend: { statementId, col, row }
            // Backend: { statement_id, grid_score, card_comment }
            const qsortPayload = responses.qsort.map(item => {
                const colKey = item.col; // col index
                // Grid config is array of { score, capacity } sorted by col index?
                // Or map? The type says { score, capacity }[] in store.
                // Assuming index matches col.
                const score = config.grid_config && config.grid_config[colKey] ? config.grid_config[colKey].score : 0; 
                
                return {
                    statement_id: item.statementId,
                    grid_score: score,
                    card_comment: responses.postsort.card_comments[item.statementId] || null
                };
            });

            const payload = {
                session_token: session.token,
                study_slug: config.slug,
                language_used: session.language,
                status: status, 
                presort_answers: responses.presort,
                qsort: qsortPayload,
                postsort_answers: {
                    ...responses.postsort,
                }
            };
            
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

            const response = await fetch(`${API_BASE_URL}/api/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Submission failed');
            }

            const data = await response.json();
            
            
            if (status === 'completed') {
                setIsSuccess(true);
                setConfirmationCode(data.confirmation_code);
                // Mark session as completed in store
                 useStudyStore.getState().completeSession(data.confirmation_code);
            } else {
                 console.log('Partial save successful');
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An unexpected error occurred');
        } finally {
            if (!options?.silent) {
                setIsLoading(false);
            }
        }
    };

    return { submit, isLoading, isSuccess, error, confirmationCode };
};
