import { useState, useEffect } from 'react';
import { useStudyStore } from '../store/useStudyStore';
import { get } from '../api/client';
import { useParams } from 'react-router-dom';

// Since we haven't typed the backend response strictly in frontend, use 'any' or verify type

export const useStudyConfig = () => {
    const { slug } = useParams();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { setConfig, session } = useStudyStore();

    useEffect(() => {
        if (!slug) return;
        
        const fetchConfig = async () => {
            setIsLoading(true);
            try {
                // Fetch study config from backend
                const data = await get<any>(`/api/study/${slug}?lang=${session.language}`);
                
                setConfig(data);
                
            } catch (err: any) {
                console.error("Failed to fetch study:", err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchConfig();
    }, [slug, session.language, setConfig]); 

    return { isLoading, error };
};
